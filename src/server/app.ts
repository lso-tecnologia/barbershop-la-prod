import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { verifySync, generateURI } from 'otplib';
import QRCode from 'qrcode';
import { db } from './db.js';

const app = express();
app.set('trust proxy', 1); // Vercel: pega o IP real do cliente (x-forwarded-for)
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const isProd = process.env.NODE_ENV === 'production';
const JWT_SECRET = process.env.JWT_SECRET || (isProd ? '' : 'dev_only_secret_change_me');
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'leo.arruda226@gmail.com').toLowerCase();

// Headers de segurança
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// Se faltar variável de ambiente, responde JSON claro (em vez de erro obscuro)
app.use('/api', (req, res, next) => {
  const missing = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'JWT_SECRET'].filter((k) => !process.env[k] && !(k === 'JWT_SECRET' && !isProd));
  if (missing.length) {
    return res.status(500).json({ error: `Servidor não configurado. Variáveis ausentes na Vercel: ${missing.join(', ')}` });
  }
  next();
});

export interface AuthRequest extends Request {
  user?: { id: string; email: string; role: 'client' | 'barber_admin'; name: string };
}

function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.split(' ')[1]) || req.cookies?.auth_token;
  if (!token) return res.status(401).json({ error: 'Não autorizado. Faça login para continuar.' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded.is2FAPending) return res.status(403).json({ error: 'Conclua a verificação 2FA.' });
    req.user = decoded;
    next();
  } catch {
    return res.status(403).json({ error: 'Sessão expirada ou inválida.' });
  }
}

function requireBarberAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'barber_admin') {
    return res.status(403).json({ error: 'Acesso negado. Apenas o administrador da barbearia tem permissão.' });
  }
  next();
}

// Permite handlers async sem try/catch repetido
const h = (fn: (req: AuthRequest, res: Response) => Promise<any>) => (req: Request, res: Response, next: NextFunction) =>
  fn(req as AuthRequest, res).catch(next);

const publicUser = (u: { id: string; name: string; email: string; phone: string; role: string }) => ({
  id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role,
});

function setSessionCookie(res: Response, token: string, days: number) {
  res.cookie('auth_token', token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    maxAge: days * 24 * 60 * 60 * 1000,
  });
}


// Envio de e-mail via Resend (https://resend.com). Requer RESEND_API_KEY e RESEND_FROM.
async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!key || !from) return false;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!r.ok) console.error('Resend falhou:', r.status, await r.text());
    return r.ok;
  } catch (err) {
    console.error('Erro ao enviar e-mail:', err);
    return false;
  }
}

// ========== AUTENTICAÇÃO DO CLIENTE ==========

app.post('/api/auth/register', h(async (req, res) => {
  const { name, email, phone, password } = req.body || {};
  if (!name || !email || !phone || !password) {
    return res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: 'A senha deve ter no mínimo 6 caracteres.' });
  }
  const cleanEmail = String(email).trim().toLowerCase();
  if (!/^[^\s@,()]+@[^\s@,()]+\.[^\s@,()]+$/.test(cleanEmail) || cleanEmail.length > 120) {
    return res.status(400).json({ error: 'Informe um e-mail válido.' });
  }
  if (await db.findUserByEmail(cleanEmail)) {
    return res.status(400).json({ error: 'Este e-mail já está cadastrado.' });
  }
  const newUser = await db.createUser({
    role: 'client',
    name: String(name).trim(),
    phone: String(phone).trim(),
    email: cleanEmail,
    passwordHash: bcrypt.hashSync(String(password), 10),
  });
  const token = jwt.sign({ id: newUser.id, email: newUser.email, role: newUser.role, name: newUser.name }, JWT_SECRET, { expiresIn: '30d' });
  setSessionCookie(res, token, 30);
  await db.addAuditLog('CLIENT_REGISTER', `Cliente ${newUser.name} se cadastrou`, newUser.id, newUser.name, req.ip);
  return res.status(201).json({ message: 'Cadastro realizado com sucesso!', user: publicUser(newUser), token });
}));

app.post('/api/auth/login', h(async (req, res) => {
  const ip = req.ip || 'unknown';
  if (await db.isIpLocked(ip)) {
    return res.status(429).json({ error: 'Muitas tentativas falhas. Bloqueado por 15 minutos por segurança.' });
  }
  const { loginIdentifier, password } = req.body || {};
  if (!loginIdentifier || !password) {
    return res.status(400).json({ error: 'Informe seu e-mail e senha.' });
  }
  const user = await db.findUserByEmail(String(loginIdentifier).trim().toLowerCase());
  if (!user || !bcrypt.compareSync(String(password), user.passwordHash)) {
    await db.recordFailedLogin(ip);
    return res.status(401).json({ error: 'Credenciais inválidas. Verifique seu e-mail e senha.' });
  }
  // O administrador só entra pelo fluxo com 2FA
  if (user.role === 'barber_admin') {
    return res.status(403).json({ error: 'Conta de administrador: use o "Acesso do Barbeiro".' });
  }
  await db.resetFailedLogin(ip);
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '30d' });
  setSessionCookie(res, token, 30);
  return res.json({ message: 'Login realizado com sucesso!', user: publicUser(user), token });
}));

// ========== LOGIN DO BARBEIRO (2 ETAPAS) ==========

app.post('/api/auth/barber/login-step1', h(async (req, res) => {
  const ip = req.ip || 'unknown';
  if (await db.isIpLocked(ip)) {
    return res.status(429).json({ error: 'Bloqueio preventivo de força bruta ativo. Aguarde 15 minutos.' });
  }
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Informe o e-mail administrativo e senha.' });

  const user = await db.findUserByEmail(String(email).trim().toLowerCase());
  if (!user || user.role !== 'barber_admin' || !bcrypt.compareSync(String(password), user.passwordHash)) {
    await db.recordFailedLogin(ip);
    return res.status(401).json({ error: 'Credenciais administrativas incorretas.' });
  }
  if (!user.twoFactorSecret) {
    return res.status(409).json({ error: '2FA não configurado para este administrador. Acesse /api/setup.' });
  }
  const tempToken = jwt.sign({ id: user.id, is2FAPending: true }, JWT_SECRET, { expiresIn: '5m' });
  return res.json({ message: 'Credenciais válidas. Prossiga para a validação do 2FA.', tempToken, requires2FA: true });
}));

app.post('/api/auth/barber/login-step2', h(async (req, res) => {
  const ip = req.ip || 'unknown';
  if (await db.isIpLocked(ip)) {
    return res.status(429).json({ error: 'Bloqueio preventivo de força bruta ativo. Aguarde 15 minutos.' });
  }
  const { tempToken, code } = req.body || {};
  if (!tempToken || !code) return res.status(400).json({ error: 'Token temporário e código 2FA são obrigatórios.' });

  let decoded: any;
  try {
    decoded = jwt.verify(tempToken, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Sessão 2FA expirada. Faça login novamente.' });
  }
  if (!decoded.is2FAPending) return res.status(400).json({ error: 'Fluxo 2FA inválido.' });

  const user = await db.findUserById(decoded.id);
  if (!user || user.role !== 'barber_admin' || !user.twoFactorSecret) {
    return res.status(404).json({ error: 'Administrador não encontrado.' });
  }

  let valid = false;
  try {
    valid = verifySync({ token: String(code).trim(), secret: user.twoFactorSecret }).valid;
  } catch {
    valid = false;
  }
  if (!valid) {
    await db.recordFailedLogin(ip);
    return res.status(401).json({ error: 'Código 2FA inválido ou expirado. Tente novamente.' });
  }

  await db.resetFailedLogin(ip);
  const fullToken = jwt.sign({ id: user.id, email: user.email, role: 'barber_admin', name: user.name }, JWT_SECRET, { expiresIn: '7d' });
  setSessionCookie(res, fullToken, 7);
  await db.addAuditLog('ADMIN_LOGIN_2FA', `${user.name} realizou login com 2FA`, user.id, user.name, req.ip);
  return res.json({ message: 'Autenticação 2FA concluída com sucesso!', user: publicUser(user), token: fullToken });
}));

// QR Code do 2FA: agora SÓ para o admin já autenticado (antes era público!)
app.get('/api/auth/barber/2fa-setup', authenticateToken, requireBarberAdmin, h(async (req, res) => {
  const admin = await db.findUserById(req.user!.id);
  if (!admin?.twoFactorSecret) return res.status(404).json({ error: '2FA não configurado.' });
  const otpauth = generateURI({ secret: admin.twoFactorSecret, issuer: 'BARBERSHOP L.A', label: admin.name });
  const qrCodeDataUrl = await QRCode.toDataURL(otpauth, { margin: 2, width: 250 });
  return res.json({ secret: admin.twoFactorSecret, otpauth, qrCodeDataUrl });
}));

// ========== RECUPERAÇÃO DE SENHA (somente clientes) ==========

app.post('/api/auth/forgot-password', h(async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Informe seu e-mail cadastrado.' });
  const user = await db.findUserByEmail(String(email).trim().toLowerCase());

  // Resposta sempre igual (não revela se o e-mail existe). Admin não usa este fluxo.
  const response: Record<string, unknown> = { message: 'Se o e-mail existir, as instruções foram geradas.' };
  if (user && user.role === 'client') {
    const resetToken = crypto.randomBytes(4).toString('hex').toUpperCase();
    await db.createPasswordReset(user.email, resetToken);
    await db.addAuditLog('PASSWORD_RESET_REQUEST', `Redefinição solicitada para ${user.email}`, user.id, user.name, req.ip);
    await sendEmail(
      user.email,
      'Código para redefinir sua senha — BARBERSHOP L.A',
      `<p>Olá, ${esc(user.name)}!</p><p>Seu código para redefinir a senha é:</p>` +
        `<p style="font-size:24px;font-weight:bold;letter-spacing:3px">${resetToken}</p>` +
        `<p>Ele vale por 15 minutos. Se não foi você, ignore este e-mail.</p>`
    );
    // Só para testes: devolve o código na resposta (nunca ative em produção)
    if (process.env.ALLOW_PREVIEW_RESET_TOKEN === 'true') response.previewToken = resetToken;
  }
  return res.json(response);
}));

app.post('/api/auth/reset-password', h(async (req, res) => {
  const { token, newPassword } = req.body || {};
  if (!token || !newPassword) return res.status(400).json({ error: 'Token e nova senha são obrigatórios.' });
  if (String(newPassword).length < 6) return res.status(400).json({ error: 'A nova senha deve ter no mínimo 6 caracteres.' });
  const ok = await db.verifyAndConsumeResetToken(String(token).trim().toUpperCase(), bcrypt.hashSync(String(newPassword), 10));
  if (!ok) return res.status(400).json({ error: 'Código de redefinição inválido ou expirado.' });
  return res.json({ message: 'Senha redefinida com sucesso! Agora você já pode entrar.' });
}));

app.get('/api/auth/me', authenticateToken, h(async (req, res) => {
  const user = await db.findUserById(req.user!.id);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });
  return res.json({ user: publicUser(user) });
}));

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('auth_token');
  return res.json({ message: 'Sessão encerrada com sucesso.' });
});

// ========== DADOS PÚBLICOS ==========

app.get('/api/settings', h(async (_req, res) => res.json(await db.getSettings())));

app.post('/api/settings/toggle-open', authenticateToken, requireBarberAdmin, h(async (req, res) => {
  const isOpen = await db.toggleOpenStatus();
  await db.addAuditLog('TOGGLE_SHOP_STATUS', `Barbearia ${isOpen ? 'ABERTA' : 'FECHADA'}`, req.user?.id, req.user?.name, req.ip);
  return res.json({ isOpen, message: `Barbearia agora está ${isOpen ? 'ABERTA' : 'FECHADA'}` });
}));

app.get('/api/services', h(async (_req, res) => res.json(await db.getServices())));
app.post('/api/admin/services', authenticateToken, requireBarberAdmin, h(async (req, res) => {
  const { id, name, description = '', price, durationMinutes = 60, isPopular = false } = req.body || {};
  if (typeof name !== 'string' || !name.trim()) return res.status(400).json({ error: 'Informe o nome do serviço.' });
  if (!Number.isFinite(Number(price)) || Number(price) < 0) return res.status(400).json({ error: 'Informe um preço válido.' });
  if (!Number.isFinite(Number(durationMinutes)) || Number(durationMinutes) < 1) return res.status(400).json({ error: 'Informe uma duração válida.' });
  await db.upsertService({ id: typeof id === 'string' ? id : undefined, name, description: String(description), price: Number(price), durationMinutes: Number(durationMinutes), duration: `${Number(durationMinutes)} min`, isPopular: !!isPopular });
  await db.addAuditLog('SERVICE_UPSERT', `Serviço atualizado: ${name.trim()}`, req.user!.id, req.user!.name, req.ip);
  return res.json({ services: await db.getServices() });
}));
app.delete('/api/admin/services/:id', authenticateToken, requireBarberAdmin, h(async (req, res) => {
  await db.deleteService(req.params.id);
  await db.addAuditLog('SERVICE_DEACTIVATED', `Serviço desativado: ${req.params.id}`, req.user!.id, req.user!.name, req.ip);
  return res.json({ services: await db.getServices() });
}));
app.get('/api/packages', h(async (_req, res) => res.json(await db.getPackages())));
app.get('/api/notices/active', h(async (_req, res) => res.json(await db.getActiveNotice())));

// ========== AGENDAMENTOS ==========

// Brasil (Brasília) = UTC-3 fixo, sem horário de verão desde 2019
const slotMoment = (date: string, time: string) => new Date(`${date}T${time}:00-03:00`);
const todayBR = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);

function validSlotsFor(date: string): string[] {
  const [y, m, d] = date.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Dom, 1=Seg
  if (dow === 1) return [];
  // DOMINGO: 09h às 14h (slots fracionados de 30 em 30 min, último às 13h30)
  if (dow === 0) {
    return ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30'];
  }
  // TERÇA A SÁBADO: 09h às 19h (slots fracionados de 30 em 30 min, último às 18h30)
  return [
    '09:00', '09:30',
    '10:00', '10:30',
    '11:00', '11:30',
    '12:00', '12:30',
    '13:00', '13:30',
    '14:00', '14:30',
    '15:00', '15:30',
    '16:00', '16:30',
    '17:00', '17:30',
    '18:00', '18:30',
  ];
}

// Se houver token válido, identifica o usuário; senão segue como visitante
function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.split(' ')[1]) || req.cookies?.auth_token;
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (!decoded.is2FAPending) req.user = decoded;
    } catch { /* visitante */ }
  }
  next();
}

const isValidDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));

// Horários já ocupados de um dia (sem dados pessoais)
app.get('/api/appointments/taken', h(async (req, res) => {
  const date = req.query.date;
  if (!isValidDate(date)) return res.status(400).json({ error: 'Data inválida.' });
  await db.expireUnpaid();
  return res.json({ date, taken: await db.getTakenTimes(date) });
}));

app.post('/api/appointments', optionalAuth, h(async (req, res) => {
  const b = req.body || {};
  const date = b.date, time = String(b.time || '');
  if (!isValidDate(date)) return res.status(400).json({ error: 'Data inválida.' });

  const slots = validSlotsFor(date);
  if (!slots.length) return res.status(400).json({ error: 'A barbearia não abre às segundas-feiras.' });
  if (!slots.includes(time)) return res.status(400).json({ error: 'Horário indisponível para este dia.' });

  const when = slotMoment(date, time);
  if (when.getTime() <= Date.now()) return res.status(400).json({ error: 'Este horário já passou. Escolha outro.' });
  if (when.getTime() > Date.now() + 90 * 24 * 3600 * 1000) return res.status(400).json({ error: 'Agendamentos só até 90 dias à frente.' });

  const clientName = String(b.clientName || '').trim().slice(0, 80);
  const clientPhone = String(b.clientPhone || '').trim().slice(0, 20);
  const itemName = String(b.itemName || '').trim().slice(0, 120);
  if (!clientName || clientPhone.replace(/\D/g, '').length < 10 || !itemName) {
    return res.status(400).json({ error: 'Preencha nome, WhatsApp e serviço.' });
  }

  await db.expireUnpaid(); // libera reservas online não pagas antes de contar/checar

  // Anti-spam: no máximo 3 agendamentos ativos por telefone
  if ((await db.countActiveByPhone(clientPhone, todayBR())) >= 3) {
    return res.status(429).json({ error: 'Limite de 3 agendamentos ativos por telefone. Cancele um ou fale com o barbeiro.' });
  }

  // Apenas Pix para online ou Pagar no Local (sem cartão)
  const paymentMethod = b.paymentMethod === 'pix' ? 'pix' : 'in_person';
  const online = paymentMethod !== 'in_person';
  const itemType: 'service' | 'package' = b.itemType === 'package' ? 'package' : 'service';

  // Preço oficial do banco. Pagamento online EXIGE preço válido do catálogo.
  const catalogPrice = await db.findCatalogPrice(itemName, itemType);
  if (online && !process.env.MP_ACCESS_TOKEN) {
    return res.status(503).json({ error: 'Pagamento online indisponível no momento. Escolha pagar no local.' });
  }
  if (online && (catalogPrice === null || catalogPrice <= 0)) {
    return res.status(400).json({ error: 'Este item não pode ser pago online (valor à combinar). Escolha pagar no local.' });
  }
  const price = catalogPrice ?? Math.min(Math.max(Number(b.price) || 0, 0), 2000);
  const email = req.user
    ? req.user.email
    : String(b.clientEmail || `${clientPhone.replace(/\D/g, '')}@barbershopla.com.br`).trim().toLowerCase().slice(0, 120);

  try {
    const apt = await db.createAppointment({
      userId: req.user?.id ?? null,
      clientName, clientPhone, clientEmail: email, itemName,
      itemType,
      price, date, time,
      // Online: fica "pendente" (segura o horário por 15 min) até o Mercado Pago confirmar o pagamento
      status: online ? 'pending' : 'confirmed',
      paymentMethod,
      paymentStatus: 'pending',
    });
    await db.addAuditLog('APPOINTMENT_CREATED', `${clientName} agendou ${itemName} em ${date} ${time}`, req.user?.id, clientName, req.ip);
    return res.status(201).json({ appointment: apt });
  } catch (err: any) {
    if (err.message === 'SLOT_TAKEN') return res.status(409).json({ error: 'Esse horário acabou de ser ocupado. Escolha outro.' });
    throw err;
  }
}));

app.get('/api/appointments/mine', authenticateToken, h(async (req, res) => {
  const list = await db.getAppointmentsForUser(req.user!.id, req.user!.email);
  return res.json({ appointments: list });
}));

app.patch('/api/appointments/:id/cancel', authenticateToken, h(async (req, res) => {
  const apt = await db.getAppointmentById(req.params.id);
  if (!apt) return res.status(404).json({ error: 'Agendamento não encontrado.' });

  const isAdmin = req.user!.role === 'barber_admin';
  const isOwner = apt.userId === req.user!.id || apt.clientEmail.toLowerCase() === req.user!.email.toLowerCase();
  if (!isAdmin && !isOwner) return res.status(403).json({ error: 'Você não pode cancelar este agendamento.' });
  if (apt.status === 'cancelled' || apt.status === 'completed') return res.status(400).json({ error: 'Este agendamento não pode mais ser cancelado.' });
  if (!isAdmin && apt.paymentStatus === 'paid' && apt.paymentMethod !== 'in_person') {
    return res.status(400).json({ error: 'Este horário já foi pago online. Para cancelar e pedir reembolso, fale com o barbeiro pelo WhatsApp.' });
  }

  if (!isAdmin) {
    const hoursLeft = (slotMoment(apt.date, apt.time).getTime() - Date.now()) / 3600000;
    if (hoursLeft < 2) return res.status(400).json({ error: 'Cancelamento só até 2h antes. Fale com o barbeiro pelo WhatsApp.' });
  }
  const updated = await db.updateAppointment(apt.id, { status: 'cancelled' });
  await db.addAuditLog('APPOINTMENT_CANCELLED', `Agendamento ${apt.id} cancelado`, req.user!.id, req.user!.name, req.ip);
  return res.json({ appointment: updated });
}));

// Consulta pública segura de agendamentos pelo WhatsApp/Telefone
app.post('/api/appointments/by-phone', h(async (req, res) => {
  const phone = String(req.body?.phone || '').trim().replace(/\D/g, '');
  if (phone.length < 8) {
    return res.status(400).json({ error: 'Informe um WhatsApp/telefone com DDD.' });
  }
  const list = await db.getAppointmentsByPhone(phone);
  return res.json({ appointments: list });
}));

// Cancelamento pelo WhatsApp/Telefone informado na reserva (respeita a regra de 2h de antecedência)
app.patch('/api/appointments/:id/cancel-public', h(async (req, res) => {
  const phone = String(req.body?.phone || '').trim().replace(/\D/g, '');
  const apt = await db.getAppointmentById(req.params.id);
  if (!apt) return res.status(404).json({ error: 'Agendamento não encontrado.' });

  const aptPhone = String(apt.clientPhone || '').replace(/\D/g, '');
  if (!phone || aptPhone !== phone) {
    return res.status(403).json({ error: 'O número de telefone não corresponde ao agendamento.' });
  }
  if (apt.status === 'cancelled' || apt.status === 'completed') {
    return res.status(400).json({ error: 'Este agendamento não pode mais ser cancelado.' });
  }
  if (apt.paymentStatus === 'paid' && apt.paymentMethod !== 'in_person') {
    return res.status(400).json({ error: 'Este horário já foi pago online via Pix. Para cancelar e solicitar estorno, fale diretamente com o Leonardo pelo WhatsApp.' });
  }

  const hoursLeft = (slotMoment(apt.date, apt.time).getTime() - Date.now()) / 3600000;
  if (hoursLeft < 2) {
    return res.status(400).json({ error: 'Cancelamento pelo app só é permitido com mais de 2 horas de antecedência. Para horários próximos, chame o Leonardo no WhatsApp.' });
  }

  const updated = await db.updateAppointment(apt.id, { status: 'cancelled' });
  await db.addAuditLog('APPOINTMENT_CANCELLED', `Agendamento ${apt.id} cancelado pelo cliente via telefone`, undefined, apt.clientName, req.ip);
  return res.json({ appointment: updated });
}));

// ----- Agenda do barbeiro -----
app.get('/api/admin/appointments', authenticateToken, requireBarberAdmin, h(async (req, res) => {
  const from = isValidDate(req.query.from) ? req.query.from : todayBR();
  const to = isValidDate(req.query.to) ? req.query.to : new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  return res.json({ appointments: await db.listAppointments(from, to) });
}));

app.patch('/api/admin/appointments/:id', authenticateToken, requireBarberAdmin, h(async (req, res) => {
  const { status, paymentStatus } = req.body || {};
  if (status && !['pending', 'confirmed', 'completed', 'cancelled'].includes(status)) return res.status(400).json({ error: 'Status inválido.' });
  if (paymentStatus && !['pending', 'paid'].includes(paymentStatus)) return res.status(400).json({ error: 'Status de pagamento inválido.' });
  if (!status && !paymentStatus) return res.status(400).json({ error: 'Nada para atualizar.' });
  const updated = await db.updateAppointment(req.params.id, { status, paymentStatus });
  if (!updated) return res.status(404).json({ error: 'Agendamento não encontrado.' });
  await db.addAuditLog('APPOINTMENT_UPDATED', `Agendamento ${updated.id}: ${status ?? ''} ${paymentStatus ?? ''}`.trim(), req.user!.id, req.user!.name, req.ip);
  return res.json({ appointment: updated });
}));

// ========== PAGAMENTOS ONLINE (MERCADO PAGO — Checkout Pro: Pix e Cartão) ==========

const MP_API = 'https://api.mercadopago.com';
const HOLD_MINUTES = 15;

function siteUrl(req: Request): string {
  const env = (process.env.SITE_URL || '').trim().replace(/\/+$/, '');
  if (env) return env;
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol).split(',')[0];
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0];
  return `${proto}://${host}`;
}

async function mp(path: string, init: { method?: string; body?: string } = {}): Promise<any> {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new Error('Pagamento online não configurado (MP_ACCESS_TOKEN ausente).');
  const r = await fetch(`${MP_API}${path}`, {
    method: init.method || 'GET',
    body: init.body,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  const text = await r.text();
  let json: any = {};
  try { json = text ? JSON.parse(text) : {}; } catch { /* resposta não-JSON */ }
  if (!r.ok) {
    console.error('Mercado Pago erro', r.status, text);
    throw new Error(`Mercado Pago recusou a requisição (${r.status}). ${json.message || ''}`.trim());
  }
  return json;
}

// Aplica um pagamento do Mercado Pago ao agendamento (idempotente)
async function applyMpPayment(p: any): Promise<void> {
  const ref = String(p?.external_reference || '');
  if (!ref || p?.status !== 'approved') return;
  const apt = await db.getAppointmentById(ref);
  if (!apt || apt.paymentStatus === 'paid') return;

  if (p.currency_id && p.currency_id !== 'BRL') return;
  // transaction_amount = valor do item (parcelas com juros ficam em total_paid_amount)
  if (Number(p.transaction_amount) + 0.01 < apt.price) {
    await db.addAuditLog('PAYMENT_AMOUNT_MISMATCH', `Pagamento ${p.id} de R$ ${p.transaction_amount} para ${apt.id} (esperado R$ ${apt.price})`);
    return;
  }

  const mpPaymentId = String(p.id);
  try {
    await db.updateAppointment(apt.id, {
      status: apt.status === 'completed' ? 'completed' : 'confirmed',
      paymentStatus: 'paid',
      mpPaymentId,
    });
    await db.addAuditLog('PAYMENT_APPROVED', `Pagamento ${mpPaymentId} aprovado para ${apt.id}`, apt.userId ?? undefined, apt.clientName);
  } catch (err: any) {
    if (err.message !== 'SLOT_TAKEN') throw err;
    // Pagou depois de a reserva expirar e o horário foi ocupado por outra pessoa -> reembolso manual
    await db.updateAppointment(apt.id, { paymentStatus: 'paid', mpPaymentId });
    await db.addAuditLog('PAYMENT_APPROVED_SLOT_LOST', `REEMBOLSAR pagamento ${mpPaymentId}: horário de ${apt.id} já foi ocupado`, apt.userId ?? undefined, apt.clientName);
  }
}

async function syncPaymentFromMp(apt: { id: string }): Promise<void> {
  const r = await mp(`/v1/payments/search?external_reference=${encodeURIComponent(apt.id)}&sort=date_created&criteria=desc&limit=5`);
  for (const p of r.results || []) {
    if (p.status === 'approved') { await applyMpPayment(p); break; }
  }
}

// Cria o link de pagamento (Pix ou Cartão) para um agendamento pendente
app.post('/api/payments/checkout', h(async (req, res) => {
  const id = String(req.body?.appointmentId || '');
  await db.expireUnpaid();
  const apt = await db.getAppointmentById(id);
  if (!apt) return res.status(404).json({ error: 'Agendamento não encontrado.' });
  if (apt.paymentMethod === 'in_person') return res.status(400).json({ error: 'Este agendamento é para pagar no local.' });
  if (apt.paymentStatus === 'paid') return res.status(400).json({ error: 'Este agendamento já foi pago.' });
  if (apt.status !== 'pending') return res.status(400).json({ error: 'Reserva expirada ou cancelada. Faça um novo agendamento.' });
  if (apt.price <= 0) return res.status(400).json({ error: 'Valor inválido para pagamento online.' });

  const base = siteUrl(req);
  const expiresAt = new Date(apt.createdAt).getTime() + HOLD_MINUTES * 60000;
  const expirationDateTo = new Date(expiresAt - 3 * 3600 * 1000).toISOString().replace('Z', '-03:00');

  // Apenas Pix permitido no Mercado Pago (exclui cartões de crédito/débito, pré-pago, boleto e atm)
  const excluded = [
    { id: 'credit_card' },
    { id: 'debit_card' },
    { id: 'prepaid_card' },
    { id: 'ticket' },
    { id: 'atm' },
  ];

  const pref = await mp('/checkout/preferences', {
    method: 'POST',
    body: JSON.stringify({
      items: [{ id: apt.id, title: apt.itemName.slice(0, 120), description: 'BARBERSHOP L.A', quantity: 1, currency_id: 'BRL', unit_price: Number(apt.price.toFixed(2)) }],
      payer: { name: apt.clientName },
      external_reference: apt.id,
      back_urls: {
        success: `${base}/?pagamento=sucesso&apt=${apt.id}`,
        pending: `${base}/?pagamento=pendente&apt=${apt.id}`,
        failure: `${base}/?pagamento=falhou&apt=${apt.id}`,
      },
      auto_return: 'approved',
      notification_url: `${base}/api/payments/webhook`,
      expires: true,
      expiration_date_to: expirationDateTo,
      payment_methods: { excluded_payment_types: excluded, installments: 1 },
    }),
  });

  if (!pref.init_point) throw new Error('O Mercado Pago não devolveu o link de pagamento.');
  await db.updateAppointment(apt.id, { mpPreferenceId: String(pref.id) });
  return res.json({ initPoint: pref.init_point });
}));

// Aviso automático (webhook) do Mercado Pago
app.post('/api/payments/webhook', h(async (req, res) => {
  const type = String(req.query.type || req.query.topic || req.body?.type || req.body?.topic || '');
  const dataId = String(req.query['data.id'] || req.query.id || req.body?.data?.id || '');

  const secret = process.env.MP_WEBHOOK_SECRET;
  if (secret) {
    const xSignature = String(req.headers['x-signature'] || '');
    const xRequestId = String(req.headers['x-request-id'] || '');
    let ts = '', v1 = '';
    for (const part of xSignature.split(',')) {
      const [k, v] = part.trim().split('=');
      if (k === 'ts') ts = v; else if (k === 'v1') v1 = v;
    }
    const manifest = `${dataId ? `id:${dataId.toLowerCase()};` : ''}${xRequestId ? `request-id:${xRequestId};` : ''}ts:${ts};`;
    const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
    const ok = !!v1 && v1.length === expected.length && crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
    if (!ok) return res.status(401).json({ error: 'Assinatura inválida.' });
  }

  // Não confiamos no conteúdo do aviso: consultamos o pagamento direto no Mercado Pago
  if (type === 'payment' && dataId) {
    const payment = await mp(`/v1/payments/${encodeURIComponent(dataId)}`);
    await applyMpPayment(payment);
  }
  return res.sendStatus(200);
}));

// Situação do pagamento (a tela de retorno consulta aqui)
app.get('/api/payments/status/:id', h(async (req, res) => {
  await db.expireUnpaid();
  let apt = await db.getAppointmentById(req.params.id);
  if (!apt) return res.status(404).json({ error: 'Agendamento não encontrado.' });
  if (apt.paymentMethod !== 'in_person' && apt.paymentStatus === 'pending' && apt.status === 'pending' && process.env.MP_ACCESS_TOKEN) {
    try {
      await syncPaymentFromMp(apt);
      apt = (await db.getAppointmentById(apt.id)) ?? apt;
    } catch (err) {
      console.error('Falha ao sincronizar pagamento:', err);
    }
  }
  return res.json({ status: apt.status, paymentStatus: apt.paymentStatus, paymentMethod: apt.paymentMethod, itemName: apt.itemName, date: apt.date, time: apt.time });
}));

// ========== SETUP ÚNICO DO ADMIN (protegido por SETUP_KEY) ==========

const page = (body: string) =>
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Setup</title>` +
  `<body style="font-family:sans-serif;background:#0a0a0a;color:#eee;max-width:440px;margin:40px auto;padding:0 16px">${body}</body>`;

function base32(buf: Buffer): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const b of buf) bits += b.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) out += alphabet[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}

const safeEqual = (a: string, b: string) => {
  const A = Buffer.from(a), B = Buffer.from(b);
  return A.length === B.length && crypto.timingSafeEqual(A, B);
};

app.get('/api/setup', (req, res) => {
  if (!process.env.SETUP_KEY) return res.status(404).send(page('<h2>Setup desativado</h2>'));
  res.type('html').send(page(`
    <h2>Criar administrador</h2>
    <form method="post" action="/api/setup">
      <p>Chave de setup (SETUP_KEY)<br><input name="key" type="password" required style="width:100%;padding:8px"></p>
      <p>Nova senha master (mín. 10 caracteres)<br><input name="password" type="password" minlength="10" required style="width:100%;padding:8px"></p>
      <button style="padding:10px 16px">Criar admin e gerar QR do 2FA</button>
    </form>`));
});

app.post('/api/setup', h(async (req, res) => {
  const setupKey = process.env.SETUP_KEY;
  if (!setupKey) return res.status(404).send(page('<h2>Setup desativado</h2>'));
  const { key, password } = req.body || {};
  if (!key || !safeEqual(String(key), setupKey)) return res.status(403).send(page('<h2>Chave inválida</h2>'));
  if (!password || String(password).length < 10) return res.status(400).send(page('<h2>Senha muito curta (mín. 10).</h2>'));
  if (await db.hasAdmin()) return res.status(409).send(page('<h2>Admin já existe.</h2><p>Setup concluído. Remova SETUP_KEY da Vercel.</p>'));

  const secret = base32(crypto.randomBytes(20));
  const admin = await db.createUser({
    role: 'barber_admin',
    name: 'Leonardo Arruda',
    phone: '(11) 98115-4340',
    email: ADMIN_EMAIL,
    passwordHash: bcrypt.hashSync(String(password), 12),
    twoFactorSecret: secret,
  });
  await db.addAuditLog('ADMIN_SETUP', 'Administrador criado via /api/setup', admin.id, admin.name, req.ip);
  const otpauth = generateURI({ secret, issuer: 'BARBERSHOP L.A', label: admin.name });
  const qr = await QRCode.toDataURL(otpauth, { margin: 2, width: 260 });
  res.type('html').send(page(`
    <h2>Admin criado ✅</h2>
    <p>E-mail: <b>${esc(admin.email)}</b></p>
    <p>1) Escaneie o QR no Google Authenticator / Authy:</p>
    <img src="${qr}" alt="QR 2FA" style="background:#fff;padding:8px">
    <p>Ou digite a chave: <code>${esc(secret)}</code></p>
    <p><b>Esta tela não aparece de novo.</b> Depois apague SETUP_KEY na Vercel e faça redeploy.</p>`));
}));

// ========== 404 + ERROS SEMPRE EM JSON ==========

app.use('/api', (_req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Erro na API:', err);
  res.status(500).json({ error: err?.message || 'Erro interno no servidor.' });
});

export default app;

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
    // TODO: enviar o código por e-mail (Resend/SendGrid). Até lá só aparece com a flag de teste.
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
app.get('/api/packages', h(async (_req, res) => res.json(await db.getPackages())));
app.get('/api/notices/active', h(async (_req, res) => res.json(await db.getActiveNotice())));

// ========== SETUP ÚNICO DO ADMIN (protegido por SETUP_KEY) ==========

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
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

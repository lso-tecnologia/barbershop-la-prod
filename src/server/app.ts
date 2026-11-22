import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import QRCode from 'qrcode';
import { db, UserRow, GUEST_EMAIL_DOMAIN } from './db.js';
import { daySlots, coveredSlots } from './slots.js';
import { summarizeRevenue, monthRange } from './revenue.js';
import { newTotpSecret, verifyTotp, otpauthUri } from './totp.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // Vercel: pega o IP real do cliente (x-forwarded-for)
// JSON pequeno em tudo (anti-abuso). Só o envio de foto da galeria aceita até 1,5 MB.
const GALLERY_UPLOAD_PATH = '/api/admin/gallery';
const smallJson = express.json({ limit: '50kb' });
const galleryJson = express.json({ limit: '1500kb' });
app.use((req, res, next) => (req.method === 'POST' && req.path === GALLERY_UPLOAD_PATH ? galleryJson : smallJson)(req, res, next));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const isProd = process.env.NODE_ENV === 'production';
const JWT_SECRET = process.env.JWT_SECRET || (isProd ? '' : 'dev_only_secret_change_me');
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'leo.arruda226@gmail.com').toLowerCase();
const EMAIL_RE = /^[^\s@,()]+@[^\s@,()]+\.[^\s@,()]+$/;

// Headers de segurança
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
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

type SessionUser = { id: string; email: string; role: 'client' | 'barber_admin'; name: string; emailVerified: boolean };
export interface AuthRequest extends Request {
  user?: SessionUser;
}

const toSessionUser = (u: UserRow): SessionUser => ({ id: u.id, email: u.email, role: u.role, name: u.name, emailVerified: u.emailVerified });

// ========== SESSÃO ==========
// A sessão fica SÓ num cookie HttpOnly (o JavaScript da página não consegue ler -> um XSS não rouba a sessão).
// O token leva a "versão" do usuário: trocar senha/2FA aumenta a versão e todas as sessões antigas deixam de valer.
// Papel (cliente/admin) e dados vêm sempre do banco, nunca do token.

function setSessionCookie(res: Response, token: string, days: number) {
  res.cookie('auth_token', token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    path: '/',
    maxAge: days * 24 * 60 * 60 * 1000,
  });
}

function issueSession(res: Response, user: UserRow, days: number) {
  const token = jwt.sign({ id: user.id, tv: user.tokenVersion, purpose: 'session' }, JWT_SECRET, { expiresIn: `${days}d`, algorithm: 'HS256' });
  setSessionCookie(res, token, days);
}

async function loadSession(req: Request): Promise<UserRow | null> {
  const token = req.cookies?.auth_token;
  if (!token) return null;
  let decoded: any;
  try {
    decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return null;
  }
  if (decoded?.purpose !== 'session' || typeof decoded.id !== 'string') return null;
  const user = await db.findUserById(decoded.id);
  if (!user || user.tokenVersion !== Number(decoded.tv)) return null;
  return user;
}

function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  loadSession(req)
    .then((user) => {
      if (!user) return res.status(401).json({ error: 'Sessão expirada ou inválida. Faça login para continuar.' });
      req.user = toSessionUser(user);
      next();
    })
    .catch(next);
}

// Se houver sessão válida, identifica o usuário; senão segue como visitante
function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  loadSession(req)
    .then((user) => {
      if (user) req.user = toSessionUser(user);
      next();
    })
    .catch(() => next());
}

function requireBarberAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'barber_admin') {
    return res.status(403).json({ error: 'Acesso negado. Apenas o administrador da barbearia tem permissão.' });
  }
  next();
}

// Pagamento online (Pix) só funciona com ONLINE_PAYMENTS=true na Vercel. Desligado = só "pagar no local".
const ONLINE_PAYMENTS_ENABLED = process.env.ONLINE_PAYMENTS === 'true';

// Limite de pedidos por IP (anti-abuso). Ex.: limit('register', 10, 60 * 60_000)
// Se o banco falhar, BLOQUEIA (503) em vez de liberar sem limite.
const limit = (name: string, max: number, windowMs: number) => (req: Request, res: Response, next: NextFunction) => {
  db.hitRateLimit(`${name}:${req.ip || 'unknown'}`, max, windowMs)
    .then((ok) => (ok ? next() : res.status(429).json({ error: 'Muitas tentativas. Aguarde um pouco e tente novamente.' })))
    .catch((err) => {
      console.error('Falha no limite de requisições:', err);
      res.status(503).json({ error: 'Serviço temporariamente indisponível. Tente novamente em instantes.' });
    });
};

// Permite handlers async sem try/catch repetido
const h = (fn: (req: AuthRequest, res: Response) => Promise<any>) => (req: Request, res: Response, next: NextFunction) =>
  fn(req as AuthRequest, res).catch(next);

const publicUser = (u: { id: string; name: string; email: string; phone: string; role: string }) => ({
  id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role,
});

// ========== PROTEÇÃO CONTRA FORÇA BRUTA ==========
// Antes: um único contador por IP, zerado por QUALQUER login certo (o atacante zerava entrando na própria conta).
// Agora: contadores separados por IP, por conta e por 2FA. Um login certo só zera o contador DAQUELA conta.
const FAIL_WINDOW_SECONDS = 15 * 60;
const MAX_FAILS_PER_IP = 20;
const MAX_FAILS_PER_ACCOUNT = 10;
const MAX_FAILS_2FA = 5;
const ipFailKey = (req: Request) => `fail:ip:${req.ip || 'unknown'}`;
const acctFailKey = (email: string) => `fail:acct:${email}`;
const twoFaFailKey = (userId: string) => `fail:2fa:${userId}`;

async function isBlocked(req: Request, extra: [string, number][] = []): Promise<boolean> {
  const checks: [string, number][] = [[ipFailKey(req), MAX_FAILS_PER_IP], ...extra];
  const counts = await Promise.all(checks.map(([k]) => db.getCounter(k)));
  return counts.some((c, i) => c >= checks[i][1]);
}

async function recordFailure(req: Request, ...keys: string[]): Promise<void> {
  await Promise.all([ipFailKey(req), ...keys].map((k) => db.hitCounter(k, FAIL_WINDOW_SECONDS)));
}

const BLOCKED_MSG = 'Muitas tentativas falhas. Por segurança, aguarde 15 minutos e tente novamente.';

const validNewAdminPassword = (p: unknown) => typeof p === 'string' && p.length >= 10 && p.length <= 100;

// Confere o código do Google Authenticator de um admin JÁ logado (para ações sensíveis).
// Responde o erro e devolve false se o código for inválido.
async function checkAdminCode(req: AuthRequest, res: Response, code: unknown): Promise<UserRow | null> {
  const user = await db.findUserById(req.user!.id);
  if (!user?.twoFactorSecret) {
    res.status(400).json({ error: '2FA não configurado nesta conta.' });
    return null;
  }
  const key = twoFaFailKey(user.id);
  if (await isBlocked(req, [[key, MAX_FAILS_2FA]])) {
    res.status(429).json({ error: BLOCKED_MSG });
    return null;
  }
  const counter = verifyTotp(user.twoFactorSecret, String(code ?? ''), user.twoFactorLastCounter);
  if (counter === null || !(await db.consumeTotpCounter(user.id, counter))) {
    await recordFailure(req, key);
    res.status(401).json({ error: 'Código do autenticador inválido ou já usado. Espere o próximo código (30 s) e tente de novo.' });
    return null;
  }
  await db.clearCounter(key);
  return user;
}

async function qrFor(secret: string, account: string) {
  const otpauth = otpauthUri(secret, account);
  const qrCodeDataUrl = await QRCode.toDataURL(otpauth, { margin: 2, width: 260 });
  return { otpauth, qrCodeDataUrl, secret };
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

app.post('/api/auth/register', limit('register', 10, 60 * 60_000), h(async (req, res) => {
  const { name, email, phone, password } = req.body || {};
  if (!name || !email || !phone || !password) {
    return res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
  }
  if (String(password).length < 8 || String(password).length > 100) {
    return res.status(400).json({ error: 'A senha deve ter de 8 a 100 caracteres.' });
  }
  const cleanEmail = String(email).trim().toLowerCase();
  if (!EMAIL_RE.test(cleanEmail) || cleanEmail.length > 120 || cleanEmail.endsWith(`@${GUEST_EMAIL_DOMAIN}`)) {
    return res.status(400).json({ error: 'Informe um e-mail válido.' });
  }
  if (await db.findUserByEmail(cleanEmail)) {
    return res.status(400).json({ error: 'Este e-mail já está cadastrado.' });
  }
  const newUser = await db.createUser({
    role: 'client',
    name: String(name).trim().slice(0, 80),
    phone: String(phone).trim().slice(0, 20),
    email: cleanEmail,
    passwordHash: bcrypt.hashSync(String(password), 10),
  });
  issueSession(res, newUser, 30);
  await db.addAuditLog('CLIENT_REGISTER', `Cliente ${newUser.name} se cadastrou`, newUser.id, newUser.name, req.ip);
  return res.status(201).json({ message: 'Cadastro realizado com sucesso!', user: publicUser(newUser) });
}));

app.post('/api/auth/login', h(async (req, res) => {
  const { loginIdentifier, password } = req.body || {};
  if (!loginIdentifier || !password) {
    return res.status(400).json({ error: 'Informe seu e-mail e senha.' });
  }
  const email = String(loginIdentifier).trim().toLowerCase();
  if (await isBlocked(req, [[acctFailKey(email), MAX_FAILS_PER_ACCOUNT]])) {
    return res.status(429).json({ error: BLOCKED_MSG });
  }
  const user = await db.findUserByEmail(email);
  if (!user || !bcrypt.compareSync(String(password), user.passwordHash)) {
    await recordFailure(req, acctFailKey(email));
    return res.status(401).json({ error: 'Credenciais inválidas. Verifique seu e-mail e senha.' });
  }
  // O administrador só entra pelo fluxo com 2FA
  if (user.role === 'barber_admin') {
    return res.status(403).json({ error: 'Conta de administrador: use o "Acesso do Barbeiro".' });
  }
  await db.clearCounter(acctFailKey(email));
  issueSession(res, user, 30);
  return res.json({ message: 'Login realizado com sucesso!', user: publicUser(user) });
}));

// ========== LOGIN DO BARBEIRO (2 ETAPAS) ==========
// Etapa 1: e-mail + senha. Se o admin ainda não tem 2FA (admin novo), já devolve o QR Code para ativar.
// Etapa 2: código do Google Authenticator (e, na ativação, a senha definitiva).

app.post('/api/auth/barber/login-step1', h(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Informe o e-mail administrativo e senha.' });
  const cleanEmail = String(email).trim().toLowerCase();
  if (await isBlocked(req, [[acctFailKey(cleanEmail), MAX_FAILS_PER_ACCOUNT]])) {
    return res.status(429).json({ error: BLOCKED_MSG });
  }

  const user = await db.findUserByEmail(cleanEmail);
  if (!user || user.role !== 'barber_admin' || !bcrypt.compareSync(String(password), user.passwordHash)) {
    await recordFailure(req, acctFailKey(cleanEmail));
    return res.status(401).json({ error: 'Credenciais administrativas incorretas.' });
  }
  await db.clearCounter(acctFailKey(cleanEmail));

  if (!user.twoFactorSecret) {
    // Primeiro acesso de um admin cadastrado por outro admin: gera o 2FA dele (só vale depois de confirmado)
    const pending = newTotpSecret();
    await db.updateUser(user.id, { twoFactorPendingSecret: pending });
    const tempToken = jwt.sign({ id: user.id, tv: user.tokenVersion, purpose: 'enroll' }, JWT_SECRET, { expiresIn: '10m', algorithm: 'HS256' });
    return res.json({
      message: 'Primeiro acesso: escaneie o QR Code no Google Authenticator e defina sua senha definitiva.',
      tempToken,
      requires2FASetup: true,
      ...(await qrFor(pending, user.email)),
    });
  }

  const tempToken = jwt.sign({ id: user.id, tv: user.tokenVersion, purpose: '2fa' }, JWT_SECRET, { expiresIn: '5m', algorithm: 'HS256' });
  return res.json({ message: 'Credenciais válidas. Prossiga para a validação do 2FA.', tempToken, requires2FA: true });
}));

app.post('/api/auth/barber/login-step2', h(async (req, res) => {
  const { tempToken, code, newPassword } = req.body || {};
  if (!tempToken || !code) return res.status(400).json({ error: 'Token temporário e código 2FA são obrigatórios.' });

  let decoded: any;
  try {
    decoded = jwt.verify(tempToken, JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return res.status(401).json({ error: 'Sessão 2FA expirada. Faça login novamente.' });
  }
  if (decoded?.purpose !== '2fa' && decoded?.purpose !== 'enroll') return res.status(400).json({ error: 'Fluxo 2FA inválido.' });

  const user = await db.findUserById(decoded.id);
  if (!user || user.role !== 'barber_admin' || user.tokenVersion !== Number(decoded.tv)) {
    return res.status(401).json({ error: 'Sessão 2FA inválida. Faça login novamente.' });
  }
  const key = twoFaFailKey(user.id);
  if (await isBlocked(req, [[key, MAX_FAILS_2FA]])) return res.status(429).json({ error: BLOCKED_MSG });

  // ---- Ativação do 2FA (primeiro acesso) ----
  if (decoded.purpose === 'enroll') {
    if (!user.twoFactorPendingSecret) return res.status(400).json({ error: 'Ativação expirada. Faça login novamente.' });
    if (!validNewAdminPassword(newPassword)) return res.status(400).json({ error: 'Defina uma senha definitiva de 10 a 100 caracteres.' });
    if (bcrypt.compareSync(String(newPassword), user.passwordHash)) return res.status(400).json({ error: 'A senha definitiva precisa ser diferente da senha provisória.' });
    const counter = verifyTotp(user.twoFactorPendingSecret, String(code));
    if (counter === null) {
      await recordFailure(req, key);
      return res.status(401).json({ error: 'Código inválido. Confira se escaneou o QR Code certo e se o relógio do celular está automático.' });
    }
    const updated = await db.updateUser(user.id, {
      twoFactorSecret: user.twoFactorPendingSecret,
      twoFactorPendingSecret: null,
      twoFactorLastCounter: counter,
      passwordHash: bcrypt.hashSync(String(newPassword), 12),
      bumpTokenVersion: true,
    });
    await db.clearCounter(key);
    issueSession(res, updated!, 3);
    await db.addAuditLog('ADMIN_2FA_ENROLLED', `${user.name} ativou o 2FA no primeiro acesso`, user.id, user.name, req.ip);
    return res.json({ message: '2FA ativado e senha definida! Bem-vindo ao painel.', user: publicUser(updated!) });
  }

  // ---- Login normal ----
  if (!user.twoFactorSecret) return res.status(400).json({ error: '2FA não configurado. Faça login novamente.' });
  const counter = verifyTotp(user.twoFactorSecret, String(code), user.twoFactorLastCounter);
  if (counter === null || !(await db.consumeTotpCounter(user.id, counter))) {
    await recordFailure(req, key);
    return res.status(401).json({ error: 'Código 2FA inválido, expirado ou já usado. Espere o próximo código e tente novamente.' });
  }
  await db.clearCounter(key);
  issueSession(res, user, 3);
  await db.addAuditLog('ADMIN_LOGIN_2FA', `${user.name} realizou login com 2FA`, user.id, user.name, req.ip);
  return res.json({ message: 'Autenticação 2FA concluída com sucesso!', user: publicUser(user) });
}));

// ========== GESTÃO DE ADMINISTRADORES (vários barbeiros, cada um com o próprio 2FA) ==========
// Toda ação sensível pede o código ATUAL do Google Authenticator de quem está logado.

const adminView = (u: UserRow, meId: string) => ({
  id: u.id, name: u.name, email: u.email, phone: u.phone,
  has2FA: !!u.twoFactorSecret, isMe: u.id === meId, createdAt: u.createdAt,
});

app.get('/api/admin/admins', authenticateToken, requireBarberAdmin, h(async (req, res) => {
  const admins = await db.listAdmins();
  return res.json({ admins: admins.map((a) => adminView(a, req.user!.id)) });
}));

// Cadastra outro admin com senha PROVISÓRIA. No primeiro login ele escaneia o próprio QR Code e troca a senha.
app.post('/api/admin/admins', authenticateToken, requireBarberAdmin, h(async (req, res) => {
  const { name, email, phone = '', tempPassword, code } = req.body || {};
  const cleanName = String(name ?? '').trim().slice(0, 80);
  const cleanEmail = String(email ?? '').trim().toLowerCase();
  if (!cleanName) return res.status(400).json({ error: 'Informe o nome do novo administrador.' });
  if (!EMAIL_RE.test(cleanEmail) || cleanEmail.length > 120 || cleanEmail.endsWith(`@${GUEST_EMAIL_DOMAIN}`)) return res.status(400).json({ error: 'Informe um e-mail válido.' });
  if (!validNewAdminPassword(tempPassword)) return res.status(400).json({ error: 'A senha provisória deve ter de 10 a 100 caracteres.' });
  if (await db.findUserByEmail(cleanEmail)) return res.status(400).json({ error: 'Já existe uma conta com este e-mail.' });
  if (!(await checkAdminCode(req, res, code))) return;

  const created = await db.createUser({
    role: 'barber_admin',
    name: cleanName,
    phone: String(phone).trim().slice(0, 20),
    email: cleanEmail,
    passwordHash: bcrypt.hashSync(String(tempPassword), 12),
  });
  await db.addAuditLog('ADMIN_CREATED', `${req.user!.name} cadastrou o admin ${created.name} (${created.email})`, req.user!.id, req.user!.name, req.ip);
  const admins = await db.listAdmins();
  return res.status(201).json({ admins: admins.map((a) => adminView(a, req.user!.id)) });
}));

app.delete('/api/admin/admins/:id', authenticateToken, requireBarberAdmin, h(async (req, res) => {
  const targetId = String(req.params.id);
  if (targetId === req.user!.id) return res.status(400).json({ error: 'Você não pode remover a própria conta.' });
  const target = await db.findUserById(targetId);
  if (!target || target.role !== 'barber_admin') return res.status(404).json({ error: 'Administrador não encontrado.' });
  if (!(await checkAdminCode(req, res, req.body?.code))) return;
  await db.deleteUser(target.id); // as sessões dele morrem junto (o usuário não existe mais)
  await db.addAuditLog('ADMIN_REMOVED', `${req.user!.name} removeu o admin ${target.name} (${target.email})`, req.user!.id, req.user!.name, req.ip);
  const admins = await db.listAdmins();
  return res.json({ admins: admins.map((a) => adminView(a, req.user!.id)) });
}));

// Trocar o 2FA de celular — etapa 1: confirma o código do celular ATUAL e gera um QR novo
app.post('/api/admin/2fa/start', authenticateToken, requireBarberAdmin, h(async (req, res) => {
  const user = await checkAdminCode(req, res, req.body?.code);
  if (!user) return;
  const pending = newTotpSecret();
  await db.updateUser(user.id, { twoFactorPendingSecret: pending });
  return res.json(await qrFor(pending, user.email));
}));

// Etapa 2: confirma com um código do celular NOVO. Só então o celular antigo para de funcionar.
app.post('/api/admin/2fa/confirm', authenticateToken, requireBarberAdmin, h(async (req, res) => {
  const user = await db.findUserById(req.user!.id);
  if (!user?.twoFactorPendingSecret) return res.status(400).json({ error: 'Nenhuma troca de 2FA em andamento. Comece de novo.' });
  const key = twoFaFailKey(user.id);
  if (await isBlocked(req, [[key, MAX_FAILS_2FA]])) return res.status(429).json({ error: BLOCKED_MSG });
  const counter = verifyTotp(user.twoFactorPendingSecret, String(req.body?.code ?? ''));
  if (counter === null) {
    await recordFailure(req, key);
    return res.status(401).json({ error: 'Código do celular novo inválido. Confira se escaneou o QR Code novo.' });
  }
  const updated = await db.updateUser(user.id, {
    twoFactorSecret: user.twoFactorPendingSecret,
    twoFactorPendingSecret: null,
    twoFactorLastCounter: counter,
    bumpTokenVersion: true, // derruba sessões em outros aparelhos
  });
  await db.clearCounter(key);
  issueSession(res, updated!, 3); // mantém ESTE aparelho logado
  await db.addAuditLog('ADMIN_2FA_ROTATED', `${user.name} moveu o 2FA para outro celular`, user.id, user.name, req.ip);
  return res.json({ message: '2FA transferido! A partir de agora vale só o código do celular novo.' });
}));

// Trocar a própria senha (pede senha atual + código do autenticador)
app.post('/api/admin/password', authenticateToken, requireBarberAdmin, h(async (req, res) => {
  const { currentPassword, newPassword, code } = req.body || {};
  const me = await db.findUserById(req.user!.id);
  if (!me) return res.status(401).json({ error: 'Sessão inválida.' });
  if (!validNewAdminPassword(newPassword)) return res.status(400).json({ error: 'A nova senha deve ter de 10 a 100 caracteres.' });
  if (await isBlocked(req, [[acctFailKey(me.email), MAX_FAILS_PER_ACCOUNT]])) return res.status(429).json({ error: BLOCKED_MSG });
  if (!bcrypt.compareSync(String(currentPassword ?? ''), me.passwordHash)) {
    await recordFailure(req, acctFailKey(me.email));
    return res.status(401).json({ error: 'Senha atual incorreta.' });
  }
  if (!(await checkAdminCode(req, res, code))) return;
  const updated = await db.updateUser(me.id, { passwordHash: bcrypt.hashSync(String(newPassword), 12), bumpTokenVersion: true });
  issueSession(res, updated!, 3);
  await db.addAuditLog('ADMIN_PASSWORD_CHANGED', `${me.name} trocou a senha`, me.id, me.name, req.ip);
  return res.json({ message: 'Senha alterada. Sessões em outros aparelhos foram encerradas.' });
}));

// ========== RECUPERAÇÃO DE SENHA (somente clientes) ==========

app.post('/api/auth/forgot-password', limit('forgot', 5, 60 * 60_000), h(async (req, res) => {
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
    if (process.env.ALLOW_PREVIEW_RESET_TOKEN === 'true' && !isProd) response.previewToken = resetToken;
  }
  return res.json(response);
}));

app.post('/api/auth/reset-password', limit('reset', 10, 15 * 60_000), h(async (req, res) => {
  const { token, newPassword } = req.body || {};
  if (!token || !newPassword) return res.status(400).json({ error: 'Token e nova senha são obrigatórios.' });
  if (String(newPassword).length < 8 || String(newPassword).length > 100) return res.status(400).json({ error: 'A nova senha deve ter de 8 a 100 caracteres.' });
  const ok = await db.verifyAndConsumeResetToken(String(token).trim().toUpperCase(), bcrypt.hashSync(String(newPassword), 10));
  if (!ok) return res.status(400).json({ error: 'Código de redefinição inválido ou expirado.' });
  return res.json({ message: 'Senha redefinida com sucesso! Agora você já pode entrar.' });
}));

app.get('/api/auth/me', authenticateToken, h(async (req, res) => {
  const user = await db.findUserById(req.user!.id);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });
  return res.json({ user: publicUser(user) });
}));

app.post('/api/auth/logout', h(async (req, res) => {
  // Admin: "Sair" encerra a sessão em TODOS os aparelhos (um cookie copiado também deixa de valer)
  const user = await loadSession(req).catch(() => null);
  if (user?.role === 'barber_admin') await db.updateUser(user.id, { bumpTokenVersion: true });
  res.clearCookie('auth_token', { httpOnly: true, secure: isProd, sameSite: 'strict', path: '/' });
  return res.json({ message: 'Sessão encerrada com sucesso.' });
}));

// ========== DADOS PÚBLICOS ==========

app.get('/api/settings', h(async (_req, res) => res.json(await db.getSettings())));

app.post('/api/settings/toggle-open', authenticateToken, requireBarberAdmin, h(async (req, res) => {
  const isOpen = await db.toggleOpenStatus();
  await db.addAuditLog('TOGGLE_SHOP_STATUS', `Barbearia ${isOpen ? 'ABERTA' : 'FECHADA'}`, req.user?.id, req.user?.name, req.ip);
  return res.json({ isOpen, message: `Barbearia agora está ${isOpen ? 'ABERTA' : 'FECHADA'}` });
}));

const isValidDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));

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

// ----- Aviso (pop-up) editável pelo barbeiro -----
app.get('/api/notices/active', h(async (_req, res) => res.json(await db.getActiveNotice())));

app.get('/api/admin/notice', authenticateToken, requireBarberAdmin, h(async (_req, res) => {
  return res.json({ notice: await db.getNoticeForAdmin() });
}));

app.put('/api/admin/notice', authenticateToken, requireBarberAdmin, h(async (req, res) => {
  const b = req.body || {};
  const title = String(b.title ?? '').trim();
  const message = String(b.message ?? '').trim();
  const isActive = b.isActive !== false;
  const rawUntil = String(b.validUntil ?? '').trim();
  if (!title || title.length > 80) return res.status(400).json({ error: 'Informe o título (até 80 caracteres).' });
  if (!message || message.length > 600) return res.status(400).json({ error: 'Informe a mensagem (até 600 caracteres).' });
  if (rawUntil && !(isValidDate(rawUntil))) return res.status(400).json({ error: 'Data de validade inválida.' });
  const notice = await db.saveNotice({ title, message, validUntil: rawUntil || null, isActive });
  await db.addAuditLog('NOTICE_UPDATED', `Aviso ${isActive ? 'ativo' : 'desativado'}: ${title}`, req.user!.id, req.user!.name, req.ip);
  return res.json({ notice });
}));

// ========== GALERIA DE ESTILOS ==========
// Limite de fotos: para colocar uma nova, o barbeiro precisa apagar uma antes.
const GALLERY_MAX = 6;
const GALLERY_MAX_BYTES = 900 * 1024; // a foto chega já comprimida pelo navegador (~200 KB)
const GALLERY_MIMES: Record<string, (b: Buffer) => boolean> = {
  // Confere os "bytes mágicos" do arquivo: não basta dizer que é imagem, tem que SER imagem
  'image/jpeg': (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) => b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/webp': (b) => b.length > 12 && b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP',
};

const galleryView = (r: { id: string; title: string; subtitle: string; category: string; imageUrl: string | null; createdAt: string }) => ({
  id: r.id, title: r.title, subtitle: r.subtitle, category: r.category,
  imageUrl: r.imageUrl ?? `/api/gallery/photo/${encodeURIComponent(r.id)}?v=${encodeURIComponent(String(Date.parse(r.createdAt) || 0))}`,
});

app.get('/api/gallery', h(async (_req, res) => {
  const list = await db.listGallery();
  return res.json({ photos: list.map(galleryView), max: GALLERY_MAX });
}));

app.get('/api/gallery/photo/:id', h(async (req, res) => {
  const img = await db.getGalleryImage(String(req.params.id));
  if (!img || !GALLERY_MIMES[img.mime]) return res.status(404).json({ error: 'Foto não encontrada.' });
  const buf = Buffer.from(img.data, 'base64');
  res.setHeader('Content-Type', img.mime);
  // A URL muda (?v=) se a foto mudar, então pode ficar em cache por muito tempo
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; sandbox");
  return res.send(buf);
}));

app.post(GALLERY_UPLOAD_PATH, authenticateToken, requireBarberAdmin, h(async (req, res) => {
  const b = req.body || {};
  const title = String(b.title ?? '').trim().slice(0, 60);
  const subtitle = String(b.subtitle ?? '').trim().slice(0, 120);
  const category = String(b.category ?? '').trim().slice(0, 30);
  const mime = String(b.mime ?? '');
  if (!title) return res.status(400).json({ error: 'Dê um título para a foto.' });
  const check = GALLERY_MIMES[mime];
  if (!check || typeof b.imageBase64 !== 'string') return res.status(400).json({ error: 'Envie uma foto JPG, PNG ou WEBP.' });
  const buf = Buffer.from(b.imageBase64, 'base64');
  if (!buf.length || buf.length > GALLERY_MAX_BYTES) return res.status(400).json({ error: 'Foto muito grande. Tente outra foto.' });
  if (!check(buf)) return res.status(400).json({ error: 'O arquivo enviado não é uma imagem válida.' });

  const current = await db.listGallery();
  if (current.length >= GALLERY_MAX) {
    return res.status(409).json({ error: `A galeria já tem ${GALLERY_MAX} fotos (o máximo). Apague uma para colocar outra.` });
  }
  await db.addGalleryPhoto({ title, subtitle, category, mime, base64: buf.toString('base64') });
  await db.addAuditLog('GALLERY_PHOTO_ADDED', `Foto adicionada à galeria: ${title}`, req.user!.id, req.user!.name, req.ip);
  const list = await db.listGallery();
  return res.status(201).json({ photos: list.map(galleryView), max: GALLERY_MAX });
}));

app.delete('/api/admin/gallery/:id', authenticateToken, requireBarberAdmin, h(async (req, res) => {
  const ok = await db.deleteGalleryPhoto(String(req.params.id));
  if (!ok) return res.status(404).json({ error: 'Foto não encontrada.' });
  await db.addAuditLog('GALLERY_PHOTO_DELETED', `Foto removida da galeria: ${req.params.id}`, req.user!.id, req.user!.name, req.ip);
  const list = await db.listGallery();
  return res.json({ photos: list.map(galleryView), max: GALLERY_MAX });
}));

// ========== AGENDAMENTOS ==========

// Brasil (Brasília) = UTC-3 fixo, sem horário de verão desde 2019
const slotMoment = (date: string, time: string) => new Date(`${date}T${time}:00-03:00`);
const todayBR = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);

const validSlotsFor = daySlots; // horários de início (30 em 30 min) — ver src/server/slots.ts

// Horários já ocupados de um dia (sem dados pessoais)
app.get('/api/appointments/taken', h(async (req, res) => {
  const date = req.query.date;
  if (!isValidDate(date)) return res.status(400).json({ error: 'Data inválida.' });
  await db.expireUnpaid();
  return res.json({ date, taken: await db.getTakenTimes(date) });
}));

app.post('/api/appointments', limit('appointments', 20, 60 * 60_000), optionalAuth, h(async (req, res) => {
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

  const paymentMethod: 'pix' | 'in_person' = b.paymentMethod === 'pix' ? 'pix' : 'in_person';
  const online = paymentMethod !== 'in_person';
  const itemType: 'service' | 'package' = b.itemType === 'package' ? 'package' : 'service';

  // Preço oficial do banco. Pagamento online EXIGE preço válido do catálogo.
  const catalogItem = await db.findCatalogItem(itemName, itemType);
  if (!catalogItem) {
    return res.status(400).json({ error: 'Serviço não encontrado no catálogo. Atualize a página e escolha novamente.' });
  }
  const catalogPrice = catalogItem.price;
  const durationMinutes = catalogItem.durationMinutes;

  // O atendimento ocupa 1 ou mais fatias de 30 min: todas precisam estar dentro do expediente e livres
  const needed = coveredSlots(time, durationMinutes);
  if (!needed.every((t) => slots.includes(t))) {
    return res.status(400).json({ error: `Este atendimento dura ${durationMinutes} min e não cabe antes do fechamento nesse horário. Escolha um horário mais cedo.` });
  }
  const occupied = new Set((await db.getTakenTimes(date)));
  if (needed.some((t) => occupied.has(t))) {
    return res.status(409).json({ error: `Esse horário não está mais disponível (este atendimento ocupa ${durationMinutes} min). Escolha outro.` });
  }
  if (online && (!ONLINE_PAYMENTS_ENABLED || !process.env.MP_ACCESS_TOKEN)) {
    return res.status(503).json({ error: 'Pagamento online indisponível no momento. Escolha pagar no local.' });
  }
  if (online && catalogPrice <= 0) {
    return res.status(400).json({ error: 'Este item não pode ser pago online (valor à combinar). Escolha pagar no local.' });
  }
  const price = catalogPrice; // sempre o preço do banco, nunca o enviado pelo navegador
  const guestEmail = String(b.clientEmail || '').trim().toLowerCase().slice(0, 120);
  const email = req.user
    ? req.user.email
    : EMAIL_RE.test(guestEmail)
      ? guestEmail
      : `${clientPhone.replace(/\D/g, '')}@${GUEST_EMAIL_DOMAIN}`;

  try {
    const apt = await db.createAppointment({
      userId: req.user?.id ?? null,
      clientName, clientPhone, clientEmail: email, itemName,
      itemType,
      price, date, time, durationMinutes,
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
  const list = await db.getAppointmentsForUser(req.user!.id, req.user!.email, req.user!.emailVerified);
  return res.json({ appointments: list });
}));

app.patch('/api/appointments/:id/cancel', authenticateToken, h(async (req, res) => {
  const apt = await db.getAppointmentById(req.params.id);
  if (!apt) return res.status(404).json({ error: 'Agendamento não encontrado.' });

  const isAdmin = req.user!.role === 'barber_admin';
  // Dono = quem agendou logado, OU conta com e-mail COMPROVADO igual ao do agendamento.
  // (Antes bastava criar uma conta com o e-mail da vítima, sem confirmar, para ver e cancelar os horários dela.)
  const sameEmail = apt.clientEmail.toLowerCase() === req.user!.email.toLowerCase() && !apt.clientEmail.toLowerCase().endsWith(`@${GUEST_EMAIL_DOMAIN}`);
  const isOwner = apt.userId === req.user!.id || (req.user!.emailVerified && sameEmail);
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
  await cancelPendingPix(apt); // evita que alguém pague um Pix de horário já cancelado
  await db.addAuditLog('APPOINTMENT_CANCELLED', `Agendamento ${apt.id} cancelado`, req.user!.id, req.user!.name, req.ip);
  return res.json({ appointment: updated });
}));

// ----- Agenda do barbeiro -----
app.get('/api/admin/appointments', authenticateToken, requireBarberAdmin, h(async (req, res) => {
  const from = isValidDate(req.query.from) ? req.query.from : todayBR();
  const to = isValidDate(req.query.to) ? req.query.to : new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  return res.json({ appointments: await db.listAppointments(from, to) });
}));

// ----- Faturamento (dia / mês) -----
app.get('/api/admin/revenue', authenticateToken, requireBarberAdmin, h(async (req, res) => {
  const today = todayBR();
  const month = typeof req.query.month === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(req.query.month) ? req.query.month : today.slice(0, 7);
  const { from, to } = monthRange(month);
  const rows = await db.listAppointments(from, to);
  const summary = summarizeRevenue(rows, today);
  // "Hoje" é sempre o dia de hoje, mesmo olhando outro mês
  if (month !== today.slice(0, 7)) {
    summary.today = summarizeRevenue(await db.listAppointments(today, today), today).today;
  }
  return res.json({ monthKey: month, ...summary });
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

// ========== PAGAMENTOS ONLINE (MERCADO PAGO — Pix dentro do app, API /v1/payments) ==========

const MP_API = 'https://api.mercadopago.com';
const HOLD_MINUTES = 15;

function siteUrl(req: Request): string {
  const env = (process.env.SITE_URL || '').trim().replace(/\/+$/, '');
  if (env) return env;
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol).split(',')[0];
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0];
  return `${proto}://${host}`;
}

async function mp(path: string, init: { method?: string; body?: string; headers?: Record<string, string> } = {}): Promise<any> {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new Error('Pagamento online não configurado (MP_ACCESS_TOKEN ausente).');
  const r = await fetch(`${MP_API}${path}`, {
    method: init.method || 'GET',
    body: init.body,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  const text = await r.text();
  let json: any = {};
  try { json = text ? JSON.parse(text) : {}; } catch { /* resposta não-JSON */ }
  if (!r.ok) {
    console.error('Mercado Pago erro', r.status, text);
    throw Object.assign(new Error(`Mercado Pago recusou a requisição (${r.status}). ${json.message || ''}`.trim()), { mpStatus: r.status });
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

// Cancela no Mercado Pago um Pix que ainda não foi pago (melhor esforço; erros só vão para o log)
async function cancelPendingPix(apt: { id: string; paymentMethod: string; paymentStatus: string; mpPaymentId?: string | null }): Promise<void> {
  if (apt.paymentMethod !== 'pix' || apt.paymentStatus === 'paid' || !apt.mpPaymentId || !process.env.MP_ACCESS_TOKEN) return;
  try {
    await mp(`/v1/payments/${encodeURIComponent(apt.mpPaymentId)}`, { method: 'PUT', body: JSON.stringify({ status: 'cancelled' }) });
  } catch (err) {
    console.error('Não foi possível cancelar o Pix pendente de', apt.id, err);
  }
}

// Gera (ou reaproveita) o Pix de um agendamento pendente e devolve o QR Code + código "copia e cola".
// O cliente paga SEM sair do app; a confirmação chega pelo webhook (e pela consulta de status).
app.post('/api/payments/pix', limit('pix', 30, 60 * 60_000), h(async (req, res) => {
  if (!ONLINE_PAYMENTS_ENABLED) return res.status(503).json({ error: 'Pagamento online indisponível no momento. Pague no local.' });
  const id = String(req.body?.appointmentId || '');
  await db.expireUnpaid();
  const apt = await db.getAppointmentById(id);
  if (!apt) return res.status(404).json({ error: 'Agendamento não encontrado.' });
  if (apt.paymentMethod !== 'pix') return res.status(400).json({ error: 'Pagamento online disponível somente via Pix.' });
  if (apt.paymentStatus === 'paid') return res.status(400).json({ error: 'Este agendamento já foi pago.' });
  if (apt.status !== 'pending') return res.status(400).json({ error: 'Reserva expirada ou cancelada. Faça um novo agendamento.' });
  if (apt.price <= 0) return res.status(400).json({ error: 'Valor inválido para pagamento online.' });

  const secondsLeft = Math.floor((new Date(apt.createdAt).getTime() + HOLD_MINUTES * 60000 - Date.now()) / 1000);
  if (secondsLeft <= 0) return res.status(400).json({ error: 'Reserva expirada. Faça um novo agendamento.' });

  // Se já existe um Pix válido para este agendamento, mostra o mesmo (não cria cobrança duplicada)
  let payment: any = null;
  if (apt.mpPaymentId) {
    try {
      const old = await mp(`/v1/payments/${encodeURIComponent(apt.mpPaymentId)}`);
      if (old.status === 'approved') {
        await applyMpPayment(old);
        return res.status(400).json({ error: 'Este agendamento já foi pago.' });
      }
      const expires = old.date_of_expiration ? new Date(old.date_of_expiration).getTime() : 0;
      if (old.status === 'pending' && old.point_of_interaction?.transaction_data?.qr_code && expires > Date.now() + 60000) payment = old;
    } catch (err) {
      console.error('Falha ao reaproveitar Pix anterior:', err);
    }
  }

  if (!payment) {
    const base = siteUrl(req);
    // O Mercado Pago exige validade mínima de 30 min para Pix. A reserva do horário continua valendo só 15 min.
    const expiration = new Date(Date.now() + 30 * 60000 - 3 * 3600 * 1000).toISOString().replace('Z', '-03:00');
    const [firstName, ...rest] = apt.clientName.trim().split(/\s+/);
    try {
    payment = await mp('/v1/payments', {
      method: 'POST',
      headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify({
        transaction_amount: Number(apt.price.toFixed(2)),
        description: `${apt.itemName} — BARBERSHOP L.A`.slice(0, 200),
        payment_method_id: 'pix',
        external_reference: apt.id,
        date_of_expiration: expiration,
        ...(base.startsWith('https://') ? { notification_url: `${base}/api/payments/webhook` } : {}),
        payer: { email: apt.clientEmail, first_name: firstName || 'Cliente', ...(rest.length ? { last_name: rest.join(' ') } : {}) },
      }),
    });
    } catch (err: any) {
      // O cliente vê uma mensagem simples; o motivo técnico fica no log da Vercel e no registro de auditoria
      console.error('Falha ao criar Pix no Mercado Pago:', err);
      await db.addAuditLog('PIX_CREATE_FAILED', String(err?.message || err).slice(0, 300), apt.userId ?? undefined, apt.clientName);
      const credentials = err?.mpStatus === 401 || err?.mpStatus === 403;
      return res.status(503).json({
        error: credentials
          ? 'O pagamento por Pix está indisponível no momento. Escolha pagar no local ou fale com o barbeiro pelo WhatsApp.'
          : 'Não foi possível gerar o Pix agora. Tente novamente em instantes ou escolha pagar no local.',
      });
    }
    await db.updateAppointment(apt.id, { mpPaymentId: String(payment.id) });
  }

  const td = payment.point_of_interaction?.transaction_data;
  if (!td?.qr_code) throw new Error('O Mercado Pago não devolveu o código Pix.');
  const qrCodeImage = td.qr_code_base64
    ? `data:image/png;base64,${td.qr_code_base64}`
    : await QRCode.toDataURL(String(td.qr_code), { margin: 1, width: 320 });

  return res.json({
    appointmentId: apt.id,
    paymentId: String(payment.id),
    amount: apt.price,
    qrCode: String(td.qr_code),   // "Pix copia e cola"
    qrCodeImage,                  // imagem do QR Code (data URL)
    secondsLeft,                  // tempo restante da reserva do horário
  });
}));

// Aviso automático (webhook) do Mercado Pago
app.post('/api/payments/webhook', h(async (req, res) => {
  const type = String(req.query.type || req.query.topic || req.body?.type || req.body?.topic || '');
  const dataId = String(req.query['data.id'] || req.query.id || req.body?.data?.id || '');

  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret && ONLINE_PAYMENTS_ENABLED && isProd) {
    console.error('MP_WEBHOOK_SECRET ausente: webhook recusado. Configure a chave secreta do Mercado Pago na Vercel.');
    return res.status(503).json({ error: 'Webhook não configurado.' });
  }
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

app.post('/api/setup', limit('setup', 10, 60 * 60_000), h(async (req, res) => {
  const setupKey = process.env.SETUP_KEY;
  if (!setupKey) return res.status(404).send(page('<h2>Setup desativado</h2>'));
  const { key, password } = req.body || {};
  if (!key || !safeEqual(String(key), setupKey)) return res.status(403).send(page('<h2>Chave inválida</h2>'));
  if (!password || String(password).length < 10) return res.status(400).send(page('<h2>Senha muito curta (mín. 10).</h2>'));
  if (await db.hasAdmin()) return res.status(409).send(page('<h2>Admin já existe.</h2><p>Setup concluído. Remova SETUP_KEY da Vercel.</p>'));

  const secret = newTotpSecret();
  const admin = await db.createUser({
    role: 'barber_admin',
    name: 'Leonardo Arruda',
    phone: '(11) 98115-4340',
    email: ADMIN_EMAIL,
    passwordHash: bcrypt.hashSync(String(password), 12),
    twoFactorSecret: secret,
  });
  await db.addAuditLog('ADMIN_SETUP', 'Administrador criado via /api/setup', admin.id, admin.name, req.ip);
  const { qrCodeDataUrl: qr } = await qrFor(secret, admin.email);
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
  if (err?.type === 'entity.parse.failed' || err?.status === 400) return res.status(400).json({ error: 'Requisição inválida.' });
  if (err?.type === 'entity.too.large' || err?.status === 413) return res.status(413).json({ error: 'Requisição muito grande.' });
  const msg = String(err?.message || '');
  // Detalhes do banco e da configuração só vão para o log da Vercel, nunca para o navegador
  const hide = !msg || /^Erro no banco|^Configuração ausente|supabase|postgres/i.test(msg);
  res.status(500).json({ error: hide ? 'Erro interno no servidor. Tente novamente em instantes.' : msg });
});

export default app;

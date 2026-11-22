import { UserAccount, ServiceItem, PromoPackage, NoticeData, AppointmentRecord, PixPayment, RevenueSummary } from '../types/barbershop';

const API_BASE = '/api';

// Lê a resposta com segurança: se o servidor devolver HTML (404/erro da Vercel),
// mostra uma mensagem clara em vez de "Unexpected token ... is not valid JSON".
async function parseJson(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      `Servidor indisponível (HTTP ${res.status}). Verifique se o backend /api está publicado e configurado na Vercel.`
    );
  }
}

// A sessão agora fica SÓ no cookie HttpOnly (o navegador envia sozinho; o JavaScript não consegue ler).
// Limpa o token antigo que versões anteriores guardavam no localStorage.
try { localStorage.removeItem('barbershop_auth_token'); } catch { /* ignora */ }
function getAuthHeader(): Record<string, string> {
  return {};
}

async function postJson(path: string, body: unknown, method = 'POST') {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  const json = await parseJson(res);
  if (!res.ok) throw new Error(json.error || 'Erro na requisição.');
  return json;
}

export interface AdminAccount {
  id: string;
  name: string;
  email: string;
  phone: string;
  has2FA: boolean;
  isMe: boolean;
  createdAt: string;
}

export interface TwoFactorQr {
  qrCodeDataUrl: string;
  secret: string;
  otpauth: string;
}

export const api = {
  // --- AUTENTICAÇÃO DO CLIENTE ---
  async register(data: { name: string; email: string; phone: string; password: string }) {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await parseJson(res);
    if (!res.ok) throw new Error(json.error || 'Erro no cadastro.');
    return json;
  },

  async login(data: { loginIdentifier: string; password: string }) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await parseJson(res);
    if (!res.ok) throw new Error(json.error || 'Erro no login.');
    return json;
  },

  async getMe(): Promise<UserAccount | null> {
    // null = servidor disse que não há sessão. Erro de rede = lança (o App mantém o modo offline).
    const res = await fetch(`${API_BASE}/auth/me`, { cache: 'no-store' });
    if (res.status === 401 || res.status === 403 || res.status === 404) return null;
    if (!res.ok) throw new Error('Servidor indisponível.');
    const json = await parseJson(res);
    return json.user ?? null;
  },

  async logout() {
    try {
      await fetch(`${API_BASE}/auth/logout`, { method: 'POST', headers: { ...getAuthHeader() } });
    } catch {}
    localStorage.removeItem('barbershop_auth_token');
    localStorage.removeItem('barbershop_logged_client');
  },

  async forgotPassword(email: string) {
    const res = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const json = await parseJson(res);
    if (!res.ok) throw new Error(json.error || 'Erro ao solicitar recuperação.');
    return json;
  },

  async resetPassword(data: { token: string; newPassword: string }) {
    const res = await fetch(`${API_BASE}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await parseJson(res);
    if (!res.ok) throw new Error(json.error || 'Erro ao redefinir senha.');
    return json;
  },

  // --- AUTENTICAÇÃO DO BARBEIRO (2FA) ---
  async barberLoginStep1(data: { email: string; password: string }) {
    const res = await fetch(`${API_BASE}/auth/barber/login-step1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await parseJson(res);
    if (!res.ok) throw new Error(json.error || 'Credenciais de administrador incorretas.');
    return json;
  },

  async barberLoginStep2(data: { tempToken: string; code: string; newPassword?: string }) {
    const res = await fetch(`${API_BASE}/auth/barber/login-step2`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await parseJson(res);
    if (!res.ok) throw new Error(json.error || 'Código 2FA incorreto.');
    return json;
  },

  // --- ADMINISTRADORES E 2FA (painel do barbeiro) ---
  async adminListAdmins(): Promise<AdminAccount[]> {
    const res = await fetch(`${API_BASE}/admin/admins`, { cache: 'no-store' });
    const json = await parseJson(res);
    if (!res.ok) throw new Error(json.error || 'Erro ao carregar administradores.');
    return json.admins || [];
  },

  async adminCreateAdmin(data: { name: string; email: string; phone: string; tempPassword: string; code: string }): Promise<AdminAccount[]> {
    return (await postJson('/admin/admins', data)).admins || [];
  },

  async adminRemoveAdmin(id: string, code: string): Promise<AdminAccount[]> {
    return (await postJson(`/admin/admins/${encodeURIComponent(id)}`, { code }, 'DELETE')).admins || [];
  },

  async admin2FAStart(code: string): Promise<TwoFactorQr> {
    return postJson('/admin/2fa/start', { code });
  },

  async admin2FAConfirm(code: string): Promise<{ message: string }> {
    return postJson('/admin/2fa/confirm', { code });
  },

  async adminChangePassword(data: { currentPassword: string; newPassword: string; code: string }): Promise<{ message: string }> {
    return postJson('/admin/password', data);
  },

  // --- CONFIGURAÇÕES & STATUS ---
  async adminSaveService(data: { id?: string; name: string; description: string; price: number; durationMinutes: number; isPopular: boolean }) {
    const res = await fetch(`${API_BASE}/admin/services`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeader() }, body: JSON.stringify(data),
    });
    const json = await parseJson(res);
    if (!res.ok) throw new Error(json.error || 'Erro ao salvar serviço.');
    return json.services || [];
  },

  async adminDeleteService(id: string) {
    const res = await fetch(`${API_BASE}/admin/services/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { ...getAuthHeader() } });
    const json = await parseJson(res);
    if (!res.ok) throw new Error(json.error || 'Erro ao desativar serviço.');
    return json.services || [];
  },

  async getSettings() {
    const res = await fetch(`${API_BASE}/settings`);
    return await parseJson(res);
  },

  async toggleOpenStatus() {
    const res = await fetch(`${API_BASE}/settings/toggle-open`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
    });
    const json = await parseJson(res);
    if (!res.ok) throw new Error(json.error || 'Não autorizado a alterar status da barbearia.');
    return json;
  },

  // --- AGENDAMENTOS ---
  async getTakenTimes(date: string): Promise<string[]> {
    const res = await fetch(`${API_BASE}/appointments/taken?date=${encodeURIComponent(date)}`);
    const json = await parseJson(res);
    if (!res.ok) throw new Error(json.error || 'Erro ao carregar horários.');
    return json.taken || [];
  },

  async createAppointment(data: Omit<AppointmentRecord, 'id' | 'status' | 'paymentStatus' | 'createdAt'>): Promise<AppointmentRecord> {
    const res = await fetch(`${API_BASE}/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    const json = await parseJson(res);
    if (!res.ok) throw Object.assign(new Error(json.error || 'Erro ao criar agendamento.'), { status: res.status });
    return json.appointment;
  },

  async getMyAppointments(): Promise<AppointmentRecord[]> {
    const res = await fetch(`${API_BASE}/appointments/mine`, { headers: { ...getAuthHeader() } });
    const json = await parseJson(res);
    if (!res.ok) throw new Error(json.error || 'Erro ao carregar agendamentos.');
    return json.appointments || [];
  },

  async cancelAppointment(id: string): Promise<AppointmentRecord> {
    const res = await fetch(`${API_BASE}/appointments/${encodeURIComponent(id)}/cancel`, {
      method: 'PATCH',
      headers: { ...getAuthHeader() },
    });
    const json = await parseJson(res);
    if (!res.ok) throw new Error(json.error || 'Erro ao cancelar.');
    return json.appointment;
  },

  async adminListAppointments(from: string, to: string): Promise<AppointmentRecord[]> {
    const res = await fetch(`${API_BASE}/admin/appointments?from=${from}&to=${to}`, { headers: { ...getAuthHeader() } });
    const json = await parseJson(res);
    if (!res.ok) throw new Error(json.error || 'Erro ao carregar a agenda.');
    return json.appointments || [];
  },

  async adminUpdateAppointment(id: string, patch: { status?: string; paymentStatus?: string }): Promise<AppointmentRecord> {
    const res = await fetch(`${API_BASE}/admin/appointments/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(patch),
    });
    const json = await parseJson(res);
    if (!res.ok) throw new Error(json.error || 'Erro ao atualizar.');
    return json.appointment;
  },

  // --- PAGAMENTO PIX (Mercado Pago) — QR Code e "copia e cola" dentro do app ---
  async createPix(appointmentId: string): Promise<PixPayment> {
    const res = await fetch(`${API_BASE}/payments/pix`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appointmentId }),
    });
    const json = await parseJson(res);
    if (!res.ok || !json.qrCode) throw new Error(json.error || 'Não foi possível gerar o Pix.');
    return json as PixPayment;
  },

  async getPaymentStatus(appointmentId: string): Promise<{
    status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
    paymentStatus: 'pending' | 'paid';
    paymentMethod: 'pix' | 'card' | 'in_person';
    itemName: string;
    date: string;
    time: string;
  }> {
    const res = await fetch(`${API_BASE}/payments/status/${encodeURIComponent(appointmentId)}`);
    const json = await parseJson(res);
    if (!res.ok) throw new Error(json.error || 'Erro ao consultar pagamento.');
    return json;
  },

  // --- FATURAMENTO (barbeiro) ---
  async adminRevenue(month: string): Promise<RevenueSummary> {
    const res = await fetch(`${API_BASE}/admin/revenue?month=${encodeURIComponent(month)}`, { cache: 'no-store', headers: { ...getAuthHeader() } });
    const json = await parseJson(res);
    if (!res.ok) throw new Error(json.error || 'Erro ao carregar o faturamento.');
    return json as RevenueSummary;
  },

  // --- AVISO (POP-UP) ---
  // Aviso que os clientes veem (null = nenhum). Nunca fica em cache.
  async getActiveNotice(): Promise<NoticeData | null> {
    const res = await fetch(`${API_BASE}/notices/active`, { cache: 'no-store' });
    if (!res.ok) return null;
    const json = await parseJson(res);
    return json && json.title && json.message ? (json as NoticeData) : null;
  },

  async adminGetNotice(): Promise<NoticeData | null> {
    const res = await fetch(`${API_BASE}/admin/notice`, { cache: 'no-store', headers: { ...getAuthHeader() } });
    const json = await parseJson(res);
    if (!res.ok) throw new Error(json.error || 'Erro ao carregar o aviso.');
    return json.notice || null;
  },

  async adminSaveNotice(data: { title: string; message: string; validUntil: string; isActive: boolean }): Promise<NoticeData> {
    const res = await fetch(`${API_BASE}/admin/notice`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    const json = await parseJson(res);
    if (!res.ok) throw new Error(json.error || 'Erro ao salvar o aviso.');
    return json.notice;
  },
};

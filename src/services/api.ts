import { UserAccount, ServiceItem, PromoPackage, NoticeData } from '../types/barbershop';

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

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('barbershop_auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
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
    if (json.token) localStorage.setItem('barbershop_auth_token', json.token);
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
    if (json.token) localStorage.setItem('barbershop_auth_token', json.token);
    return json;
  },

  async getMe(): Promise<UserAccount | null> {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { ...getAuthHeader() },
      });
      if (!res.ok) return null;
      const json = await parseJson(res);
      return json.user;
    } catch {
      return null;
    }
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

  async barberLoginStep2(data: { tempToken: string; code: string }) {
    const res = await fetch(`${API_BASE}/auth/barber/login-step2`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await parseJson(res);
    if (!res.ok) throw new Error(json.error || 'Código 2FA incorreto.');
    if (json.token) localStorage.setItem('barbershop_auth_token', json.token);
    return json;
  },

  async getBarber2FASetup() {
    const res = await fetch(`${API_BASE}/auth/barber/2fa-setup`);
    const json = await parseJson(res);
    if (!res.ok) throw new Error(json.error || 'Erro ao carregar dados do 2FA.');
    return json;
  },

  // --- CONFIGURAÇÕES & STATUS ---
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
};

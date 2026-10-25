import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface UserRow {
  id: string;
  role: 'client' | 'barber_admin';
  name: string;
  phone: string;
  email: string;
  passwordHash: string;
  twoFactorSecret?: string | null;
  createdAt: string;
  updatedAt: string;
}

let _client: SupabaseClient | null = null;

function client(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Configuração ausente: defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nas variáveis de ambiente.');
  }
  _client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return _client;
}

function fail(context: string, error: { message: string } | null): never {
  throw new Error(`Erro no banco (${context}): ${error?.message ?? 'desconhecido'}`);
}

function mapUser(r: any): UserRow {
  return {
    id: r.id,
    role: r.role,
    name: r.name,
    phone: r.phone,
    email: r.email,
    passwordHash: r.password_hash,
    twoFactorSecret: r.two_factor_secret,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export const db = {
  // --- USUÁRIOS ---
  async findUserByEmail(email: string): Promise<UserRow | undefined> {
    const { data, error } = await client().from('users').select('*').eq('email', email.toLowerCase()).maybeSingle();
    if (error) fail('findUserByEmail', error);
    return data ? mapUser(data) : undefined;
  },

  async findUserById(id: string): Promise<UserRow | undefined> {
    const { data, error } = await client().from('users').select('*').eq('id', id).maybeSingle();
    if (error) fail('findUserById', error);
    return data ? mapUser(data) : undefined;
  },

  async hasAdmin(): Promise<boolean> {
    const { count, error } = await client()
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'barber_admin');
    if (error) fail('hasAdmin', error);
    return (count ?? 0) > 0;
  },

  async createUser(u: {
    role: 'client' | 'barber_admin';
    name: string;
    phone: string;
    email: string;
    passwordHash: string;
    twoFactorSecret?: string;
  }): Promise<UserRow> {
    const row = {
      id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      role: u.role,
      name: u.name,
      phone: u.phone,
      email: u.email.toLowerCase(),
      password_hash: u.passwordHash,
      two_factor_secret: u.twoFactorSecret ?? null,
    };
    const { data, error } = await client().from('users').insert(row).select('*').single();
    if (error) {
      if ((error as any).code === '23505') throw new Error('E-mail já cadastrado.');
      fail('createUser', error);
    }
    return mapUser(data);
  },

  // --- BLOQUEIO DE FORÇA BRUTA (persistido: funciona em serverless) ---
  async isIpLocked(ip: string): Promise<boolean> {
    const { data, error } = await client().from('login_attempts').select('*').eq('ip', ip).maybeSingle();
    if (error) fail('isIpLocked', error);
    if (!data || !data.locked_until) return false;
    if (new Date(data.locked_until).getTime() > Date.now()) return true;
    await client().from('login_attempts').delete().eq('ip', ip);
    return false;
  },

  async recordFailedLogin(ip: string): Promise<void> {
    const { data } = await client().from('login_attempts').select('*').eq('ip', ip).maybeSingle();
    const count = (data?.count ?? 0) + 1;
    const locked_until = count >= 5 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;
    const { error } = await client().from('login_attempts').upsert({ ip, count, locked_until });
    if (error) fail('recordFailedLogin', error);
  },

  async resetFailedLogin(ip: string): Promise<void> {
    await client().from('login_attempts').delete().eq('ip', ip);
  },

  // --- REDEFINIÇÃO DE SENHA ---
  async createPasswordReset(email: string, token: string): Promise<void> {
    await client().from('password_resets').delete().eq('email', email);
    const expires_at = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const { error } = await client().from('password_resets').insert({ token, email, expires_at });
    if (error) fail('createPasswordReset', error);
  },

  async verifyAndConsumeResetToken(token: string, newPasswordHash: string): Promise<boolean> {
    const { data, error } = await client().from('password_resets').select('*').eq('token', token).maybeSingle();
    if (error) fail('verifyResetToken', error);
    if (!data || new Date(data.expires_at).getTime() < Date.now()) return false;

    const user = await db.findUserByEmail(data.email);
    // Nunca permite redefinir a senha do administrador por este fluxo.
    if (!user || user.role !== 'client') return false;

    const { error: upErr } = await client()
      .from('users')
      .update({ password_hash: newPasswordHash, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    if (upErr) fail('updatePassword', upErr);
    await client().from('password_resets').delete().eq('token', token);
    return true;
  },

  // --- CONFIGURAÇÕES / CONTEÚDO ---
  async getSettings(): Promise<any> {
    const { data, error } = await client().from('settings').select('data').eq('id', 1).maybeSingle();
    if (error) fail('getSettings', error);
    return data?.data ?? { isOpenOverride: true };
  },

  async toggleOpenStatus(): Promise<boolean> {
    const current = await db.getSettings();
    const next = !current.isOpenOverride;
    const { error } = await client()
      .from('settings')
      .upsert({ id: 1, data: { ...current, isOpenOverride: next, updatedAt: new Date().toISOString() } });
    if (error) fail('toggleOpenStatus', error);
    return next;
  },

  async getServices(): Promise<any[]> {
    const { data, error } = await client()
      .from('services')
      .select('data')
      .eq('is_active', true)
      .order('display_order');
    if (error) fail('getServices', error);
    return (data ?? []).map((r) => r.data);
  },

  async getPackages(): Promise<any[]> {
    const { data, error } = await client().from('packages').select('data').eq('is_active', true);
    if (error) fail('getPackages', error);
    return (data ?? []).map((r) => r.data);
  },

  async getActiveNotice(): Promise<any | null> {
    const { data, error } = await client().from('notices').select('data').eq('is_active', true).limit(1);
    if (error) fail('getActiveNotice', error);
    return data && data.length ? data[0].data : null;
  },

  // --- AUDITORIA (nunca derruba a requisição se falhar) ---
  async addAuditLog(action: string, details: string, userId?: string, userName?: string, ip?: string): Promise<void> {
    try {
      await client()
        .from('audit_logs')
        .insert({ action, details, user_id: userId ?? null, user_name: userName ?? null, ip_address: ip ?? null });
    } catch (err) {
      console.error('Falha ao gravar audit log:', err);
    }
  },
};

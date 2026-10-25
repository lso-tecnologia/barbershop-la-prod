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

export interface AppointmentRow {
  id: string;
  userId: string | null;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  itemName: string;
  itemType: 'service' | 'package';
  price: number;
  date: string;
  time: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  paymentMethod: 'pix' | 'card' | 'in_person';
  paymentStatus: 'pending' | 'paid';
  createdAt: string;
}

export interface ServiceRow {
  id: string;
  name: string;
  title: string;
  description: string;
  price: number;
  durationMinutes: number;
  duration: string;
  isPopular: boolean;
  image?: string;
}

export interface PackageRow {
  id: string;
  title: string;
  price: number;
  economy: string;
  description: string;
  benefits: string[];
  isFeatured: boolean;
}

function mapAppointment(r: any): AppointmentRow {
  return {
    id: r.id,
    userId: r.user_id,
    clientName: r.client_name,
    clientPhone: r.client_phone,
    clientEmail: r.client_email,
    itemName: r.item_name,
    itemType: r.item_type,
    price: Number(r.price),
    date: r.date,
    time: r.time,
    status: r.status,
    paymentMethod: r.payment_method,
    paymentStatus: r.payment_status,
    createdAt: r.created_at,
  };
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

  // --- BLOQUEIO DE FORÇA BRUTA ---
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

  async getServices(): Promise<ServiceRow[]> {
    const { data, error } = await client().from('services').select('*').eq('is_active', true).order('display_order', { ascending: true });
    if (error) fail('getServices', error);
    return (data ?? []).map((r: any) => {
      const d = r.data ?? {};
      return {
        id: r.id,
        name: d.name || d.title || 'Serviço',
        title: d.title || d.name || 'Serviço',
        description: d.description || '',
        price: Number(d.price ?? (Number(d.priceCents ?? 0) / 100)),
        durationMinutes: Number(d.durationMinutes ?? 60),
        duration: d.duration || `${Number(d.durationMinutes ?? 60)} min`,
        isPopular: !!(d.isPopular ?? d.isFeatured),
        image: d.image || undefined,
      };
    });
  },

  async upsertService(service: {
    id?: string; name: string; description: string; price: number;
    durationMinutes: number; duration: string; isPopular: boolean;
  }): Promise<void> {
    const serviceId = service.id || 'srv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const { data: existing } = await client().from('services').select('display_order').eq('id', serviceId).maybeSingle();
    const row = {
      id: serviceId,
      data: {
        id: serviceId, name: service.name.trim(), title: service.name.trim(),
        description: service.description.trim(), priceCents: Math.round(service.price * 100),
        durationMinutes: service.durationMinutes, isPopular: service.isPopular,
        isActive: true, displayOrder: existing?.display_order ?? 99,
        updatedAt: new Date().toISOString(),
      },
      is_active: true,
      display_order: existing?.display_order ?? 99,
    };
    const { error } = await client().from('services').upsert(row);
    if (error) fail('upsertService', error);
  },

  async deleteService(id: string): Promise<void> {
    const { error } = await client().from('services').update({ is_active: false }).eq('id', id);
    if (error) fail('deleteService', error);
  },

  async getPackages(): Promise<PackageRow[]> {
    const { data, error } = await client().from('packages').select('*');
    if (error) {
      return [];
    }
    return (data ?? []).map((r: any) => ({
      id: r.id,
      title: r.title || 'Pacote',
      price: Number(r.price || 0),
      economy: r.economy || '',
      description: r.description || '',
      benefits: Array.isArray(r.benefits) ? r.benefits : [],
      isFeatured: !!r.is_featured,
    }));
  },

  async getActiveNotice(): Promise<any | null> {
    const { data, error } = await client().from('notices').select('data').eq('is_active', true).limit(1);
    if (error) fail('getActiveNotice', error);
    return data && data.length ? data[0].data : null;
  },

  // --- AGENDAMENTOS ---
  async getTakenTimes(date: string): Promise<string[]> {
    const { data, error } = await client()
      .from('appointments')
      .select('time')
      .eq('date', date)
      .in('status', ['pending', 'confirmed']);
    if (error) fail('getTakenTimes', error);
    return (data ?? []).map((r) => r.time);
  },

  async createAppointment(a: Omit<AppointmentRow, 'id' | 'createdAt'>): Promise<AppointmentRow> {
    const row = {
      id: 'apt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      user_id: a.userId,
      client_name: a.clientName,
      client_phone: a.clientPhone,
      client_email: a.clientEmail,
      item_name: a.itemName,
      item_type: a.itemType,
      price: a.price,
      date: a.date,
      time: a.time,
      status: a.status,
      payment_method: a.paymentMethod,
      payment_status: a.paymentStatus,
    };
    const { data, error } = await client().from('appointments').insert(row).select('*').single();
    if (error) {
      if ((error as any).code === '23505') throw new Error('SLOT_TAKEN');
      fail('createAppointment', error);
    }
    return mapAppointment(data);
  },

  async getAppointmentsForUser(userId: string, email: string): Promise<AppointmentRow[]> {
    const [byUser, byEmail] = await Promise.all([
      client().from('appointments').select('*').eq('user_id', userId),
      client().from('appointments').select('*').eq('client_email', email.toLowerCase()),
    ]);
    if (byUser.error) fail('getAppointmentsForUser', byUser.error);
    if (byEmail.error) fail('getAppointmentsForUser', byEmail.error);
    const map = new Map<string, AppointmentRow>();
    for (const r of [...(byUser.data ?? []), ...(byEmail.data ?? [])]) map.set(r.id, mapAppointment(r));
    return [...map.values()].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  },

  async countActiveByPhone(phone: string, fromDate: string): Promise<number> {
    const { count, error } = await client()
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('client_phone', phone)
      .gte('date', fromDate)
      .in('status', ['pending', 'confirmed']);
    if (error) fail('countActiveByPhone', error);
    return count ?? 0;
  },

  async getAppointmentById(id: string): Promise<AppointmentRow | undefined> {
    const { data, error } = await client().from('appointments').select('*').eq('id', id).maybeSingle();
    if (error) fail('getAppointmentById', error);
    return data ? mapAppointment(data) : undefined;
  },

  async listAppointments(from: string, to: string): Promise<AppointmentRow[]> {
    const { data, error } = await client()
      .from('appointments')
      .select('*')
      .gte('date', from)
      .lte('date', to)
      .order('date')
      .order('time');
    if (error) fail('listAppointments', error);
    return (data ?? []).map(mapAppointment);
  },

  async updateAppointment(id: string, patch: { status?: string; paymentStatus?: string }): Promise<AppointmentRow | undefined> {
    const upd: Record<string, string> = {};
    if (patch.status) upd.status = patch.status;
    if (patch.paymentStatus) upd.payment_status = patch.paymentStatus;
    const { data, error } = await client().from('appointments').update(upd).eq('id', id).select('*').maybeSingle();
    if (error) fail('updateAppointment', error);
    return data ? mapAppointment(data) : undefined;
  },

  // --- AUDITORIA ---
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
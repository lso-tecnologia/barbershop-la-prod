import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { coveredSlots } from './slots.js';

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
  durationMinutes: number;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  paymentMethod: 'pix' | 'card' | 'in_person';
  paymentStatus: 'pending' | 'paid';
  mpPaymentId?: string | null;
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

export interface NoticeRow {
  id: string;            // identificador do aviso + versão (muda quando o barbeiro edita)
  title: string;
  message: string;
  validUntil: string | null; // "YYYY-MM-DD" ou null (sem validade)
  isActive: boolean;
  priority: 'normal' | 'urgent';
  updatedAt: string | null;
}

// Aceita "YYYY-MM-DD" e o formato antigo "DD/MM/YYYY"
function normalizeValidUntil(v: unknown): string | null {
  const s = String(v ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

// Identificador imprevisível (não dá para "adivinhar" o id de agendamento/usuário de outra pessoa)
const newId = (prefix: string) => `${prefix}_${crypto.randomBytes(9).toString('base64url')}`;

function mapNotice(r: any): NoticeRow {
  const d = r.data ?? {};
  const version = String(d.version ?? d.updatedAt ?? d.createdAt ?? '1');
  return {
    id: `${r.id}:${version}`,
    title: String(d.title ?? ''),
    message: String(d.message ?? ''),
    validUntil: normalizeValidUntil(d.validUntil),
    isActive: !!r.is_active && d.isActive !== false,
    priority: d.priority === 'urgent' ? 'urgent' : 'normal',
    updatedAt: d.updatedAt ?? null,
  };
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
    durationMinutes: Number(r.duration_minutes ?? 60),
    status: r.status,
    paymentMethod: r.payment_method,
    paymentStatus: r.payment_status,
    mpPaymentId: r.mp_payment_id ?? null,
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
      id: newId('usr'),
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

  // --- LIMITE DE REQUISIÇÕES (anti-abuso) ---
  // Reaproveita a tabela login_attempts (chave "rl:..."): count = pedidos na janela; locked_until = fim da janela.
  // Devolve true se PODE continuar. Se o banco falhar, não bloqueia o serviço (só registra no log).
  async hitRateLimit(key: string, max: number, windowMs: number): Promise<boolean> {
    try {
      const k = `rl:${key}`;
      const now = Date.now();
      const { data } = await client().from('login_attempts').select('*').eq('ip', k).maybeSingle();
      if (!data || !data.locked_until || new Date(data.locked_until).getTime() <= now) {
        await client().from('login_attempts').upsert({ ip: k, count: 1, locked_until: new Date(now + windowMs).toISOString() });
        return true;
      }
      const count = Number(data.count || 0) + 1;
      await client().from('login_attempts').upsert({ ip: k, count, locked_until: data.locked_until });
      return count <= max;
    } catch (err) {
      console.error('Falha no limite de requisições:', err);
      return true;
    }
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

  // Pacotes: os dados ficam dentro da coluna jsonb "data" (title, priceCents, economyText, benefits...).
  // (Antes o código lia colunas que não existem -> preço 0 e título "Pacote".)
  async getPackages(): Promise<PackageRow[]> {
    const { data, error } = await client().from('packages').select('*').eq('is_active', true);
    if (error) {
      console.error('Erro ao ler pacotes:', error.message);
      return [];
    }
    return (data ?? [])
      .map((r: any) => {
        const d = r.data ?? {};
        const price = d.price !== undefined ? Number(d.price) : Number(d.priceCents ?? 0) / 100;
        return {
          id: String(r.id),
          title: String(d.title || d.name || 'Pacote'),
          price: Number.isFinite(price) ? price : 0,
          economy: String(d.economy ?? d.economyText ?? ''),
          description: String(d.description ?? ''),
          benefits: Array.isArray(d.benefits) ? d.benefits.map(String) : [],
          isFeatured: !!d.isFeatured,
        };
      })
      .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  },

  // --- AVISO (POP-UP) EDITÁVEL PELO BARBEIRO ---
  // Fica na tabela "notices". O aviso oficial é a linha de id "main"; ao salvar, as demais são desativadas.
  async getNoticeForAdmin(): Promise<NoticeRow | null> {
    const { data, error } = await client().from('notices').select('id, data, is_active');
    if (error) fail('getNoticeForAdmin', error);
    const rows = data ?? [];
    const row = rows.find((r: any) => r.id === 'main') ?? rows.find((r: any) => r.is_active) ?? rows[0];
    return row ? mapNotice(row) : null;
  },

  // Aviso que os clientes veem: precisa estar ativo e dentro da validade
  async getActiveNotice(): Promise<NoticeRow | null> {
    const n = await db.getNoticeForAdmin();
    if (!n || !n.isActive) return null;
    if (n.validUntil && Date.now() > new Date(`${n.validUntil}T23:59:59-03:00`).getTime()) return null;
    return n;
  },

  async saveNotice(n: { title: string; message: string; validUntil: string | null; isActive: boolean }): Promise<NoticeRow> {
    const now = new Date().toISOString();
    // "version" muda a cada salvamento: quem já fechou o aviso antigo vê o novo
    const data = {
      id: 'main', title: n.title, message: n.message, validUntil: n.validUntil,
      isActive: n.isActive, priority: 'normal', version: String(Date.now()), updatedAt: now,
    };
    const { error } = await client().from('notices').upsert({ id: 'main', data, is_active: n.isActive });
    if (error) fail('saveNotice', error);
    const { error: offErr } = await client().from('notices').update({ is_active: false }).neq('id', 'main');
    if (offErr) fail('saveNotice(desativar antigos)', offErr);
    return mapNotice({ id: 'main', data, is_active: n.isActive });
  },

  // --- AGENDAMENTOS ---
  // Todas as fatias de 30 min ocupadas no dia (considera a duração de cada atendimento)
  async getTakenTimes(date: string): Promise<string[]> {
    const list = await db.getActiveAppointmentsForDate(date);
    return [...new Set(list.flatMap((a) => coveredSlots(a.time, a.durationMinutes)))];
  },

  async getActiveAppointmentsForDate(date: string): Promise<{ time: string; durationMinutes: number }[]> {
    const { data, error } = await client()
      .from('appointments')
      .select('time, duration_minutes')
      .eq('date', date)
      .in('status', ['pending', 'confirmed']);
    if (error) fail('getActiveAppointmentsForDate', error);
    return (data ?? []).map((r: any) => ({ time: r.time, durationMinutes: Number(r.duration_minutes ?? 60) }));
  },


  async createAppointment(a: Omit<AppointmentRow, 'id' | 'createdAt'>): Promise<AppointmentRow> {
    const row = {
      id: newId('apt'),
      user_id: a.userId,
      client_name: a.clientName,
      client_phone: a.clientPhone,
      client_email: a.clientEmail,
      item_name: a.itemName,
      item_type: a.itemType,
      price: a.price,
      date: a.date,
      time: a.time,
      duration_minutes: a.durationMinutes,
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

  async updateAppointment(
    id: string,
    patch: { status?: string; paymentStatus?: string; mpPaymentId?: string; mpPreferenceId?: string }
  ): Promise<AppointmentRow | undefined> {
    const upd: Record<string, string> = {};
    if (patch.status) upd.status = patch.status;
    if (patch.paymentStatus) upd.payment_status = patch.paymentStatus;
    if (patch.mpPaymentId) upd.mp_payment_id = patch.mpPaymentId;
    if (patch.mpPreferenceId) upd.mp_preference_id = patch.mpPreferenceId;
    const { data, error } = await client().from('appointments').update(upd).eq('id', id).select('*').maybeSingle();
    if (error) {
      if ((error as any).code === '23505') throw new Error('SLOT_TAKEN');
      fail('updateAppointment', error);
    }
    return data ? mapAppointment(data) : undefined;
  },

  // Libera horários de pagamentos online não concluídos em 15 minutos
  async expireUnpaid(): Promise<void> {
    const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { error } = await client()
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('status', 'pending')
      .eq('payment_status', 'pending')
      .in('payment_method', ['pix', 'card'])
      .lt('created_at', cutoff);
    if (error) console.error('Falha ao expirar reservas não pagas:', error.message);
  },

  // Preço oficial vindo do banco (nunca confiar no preço enviado pelo navegador)
  async findCatalogItem(name: string, type: 'service' | 'package'): Promise<{ price: number; durationMinutes: number } | null> {
    const table = type === 'package' ? 'packages' : 'services';
    const { data, error } = await client().from(table).select('data').eq('is_active', true);
    if (error) fail('findCatalogItem', error);
    const wanted = name.trim().toLowerCase();
    for (const r of data ?? []) {
      const d: any = r.data ?? {};
      const n = String(d.name || d.title || '').trim().toLowerCase();
      if (n && n === wanted) {
        const price = d.price !== undefined ? Number(d.price) : Number(d.priceCents ?? 0) / 100;
        const duration = Number(d.durationMinutes ?? 60);
        return {
          price: Number.isFinite(price) ? price : 0,
          durationMinutes: Number.isFinite(duration) && duration > 0 ? duration : 60,
        };
      }
    }
    return null;
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
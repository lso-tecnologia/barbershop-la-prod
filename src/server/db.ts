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
  twoFactorPendingSecret?: string | null; // 2FA novo aguardando confirmação (novo admin ou troca de celular)
  twoFactorLastCounter?: number | null;   // último código 2FA aceito (impede reutilizar o mesmo código)
  tokenVersion: number;                   // muda quando a senha/2FA muda -> derruba sessões antigas
  emailVerified: boolean;                 // e-mail comprovado (só então agendamentos por e-mail são "dele")
  createdAt: string;
  updatedAt: string;
}

// Domínio usado quando um visitante agenda sem informar e-mail (ninguém pode se cadastrar com ele)
export const GUEST_EMAIL_DOMAIN = 'barbershopla.com.br';
const sha256 = (v: string) => crypto.createHash('sha256').update(v).digest('hex');

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

export interface GalleryRow {
  id: string;
  position: number;
  title: string;
  subtitle: string;
  category: string;
  imageUrl: string | null; // foto que veio com o site; null = foto enviada pelo painel (fica no banco)
  createdAt: string;
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
    twoFactorPendingSecret: r.two_factor_pending_secret ?? null,
    twoFactorLastCounter: r.two_factor_last_counter == null ? null : Number(r.two_factor_last_counter),
    tokenVersion: Number(r.token_version ?? 0),
    emailVerified: !!r.email_verified,
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

  async updateUser(id: string, patch: {
    passwordHash?: string; twoFactorSecret?: string | null; twoFactorPendingSecret?: string | null;
    twoFactorLastCounter?: number | null; bumpTokenVersion?: boolean; emailVerified?: boolean;
  }): Promise<UserRow | undefined> {
    const upd: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.passwordHash !== undefined) upd.password_hash = patch.passwordHash;
    if (patch.twoFactorSecret !== undefined) upd.two_factor_secret = patch.twoFactorSecret;
    if (patch.twoFactorPendingSecret !== undefined) upd.two_factor_pending_secret = patch.twoFactorPendingSecret;
    if (patch.twoFactorLastCounter !== undefined) upd.two_factor_last_counter = patch.twoFactorLastCounter;
    if (patch.emailVerified !== undefined) upd.email_verified = patch.emailVerified;
    if (patch.bumpTokenVersion) {
      const current = await db.findUserById(id);
      if (!current) return undefined;
      upd.token_version = current.tokenVersion + 1;
    }
    const { data, error } = await client().from('users').update(upd).eq('id', id).select('*').maybeSingle();
    if (error) fail('updateUser', error);
    return data ? mapUser(data) : undefined;
  },

  // Grava o último código 2FA usado SÓ se ele for mais novo (atômico: dois pedidos com o mesmo código, só um passa)
  async consumeTotpCounter(id: string, counter: number): Promise<boolean> {
    const { data, error } = await client()
      .from('users')
      .update({ two_factor_last_counter: counter })
      .eq('id', id)
      .or(`two_factor_last_counter.is.null,two_factor_last_counter.lt.${Math.floor(counter)}`)
      .select('id');
    if (error) fail('consumeTotpCounter', error);
    return (data ?? []).length === 1;
  },

  async listAdmins(): Promise<UserRow[]> {
    const { data, error } = await client().from('users').select('*').eq('role', 'barber_admin').order('created_at');
    if (error) fail('listAdmins', error);
    return (data ?? []).map(mapUser);
  },

  async deleteUser(id: string): Promise<void> {
    const { error } = await client().from('users').delete().eq('id', id);
    if (error) fail('deleteUser', error);
  },

  // --- CONTADORES (força bruta e limite de pedidos) ---
  // Tabela login_attempts: ip = chave, count = pedidos na janela, locked_until = fim da janela.
  // O incremento é feito no banco (função hit_counter) numa única instrução -> pedidos simultâneos não "furam" o limite.
  async hitCounter(key: string, windowSeconds: number): Promise<number> {
    const { data, error } = await client().rpc('hit_counter', { p_key: key, p_window_seconds: windowSeconds });
    if (error) fail('hitCounter', error);
    return Number(data ?? 0);
  },

  async getCounter(key: string): Promise<number> {
    const { data, error } = await client().from('login_attempts').select('count, locked_until').eq('ip', key).maybeSingle();
    if (error) fail('getCounter', error);
    if (!data?.locked_until || new Date(data.locked_until).getTime() <= Date.now()) return 0;
    return Number(data.count || 0);
  },

  async clearCounter(key: string): Promise<void> {
    await client().from('login_attempts').delete().eq('ip', key);
  },

  // Devolve true se PODE continuar. Se o banco falhar, lança erro (o servidor responde 503 em vez de liberar tudo).
  async hitRateLimit(key: string, max: number, windowMs: number): Promise<boolean> {
    const count = await db.hitCounter(`rl:${key}`, Math.ceil(windowMs / 1000));
    return count <= max;
  },

  // --- REDEFINIÇÃO DE SENHA ---
  async createPasswordReset(email: string, token: string): Promise<void> {
    await client().from('password_resets').delete().eq('email', email);
    const expires_at = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    // Guarda só o hash do código: quem ler o banco não consegue usar o código
    const { error } = await client().from('password_resets').insert({ token: sha256(token), email, expires_at });
    if (error) fail('createPasswordReset', error);
  },

  async verifyAndConsumeResetToken(token: string, newPasswordHash: string): Promise<boolean> {
    const hashed = sha256(token);
    const { data, error } = await client().from('password_resets').select('*').eq('token', hashed).maybeSingle();
    if (error) fail('verifyResetToken', error);
    if (!data || new Date(data.expires_at).getTime() < Date.now()) return false;

    const user = await db.findUserByEmail(data.email);
    if (!user || user.role !== 'client') return false;

    // Apaga o código ANTES de trocar a senha (não pode ser usado duas vezes)
    const { data: deleted } = await client().from('password_resets').delete().eq('token', hashed).select('token');
    if (!deleted?.length) return false;
    // Quem recebeu o código no e-mail comprovou que é dono dele; sessões antigas caem
    await db.updateUser(user.id, { passwordHash: newPasswordHash, emailVerified: true, bumpTokenVersion: true });
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

  // Agendamentos feitos sem login só entram pelo e-mail se o e-mail da conta for COMPROVADO
  async getAppointmentsForUser(userId: string, email: string, emailVerified: boolean): Promise<AppointmentRow[]> {
    const useEmail = emailVerified && !email.toLowerCase().endsWith(`@${GUEST_EMAIL_DOMAIN}`);
    const [byUser, byEmail] = await Promise.all([
      client().from('appointments').select('*').eq('user_id', userId),
      useEmail
        ? client().from('appointments').select('*').eq('client_email', email.toLowerCase())
        : Promise.resolve({ data: [] as any[], error: null }),
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


  // --- GALERIA DE ESTILOS ---
  // A lista NÃO traz a foto em si (pode ser pesada); a imagem é servida por /api/gallery/photo/:id
  async listGallery(): Promise<GalleryRow[]> {
    const { data, error } = await client()
      .from('gallery_photos')
      .select('id, position, title, subtitle, category, image_url, created_at')
      .order('position', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) fail('listGallery', error);
    return (data ?? []).map((r: any) => ({
      id: r.id, position: Number(r.position ?? 0), title: r.title ?? '', subtitle: r.subtitle ?? '',
      category: r.category ?? '', imageUrl: r.image_url ?? null, createdAt: r.created_at,
    }));
  },

  async getGalleryImage(id: string): Promise<{ mime: string; data: string } | null> {
    const { data, error } = await client().from('gallery_photos').select('mime, image_data').eq('id', id).maybeSingle();
    if (error) fail('getGalleryImage', error);
    return data?.image_data && data?.mime ? { mime: data.mime, data: data.image_data } : null;
  },

  async addGalleryPhoto(p: { title: string; subtitle: string; category: string; mime: string; base64: string }): Promise<void> {
    const list = await db.listGallery();
    const position = list.reduce((m, r) => Math.max(m, r.position), 0) + 1;
    const { error } = await client().from('gallery_photos').insert({
      id: newId('gal'), position, title: p.title, subtitle: p.subtitle, category: p.category,
      mime: p.mime, image_data: p.base64,
    });
    if (error) fail('addGalleryPhoto', error);
  },

  async deleteGalleryPhoto(id: string): Promise<boolean> {
    const { data, error } = await client().from('gallery_photos').delete().eq('id', id).select('id');
    if (error) fail('deleteGalleryPhoto', error);
    return (data ?? []).length > 0;
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
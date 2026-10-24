import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

export interface UserRow {
  id: string;
  role: 'client' | 'barber_admin';
  name: string;
  phone: string;
  email: string;
  passwordHash: string;
  twoFactorSecret?: string;
  twoFactorEnabled?: boolean;
  failedLoginAttempts?: number;
  lockUntil?: number;
  createdAt: string;
  updatedAt: string;
}

export interface BarbershopSettingsRow {
  id: number;
  isOpenOverride: boolean;
  barberName: string;
  barberBio: string;
  barberPhotoUrl: string;
  operatingHours: {
    day: string;
    hours: string;
    isOpen: boolean;
    startHour: number;
    endHour: number;
  }[];
  slotDurationMinutes: number;
  cancellationLimitHours: number;
  whatsappNumber: string;
  updatedAt: string;
}

export interface ServiceRow {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  durationMinutes: number;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
}

export interface PackageRow {
  id: string;
  title: string;
  description: string;
  priceCents: number;
  economyText: string;
  benefits: string[];
  isActive: boolean;
  isFeatured: boolean;
  createdAt: string;
}

export interface AppointmentRow {
  id: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  serviceId?: string;
  packageId?: string;
  itemName: string;
  itemType: 'service' | 'package';
  priceCents: number;
  appointmentDate: string; // YYYY-MM-DD
  slotTime: string; // HH:MM
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  paymentMethod: 'in_person' | 'pix' | 'card';
  paymentStatus: 'pending' | 'paid' | 'cancelled' | 'refunded';
  cancelledAt?: string;
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NoticeRow {
  id: string;
  title: string;
  message: string;
  isActive: boolean;
  validUntil: string;
  priority: 'normal' | 'urgent';
  createdAt: string;
}

export interface AuditLogRow {
  id: string;
  userId?: string;
  userName?: string;
  action: string;
  details: string;
  ipAddress?: string;
  createdAt: string;
}

export interface DatabaseSchema {
  users: UserRow[];
  settings: BarbershopSettingsRow;
  services: ServiceRow[];
  packages: PackageRow[];
  appointments: AppointmentRow[];
  notices: NoticeRow[];
  auditLogs: AuditLogRow[];
  passwordResets: { token: string; email: string; expiresAt: number }[];
}

const DB_FILE_PATH = path.resolve(process.cwd(), 'barbershop_db.json');

class DatabaseEngine {
  private data: DatabaseSchema;

  constructor() {
    this.data = this.loadOrInitDatabase();
  }

  private loadOrInitDatabase(): DatabaseSchema {
    if (fs.existsSync(DB_FILE_PATH)) {
      try {
        const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
        return JSON.parse(raw);
      } catch (err) {
        console.error('Erro ao carregar banco de dados, recriando inicial:', err);
      }
    }

    const initialDb = this.getInitialSeed();
    this.save(initialDb);
    return initialDb;
  }

  private getInitialSeed(): DatabaseSchema {
    // Senha padrão para o barbeiro administrador: Leonardo@2026
    const adminPasswordHash = bcrypt.hashSync('Leonardo@2026', 12);
    // Senha de teste para cliente: Cliente@123
    const clientPasswordHash = bcrypt.hashSync('Cliente@123', 10);

    return {
      users: [
        {
          id: 'usr_admin_leonardo',
          role: 'barber_admin',
          name: 'Leonardo Arruda',
          phone: '(11) 98115-4340',
          email: 'leo.arruda226@gmail.com',
          passwordHash: adminPasswordHash,
          twoFactorSecret: 'NJMDJZPWRCNOMFS6ZINTVXVW33QLPNYY', // Base32 Secret padrão para TOTP RFC 6238
          twoFactorEnabled: true,
          failedLoginAttempts: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'usr_client_demo',
          role: 'client',
          name: 'Carlos Oliveira',
          phone: '(11) 99876-5432',
          email: 'carlos.cliente@gmail.com',
          passwordHash: clientPasswordHash,
          failedLoginAttempts: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      settings: {
        id: 1,
        isOpenOverride: true,
        barberName: 'Leonardo Arruda',
        barberBio:
          'Há 8 anos transformo a autoestima dos meus clientes com a tesoura e a navalha na mão — uma paixão que só cresce com o tempo. Minha maior motivação para dar o meu melhor todos os dias é o meu filho, a razão de tudo o que construo. Nas horas vagas, meu refúgio é a garagem: apaixonado por carros, gosto de passar o tempo mexendo no meu projeto e montando som de qualidade. Seja bem-vindo à cadeira!',
        barberPhotoUrl: '/assets/aistudio/WhatsApp_Image_2026-10-24_at_16.19.02_2143161f.jpeg',
        operatingHours: [
          { day: 'Segunda-feira', hours: 'Fechado', isOpen: false, startHour: 0, endHour: 0 },
          { day: 'Terça-feira', hours: '09h às 19h', isOpen: true, startHour: 9, endHour: 19 },
          { day: 'Quarta-feira', hours: '09h às 19h', isOpen: true, startHour: 9, endHour: 19 },
          { day: 'Quinta-feira', hours: '09h às 19h', isOpen: true, startHour: 9, endHour: 19 },
          { day: 'Sexta-feira', hours: '09h às 19h', isOpen: true, startHour: 9, endHour: 19 },
          { day: 'Sábado', hours: '09h às 19h', isOpen: true, startHour: 9, endHour: 19 },
          { day: 'Domingo', hours: '09h às 14h', isOpen: true, startHour: 9, endHour: 14 },
        ],
        slotDurationMinutes: 60,
        cancellationLimitHours: 2,
        whatsappNumber: '5511981154340',
        updatedAt: new Date().toISOString(),
      },
      services: [
        {
          id: 'srv-corte',
          name: 'Corte Tradicional / Fade',
          description: 'Corte moderno ou clássico com tesoura e máquina, degradê impecável e finalização.',
          priceCents: 3500,
          durationMinutes: 60,
          isActive: true,
          displayOrder: 1,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'srv-barba',
          name: 'Barba Tradicional na Navalha',
          description: 'Alinhamento preciso com navalha, óleo hidratante e loção pós-barba.',
          priceCents: 3500,
          durationMinutes: 60,
          isActive: true,
          displayOrder: 2,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'srv-relaxamento',
          name: 'Relaxamento Capilar',
          description: 'Tratamento para soltura de cachos e controle de volume com produtos seguros e nutritivos.',
          priceCents: 4000,
          durationMinutes: 60,
          isActive: true,
          displayOrder: 3,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'srv-sobrancelha',
          name: 'Sobrancelha na Navalha',
          description: 'Design masculino e limpeza milimétrica na navalha para realçar o olhar.',
          priceCents: 1000,
          durationMinutes: 15,
          isActive: true,
          displayOrder: 4,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'srv-pezinho',
          name: 'Pezinho / Acabamento',
          description: 'Limpeza de contorno de nuca e costeletas na navalha para manter o corte em dia.',
          priceCents: 1000,
          durationMinutes: 15,
          isActive: true,
          displayOrder: 5,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'srv-pacote-custom',
          name: 'Pacote Personalizado',
          description: 'Combinações sob medida para eventos ou atendimentos especiais.',
          priceCents: 0,
          durationMinutes: 60,
          isActive: true,
          displayOrder: 6,
          createdAt: new Date().toISOString(),
        },
      ],
      packages: [
        {
          id: 'pkg-1',
          title: 'Pacote 1 — Estilo Semanal',
          description: 'Plano perfeito para quem valoriza andar sempre no padrão da navalha.',
          priceCents: 13000,
          economyText: 'Economize R$ 50/mês',
          benefits: [
            '4 cortes de cabelo por mês (1 por semana)',
            'Sobrancelha 1x por semana na navalha',
            'Prioridade na escolha de horários',
            'Acabamento e penteado inclusos',
          ],
          isActive: true,
          isFeatured: false,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'pkg-2',
          title: 'Pacote 2 — Combo Completo',
          description: 'Cuidado total de cabelo e barba semana a semana com o barbeiro.',
          priceCents: 26000,
          economyText: 'Melhor Custo-Benefício',
          benefits: [
            '4 cortes de cabelo por mês',
            '4 barbas completas alinhadas na navalha por mês',
            'Sobrancelha 1x por semana na navalha',
            'Loção pós-barba e finalização inclusas',
            'Reserva fixa do seu dia e horário preferido',
          ],
          isActive: true,
          isFeatured: true,
          createdAt: new Date().toISOString(),
        },
      ],
      appointments: [],
      notices: [
        {
          id: 'notice-official-2026',
          title: 'Horário Estendido: Ter-Sáb até 19h e Dom até 14h!',
          message:
            'Agora você tem mais tempo para cuidar do seu visual na BARBERSHOP L.A! Atendemos de Terça a Sábado das 09h às 19h e aos Domingos das 09h às 14h (slots de 1h). Agende seu horário com antecedência!',
          isActive: true,
          validUntil: '31/10/2026',
          priority: 'normal',
          createdAt: new Date().toISOString(),
        },
      ],
      auditLogs: [],
      passwordResets: [],
    };
  }

  private save(data: DatabaseSchema): void {
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  }

  // --- MÉTODOS DE USUÁRIOS E AUTENTICAÇÃO ---

  public findUserByEmail(email: string): UserRow | undefined {
    return this.data.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  }

  public findUserById(id: string): UserRow | undefined {
    return this.data.users.find((u) => u.id === id);
  }

  public createUser(user: Omit<UserRow, 'id' | 'createdAt' | 'updatedAt' | 'failedLoginAttempts'>): UserRow {
    const existing = this.findUserByEmail(user.email);
    if (existing) {
      throw new Error('E-mail já cadastrado.');
    }

    const newUser: UserRow = {
      ...user,
      id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      failedLoginAttempts: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.data.users.push(newUser);
    this.save(this.data);
    return newUser;
  }

  public updateFailedLogin(userId: string, failedAttempts: number, lockUntil?: number): void {
    const u = this.findUserById(userId);
    if (u) {
      u.failedLoginAttempts = failedAttempts;
      u.lockUntil = lockUntil;
      u.updatedAt = new Date().toISOString();
      this.save(this.data);
    }
  }

  public resetFailedLogin(userId: string): void {
    const u = this.findUserById(userId);
    if (u) {
      u.failedLoginAttempts = 0;
      u.lockUntil = undefined;
      u.updatedAt = new Date().toISOString();
      this.save(this.data);
    }
  }

  public createPasswordReset(email: string, token: string): void {
    // 15 minutos de expiração
    const expiresAt = Date.now() + 15 * 60 * 1000;
    this.data.passwordResets = this.data.passwordResets.filter((r) => r.email !== email);
    this.data.passwordResets.push({ token, email, expiresAt });
    this.save(this.data);
  }

  public verifyAndConsumeResetToken(token: string, newPasswordHash: string): boolean {
    const reset = this.data.passwordResets.find((r) => r.token === token && r.expiresAt > Date.now());
    if (!reset) return false;

    const user = this.findUserByEmail(reset.email);
    if (!user) return false;

    user.passwordHash = newPasswordHash;
    user.updatedAt = new Date().toISOString();
    this.data.passwordResets = this.data.passwordResets.filter((r) => r.token !== token);
    this.save(this.data);
    return true;
  }

  // --- MÉTODOS DE CONFIGURAÇÃO E BARBEARIA ---

  public getSettings(): BarbershopSettingsRow {
    return this.data.settings;
  }

  public updateSettings(partial: Partial<BarbershopSettingsRow>): BarbershopSettingsRow {
    this.data.settings = {
      ...this.data.settings,
      ...partial,
      updatedAt: new Date().toISOString(),
    };
    this.save(this.data);
    return this.data.settings;
  }

  public toggleOpenStatus(): boolean {
    this.data.settings.isOpenOverride = !this.data.settings.isOpenOverride;
    this.data.settings.updatedAt = new Date().toISOString();
    this.save(this.data);
    return this.data.settings.isOpenOverride;
  }

  // --- MÉTODOS DE SERVIÇOS E PACOTES ---

  public getServices(onlyActive = true): ServiceRow[] {
    if (onlyActive) {
      return this.data.services.filter((s) => s.isActive);
    }
    return this.data.services;
  }

  public getPackages(onlyActive = true): PackageRow[] {
    if (onlyActive) {
      return this.data.packages.filter((p) => p.isActive);
    }
    return this.data.packages;
  }

  // --- MÉTODOS DE AVISOS ---

  public getActiveNotice(): NoticeRow | null {
    const active = this.data.notices.find((n) => n.isActive);
    return active || null;
  }

  // --- MÉTODOS DE LOG DE AUDITORIA ---

  public addAuditLog(action: string, details: string, userId?: string, userName?: string, ip?: string): void {
    const log: AuditLogRow = {
      id: 'log_' + Date.now(),
      action,
      details,
      userId,
      userName,
      ipAddress: ip,
      createdAt: new Date().toISOString(),
    };
    this.data.auditLogs.unshift(log);
    if (this.data.auditLogs.length > 500) {
      this.data.auditLogs = this.data.auditLogs.slice(0, 500);
    }
    this.save(this.data);
  }
}

export const db = new DatabaseEngine();

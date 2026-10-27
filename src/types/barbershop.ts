export interface ServiceItem {
  id: string;
  name: string;
  price: number;
  durationMinutes: number;
  description: string;
  tag?: string;
  isPopular?: boolean;
}

export interface PromoPackage {
  id: string;
  title: string;
  price: number;
  economy: string;
  description: string;
  benefits: string[];
  isFeatured?: boolean;
}

export interface NoticeData {
  id: string;                  // muda quando o barbeiro edita o aviso (reabre o pop-up para todos)
  title: string;
  message: string;
  validUntil?: string | null;  // "YYYY-MM-DD" ou vazio (sem validade)
  isActive: boolean;
  priority: 'normal' | 'urgent';
  updatedAt?: string | null;
}

export interface PixPayment {
  appointmentId: string;
  paymentId: string;
  amount: number;
  qrCode: string;       // código "Pix copia e cola"
  qrCodeImage: string;  // imagem do QR Code (data URL)
  secondsLeft: number;  // tempo restante da reserva do horário
}

export interface BarberProfile {
  name: string;
  role: string;
  experienceYears: number;
  bio: string;
  photoUrl: string;
  familyPhotoUrl: string;
  hobbyPhotoUrl: string;
}

export interface BusinessHours {
  day: string;
  hours: string;
  isOpen: boolean;
  closingHour: number;
}

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'client' | 'barber_admin';
}

export interface AppointmentRecord {
  id: string;
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


export interface RevenueSummary {
  monthKey: string; // "2026-10"
  month: { total: number; count: number; average: number };
  today: { date: string; total: number; count: number };
  toReceive: { total: number; count: number };
  refundsNeeded: { total: number; count: number };
  byMethod: Record<'pix' | 'in_person' | 'card', { total: number; count: number }>;
  days: { date: string; total: number; count: number }[];
}

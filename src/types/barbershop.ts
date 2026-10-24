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
  id: string;
  title: string;
  message: string;
  validUntil: string;
  isActive: boolean;
  priority: 'normal' | 'urgent';
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


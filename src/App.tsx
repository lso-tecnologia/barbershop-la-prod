/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { HeroSection } from './components/HeroSection';
import { BarberProfileSection } from './components/BarberProfileSection';
import { ServicesTable } from './components/ServicesTable';
import { GallerySection } from './components/GallerySection';
import { HoursAndLocation } from './components/HoursAndLocation';
import { Footer } from './components/Footer';
import { WhatsAppFloatingButton } from './components/WhatsAppFloatingButton';
import { NoticeModal } from './components/NoticeModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { BookingModal } from './components/BookingModal';
import { ClientAuthModal } from './components/ClientAuthModal';
import { MyAppointmentsModal } from './components/MyAppointmentsModal';
import { BarberAdminAuthModal } from './components/BarberAdminAuthModal';
import { AdminAgendaModal } from './components/AdminAgendaModal';
import { PrivacyPolicyModal } from './components/PrivacyPolicyModal';
import { ServiceItem, PromoPackage, BarberProfile, NoticeData, UserAccount, AppointmentRecord } from './types/barbershop';
import { api } from './services/api';
import { MobileBottomNav } from './components/MobileBottomNav';

export default function App() {
  // Status da Barbearia (Aberto/Fechado) - Controlável pelo barbeiro
  const [isOpen, setIsOpen] = useState(true);

  // Usuário Cliente Autenticado
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);

  // Estados dinâmicos para Serviços e Pacotes vindos do Banco / API
  const [services, setServices] = useState<ServiceItem[]>([
    {
      id: 'srv-corte',
      name: 'Corte Tradicional / Fade',
      price: 35.0,
      durationMinutes: 60,
      description: 'Corte moderno ou clássico com tesoura e máquina, degradê impecável e finalização.',
      isPopular: true,
    },
    {
      id: 'srv-barba',
      name: 'Barba Tradicional na Navalha',
      price: 35.0,
      durationMinutes: 60,
      description: 'Alinhamento preciso com navalha, óleo hidratante e loção pós-barba.',
      isPopular: true,
    },
    {
      id: 'srv-relaxamento',
      name: 'Relaxamento Capilar',
      price: 40.0,
      durationMinutes: 60,
      description: 'Tratamento para soltura de cachos e controle de volume com produtos seguros e nutritivos.',
    },
    {
      id: 'srv-sobrancelha',
      name: 'Sobrancelha na Navalha',
      price: 10.0,
      durationMinutes: 15,
      description: 'Design masculino e limpeza milimétrica na navalha para realçar o olhar.',
    },
    {
      id: 'srv-pezinho',
      name: 'Pezinho / Acabamento',
      price: 10.0,
      durationMinutes: 15,
      description: 'Limpeza de contorno de nuca e costeletas na navalha para manter o corte em dia.',
    },
    {
      id: 'srv-pacote-custom',
      name: 'Pacote Personalizado',
      price: 0.0,
      durationMinutes: 60,
      description: 'Combinações sob medida para eventos ou atendimentos especiais.',
    },
  ]);

  const [packages, setPackages] = useState<PromoPackage[]>([
    {
      id: 'pkg-1',
      title: 'Pacote 1 — Estilo Semanal',
      price: 130.0,
      economy: 'Economize R$ 50/mês',
      description: 'Plano perfeito para quem valoriza andar sempre no padrão da navalha.',
      benefits: [
        '4 cortes de cabelo por mês (1 por semana)',
        'Sobrancelha 1x por semana na navalha',
        'Prioridade na escolha de horários',
        'Acabamento e penteado inclusos',
      ],
      isFeatured: false,
    },
    {
      id: 'pkg-2',
      title: 'Pacote 2 — Combo Completo',
      price: 260.0,
      economy: 'Melhor Custo-Benefício',
      description: 'Cuidado total de cabelo e barba semana a semana com o barbeiro.',
      benefits: [
        '4 cortes de cabelo por mês',
        '4 barbas completas alinhadas na navalha por mês',
        'Sobrancelha 1x por semana na navalha',
        'Loção pós-barba e finalização inclusas',
        'Reserva fixa do seu dia e horário preferido',
      ],
      isFeatured: true,
    },
  ]);

  // Modais
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [selectedServiceItem, setSelectedServiceItem] = useState<ServiceItem | PromoPackage | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isMyAppointmentsOpen, setIsMyAppointmentsOpen] = useState(false);
  const [isBarberAdminModalOpen, setIsBarberAdminModalOpen] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [isAgendaOpen, setIsAgendaOpen] = useState(false);

  // Aviso (pop-up) escrito pelo barbeiro — vem do servidor
  const [notice, setNotice] = useState<NoticeData | null>(null);
  const loadNotice = () => {
    api.getActiveNotice().then(setNotice).catch(() => {});
  };

  // Carrega usuário salvo, configurações e dados do servidor ao iniciar
  useEffect(() => {
    // 1. Tenta validar sessão JWT via backend
    api.getMe().then((user) => {
      if (user) {
        setCurrentUser(user);
        localStorage.setItem('barbershop_logged_client', JSON.stringify(user));
      } else {
        const savedUser = localStorage.getItem('barbershop_logged_client');
        if (savedUser) setCurrentUser(JSON.parse(savedUser));
      }
    }).catch(() => {
      const savedUser = localStorage.getItem('barbershop_logged_client');
      if (savedUser) setCurrentUser(JSON.parse(savedUser));
    });

    // Aviso (pop-up) editável pelo barbeiro
    loadNotice();

    // 2. Carrega configurações do banco de dados (status Aberta/Fechada)
    api.getSettings().then((settings) => {
      if (settings && typeof settings.isOpenOverride === 'boolean') {
        setIsOpen(settings.isOpenOverride);
      }
    }).catch(() => {});

   // Busca os serviços dinâmicos do backend (/api/services)
    fetch('/api/services', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          // Normaliza os campos para garantir que o name e price venham numéricos e válidos
          const formattedServices = data.map((item) => ({
            ...item,
            name: item.name || item.title || 'Serviço',
            price: Number(item.price || 0),
            durationMinutes: Number(item.durationMinutes || item.duration_minutes || 60),
          }));
          setServices(formattedServices);
        }
      })
      .catch((err) => console.error('Erro ao buscar serviços do servidor:', err));

    // 4. Busca os pacotes promocionais dinâmicos do backend (/api/packages)
    fetch('/api/packages', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          // Garante tipos corretos (preço numérico, lista de benefícios) mesmo se o servidor mudar
          setPackages(
            data.map((p: any) => ({
              id: String(p.id),
              title: String(p.title || p.name || 'Pacote'),
              price: Number(p.price ?? (Number(p.priceCents ?? 0) / 100)) || 0,
              economy: String(p.economy ?? p.economyText ?? ''),
              description: String(p.description ?? ''),
              benefits: Array.isArray(p.benefits) ? p.benefits.map(String) : [],
              isFeatured: !!p.isFeatured,
            }))
          );
        }
      })
      .catch((err) => console.error('Erro ao buscar pacotes do servidor:', err));
  }, []);

  // Perfil Oficial do Leonardo Arruda
  const barberProfile: BarberProfile = {
    name: 'Leonardo Arruda',
    role: 'Fundador & Master Barber',
    experienceYears: 8,
    bio: 'Há 8 anos transformo a autoestima dos meus clientes com a tesoura e a navalha na mão — uma paixão que só cresce com o tempo. Minha maior motivação para dar o meu melhor todos os dias é o meu filho, a razão de tudo o que construo. Nas horas vagas, meu refúgio é a garagem: apaixonado por carros, gosto de passar o tempo mexendo no meu projeto e montando som de qualidade. Seja bem-vindo à cadeira!',
    photoUrl: '/assets/aistudio/WhatsApp_Image_2026-10-24_at_16.19.02_2143161f.jpeg',
    familyPhotoUrl: '/assets/aistudio/WhatsApp_Image_2026-10-24_at_16.18.59_0a69f0f9.jpeg',
    hobbyPhotoUrl: '/assets/aistudio/WhatsApp_Image_2026-10-24_at_16.18.59__1__7126c5b1.jpeg',
  };

  const handleSelectService = (item: ServiceItem | PromoPackage) => {
    setSelectedServiceItem(item);
    setIsBookingModalOpen(true);
  };

  const handleToggleDemoStatus = async () => {
    try {
      if (currentUser?.role === 'barber_admin') {
        const res = await api.toggleOpenStatus();
        setIsOpen(res.isOpen);
      } else {
        setIsOpen((prev) => !prev);
      }
    } catch {
      setIsOpen((prev) => !prev);
    }
  };

  const handleLogout = () => {
    api.logout();
    localStorage.removeItem('barbershop_logged_client');
    setCurrentUser(null);
  };

  return (
    <div className="min-h-screen bg-[#080808] text-neutral-100 flex flex-col pb-20 md:pb-0 selection:bg-amber-500 selection:text-black">
      {/* Indicador de Conexão Offline */}
      <OfflineIndicator />

      {/* Pop-up de Aviso Ativo */}
      <NoticeModal notice={notice} />

      {/* Header Fixo */}
      <Header
        isOpen={isOpen}
        currentUser={currentUser}
        onToggleDemoStatus={handleToggleDemoStatus}
        onOpenBookingModal={() => {
          setSelectedServiceItem(null);
          setIsBookingModalOpen(true);
        }}
        onOpenLoginModal={() => setIsAuthModalOpen(true)}
        onOpenMyAppointments={() => setIsMyAppointmentsOpen(true)}
      />

      {/* Conteúdo Principal */}
      <main className="flex-1">
        {/* Hero Section com Fotos e Botões */}
        <HeroSection
          isOpen={isOpen}
          onToggleDemoStatus={handleToggleDemoStatus}
          onBookNow={() => {
            setSelectedServiceItem(null);
            setIsBookingModalOpen(true);
          }}
        />

        {/* Tabela de Serviços e Promoções (Consumindo do Banco/API) */}
        <ServicesTable
          services={services}
          packages={packages}
          onSelectService={handleSelectService}
        />

        {/* Perfil do Barbeiro Leonardo Arruda com Fotos Reais */}
        <BarberProfileSection profile={barberProfile} />

        {/* Galeria de Fotos Reais de Cortes e Espaço */}
        <GallerySection />

        {/* Horários de Atendimento & Localização (Ter-Sáb 19h, Dom 14h) */}
        <HoursAndLocation />
      </main>

      {/* Rodapé Completo */}
      <Footer
        onOpenBarberLogin={() => setIsBarberAdminModalOpen(true)}
        onOpenPrivacyModal={() => setIsPrivacyModalOpen(true)}
      />

      {/* Botão Fixo do WhatsApp em Todas as Telas */}
      <WhatsAppFloatingButton />

      {/* Barra de navegação inferior (celular): Agendar, Meus horários, Conta */}
      <MobileBottomNav
        currentUser={currentUser}
        onBook={() => {
          setSelectedServiceItem(null);
          setIsBookingModalOpen(true);
        }}
        onMyAppointments={() => setIsMyAppointmentsOpen(true)}
        onAccount={() => setIsAuthModalOpen(true)}
      />

      {/* Modal de Agendamento Completo com Escolha de Serviços */}
      <BookingModal
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        selectedItem={selectedServiceItem}
        services={services}
        packages={packages}
        currentUser={currentUser}
        onOpenAuthModal={() => {
          setIsBookingModalOpen(false);
          setIsAuthModalOpen(true);
        }}
        onBookingConfirmed={(apt) => {
          // Agendamento registrado
        }}
      />

      {/* Modal de Autenticação / Cadastro do Cliente */}
      <ClientAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUser={currentUser}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
        }}
        onLogout={handleLogout}
      />

      {/* Modal de Meus Agendamentos com Regra de Cancelamento até 2h */}
      <MyAppointmentsModal
        isOpen={isMyAppointmentsOpen}
        onClose={() => setIsMyAppointmentsOpen(false)}
        onNewBookingClick={() => {
          setSelectedServiceItem(null);
          setIsBookingModalOpen(true);
        }}
        currentUser={currentUser}
        onOpenLoginModal={() => {
          setIsMyAppointmentsOpen(false);
          setIsAuthModalOpen(true);
        }}
      />

      {/* Modal de Acesso Administrativo com 2FA */}
      <BarberAdminAuthModal
        isOpen={isBarberAdminModalOpen}
        onClose={() => setIsBarberAdminModalOpen(false)}
        currentUser={currentUser}
        onLoginSuccess={(adminUser) => {
          setCurrentUser(adminUser);
        }}
        onToggleShopStatus={() => {
          setIsOpen((prev) => !prev);
        }}
        isOpenStatus={isOpen}
        onNoticeSaved={loadNotice}
        onOpenAgenda={() => {
          setIsBarberAdminModalOpen(false);
          setIsAgendaOpen(true);
        }}
      />

      {/* Agenda do Barbeiro (somente admin autenticado; a API também valida) */}
      <AdminAgendaModal isOpen={isAgendaOpen && currentUser?.role === 'barber_admin'} onClose={() => setIsAgendaOpen(false)} />

      {/* Modal de Privacidade e LGPD */}
      <PrivacyPolicyModal
        isOpen={isPrivacyModalOpen}
        onClose={() => setIsPrivacyModalOpen(false)}
      />
    </div>
  );
}
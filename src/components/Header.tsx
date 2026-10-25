import React, { useState } from 'react';
import { Scissors, Menu, X, Calendar, User, Clock, BookmarkCheck } from 'lucide-react';
import { OpenStatusBadge } from './OpenStatusBadge';
import { PWAInstallButton } from './PWAInstallButton';
import { UserAccount } from '../types/barbershop';

interface HeaderProps {
  isOpen: boolean;
  currentUser: UserAccount | null;
  onToggleDemoStatus?: () => void;
  onOpenBookingModal?: () => void;
  onOpenLoginModal?: () => void;
  onOpenMyAppointments?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isOpen,
  currentUser,
  onToggleDemoStatus,
  onOpenBookingModal,
  onOpenLoginModal,
  onOpenMyAppointments,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Verifica se o usuário atual é o administrador autenticado
  const isAdmin = !!(currentUser && currentUser.role === 'barber_admin');

  return (
    <header className="sticky top-0 z-40 w-full border-b border-neutral-900 bg-[#0a0a0a]/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-2 sm:gap-4">
        {/* Logo / Marca */}
        <a href="#" className="flex items-center gap-2 sm:gap-3 group shrink-0 min-w-0">
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-[#242424] to-[#0d0d0d] border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-950/30 group-hover:border-amber-400 transition-colors shrink-0">
            <Scissors className="w-4 h-4 sm:w-6 sm:h-6 text-amber-400 transform -rotate-45" />
          </div>
          <div className="min-w-0">
            <span className="font-display text-sm sm:text-xl font-black tracking-wider text-white group-hover:text-amber-200 transition-colors truncate block">
              BARBERSHOP <span className="text-gold-gradient">L.A</span>
            </span>
            <span className="block text-[8px] sm:text-[10px] tracking-widest uppercase font-semibold text-neutral-400">
              Barueri • SP
            </span>
          </div>
        </a>

        {/* Status Aberta / Fechada no centro (Desktop) - Só mostra botão se for Admin */}
        <div className="hidden md:flex items-center">
          <OpenStatusBadge
            isOpen={isOpen}
            onToggleDemo={onToggleDemoStatus}
            showAdminToggle={isAdmin}
          />
        </div>

        {/* Links de Navegação Desktop */}
        <nav className="hidden lg:flex items-center gap-6 text-xs uppercase tracking-wider font-semibold text-neutral-300">
          <a href="#servicos" className="hover:text-amber-400 transition-colors">
            Serviços
          </a>
          <a href="#promocoes" className="hover:text-amber-400 transition-colors">
            Pacotes
          </a>
          <a href="#sobre" className="hover:text-amber-400 transition-colors">
            O Barbeiro
          </a>
          <a href="#galeria" className="hover:text-amber-400 transition-colors">
            Galeria
          </a>
          <a href="#localizacao" className="hover:text-amber-400 transition-colors">
            Localização
          </a>
        </nav>

        {/* Ações: Agendamentos + Usuário + Agendar + Menu (Totalmente responsivo para celular) */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          <div className="hidden sm:block">
            <PWAInstallButton compact={true} />
          </div>

          {/* Botão Meus Agendamentos (Sempre visível no celular e no desktop) */}
          <button
            onClick={onOpenMyAppointments}
            title="Ver meus horários agendados ou cancelar"
            className="inline-flex items-center gap-1 rounded-xl border border-amber-500/40 bg-amber-500/10 px-2 sm:px-3 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-500/20 transition-all shrink-0 active:scale-95 shadow-sm"
          >
            <BookmarkCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="hidden md:inline">Agendamentos</span>
            <span className="md:hidden text-[11px]">Agenda</span>
          </button>

          {/* Botão do Usuário / Entrar */}
          {currentUser ? (
            <button
              onClick={onOpenLoginModal}
              title={currentUser.name}
              className="inline-flex items-center gap-1 rounded-xl border border-neutral-800 bg-neutral-900 px-2 sm:px-2.5 py-1.5 text-xs font-semibold text-neutral-200 hover:border-amber-500/40 transition-colors shrink-0"
            >
              <User className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="hidden sm:inline max-w-[80px] truncate">{currentUser.name.split(' ')[0]}</span>
            </button>
          ) : (
            <button
              onClick={onOpenLoginModal}
              title="Entrar ou criar conta"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-xs font-semibold text-neutral-300 hover:border-amber-500/40 hover:text-white transition-colors shrink-0"
            >
              <User className="w-3.5 h-3.5 text-amber-400" />
              <span>Entrar</span>
            </button>
          )}

          {/* Botão Agendar Principal */}
          <button
            onClick={onOpenBookingModal}
            className="inline-flex items-center gap-1 sm:gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-2.5 sm:px-4 py-1.5 sm:py-2 text-[11px] sm:text-xs font-black uppercase tracking-wider text-black shadow-md shadow-amber-950/40 hover:brightness-110 active:scale-95 transition-all shrink-0"
          >
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span>Agendar</span>
          </button>

          {/* Botão Menu Mobile */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden rounded-xl border border-neutral-800 bg-neutral-900 p-2 text-neutral-300 hover:text-white shrink-0"
            aria-label="Abrir menu de navegação"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Drawer Mobile */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-neutral-900 bg-[#0d0d0d] px-4 py-5 space-y-4 animate-fade-in shadow-2xl">
          <div className="flex justify-center pb-1">
            <OpenStatusBadge
              isOpen={isOpen}
              onToggleDemo={onToggleDemoStatus}
              showAdminToggle={isAdmin}
            />
          </div>

          {/* Card Destaque: Meus Agendamentos no Menu Mobile */}
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              if (onOpenMyAppointments) onOpenMyAppointments();
            }}
            className="w-full rounded-2xl border-2 border-amber-500/60 bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent p-3.5 text-left flex items-center justify-between group shadow-lg active:scale-98 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400 shrink-0">
                <BookmarkCheck className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <span className="block text-xs font-black uppercase tracking-wider text-white group-hover:text-amber-300">
                  Meus Agendamentos
                </span>
                <span className="block text-[11px] text-neutral-400">
                  Consultar ou cancelar seus horários
                </span>
              </div>
            </div>
            <span className="text-xs font-bold text-amber-400">Abrir →</span>
          </button>

          <div className="grid grid-cols-2 gap-2 text-xs font-bold uppercase tracking-wider text-neutral-300">
            <a
              href="#servicos"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-lg bg-neutral-900 p-3 text-center hover:bg-neutral-800 hover:text-amber-400"
            >
              Serviços
            </a>
            <a
              href="#promocoes"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-lg bg-neutral-900 p-3 text-center hover:bg-neutral-800 hover:text-amber-400"
            >
              Pacotes
            </a>
            <a
              href="#sobre"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-lg bg-neutral-900 p-3 text-center hover:bg-neutral-800 hover:text-amber-400"
            >
              O Barbeiro
            </a>
            <a
              href="#galeria"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-lg bg-neutral-900 p-3 text-center hover:bg-neutral-800 hover:text-amber-400"
            >
              Galeria
            </a>
            <a
              href="#localizacao"
              onClick={() => setMobileMenuOpen(false)}
              className="col-span-2 rounded-lg bg-neutral-900 p-3 text-center hover:bg-neutral-800 hover:text-amber-400"
            >
              Horário & Localização
            </a>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  if (onOpenLoginModal) onOpenLoginModal();
                }}
                className="flex-1 rounded-xl border border-neutral-800 bg-neutral-900 py-2.5 text-xs font-bold text-neutral-200 uppercase tracking-wider flex items-center justify-center gap-1.5"
              >
                <User className="w-3.5 h-3.5 text-amber-400" />
                <span>{currentUser ? currentUser.name.split(' ')[0] : 'Entrar / Cadastro'}</span>
              </button>

              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  if (onOpenMyAppointments) onOpenMyAppointments();
                }}
                className="flex-1 rounded-xl border border-amber-500/40 bg-amber-500/10 py-2.5 text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center justify-center gap-1.5"
              >
                <BookmarkCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>Agendamentos</span>
              </button>
            </div>

            <button
              onClick={() => {
                setMobileMenuOpen(false);
                if (onOpenBookingModal) onOpenBookingModal();
              }}
              className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 py-3 text-xs font-black text-black uppercase tracking-wider shadow-lg active:scale-98 transition-all"
            >
              Agendar Horário Agora
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
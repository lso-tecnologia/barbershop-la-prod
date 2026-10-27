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
  const isAdmin = currentUser && currentUser.role === 'barber_admin';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-neutral-900 bg-[#0a0a0a]/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-2 sm:gap-4">
        {/* Logo / Marca */}
        <a href="#" className="flex min-w-0 items-center gap-2.5 sm:gap-3 group">
          <div className="w-10 h-10 sm:w-11 sm:h-11 shrink-0 rounded-xl bg-gradient-to-br from-[#242424] to-[#0d0d0d] border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-950/30 group-hover:border-amber-400 transition-colors">
            <Scissors className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400 transform -rotate-45" />
          </div>
          <div className="min-w-0">
            <span className="block truncate font-display text-[15px] sm:text-xl font-black tracking-wider text-white group-hover:text-amber-200 transition-colors">
              BARBERSHOP <span className="text-gold-gradient">L.A</span>
            </span>
            <span className="block text-[9px] sm:text-[10px] tracking-widest uppercase font-semibold text-neutral-400">
              Barueri • SP
            </span>
          </div>
        </a>

        {/* Status Aberta / Fechada no centro (Desktop) - Só mostra botão se for Admin */}
        <div className="hidden md:flex items-center">
          <OpenStatusBadge
            isOpen={isOpen}
            onToggleDemo={onToggleDemoStatus}
            showAdminToggle={!!isAdmin}
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

        {/* Ações: PWA Install + Meus Agendamentos + Entrar / Perfil + Agendar */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <div className="hidden sm:block">
            <PWAInstallButton compact={true} />
          </div>

          {/* Botão Meus Agendamentos */}
          <button
            onClick={onOpenMyAppointments}
            title="Ver meus horários agendados"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-neutral-300 hover:border-amber-500/40 hover:text-white transition-colors"
          >
            <BookmarkCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>Agendamentos</span>
          </button>

          {/* Botão do Usuário / Entrar */}
          {currentUser ? (
            <button
              onClick={onOpenLoginModal}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 transition-colors"
            >
              <User className="w-3.5 h-3.5" />
              <span className="max-w-[90px] truncate">{currentUser.name.split(' ')[0]}</span>
            </button>
          ) : (
            <button
              onClick={onOpenLoginModal}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-neutral-300 hover:border-amber-500/40 hover:text-white transition-colors"
            >
              <User className="w-3.5 h-3.5 text-amber-400" />
              <span>Entrar</span>
            </button>
          )}

          {/* Botão Agendar Principal */}
          <button
            onClick={onOpenBookingModal}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-3.5 sm:px-4 py-2 text-xs font-black uppercase tracking-wider text-black shadow-lg shadow-amber-950/40 hover:brightness-110 active:scale-95 transition-all"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Agendar</span>
          </button>

          {/* Botão Menu Mobile */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden shrink-0 rounded-xl border border-neutral-800 bg-neutral-900 p-2.5 text-neutral-300 hover:text-white"
            aria-label="Abrir menu de navegação"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Drawer Mobile */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-neutral-900 bg-[#0d0d0d] px-4 py-5 space-y-4 animate-fade-in">
          <div className="flex justify-center pb-2">
            <OpenStatusBadge
              isOpen={isOpen}
              onToggleDemo={onToggleDemoStatus}
              showAdminToggle={!!isAdmin}
            />
          </div>

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
            <div className="flex justify-center sm:hidden">
              <PWAInstallButton compact={true} />
            </div>
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
                className="flex-1 rounded-xl border border-neutral-800 bg-neutral-900 py-2.5 text-xs font-bold text-neutral-200 uppercase tracking-wider flex items-center justify-center gap-1.5"
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
              className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 py-3 text-xs font-black text-black uppercase tracking-wider shadow-lg"
            >
              Agendar Horário Agora
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
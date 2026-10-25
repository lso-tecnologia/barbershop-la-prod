import React from 'react';
import { Calendar, BookmarkCheck, Scissors, User } from 'lucide-react';
import { UserAccount } from '../types/barbershop';

interface MobileBottomNavProps {
  currentUser: UserAccount | null;
  onOpenBookingModal: () => void;
  onOpenMyAppointments: () => void;
  onOpenLoginModal: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentUser,
  onOpenBookingModal,
  onOpenMyAppointments,
  onOpenLoginModal,
}) => {
  return (
    <nav
      aria-label="Navegação rápida no celular"
      className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0d0d0d]/95 backdrop-blur-xl border-t border-neutral-800 shadow-2xl px-2 py-1.5 pb-safe"
    >
      <div className="grid grid-cols-4 items-center gap-1 max-w-md mx-auto">
        {/* Botão 1: Agendar */}
        <button
          onClick={onOpenBookingModal}
          className="flex flex-col items-center justify-center py-1.5 px-1 rounded-xl text-amber-400 hover:bg-neutral-900 active:scale-95 transition-all group"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 flex items-center justify-center text-black shadow-md shadow-amber-950/40 group-hover:brightness-110">
            <Calendar className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 mt-1">
            Agendar
          </span>
        </button>

        {/* Botão 2: Meus Agendamentos (Checar / Cancelar) - Destaque */}
        <button
          onClick={onOpenMyAppointments}
          className="flex flex-col items-center justify-center py-1.5 px-1 rounded-xl text-neutral-300 hover:text-amber-300 hover:bg-neutral-900 active:scale-95 transition-all group relative"
        >
          <div className="w-8 h-8 rounded-lg border border-amber-500/50 bg-amber-500/15 flex items-center justify-center text-amber-400 shadow-sm group-hover:border-amber-400">
            <BookmarkCheck className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-bold tracking-tight text-neutral-200 mt-1 flex items-center gap-0.5">
            Agendados
          </span>
        </button>

        {/* Botão 3: Tabela de Serviços */}
        <a
          href="#servicos"
          className="flex flex-col items-center justify-center py-1.5 px-1 rounded-xl text-neutral-400 hover:text-amber-400 hover:bg-neutral-900 active:scale-95 transition-all"
        >
          <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-300">
            <Scissors className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-medium tracking-tight text-neutral-300 mt-1">
            Serviços
          </span>
        </a>

        {/* Botão 4: Conta / Entrar */}
        <button
          onClick={onOpenLoginModal}
          className="flex flex-col items-center justify-center py-1.5 px-1 rounded-xl text-neutral-400 hover:text-amber-400 hover:bg-neutral-900 active:scale-95 transition-all"
        >
          <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-300">
            <User className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-medium tracking-tight text-neutral-300 mt-1 truncate max-w-[65px]">
            {currentUser ? currentUser.name.split(' ')[0] : 'Entrar'}
          </span>
        </button>
      </div>
    </nav>
  );
};

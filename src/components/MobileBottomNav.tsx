import React from 'react';
import { Calendar, BookmarkCheck, User } from 'lucide-react';
import { UserAccount } from '../types/barbershop';

interface MobileBottomNavProps {
  currentUser: UserAccount | null;
  onBook: () => void;
  onMyAppointments: () => void;
  onAccount: () => void;
}

/**
 * Barra fixa na parte de baixo da tela, só no celular (some em telas >= md).
 * Deixa "Agendar", "Meus agendamentos" e "Conta" sempre ao alcance do polegar.
 */
export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ currentUser, onBook, onMyAppointments, onAccount }) => {
  const item =
    'flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-bold uppercase tracking-wide text-neutral-300 active:bg-neutral-900';

  return (
    <nav
      aria-label="Navegação principal"
      className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-neutral-800 bg-[#0d0d0d]/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto flex max-w-md items-stretch">
        <button onClick={onMyAppointments} className={item}>
          <BookmarkCheck className="h-5 w-5 text-amber-400" />
          <span>Meus horários</span>
        </button>

        <button onClick={onBook} className="flex flex-1 items-center justify-center py-1.5" aria-label="Agendar horário">
          <span className="flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-black shadow-lg shadow-amber-950/40">
            <Calendar className="h-4 w-4" />
            Agendar
          </span>
        </button>

        <button onClick={onAccount} className={item}>
          <User className="h-5 w-5 text-amber-400" />
          <span className="max-w-[80px] truncate">{currentUser ? currentUser.name.split(' ')[0] : 'Entrar'}</span>
        </button>
      </div>
    </nav>
  );
};

import React, { useState, useEffect } from 'react';
import { Bell, X, Calendar, AlertCircle } from 'lucide-react';
import { NoticeData } from '../types/barbershop';

interface NoticeModalProps {
  notice: NoticeData | null;
  onDismiss?: () => void;
}

export const NoticeModal: React.FC<NoticeModalProps> = ({ notice }) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!notice || !notice.isActive) {
      setIsOpen(false);
      return;
    }

    const dismissedId = localStorage.getItem('barbershop_dismissed_notice_id');
    if (dismissedId !== notice.id) {
      // Pequeno delay para animação de entrada fluida após carregar a página
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [notice]);

  const handleClose = () => {
    if (notice) {
      localStorage.setItem('barbershop_dismissed_notice_id', notice.id);
    }
    setIsOpen(false);
  };

  if (!notice || !isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md rounded-2xl border border-amber-500/40 bg-[#121212] p-6 shadow-2xl shadow-amber-950/40 text-neutral-100">
        {/* Glow de fundo */}
        <div className="absolute -top-12 -left-12 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

        <button
          onClick={handleClose}
          className="absolute top-4 right-4 rounded-xl p-1.5 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white"
          aria-label="Fechar comunicado"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3.5 mb-4">
          <div className="w-11 h-11 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
            <Bell className="w-5 h-5 animate-bounce" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
              Comunicado Oficial • BARBERSHOP L.A
            </span>
            <h3 className="font-display text-lg font-bold text-white tracking-wide">
              {notice.title}
            </h3>
          </div>
        </div>

        <div className="rounded-xl bg-neutral-900/90 border border-neutral-800 p-4 text-xs sm:text-sm text-neutral-300 leading-relaxed mb-5">
          {notice.message}
        </div>

        <div className="flex items-center justify-between text-[11px] text-neutral-400 border-t border-neutral-800/80 pt-3.5">
          <div className="flex items-center gap-1.5 text-amber-300/80">
            <Calendar className="w-3.5 h-3.5" />
            <span>Válido até: {notice.validUntil}</span>
          </div>

          <button
            onClick={handleClose}
            className="rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 font-bold text-black text-xs uppercase tracking-wider transition-transform active:scale-95 hover:brightness-110"
          >
            Entendi, obrigado
          </button>
        </div>
      </div>
    </div>
  );
};

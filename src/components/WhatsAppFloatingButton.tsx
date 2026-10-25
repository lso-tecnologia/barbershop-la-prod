import React from 'react';
import { MessageCircle } from 'lucide-react';

export const WhatsAppFloatingButton: React.FC = () => {
  const whatsappUrl =
    'https://wa.me/5511981154340?text=' +
    encodeURIComponent('Olá, vim pelo app da BARBERSHOP L.A');

  return (
    <aside aria-label="Atendimento via WhatsApp" className="fixed bottom-20 sm:bottom-6 right-3 sm:right-5 z-30">
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="group relative flex items-center gap-2.5 rounded-full bg-emerald-600 px-4 py-3 text-white shadow-2xl shadow-emerald-950/60 transition-all duration-300 hover:bg-emerald-500 hover:scale-105 active:scale-95 border border-emerald-400/40"
      >
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-200"></span>
        </span>
        <MessageCircle className="w-5 h-5 fill-white text-emerald-600" />
        <span className="hidden sm:inline font-semibold text-xs tracking-wide">
          Falar com o barbeiro no WhatsApp
        </span>
        <span className="sm:hidden font-bold text-xs tracking-wide">
          WhatsApp
        </span>
      </a>
    </aside>
  );
};

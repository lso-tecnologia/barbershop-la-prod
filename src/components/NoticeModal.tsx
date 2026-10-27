import React, { useState, useEffect } from 'react';
import { Bell, X, Calendar } from 'lucide-react';
import { NoticeData } from '../types/barbershop';

// "2026-10-31" -> "31/10/2026" (aceita também "31/10/2026")
export const formatNoticeDate = (v?: string | null): string => {
  const s = String(v ?? '').trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
};

interface NoticeCardProps {
  title: string;
  message: string;
  validUntil?: string | null;
  onClose?: () => void;
  /** Pré-visualização no painel do barbeiro: sem animação e sem botão de fechar fixo */
  preview?: boolean;
}

/** Aparência do aviso (usada no pop-up dos clientes e na pré-visualização do barbeiro) */
export const NoticeCard: React.FC<NoticeCardProps> = ({ title, message, validUntil, onClose, preview }) => {
  const until = formatNoticeDate(validUntil);
  return (
    <div className="relative w-full max-w-md rounded-2xl border border-amber-500/40 bg-[#121212] p-6 shadow-2xl shadow-amber-950/40 text-neutral-100">
      {/* Glow de fundo */}
      <div className="absolute -top-12 -left-12 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

      {!preview && onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 rounded-xl p-1.5 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white"
          aria-label="Fechar comunicado"
        >
          <X className="w-5 h-5" />
        </button>
      )}

      <div className="flex items-center gap-3.5 mb-4 pr-8">
        <div className="w-11 h-11 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
          <Bell className={`w-5 h-5 ${preview ? '' : 'animate-bounce'}`} />
        </div>
        <div className="min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
            Comunicado Oficial • BARBERSHOP L.A
          </span>
          <h3 className="font-display text-lg font-bold text-white tracking-wide break-words">
            {title || 'Título do aviso'}
          </h3>
        </div>
      </div>

      <div className="rounded-xl bg-neutral-900/90 border border-neutral-800 p-4 text-xs sm:text-sm text-neutral-300 leading-relaxed mb-5 whitespace-pre-line break-words">
        {message || 'A mensagem do aviso aparece aqui.'}
      </div>

      <div className="flex items-center justify-between gap-3 text-[11px] text-neutral-400 border-t border-neutral-800/80 pt-3.5">
        <div className="flex items-center gap-1.5 text-amber-300/80">
          {until && (
            <>
              <Calendar className="w-3.5 h-3.5" />
              <span>Válido até: {until}</span>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 font-bold text-black text-xs uppercase tracking-wider transition-transform active:scale-95 hover:brightness-110"
        >
          Entendi, obrigado
        </button>
      </div>
    </div>
  );
};

// localStorage pode falhar (modo privado, dados bloqueados): nunca deixar isso quebrar o app
const readDismissed = (): string | null => {
  try { return localStorage.getItem('barbershop_dismissed_notice_id'); } catch { return null; }
};
const saveDismissed = (id: string) => {
  try { localStorage.setItem('barbershop_dismissed_notice_id', id); } catch { /* ignora */ }
};

interface NoticeModalProps {
  /** Aviso vindo do servidor (editado pelo barbeiro). null = nenhum aviso. */
  notice: NoticeData | null;
}

export const NoticeModal: React.FC<NoticeModalProps> = ({ notice }) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!notice || !notice.isActive) {
      setIsOpen(false);
      return;
    }
    // Cada vez que o barbeiro salva o aviso, o id muda e o pop-up volta a aparecer
    if (readDismissed() !== notice.id) {
      // Pequeno delay para a animação de entrada ficar fluida após carregar a página
      const timer = setTimeout(() => setIsOpen(true), 700);
      return () => clearTimeout(timer);
    }
  }, [notice]);

  const handleClose = () => {
    if (notice) saveDismissed(notice.id);
    setIsOpen(false);
  };

  if (!notice || !isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <NoticeCard title={notice.title} message={notice.message} validUntil={notice.validUntil} onClose={handleClose} />
    </div>
  );
};

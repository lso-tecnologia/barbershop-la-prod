import React, { useEffect, useRef, useState } from 'react';
import { Copy, Check, Loader2, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import { PixPayment } from '../types/barbershop';

interface PixPaymentPanelProps {
  appointmentId: string;
  itemName: string;
  /** Chamado quando o pagamento é confirmado */
  onPaid: () => void;
  /** Chamado quando a reserva expira / é cancelada sem pagamento */
  onExpired?: () => void;
  /** Fecha o painel mantendo a reserva (o cliente pode pagar depois em "Meus horários") */
  onClose?: () => void;
}

const fmtMoney = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;
const fmtClock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

// Copia texto (funciona também em navegadores sem a API moderna / sem HTTPS)
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* cai no plano B */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/**
 * Pix dentro do app: mostra o QR Code e o "copia e cola" e aguarda a confirmação do pagamento.
 * Usado no agendamento (BookingModal) e em "Meus horários" (botão "Pagar agora").
 */
export const PixPaymentPanel: React.FC<PixPaymentPanelProps> = ({ appointmentId, itemName, onPaid, onExpired, onClose }) => {
  const [pix, setPix] = useState<PixPayment | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  const [expired, setExpired] = useState(false);
  const doneRef = useRef(false);
  const codeRef = useRef<HTMLTextAreaElement>(null);

  const finishPaid = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onPaid();
  };

  const finishExpired = () => {
    if (doneRef.current) return;
    setExpired(true);
    onExpired?.();
  };

  // 1) Gera / recupera o Pix
  const load = () => {
    setLoading(true);
    setError('');
    api
      .createPix(appointmentId)
      .then((p) => {
        setPix(p);
        setSecondsLeft(p.secondsLeft);
      })
      .catch((err: any) => setError(err.message || 'Não foi possível gerar o Pix.'))
      .finally(() => setLoading(false));
  };
  useEffect(load, [appointmentId]);

  // 2) Contagem regressiva da reserva
  useEffect(() => {
    if (!pix || expired) return;
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [pix, expired]);

  useEffect(() => {
    if (pix && secondsLeft === 0 && !expired && !doneRef.current) {
      // Antes de dar por expirado, confere uma última vez se o pagamento não entrou
      void check(true);
    }
  }, [secondsLeft, pix]);

  // 3) Consulta se já foi pago (a cada 4s, e ao voltar do app do banco)
  const check = async (final = false) => {
    if (doneRef.current) return;
    try {
      const st = await api.getPaymentStatus(appointmentId);
      if (st.paymentStatus === 'paid') return finishPaid();
      if (st.status === 'cancelled' || final) return finishExpired();
    } catch { /* tenta de novo no próximo ciclo */ }
  };

  useEffect(() => {
    if (!pix || expired) return;
    const t = setInterval(() => void check(), 4000);
    const onVisible = () => { if (document.visibilityState === 'visible') void check(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [pix, expired]);

  const handleCopy = async () => {
    if (!pix) return;
    const ok = await copyText(pix.qrCode);
    if (!ok) {
      // Último recurso: seleciona o texto para o cliente copiar manualmente
      codeRef.current?.focus();
      codeRef.current?.select();
    }
    setCopied(ok);
    if (ok) setTimeout(() => setCopied(false), 2500);
  };

  const handleManualCheck = async () => {
    setChecking(true);
    await check();
    setChecking(false);
  };

  if (loading) {
    return (
      <div className="py-10 text-center space-y-3">
        <Loader2 className="w-9 h-9 mx-auto animate-spin text-amber-400" />
        <p className="text-xs text-neutral-300">Gerando seu Pix...</p>
      </div>
    );
  }

  if (error || !pix) {
    return (
      <div className="space-y-4 py-2">
        <div className="rounded-xl bg-rose-950/50 border border-rose-800/60 p-3 text-xs text-rose-300 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
          <span>{error || 'Não foi possível gerar o Pix.'}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 py-3 text-xs font-black uppercase text-black">
            <RefreshCw className="w-4 h-4" /> Tentar de novo
          </button>
          {onClose && (
            <button onClick={onClose} className="flex-1 rounded-xl border border-neutral-800 bg-neutral-900 py-3 text-xs font-bold uppercase text-neutral-300 hover:bg-neutral-800">
              Fechar
            </button>
          )}
        </div>
      </div>
    );
  }

  if (expired) {
    return (
      <div className="space-y-4 py-4 text-center">
        <Clock className="w-12 h-12 mx-auto text-rose-400" />
        <h4 className="font-display text-base font-bold text-white">Tempo esgotado</h4>
        <p className="text-xs text-neutral-300">
          A reserva deste horário expirou antes do pagamento. Se você acabou de pagar, aguarde um instante e confira em <strong>Meus horários</strong>; caso contrário, faça um novo agendamento.
        </p>
        {onClose && (
          <button onClick={onClose} className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 py-3 text-xs font-black uppercase text-black">
            Entendi
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Pague com Pix</p>
        <p className="font-display text-2xl font-black text-amber-400 mt-1">{fmtMoney(pix.amount)}</p>
        <p className="text-[11px] text-neutral-400 mt-0.5">{itemName}</p>
      </div>

      {/* QR Code */}
      <div className="mx-auto w-52 h-52 rounded-2xl bg-white p-2.5 shadow-lg">
        <img src={pix.qrCodeImage} alt="QR Code Pix" className="w-full h-full" />
      </div>
      <p className="text-center text-[11px] text-neutral-400">Escaneie com o app do seu banco <span className="text-neutral-500">ou</span> use o código abaixo</p>

      {/* Copia e cola */}
      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Pix copia e cola</label>
        <textarea
          ref={codeRef}
          readOnly
          value={pix.qrCode}
          rows={3}
          onFocus={(e) => e.currentTarget.select()}
          className="w-full resize-none rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono text-[11px] leading-snug text-neutral-200 outline-none focus:border-amber-500 break-all"
        />
        <button
          type="button"
          onClick={handleCopy}
          className={`w-full inline-flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-black uppercase tracking-wider transition-all active:scale-[0.98] ${
            copied ? 'bg-emerald-600 text-white' : 'bg-gradient-to-r from-amber-500 to-amber-600 text-black hover:brightness-110'
          }`}
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? 'Código copiado!' : 'Copiar código Pix'}
        </button>
      </div>

      <ol className="rounded-xl bg-neutral-900 border border-neutral-800 p-3 text-[11px] text-neutral-300 space-y-1 list-decimal list-inside">
        <li>Abra o app do seu banco e vá em <strong>Pix</strong>.</li>
        <li>Escolha <strong>Pix Copia e Cola</strong> (ou leia o QR Code).</li>
        <li>Cole o código, confira o valor e confirme.</li>
      </ol>

      {/* Status */}
      <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-[11px] text-amber-200/90 flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" /> Aguardando o pagamento...
        </span>
        <span className="inline-flex items-center gap-1 font-mono font-bold text-amber-300">
          <Clock className="w-3.5 h-3.5" /> {fmtClock(secondsLeft)}
        </span>
      </div>
      <p className="text-[10px] text-neutral-500 text-center">
        Seu horário fica reservado por este tempo. A confirmação é automática assim que o Pix cair.
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleManualCheck}
          disabled={checking}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-700 bg-neutral-900 py-2.5 text-[11px] font-bold uppercase text-neutral-200 hover:border-amber-500 disabled:opacity-60"
        >
          {checking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Já paguei
        </button>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-neutral-800 bg-neutral-900 py-2.5 text-[11px] font-bold uppercase text-neutral-300 hover:bg-neutral-800"
          >
            Pagar depois
          </button>
        )}
      </div>
    </div>
  );
};

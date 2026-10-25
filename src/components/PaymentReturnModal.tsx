import React, { useEffect, useState } from 'react';
import { CheckCircle2, Clock, XCircle, X, Loader2 } from 'lucide-react';
import { api } from '../services/api';

type Outcome = 'loading' | 'paid' | 'waiting' | 'failed';

/**
 * Tela exibida quando o cliente volta do Mercado Pago (?pagamento=...&apt=...).
 * Confirma o resultado no servidor (não confia só no que veio na URL).
 */
export const PaymentReturnModal: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>('loading');
  const [info, setInfo] = useState<{ itemName: string; date: string; time: string } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get('pagamento');
    const aptId = params.get('apt');
    if (!result || !aptId) return;

    // Limpa a URL para não repetir ao recarregar
    window.history.replaceState({}, '', window.location.pathname);
    setOpen(true);

    let cancelled = false;
    let tries = 0;

    const check = async () => {
      try {
        const st = await api.getPaymentStatus(aptId);
        if (cancelled) return;
        setInfo({ itemName: st.itemName, date: st.date, time: st.time });
        if (st.paymentStatus === 'paid') return setOutcome('paid');
        if (st.status === 'cancelled') return setOutcome('failed');
        if (result === 'falhou') return setOutcome('failed');
        tries += 1;
        if (tries >= 8) return setOutcome('waiting'); // ~24s
        setTimeout(check, 3000);
      } catch {
        if (!cancelled) setOutcome(result === 'falhou' ? 'failed' : 'waiting');
      }
    };
    check();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!open) return null;

  const when = info ? `${info.date.split('-').reverse().join('/')} às ${info.time}` : '';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="relative w-full max-w-sm rounded-3xl border border-amber-500/40 bg-[#121212] p-6 text-center text-neutral-100 shadow-2xl space-y-4">
        <button onClick={() => setOpen(false)} className="absolute right-4 top-4 text-neutral-400 hover:text-white" aria-label="Fechar">
          <X className="w-5 h-5" />
        </button>

        {outcome === 'loading' && (
          <>
            <Loader2 className="w-10 h-10 mx-auto animate-spin text-amber-400" />
            <p className="text-sm text-neutral-300">Confirmando seu pagamento...</p>
          </>
        )}

        {outcome === 'paid' && (
          <>
            <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-400" />
            <h3 className="font-display text-lg font-bold text-white">Pagamento aprovado!</h3>
            <p className="text-xs text-neutral-300">
              Seu horário de <strong>{info?.itemName}</strong> em <strong>{when}</strong> está confirmado. Te esperamos na BARBERSHOP L.A!
            </p>
          </>
        )}

        {outcome === 'waiting' && (
          <>
            <Clock className="w-12 h-12 mx-auto text-amber-400" />
            <h3 className="font-display text-lg font-bold text-white">Aguardando confirmação</h3>
            <p className="text-xs text-neutral-300">
              O Mercado Pago ainda não confirmou o pagamento. Assim que confirmar, seu horário{when ? ` (${when})` : ''} é confirmado automaticamente.
              Acompanhe em <strong>Meus Agendamentos</strong>.
            </p>
          </>
        )}

        {outcome === 'failed' && (
          <>
            <XCircle className="w-12 h-12 mx-auto text-rose-400" />
            <h3 className="font-display text-lg font-bold text-white">Pagamento não concluído</h3>
            <p className="text-xs text-neutral-300">
              Seu horário fica reservado por até 15 minutos. Abra <strong>Meus Agendamentos</strong> e toque em "Pagar agora" para tentar de novo, ou escolha pagar no local.
            </p>
          </>
        )}

        <button
          onClick={() => setOpen(false)}
          className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 py-2.5 text-xs font-black uppercase text-black"
        >
          Entendi
        </button>
      </div>
    </div>
  );
};

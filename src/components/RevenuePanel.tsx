import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, TrendingUp, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';
import { RevenueSummary } from '../types/barbershop';

const money = (v: number) => `R$ ${v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const WEEK = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

const currentMonth = () => {
  const d = new Date(Date.now() - 3 * 3600 * 1000); // horário de Brasília
  return d.toISOString().slice(0, 7);
};
const shift = (month: string, delta: number) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
};
const dayLabel = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')} · ${WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}`;
};

/** Faturamento do barbeiro: hoje, mês e dia a dia. Conta só atendimentos PAGOS e não cancelados. */
export const RevenuePanel: React.FC = () => {
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState<RevenueSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    api
      .adminRevenue(month)
      .then((d) => alive && setData(d))
      .catch((e: any) => alive && setError(e.message || 'Erro ao carregar.'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [month]);

  const [y, m] = month.split('-').map(Number);
  const maxDay = data ? Math.max(1, ...data.days.map((d) => d.total)) : 1;

  return (
    <div className="space-y-4 text-left">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setMonth(shift(month, -1))} className="rounded-lg border border-neutral-700 p-2 text-neutral-300 hover:border-amber-500" aria-label="Mês anterior">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="text-center">
          <p className="font-display text-sm font-bold text-white">{MONTHS[m - 1]} {y}</p>
          {month !== currentMonth() && (
            <button type="button" onClick={() => setMonth(currentMonth())} className="text-[10px] text-amber-400 underline">Voltar para este mês</button>
          )}
        </div>
        <button type="button" onClick={() => setMonth(shift(month, 1))} className="rounded-lg border border-neutral-700 p-2 text-neutral-300 hover:border-amber-500" aria-label="Próximo mês">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {loading && <div className="py-4 text-center text-xs text-neutral-400"><Loader2 className="inline w-4 h-4 animate-spin mr-2" />Calculando...</div>}
      {error && <p className="rounded-lg border border-rose-800/60 bg-rose-950/50 p-2 text-[11px] text-rose-300">{error}</p>}

      {data && !loading && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-300">Faturado hoje</p>
              <p className="font-display text-lg font-black text-white">{money(data.today.total)}</p>
              <p className="text-[10px] text-neutral-400">{data.today.count} atendimento(s)</p>
            </div>
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">Faturado no mês</p>
              <p className="font-display text-lg font-black text-white">{money(data.month.total)}</p>
              <p className="text-[10px] text-neutral-400">{data.month.count} atendimento(s) · média {money(data.month.average)}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-2">
              <p className="text-[10px] text-neutral-400">Pix</p>
              <p className="text-xs font-bold text-white">{money(data.byMethod.pix.total)}</p>
            </div>
            <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-2">
              <p className="text-[10px] text-neutral-400">No local</p>
              <p className="text-xs font-bold text-white">{money(data.byMethod.in_person.total)}</p>
            </div>
            <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-2">
              <p className="text-[10px] text-neutral-400">A receber</p>
              <p className="text-xs font-bold text-amber-300">{money(data.toReceive.total)}</p>
            </div>
          </div>

          {data.refundsNeeded.count > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-800/60 bg-rose-950/40 p-2.5 text-[11px] text-rose-200">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{data.refundsNeeded.count} agendamento(s) cancelado(s) já pago(s) ({money(data.refundsNeeded.total)}): reembolse no painel do Mercado Pago. Eles <strong>não</strong> entram no faturado.</span>
            </div>
          )}

          <div>
            <h5 className="mb-2 inline-flex items-center gap-1.5 text-xs font-bold text-white"><TrendingUp className="w-3.5 h-3.5 text-amber-400" /> Dia a dia</h5>
            {data.days.length === 0 ? (
              <p className="text-xs text-neutral-500">Nenhum atendimento pago neste mês ainda.</p>
            ) : (
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {[...data.days].reverse().map((d) => (
                  <div key={d.date} className="rounded-lg bg-neutral-950 p-2">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-neutral-300">{dayLabel(d.date)} <span className="text-neutral-500">({d.count})</span></span>
                      <span className="font-bold text-amber-300">{money(d.total)}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded bg-neutral-800"><div className="h-1.5 rounded bg-gradient-to-r from-amber-500 to-amber-600" style={{ width: `${Math.max(4, (d.total / maxDay) * 100)}%` }} /></div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="text-[10px] leading-snug text-neutral-500">
            Conta só atendimentos <strong>pagos</strong> e não cancelados, no dia do atendimento. Pix online entra sozinho; pagamento no local entra quando você marcar <strong>"pago"</strong> na Agenda. "A receber" = confirmados ainda não pagos.
          </p>
        </>
      )}
    </div>
  );
};

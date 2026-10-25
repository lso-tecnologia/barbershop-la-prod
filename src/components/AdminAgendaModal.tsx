import React, { useEffect, useMemo, useState } from 'react';
import { X, Calendar, RefreshCw, MessageCircle, CheckCircle2, Ban, Loader2 } from 'lucide-react';
import { AppointmentRecord } from '../types/barbershop';
import { api } from '../services/api';

interface AdminAgendaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const statusLabel: Record<AppointmentRecord['status'], string> = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  completed: 'Concluído',
  cancelled: 'Cancelado',
};

const statusStyle: Record<AppointmentRecord['status'], string> = {
  pending: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  confirmed: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  completed: 'bg-sky-500/15 text-sky-300 border-sky-500/40',
  cancelled: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
};

export const AdminAgendaModal: React.FC<AdminAgendaModalProps> = ({ isOpen, onClose }) => {
  const today = useMemo(() => ymd(new Date()), []);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(ymd(new Date(Date.now() + 14 * 24 * 3600 * 1000)));
  const [items, setItems] = useState<AppointmentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    api
      .adminListAppointments(from, to)
      .then(setItems)
      .catch((e) => setError(e.message || 'Erro ao carregar a agenda.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isOpen) load();
  }, [isOpen, from, to]);

  if (!isOpen) return null;

  const update = async (id: string, patch: { status?: string; paymentStatus?: string }) => {
    setBusyId(id);
    try {
      const updated = await api.adminUpdateAppointment(id, patch);
      setItems((prev) => prev.map((a) => (a.id === id ? updated : a)));
    } catch (e: any) {
      setError(e.message || 'Erro ao atualizar.');
    } finally {
      setBusyId('');
    }
  };

  // Agrupa por dia
  const byDay = items.reduce<Record<string, AppointmentRecord[]>>((acc, a) => {
    (acc[a.date] ||= []).push(a);
    return acc;
  }, {});
  const days = Object.keys(byDay).sort();
  const active = items.filter((a) => a.status === 'confirmed' || a.status === 'pending').length;

  const waUrl = (a: AppointmentRecord) => {
    const phone = a.clientPhone.replace(/\D/g, '');
    const text = `Olá ${a.clientName}! Aqui é o Leonardo da BARBERSHOP L.A. Sobre seu horário de ${a.itemName} em ${a.date
      .split('-')
      .reverse()
      .join('/')} às ${a.time}.`;
    return `https://wa.me/55${phone}?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl rounded-3xl border border-amber-500/50 bg-[#121212] p-5 sm:p-7 shadow-2xl text-neutral-100 max-h-[92vh] overflow-y-auto">
        <button onClick={onClose} className="absolute right-4 top-4 text-neutral-400 hover:text-white" aria-label="Fechar">
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <Calendar className="w-6 h-6 text-amber-400" />
          <div>
            <h3 className="font-display text-lg font-bold text-white">Agenda do Barbeiro</h3>
            <p className="text-[11px] text-neutral-400">{active} agendamento(s) ativo(s) no período</p>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-2 mb-4">
          <label className="text-[10px] uppercase tracking-wider text-neutral-400">
            De
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="block mt-1 rounded-lg border border-neutral-800 bg-neutral-900 px-2 py-1.5 text-xs text-white" />
          </label>
          <label className="text-[10px] uppercase tracking-wider text-neutral-400">
            Até
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="block mt-1 rounded-lg border border-neutral-800 bg-neutral-900 px-2 py-1.5 text-xs text-white" />
          </label>
          <button onClick={load} className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-xs font-bold hover:border-amber-500">
            <RefreshCw className="w-3.5 h-3.5 text-amber-400" /> Atualizar
          </button>
        </div>

        {error && <div className="mb-3 rounded-xl border border-rose-800/60 bg-rose-950/30 p-3 text-xs text-rose-300">{error}</div>}

        {loading ? (
          <div className="py-10 text-center text-xs text-neutral-400"><Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />Carregando agenda...</div>
        ) : days.length === 0 ? (
          <p className="py-10 text-center text-xs text-neutral-400">Nenhum agendamento neste período.</p>
        ) : (
          <div className="space-y-5">
            {days.map((day) => (
              <div key={day}>
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2">
                  {day.split('-').reverse().join('/')}
                  {day === today && ' · Hoje'}
                </h4>
                <div className="space-y-2">
                  {byDay[day].map((a) => (
                    <div key={a.id} className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-bold text-white">
                            <span className="font-mono text-amber-400">{a.time}</span> · {a.clientName}
                          </p>
                          <p className="text-[11px] text-neutral-300">{a.itemName}</p>
                          <p className="text-[11px] text-neutral-500">
                            {a.price === 0 ? 'À combinar' : `R$ ${a.price.toFixed(2).replace('.', ',')}`} ·{' '}
                            {a.paymentMethod === 'in_person' ? 'Pagar no local' : a.paymentMethod.toUpperCase()} ·{' '}
                            {a.paymentStatus === 'paid' ? 'Pago' : 'Pagamento pendente'}
                          </p>
                        </div>
                        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${statusStyle[a.status]}`}>
                          {statusLabel[a.status]}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <a href={waUrl(a)} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-emerald-700/50 bg-emerald-900/20 px-2.5 py-1.5 text-[11px] font-bold text-emerald-300">
                          <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                        </a>
                        {(a.status === 'confirmed' || a.status === 'pending') && (
                          <>
                            <button disabled={busyId === a.id} onClick={() => update(a.id, { status: 'completed', paymentStatus: 'paid' })}
                              className="inline-flex items-center gap-1 rounded-lg border border-sky-700/50 bg-sky-900/20 px-2.5 py-1.5 text-[11px] font-bold text-sky-300">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Concluir e marcar pago
                            </button>
                            {a.paymentStatus !== 'paid' && (
                              <button disabled={busyId === a.id} onClick={() => update(a.id, { paymentStatus: 'paid' })}
                                className="rounded-lg border border-neutral-700 bg-neutral-800 px-2.5 py-1.5 text-[11px] font-bold text-neutral-200">
                                Marcar pago
                              </button>
                            )}
                            <button disabled={busyId === a.id} onClick={() => { if (confirm(`Cancelar o horário de ${a.clientName} às ${a.time}?`)) update(a.id, { status: 'cancelled' }); }}
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-700/50 bg-rose-900/20 px-2.5 py-1.5 text-[11px] font-bold text-rose-300">
                              <Ban className="w-3.5 h-3.5" /> Cancelar
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, Scissors, AlertTriangle, MessageCircle, CheckCircle2, Ban, Lock, User } from 'lucide-react';
import { UserAccount, AppointmentRecord } from '../types/barbershop';
import { api } from '../services/api';

interface MyAppointmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNewBookingClick: () => void;
  currentUser: UserAccount | null;
  onOpenLoginModal: () => void;
}

export const MyAppointmentsModal: React.FC<MyAppointmentsModalProps> = ({
  isOpen,
  onClose,
  onNewBookingClick,
  currentUser,
  onOpenLoginModal,
}) => {
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (isOpen && currentUser) {
      setIsLoading(true);
      setLoadError('');
      api
        .getMyAppointments()
        .then(setAppointments)
        .catch((err) => {
          setAppointments([]);
          setLoadError(err.message || 'Não foi possível carregar seus agendamentos.');
        })
        .finally(() => setIsLoading(false));
    } else {
      setAppointments([]);
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  // Verifica se o cancelamento é permitido (mais de 2 horas de antecedência)
  const canCancelAppointment = (dateStr: string, timeStr: string) => {
    try {
      const [year, month, day] = dateStr.split('-').map(Number);
      const [hour, minute] = timeStr.split(':').map(Number);
      const appointmentDateTime = new Date(year, month - 1, day, hour, minute || 0);
      const now = new Date();

      const diffMs = appointmentDateTime.getTime() - now.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      return diffHours >= 2;
    } catch {
      return false;
    }
  };

  const handlePayNow = async (id: string) => {
    try {
      const url = await api.createCheckout(id);
      window.location.href = url;
    } catch (err: any) {
      setLoadError(err.message || 'Não foi possível abrir o pagamento.');
    }
  };

  const handleCancelAppointment = async (id: string) => {
    try {
      const updated = await api.cancelAppointment(id);
      setAppointments((prev) => prev.map((apt) => (apt.id === id ? updated : apt)));
    } catch (err: any) {
      setLoadError(err.message || 'Não foi possível cancelar.');
    }
  };

  const getWhatsAppCancelUrl = (apt: AppointmentRecord) => {
    const text = `Olá Leonardo, gostaria de solicitar o cancelamento do meu agendamento de ${apt.itemName} no dia ${apt.date.split('-').reverse().join('/')} às ${apt.time}.`;
    return `https://wa.me/5511981154340?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg rounded-3xl border border-amber-500/40 bg-[#121212] p-6 sm:p-8 shadow-2xl text-neutral-100 max-h-[85vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 rounded-xl p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
              Histórico & Próximos Atendimentos
            </span>
            <h3 className="font-display text-xl font-bold text-white">
              Meus Agendamentos
            </h3>
          </div>
        </div>

        {/* Se o usuário não está autenticado, solicita login */}
        {!currentUser ? (
          <div className="text-center py-8 space-y-4">
            <div className="w-14 h-14 rounded-full bg-amber-500/15 border border-amber-500/30 mx-auto flex items-center justify-center text-amber-400">
              <Lock className="w-7 h-7" />
            </div>
            <div>
              <h4 className="font-display text-base font-bold text-white">
                Identificação Necessária
              </h4>
              <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
                Para visualizar seus agendamentos e histórico com total privacidade e segurança, entre com sua conta.
              </p>
            </div>
            <div className="pt-2">
              <button
                onClick={() => {
                  onClose();
                  onOpenLoginModal();
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-3 text-xs font-black uppercase tracking-wider text-black shadow-lg hover:brightness-110 active:scale-98 transition-all"
              >
                <User className="w-4 h-4" />
                <span>Fazer Login ou Criar Conta</span>
              </button>
            </div>
          </div>
        ) : isLoading ? (
          <p className="text-center text-xs text-neutral-400 py-10">Carregando seus agendamentos...</p>
        ) : loadError && appointments.length === 0 ? (
          <p className="text-center text-xs text-rose-300 py-10">{loadError}</p>
        ) : appointments.length === 0 ? (
          <div className="text-center py-10 space-y-4">
            <Scissors className="w-12 h-12 text-neutral-600 mx-auto" />
            <p className="text-xs text-neutral-400">
              Olá, <strong>{currentUser.name}</strong>! Você ainda não possui nenhum agendamento registrado nesta conta.
            </p>
            <button
              onClick={() => {
                onClose();
                onNewBookingClick();
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-black shadow-lg"
            >
              Agendar Meu Primeiro Horário
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {appointments.map((apt) => {
              const cancelable = canCancelAppointment(apt.date, apt.time);
              const isCancelled = apt.status === 'cancelled';
              const awaitingPayment = apt.status === 'pending' && apt.paymentMethod !== 'in_person' && apt.paymentStatus === 'pending';

              return (
                <div
                  key={apt.id}
                  className={`rounded-2xl border p-4 text-xs transition-all ${
                    isCancelled
                      ? 'border-neutral-900 bg-neutral-950/60 opacity-60'
                      : 'border-neutral-800 bg-neutral-900/90'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-neutral-500 font-mono">
                        {apt.id}
                      </span>
                      <h4 className="font-display text-sm font-bold text-white mt-0.5">
                        {apt.itemName}
                      </h4>
                    </div>

                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        isCancelled
                          ? 'bg-rose-950/60 text-rose-400 border border-rose-800/40'
                          : awaitingPayment
                            ? 'bg-amber-950/60 text-amber-300 border border-amber-800/40'
                            : 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40'
                      }`}
                    >
                      {isCancelled ? 'Cancelado' : awaitingPayment ? 'Aguardando pagamento' : 'Confirmado'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-neutral-300 py-2 border-y border-neutral-800/80 my-2">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-amber-400" />
                      <span>{apt.date.split('-').reverse().join('/')}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      <span>{apt.time}</span>
                    </div>
                    <div>
                      <span className="text-neutral-500">Valor: </span>
                      <span className="font-bold text-amber-400">
                        {apt.price === 0 ? 'À combinar' : `R$ ${apt.price.toFixed(2).replace('.', ',')}`}
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-500">Pagamento: </span>
                      <span className="text-neutral-200 capitalize">
                        {apt.paymentMethod === 'in_person' ? 'No Local' : apt.paymentMethod}{apt.paymentStatus === 'paid' ? ' · Pago ✔' : ''}
                      </span>
                    </div>
                  </div>

                  {awaitingPayment && (
                    <button
                      onClick={() => handlePayNow(apt.id)}
                      className="mb-2 w-full rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-3 py-2 text-[11px] font-black uppercase tracking-wider text-black hover:brightness-110"
                    >
                      Pagar agora (Mercado Pago)
                    </button>
                  )}

                  {!isCancelled && (
                    <div className="pt-1 flex items-center justify-between gap-2">
                      {cancelable ? (
                        <button
                          onClick={() => handleCancelAppointment(apt.id)}
                          className="rounded-lg border border-rose-800/60 bg-rose-950/20 px-3 py-1.5 text-[11px] font-semibold text-rose-300 hover:bg-rose-900/40 transition"
                        >
                          Cancelar Agendamento
                        </button>
                      ) : (
                        <div className="flex items-center justify-between w-full">
                          <span className="text-[10px] text-amber-400/90 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-amber-400" />
                            <span>Cancelamento bloqueado (&lt; 2h antes)</span>
                          </span>
                          <a
                            href={getWhatsAppCancelUrl(apt)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:underline"
                          >
                            <MessageCircle className="w-3 h-3" />
                            <span>Avisar no WhatsApp</span>
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

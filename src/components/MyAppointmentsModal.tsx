import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, Scissors, AlertTriangle, MessageCircle, CheckCircle2, Ban, Lock, User, Search, RefreshCw, Phone } from 'lucide-react';
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
  const [phoneSearch, setPhoneSearch] = useState('');
  const [isSearchingPhone, setIsSearchingPhone] = useState(false);
  const [searchedPhoneSubmitted, setSearchedPhoneSubmitted] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Formata o telefone (11) 9XXXX-XXXX
  const formatPhone = (val: string) => {
    const num = val.replace(/\D/g, '');
    if (num.length <= 2) return num;
    if (num.length <= 7) return `(${num.slice(0, 2)}) ${num.slice(2)}`;
    return `(${num.slice(0, 2)}) ${num.slice(2, 7)}-${num.slice(7, 11)}`;
  };

  const loadAppointments = async () => {
    setIsLoading(true);
    setLoadError('');
    setSuccessMessage('');

    if (currentUser) {
      try {
        const list = await api.getMyAppointments();
        setAppointments(list);
      } catch (err: any) {
        setAppointments([]);
        setLoadError(err.message || 'Não foi possível carregar seus agendamentos.');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Se não está logado, tenta recuperar do armazenamento local
    try {
      const savedPhone = localStorage.getItem('barbershop_last_phone') || '';
      if (savedPhone && !phoneSearch) {
        setPhoneSearch(savedPhone);
      }

      const raw = localStorage.getItem('barbershop_recent_appointments');
      if (raw) {
        const localList: AppointmentRecord[] = JSON.parse(raw);
        if (Array.isArray(localList) && localList.length > 0) {
          setAppointments(localList);
        }
      }
    } catch {}

    setIsLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadAppointments();
    }
  }, [isOpen, currentUser]);

  const handleSearchByPhone = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = phoneSearch.replace(/\D/g, '');
    if (clean.length < 8) {
      setLoadError('Por favor, informe seu número de WhatsApp com DDD.');
      return;
    }

    setIsSearchingPhone(true);
    setLoadError('');
    setSuccessMessage('');
    try {
      const results = await api.getAppointmentsByPhone(clean);
      setAppointments(results);
      setSearchedPhoneSubmitted(true);
      localStorage.setItem('barbershop_last_phone', phoneSearch);
      if (results.length === 0) {
        setLoadError('Nenhum agendamento encontrado para este número.');
      }
    } catch (err: any) {
      setLoadError(err.message || 'Erro ao buscar agendamentos.');
    } finally {
      setIsSearchingPhone(false);
    }
  };

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

  const handleCancelAppointment = async (apt: AppointmentRecord) => {
    setLoadError('');
    setSuccessMessage('');
    try {
      let updated: AppointmentRecord;
      if (currentUser) {
        updated = await api.cancelAppointment(apt.id);
      } else {
        const phone = apt.clientPhone || phoneSearch;
        updated = await api.cancelAppointmentPublic(apt.id, phone);
      }

      setAppointments((prev) => prev.map((a) => (a.id === apt.id ? updated : a)));
      setSuccessMessage('Agendamento cancelado com sucesso!');

      // Atualiza no cache local
      try {
        const raw = localStorage.getItem('barbershop_recent_appointments');
        if (raw) {
          const list: AppointmentRecord[] = JSON.parse(raw);
          const next = list.map((a) => (a.id === apt.id ? updated : a));
          localStorage.setItem('barbershop_recent_appointments', JSON.stringify(next));
        }
      } catch {}
    } catch (err: any) {
      setLoadError(err.message || 'Não foi possível cancelar.');
    }
  };

  const getWhatsAppCancelUrl = (apt: AppointmentRecord) => {
    const text = `Olá Leonardo, gostaria de solicitar o cancelamento do meu agendamento de ${apt.itemName} no dia ${apt.date.split('-').reverse().join('/')} às ${apt.time}.`;
    return `https://wa.me/5511981154340?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg rounded-3xl border border-amber-500/40 bg-[#121212] p-5 sm:p-7 shadow-2xl text-neutral-100 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 sm:top-5 sm:right-5 rounded-xl p-2 text-neutral-400 hover:bg-neutral-800 hover:text-white"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5 pr-8">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
              Checar & Cancelar Horários
            </span>
            <h3 className="font-display text-lg sm:text-xl font-bold text-white">
              Meus Agendamentos
            </h3>
          </div>
        </div>

        {/* Busca por Telefone / WhatsApp para quem não está logado */}
        {!currentUser && (
          <div className="mb-5 rounded-2xl border border-neutral-800 bg-neutral-900/90 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-amber-400" />
                <span>Consultar por WhatsApp / Telefone</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenLoginModal();
                }}
                className="text-[11px] text-amber-400 hover:underline font-semibold"
              >
                Fazer Login
              </button>
            </div>

            <form onSubmit={handleSearchByPhone} className="flex gap-2">
              <div className="relative flex-1">
                <Phone className="w-4 h-4 absolute left-3 top-3 text-neutral-500" />
                <input
                  type="tel"
                  value={phoneSearch}
                  onChange={(e) => setPhoneSearch(formatPhone(e.target.value))}
                  placeholder="(11) 9XXXX-XXXX"
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-950 pl-9 pr-3 py-2 text-xs text-white placeholder-neutral-500 focus:border-amber-400 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={isSearchingPhone}
                className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-black hover:bg-amber-400 disabled:opacity-50"
              >
                {isSearchingPhone ? 'Buscando...' : 'Buscar'}
              </button>
            </form>
          </div>
        )}

        {/* Mensagens de Sucesso e Erro */}
        {successMessage && (
          <div className="mb-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}

        {loadError && (
          <div className="mb-4 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{loadError}</span>
          </div>
        )}

        {isLoading ? (
          <p className="text-center text-xs text-neutral-400 py-10">Carregando seus agendamentos...</p>
        ) : appointments.length === 0 ? (
          <div className="text-center py-8 space-y-4">
            <Scissors className="w-12 h-12 text-neutral-600 mx-auto" />
            <div>
              <h4 className="font-display text-sm font-bold text-white">
                Nenhum agendamento encontrado
              </h4>
              <p className="text-xs text-neutral-400 mt-1 max-w-xs mx-auto">
                {!currentUser && !searchedPhoneSubmitted
                  ? 'Digite seu número de WhatsApp acima para buscar seus horários ou agende um novo horário.'
                  : 'Você não possui horários agendados no momento.'}
              </p>
            </div>
            <button
              onClick={() => {
                onClose();
                onNewBookingClick();
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-black shadow-lg"
            >
              Agendar Horário Agora
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
                          onClick={() => handleCancelAppointment(apt)}
                          className="rounded-lg border border-rose-800/60 bg-rose-950/20 px-3 py-1.5 text-[11px] font-semibold text-rose-300 hover:bg-rose-900/40 transition active:scale-95"
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

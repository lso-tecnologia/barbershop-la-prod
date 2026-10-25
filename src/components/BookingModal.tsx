import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Calendar,
  Clock,
  Scissors,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  User,
  Phone,
  Mail,
  CreditCard,
  QrCode,
  DollarSign,
  MessageCircle,
  AlertCircle,
  Sparkles,
  Check,
  Flame,
  ChevronRight
} from 'lucide-react';
import { ServiceItem, PromoPackage, UserAccount, AppointmentRecord } from '../types/barbershop';
import { api } from '../services/api';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedItem?: ServiceItem | PromoPackage | null;
  services: ServiceItem[];
  packages: PromoPackage[];
  currentUser: UserAccount | null;
  onOpenAuthModal?: () => void;
  onBookingConfirmed?: (appointment: AppointmentRecord) => void;
}

export const BookingModal: React.FC<BookingModalProps> = ({
  isOpen,
  onClose,
  selectedItem: initialSelectedItem,
  services,
  packages,
  currentUser,
  onOpenAuthModal,
  onBookingConfirmed,
}) => {
  // Item selecionado (permite escolher livremente no modal)
  const [chosenItem, setChosenItem] = useState<ServiceItem | PromoPackage | null>(null);

  // Aba da escolha de serviço: 'services' ou 'packages'
  const [itemCategoryTab, setItemCategoryTab] = useState<'services' | 'packages'>('services');

  // Passos do Fluxo:
  // 1 = Escolha do Serviço/Pacote
  // 2 = Data & Horário
  // 3 = Dados do Cliente
  // 4 = Pagamento
  // 5 = Comprovante Confirmado
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Inicializa o item escolhido quando o modal abre
  useEffect(() => {
    if (isOpen) {
      if (initialSelectedItem) {
        setChosenItem(initialSelectedItem);
        setStep(2); // Se veio de um card específico, já vai direto para a data
      } else {
        setChosenItem(null); // Sem item pré-definido: o cliente escolhe!
        setStep(1); // Abre na tela de escolha de serviço
      }
      setSelectedSlot('');
      setFormError('');
      setCreatedAppointment(null);
    }
  }, [isOpen, initialSelectedItem]);

  // Data padrão (Hoje)
  const todayStr = useMemo(() => {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${mm}-${dd}`;
  }, []);

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [takenTimes, setTakenTimes] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Busca no servidor os horários já ocupados do dia escolhido
  const loadTakenTimes = (date: string) => {
    if (!date) return;
    api.getTakenTimes(date).then(setTakenTimes).catch(() => setTakenTimes([]));
  };
  useEffect(() => {
    if (isOpen) loadTakenTimes(selectedDate);
  }, [isOpen, selectedDate]);

  // Dados do formulário do cliente
  const [clientName, setClientName] = useState(currentUser?.name || '');
  const [clientPhone, setClientPhone] = useState(currentUser?.phone || '');
  const [clientEmail, setClientEmail] = useState(currentUser?.email || '');

  // Forma de pagamento
  const [paymentMethod, setPaymentMethod] = useState<'in_person' | 'pix' | 'card'>('in_person');

  // Agendamento recém-criado
  const [createdAppointment, setCreatedAppointment] = useState<AppointmentRecord | null>(null);

  // Erros de validação
  const [formError, setFormError] = useState('');

  // Atualiza dados caso o usuário faça login durante o uso
  useEffect(() => {
    if (currentUser) {
      if (!clientName) setClientName(currentUser.name);
      if (!clientPhone) setClientPhone(currentUser.phone);
      if (!clientEmail) setClientEmail(currentUser.email);
    }
  }, [currentUser]);

  // Cálculo Dinâmico dos Slots e Validação de Domingo e Segunda
  const { dayOfWeek, isMonday, isSunday, availableSlots, scheduleLabel } = useMemo(() => {
    if (!selectedDate) {
      return { dayOfWeek: -1, isMonday: false, isSunday: false, availableSlots: [], scheduleLabel: '' };
    }

    const [year, month, day] = selectedDate.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    const dow = dateObj.getDay(); // 0 = Domingo, 1 = Segunda, 2-6 = Terça a Sábado

    if (dow === 1) {
      // SEGUNDA: Fechado
      return {
        dayOfWeek: 1,
        isMonday: true,
        isSunday: false,
        availableSlots: [],
        scheduleLabel: 'Segunda-feira: Barbearia Fechada',
      };
    }

    if (dow === 0) {
      // DOMINGO: 09h às 14h (slots de 1h -> 09:00, 10:00, 11:00, 12:00, 13:00)
      // NENHUM SLOT APÓS 14H!
      return {
        dayOfWeek: 0,
        isMonday: false,
        isSunday: true,
        availableSlots: ['09:00', '10:00', '11:00', '12:00', '13:00'],
        scheduleLabel: 'Domingo: 09h às 14h (Último atendimento às 13h)',
      };
    }

    // TERÇA A SÁBADO: 09h às 19h (slots de 1h -> 09:00 até 18:00)
    return {
      dayOfWeek: dow,
      isMonday: false,
      isSunday: false,
      availableSlots: [
        '09:00',
        '10:00',
        '11:00',
        '12:00',
        '13:00',
        '14:00',
        '15:00',
        '16:00',
        '17:00',
        '18:00',
      ],
      scheduleLabel: 'Terça a Sábado: 09h às 19h (Último atendimento às 18h)',
    };
  }, [selectedDate]);

  // Se o slot selecionado anteriormente não existir mais no novo dia (ex: trocou de sábado 16h para domingo), reseta
  useEffect(() => {
    if (selectedSlot && !availableSlots.includes(selectedSlot)) {
      setSelectedSlot('');
    }
  }, [availableSlots, selectedSlot]);

  if (!isOpen) return null;

  const currentItemName = chosenItem
    ? 'title' in chosenItem
      ? chosenItem.title
      : chosenItem.name
    : '';

  const currentItemPrice = chosenItem ? chosenItem.price : 0;
  const isPackage = chosenItem ? 'benefits' in chosenItem : false;

  // Formatar telefone (11) 9XXXX-XXXX
  const handlePhoneInput = (val: string) => {
    const numbers = val.replace(/\D/g, '');
    let formatted = numbers;
    if (numbers.length > 2) {
      formatted = `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    }
    if (numbers.length > 7) {
      formatted = `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
    }
    setClientPhone(formatted);
  };

  // Selecionar serviço e ir para data e hora
  const handleChooseServiceItem = (item: ServiceItem | PromoPackage) => {
    setChosenItem(item);
    setFormError('');
    setStep(2);
  };

  // Avançar do Passo 2 (Data/Hora) para o Passo 3 (Dados do Cliente)
  const handleProceedToClientInfo = () => {
    setFormError('');
    if (!chosenItem) {
      setFormError('Por favor, selecione um serviço.');
      setStep(1);
      return;
    }
    if (isMonday) {
      setFormError('A barbearia não abre às segundas-feiras. Por favor, escolha outro dia.');
      return;
    }
    if (!selectedDate) {
      setFormError('Por favor, selecione uma data válida.');
      return;
    }
    if (!selectedSlot) {
      setFormError('Por favor, selecione um dos horários disponíveis.');
      return;
    }

    setStep(3);
  };

  // Avançar do Passo 3 para o Passo 4 (Pagamento)
  const handleProceedToPayment = () => {
    setFormError('');
    if (!clientName.trim()) {
      setFormError('Por favor, digite seu nome.');
      return;
    }
    if (!clientPhone || clientPhone.length < 14) {
      setFormError('Por favor, informe um WhatsApp válido com DDD: (11) 9XXXX-XXXX.');
      return;
    }
    setStep(4);
  };

  // Confirmar Agendamento Final (Passo 5)
  // Pagamento online só para itens com valor definido
  const onlineAllowed = currentItemPrice > 0;
  const effectiveMethod: 'in_person' | 'pix' | 'card' = onlineAllowed ? paymentMethod : 'in_person';
  const isOnline = effectiveMethod !== 'in_person';

  const handleConfirmAppointment = async () => {
    if (!chosenItem || isSubmitting) return;
    setFormError('');
    setIsSubmitting(true);
    let redirecting = false;
    try {
      // Se já criamos a reserva pendente (ex.: falhou abrir o pagamento), reaproveita
      let saved: AppointmentRecord | null =
        createdAppointment &&
        createdAppointment.status === 'pending' &&
        createdAppointment.date === selectedDate &&
        createdAppointment.time === selectedSlot &&
        createdAppointment.paymentMethod === effectiveMethod
          ? createdAppointment
          : null;

      if (!saved) {
        saved = await api.createAppointment({
          clientName,
          clientPhone,
          clientEmail: clientEmail || `${clientPhone.replace(/\D/g, '')}@barbershopla.com.br`,
          itemName: currentItemName,
          itemType: isPackage ? 'package' : 'service',
          price: currentItemPrice,
          date: selectedDate,
          time: selectedSlot,
          paymentMethod: effectiveMethod,
        });
      }
      setCreatedAppointment(saved);

      if (isOnline) {
        // Vai para o Mercado Pago (Pix ou Cartão). O retorno é tratado em App.tsx.
        const url = await api.createCheckout(saved.id);
        redirecting = true;
        window.location.href = url;
        return;
      }

      if (onBookingConfirmed) onBookingConfirmed(saved);
      setStep(5);
    } catch (err: any) {
      setFormError(err.message || 'Não foi possível confirmar o agendamento.');
      if (err.status === 409) {
        // Horário foi ocupado por outra pessoa: volta e atualiza a lista
        setCreatedAppointment(null);
        setSelectedSlot('');
        loadTakenTimes(selectedDate);
        setStep(2);
      }
    } finally {
      if (!redirecting) setIsSubmitting(false);
    }
  };

  // Link para o WhatsApp após confirmação
  const getWhatsAppConfirmationUrl = () => {
    if (!createdAppointment) return '';
    const [y, m, d] = createdAppointment.date.split('-');
    const formattedDate = `${d}/${m}/${y}`;
    const text = `Olá Leonardo Arruda! Acabei de agendar no app da BARBERSHOP L.A:
✂️ Serviço: ${createdAppointment.itemName}
📅 Data: ${formattedDate}
⏰ Horário: ${createdAppointment.time}
👤 Nome: ${createdAppointment.clientName}
💰 Valor: ${createdAppointment.price === 0 ? 'À combinar' : `R$ ${createdAppointment.price.toFixed(2).replace('.', ',')}`} (${createdAppointment.paymentMethod === 'in_person' ? 'Pagar no Local' : createdAppointment.paymentMethod.toUpperCase()})`;

    return `https://wa.me/5511981154340?text=${encodeURIComponent(text)}`;
  };

  const handleResetAndClose = () => {
    setStep(1);
    setChosenItem(null);
    setSelectedSlot('');
    setFormError('');
    setCreatedAppointment(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg rounded-3xl border border-amber-500/40 bg-[#121212] p-5 sm:p-8 shadow-2xl text-neutral-100 max-h-[92vh] overflow-y-auto">
        {/* Botão fechar */}
        <button
          onClick={handleResetAndClose}
          className="absolute top-4 right-4 sm:top-5 sm:right-5 rounded-xl p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Indicador de Passos */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4 mb-5">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold text-sm">
              {step}
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                Agendamento • Passo {step} de {step === 5 ? '5' : '4'}
              </span>
              <h3 className="font-display text-sm sm:text-base font-bold text-white">
                {step === 1 && 'Qual serviço você deseja agendar?'}
                {step === 2 && 'Escolha a Data & Horário'}
                {step === 3 && 'Seus Dados de Contato'}
                {step === 4 && 'Forma de Pagamento'}
                {step === 5 && 'Agendamento Confirmado!'}
              </h3>
            </div>
          </div>
        </div>

        {/* Card do Serviço Escolhido (visível a partir do passo 2) */}
        {step > 1 && step < 5 && chosenItem && (
          <div className="rounded-2xl border border-amber-500/30 bg-neutral-900/90 p-3.5 mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                <Scissors className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] text-neutral-400 uppercase font-bold tracking-wider">Item Selecionado</p>
                <h4 className="font-display text-xs sm:text-sm font-bold text-white">
                  {currentItemName}
                </h4>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="font-display text-sm sm:text-base font-black text-amber-400">
                {currentItemPrice === 0 ? 'À combinar' : `R$ ${currentItemPrice.toFixed(2).replace('.', ',')}`}
              </span>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-[10px] font-semibold text-amber-400/90 hover:text-amber-300 underline"
              >
                Trocar
              </button>
            </div>
          </div>
        )}

        {formError && (
          <div className="mb-4 rounded-xl bg-rose-950/50 border border-rose-800/60 p-3 text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{formError}</span>
          </div>
        )}

        {/* PASSO 1: ESCOLHA DO SERVIÇO OU PACOTE (Sem nada pré-definido) */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-xs text-neutral-400">
              Selecione o atendimento desejado para ver os dias e horários livres:
            </p>

            {/* Abas Serviços / Pacotes */}
            <div className="flex rounded-xl bg-neutral-900 p-1 border border-neutral-800">
              <button
                type="button"
                onClick={() => setItemCategoryTab('services')}
                className={`flex-1 rounded-lg py-2 text-xs font-bold uppercase tracking-wider transition-all ${
                  itemCategoryTab === 'services'
                    ? 'bg-amber-500 text-black shadow-md'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Serviços Individuais
              </button>
              <button
                type="button"
                onClick={() => setItemCategoryTab('packages')}
                className={`flex-1 rounded-lg py-2 text-xs font-bold uppercase tracking-wider transition-all ${
                  itemCategoryTab === 'packages'
                    ? 'bg-amber-500 text-black shadow-md'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Pacotes Mensais
              </button>
            </div>

            {/* Lista de Serviços Individuais */}
            {itemCategoryTab === 'services' && (
              <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
                {services.map((srv) => (
                  <div
                    key={srv.id}
                    onClick={() => handleChooseServiceItem(srv)}
                    className="group cursor-pointer rounded-2xl border border-neutral-800 bg-neutral-900/80 p-3.5 transition-all hover:border-amber-500/60 hover:bg-neutral-850 active:scale-98 flex items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-display text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
                          {srv.name}
                        </h4>
                        {srv.isPopular && (
                          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-400 uppercase">
                            Popular
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-neutral-400 line-clamp-1">
                        {srv.description}
                      </p>
                    </div>

                    <div className="text-right shrink-0 flex items-center gap-2">
                      <span className="font-display text-sm font-black text-amber-400">
                        {srv.price === 0 ? 'À combinar' : `R$ ${srv.price.toFixed(2).replace('.', ',')}`}
                      </span>
                      <ChevronRight className="w-4 h-4 text-neutral-500 group-hover:text-amber-400 transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Lista de Pacotes Mensais */}
            {itemCategoryTab === 'packages' && (
              <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                {packages.map((pkg) => (
                  <div
                    key={pkg.id}
                    onClick={() => handleChooseServiceItem(pkg)}
                    className="group cursor-pointer rounded-2xl border border-amber-500/30 bg-neutral-900/90 p-4 transition-all hover:border-amber-400 hover:bg-neutral-850 active:scale-98 flex flex-col justify-between"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div>
                        <h4 className="font-display text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
                          {pkg.title}
                        </h4>
                        <span className="text-[10px] text-emerald-400 font-semibold">
                          {pkg.economy}
                        </span>
                      </div>
                      <span className="font-display text-base font-black text-amber-400">
                        R$ {pkg.price.toFixed(2).replace('.', ',')}
                        <span className="text-[10px] text-neutral-400 font-normal">/mês</span>
                      </span>
                    </div>

                    <p className="text-[11px] text-neutral-300 mb-2">
                      {pkg.description}
                    </p>

                    <div className="flex items-center justify-between border-t border-neutral-800/80 pt-2 text-[10px] text-amber-400 font-semibold">
                      <span>{pkg.benefits.length} benefícios inclusos</span>
                      <span className="flex items-center gap-1 group-hover:underline">
                        Escolher este pacote <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PASSO 2: DATA E HORÁRIO (Com regra estrita: Domingo até 14h, Segunda fechado) */}
        {step === 2 && (
          <div className="space-y-5">
            {/* Campo de Data */}
            <div>
              <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                <span>Escolha o Dia do Atendimento</span>
              </label>
              <input
                type="date"
                min={todayStr}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm text-white focus:border-amber-500 focus:outline-none"
              />
            </div>

            {/* Aviso do Expediente do Dia */}
            <div
              className={`rounded-xl p-3 text-xs border ${
                isMonday
                  ? 'bg-rose-950/30 border-rose-800/50 text-rose-300'
                  : isSunday
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-300'
              }`}
            >
              <div className="flex items-center gap-2 font-semibold">
                <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{scheduleLabel}</span>
              </div>
              {isSunday && (
                <p className="mt-1 text-[11px] text-amber-300/90">
                  ⚠️ Aos domingos o atendimento encerra pontualmente às 14h. Não há horários após 14h.
                </p>
              )}
              {isMonday && (
                <p className="mt-1 text-[11px] text-rose-300">
                  Barbearia fechada para descanso às segundas-feiras. Por favor, escolha de terça a domingo.
                </p>
              )}
            </div>

            {/* Grid de Horários Disponíveis */}
            {!isMonday && (
              <div>
                <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center justify-between mb-2">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Selecione um Horário Disponível (1h)</span>
                  </span>
                  {selectedSlot && (
                    <span className="text-amber-400 text-xs font-mono font-bold">
                      Selecionado: {selectedSlot}
                    </span>
                  )}
                </label>

                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {availableSlots.map((slot) => {
                    const isSelected = selectedSlot === slot;
                    const isPast = selectedDate === todayStr && new Date(`${selectedDate}T${slot}:00`).getTime() <= Date.now();
                    const isUnavailable = takenTimes.includes(slot) || isPast;
                    return (
                      <button
                        key={slot}
                        type="button"
                        disabled={isUnavailable}
                        onClick={() => setSelectedSlot(slot)}
                        className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center border ${
                          isUnavailable
                            ? 'border-neutral-900 bg-neutral-950 text-neutral-600 cursor-not-allowed line-through'
                            : isSelected
                            ? 'border-amber-400 bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-lg shadow-amber-950/50 scale-102 font-black'
                            : 'border-neutral-800 bg-neutral-900 text-neutral-300 hover:border-amber-500/50 hover:text-white'
                        }`}
                      >
                        <span className="text-sm font-mono">{slot}</span>
                        <span className="text-[9px] uppercase tracking-wider opacity-75">
                          {isUnavailable ? (isPast ? 'Encerrado' : 'Ocupado') : isSelected ? 'Escolhido' : 'Disponível'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 rounded-xl border border-neutral-800 bg-neutral-900 py-3 text-xs font-bold uppercase tracking-wider text-neutral-300 hover:bg-neutral-800"
              >
                Trocar Serviço
              </button>
              <button
                type="button"
                disabled={isMonday || !selectedSlot}
                onClick={handleProceedToClientInfo}
                className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-black uppercase tracking-wider transition-all ${
                  isMonday || !selectedSlot
                    ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-lg shadow-amber-950/40 hover:brightness-110 active:scale-98'
                }`}
              >
                <span>Avançar</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* PASSO 3: DADOS DO CLIENTE */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="rounded-xl bg-neutral-900 border border-neutral-800 p-3 flex items-center justify-between text-xs text-neutral-300">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-400" />
                <span>
                  {selectedDate.split('-').reverse().join('/')} às <strong>{selectedSlot}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="text-amber-400 hover:underline font-semibold"
              >
                Alterar Data/Hora
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5 mb-1">
                <User className="w-3.5 h-3.5 text-amber-400" />
                <span>Nome Completo</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Carlos Eduardo"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-2.5 text-xs text-white focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5 mb-1">
                <Phone className="w-3.5 h-3.5 text-amber-400" />
                <span>WhatsApp com DDD (para confirmação do horário)</span>
              </label>
              <input
                type="tel"
                required
                placeholder="(11) 98888-8888"
                value={clientPhone}
                onChange={(e) => handlePhoneInput(e.target.value)}
                className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-2.5 text-xs text-white focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5 mb-1">
                <Mail className="w-3.5 h-3.5 text-amber-400" />
                <span>E-mail (opcional)</span>
              </label>
              <input
                type="email"
                placeholder="seuemail@exemplo.com"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-2.5 text-xs text-white focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex-1 rounded-xl border border-neutral-800 bg-neutral-900 py-3 text-xs font-bold uppercase tracking-wider text-neutral-300 hover:bg-neutral-800"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleProceedToPayment}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 py-3 text-xs font-black uppercase tracking-wider text-black shadow-lg hover:brightness-110 active:scale-98"
              >
                <span>Avançar para Pagamento</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* PASSO 4: FORMA DE PAGAMENTO */}
        {step === 4 && (
          <div className="space-y-4">
            <p className="text-xs text-neutral-400">
              Escolha como prefere acertar seu atendimento:
            </p>

            <div className="space-y-2.5">
              {/* Opção 1: Pagar no Local */}
              <label
                onClick={() => setPaymentMethod('in_person')}
                className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  paymentMethod === 'in_person'
                    ? 'border-amber-500 bg-amber-500/10'
                    : 'border-neutral-800 bg-neutral-900 hover:border-neutral-700'
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  checked={paymentMethod === 'in_person'}
                  onChange={() => setPaymentMethod('in_person')}
                  className="mt-1 text-amber-500 focus:ring-amber-500"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 font-bold text-white text-xs">
                    <DollarSign className="w-4 h-4 text-amber-400" />
                    <span>Pagar no Local (Cadeira do Barbeiro)</span>
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    Pague em dinheiro, Pix ou cartão diretamente com o Leonardo após o corte.
                  </p>
                </div>
              </label>

              {/* Opção 2: Pix com QR Code */}
              <label
                onClick={() => onlineAllowed && setPaymentMethod('pix')}
                className={`${!onlineAllowed ? 'opacity-40 pointer-events-none ' : ''}flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  paymentMethod === 'pix'
                    ? 'border-amber-500 bg-amber-500/10'
                    : 'border-neutral-800 bg-neutral-900 hover:border-neutral-700'
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  checked={paymentMethod === 'pix'}
                  onChange={() => setPaymentMethod('pix')}
                  className="mt-1 text-amber-500 focus:ring-amber-500"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 font-bold text-white text-xs">
                    <QrCode className="w-4 h-4 text-emerald-400" />
                    <span>Pix (Mercado Pago)</span>
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    Pague pelo Pix no ambiente seguro do Mercado Pago. Confirmação automática.
                  </p>
                </div>
              </label>

              {/* Opção 3: Cartão de Crédito */}
              <label
                onClick={() => onlineAllowed && setPaymentMethod('card')}
                className={`${!onlineAllowed ? 'opacity-40 pointer-events-none ' : ''}flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  paymentMethod === 'card'
                    ? 'border-amber-500 bg-amber-500/10'
                    : 'border-neutral-800 bg-neutral-900 hover:border-neutral-700'
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  checked={paymentMethod === 'card'}
                  onChange={() => setPaymentMethod('card')}
                  className="mt-1 text-amber-500 focus:ring-amber-500"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 font-bold text-white text-xs">
                    <CreditCard className="w-4 h-4 text-blue-400" />
                    <span>Cartão de Crédito / Débito</span>
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    Pague no ambiente seguro do Mercado Pago. Seus dados de cartão não passam pelo nosso app.
                  </p>
                </div>
              </label>
            </div>

            {isOnline && (
              <div className="rounded-xl bg-sky-500/10 border border-sky-500/30 p-3 text-[11px] text-sky-200/90">
                🔒 Você será levado ao <strong>Mercado Pago</strong> para pagar. Seu horário fica reservado por <strong>15 minutos</strong>; se o pagamento não for concluído, ele é liberado automaticamente.
              </div>
            )}
            {!onlineAllowed && (
              <div className="rounded-xl bg-neutral-900 border border-neutral-800 p-3 text-[11px] text-neutral-400">
                Este item é "à combinar", então só está disponível pagamento no local.
              </div>
            )}

            {/* Resumo Financeiro */}
            <div className="rounded-xl bg-neutral-900 border border-neutral-800 p-3.5 space-y-1 text-xs">
              <div className="flex justify-between text-neutral-400">
                <span>Atendimento:</span>
                <span className="text-white font-medium">{currentItemName}</span>
              </div>
              <div className="flex justify-between text-neutral-400">
                <span>Data e Hora:</span>
                <span className="text-white font-medium">
                  {selectedDate.split('-').reverse().join('/')} às {selectedSlot}
                </span>
              </div>
              <div className="flex justify-between text-neutral-400 border-t border-neutral-800 pt-2 font-bold">
                <span className="text-white">Total a pagar:</span>
                <span className="text-amber-400 font-display text-sm">
                  {currentItemPrice === 0 ? 'À combinar' : `R$ ${currentItemPrice.toFixed(2).replace('.', ',')}`}
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="flex-1 rounded-xl border border-neutral-800 bg-neutral-900 py-3 text-xs font-bold uppercase tracking-wider text-neutral-300 hover:bg-neutral-800"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleConfirmAppointment}
                disabled={isSubmitting}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 py-3 text-xs font-black uppercase tracking-wider text-black shadow-lg hover:brightness-110 active:scale-98"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSubmitting ? (isOnline ? 'Abrindo Mercado Pago...' : 'Confirmando...') : isOnline ? 'Pagar com Mercado Pago' : 'Confirmar Agendamento'}</span>
              </button>
            </div>
          </div>
        )}

        {/* PASSO 5: AGENDAMENTO CONCLUÍDO & COMPROVANTE */}
        {step === 5 && createdAppointment && (
          <div className="text-center space-y-5 animate-fade-in py-2">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 mx-auto flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                Agendamento Confirmado com Sucesso!
              </span>
              <h3 className="font-display text-xl font-bold text-white mt-1">
                Te esperamos na cadeira!
              </h3>
              <p className="text-xs text-neutral-400 mt-1">
                Guardamos seu horário exclusivo com Leonardo Arruda na BARBERSHOP L.A.
              </p>
            </div>

            {/* Cartão Comprovante */}
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/90 p-4 text-xs text-left space-y-2">
              <div className="flex justify-between border-b border-neutral-800 pb-2">
                <span className="text-neutral-400">Código da Reserva:</span>
                <span className="font-mono text-amber-400 font-bold">{createdAppointment.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Cliente:</span>
                <span className="text-white font-medium">{createdAppointment.clientName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">WhatsApp:</span>
                <span className="text-white font-medium">{createdAppointment.clientPhone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Serviço:</span>
                <span className="text-white font-medium">{createdAppointment.itemName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Data e Horário:</span>
                <span className="text-amber-300 font-bold">
                  {createdAppointment.date.split('-').reverse().join('/')} às {createdAppointment.time}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Forma de Pagamento:</span>
                <span className="text-neutral-200 uppercase font-semibold">
                  {createdAppointment.paymentMethod === 'in_person'
                    ? 'Pagar na Barbearia'
                    : createdAppointment.paymentMethod.toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between border-t border-neutral-800 pt-2 font-bold">
                <span className="text-white">Valor:</span>
                <span className="text-amber-400 font-display text-sm">
                  {createdAppointment.price === 0 ? 'À combinar' : `R$ ${createdAppointment.price.toFixed(2).replace('.', ',')}`}
                </span>
              </div>
            </div>

            {/* Aviso de Cancelamento até 2h */}
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-left text-[11px] text-amber-200/90">
              ℹ️ <strong>Regra de Cancelamento:</strong> Você pode cancelar diretamente pelo aplicativo até <strong>2 horas antes</strong> do horário marcado. Após isso, o botão é bloqueado e deve ser comunicado pelo WhatsApp.
            </div>

            {/* Botão de Avisar no WhatsApp */}
            <a
              href={getWhatsAppConfirmationUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 py-3.5 text-xs font-black uppercase text-white shadow-lg shadow-emerald-950/40 transition-all"
            >
              <MessageCircle className="w-4 h-4 fill-white text-emerald-600" />
              <span>Avisar Leonardo no WhatsApp</span>
            </a>

            <button
              onClick={handleResetAndClose}
              className="w-full rounded-xl border border-neutral-800 bg-neutral-900 py-2.5 text-xs font-bold uppercase text-neutral-300 hover:text-white"
            >
              Concluir & Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

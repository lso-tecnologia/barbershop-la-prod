import React from 'react';
import { MapPin, Clock, Navigation, ExternalLink, Calendar, CheckCircle2 } from 'lucide-react';

export const HoursAndLocation: React.FC = () => {
  const mapUrl = 'https://maps.google.com/?q=' + encodeURIComponent('Rua Vera, 247, Barueri - SP');

  const businessHours = [
    { day: 'Segunda-feira', hours: 'Fechado', isOpen: false, note: 'Dia de descanso' },
    { day: 'Terça-feira', hours: '09h às 19h', isOpen: true, note: 'Slots de 30 min' },
    { day: 'Quarta-feira', hours: '09h às 19h', isOpen: true, note: 'Slots de 30 min' },
    { day: 'Quinta-feira', hours: '09h às 19h', isOpen: true, note: 'Slots de 30 min' },
    { day: 'Sexta-feira', hours: '09h às 19h', isOpen: true, note: 'Slots de 30 min' },
    { day: 'Sábado', hours: '09h às 19h', isOpen: true, note: 'Slots de 30 min' },
    { day: 'Domingo', hours: '09h às 14h', isOpen: true, note: 'Slots de 30 min (até 13h30)' },
  ];

  return (
    <section id="localizacao" className="py-16 sm:py-24 max-w-6xl mx-auto px-4 sm:px-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Card do Endereço & Mapa */}
        <div className="lg:col-span-6 rounded-3xl border border-neutral-800 bg-[#121212] p-6 sm:p-8 shadow-xl space-y-6">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-400 mb-2">
              <MapPin className="w-3.5 h-3.5" />
              <span>Onde Estamos</span>
            </div>
            <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-wide">
              Localização <span className="text-gold-gradient">Privilegiada</span>
            </h3>
            <p className="text-xs sm:text-sm text-neutral-400 mt-1">
              Fácil acesso, ambiente aconchegante e rua tranquila em Barueri.
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-5 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                <Navigation className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-neutral-400 uppercase tracking-widest font-bold">Endereço da Cadeira</p>
                <p className="text-base sm:text-lg font-bold text-white mt-0.5">
                  Rua Vera, 247
                </p>
                <p className="text-xs sm:text-sm text-neutral-300">
                  Barueri — São Paulo • CEP 06400-000
                </p>
              </div>
            </div>

            <a
              href={mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 py-3 text-xs font-black uppercase text-black tracking-wider transition-all hover:brightness-110 active:scale-98 shadow-lg shadow-amber-950/40"
            >
              <span>Abrir no Google Maps / Waze</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          {/* Destaques do Ambiente */}
          <div className="pt-2 border-t border-neutral-800/80 space-y-2.5">
            <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
              Comodidades para você relaxar:
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs text-neutral-400">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Ambiente climatizado</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Wi-Fi de alta velocidade</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Café e água gelada</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Som ambiente de qualidade</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card do Horário de Atendimento */}
        <div className="lg:col-span-6 rounded-3xl border border-neutral-800 bg-[#121212] p-6 sm:p-8 shadow-xl space-y-6">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-400 mb-2">
              <Clock className="w-3.5 h-3.5" />
              <span>Expediente</span>
            </div>
            <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-wide">
              Horário de <span className="text-gold-gradient">Funcionamento</span>
            </h3>
            <p className="text-xs sm:text-sm text-neutral-400 mt-1">
              Atendimentos fracionados de 30 em 30 minutos com pontualidade e dedicação exclusiva para cada cliente.
            </p>
          </div>

          <div className="space-y-2 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
            {businessHours.map((item, idx) => (
              <div
                key={idx}
                className={`flex items-center justify-between py-2.5 px-3 rounded-xl transition-colors ${
                  item.isOpen
                    ? 'hover:bg-neutral-800/60'
                    : 'bg-rose-950/20 text-rose-300 border border-rose-900/30'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${item.isOpen ? 'bg-amber-400' : 'bg-rose-500'}`} />
                  <span className="text-xs sm:text-sm font-semibold text-neutral-200">
                    {item.day}
                  </span>
                </div>

                <div className="text-right">
                  <span
                    className={`text-xs sm:text-sm font-bold ${
                      item.isOpen ? 'text-amber-300' : 'text-rose-400 font-extrabold'
                    }`}
                  >
                    {item.hours}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3.5 text-xs text-amber-200/90 leading-relaxed">
            <strong>Dica de agendamento:</strong> Sextas e sábados costumam ter alta procura. Recomendamos agendar seu horário com antecedência!
          </div>
        </div>
      </div>
    </section>
  );
};

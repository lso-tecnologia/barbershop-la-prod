import React from 'react';
import { Scissors, Check, Sparkles, Flame, Clock } from 'lucide-react';
import { ServiceItem, PromoPackage } from '../types/barbershop';

interface ServicesTableProps {
  services: ServiceItem[];
  packages: PromoPackage[];
  onSelectService?: (item: ServiceItem | PromoPackage) => void;
}

export const ServicesTable: React.FC<ServicesTableProps> = ({
  services,
  packages,
  onSelectService,
}) => {
  return (
    <section id="servicos" className="py-16 sm:py-24 max-w-6xl mx-auto px-4 sm:px-6">
      {/* Cabeçalho */}
      <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-semibold text-amber-400 mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Tabela Oficial</span>
        </div>
        <h2 className="font-display text-2xl sm:text-4xl font-extrabold text-white uppercase tracking-wider">
          Serviços & <span className="text-gold-gradient">Valores</span>
        </h2>
        <p className="mt-2 text-xs sm:text-sm text-neutral-400">
          Cortes precisos, barba alinhada na navalha e cuidados capilares de alta qualidade.
        </p>
      </div>

      {/* Grid de Serviços Individuais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-16">
        {services.map((service) => (
          <div
            key={service.id}
            className={`group relative rounded-2xl border p-5 transition-all duration-300 hover:-translate-y-1 ${
              service.isPopular
                ? 'border-amber-500/50 bg-[#141414] shadow-xl shadow-amber-950/20'
                : 'border-neutral-800 bg-[#111111] hover:border-neutral-700'
            }`}
          >
            {service.isPopular && (
              <span className="absolute -top-3 right-4 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 px-3 py-0.5 text-[10px] font-black uppercase text-black tracking-widest shadow-md">
                <Flame className="w-3 h-3" />
                Mais pedido
              </span>
            )}

            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <h3 className="font-display text-base font-bold text-white group-hover:text-amber-300 transition-colors">
                  {service.name}
                </h3>
                <span className="inline-flex items-center gap-1 text-[11px] text-neutral-400 mt-0.5">
                  <Clock className="w-3 h-3 text-amber-500/80" />
                  {service.durationMinutes} min
                </span>
              </div>

              <div className="text-right">
                <span className="font-display text-xl font-extrabold text-amber-400">
                  {service.price === 0 ? 'À combinar' : `R$ ${service.price.toFixed(2).replace('.', ',')}`}
                </span>
              </div>
            </div>

            <p className="text-xs text-neutral-400 leading-relaxed mb-4">
              {service.description}
            </p>

            <button
              onClick={() => onSelectService && onSelectService(service)}
              className="w-full rounded-xl border border-neutral-700 bg-neutral-900/80 py-2.5 text-xs font-bold text-neutral-200 uppercase tracking-wider transition-all hover:border-amber-500/60 hover:bg-amber-500/10 hover:text-amber-300 active:scale-98"
            >
              Agendar {service.name}
            </button>
          </div>
        ))}
      </div>

      {/* Destaque dos Pacotes Mensais */}
      <div id="promocoes" className="relative rounded-3xl border border-amber-500/30 bg-gradient-to-b from-[#141414] to-[#0d0d0d] p-6 sm:p-10 shadow-2xl overflow-hidden">
        {/* Glow ornamental */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="text-center max-w-xl mx-auto mb-8 sm:mb-10">
          <span className="text-xs font-black uppercase tracking-widest text-amber-400">
            Mais cuidados, mais economia!
          </span>
          <h3 className="font-display text-xl sm:text-3xl font-extrabold text-white mt-1 uppercase tracking-wider">
            Planos & <span className="text-gold-gradient">Pacotes Mensais</span>
          </h3>
          <p className="text-xs sm:text-sm text-neutral-400 mt-2">
            Mantenha seu visual impecável o mês inteiro com economia real e horários prioritários.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className={`relative rounded-2xl border p-6 flex flex-col justify-between transition-all ${
                pkg.isFeatured
                  ? 'border-amber-500 bg-[#181818] shadow-2xl shadow-amber-950/40 ring-1 ring-amber-500/40'
                  : 'border-neutral-800 bg-[#121212] hover:border-neutral-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-display text-lg font-bold text-white tracking-wide">
                    {pkg.title}
                  </h4>
                  <span className="rounded-md bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                    {pkg.economy}
                  </span>
                </div>

                <div className="flex items-baseline gap-1 mb-4">
                  <span className="font-display text-3xl font-black text-amber-400">
                    R$ {pkg.price.toFixed(2).replace('.', ',')}
                  </span>
                  <span className="text-xs text-neutral-400">/mês</span>
                </div>

                <p className="text-xs text-neutral-300 mb-5 leading-relaxed">
                  {pkg.description}
                </p>

                <div className="space-y-2.5 mb-6 border-t border-neutral-800 pt-4">
                  {pkg.benefits.map((benefit, idx) => (
                    <div key={idx} className="flex items-center gap-2.5 text-xs text-neutral-300">
                      <div className="w-4 h-4 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                        <Check className="w-3 h-3" />
                      </div>
                      <span>{benefit}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => onSelectService && onSelectService(pkg)}
                className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 py-3 text-xs font-black uppercase text-black tracking-wider transition-all hover:brightness-110 active:scale-98 shadow-lg shadow-amber-950/40"
              >
                Garantir {pkg.title}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

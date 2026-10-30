import React from 'react';
import { Scissors, Calendar, MapPin, ChevronDown, Sparkles } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';
import { OpenStatusBadge } from './OpenStatusBadge';

interface HeroSectionProps {
  isOpen: boolean;
  onToggleDemoStatus?: () => void;
  onBookNow: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  isOpen,
  onBookNow,
}) => {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden bg-black text-white">
      {/* Imagem de Fundo (Foto real do Pôster / Espaço Clássico com Cadeira Caramelo) */}
      <div className="absolute inset-0 z-0">
        <img
          src="/assets/aistudio/WhatsApp_Image_2026-10-24_at_16.19.02_2143161f.jpeg"
          alt="Barbearia BARBERSHOP L.A interior e cadeira clássica"
          className="w-full h-full object-cover object-center filter brightness-[0.38] contrast-[1.1] scale-102"
        />
        {/* Degradê preto nas bordas para integração suave */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#080808] via-black/60 to-black/80" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-black/90" />
      </div>

      {/* Conteúdo Central */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-20 text-center space-y-6 sm:space-y-8 animate-fade-in">
        {/* Badge de Aberto/Fechado + Localização */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <OpenStatusBadge isOpen={isOpen} />
          <div className="inline-flex items-center gap-1.5 rounded-full border border-neutral-800 bg-black/60 px-3.5 py-1.5 text-xs text-neutral-300 backdrop-blur-md">
            <MapPin className="w-3.5 h-3.5 text-amber-400" />
            <span>Rua Vera, 247 — Barueri/SP</span>
          </div>
        </div>

        {/* Título Principal & Identidade */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 text-amber-400 text-xs sm:text-sm font-bold tracking-widest uppercase">
            <Sparkles className="w-4 h-4" />
            <span>BARBEARIA PREMIUM EM BARUERI</span>
            <Sparkles className="w-4 h-4" />
          </div>

          <h1 className="font-display text-4xl sm:text-6xl md:text-7xl font-black uppercase tracking-tight text-white drop-shadow-2xl">
            BARBERSHOP <span className="text-gold-gradient">L.A</span>
          </h1>

          <p className="font-script text-xl sm:text-2xl md:text-3xl text-amber-200/95 font-medium tracking-wide">
            "Seu estilo, nossa arte."
          </p>
        </div>

        {/* Frase de apoio e diferenciais */}
        <p className="max-w-2xl mx-auto text-xs sm:text-base text-neutral-300 leading-relaxed font-light">
          Cortes precisos, acabamento navalhado impecável e barba alinhada com maestria. Atendimento personalizado com <strong className="text-white font-semibold">Leonardo Arruda</strong> para você sair sempre com a autoestima no topo.
        </p>

        {/* Três Diferenciais */}
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-xs sm:text-sm font-semibold text-neutral-300 pt-1">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Profissionais qualificados
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Produtos premium
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Ambiente confortável
          </span>
        </div>

        {/* Botões de Ação */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-4">
          <button
            onClick={onBookNow}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 px-8 py-4 text-sm font-black uppercase tracking-wider text-black shadow-2xl shadow-amber-950/60 transition-all hover:scale-105 active:scale-95 hover:brightness-110"
          >
            <Calendar className="w-4 h-4 text-black" />
            <span>Agendar Horário Agora</span>
          </button>

          <a
            href="#servicos"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-700 bg-neutral-900/80 px-6 py-4 text-xs font-bold uppercase tracking-wider text-neutral-200 backdrop-blur-sm hover:border-amber-500/50 hover:bg-neutral-800 transition-colors"
          >
            <Scissors className="w-4 h-4 text-amber-400" />
            <span>Ver Tabela de Preços</span>
          </a>
        </div>

        {/* Celular: botão grande para baixar o app (some se já estiver instalado) */}
        <div className="sm:hidden mx-auto max-w-xs">
          <PWAInstallButton variant="banner" />
        </div>

        {/* Indicador de rolagem */}
        <div className="pt-8">
          <a
            href="#servicos"
            className="inline-flex flex-col items-center text-[10px] text-neutral-400 hover:text-amber-400 transition-colors"
            aria-label="Rolar para ver serviços"
          >
            <span className="uppercase tracking-widest font-semibold mb-1">Explorar</span>
            <ChevronDown className="w-4 h-4 animate-bounce text-amber-400" />
          </a>
        </div>
      </div>
    </section>
  );
};
import React from 'react';
import { Award, Heart, Wrench, Scissors, ShieldCheck, Sparkles } from 'lucide-react';
import { BarberProfile } from '../types/barbershop';

interface BarberProfileSectionProps {
  profile: BarberProfile;
}

export const BarberProfileSection: React.FC<BarberProfileSectionProps> = ({ profile }) => {
  return (
    <section id="sobre" className="relative py-16 sm:py-24 bg-gradient-to-b from-[#0a0a0a] via-[#101010] to-[#0a0a0a] border-y border-neutral-900 overflow-hidden">
      {/* Luz dourada de fundo sutil */}
      <div className="absolute top-1/2 left-0 -translate-y-1/2 w-72 h-72 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Cabeçalho da Seção */}
        <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-semibold text-amber-400 mb-3">
            <Scissors className="w-3.5 h-3.5" />
            <span>Mestre da Navalha & Tesoura</span>
          </div>
          <h2 className="font-display text-2xl sm:text-4xl font-extrabold text-white uppercase tracking-wider">
            Conheça o <span className="text-gold-gradient">Barbeiro</span>
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-neutral-400">
            Mais que um corte, um ritual de cuidado, respeito e confiança em Barueri.
          </p>
        </div>

        {/* Grid com História e Fotos Autênticas */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Card Principal de Fotos (Filho + Projeto na Garagem) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Foto 1: Leonardo com o Filho */}
            <div className="relative group overflow-hidden rounded-2xl border border-amber-500/30 bg-neutral-900 shadow-2xl">
              <img
                src={profile.familyPhotoUrl}
                alt="Leonardo Arruda com seu filho na barbearia"
                className="w-full h-80 object-cover object-center transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent flex flex-col justify-end p-5">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-400 tracking-wider uppercase mb-1">
                  <Heart className="w-3.5 h-3.5 fill-amber-400" />
                  Minha maior motivação
                </span>
                <p className="text-xs text-neutral-200">
                  Leonardo Arruda & seu filho — a razão de dar o meu melhor todos os dias.
                </p>
              </div>
            </div>

            {/* Foto 2: Paixão por Carros & Garagem */}
            <div className="relative group overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900 shadow-xl">
              <div className="flex items-center gap-3 p-3">
                <img
                  src={profile.hobbyPhotoUrl}
                  alt="Leonardo mexendo no projeto do carro na garagem"
                  className="w-20 h-20 rounded-lg object-cover border border-amber-500/20 shrink-0"
                  loading="lazy"
                />
                <div>
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                    <Wrench className="w-3 h-3 text-amber-400" />
                    Refúgio na Garagem
                  </span>
                  <p className="text-xs text-neutral-300 mt-0.5 line-clamp-2">
                    Apaixonado por carros, projetos e som automotivo nas horas vagas.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Biografia e Destaques */}
          <div className="lg:col-span-7 space-y-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-wide">
                  {profile.name}
                </h3>
                <span className="rounded-full bg-amber-500/20 border border-amber-500/40 px-2.5 py-0.5 text-[10px] font-bold text-amber-300 uppercase">
                  8 anos de estrada
                </span>
              </div>
              <p className="text-xs sm:text-sm text-amber-400/90 font-medium tracking-wide">
                Fundador & Barbeiro Responsável • BARBERSHOP L.A
              </p>
            </div>

            {/* Texto de Apresentação da Cadeira */}
            <div className="relative rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 sm:p-7 backdrop-blur-sm shadow-xl">
              <span className="absolute -top-3 left-6 bg-gradient-to-r from-amber-500 to-amber-600 px-3 py-0.5 rounded text-[10px] font-black uppercase text-black tracking-widest">
                Mensagem do Barbeiro
              </span>
              <p className="text-sm sm:text-base text-neutral-200 leading-relaxed italic font-serif">
                "{profile.bio}"
              </p>
            </div>

            {/* Três Pilares / Diferenciais do Negócio */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2">
              <div className="rounded-xl border border-neutral-800/80 bg-neutral-900/40 p-4 transition-colors hover:border-amber-500/30">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-2.5">
                  <Award className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Qualificação</h4>
                <p className="text-[11px] text-neutral-400 mt-1">
                  8 anos de técnica apurada em cortes clássicos, degradês e barba.
                </p>
              </div>

              <div className="rounded-xl border border-neutral-800/80 bg-neutral-900/40 p-4 transition-colors hover:border-amber-500/30">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-2.5">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Produtos Premium</h4>
                <p className="text-[11px] text-neutral-400 mt-1">
                  Pomadas, óleos e loções das melhores marcas para proteger seus fios.
                </p>
              </div>

              <div className="rounded-xl border border-neutral-800/80 bg-neutral-900/40 p-4 transition-colors hover:border-amber-500/30">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-2.5">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Conforto Total</h4>
                <p className="text-[11px] text-neutral-400 mt-1">
                  Cadeira reclinável premium, climatização e resenha de primeira.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

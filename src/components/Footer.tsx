import React from 'react';
import { Scissors, ShieldCheck, Heart, MapPin, Phone, Clock, Lock } from 'lucide-react';

interface FooterProps {
  onOpenBarberLogin?: () => void;
  onOpenPrivacyModal?: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  onOpenBarberLogin,
  onOpenPrivacyModal,
}) => {
  return (
    <footer className="border-t border-neutral-900 bg-[#070707] text-neutral-400">
      {/* Faixa decorativa clássica de barbearia */}
      <div className="h-1.5 w-full barber-pole-stripe opacity-80" />

      {/* Chamada Final */}
      <div className="border-b border-neutral-900 py-12 px-4 text-center">
        <div className="max-w-2xl mx-auto space-y-3">
          <span className="text-[11px] font-black uppercase tracking-widest text-amber-400">
            Mais cuidados, mais economia!
          </span>
          <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-white uppercase tracking-wider">
            Agende seu horário e <span className="text-gold-gradient">realce sua melhor versão!</span>
          </h3>
          <p className="text-xs sm:text-sm text-neutral-400 font-script italic">
            "Seu estilo, nossa arte."
          </p>
          <div className="pt-2">
            <a
              href="#servicos"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-3 text-xs font-black uppercase text-black tracking-wider shadow-xl shadow-amber-950/40 hover:brightness-110 transition-all"
            >
              Escolher Serviço & Horário
            </a>
          </div>
        </div>
      </div>

      {/* Conteúdo do Rodapé */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 grid grid-cols-1 md:grid-cols-4 gap-8 text-xs">
        {/* Coluna 1: Marca & Slogan */}
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Scissors className="w-4 h-4" />
            </div>
            <span className="font-display text-base font-extrabold text-white tracking-wider">
              BARBERSHOP <span className="text-gold-gradient">L.A</span>
            </span>
          </div>
          <p className="text-neutral-400 text-xs leading-relaxed">
            Profissionais qualificados • Produtos premium • Ambiente confortável. Atendimento exclusivo com Leonardo Arruda.
          </p>
          <p className="text-[11px] text-amber-400/80 font-medium">
            Barueri — SP • Brasil
          </p>
        </div>

        {/* Coluna 2: Links Rápidos */}
        <div className="space-y-2.5">
          <h4 className="font-display text-xs font-bold text-white uppercase tracking-wider">
            Navegação
          </h4>
          <ul className="space-y-2 text-neutral-400">
            <li><a href="#servicos" className="hover:text-amber-400 transition-colors">Tabela de Serviços</a></li>
            <li><a href="#promocoes" className="hover:text-amber-400 transition-colors">Pacotes Promocionais</a></li>
            <li><a href="#sobre" className="hover:text-amber-400 transition-colors">História do Leonardo Arruda</a></li>
            <li><a href="#galeria" className="hover:text-amber-400 transition-colors">Galeria de Cortes</a></li>
            <li><a href="#localizacao" className="hover:text-amber-400 transition-colors">Horário e Localização</a></li>
          </ul>
        </div>

        {/* Coluna 3: Contato & Atendimento */}
        <div className="space-y-2.5">
          <h4 className="font-display text-xs font-bold text-white uppercase tracking-wider">
            Atendimento
          </h4>
          <div className="space-y-2 text-neutral-400">
            <div className="flex items-start gap-2">
              <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <span>Rua Vera, 247 — Barueri/SP</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>(11) 98115-4340</span>
            </div>
            <div className="flex items-start gap-2">
              <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <span>Ter a Sáb: 09h às 19h | Dom: 09h às 14h</span>
            </div>
          </div>
        </div>

        {/* Coluna 4: Acesso Administrativo & LGPD */}
        <div className="space-y-3">
          <h4 className="font-display text-xs font-bold text-white uppercase tracking-wider">
            Área Restrita & Segurança
          </h4>
          <p className="text-[11px] text-neutral-400 leading-relaxed">
            Plataforma protegida com criptografia ponta a ponta e conformidade com a LGPD.
          </p>
          <button
            onClick={onOpenBarberLogin}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-[11px] font-semibold text-neutral-300 hover:border-amber-500/40 hover:text-white transition-colors"
          >
            <Lock className="w-3 h-3 text-amber-400" />
            <span>Acesso do Barbeiro (2FA)</span>
          </button>
        </div>
      </div>

      {/* Linha inferior de Direitos & LGPD */}
      <div className="border-t border-neutral-900/80 py-6 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-neutral-400">
          <p>
            © {new Date().getFullYear()} BARBERSHOP L.A. Todos os direitos reservados.
          </p>

          <div className="flex items-center gap-4">
            <button
              onClick={onOpenPrivacyModal}
              className="hover:text-amber-400 transition-colors underline"
            >
              Política de Privacidade & LGPD
            </button>
            <span>•</span>
            <span className="flex items-center gap-1 text-neutral-400">
              Feito com <Heart className="w-3 h-3 text-rose-500 fill-rose-500" /> para Barueri
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};

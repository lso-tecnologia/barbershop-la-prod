import React from 'react';
import { X, ShieldCheck } from 'lucide-react';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg rounded-3xl border border-neutral-800 bg-[#121212] p-6 sm:p-8 shadow-2xl text-neutral-100 max-h-[85vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 rounded-xl p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold text-white">
              Política de Privacidade & LGPD
            </h3>
            <p className="text-xs text-neutral-400">BARBERSHOP L.A • Barueri/SP</p>
          </div>
        </div>

        <div className="space-y-4 text-xs text-neutral-300 leading-relaxed">
          <section>
            <h4 className="font-bold text-white uppercase text-[11px] mb-1">1. Coleta e Uso de Dados</h4>
            <p>
              Coletamos estritamente os dados necessários para o agendamento e identificação na cadeira: Nome completo, Telefone celular (para confirmação e lembretes via WhatsApp) e E-mail.
            </p>
          </section>

          <section>
            <h4 className="font-bold text-white uppercase text-[11px] mb-1">2. Dados Financeiros & Pagamentos</h4>
            <p>
              A BARBERSHOP L.A <strong>não armazena números de cartão de crédito</strong> ou códigos de segurança. Todos os pagamentos processados via Pix ou Cartão trafegam diretamente pela infraestrutura criptografada e certificada do Mercado Pago.
            </p>
          </section>

          <section>
            <h4 className="font-bold text-white uppercase text-[11px] mb-1">3. Direitos do Titular (LGPD)</h4>
            <p>
              Você tem total direito de consultar, corrigir ou solicitar a exclusão definitiva dos seus dados e histórico de agendamentos a qualquer momento através do seu painel do cliente ou pelo WhatsApp oficial.
            </p>
          </section>

          <section>
            <h4 className="font-bold text-white uppercase text-[11px] mb-1">4. Segurança da Informação</h4>
            <p>
              Aplicamos proteção contra acessos indevidos (OWASP Top 10), senhas criptografadas e tráfego exclusivo sob certificado SSL/TLS (HTTPS).
            </p>
          </section>
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 py-3 text-xs font-bold uppercase text-black tracking-wider"
        >
          Compreendido e de Acordo
        </button>
      </div>
    </div>
  );
};

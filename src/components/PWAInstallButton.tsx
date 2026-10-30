import React, { useState } from 'react';
import { Download, Share2, PlusSquare, X, Smartphone, MoreVertical } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
  /** "banner" = botão grande, largura total (para o celular) */
  variant?: 'default' | 'banner';
}

/**
 * Botão "Baixar agora".
 *  - Android/Chrome com instalação disponível: instala com um toque.
 *  - Android sem o aviso do navegador, e iPhone: abre um guia curto de como adicionar à tela inicial.
 *  - Computador: só aparece se o navegador permitir instalar.
 *  - Já instalado: não aparece.
 */
export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ compact = false, variant = 'default' }) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) return null;

  const isMobileDevice = isIOS || isAndroid;
  if (!isInstallable && !isMobileDevice) return null;

  const size =
    variant === 'banner'
      ? 'w-full justify-center px-6 py-3.5 text-sm'
      : compact
        ? 'px-2.5 py-1 text-[11px]'
        : 'px-3.5 py-1.5 text-xs';

  const handleClick = () => {
    if (isInstallable) void install();
    else setShowGuide(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 font-black uppercase tracking-wider text-black shadow-lg shadow-amber-500/20 transition-all hover:brightness-110 active:scale-95 ${size}`}
        title="Baixar o app da barbearia"
      >
        <Download className="w-4 h-4 text-black" />
        <span>Baixar agora</span>
      </button>

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-sm rounded-2xl border border-amber-500/30 bg-[#121212] p-6 text-neutral-200 shadow-2xl">
            <button
              onClick={() => setShowGuide(false)}
              className="absolute top-4 right-4 rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display text-base font-bold text-white">Baixar o app</h3>
                <p className="text-xs text-neutral-400">BARBERSHOP L.A • {isIOS ? 'iPhone' : 'Android'}</p>
              </div>
            </div>

            <div className="space-y-3.5 text-xs text-neutral-300">
              {isIOS ? (
                <>
                  <div className="flex items-start gap-3 rounded-xl bg-neutral-900/80 p-3 border border-neutral-800">
                    <Share2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>1. Abra este site no <strong>Safari</strong> e toque em <strong>Compartilhar</strong> (barra inferior).</span>
                  </div>
                  <div className="flex items-start gap-3 rounded-xl bg-neutral-900/80 p-3 border border-neutral-800">
                    <PlusSquare className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>2. Role e toque em <strong>Adicionar à Tela de Início</strong>.</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-3 rounded-xl bg-neutral-900/80 p-3 border border-neutral-800">
                    <MoreVertical className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>1. No <strong>Chrome</strong>, toque nos <strong>três pontinhos (⋮)</strong> no canto superior.</span>
                  </div>
                  <div className="flex items-start gap-3 rounded-xl bg-neutral-900/80 p-3 border border-neutral-800">
                    <PlusSquare className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>2. Toque em <strong>Instalar app</strong> (ou <strong>Adicionar à tela inicial</strong>) e confirme.</span>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => setShowGuide(false)}
              className="mt-5 w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 py-2.5 text-xs font-bold text-black uppercase tracking-wider transition-opacity hover:opacity-95"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};

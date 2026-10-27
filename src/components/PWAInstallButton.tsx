import React, { useState } from 'react';
import { Download, Share2, PlusSquare, X, Smartphone } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // Se já estiver instalado como app nativo standalone, não exibe
  if (isInstalled) {
    return null;
  }

  // Fluxo Android / Chromium / Desktop
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className={`group relative inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-3.5 py-1.5 text-xs font-semibold text-black shadow-lg shadow-amber-500/20 transition-all hover:brightness-110 active:scale-95 ${
          compact ? 'text-[11px] px-2.5 py-1' : ''
        }`}
        title="Baixar o app da barbearia"
      >
        <Download className="w-3.5 h-3.5 text-black animate-bounce" />
        <span>Baixar agora</span>
      </button>
    );
  }

  // Fluxo iOS Safari
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className={`inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300 transition-colors hover:bg-amber-500/20 active:scale-95 ${
            compact ? 'text-[11px] px-2.5 py-1' : ''
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Baixar agora</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fade-in">
            <div className="relative w-full max-w-sm rounded-2xl border border-amber-500/30 bg-[#121212] p-6 text-neutral-200 shadow-2xl">
              <button
                onClick={() => setShowIOSGuide(false)}
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
                  <p className="text-xs text-neutral-400">PWA BARBERSHOP L.A</p>
                </div>
              </div>

              <div className="space-y-3.5 text-xs text-neutral-300">
                <div className="flex items-start gap-3 rounded-xl bg-neutral-900/80 p-3 border border-neutral-800">
                  <Share2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>1. Toque no botão de <strong>Compartilhar</strong> na barra inferior do Safari.</span>
                </div>

                <div className="flex items-start gap-3 rounded-xl bg-neutral-900/80 p-3 border border-neutral-800">
                  <PlusSquare className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>2. Role para baixo e selecione <strong>Adicionar à Tela de Início</strong>.</span>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 py-2.5 text-xs font-bold text-black uppercase tracking-wider transition-opacity hover:opacity-95"
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-28 md:bottom-24 left-4 right-4 sm:left-auto sm:right-6 z-50 flex items-center justify-between gap-3 rounded-xl bg-amber-950/90 border border-amber-600/50 px-4 py-2.5 text-xs font-medium text-amber-200 shadow-2xl backdrop-blur-md">
      <div className="flex items-center gap-2.5">
        <WifiOff className="w-4 h-4 text-amber-400 animate-pulse" />
        <span>Modo Offline — Navegando pelos dados salvos no seu aparelho.</span>
      </div>
      <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400/80 bg-amber-900/60 px-2 py-0.5 rounded">
        PWA
      </span>
    </div>
  );
};

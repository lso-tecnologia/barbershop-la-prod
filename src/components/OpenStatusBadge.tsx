import React from 'react';

interface OpenStatusBadgeProps {
  isOpen: boolean;
  onToggleDemo?: () => void;
  showAdminToggle?: boolean;
}

export const OpenStatusBadge: React.FC<OpenStatusBadgeProps> = ({
  isOpen,
  showAdminToggle = false,
}) => {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-[#121212]/95 px-3 py-1.5 backdrop-blur-md shadow-xl">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          {isOpen ? (
            <>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </>
          ) : (
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
          )}
        </span>
        <span
          className={`text-xs font-bold tracking-wider uppercase whitespace-nowrap ${
            isOpen ? 'text-emerald-400' : 'text-rose-400'
          }`}
        >
          {isOpen ? 'Barbearia Aberta' : 'Barbearia Fechada'}
        </span>
      </div>

      {/* O botão de alternância só aparece se explicitamente permitido com showAdminToggle={true} */}
      {showAdminToggle && onToggleDemo && (
        <button
          onClick={onToggleDemo}
          title="Alternar status (Área do Barbeiro)"
          className="ml-1 inline-flex items-center gap-1 rounded-md bg-neutral-800/90 px-2 py-0.5 text-[10px] font-semibold text-neutral-300 hover:bg-neutral-700 transition-colors"
        >
          <span>Trocar</span>
        </button>
      )}
    </div>
  );
};
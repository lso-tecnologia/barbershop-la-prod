import React from 'react';

interface OpenStatusBadgeProps {
  isOpen: boolean;
  onToggleDemo?: () => void;
  showAdminToggle?: boolean;
}

export const OpenStatusBadge: React.FC<OpenStatusBadgeProps> = ({
  isOpen,
}) => {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-[#121212]/95 px-3 py-1.5 backdrop-blur-md shadow-xl select-none">
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
    </div>
  );
};
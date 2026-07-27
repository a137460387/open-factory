import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

export function MenuDropdown({
  label,
  open,
  onToggle,
  testId,
  children,
}: {
  label: string;
  open: boolean;
  onToggle(): void;
  testId: string;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      <button
        className="inline-flex h-9 items-center gap-1 rounded-md border border-transparent px-3 text-sm font-medium text-slate-700 hover:border-line hover:bg-panel hover:text-ink"
        type="button"
        data-testid={testId}
        onClick={onToggle}
      >
        {label}
        <ChevronDown size={14} />
      </button>
      {open ? (
        <div
          className="absolute left-0 top-10 z-20 min-w-44 rounded-md border border-line bg-white py-1 shadow-soft"
          data-testid={testId.replace('-button', '')}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function MenuItem({
  label,
  onClick,
  testId,
  disabled,
  icon,
}: {
  label: string;
  onClick(): void;
  testId: string;
  disabled?: boolean;
  icon?: ReactNode;
}) {
  return (
    <button
      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
      type="button"
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
    >
      <span>{label}</span>
      {icon ?? null}
    </button>
  );
}

export function MenuSeparator() {
  return <div className="my-1 h-px bg-line" />;
}

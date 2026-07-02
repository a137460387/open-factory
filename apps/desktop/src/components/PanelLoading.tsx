export function PanelLoading({ label, compact = false }: { label: string; compact?: boolean }) {
  return (
    <div className={`flex min-h-0 items-center justify-center bg-white text-xs text-slate-500 ${compact ? 'h-full' : 'h-full p-4'}`} data-testid="lazy-panel-loading">
      {label}
    </div>
  );
}

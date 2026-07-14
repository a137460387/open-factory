import { ChevronLeft, ChevronRight } from 'lucide-react';

export function CollapsedPanelRail({
  side,
  label,
  title,
  testId,
  onClick,
}: {
  side: 'left' | 'right';
  label: string;
  title: string;
  testId: string;
  onClick(): void;
}) {
  const Icon = side === 'left' ? ChevronRight : ChevronLeft;
  return (
    <aside
      className="flex min-h-0 min-w-0 flex-col items-center gap-3 bg-white px-1.5 py-2"
      data-testid={`${side}-panel`}
      data-collapsed="true"
    >
      <button
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-panel text-slate-600 hover:bg-white"
        type="button"
        title={title}
        aria-label={title}
        data-testid={testId}
        onClick={onClick}
      >
        <Icon size={16} />
      </button>
      <div className="text-[11px] font-semibold text-slate-500" style={{ writingMode: 'vertical-rl' }}>
        {label}
      </div>
    </aside>
  );
}

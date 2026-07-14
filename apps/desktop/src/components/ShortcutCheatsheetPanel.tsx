import { X } from 'lucide-react';
import { zhCN } from '../i18n/strings';
import {
  getEffectiveTimelineShortcutBindings,
  TIMELINE_SHORTCUT_DEFINITIONS,
  type TimelineShortcutBindings,
} from '../shortcuts/timeline-shortcuts';

interface ShortcutCheatsheetPanelProps {
  bindings: TimelineShortcutBindings;
  onClose(): void;
}

export function ShortcutCheatsheetPanel({ bindings, onClose }: ShortcutCheatsheetPanelProps) {
  const t = zhCN.keyboardAccessibility.cheatsheet;
  const effectiveBindings = getEffectiveTimelineShortcutBindings(bindings);
  const timelineRows = TIMELINE_SHORTCUT_DEFINITIONS.map((definition) => ({
    label: zhCN.settings.shortcuts.actions[definition.action],
    keys: effectiveBindings[definition.action].join(' / '),
  }));
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcut-cheatsheet-title"
      data-testid="shortcut-cheatsheet-panel"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <div className="max-h-[82vh] w-full max-w-3xl overflow-hidden rounded-md border border-line bg-white shadow-soft">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            <h2 id="shortcut-cheatsheet-title" className="text-sm font-semibold text-ink">
              {t.title}
            </h2>
            <p className="mt-1 text-xs text-slate-500">{t.subtitle}</p>
          </div>
          <button
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-panel"
            type="button"
            title={zhCN.common.close}
            aria-label={zhCN.common.close}
            data-testid="shortcut-cheatsheet-close-button"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>
        <div className="grid max-h-[calc(82vh-65px)] gap-4 overflow-y-auto p-4 md:grid-cols-[1.2fr_0.8fr]">
          <ShortcutSection title={t.timeline} rows={timelineRows} testId="shortcut-cheatsheet-timeline" />
          <div className="space-y-4">
            <ShortcutSection
              title={t.timelineEditing}
              rows={t.timelineEditingRows}
              testId="shortcut-cheatsheet-timeline-editing"
            />
            <ShortcutSection title={t.mediaBin} rows={t.mediaBinRows} testId="shortcut-cheatsheet-media-bin" />
            <ShortcutSection title={t.inspector} rows={t.inspectorRows} testId="shortcut-cheatsheet-inspector" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ShortcutSection({
  title,
  rows,
  testId,
}: {
  title: string;
  rows: ReadonlyArray<{ label: string; keys: string }>;
  testId: string;
}) {
  return (
    <section className="rounded-md border border-line bg-panel p-3" data-testid={testId}>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-normal text-slate-600">{title}</h3>
      <div className="divide-y divide-line rounded-md bg-white">
        {rows.map((row) => (
          <div
            key={`${row.label}-${row.keys}`}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2 text-xs"
          >
            <span className="min-w-0 text-slate-700">{row.label}</span>
            <kbd className="rounded border border-line bg-panel px-2 py-0.5 font-mono text-[11px] text-ink">
              {row.keys}
            </kbd>
          </div>
        ))}
      </div>
    </section>
  );
}

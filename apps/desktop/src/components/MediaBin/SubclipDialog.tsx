import { useState, type CSSProperties } from 'react';
import { X } from 'lucide-react';
import { createSubclip, type MediaAsset, type Subclip, type TimelineLabelColor } from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';

const TIMELINE_COLORS: Array<{ key: TimelineLabelColor; value: string }> = [
  { key: 'red', value: '#ef4444' },
  { key: 'orange', value: '#f97316' },
  { key: 'amber', value: '#f59e0b' },
  { key: 'yellow', value: '#eab308' },
  { key: 'lime', value: '#84cc16' },
  { key: 'green', value: '#22c55e' },
  { key: 'teal', value: '#14b8a6' },
  { key: 'cyan', value: '#06b6d4' },
  { key: 'blue', value: '#3b82f6' },
  { key: 'indigo', value: '#6366f1' },
  { key: 'purple', value: '#a855f7' },
  { key: 'pink', value: '#ec4899' },
];
const TIMELINE_COLOR_STYLES: Record<string, CSSProperties> = Object.fromEntries(
  TIMELINE_COLORS.map((c) => [c.key, { backgroundColor: c.value }]),
);

export function SubclipDialog({
  asset,
  editingSubclip,
  onAddSubclip,
  onUpdateSubclip,
  onClose,
}: {
  asset: MediaAsset;
  editingSubclip?: Subclip;
  onAddSubclip(subclip: Subclip): void;
  onUpdateSubclip(subclipId: string, patch: Partial<Subclip>): void;
  onClose(): void;
}) {
  const t = zhCN.subclip;
  const isEdit = !!editingSubclip;
  const [name, setName] = useState(editingSubclip?.name ?? asset.name);
  const [inPoint, setInPoint] = useState(editingSubclip?.inPoint ?? 0);
  const [outPoint, setOutPoint] = useState(editingSubclip?.outPoint ?? asset.duration);
  const [color, setColor] = useState<TimelineLabelColor | null>(editingSubclip?.color ?? null);
  const [description, setDescription] = useState(editingSubclip?.description ?? '');
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const validIn = Math.max(0, inPoint);
    const validOut = Math.max(validIn + 0.01, outPoint);
    if (isEdit && editingSubclip) {
      onUpdateSubclip(editingSubclip.id, {
        name: name.trim() || asset.name,
        inPoint: validIn,
        outPoint: Math.min(validOut, asset.duration),
        color,
        description: description.trim() || undefined,
      });
    } else {
      onAddSubclip(
        createSubclip({
          name: name.trim() || asset.name,
          sourceMediaId: asset.id,
          inPoint: validIn,
          outPoint: Math.min(validOut, asset.duration),
          color,
          description: description.trim() || undefined,
        }),
      );
    }
    onClose();
  };
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      data-testid="subclip-dialog"
    >
      <form
        className="grid max-h-[80vh] w-full max-w-md grid-rows-[auto_minmax(0,1fr)_auto] rounded-md border border-line bg-[var(--color-bg-elevated)] shadow-soft"
        onSubmit={handleSubmit}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">{isEdit ? t.editSubclip : t.newSubclip}</h2>
          <button
            className="rounded p-1 hover:bg-panel"
            type="button"
            onClick={onClose}
            data-testid="subclip-dialog-close"
          >
            <X size={16} />
          </button>
        </div>
        <div className="space-y-3 overflow-y-auto px-4 py-3">
          <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
            {t.name}
            <input
              className="mt-1 w-full rounded-lg border border-line px-2 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              data-testid="subclip-dialog-name"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
              {t.inPoint}
              <input
                className="mt-1 w-full rounded-lg border border-line px-2 py-1.5 text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
                type="number"
                min={0}
                max={asset.duration}
                step={0.01}
                value={inPoint}
                onChange={(e) => setInPoint(Number(e.target.value))}
                data-testid="subclip-dialog-in"
              />
            </label>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
              {t.outPoint}
              <input
                className="mt-1 w-full rounded-lg border border-line px-2 py-1.5 text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
                type="number"
                min={0}
                max={asset.duration}
                step={0.01}
                value={outPoint}
                onChange={(e) => setOutPoint(Number(e.target.value))}
                data-testid="subclip-dialog-out"
              />
            </label>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-[var(--color-text-secondary)]">{t.color}</div>
            <div className="flex flex-wrap gap-1.5" data-testid="subclip-dialog-colors">
              <button
                type="button"
                className={`h-5 w-5 rounded-full border-2 ${color === null ? 'border-ink' : 'border-transparent'} bg-slate-300`}
                onClick={() => setColor(null)}
                data-testid="subclip-color-none"
              />
              {TIMELINE_COLORS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`h-5 w-5 rounded-full border-2 ${color === item.key ? 'border-ink' : 'border-transparent'}`}
                  style={TIMELINE_COLOR_STYLES[item.key]}
                  onClick={() => setColor(item.key)}
                  data-testid={`subclip-color-${item.key}`}
                />
              ))}
            </div>
          </div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
            {t.description}
            <textarea
              className="mt-1 w-full rounded-lg border border-line px-2 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              data-testid="subclip-dialog-description"
            />
          </label>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-line px-4 py-3">
          <button
            className="rounded border border-line px-3 py-1.5 text-xs font-medium hover:bg-panel"
            type="button"
            onClick={onClose}
          >
            {zhCN.common.cancel}
          </button>
          <button
            className="rounded bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
            type="submit"
            data-testid="subclip-dialog-save"
          >
            {t.save}
          </button>
        </div>
      </form>
    </div>
  );
}

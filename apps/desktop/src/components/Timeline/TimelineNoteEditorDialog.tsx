import { TIMELINE_NOTE_COLORS } from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';

export interface TimelineNoteEditorState {
  id?: string;
  start: number;
  end: number;
  text: string;
  color: string;
}

export function TimelineNoteEditorDialog({
  value,
  onChange,
  onCancel,
  onSave,
}: {
  value: TimelineNoteEditorState;
  onChange(value: TimelineNoteEditorState): void;
  onCancel(): void;
  onSave(value: TimelineNoteEditorState): void;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 p-4"
      data-testid="timeline-note-editor"
    >
      <section className="w-full max-w-sm rounded-md border border-line bg-[var(--color-bg-elevated)] shadow-soft">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">
            {value.id ? zhCN.timeline.timelineNoteEditTitle : zhCN.timeline.timelineNoteNewTitle}
          </h2>
          <div className="mt-1 text-xs tabular-nums text-[var(--color-text-muted)]">
            {value.start.toFixed(2)}s - {value.end.toFixed(2)}s
          </div>
        </div>
        <div className="space-y-3 px-4 py-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
              {zhCN.timeline.timelineNoteStart}
              <input
                className="mt-1 h-8 w-full rounded-md border border-line px-2 text-sm text-ink"
                type="number"
                min={0}
                step={0.01}
                value={value.start}
                data-testid="timeline-note-start-input"
                onChange={(event) => onChange({ ...value, start: Number(event.target.value) })}
              />
            </label>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
              {zhCN.timeline.timelineNoteEnd}
              <input
                className="mt-1 h-8 w-full rounded-md border border-line px-2 text-sm text-ink"
                type="number"
                min={0}
                step={0.01}
                value={value.end}
                data-testid="timeline-note-end-input"
                onChange={(event) => onChange({ ...value, end: Number(event.target.value) })}
              />
            </label>
          </div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
            {zhCN.timeline.timelineNoteText}
            <textarea
              className="mt-1 h-20 w-full resize-none rounded-md border border-line px-2 py-1.5 text-sm text-ink"
              value={value.text}
              maxLength={240}
              data-testid="timeline-note-text-input"
              onChange={(event) => onChange({ ...value, text: event.target.value })}
            />
          </label>
          <div>
            <div className="mb-1 text-xs font-medium text-[var(--color-text-secondary)]">
              {zhCN.timeline.timelineNoteColor}
            </div>
            <div className="flex gap-2">
              {TIMELINE_NOTE_COLORS.map((color) => (
                <button
                  key={color}
                  className={`h-7 w-7 rounded-full border ${value.color.toLowerCase() === color ? 'border-ink ring-2 ring-brand/30' : 'border-white'}`}
                  style={{ backgroundColor: color }}
                  type="button"
                  title={color}
                  aria-label={color}
                  data-testid={`timeline-note-color-${color}`}
                  onClick={() => onChange({ ...value, color })}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
          <button
            className="rounded border border-line px-3 py-2 text-sm font-medium hover:bg-panel"
            type="button"
            onClick={onCancel}
          >
            {zhCN.common.cancel}
          </button>
          <button
            className="rounded bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-[#176858]"
            type="button"
            data-testid="timeline-note-save-button"
            onClick={() => onSave(value)}
          >
            {zhCN.timeline.timelineNoteSave}
          </button>
        </div>
      </section>
    </div>
  );
}

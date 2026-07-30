import { PROJECT_ANNOTATION_COLORS } from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';

export interface AnnotationEditorState {
  id?: string;
  time: number;
  text: string;
  color: string;
}

export function AnnotationEditorDialog({
  value,
  onChange,
  onCancel,
  onSave,
}: {
  value: AnnotationEditorState;
  onChange(value: AnnotationEditorState): void;
  onCancel(): void;
  onSave(value: AnnotationEditorState): void;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 p-4"
      data-testid="annotation-editor"
    >
      <section className="w-full max-w-sm rounded-md border border-line bg-[var(--color-bg-elevated)] shadow-soft">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">
            {value.id ? zhCN.timeline.annotationEditTitle : zhCN.timeline.annotationNewTitle}
          </h2>
          <div className="mt-1 text-xs tabular-nums text-[var(--color-text-muted)]">{value.time.toFixed(2)}s</div>
        </div>
        <div className="space-y-3 px-4 py-3">
          <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
            {zhCN.timeline.annotationText}
            <textarea
              className="mt-1 h-20 w-full resize-none rounded-md border border-line px-2 py-1.5 text-sm text-ink"
              value={value.text}
              maxLength={240}
              data-testid="annotation-text-input"
              onChange={(event) => onChange({ ...value, text: event.target.value })}
            />
          </label>
          <div>
            <div className="mb-1 text-xs font-medium text-[var(--color-text-secondary)]">
              {zhCN.timeline.annotationColor}
            </div>
            <div className="flex gap-2">
              {PROJECT_ANNOTATION_COLORS.map((color) => (
                <button
                  key={color}
                  className={`h-7 w-7 rounded-full border ${value.color.toLowerCase() === color ? 'border-ink ring-2 ring-brand/30' : 'border-white'}`}
                  style={{ backgroundColor: color }}
                  type="button"
                  title={color}
                  aria-label={color}
                  data-testid={`annotation-color-${color}`}
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
            data-testid="annotation-save-button"
            onClick={() => onSave(value)}
          >
            {zhCN.timeline.annotationSave}
          </button>
        </div>
      </section>
    </div>
  );
}

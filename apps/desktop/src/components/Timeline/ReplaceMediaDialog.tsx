import type {
  MediaAsset,
  ReplaceMediaDurationMode,
  ReplaceMediaCompatibilityWarning,
} from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';

export interface ReplaceMediaDialogState {
  clipId: string;
  media: MediaAsset;
  durationMode: ReplaceMediaDurationMode;
  warnings: ReplaceMediaCompatibilityWarning[];
}

export function ReplaceMediaDialog({
  value,
  onChange,
  onCancel,
  onConfirm,
}: {
  value: ReplaceMediaDialogState;
  onChange(value: ReplaceMediaDialogState): void;
  onCancel(): void;
  onConfirm(): void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4"
      data-testid="replace-media-dialog"
    >
      <div className="w-full max-w-sm rounded-md border border-line bg-[var(--color-bg-elevated)] p-4 shadow-soft">
        <div className="mb-3">
          <div className="text-sm font-semibold text-ink">{zhCN.timeline.replaceMediaTitle}</div>
          <div className="mt-1 truncate text-xs text-[var(--color-text-muted)]">{value.media.name}</div>
        </div>
        <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
          {zhCN.timeline.replaceMediaDurationMode}
          <select
            className="mt-1 w-full rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm text-ink"
            value={value.durationMode}
            data-testid="replace-media-duration-mode"
            onChange={(event) => onChange({ ...value, durationMode: event.target.value as ReplaceMediaDurationMode })}
          >
            {(['trim-to-original', 'stretch-to-fit', 'use-new-duration'] as ReplaceMediaDurationMode[]).map((mode) => (
              <option key={mode} value={mode}>
                {zhCN.timeline.replaceMediaModes[mode]}
              </option>
            ))}
          </select>
        </label>
        {value.warnings.length > 0 ? (
          <div
            className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800"
            data-testid="replace-media-warning"
          >
            <div className="font-semibold">{zhCN.timeline.replaceMediaWarnings.title}</div>
            {value.warnings.map((warning) => (
              <div key={warning} className="mt-1">
                {zhCN.timeline.replaceMediaWarnings[warning]}
              </div>
            ))}
          </div>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <button
            className="rounded-md border border-line px-3 py-1.5 text-sm font-medium hover:bg-panel"
            type="button"
            onClick={onCancel}
          >
            {zhCN.timeline.close}
          </button>
          <button
            className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-[#176858]"
            type="button"
            data-testid="replace-media-confirm"
            onClick={onConfirm}
          >
            {zhCN.timeline.replaceMediaConfirm}
          </button>
        </div>
      </div>
    </div>
  );
}

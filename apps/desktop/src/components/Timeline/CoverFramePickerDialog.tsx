import type { Clip } from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import { convertLocalFileSrc } from '../../lib/tauri-bridge';
import type { CoverFrameResult } from '../../lib/tauri-bridge';

export interface CoverFrameDialogState {
  clip: Clip;
  frames: CoverFrameResult[];
  progress: number;
  loading: boolean;
  error?: string;
  selectedPath?: string;
}

export function CoverFramePickerDialog({
  state,
  onSelect,
  onClose,
}: {
  state: CoverFrameDialogState;
  onSelect(frame: CoverFrameResult): void;
  onClose(): void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
      data-testid="cover-frame-picker"
    >
      <section className="flex max-h-[86vh] w-full max-w-3xl flex-col overflow-hidden rounded-md border border-line bg-[var(--color-bg-elevated)] shadow-soft">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">{zhCN.timeline.coverFrameDialogTitle}</h2>
            <div className="mt-1 truncate text-xs text-[var(--color-text-muted)]">{state.clip.name}</div>
          </div>
          <button
            className="rounded-md border border-line px-3 py-1.5 text-xs font-medium hover:bg-panel"
            type="button"
            onClick={onClose}
            data-testid="cover-frame-close"
          >
            {zhCN.timeline.close}
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {state.loading ? (
            <div
              className="rounded-md border border-line bg-panel p-4 text-sm text-[var(--color-text-secondary)]"
              data-testid="cover-frame-loading"
            >
              <div className="mb-2">{zhCN.timeline.coverFrameGenerating}</div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--color-bg-elevated)]">
                <div
                  className="h-full bg-brand transition-all"
                  style={{ width: `${Math.round(Math.max(0, Math.min(1, state.progress)) * 100)}%` }}
                />
              </div>
            </div>
          ) : state.error ? (
            <div
              className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
              data-testid="cover-frame-error"
            >
              {state.error}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {state.frames.map((frame, index) => (
                <button
                  key={frame.path}
                  className={`overflow-hidden rounded-md border bg-panel text-left shadow-sm hover:border-brand focus:outline-none focus:ring-2 focus:ring-brand ${state.selectedPath === frame.path ? 'border-brand ring-2 ring-brand/25' : 'border-line'}`}
                  type="button"
                  data-testid={`cover-frame-option-${index}`}
                  onClick={() => onSelect(frame)}
                >
                  <img className="aspect-video w-full object-cover" src={convertLocalFileSrc(frame.path)} alt="" />
                  <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs text-[var(--color-text-secondary)]">
                    <span>{zhCN.timeline.coverFrameCandidate(index + 1)}</span>
                    <span className="tabular-nums">
                      {frame.timestamp === undefined ? '' : `${frame.timestamp.toFixed(2)}s`}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        {state.selectedPath ? (
          <div className="border-t border-line px-4 py-2 text-xs text-emerald-700" data-testid="cover-frame-selected">
            {zhCN.timeline.coverFrameSelectedPath(state.selectedPath)}
          </div>
        ) : null}
      </section>
    </div>
  );
}

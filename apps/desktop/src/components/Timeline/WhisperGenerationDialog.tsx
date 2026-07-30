import type { Clip } from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';

export interface WhisperDialogState {
  clip: Clip;
  progress: number;
}

export function WhisperGenerationDialog({ progress, clipName }: { progress: number; clipName: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4" data-testid="whisper-dialog">
      <section className="w-full max-w-sm rounded-md border border-line bg-[var(--color-bg-elevated)] shadow-soft">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">{zhCN.timeline.whisperRunningTitle}</h2>
          <div className="mt-1 truncate text-xs text-[var(--color-text-muted)]">{clipName}</div>
        </div>
        <div className="px-4 py-5">
          <div className="mb-2 text-sm text-[var(--color-text-secondary)]">
            {zhCN.timeline.whisperRunningMessage(progress)}
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--color-bg-elevated)]">
            <div
              className="h-full bg-brand transition-all"
              style={{ width: `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%` }}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

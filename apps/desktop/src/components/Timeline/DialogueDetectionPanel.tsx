import { useState } from 'react';
import type {
  DialogueInterval,
  DialogueSensitivity,
  DialogueWhisperMiss,
} from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';

export function DialogueDetectionPanel({
  markers,
  misses,
  onRun,
  onGenerateSubtitles,
  onClose,
}: {
  markers: DialogueInterval[];
  misses: DialogueWhisperMiss[];
  onRun(sensitivity: DialogueSensitivity): void | Promise<void>;
  onGenerateSubtitles(): void;
  onClose(): void;
}) {
  const [sensitivity, setSensitivity] = useState<DialogueSensitivity>('medium');
  const [running, setRunning] = useState(false);

  async function runDetection(): Promise<void> {
    setRunning(true);
    try {
      await onRun(sensitivity);
    } finally {
      setRunning(false);
    }
  }

  return (
    <aside
      className="absolute bottom-3 right-3 top-16 z-50 flex w-80 flex-col overflow-hidden rounded-md border border-line bg-[var(--color-bg-elevated)] shadow-soft"
      data-testid="dialogue-detection-panel"
    >
      <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
        <div>
          <div className="text-sm font-semibold">{zhCN.timeline.dialogueDetectionTitle}</div>
          <div className="text-[11px] text-[var(--color-text-muted)]">{zhCN.timeline.dialogueDetectionSubtitle}</div>
        </div>
        <button
          className="rounded border border-line px-2 py-1 text-xs hover:bg-panel"
          type="button"
          onClick={onClose}
          data-testid="dialogue-detection-close"
        >
          {zhCN.timeline.close}
        </button>
      </div>
      <div className="space-y-3 border-b border-line px-3 py-3 text-xs">
        <label className="block font-medium text-[var(--color-text-secondary)]">
          {zhCN.timeline.dialogueDetectionSensitivity}
          <select
            className="mt-1 w-full rounded border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm"
            value={sensitivity}
            data-testid="dialogue-detection-sensitivity"
            onChange={(event) => setSensitivity(event.target.value as DialogueSensitivity)}
          >
            <option value="low">{zhCN.timeline.dialogueDetectionSensitivityLow}</option>
            <option value="medium">{zhCN.timeline.dialogueDetectionSensitivityMedium}</option>
            <option value="high">{zhCN.timeline.dialogueDetectionSensitivityHigh}</option>
          </select>
        </label>
        <button
          className="w-full rounded bg-brand px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          type="button"
          disabled={running}
          data-testid="dialogue-detection-run"
          onClick={() => void runDetection()}
        >
          {running ? zhCN.timeline.dialogueDetectionRunning : zhCN.timeline.dialogueDetectionRun}
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 text-xs">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-semibold text-[var(--color-text-secondary)]">
            {zhCN.timeline.dialogueDetectionResults}
          </span>
          <span className="tabular-nums text-[var(--color-text-muted)]">{markers.length}</span>
        </div>
        {markers.length === 0 ? (
          <div
            className="rounded border border-dashed border-line px-3 py-6 text-center text-[var(--color-text-muted)]"
            data-testid="dialogue-detection-empty"
          >
            {zhCN.timeline.dialogueDetectionNoResults}
          </div>
        ) : (
          <div className="space-y-2">
            {markers.map((marker, index) => (
              <div
                key={marker.id}
                className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1.5"
                data-testid="dialogue-detection-result"
              >
                <div className="flex items-center justify-between gap-2 font-medium text-emerald-800">
                  <span>{zhCN.timeline.dialogueDetectionRangeLabel(index + 1)}</span>
                  <span>{zhCN.timeline.dialogueDetectionConfidence(marker.confidence)}</span>
                </div>
                <div className="mt-1 font-mono tabular-nums text-[var(--color-text-secondary)]">
                  {marker.start.toFixed(2)}s - {marker.end.toFixed(2)}s
                </div>
              </div>
            ))}
          </div>
        )}
        {misses.length > 0 ? (
          <div
            className="mt-3 rounded border border-amber-200 bg-amber-50 px-2 py-2 text-amber-800"
            data-testid="dialogue-detection-whisper-misses"
          >
            <div className="font-semibold">{zhCN.timeline.dialogueDetectionWhisperMissing(misses.length)}</div>
            <div className="mt-1 space-y-1 font-mono tabular-nums">
              {misses.slice(0, 4).map((miss) => (
                <div key={miss.id}>
                  {miss.start.toFixed(2)}s - {miss.end.toFixed(2)}s
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      <div className="border-t border-line p-3">
        <button
          className="w-full rounded border border-line px-3 py-2 text-sm font-medium hover:bg-panel disabled:opacity-50"
          type="button"
          disabled={markers.length === 0}
          data-testid="dialogue-detection-generate-subtitles"
          onClick={onGenerateSubtitles}
        >
          {zhCN.timeline.dialogueDetectionGenerateSubtitles}
        </button>
      </div>
    </aside>
  );
}

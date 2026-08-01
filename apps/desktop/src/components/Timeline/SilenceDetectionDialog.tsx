import { useState } from 'react';
import type { Clip, MediaAsset, SilentRange } from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import { detectClipSilence } from '../../lib/silenceDetection';

export interface SilenceDialogState {
  clip: Clip;
  asset: MediaAsset;
}

export function SilenceDetectionDialog({
  clip,
  asset,
  onClose,
  onApply,
}: {
  clip: Clip;
  asset: MediaAsset;
  onClose(): void;
  onApply(ranges: SilentRange[]): void;
}) {
  const [thresholdDb, setThresholdDb] = useState(-40);
  const [minSilenceDuration, setMinSilenceDuration] = useState(0.5);
  const [marginMs, setMarginMs] = useState(100);
  const [status, setStatus] = useState<'params' | 'detecting' | 'preview' | 'error'>('params');
  const [ranges, setRanges] = useState<SilentRange[]>([]);
  const [error, setError] = useState<string>();
  const totalDuration = ranges.reduce((total, range) => total + range.duration, 0);

  async function runDetection(): Promise<void> {
    setStatus('detecting');
    setError(undefined);
    try {
      const nextRanges = await detectClipSilence(clip, asset, {
        thresholdDb,
        minSilenceDuration,
        marginDuration: Math.max(0, marginMs) / 1000,
      });
      setRanges(nextRanges);
      setStatus('preview');
    } catch (detectError) {
      setError(detectError instanceof Error ? detectError.message : zhCN.timeline.silenceDecodeFailed);
      setStatus('error');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4" data-testid="silence-dialog">
      <section className="w-full max-w-md rounded-md border border-line bg-[var(--color-bg-elevated)] shadow-soft">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">{zhCN.timeline.silenceDialogTitle}</h2>
          <div className="mt-1 truncate text-xs text-[var(--color-text-muted)]">{clip.name}</div>
        </div>
        <div className="space-y-3 px-4 py-3 text-sm">
          {status === 'detecting' ? (
            <div
              className="rounded border border-line bg-panel px-3 py-6 text-center text-sm text-[var(--color-text-secondary)]"
              data-testid="silence-loading"
            >
              {zhCN.timeline.silenceScanning}
            </div>
          ) : (
            <>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
                {zhCN.timeline.silenceThreshold}
                <input
                  className="mt-1 w-full rounded border border-line px-2 py-1.5 text-sm"
                  type="number"
                  step={1}
                  value={thresholdDb}
                  data-testid="silence-threshold-input"
                  onChange={(event) => setThresholdDb(Number(event.target.value))}
                />
              </label>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
                {zhCN.timeline.silenceMinDuration}
                <input
                  className="mt-1 w-full rounded border border-line px-2 py-1.5 text-sm"
                  type="number"
                  min={0}
                  step={0.1}
                  value={minSilenceDuration}
                  data-testid="silence-min-duration-input"
                  onChange={(event) => setMinSilenceDuration(Number(event.target.value))}
                />
              </label>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
                {zhCN.timeline.silenceMargin}
                <input
                  className="mt-1 w-full rounded border border-line px-2 py-1.5 text-sm"
                  type="number"
                  min={0}
                  step={10}
                  value={marginMs}
                  data-testid="silence-margin-input"
                  onChange={(event) => setMarginMs(Number(event.target.value))}
                />
              </label>
              {status === 'preview' ? (
                <div
                  className="rounded border border-line bg-panel px-3 py-2 text-xs text-[var(--color-text-secondary)]"
                  data-testid="silence-preview"
                >
                  <div className="font-semibold">
                    {zhCN.timeline.silencePreview(ranges.length, totalDuration.toFixed(2))}
                  </div>
                  {ranges.length > 0 ? (
                    <div className="mt-2 max-h-24 overflow-auto">
                      {ranges.slice(0, 6).map((range) => (
                        <div key={`${range.start}-${range.end}`} className="tabular-nums">
                          {range.start.toFixed(2)}s - {range.end.toFixed(2)}s
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-1 text-[var(--color-text-muted)]">{zhCN.timeline.noSilenceFound}</div>
                  )}
                </div>
              ) : null}
              {status === 'error' ? (
                <div className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>
              ) : null}
            </>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
          <button
            className="rounded border border-line px-3 py-2 text-sm font-medium hover:bg-panel"
            type="button"
            onClick={onClose}
          >
            {zhCN.timeline.close}
          </button>
          {status === 'preview' && ranges.length > 0 ? (
            <button
              className="rounded bg-brand px-3 py-2 text-sm font-medium text-white"
              type="button"
              data-testid="silence-confirm-button"
              onClick={() => onApply(ranges)}
            >
              {zhCN.timeline.confirmSilenceCut}
            </button>
          ) : (
            <button
              className="rounded bg-brand px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
              type="button"
              disabled={status === 'detecting'}
              data-testid="silence-detect-button"
              onClick={() => void runDetection()}
            >
              {zhCN.timeline.startSilenceDetect}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

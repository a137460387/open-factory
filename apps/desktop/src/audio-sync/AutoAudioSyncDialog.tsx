import type { AutoAudioSyncApplyMode, AutoAudioSyncResult } from '@open-factory/editor-core';
import { zhCN } from '../i18n/strings';

interface AutoAudioSyncDialogTarget {
  clipId: string;
  clipName: string;
  mediaName: string;
  trackName: string;
  start: number;
}

interface AutoAudioSyncDialogProps {
  targets: AutoAudioSyncDialogTarget[];
  primaryClipId: string;
  mode: AutoAudioSyncApplyMode;
  running: boolean;
  results: AutoAudioSyncResult[];
  onPrimaryChange(clipId: string): void;
  onModeChange(mode: AutoAudioSyncApplyMode): void;
  onAnalyze(): void;
  onApply(): void;
  onClose(): void;
}

export function AutoAudioSyncDialog({
  targets,
  primaryClipId,
  mode,
  running,
  results,
  onPrimaryChange,
  onModeChange,
  onAnalyze,
  onApply,
  onClose
}: AutoAudioSyncDialogProps) {
  const t = zhCN.autoAudioSync;
  const primary = targets.find((target) => target.clipId === primaryClipId) ?? targets[0];
  const resultByClipId = new Map(results.map((result) => [result.clipId, result]));
  const appliedCount = results.filter((result) => result.applied && result.confidence !== 'low').length;
  const lowCount = results.filter((result) => result.confidence === 'low' || !result.applied).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4" role="dialog" aria-modal="true" data-testid="auto-audio-sync-dialog">
      <div className="w-full max-w-3xl rounded-lg border border-line bg-white p-4 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-ink">{t.title}</h2>
            <p className="mt-1 text-sm text-slate-600" data-testid="auto-audio-sync-summary">{t.summary(targets.length, primary?.clipName ?? '')}</p>
          </div>
          <button className="rounded-md border border-line px-2 py-1 text-xs text-slate-600 hover:bg-panel" type="button" data-testid="auto-audio-sync-close-button" onClick={onClose}>
            {t.close}
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
          <label className="grid gap-1 text-xs font-medium text-slate-600">
            <span>{t.primaryTrack}</span>
            <select
              className="rounded-md border border-line bg-white px-3 py-2 text-sm text-ink"
              value={primaryClipId}
              data-testid="auto-audio-sync-primary-select"
              onChange={(event) => onPrimaryChange(event.target.value)}
            >
              {targets.map((target) => (
                <option key={target.clipId} value={target.clipId}>
                  {target.trackName} · {target.clipName}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-1 text-xs font-medium text-slate-600">
            <span>{t.applyMode}</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                className={`rounded-md border px-3 py-2 text-left text-xs ${mode === 'keep-secondary' ? 'border-brand bg-brand/10 text-brand' : 'border-line text-slate-700 hover:bg-panel'}`}
                type="button"
                data-testid="auto-audio-sync-mode-keep"
                onClick={() => onModeChange('keep-secondary')}
              >
                {t.keepSecondary}
              </button>
              <button
                className={`rounded-md border px-3 py-2 text-left text-xs ${mode === 'replace-primary-audio' ? 'border-brand bg-brand/10 text-brand' : 'border-line text-slate-700 hover:bg-panel'}`}
                type="button"
                data-testid="auto-audio-sync-mode-replace"
                onClick={() => onModeChange('replace-primary-audio')}
              >
                {t.replacePrimary}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-md border border-line">
          <div className="grid grid-cols-[1.2fr_0.7fr_0.7fr_0.7fr] bg-panel px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <span>{t.trackColumn}</span>
            <span>{t.startColumn}</span>
            <span>{t.offsetColumn}</span>
            <span>{t.confidenceColumn}</span>
          </div>
          <div className="max-h-72 divide-y divide-line overflow-auto">
            {targets
              .filter((target) => target.clipId !== primaryClipId)
              .map((target) => {
                const result = resultByClipId.get(target.clipId);
                return (
                  <div className="grid grid-cols-[1.2fr_0.7fr_0.7fr_0.7fr] items-center px-3 py-2 text-sm" key={target.clipId} data-testid={`auto-audio-sync-result-${target.clipId}`}>
                    <div className="min-w-0">
                      <div className="truncate font-medium text-ink">{target.clipName}</div>
                      <div className="truncate text-xs text-slate-500">{target.mediaName}</div>
                    </div>
                    <span className="text-xs tabular-nums text-slate-600">{target.start.toFixed(2)}s</span>
                    <span className="text-xs tabular-nums text-slate-700" data-testid={`auto-audio-sync-offset-${target.clipId}`}>
                      {result ? t.offset(result.offsetMs) : t.pending}
                    </span>
                    <span className={`text-xs font-semibold ${confidenceClass(result?.confidence)}`} data-testid={`auto-audio-sync-confidence-${target.clipId}`}>
                      {result ? t.confidence(result.confidence, result.peakScore) : t.pending}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>

        {lowCount > 0 ? (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800" data-testid="auto-audio-sync-low-confidence">
            {t.lowConfidenceNotice(lowCount)}
          </div>
        ) : null}

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500" data-testid="auto-audio-sync-apply-count">{results.length > 0 ? t.applyCount(appliedCount) : t.ready}</div>
          <div className="flex items-center gap-2">
            <button className="rounded-md border border-line px-3 py-2 text-xs text-slate-600 hover:bg-panel" type="button" onClick={onClose}>
              {zhCN.common.cancel}
            </button>
            <button
              className="rounded-md border border-line px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={running}
              data-testid="auto-audio-sync-analyze-button"
              onClick={onAnalyze}
            >
              {running ? t.analyzing : t.analyze}
            </button>
            <button
              className="rounded-md bg-brand px-3 py-2 text-xs font-semibold text-white hover:bg-[#176858] disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={running || appliedCount === 0}
              data-testid="auto-audio-sync-apply-button"
              onClick={onApply}
            >
              {t.apply}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function confidenceClass(confidence: AutoAudioSyncResult['confidence'] | undefined): string {
  if (confidence === 'high') {
    return 'text-emerald-700';
  }
  if (confidence === 'medium') {
    return 'text-amber-700';
  }
  if (confidence === 'low') {
    return 'text-rose-700';
  }
  return 'text-slate-500';
}

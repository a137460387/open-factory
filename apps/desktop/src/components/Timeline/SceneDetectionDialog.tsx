import type { Clip, MediaAsset } from '@open-factory/editor-core';
import {
  estimateSceneCutCountForThreshold,
  filterShortSceneCuts,
} from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';

export interface SceneDialogState {
  clip: Clip;
  asset: MediaAsset;
  status: 'ready' | 'running' | 'complete';
  threshold: number;
  progress: number;
  analyzedFrames?: number;
  totalFrames?: number;
  scenecuts: number[];
  filterShortScenes: boolean;
  minSceneSeconds: number;
  splitAtCuts: boolean;
  addMarkers: boolean;
  syncChapters: boolean;
  taskId?: string;
  limited?: boolean;
  analyzedDuration?: number;
}

export function SceneDetectionDialog({
  state,
  onChange,
  onDetect,
  onCancelDetect,
  onApply,
  onClose,
}: {
  state: SceneDialogState;
  onChange(state: SceneDialogState): void;
  onDetect(): void;
  onCancelDetect(): void;
  onApply(): void;
  onClose(): void;
}) {
  const estimatedCount = estimateSceneCutCountForThreshold(state.scenecuts, state.threshold, state.clip.duration);
  const filteredCuts = state.filterShortScenes
    ? filterShortSceneCuts(state.scenecuts, state.clip.duration, state.minSceneSeconds)
    : filterShortSceneCuts(state.scenecuts, state.clip.duration, 0);
  const progressText =
    state.totalFrames && state.totalFrames > 0
      ? zhCN.timeline.sceneProgressFrames(state.analyzedFrames ?? 0, state.totalFrames)
      : zhCN.timeline.sceneProgressPercent(state.progress);
  const canApply =
    state.status === 'complete' &&
    filteredCuts.length > 0 &&
    (state.splitAtCuts || state.addMarkers || state.syncChapters);
  const running = state.status === 'running';
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
      data-testid="scene-detect-dialog"
    >
      <section className="w-full max-w-lg rounded-md border border-line bg-[var(--color-bg-elevated)] shadow-soft">
        <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">{zhCN.timeline.sceneDialogTitle}</h2>
            <div className="mt-1 truncate text-xs text-[var(--color-text-muted)]">{state.clip.name}</div>
          </div>
          <button
            className="rounded-md border border-line px-3 py-1.5 text-xs font-medium hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            disabled={running}
            onClick={onClose}
            data-testid="scene-detect-close-button"
          >
            {zhCN.common.close}
          </button>
        </div>
        <div className="space-y-4 px-4 py-4">
          <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
            <span className="flex items-center justify-between gap-2">
              <span>{zhCN.timeline.sceneThreshold}</span>
              <span className="tabular-nums">{Math.round(state.threshold)}</span>
            </span>
            <input
              className="mt-2 w-full accent-brand"
              type="range"
              min={0}
              max={100}
              step={1}
              value={state.threshold}
              disabled={running}
              data-testid="scene-threshold-input"
              onChange={(event) => onChange({ ...state, threshold: Number(event.target.value) })}
            />
          </label>
          <div
            className="rounded-md border border-line bg-panel px-3 py-2 text-xs text-[var(--color-text-secondary)]"
            data-testid="scene-estimate"
          >
            {zhCN.timeline.sceneEstimate(estimatedCount)}
          </div>
          {running ? (
            <div
              className="rounded-md border border-line bg-[var(--color-bg-elevated)] p-3"
              data-testid="scene-progress"
            >
              <div className="mb-2 flex items-center justify-between gap-2 text-xs text-[var(--color-text-secondary)]">
                <span>{zhCN.timeline.sceneScanning}</span>
                <span className="tabular-nums">{progressText}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--color-bg-elevated)]">
                <div
                  className="h-full bg-brand transition-all"
                  style={{ width: `${Math.round(Math.max(0, Math.min(1, state.progress)) * 100)}%` }}
                />
              </div>
            </div>
          ) : null}
          {state.limited ? (
            <div
              className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
              data-testid="scene-limit-warning"
            >
              {zhCN.timeline.sceneAnalysisLimited}
            </div>
          ) : null}
          {state.status === 'complete' ? (
            <div
              className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800"
              data-testid="scene-result-summary"
            >
              {zhCN.timeline.sceneDetectedCount(state.scenecuts.length, filteredCuts.length)}
            </div>
          ) : null}
          <div className="grid gap-3 rounded-md border border-line bg-[var(--color-bg-elevated)] p-3 text-sm text-[var(--color-text-secondary)]">
            <label className="flex items-center justify-between gap-3">
              <span>{zhCN.timeline.sceneFilterShort}</span>
              <input
                type="checkbox"
                checked={state.filterShortScenes}
                disabled={running}
                data-testid="scene-filter-short-checkbox"
                onChange={(event) => onChange({ ...state, filterShortScenes: event.target.checked })}
              />
            </label>
            <label className="flex items-center justify-between gap-3 text-xs text-[var(--color-text-secondary)]">
              <span>{zhCN.timeline.sceneMinDuration}</span>
              <input
                className="h-8 w-20 rounded-md border border-line px-2 text-right tabular-nums"
                type="number"
                min={0}
                step={0.1}
                value={state.minSceneSeconds}
                disabled={running || !state.filterShortScenes}
                data-testid="scene-min-duration-input"
                onChange={(event) => onChange({ ...state, minSceneSeconds: Math.max(0, Number(event.target.value)) })}
              />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span>{zhCN.timeline.sceneSplitAtCuts}</span>
              <input
                type="checkbox"
                checked={state.splitAtCuts}
                disabled={running}
                data-testid="scene-split-checkbox"
                onChange={(event) => onChange({ ...state, splitAtCuts: event.target.checked })}
              />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span>{zhCN.timeline.sceneAddMarkers}</span>
              <input
                type="checkbox"
                checked={state.addMarkers}
                disabled={running}
                data-testid="scene-marker-checkbox"
                onChange={(event) => onChange({ ...state, addMarkers: event.target.checked })}
              />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span>{zhCN.timeline.sceneSyncChapters}</span>
              <input
                type="checkbox"
                checked={state.syncChapters}
                disabled={running}
                data-testid="scene-chapter-checkbox"
                onChange={(event) => onChange({ ...state, syncChapters: event.target.checked })}
              />
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
          {running ? (
            <button
              className="rounded-md border border-line px-3 py-2 text-sm font-medium hover:bg-panel"
              type="button"
              data-testid="scene-cancel-button"
              onClick={onCancelDetect}
            >
              {zhCN.common.cancel}
            </button>
          ) : (
            <button
              className="rounded-md border border-line px-3 py-2 text-sm font-medium hover:bg-panel"
              type="button"
              data-testid="scene-detect-button"
              onClick={onDetect}
            >
              {state.status === 'complete' ? zhCN.timeline.sceneDetectAgain : zhCN.timeline.startSceneDetect}
            </button>
          )}
          <button
            className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-[#176858] disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            disabled={!canApply}
            data-testid="scene-apply-button"
            onClick={onApply}
          >
            {zhCN.timeline.sceneApply}
          </button>
        </div>
      </section>
    </div>
  );
}

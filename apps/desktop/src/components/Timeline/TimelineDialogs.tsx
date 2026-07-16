import { useState } from 'react';
import { X } from 'lucide-react';
import type {
  Clip,
  MediaAsset,
  Track,
  SilentRange,
  ReplaceMediaDurationMode,
  ReplaceMediaCompatibilityWarning,
  DialogueInterval,
  DialogueSensitivity,
  DialogueWhisperMiss,
} from '@open-factory/editor-core';
import {
  PROJECT_ANNOTATION_COLORS,
  TIMELINE_NOTE_COLORS,
  estimateSceneCutCountForThreshold,
  filterShortSceneCuts,
  computeTimelineGaps,
  getGapStats,
} from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import { detectClipSilence } from '../../lib/silenceDetection';
import { convertLocalFileSrc } from '../../lib/tauri-bridge';
import type { CoverFrameResult } from '../../lib/tauri-bridge';

// ── State interfaces ────────────────────────────────────────────────

export interface ReplaceMediaDialogState {
  clipId: string;
  media: MediaAsset;
  durationMode: ReplaceMediaDurationMode;
  warnings: ReplaceMediaCompatibilityWarning[];
}

export interface SilenceDialogState {
  clip: Clip;
  asset: MediaAsset;
}

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

export interface WhisperDialogState {
  clip: Clip;
  progress: number;
}

export interface CoverFrameDialogState {
  clip: Clip;
  frames: CoverFrameResult[];
  progress: number;
  loading: boolean;
  error?: string;
  selectedPath?: string;
}

export interface AnnotationEditorState {
  id?: string;
  time: number;
  text: string;
  color: string;
}

export interface TimelineNoteEditorState {
  id?: string;
  start: number;
  end: number;
  text: string;
  color: string;
}

// ── Dialog components ───────────────────────────────────────────────

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

export function SequenceSettingsDialog({
  sequence,
  projectSettings,
  onSave,
  onClose,
}: {
  sequence: {
    id: string;
    name?: string;
    settings?: { frameRate?: number; width?: number; height?: number; duration?: number };
  };
  projectSettings: { fps: number; width: number; height: number };
  onSave(settings: { frameRate?: number; width?: number; height?: number } | undefined): void;
  onClose(): void;
}) {
  const seqSettings = sequence.settings;
  const [override, setOverride] = useState(!!seqSettings);
  const [fps, setFps] = useState(String(seqSettings?.frameRate ?? projectSettings.fps));
  const [width, setWidth] = useState(String(seqSettings?.width ?? projectSettings.width));
  const [height, setHeight] = useState(String(seqSettings?.height ?? projectSettings.height));
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      data-testid="sequence-settings-dialog"
      onPointerDown={(e) => {
        e.stopPropagation();
      }}
    >
      <div
        className="w-[360px] rounded-lg border border-line bg-[var(--color-bg-elevated)] p-4 shadow-lg"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold">{zhCN.timeline.sequenceSettingsTitle}</span>
          <button className="rounded p-1 hover:bg-panel" type="button" onClick={onClose}>
            <X size={14} />
          </button>
        </div>
        <label className="mb-3 flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={override}
            onChange={(e) => setOverride(e.target.checked)}
            data-testid="sequence-settings-override"
          />
          {zhCN.timeline.sequenceSettingsOverride}
        </label>
        <div className="space-y-2 text-xs">
          <label className="flex items-center gap-2">
            <span className="w-16 shrink-0">{zhCN.timeline.sequenceSettingsFps}</span>
            <input
              className="w-20 rounded border border-line px-2 py-1 disabled:opacity-50"
              type="number"
              step="0.001"
              min="1"
              max="240"
              value={fps}
              disabled={!override}
              onChange={(e) => setFps(e.target.value)}
              data-testid="sequence-settings-fps"
            />
            {!override && (
              <span className="text-[var(--color-text-muted)]">{zhCN.timeline.sequenceSettingsInherit}</span>
            )}
          </label>
          <label className="flex items-center gap-2">
            <span className="w-16 shrink-0">{zhCN.timeline.sequenceSettingsWidth}</span>
            <input
              className="w-20 rounded border border-line px-2 py-1 disabled:opacity-50"
              type="number"
              step="1"
              min="1"
              max="16384"
              value={width}
              disabled={!override}
              onChange={(e) => setWidth(e.target.value)}
              data-testid="sequence-settings-width"
            />
            {!override && (
              <span className="text-[var(--color-text-muted)]">{zhCN.timeline.sequenceSettingsInherit}</span>
            )}
          </label>
          <label className="flex items-center gap-2">
            <span className="w-16 shrink-0">{zhCN.timeline.sequenceSettingsHeight}</span>
            <input
              className="w-20 rounded border border-line px-2 py-1 disabled:opacity-50"
              type="number"
              step="1"
              min="1"
              max="16384"
              value={height}
              disabled={!override}
              onChange={(e) => setHeight(e.target.value)}
              data-testid="sequence-settings-height"
            />
            {!override && (
              <span className="text-[var(--color-text-muted)]">{zhCN.timeline.sequenceSettingsInherit}</span>
            )}
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button className="rounded px-3 py-1.5 text-xs hover:bg-panel" type="button" onClick={onClose}>
            {zhCN.common.cancel}
          </button>
          <button
            className="rounded bg-brand px-3 py-1.5 text-xs text-white hover:opacity-90"
            type="button"
            data-testid="sequence-settings-save"
            onClick={() => {
              if (override) {
                onSave({
                  frameRate: parseFloat(fps) || undefined,
                  width: Number.parseInt(width, 10) || undefined,
                  height: Number.parseInt(height, 10) || undefined,
                });
              } else {
                onSave(undefined);
              }
              onClose();
            }}
          >
            {zhCN.common.save}
          </button>
        </div>
      </div>
    </div>
  );
}

export function GapStatsPanel({
  timeline,
  tracks,
  onClose,
}: {
  timeline: { tracks: Track[] };
  tracks: Track[];
  onClose(): void;
}) {
  const gaps = computeTimelineGaps(timeline);
  const stats = getGapStats(gaps);
  return (
    <div
      className="fixed z-50 w-[260px] rounded-md border border-line bg-[var(--color-bg-elevated)] p-3 text-xs shadow-soft"
      style={{ right: 16, top: 120 }}
      data-testid="gap-stats-panel"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold">{zhCN.timeline.gapPanel.title}</span>
        <button className="rounded p-1 hover:bg-panel" type="button" data-testid="gap-stats-close" onClick={onClose}>
          <X size={14} />
        </button>
      </div>
      {stats.totalCount === 0 ? (
        <div className="py-4 text-center text-[var(--color-text-muted)]">{zhCN.timeline.gapPanel.noGaps}</div>
      ) : (
        <div className="space-y-2">
          <div className="flex justify-between">
            <span>{zhCN.timeline.gapPanel.totalCount}</span>
            <span className="font-medium">{stats.totalCount}</span>
          </div>
          <div className="flex justify-between">
            <span>{zhCN.timeline.gapPanel.totalDuration}</span>
            <span className="font-medium">{zhCN.timeline.gapPanel.seconds(stats.totalDuration)}</span>
          </div>
          <div className="flex justify-between">
            <span>{zhCN.timeline.gapPanel.maxGap}</span>
            <span className="font-medium">
              {stats.maxGap ? zhCN.timeline.gapPanel.seconds(stats.maxGap.duration) : '-'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>{zhCN.timeline.gapPanel.minGap}</span>
            <span className="font-medium">
              {stats.minGap ? zhCN.timeline.gapPanel.seconds(stats.minGap.duration) : '-'}
            </span>
          </div>
          {Object.keys(stats.byTrack).length > 1 && (
            <div className="mt-2 border-t border-line pt-2">
              <div className="mb-1 font-semibold">{zhCN.timeline.gapPanel.track}</div>
              {Object.entries(stats.byTrack).map(([trackId, entry]) => {
                const track = tracks.find((t) => t.id === trackId);
                return (
                  <div key={trackId} className="flex justify-between py-0.5">
                    <span className="text-[var(--color-text-secondary)]">{track?.name ?? trackId}</span>
                    <span>
                      {entry.count}
                      {zhCN.timeline.gapPanel.count} / {zhCN.timeline.gapPanel.seconds(entry.totalDuration)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

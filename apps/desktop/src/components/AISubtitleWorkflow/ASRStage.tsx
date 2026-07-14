import { useEffect, useMemo, useCallback, useState } from 'react';
import type { Clip, MediaAsset, Timeline, Track } from '@open-factory/editor-core';
import {
  AddTrackCommand,
  createId,
  createTrack,
  round,
  DEFAULT_CLIP_SPEED,
  DEFAULT_COLOR_CORRECTION,
  DEFAULT_TRANSFORM,
  DEFAULT_SUBTITLE_STYLE,
  DEFAULT_SUBTITLE_MODE,
} from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import { createAsrEngine, type AsrEngine, type SubtitleSegment } from '../../lib/asr';
import { useAsrSettingsStore } from '../../store/asrSettingsStore';
import { useEditorStore } from '../../store/editorStore';
import { commandManager, timelineAccessor } from '../../store/commandManager';
import { showToast } from '../../lib/toast';
import type { ASRState } from './useSubtitleWorkflow';

const t = zhCN.aiSubtitleWorkflow.asr;

interface ASRStageProps {
  asrState: ASRState;
  onUpdate: (patch: Partial<ASRState>) => void;
  onComplete: (trackId: string) => void;
  media: MediaAsset[];
}

export function ASRStage({ asrState, onUpdate, onComplete, media }: ASRStageProps) {
  const asrSettings = useAsrSettingsStore();
  const project = useEditorStore((s) => s.project);
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const timeline = project.timeline;

  const selectedClip = useMemo(() => {
    return timeline.tracks
      .flatMap((track) => track.clips)
      .find((clip) => clip.id === selectedClipId) as Clip | undefined;
  }, [timeline, selectedClipId]);

  const asset = useMemo(() => {
    if (!selectedClip) return undefined;
    const mediaId =
      'mediaId' in selectedClip ? (selectedClip as { mediaId?: string }).mediaId : undefined;
    return media.find((m) => m.id === mediaId);
  }, [selectedClip, media]);

  const engine = useMemo(() => {
    try {
      return createAsrEngine(asrSettings.engine, {
        whisperRsModelPath: asrSettings.whisperRsModelPath,
        whisperCppExecutablePath: asrSettings.whisperCppExecutablePath,
        whisperCppModelPath: asrSettings.whisperCppModelPath,
      });
    } catch {
      return null;
    }
  }, [asrSettings]);

  const [engineAvailable, setEngineAvailable] = useState(false);

  useEffect(() => {
    if (!engine) {
      setEngineAvailable(false);
      return;
    }
    engine.isAvailable().then(setEngineAvailable);
  }, [engine]);

  const canRun = useMemo(
    () =>
      engineAvailable &&
      selectedClip &&
      asset &&
      (selectedClip.type === 'audio' || selectedClip.type === 'video') &&
      !asset.missing,
    [engineAvailable, selectedClip, asset]
  );

  const handleStartASR = useCallback(async () => {
    if (
      !selectedClip ||
      !asset ||
      !engine ||
      (selectedClip.type !== 'audio' && selectedClip.type !== 'video')
    )
      return;

    onUpdate({
      status: 'running',
      progress: 0,
      selectedClipId: selectedClip.id,
      error: null,
    });

    try {
      const segments = await engine.generateSubtitles(
        asset.path,
        { language: asrSettings.language },
        (progress) => onUpdate({ progress: Math.round(progress * 100) })
      );

      const track = buildSubtitleTrackFromSegments(segments, timeline, selectedClip);
      commandManager.execute(new AddTrackCommand(timelineAccessor, track));

      onUpdate({ status: 'done', progress: 100, generatedTrackId: track.id });
      onComplete(track.id);
      showToast({ kind: 'success', title: t.recognitionComplete });
    } catch (error) {
      const message = error instanceof Error ? error.message : t.recognitionFailed;
      onUpdate({ status: 'error', error: message });
      showToast({ kind: 'error', title: t.recognitionFailed, message });
    }
  }, [selectedClip, asset, engine, timeline, asrSettings.language, onUpdate, onComplete]);

  return (
    <div className="space-y-3" data-testid="subtitle-workflow-asr-stage">
      <div className="text-xs text-[var(--color-text-secondary)]">{t.selectClip}</div>

      {!selectedClip && (
        <div className="rounded-md border border-line bg-[var(--color-bg-elevated)] p-3 text-xs text-[var(--color-text-muted)]">
          {t.noClipSelected}
        </div>
      )}

      {selectedClip && (
        <div className="rounded-md border border-line bg-[var(--color-bg-elevated)] p-3 text-xs">
          <div className="font-medium text-ink">{selectedClip.name || selectedClip.id}</div>
          <div className="mt-1 text-[var(--color-text-muted)]">
            {selectedClip.type === 'video' ? '视频' : '音频'} ·{' '}
            {selectedClip.duration.toFixed(1)}s
          </div>
        </div>
      )}

      {/* ASR 引擎选择 */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-[var(--color-text-secondary)]">ASR 引擎</label>
        <select
          value={asrSettings.engine}
          onChange={(e) =>
            asrSettings.setEngine(e.target.value as 'whisper-rs' | 'whisper-cpp')
          }
          className="w-full rounded-md border border-line bg-[var(--color-bg-elevated)] p-1.5 text-xs"
          data-testid="asr-engine-select"
        >
          <option value="whisper-rs">whisper-rs (推荐)</option>
          <option value="whisper-cpp">whisper.cpp (外部)</option>
        </select>
      </div>

      {/* 引擎状态 */}
      <div className="flex items-center gap-2 text-xs">
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            engineAvailable ? 'bg-emerald-500' : 'bg-red-500'
          }`}
        />
        <span className="text-[var(--color-text-secondary)]">
          {engineAvailable ? t.whisperReady : t.whisperNotConfigured}
        </span>
      </div>

      {asrState.status === 'idle' && (
        <button
          className="w-full rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          disabled={!canRun}
          onClick={() => void handleStartASR()}
          data-testid="subtitle-workflow-asr-start"
        >
          {t.startRecognition}
        </button>
      )}

      {asrState.status === 'running' && (
        <div className="space-y-2">
          <div
            className="text-xs text-[var(--color-text-secondary)]"
            data-testid="subtitle-workflow-asr-progress"
          >
            {t.recognizing}
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-bg-elevated)]">
            <div
              className="h-full bg-[var(--color-accent)] transition-all"
              style={{ width: `${asrState.progress}%` }}
            />
          </div>
          <div className="text-right text-xs text-[var(--color-text-muted)]">
            {asrState.progress}%
          </div>
        </div>
      )}

      {asrState.status === 'error' && (
        <div
          className="rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-700"
          data-testid="subtitle-workflow-asr-error"
        >
          {asrState.error}
        </div>
      )}
    </div>
  );
}

function buildSubtitleTrackFromSegments(
  segments: SubtitleSegment[],
  timeline: Timeline,
  clip: Clip
): Track {
  const trackId = createId('track');
  const trackNumber =
    timeline.tracks.filter((track) => track.type === 'subtitle').length + 1;

  return createTrack({
    id: trackId,
    type: 'subtitle',
    name: `AI 字幕 ${trackNumber}`,
    clips: segments.map((segment, index) => ({
      id: createId('clip'),
      type: 'subtitle' as const,
      name: `字幕 ${index + 1}`,
      trackId,
      start: round(clip.start + segment.startMs / 1000),
      duration: round((segment.endMs - segment.startMs) / 1000),
      trimStart: 0,
      trimEnd: 0,
      speed: DEFAULT_CLIP_SPEED,
      colorCorrection: { ...DEFAULT_COLOR_CORRECTION },
      transform: { ...DEFAULT_TRANSFORM },
      text: segment.text,
      style: { ...DEFAULT_SUBTITLE_STYLE },
      subtitleMode: DEFAULT_SUBTITLE_MODE,
    })),
  });
}

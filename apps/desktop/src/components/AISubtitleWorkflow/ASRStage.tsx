import { useEffect, useMemo, useCallback } from 'react';
import type { Clip, MediaAsset } from '@open-factory/editor-core';
import { AddTrackCommand } from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import { buildWhisperSubtitleTrackForClip, canGenerateSubtitlesForClip, getWhisperAvailability } from '../../lib/whisper';
import { useWhisperSettingsStore } from '../../store/whisperSettingsStore';
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
  const whisperExecutablePath = useWhisperSettingsStore((s) => s.executablePath);
  const whisperModelPath = useWhisperSettingsStore((s) => s.modelPath);
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
    const mediaId = 'mediaId' in selectedClip ? (selectedClip as { mediaId?: string }).mediaId : undefined;
    return media.find((m) => m.id === mediaId);
  }, [selectedClip, media]);

  const canRun = useMemo(
    () => canGenerateSubtitlesForClip(selectedClip, asset, asrState.whisperReady),
    [selectedClip, asset, asrState.whisperReady]
  );

  useEffect(() => {
    let disposed = false;
    void getWhisperAvailability({
      executablePath: whisperExecutablePath,
      modelPath: whisperModelPath,
    }).then((availability) => {
      if (!disposed) {
        onUpdate({ whisperReady: availability.ready });
      }
    });
    return () => { disposed = true; };
  }, [whisperExecutablePath, whisperModelPath, onUpdate]);

  const handleStartASR = useCallback(async () => {
    if (!selectedClip || !asset || (selectedClip.type !== 'audio' && selectedClip.type !== 'video')) return;

    onUpdate({ status: 'running', progress: 0, selectedClipId: selectedClip.id, error: null });

    try {
      const track = await buildWhisperSubtitleTrackForClip(
        selectedClip as Extract<Clip, { type: 'audio' | 'video' }>,
        asset,
        timeline,
        { executablePath: whisperExecutablePath, modelPath: whisperModelPath }
      );

      commandManager.execute(new AddTrackCommand(timelineAccessor, track));
      onUpdate({ status: 'done', progress: 100, generatedTrackId: track.id });
      onComplete(track.id);
      showToast({ kind: 'success', title: t.recognitionComplete });
    } catch (error) {
      const message = error instanceof Error ? error.message : t.recognitionFailed;
      onUpdate({ status: 'error', error: message });
      showToast({ kind: 'error', title: t.recognitionFailed, message });
    }
  }, [selectedClip, asset, timeline, whisperExecutablePath, whisperModelPath, onUpdate, onComplete]);

  return (
    <div className="space-y-3" data-testid="subtitle-workflow-asr-stage">
      <div className="text-xs text-[var(--color-text-secondary)]">
        {t.selectClip}
      </div>

      {!selectedClip && (
        <div className="rounded-md border border-line bg-[var(--color-bg-elevated)] p-3 text-xs text-[var(--color-text-muted)]">
          {t.noClipSelected}
        </div>
      )}

      {selectedClip && (
        <div className="rounded-md border border-line bg-[var(--color-bg-elevated)] p-3 text-xs">
          <div className="font-medium text-ink">{selectedClip.name || selectedClip.id}</div>
          <div className="mt-1 text-[var(--color-text-muted)]">
            {selectedClip.type === 'video' ? '视频' : '音频'} · {selectedClip.duration.toFixed(1)}s
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 text-xs">
        <span className={`inline-block h-2 w-2 rounded-full ${asrState.whisperReady ? 'bg-emerald-500' : 'bg-red-500'}`} />
        <span className="text-[var(--color-text-secondary)]">
          {asrState.whisperReady ? t.whisperReady : t.whisperNotConfigured}
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
          <div className="text-xs text-[var(--color-text-secondary)]" data-testid="subtitle-workflow-asr-progress">
            {t.recognizing}
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-bg-elevated)]">
            <div className="h-full bg-[var(--color-accent)] transition-all animate-pulse" style={{ width: '60%' }} />
          </div>
        </div>
      )}

      {asrState.status === 'error' && (
        <div className="rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-700" data-testid="subtitle-workflow-asr-error">
          {asrState.error}
        </div>
      )}
    </div>
  );
}

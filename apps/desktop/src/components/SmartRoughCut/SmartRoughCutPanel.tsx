import {
  AddTrackCommand,
  RemoveSilenceCommand,
  SplitClipAtTimesCommand,
  getClipSpeed,
  round,
  type Clip,
  type MediaAsset,
  type SilentRange
} from '@open-factory/editor-core';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { zhCN } from '../../i18n/strings';
import { detectClipSilence } from '../../lib/silenceDetection';
import { detectSceneChanges } from '../../lib/tauri-bridge';
import { buildWhisperSubtitleTrackForClip, canGenerateSubtitlesForClip, getWhisperAvailability, type WhisperAvailability } from '../../lib/whisper';
import { showToast } from '../../lib/toast';
import { commandManager, timelineAccessor } from '../../store/commandManager';
import { useEditorStore } from '../../store/editorStore';
import { useWhisperSettingsStore } from '../../store/whisperSettingsStore';
import {
  createInitialSmartRoughCutState,
  markSmartRoughCutStepComplete,
  markSmartRoughCutStepError,
  markSmartRoughCutStepRunning,
  type SmartRoughCutStep,
  type SmartRoughCutStepStatus
} from './smart-rough-cut-state';

interface SmartRoughCutPanelProps {
  selectedClip?: Clip;
  media: MediaAsset[];
}

export function SmartRoughCutPanel({ selectedClip, media }: SmartRoughCutPanelProps) {
  const [state, setState] = useState(createInitialSmartRoughCutState);
  const [pendingScene, setPendingScene] = useState<{ clipId: string; splitTimes: number[] }>();
  const [pendingSilence, setPendingSilence] = useState<{ clipId: string; ranges: SilentRange[] }>();
  const [whisperAvailability, setWhisperAvailability] = useState<WhisperAvailability>({ ready: false, error: zhCN.whisper.notConfigured });
  const whisperExecutablePath = useWhisperSettingsStore((item) => item.executablePath);
  const whisperModelPath = useWhisperSettingsStore((item) => item.modelPath);
  const setSelectedClipId = useEditorStore((item) => item.setSelectedClipId);
  const asset = useMemo(() => getClipMediaAsset(selectedClip, media), [selectedClip, media]);
  const anyRunning = Object.values(state.steps).some((step) => step.status === 'running');
  const canRunScene = selectedClip?.type === 'video' && Boolean(asset);
  const canRunSilence = Boolean(selectedClip && asset && (selectedClip.type === 'audio' || (selectedClip.type === 'video' && asset.hasAudio)));
  const canRunWhisper = canGenerateSubtitlesForClip(selectedClip, asset, whisperAvailability.ready);

  useEffect(() => {
    let disposed = false;
    void getWhisperAvailability({ executablePath: whisperExecutablePath, modelPath: whisperModelPath }).then((availability) => {
      if (!disposed) {
        setWhisperAvailability(availability);
      }
    });
    return () => {
      disposed = true;
    };
  }, [whisperExecutablePath, whisperModelPath]);

  async function runSceneDetection(): Promise<void> {
    await runStep('scene', async () => {
      const { clip, mediaAsset } = requireSelectedMedia('scene');
      if (clip.type !== 'video') {
        throw new Error(zhCN.smartRoughCut.sceneUnavailable);
      }
      const speed = getClipSpeed(clip);
      const sourceStart = clip.trimStart;
      const sourceEnd = sourceStart + clip.duration * speed;
      const result = await detectSceneChanges({ path: mediaAsset.path, threshold: 0.3, duration: mediaAsset.duration || clip.duration });
      const splitTimes = result.sceneTimes
        .filter((time) => time > sourceStart + 0.000001 && time < sourceEnd - 0.000001)
        .map((time) => round((time - sourceStart) / speed));
      setPendingScene({ clipId: clip.id, splitTimes });
      return {};
    });
  }

  async function runSilenceDetection(): Promise<void> {
    await runStep('silence', async () => {
      const { clip, mediaAsset } = requireSelectedMedia('silence');
      if (clip.type !== 'audio' && clip.type !== 'video') {
        throw new Error(zhCN.smartRoughCut.silenceUnavailable);
      }
      if (clip.type === 'video' && !mediaAsset.hasAudio) {
        throw new Error(zhCN.smartRoughCut.silenceUnavailable);
      }
      const ranges = await detectClipSilence(clip, mediaAsset, {
        thresholdDb: -40,
        minSilenceDuration: 0.5,
        marginDuration: 0.1
      });
      setPendingSilence({ clipId: clip.id, ranges });
      return {};
    });
  }

  function applySceneSplit(): void {
    if (!pendingScene) {
      return;
    }
    try {
      if (pendingScene.splitTimes.length > 0) {
        commandManager.execute(new SplitClipAtTimesCommand(timelineAccessor, pendingScene.clipId, pendingScene.splitTimes));
      }
      setState((current) => markSmartRoughCutStepComplete(current, 'scene', { sceneSplits: pendingScene.splitTimes.length }));
      setPendingScene(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : zhCN.timeline.timelineRejectedMessage;
      setState((current) => markSmartRoughCutStepError(current, 'scene', message));
      showToast({ kind: 'warning', title: zhCN.smartRoughCut.stepFailed(zhCN.smartRoughCut.steps.scene), message });
    }
  }

  function applySilenceRemoval(): void {
    if (!pendingSilence) {
      return;
    }
    try {
      if (pendingSilence.ranges.length > 0) {
        commandManager.execute(new RemoveSilenceCommand(timelineAccessor, pendingSilence.clipId, pendingSilence.ranges));
      }
      setState((current) => markSmartRoughCutStepComplete(current, 'silence', { removedSilenceSeconds: sumSilentDuration(pendingSilence.ranges) }));
      setPendingSilence(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : zhCN.timeline.timelineRejectedMessage;
      setState((current) => markSmartRoughCutStepError(current, 'silence', message));
      showToast({ kind: 'warning', title: zhCN.smartRoughCut.stepFailed(zhCN.smartRoughCut.steps.silence), message });
    }
  }

  async function runWhisper(): Promise<void> {
    await runStep('whisper', async () => {
      const { clip, mediaAsset } = requireSelectedMedia('whisper');
      const availability = await getWhisperAvailability({ executablePath: whisperExecutablePath, modelPath: whisperModelPath });
      if (!availability.ready) {
        throw new Error(availability.error ?? zhCN.whisper.notConfigured);
      }
      if ((clip.type !== 'audio' && clip.type !== 'video') || !canGenerateSubtitlesForClip(clip, mediaAsset, true)) {
        throw new Error(zhCN.smartRoughCut.whisperUnavailable);
      }
      const track = await buildWhisperSubtitleTrackForClip(clip, mediaAsset, useEditorStore.getState().project.timeline, {
        executablePath: whisperExecutablePath,
        modelPath: whisperModelPath
      });
      if (track.clips.length === 0) {
        throw new Error(zhCN.whisper.noSubtitleCues);
      }
      commandManager.execute(new AddTrackCommand(timelineAccessor, track));
      setSelectedClipId(track.clips[0]?.id);
      return { subtitleClips: track.clips.length };
    });
  }

  async function runStep(step: SmartRoughCutStep, execute: () => Promise<Partial<typeof state.report>>): Promise<void> {
    setState((current) => markSmartRoughCutStepRunning(current, step));
    try {
      const reportPatch = await execute();
      setState((current) => markSmartRoughCutStepComplete(current, step, reportPatch));
      showToast({ kind: 'success', title: zhCN.smartRoughCut.stepComplete(zhCN.smartRoughCut.steps[step]) });
    } catch (error) {
      const message = error instanceof Error ? error.message : zhCN.timeline.timelineRejectedMessage;
      setState((current) => markSmartRoughCutStepError(current, step, message));
      showToast({ kind: 'warning', title: zhCN.smartRoughCut.stepFailed(zhCN.smartRoughCut.steps[step]), message });
    }
  }

  function requireSelectedMedia(step: SmartRoughCutStep): { clip: Clip; mediaAsset: MediaAsset } {
    if (!selectedClip || !asset) {
      throw new Error(step === 'scene' ? zhCN.smartRoughCut.sceneUnavailable : step === 'silence' ? zhCN.smartRoughCut.silenceUnavailable : zhCN.smartRoughCut.whisperUnavailable);
    }
    return { clip: selectedClip, mediaAsset: asset };
  }

  return (
    <section className="flex min-h-0 flex-col bg-white" data-testid="smart-rough-cut-panel">
      <div className="border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold text-ink">{zhCN.smartRoughCut.title}</h2>
        <div className="mt-1 truncate text-xs text-slate-500" data-testid="smart-rough-cut-selected">
          {selectedClip ? selectedClip.name : zhCN.smartRoughCut.noSelection}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        <SmartStep
          title={zhCN.smartRoughCut.steps.scene}
          description={zhCN.smartRoughCut.sceneDescription}
          status={state.steps.scene.status}
          error={state.steps.scene.error}
          testId="smart-scene"
          buttonLabel={zhCN.smartRoughCut.detectScene}
          disabled={anyRunning || !canRunScene}
          onRun={() => void runSceneDetection()}
        >
          {pendingScene ? (
            <PreviewAction
              testId="smart-scene"
              text={zhCN.smartRoughCut.scenePreview(pendingScene.splitTimes)}
              buttonLabel={zhCN.smartRoughCut.applySceneSplit}
              onApply={applySceneSplit}
            />
          ) : null}
        </SmartStep>
        <SmartStep
          title={zhCN.smartRoughCut.steps.silence}
          description={zhCN.smartRoughCut.silenceDescription}
          status={state.steps.silence.status}
          error={state.steps.silence.error}
          testId="smart-silence"
          buttonLabel={zhCN.smartRoughCut.detectSilence}
          disabled={anyRunning || !canRunSilence}
          onRun={() => void runSilenceDetection()}
        >
          {pendingSilence ? (
            <PreviewAction
              testId="smart-silence"
              text={zhCN.smartRoughCut.silencePreview(pendingSilence.ranges.length, sumSilentDuration(pendingSilence.ranges).toFixed(1))}
              buttonLabel={zhCN.smartRoughCut.applySilenceRemoval}
              onApply={applySilenceRemoval}
            />
          ) : null}
        </SmartStep>
        <SmartStep
          title={zhCN.smartRoughCut.steps.whisper}
          description={whisperAvailability.ready ? zhCN.smartRoughCut.whisperDescription : whisperAvailability.error ?? zhCN.whisper.notConfigured}
          status={state.steps.whisper.status}
          error={state.steps.whisper.error}
          testId="smart-whisper"
          buttonLabel={zhCN.smartRoughCut.generateSubtitles}
          disabled={anyRunning || !canRunWhisper}
          onRun={() => void runWhisper()}
        />
        <div className="mt-3 rounded-md border border-line bg-panel p-3 text-xs text-slate-600" data-testid="smart-rough-cut-report">
          {zhCN.smartRoughCut.report(state.report.removedSilenceSeconds.toFixed(1), state.report.sceneSplits, state.report.subtitleClips)}
        </div>
      </div>
    </section>
  );
}

function SmartStep({
  title,
  description,
  status,
  error,
  testId,
  buttonLabel,
  disabled,
  onRun,
  children
}: {
  title: string;
  description: string;
  status: SmartRoughCutStepStatus;
  error?: string;
  testId: string;
  buttonLabel: string;
  disabled: boolean;
  onRun(): void;
  children?: ReactNode;
}) {
  return (
    <section className="mb-3 rounded-md border border-line bg-white p-3">
      <div className="flex items-center gap-2">
        <h3 className="min-w-0 flex-1 truncate text-xs font-semibold text-ink">{title}</h3>
        <span className="rounded border border-line bg-panel px-1.5 py-0.5 text-[10px] font-medium text-slate-600" data-testid={`${testId}-status`} data-status={status}>
          {zhCN.smartRoughCut.statuses[status]}
        </span>
      </div>
      <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
      {error ? <div className="mt-1 text-xs text-rose-700">{error}</div> : null}
      <button className="mt-2 w-full rounded-md bg-brand px-3 py-2 text-xs font-medium text-white disabled:opacity-40" type="button" disabled={disabled} data-testid={`${testId}-button`} onClick={onRun}>
        {buttonLabel}
      </button>
      {children}
    </section>
  );
}

function PreviewAction({ testId, text, buttonLabel, onApply }: { testId: string; text: string; buttonLabel: string; onApply(): void }) {
  return (
    <div className="mt-2 rounded-md border border-line bg-panel p-2 text-xs text-slate-600" data-testid={`${testId}-preview`}>
      <div>{text}</div>
      <button className="mt-2 rounded-md border border-line bg-white px-2 py-1.5 font-medium text-slate-700 hover:bg-panel" type="button" data-testid={`${testId}-apply-button`} onClick={onApply}>
        {buttonLabel}
      </button>
    </div>
  );
}

function getClipMediaAsset(clip: Clip | undefined, media: MediaAsset[]): MediaAsset | undefined {
  if (!clip || !('mediaId' in clip)) {
    return undefined;
  }
  return media.find((asset) => asset.id === clip.mediaId);
}

function sumSilentDuration(ranges: SilentRange[]): number {
  return round(ranges.reduce((total, range) => total + range.duration, 0));
}

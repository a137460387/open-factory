/**
 * 智能粗剪分步编排 hook
 *
 * 从 SmartRoughCutStepPanel 逐字搬移的编排逻辑：六步检测运行（scene/silence/
 * whisper/dialogue/broll/rhythm）、结果暂存与勾选、命令化应用、步骤状态机标记。
 * 检测后端与命令对象全部复用现有实现，行为等价搬移，零逻辑改动。
 */
import {
  AddTrackCommand,
  BrollInsertCommand,
  DialogueRoughCutCommand,
  RemoveSilenceCommand,
  RhythmAssembleCommand,
  SplitClipAtTimesCommand,
  buildBrollInsertClips,
  createTrack,
  getClipSpeed,
  round,
  type Clip,
  type MediaAsset,
  type Track,
} from '@open-factory/editor-core';
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { zhCN } from '../../i18n/strings';
import { detectClipDialogue } from '../../lib/dialogueDetection';
import { detectClipSilence } from '../../lib/silenceDetection';
import { detectSceneChanges } from '../../lib/tauri-bridge';
import {
  buildWhisperSubtitleTrackForClip,
  canGenerateSubtitlesForClip,
  getWhisperAvailability,
  type WhisperAvailability,
} from '../../lib/whisper';
import { showToast } from '../../lib/toast';
import { commandManager, timelineAccessor } from '../../store/commandManager';
import { useEditorStore } from '../../store/editorStore';
import { useSmartRoughCutOrchestratorStore } from '../../store/smartRoughCutOrchestratorStore';
import { useWhisperSettingsStore } from '../../store/whisperSettingsStore';
import {
  createSmartRoughCutSelection,
  getSelectedSmartRoughCutIds,
  type SmartRoughCutReport,
  type SmartRoughCutSelection,
  type SmartRoughCutState,
  type SmartRoughCutStep,
} from './smart-rough-cut-state';
import {
  buildBrollCandidates,
  buildSceneCandidates,
  getClipMediaAsset,
  getPrimaryVisualClips,
  getRhythmBeatTimes,
  getTimelineClips,
  isVisualClip,
  sumSilentDuration,
  type SceneCandidate,
  type SilenceCandidate,
} from './smart-rough-cut-utils';

export interface PendingSceneResult {
  clipId: string;
  items: SceneCandidate[];
  selection: SmartRoughCutSelection;
}

export interface PendingSilenceResult {
  clipId: string;
  items: SilenceCandidate[];
  selection: SmartRoughCutSelection;
}

export interface UseSmartRoughCutResult {
  /** 分步状态机（各步骤状态 + 累计报告），供面板渲染徽标与报告 */
  stepState: SmartRoughCutState;
  /** 场景检测暂存结果（含逐项勾选） */
  pendingScene: PendingSceneResult | undefined;
  setPendingScene: Dispatch<SetStateAction<PendingSceneResult | undefined>>;
  /** 静音检测暂存结果（含逐项勾选） */
  pendingSilence: PendingSilenceResult | undefined;
  setPendingSilence: Dispatch<SetStateAction<PendingSilenceResult | undefined>>;
  /** Whisper 可用性（设置路径校验结果） */
  whisperAvailability: WhisperAvailability;
  /** 任一步骤运行中（按钮禁用联动） */
  anyRunning: boolean;
  canRunScene: boolean;
  canRunSilence: boolean;
  canRunWhisper: boolean;
  canRunDialogue: boolean;
  canRunBroll: boolean;
  canRunRhythm: boolean;
  /** 视频轨道列表（B-roll / 节拍目标轨道下拉） */
  videoTracks: Track[];
  /** 节拍时间轴（描述文案与节奏装配前置） */
  rhythmBeatTimes: number[];
  brollTrackId: string;
  setBrollTrackId: Dispatch<SetStateAction<string>>;
  rhythmTrackId: string;
  setRhythmTrackId: Dispatch<SetStateAction<string>>;
  runSceneDetection(): Promise<void>;
  runSilenceDetection(): Promise<void>;
  runWhisper(): Promise<void>;
  runDialogueRoughCut(): Promise<void>;
  runBrollInsert(): Promise<void>;
  runRhythmAssemble(): Promise<void>;
  applySceneSplit(): void;
  applySilenceRemoval(): void;
}

export function useSmartRoughCut(selectedClip: Clip | undefined, media: MediaAsset[]): UseSmartRoughCutResult {
  const [pendingScene, setPendingScene] = useState<PendingSceneResult>();
  const [pendingSilence, setPendingSilence] = useState<PendingSilenceResult>();
  const [brollTrackId, setBrollTrackId] = useState('');
  const [rhythmTrackId, setRhythmTrackId] = useState('');
  const [whisperAvailability, setWhisperAvailability] = useState<WhisperAvailability>({
    ready: false,
    error: zhCN.whisper.notConfigured,
  });
  const stepState = useSmartRoughCutOrchestratorStore((store) => store.stepState);
  const markStepRunning = useSmartRoughCutOrchestratorStore((store) => store.markStepRunning);
  const markStepComplete = useSmartRoughCutOrchestratorStore((store) => store.markStepComplete);
  const markStepError = useSmartRoughCutOrchestratorStore((store) => store.markStepError);
  const whisperExecutablePath = useWhisperSettingsStore((item) => item.executablePath);
  const whisperModelPath = useWhisperSettingsStore((item) => item.modelPath);
  const project = useEditorStore((item) => item.project);
  const selectedClipIds = useEditorStore((item) => item.selectedClipIds);
  const setSelectedClipId = useEditorStore((item) => item.setSelectedClipId);
  const timeline = project.timeline;
  const asset = useMemo(() => getClipMediaAsset(selectedClip, media), [selectedClip, media]);
  const selectedTimelineClips = useMemo(
    () => getTimelineClips(timeline).filter((clip) => selectedClipIds.includes(clip.id)),
    [selectedClipIds, timeline],
  );
  const selectedVisualClips = useMemo(() => selectedTimelineClips.filter(isVisualClip), [selectedTimelineClips]);
  const mainVisualClips = useMemo(
    () => getPrimaryVisualClips(timeline, selectedVisualClips),
    [selectedVisualClips, timeline],
  );
  const videoTracks = useMemo(() => timeline.tracks.filter((track) => track.type === 'video'), [timeline]);
  const rhythmBeatTimes = useMemo(
    () => getRhythmBeatTimes(project, selectedTimelineClips),
    [project, selectedTimelineClips],
  );
  const anyRunning = Object.values(stepState.steps).some((step) => step.status === 'running');
  const canRunScene = selectedClip?.type === 'video' && Boolean(asset);
  const canRunSilence = Boolean(
    selectedClip && asset && (selectedClip.type === 'audio' || (selectedClip.type === 'video' && asset.hasAudio)),
  );
  const canRunWhisper = canGenerateSubtitlesForClip(selectedClip, asset, whisperAvailability.ready);
  const canRunDialogue = Boolean(
    selectedClip && asset && (selectedClip.type === 'audio' || (selectedClip.type === 'video' && asset.hasAudio)),
  );
  const canRunBroll = mainVisualClips.length > 0 && buildBrollCandidates(media, selectedTimelineClips).length > 0;
  const canRunRhythm = selectedVisualClips.length > 0 && rhythmBeatTimes.length >= 2;

  useEffect(() => {
    let disposed = false;
    void getWhisperAvailability({ executablePath: whisperExecutablePath, modelPath: whisperModelPath }).then(
      (availability) => {
        if (!disposed) {
          setWhisperAvailability(availability);
        }
      },
    );
    return () => {
      disposed = true;
    };
  }, [whisperExecutablePath, whisperModelPath]);

  useEffect(() => {
    if (rhythmTrackId && videoTracks.some((track) => track.id === rhythmTrackId)) {
      return;
    }
    setRhythmTrackId(selectedVisualClips[0]?.trackId ?? videoTracks[0]?.id ?? '');
  }, [rhythmTrackId, selectedVisualClips, videoTracks]);

  async function runSceneDetection(): Promise<void> {
    await runStep('scene', async () => {
      const { clip, mediaAsset } = requireSelectedMedia('scene');
      if (clip.type !== 'video') {
        throw new Error(zhCN.smartRoughCut.sceneUnavailable);
      }
      const speed = getClipSpeed(clip);
      const sourceStart = clip.trimStart;
      const sourceEnd = sourceStart + clip.duration * speed;
      const result = await detectSceneChanges({
        path: mediaAsset.path,
        threshold: 0.3,
        duration: mediaAsset.duration || clip.duration,
      });
      const splitTimes = result.sceneTimes
        .filter((time) => time > sourceStart + 0.000001 && time < sourceEnd - 0.000001)
        .map((time) => round((time - sourceStart) / speed));
      const items = buildSceneCandidates(splitTimes, clip.duration, mediaAsset.thumbnail);
      setPendingScene({
        clipId: clip.id,
        items,
        selection: createSmartRoughCutSelection(items.map((item) => item.id)),
      });
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
        marginDuration: 0.1,
      });
      const items = ranges.map((range, index) => ({ id: `silence-${index}`, range }));
      setPendingSilence({
        clipId: clip.id,
        items,
        selection: createSmartRoughCutSelection(items.map((item) => item.id)),
      });
      return {};
    });
  }

  function applySceneSplit(): void {
    if (!pendingScene) {
      return;
    }
    try {
      const selectedIds = new Set(getSelectedSmartRoughCutIds(pendingScene.selection));
      const splitTimes = pendingScene.items
        .filter((item) => selectedIds.has(item.id) && typeof item.splitTime === 'number')
        .map((item) => item.splitTime!);
      if (splitTimes.length > 0) {
        commandManager.execute(new SplitClipAtTimesCommand(timelineAccessor, pendingScene.clipId, splitTimes));
      }
      markStepComplete('scene', { sceneSplits: splitTimes.length });
      setPendingScene(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : zhCN.timeline.timelineRejectedMessage;
      markStepError('scene', message);
      showToast({ kind: 'warning', title: zhCN.smartRoughCut.stepFailed(zhCN.smartRoughCut.steps.scene), message });
    }
  }

  function applySilenceRemoval(): void {
    if (!pendingSilence) {
      return;
    }
    try {
      const selectedIds = new Set(getSelectedSmartRoughCutIds(pendingSilence.selection));
      const ranges = pendingSilence.items.filter((item) => selectedIds.has(item.id)).map((item) => item.range);
      if (ranges.length > 0) {
        commandManager.execute(new RemoveSilenceCommand(timelineAccessor, pendingSilence.clipId, ranges));
      }
      markStepComplete('silence', { removedSilenceSeconds: sumSilentDuration(ranges) });
      setPendingSilence(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : zhCN.timeline.timelineRejectedMessage;
      markStepError('silence', message);
      showToast({ kind: 'warning', title: zhCN.smartRoughCut.stepFailed(zhCN.smartRoughCut.steps.silence), message });
    }
  }

  async function runWhisper(): Promise<void> {
    await runStep('whisper', async () => {
      const { clip, mediaAsset } = requireSelectedMedia('whisper');
      const availability = await getWhisperAvailability({
        executablePath: whisperExecutablePath,
        modelPath: whisperModelPath,
      });
      if (!availability.ready) {
        throw new Error(availability.error ?? zhCN.whisper.notConfigured);
      }
      if ((clip.type !== 'audio' && clip.type !== 'video') || !canGenerateSubtitlesForClip(clip, mediaAsset, true)) {
        throw new Error(zhCN.smartRoughCut.whisperUnavailable);
      }
      const track = await buildWhisperSubtitleTrackForClip(
        clip,
        mediaAsset,
        useEditorStore.getState().project.timeline,
        {
          executablePath: whisperExecutablePath,
          modelPath: whisperModelPath,
        },
      );
      if (track.clips.length === 0) {
        throw new Error(zhCN.whisper.noSubtitleCues);
      }
      commandManager.execute(new AddTrackCommand(timelineAccessor, track));
      setSelectedClipId(track.clips[0]?.id);
      return { subtitleClips: track.clips.length };
    });
  }

  async function runDialogueRoughCut(): Promise<void> {
    await runStep('dialogue', async () => {
      const { clip, mediaAsset } = requireSelectedMedia('dialogue');
      if (clip.type !== 'audio' && clip.type !== 'video') {
        throw new Error(zhCN.smartRoughCut.dialogueUnavailable);
      }
      if (clip.type === 'video' && !mediaAsset.hasAudio) {
        throw new Error(zhCN.smartRoughCut.dialogueUnavailable);
      }
      const intervals = await detectClipDialogue(clip, mediaAsset, 'medium');
      const command = new DialogueRoughCutCommand(timelineAccessor, clip.id, intervals);
      commandManager.execute(command);
      setSelectedClipId(`${clip.id}-dialogue-1`);
      return { dialogueClips: command.clipCount };
    });
  }

  async function runBrollInsert(): Promise<void> {
    await runStep('broll', async () => {
      const candidates = buildBrollCandidates(media, selectedTimelineClips);
      const targetTrackId = brollTrackId || 'track-broll-auto';
      ensureVideoTrack(targetTrackId, zhCN.smartRoughCut.steps.broll);
      const clips = buildBrollInsertClips(mainVisualClips, candidates, targetTrackId);
      if (clips.length === 0) {
        throw new Error(zhCN.smartRoughCut.brollUnavailable);
      }
      commandManager.execute(new BrollInsertCommand(timelineAccessor, clips));
      setSelectedClipId(clips[0]?.id);
      return { brollClips: clips.length };
    });
  }

  async function runRhythmAssemble(): Promise<void> {
    await runStep('rhythm', async () => {
      const targetTrackId = rhythmTrackId || selectedVisualClips[0]?.trackId || videoTracks[0]?.id;
      if (!targetTrackId || selectedVisualClips.length === 0 || rhythmBeatTimes.length < 2) {
        throw new Error(zhCN.smartRoughCut.rhythmUnavailable);
      }
      const command = new RhythmAssembleCommand(
        timelineAccessor,
        selectedVisualClips.map((clip) => clip.id),
        rhythmBeatTimes,
        targetTrackId,
      );
      commandManager.execute(command);
      setSelectedClipId(`${selectedVisualClips[0].id}-rhythm-1`);
      return { rhythmClips: command.clipCount };
    });
  }

  async function runStep(step: SmartRoughCutStep, execute: () => Promise<Partial<SmartRoughCutReport>>): Promise<void> {
    markStepRunning(step);
    try {
      const reportPatch = await execute();
      markStepComplete(step, reportPatch);
      showToast({ kind: 'success', title: zhCN.smartRoughCut.stepComplete(zhCN.smartRoughCut.steps[step]) });
    } catch (error) {
      const message = error instanceof Error ? error.message : zhCN.timeline.timelineRejectedMessage;
      markStepError(step, message);
      showToast({ kind: 'warning', title: zhCN.smartRoughCut.stepFailed(zhCN.smartRoughCut.steps[step]), message });
    }
  }

  function requireSelectedMedia(step: SmartRoughCutStep): { clip: Clip; mediaAsset: MediaAsset } {
    if (!selectedClip || !asset) {
      throw new Error(
        step === 'scene'
          ? zhCN.smartRoughCut.sceneUnavailable
          : step === 'silence'
            ? zhCN.smartRoughCut.silenceUnavailable
            : step === 'dialogue'
              ? zhCN.smartRoughCut.dialogueUnavailable
              : zhCN.smartRoughCut.whisperUnavailable,
      );
    }
    return { clip: selectedClip, mediaAsset: asset };
  }

  function ensureVideoTrack(trackId: string, name: string): void {
    if (timelineAccessor.getTimeline().tracks.some((track) => track.id === trackId)) {
      return;
    }
    commandManager.execute(
      new AddTrackCommand(timelineAccessor, createTrack({ id: trackId, type: 'video', name, clips: [] })),
    );
  }

  return {
    stepState,
    pendingScene,
    setPendingScene,
    pendingSilence,
    setPendingSilence,
    whisperAvailability,
    anyRunning,
    canRunScene,
    canRunSilence,
    canRunWhisper,
    canRunDialogue,
    canRunBroll,
    canRunRhythm,
    videoTracks,
    rhythmBeatTimes,
    brollTrackId,
    setBrollTrackId,
    rhythmTrackId,
    setRhythmTrackId,
    runSceneDetection,
    runSilenceDetection,
    runWhisper,
    runDialogueRoughCut,
    runBrollInsert,
    runRhythmAssemble,
    applySceneSplit,
    applySilenceRemoval,
  };
}

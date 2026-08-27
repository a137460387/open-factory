/**
 * 智能粗剪分步编排 hook
 *
 * 从 SmartRoughCutStepPanel 逐字搬移的编排逻辑：六步检测运行（scene/silence/
 * whisper/dialogue/broll/rhythm）、结果暂存与勾选、命令化应用、步骤状态机标记。
 * 检测后端与命令对象全部复用现有实现，行为等价搬移，零逻辑改动。
 */
import {
  AddTrackCommand,
  ApplyRoughCutProposalCommand,
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
  type DialogueSensitivity,
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
import { useTranscriptForClip, type UseTranscriptForClipResult } from './useTranscriptForClip';
import { generateSemanticRoughCutSuggestions, type SemanticRoughCutSuggestion } from './semantic-suggestion';
import { suggestionToSegments } from './semantic-suggestion-review';
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
  /** 场景检测阈值（默认 0.3，与原硬编码一致） */
  sceneThreshold: number;
  setSceneThreshold: Dispatch<SetStateAction<number>>;
  /** 静音检测阈值 dB（默认 -40，与原硬编码一致） */
  silenceMinDb: number;
  setSilenceMinDb: Dispatch<SetStateAction<number>>;
  /** 静音最短时长秒（默认 0.5，与原硬编码一致） */
  silenceMinDuration: number;
  setSilenceMinDuration: Dispatch<SetStateAction<number>>;
  /** 静音边距秒（默认 0.1，与原硬编码一致） */
  silenceMargin: number;
  setSilenceMargin: Dispatch<SetStateAction<number>>;
  /** 对话检测灵敏度（默认 'medium'，与原硬编码一致） */
  dialogueSensitivity: DialogueSensitivity;
  setDialogueSensitivity: Dispatch<SetStateAction<DialogueSensitivity>>;
  /** playhead 跳转（结果项 hover 联动预览） */
  setPlayheadTime: (time: number) => void;
  /**
   * 转写文本语义理解（subtitle 轨 → understandSpeech 桥接扩展位）：
   * ready 为 Compare 面板数据就绪信号，understanding 含
   * keywords/topics/narrativeMarkers（含 climax）供 M3 语义建议消费。
   */
  speechUnderstanding: UseTranscriptForClipResult;
  /**
   * M3-1 语义建议列表（narrativeMarkers 派生扩展位）：
   * climax 优先排序，每项含时间区间供 M3-2 hover 预览；无转写或
   * 无 marker 时为空数组。
   */
  semanticSuggestions: SemanticRoughCutSuggestion[];
  runSceneDetection(): Promise<void>;
  runSilenceDetection(): Promise<void>;
  runWhisper(): Promise<void>;
  runDialogueRoughCut(): Promise<void>;
  runBrollInsert(): Promise<void>;
  runRhythmAssemble(): Promise<void>;
  applySceneSplit(): void;
  applySilenceRemoval(): void;
  /**
   * M3-3 A1 采纳单条语义建议：换算为源域 segments 后走既有
   * ApplyRoughCutProposalCommand（undo 自动入撤销栈）。失败（如建议
   * 覆盖整个 clip 的命令侧守卫抛错）不变更时间线，返回 error 供
   * 审阅对话框即时反馈。
   */
  applySemanticSuggestion(suggestion: SemanticRoughCutSuggestion): { ok: boolean; error?: string };
}

export function useSmartRoughCut(selectedClip: Clip | undefined, media: MediaAsset[]): UseSmartRoughCutResult {
  const [pendingScene, setPendingScene] = useState<PendingSceneResult>();
  const [pendingSilence, setPendingSilence] = useState<PendingSilenceResult>();
  const [brollTrackId, setBrollTrackId] = useState('');
  const [rhythmTrackId, setRhythmTrackId] = useState('');
  // 检测参数（默认值与原硬编码完全一致，零行为回归）
  const [sceneThreshold, setSceneThreshold] = useState(0.3);
  const [silenceMinDb, setSilenceMinDb] = useState(-40);
  const [silenceMinDuration, setSilenceMinDuration] = useState(0.5);
  const [silenceMargin, setSilenceMargin] = useState(0.1);
  const [dialogueSensitivity, setDialogueSensitivity] = useState<DialogueSensitivity>('medium');
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
  const setPlayheadTime = useEditorStore((item) => item.setPlayheadTime);
  const timeline = project.timeline;
  // 桥接扩展位：subtitle 轨转写文本 → understandSpeech 语义理解
  const speechUnderstanding = useTranscriptForClip(selectedClip, timeline);
  // M3-1 扩展位：narrativeMarkers → 语义粗剪建议列表（纯派生，零副作用）
  const semanticSuggestions = useMemo(
    () => generateSemanticRoughCutSuggestions(speechUnderstanding.understanding, selectedClip),
    [speechUnderstanding.understanding, selectedClip],
  );
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
        threshold: sceneThreshold,
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
        thresholdDb: silenceMinDb,
        minSilenceDuration: silenceMinDuration,
        marginDuration: silenceMargin,
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

  function applySemanticSuggestion(suggestion: SemanticRoughCutSuggestion): { ok: boolean; error?: string } {
    if (!selectedClip) {
      return { ok: false, error: zhCN.smartRoughCut.noSelection };
    }
    try {
      commandManager.execute(
        new ApplyRoughCutProposalCommand(timelineAccessor, selectedClip.id, suggestionToSegments(suggestion, selectedClip)),
      );
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : zhCN.timeline.timelineRejectedMessage };
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
      const intervals = await detectClipDialogue(clip, mediaAsset, dialogueSensitivity);
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
    sceneThreshold,
    setSceneThreshold,
    silenceMinDb,
    setSilenceMinDb,
    silenceMinDuration,
    setSilenceMinDuration,
    silenceMargin,
    setSilenceMargin,
    dialogueSensitivity,
    setDialogueSensitivity,
    setPlayheadTime,
    speechUnderstanding,
    semanticSuggestions,
    runSceneDetection,
    runSilenceDetection,
    runWhisper,
    runDialogueRoughCut,
    runBrollInsert,
    runRhythmAssemble,
    applySceneSplit,
    applySilenceRemoval,
    applySemanticSuggestion,
  };
}

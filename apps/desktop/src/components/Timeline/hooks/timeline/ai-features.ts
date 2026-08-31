import type {
  Clip,
  MediaAsset,
  DialogueSensitivity,
  SilentRange,
  TargetAspectRatio,
  TransitionRecommendation,
  TransitionClipFeatures,
  AnomalyInterval,
  FrameAnalysisSample,
  ClipAIReframe,
  ReframeAIFrame,
} from '@open-factory/editor-core';
import {
  AddTrackCommand,
  BatchAlignSubtitleCommand,
  BatchAddMarkersCommand,
  BatchImportSubtitleCommand,
  BatchSplitAtSceneCutsCommand,
  RemoveSilenceCommand,
  RippleDeleteCommand,
  UpdateClipCommand,
  UpdateProjectBookmarksCommand,
  UpdateProjectCoverCommand,
  buildSceneMarkerInputs,
  computeReframeConfidence,
  computeSampleTimes,
  createId,
  createTrack,
  detectAnomalies,
  filterShortSceneCuts,
  generateReframeKeyframes,
  getSceneDetectionAnalysisLimit,
  recommendTransition,
  round,
  smoothKeyframes,
} from '@open-factory/editor-core';
import {
  canGenerateSubtitlesForClip,
  buildWhisperSubtitleTrackForClip,
  getWhisperAvailability,
} from '../../../../lib/whisper';
import { useWhisperSettingsStore } from '../../../../store/whisperSettingsStore';
import { commandManager, projectAccessor, timelineAccessor } from '../../../../store/commandManager';
import { useEditorStore } from '../../../../store/editorStore';
import { zhCN } from '../../../../i18n/strings';
import { showToast } from '../../../../lib/toast';
import { detectClipDialogue } from '../../../../lib/dialogueDetection';
import { generateTtsVoiceover, collectSubtitleClipsForTts } from '../../../../lib/ttsVoiceover';
import {
  analyzeWaveform,
  cancelSceneDetection,
  detectSceneChanges,
  extractCoverFrames,
  listenBridge,
  listenCoverFrameProgress,
  type CoverFrameResult,
  type SceneDetectProgressEvent,
  type WhisperProgressEvent,
} from '../../../../lib/tauri-bridge';
import { createSubtitleClipsFromDialogues, compareDialogueWithWhisper } from '@open-factory/editor-core';
import { AddTransitionCommand } from '@open-factory/editor-core';
import type { TimelineHandlerParams } from './types';
import {
  buildSubtitleAlignmentPeaks,
  isSubtitleAlignmentMediaClip,
  timelineRangesOverlap,
  getCoverFrameOutputDir,
  SUBTITLE_ALIGNMENT_SAMPLES_PER_SECOND,
  SUBTITLE_ALIGNMENT_MAX_DISTANCE,
} from './utils';
import { runUiFeedbackTask } from '../../../../media/background-media-task-queue';

export function createAiFeatureHandlers(
  params: TimelineHandlerParams,
  helpers: {
    findClip: (clipId: string) => Clip;
    getClipMediaAsset: (clip: Clip) => MediaAsset | undefined;
  },
) {
  const {
    project,
    allClips,
    selectedClipIds,
    selectedClipId,
    setSelectedClipId,
    setSelectedClipIds,
    clearSelectedClipIds,
    setClipMenu,
    setSilenceDialog,
    setSceneDialog,
    setCoverFrameDialog,
    setWhisperDialog,
    setSubtitleAlignReport,
    setReframeDialog,
    setTransitionDialog,
    dialoguePanelOpen,
    setDialoguePanelOpen,
    dialogueMarkers,
    setDialogueMarkers,
    dialogueMisses,
    setDialogueMisses,
    whisperAvailability,
    projectPath,
  } = params;

  const { findClip, getClipMediaAsset } = helpers;

  function openSilenceDetection(clipId: string): void {
    const clip = findClip(clipId);
    const asset = getClipMediaAsset(clip);
    setClipMenu(undefined);
    setSelectedClipId(clip.id);
    if (!asset || (clip.type === 'video' && !asset.hasAudio) || (clip.type !== 'video' && clip.type !== 'audio')) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.silenceUnavailableTitle,
        message: zhCN.timeline.silenceUnavailableMessage,
      });
      return;
    }
    setSilenceDialog({ clip, asset });
  }

  function getDialogueDetectionTarget(): { clip: Clip; asset: MediaAsset } | undefined {
    const selected = new Set(selectedClipIds.length > 0 ? selectedClipIds : selectedClipId ? [selectedClipId] : []);
    const candidates = [...allClips.filter((clip) => selected.has(clip.id)), ...allClips];
    for (const clip of candidates) {
      const asset = getClipMediaAsset(clip);
      if (!asset || (clip.type !== 'audio' && clip.type !== 'video') || (clip.type === 'video' && !asset.hasAudio)) {
        continue;
      }
      return { clip, asset };
    }
    return undefined;
  }

  async function runDialogueDetection(sensitivity: DialogueSensitivity): Promise<void> {
    const target = getDialogueDetectionTarget();
    if (!target) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.dialogueDetectionUnavailableTitle,
        message: zhCN.timeline.dialogueDetectionUnavailableMessage,
      });
      setDialogueMarkers([]);
      setDialogueMisses([]);
      return;
    }
    setSelectedClipId(target.clip.id);
    try {
      const relativeDialogues = await detectClipDialogue(target.clip, target.asset, sensitivity);
      const absoluteDialogues = relativeDialogues.map((dialogue, index) => ({
        ...dialogue,
        id: `dialogue-${target.clip.id}-${index + 1}`,
        start: round(target.clip.start + dialogue.start),
        end: round(target.clip.start + dialogue.end),
        duration: round(dialogue.end - dialogue.start),
      }));
      const whisperSegments = project.timeline.tracks
        .filter((track) => track.type === 'subtitle')
        .flatMap((track) =>
          track.clips
            .filter(
              (clip): clip is Extract<Clip, { type: 'subtitle' }> =>
                clip.type === 'subtitle' && clip.text.trim().length > 0,
            )
            .map((clip) => ({ start: clip.start, end: round(clip.start + clip.duration), text: clip.text })),
        );
      setDialogueMarkers(absoluteDialogues);
      setDialogueMisses(compareDialogueWithWhisper(absoluteDialogues, whisperSegments));
      if (absoluteDialogues.length === 0) {
        showToast({
          kind: 'warning',
          title: zhCN.timeline.dialogueDetectionTitle,
          message: zhCN.timeline.dialogueDetectionNoResults,
        });
      }
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.dialogueDetectionFailedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.dialogueDetectionFailedMessage,
      });
    }
  }

  function generateDialogueSubtitles(): void {
    if (dialogueMarkers.length === 0) {
      return;
    }
    const existingTrack = project.timeline.tracks.find((track) => track.type === 'subtitle');
    const targetTrack =
      existingTrack ??
      createTrack({
        id: createId('track'),
        type: 'subtitle',
        name: zhCN.timeline.dialogueSubtitleTrackName,
        clips: [],
      });
    const clips = createSubtitleClipsFromDialogues(dialogueMarkers, {
      trackId: targetTrack.id,
      baseId: createId('dialogue-subtitle'),
      namePrefix: zhCN.timeline.dialogueSubtitleNamePrefix,
    });
    try {
      commandManager.execute(
        new BatchImportSubtitleCommand(
          timelineAccessor,
          { ...targetTrack, clips },
          { mode: existingTrack ? 'append' : 'new-track', targetTrackId: existingTrack?.id },
        ),
      );
      setSelectedClipIds(clips.map((clip) => clip.id));
      showToast({
        kind: 'success',
        title: zhCN.timeline.dialogueSubtitlesCreatedTitle,
        message: zhCN.editorToasts.subtitlesGenerated(clips.length),
      });
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.editRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.editRejectedMessage,
      });
    }
  }

  function applySilenceRemoval(clipId: string, ranges: SilentRange[]): void {
    try {
      commandManager.execute(new RemoveSilenceCommand(timelineAccessor, clipId, ranges));
      setSilenceDialog(undefined);
      clearSelectedClipIds();
      showToast({
        kind: 'success',
        title: zhCN.timeline.silenceRemovedTitle,
        message: zhCN.timeline.silenceRemovedMessage(ranges.length),
      });
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.silenceRemoveFailedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.timelineRejectedMessage,
      });
    }
  }

  function openSceneDetection(clipId: string): void {
    const clip = findClip(clipId);
    const asset = getClipMediaAsset(clip);
    setClipMenu(undefined);
    setSelectedClipId(clip.id);
    if (clip.type !== 'video' || !asset) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.sceneUnavailableTitle,
        message: zhCN.timeline.sceneUnavailableMessage,
      });
      return;
    }
    setSceneDialog({
      clip,
      asset,
      status: 'ready',
      threshold: 10,
      progress: 0,
      scenecuts: clip.scenecuts ?? [],
      filterShortScenes: true,
      minSceneSeconds: 1,
      splitAtCuts: true,
      addMarkers: false,
      syncChapters: false,
    });
  }

  async function startSceneDetection(): Promise<void> {
    const current = params.sceneDialog;
    if (!current || current.status === 'running') {
      return;
    }
    const clip = findClip(current.clip.id);
    const asset = getClipMediaAsset(clip);
    if (clip.type !== 'video' || !asset) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.sceneUnavailableTitle,
        message: zhCN.timeline.sceneUnavailableMessage,
      });
      return;
    }
    const speed = getClipSpeed(clip);
    const sourceStart = clip.trimStart;
    const sourceEnd = sourceStart + clip.duration * speed;
    const limit = getSceneDetectionAnalysisLimit(asset.duration || clip.duration);
    const taskId = `scene-${clip.id}-${Date.now()}`;
    setSceneDialog((dialog) =>
      dialog?.clip.id === clip.id
        ? {
            ...dialog,
            clip,
            asset,
            status: 'running',
            progress: 0,
            analyzedFrames: 0,
            totalFrames: undefined,
            taskId,
            limited: limit.limited,
            analyzedDuration: limit.analysisDuration,
          }
        : dialog,
    );
    let unlisten: (() => void) | undefined;
    try {
      unlisten = await listenBridge<SceneDetectProgressEvent>('scene-detect-progress', (payload) => {
        setSceneDialog((dialog) =>
          dialog?.clip.id === clip.id && dialog.taskId === taskId
            ? {
                ...dialog,
                progress: payload.progress,
                analyzedFrames: payload.analyzedFrames ?? dialog.analyzedFrames,
                totalFrames: payload.totalFrames ?? dialog.totalFrames,
              }
            : dialog,
        );
      });
      const result = await detectSceneChanges({
        path: asset.path,
        threshold: current.threshold,
        duration: limit.analysisDuration,
        taskId,
        frameRate: project.settings.fps,
      });
      const scenecuts = result.sceneTimes
        .filter((time) => time > sourceStart + 0.000001 && time < sourceEnd - 0.000001)
        .map((time) => round((time - sourceStart) / speed));
      commandManager.execute(new UpdateClipCommand(timelineAccessor, clip.id, { scenecuts }));
      setSceneDialog((dialog) =>
        dialog?.clip.id === clip.id
          ? {
              ...dialog,
              clip: { ...clip, scenecuts },
              status: 'complete',
              progress: 1,
              scenecuts,
              taskId: undefined,
              limited: result.limited ?? limit.limited,
              analyzedDuration: result.analyzedDuration ?? limit.analysisDuration,
            }
          : dialog,
      );
      if (scenecuts.length === 0) {
        showToast({ kind: 'info', title: zhCN.timeline.noSceneCutsTitle });
      }
    } catch (error) {
      if (error instanceof Error && /canceled/i.test(error.message)) {
        setSceneDialog((dialog) =>
          dialog?.clip.id === clip.id ? { ...dialog, status: 'ready', progress: 0, taskId: undefined } : dialog,
        );
        return;
      }
      setSceneDialog((dialog) =>
        dialog?.clip.id === clip.id ? { ...dialog, status: 'ready', progress: 0, taskId: undefined } : dialog,
      );
      showToast({
        kind: 'error',
        title: zhCN.timeline.sceneDetectFailedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.sceneDetectFailedMessage,
      });
    } finally {
      unlisten?.();
    }
  }

  async function cancelCurrentSceneDetection(): Promise<void> {
    const taskId = params.sceneDialog?.taskId;
    if (!taskId) {
      setSceneDialog(undefined);
      return;
    }
    try {
      await cancelSceneDetection(taskId);
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.sceneCancelFailedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.sceneDetectFailedMessage,
      });
    } finally {
      setSceneDialog((dialog) =>
        dialog?.taskId === taskId ? { ...dialog, status: 'ready', progress: 0, taskId: undefined } : dialog,
      );
    }
  }

  function applySceneDetectionResult(): void {
    const current = params.sceneDialog;
    if (!current || current.status === 'running') {
      return;
    }
    const filteredCuts = current.filterShortScenes
      ? filterShortSceneCuts(current.scenecuts, current.clip.duration, current.minSceneSeconds)
      : filterShortSceneCuts(current.scenecuts, current.clip.duration, 0);
    if (filteredCuts.length === 0) {
      showToast({ kind: 'info', title: zhCN.timeline.noSceneCutsTitle });
      return;
    }
    try {
      if (current.addMarkers) {
        const markers = buildSceneMarkerInputs(filteredCuts, current.clip.start, {
          idPrefix: `scene-${current.clip.id}`,
        });
        commandManager.execute(new BatchAddMarkersCommand(timelineAccessor, markers));
      }
      if (current.syncChapters) {
        const chapters = buildSceneMarkerInputs(filteredCuts, current.clip.start, {
          idPrefix: `scene-chapter-${current.clip.id}`,
        }).map((marker) => ({
          id: marker.id ?? createId('bookmark'),
          time: marker.time,
          note: marker.label,
        }));
        commandManager.execute(
          new UpdateProjectBookmarksCommand(projectAccessor, [...(project.bookmarks ?? []), ...chapters]),
        );
      }
      if (current.splitAtCuts) {
        commandManager.execute(
          new BatchSplitAtSceneCutsCommand(timelineAccessor, [
            { clipId: current.clip.id, cuts: filteredCuts, minSceneSeconds: 0 },
          ]),
        );
      }
      showToast({
        kind: 'success',
        title: zhCN.timeline.sceneSplitTitle,
        message: zhCN.timeline.sceneApplyMessage(filteredCuts.length),
      });
      setSceneDialog(undefined);
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.sceneSplitFailedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.timelineRejectedMessage,
      });
    }
  }

  async function openCoverFrameGeneration(clipId: string): Promise<void> {
    const clip = findClip(clipId);
    const asset = getClipMediaAsset(clip);
    setClipMenu(undefined);
    setSelectedClipId(clip.id);
    if (clip.type !== 'video' || !asset) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.coverFrameUnavailableTitle,
        message: zhCN.timeline.coverFrameUnavailableMessage,
      });
      return;
    }
    setCoverFrameDialog({ clip, frames: [], progress: 0, loading: true });
    let unlisten: (() => void) | undefined;
    try {
      unlisten = await listenCoverFrameProgress((payload) => {
        setCoverFrameDialog((current) =>
          current?.clip.id === clip.id ? { ...current, progress: payload.progress } : current,
        );
      });
      const outputDir = await getCoverFrameOutputDir(projectPath);
      const timestamps = buildEvenCoverFrameTimestamps(asset.duration || clip.duration, 6);
      // 单发交互路径(带进度弹窗)走 UI 池,不被后台批量任务挤占。
      const result = await runUiFeedbackTask(() =>
        extractCoverFrames({
          clipId: clip.id,
          sourcePath: asset.path,
          outputDir,
          outputStem: sanitizeCoverFileStem(`${project.name}-${clip.name}-${clip.id}`),
          mode: 'interval',
          count: 6,
          timestamps,
        }),
      );
      if (result.frames.length === 0) {
        setCoverFrameDialog({ clip, frames: [], progress: 1, loading: false, error: zhCN.timeline.coverFrameEmpty });
        return;
      }
      setCoverFrameDialog({ clip, frames: result.frames, progress: 1, loading: false });
    } catch (error) {
      setCoverFrameDialog({
        clip,
        frames: [],
        progress: 1,
        loading: false,
        error: error instanceof Error ? error.message : zhCN.timeline.coverFrameFailedMessage,
      });
    } finally {
      unlisten?.();
    }
  }

  function applyProjectCoverFrame(frame: CoverFrameResult): void {
    commandManager.execute(new UpdateProjectCoverCommand(projectAccessor, frame.path));
    setCoverFrameDialog((current) => (current ? { ...current, selectedPath: frame.path } : current));
    showToast({
      kind: 'success',
      title: zhCN.timeline.coverFrameSelectedTitle,
      message: zhCN.timeline.coverFrameSelectedMessage,
    });
  }

  async function generateSubtitles(clipId: string): Promise<void> {
    const clip = findClip(clipId);
    const asset = getClipMediaAsset(clip);
    setClipMenu(undefined);
    setSelectedClipId(clip.id);
    if (
      !asset ||
      (clip.type !== 'audio' && clip.type !== 'video') ||
      !canGenerateSubtitlesForClip(clip, asset, whisperAvailability.ready)
    ) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.whisperUnavailableTitle,
        message: whisperAvailability.error ?? zhCN.whisper.notConfigured,
      });
      return;
    }

    const settings = useWhisperSettingsStore.getState();
    const currentAvailability = await getWhisperAvailability(settings);
    if (!currentAvailability.ready) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.whisperUnavailableTitle,
        message: currentAvailability.error ?? zhCN.whisper.notConfigured,
      });
      return;
    }

    setWhisperDialog({ clip, progress: 0 });
    let unlisten: (() => void) | undefined;
    try {
      unlisten = await listenBridge<WhisperProgressEvent>('whisper-progress', (payload) => {
        setWhisperDialog((current) =>
          current?.clip.id === payload.clipId ? { ...current, progress: payload.progress } : current,
        );
      });
      const track = await buildWhisperSubtitleTrackForClip(
        clip,
        asset,
        useEditorStore.getState().project.timeline,
        settings,
      );
      if (track.clips.length === 0) {
        showToast({ kind: 'warning', title: zhCN.timeline.whisperFailedTitle, message: zhCN.whisper.noSubtitleCues });
        return;
      }
      commandManager.execute(new AddTrackCommand(timelineAccessor, track));
      setSelectedClipId(track.clips[0]?.id);
      showToast({
        kind: 'success',
        title: zhCN.timeline.whisperCompleteTitle,
        message: zhCN.editorToasts.subtitlesGenerated(track.clips.length),
      });
    } catch (error) {
      showToast({
        kind: 'error',
        title: zhCN.timeline.whisperFailedTitle,
        message: error instanceof Error ? error.message : zhCN.whisper.noSubtitleCues,
      });
    } finally {
      unlisten?.();
      setWhisperDialog(undefined);
    }
  }

  function findSubtitleAlignmentSource(
    subtitleClips: Extract<Clip, { type: 'subtitle' }>[],
  ): { clip: Extract<Clip, { type: 'audio' | 'video' }>; asset: MediaAsset } | undefined {
    const rangeStart = Math.max(
      0,
      Math.min(...subtitleClips.map((clip) => clip.start)) - SUBTITLE_ALIGNMENT_MAX_DISTANCE,
    );
    const rangeEnd =
      Math.max(...subtitleClips.map((clip) => clip.start + clip.duration)) + SUBTITLE_ALIGNMENT_MAX_DISTANCE;
    for (const clip of allClips) {
      if (
        !isSubtitleAlignmentMediaClip(clip) ||
        !timelineRangesOverlap(rangeStart, rangeEnd, clip.start, clip.start + clip.duration)
      ) {
        continue;
      }
      const asset = getClipMediaAsset(clip);
      if (asset && !asset.missing && (clip.type === 'audio' || asset.hasAudio)) {
        return { clip, asset };
      }
    }
    return undefined;
  }

  async function alignSubtitlesToWaveform(clipId: string): Promise<void> {
    const clip = findClip(clipId);
    setClipMenu(undefined);
    if (clip.type !== 'subtitle') {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.subtitleAlignmentFailedTitle,
        message: zhCN.timeline.subtitleAlignmentRequiresSubtitle,
      });
      return;
    }
    const track = project.timeline.tracks.find((item) => item.id === clip.trackId && item.type === 'subtitle');
    const subtitleClips = (
      track?.clips.filter((item): item is Extract<Clip, { type: 'subtitle' }> => item.type === 'subtitle') ?? []
    ).sort((left, right) => left.start - right.start || left.id.localeCompare(right.id));
    if (subtitleClips.length === 0) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.subtitleAlignmentFailedTitle,
        message: zhCN.timeline.subtitleAlignmentNoSubtitles,
      });
      return;
    }
    const source = findSubtitleAlignmentSource(subtitleClips);
    if (!source) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.subtitleAlignmentFailedTitle,
        message: zhCN.timeline.subtitleAlignmentNoAudioSource,
      });
      return;
    }

    try {
      const samples = await analyzeWaveform(source.asset.path, SUBTITLE_ALIGNMENT_SAMPLES_PER_SECOND);
      const peaks = buildSubtitleAlignmentPeaks(samples, SUBTITLE_ALIGNMENT_SAMPLES_PER_SECOND, source.clip);
      const projectDuration = Math.max(
        getTimelineDuration(project.timeline),
        ...subtitleClips.map((item) => item.start + item.duration),
        1 / Math.max(1, project.settings.fps),
      );
      const command = new BatchAlignSubtitleCommand(
        timelineAccessor,
        subtitleClips.map((item) => item.id),
        peaks,
        projectDuration,
        { maxDistance: SUBTITLE_ALIGNMENT_MAX_DISTANCE, minDuration: 1 / Math.max(1, project.settings.fps) },
      );
      commandManager.execute(command);
      setSelectedClipIds(command.report.updates.map((update: { clipId: string }) => update.clipId));
      setSubtitleAlignReport({
        correctedCount: command.report.correctedCount,
        averageOffsetMs: command.report.averageOffsetMs,
      });
      showToast({
        kind: 'success',
        title: zhCN.timeline.subtitleAlignmentTitle,
        message: zhCN.timeline.subtitleAlignmentReport(command.report.correctedCount, command.report.averageOffsetMs),
      });
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.subtitleAlignmentFailedTitle,
        message:
          error instanceof Error && error.message !== 'No subtitle alignment updates'
            ? error.message
            : zhCN.timeline.subtitleAlignmentNoPeaks,
      });
    }
  }

  async function ttsVoiceover(clipId: string): Promise<void> {
    const clip = findClip(clipId);
    setClipMenu(undefined);
    if (clip.type !== 'subtitle') return;
    const inputClips = collectSubtitleClipsForTts(project, clip.trackId);
    if (inputClips.length === 0) return;
    await generateTtsVoiceover(inputClips);
  }

  function handleAiReframe(clipId: string): void {
    const clip = findClip(clipId);
    setClipMenu(undefined);
    setSelectedClipId(clip.id);
    if (clip.type !== 'video') {
      showToast({ kind: 'warning', title: zhCN.aiReframe.title, message: zhCN.aiReframe.videoOnlyMessage });
      return;
    }
    setReframeDialog({ clipId });
  }

  function applyAiReframe(clipId: string, aspect: TargetAspectRatio): void {
    const clip = findClip(clipId);
    const asset = getClipMediaAsset(clip);
    if (!asset) return;
    const sourceWidth = asset.width || 1920;
    const sourceHeight = asset.height || 1080;
    const sampleTimes = computeSampleTimes(clip.duration, undefined, clip.scenecuts);
    const mockFrames: ReframeAIFrame[] = sampleTimes.map((time) => ({
      time,
      faceBox: null,
      subjectBox: {
        x: Math.round(sourceWidth * 0.25),
        y: Math.round(sourceHeight * 0.25),
        w: Math.round(sourceWidth * 0.5),
        h: Math.round(sourceHeight * 0.5),
      },
    }));
    const keyframes = generateReframeKeyframes(mockFrames, sourceWidth, sourceHeight, aspect);
    const smoothed = smoothKeyframes(keyframes);
    const confidence = computeReframeConfidence(mockFrames);
    const aiReframe: ClipAIReframe = { targetAspect: aspect, keyframes: smoothed, confidence, generatedAt: Date.now() };
    commandManager.execute(new UpdateClipCommand(timelineAccessor, clipId, { aiReframe }));
    setReframeDialog(undefined);
  }

  function handleAiTransitionRecommend(clipId: string): void {
    const clip = findClip(clipId);
    setClipMenu(undefined);
    setSelectedClipId(clip.id);
    if (clip.type !== 'video') return;
    const track = project.timeline.tracks.find((t) => t.clips.some((c) => c.id === clipId));
    if (!track) return;
    const sortedClips = [...track.clips].sort((a, b) => a.start - b.start);
    const idx = sortedClips.findIndex((c) => c.id === clipId);
    const adjacent = idx >= 0 && idx < sortedClips.length - 1 ? sortedClips[idx + 1] : undefined;
    if (!adjacent || adjacent.type !== 'video') return;
    const featuresA: TransitionClipFeatures = {
      colorHist: new Array(16).fill(0).map((_, i) => (i < 8 ? 0.12 : 0.02)),
      motionScore: 15,
      sceneTag: '室内',
    };
    const featuresB: TransitionClipFeatures = {
      colorHist: new Array(16).fill(0).map((_, i) => (i < 8 ? 0.02 : 0.12)),
      motionScore: 15,
      sceneTag: '户外',
    };
    const result = recommendTransition(featuresA, featuresB);
    setTransitionDialog({ clipId, adjacentClipId: adjacent.id, recommendations: result.recommended });
  }

  function applyAiTransition(clipId: string, adjacentClipId: string, transition: TransitionRecommendation): void {
    const track = project.timeline.tracks.find((t) => t.clips.some((c) => c.id === clipId));
    if (!track) return;
    const sortedClips = [...track.clips].sort((a, b) => a.start - b.start);
    const idx = sortedClips.findIndex((c) => c.id === clipId);
    if (idx < 0 || idx >= sortedClips.length - 1) return;
    const clipA = sortedClips[idx];
    const clipB = sortedClips[idx + 1];
    if (clipB.id !== adjacentClipId) return;
    const newTransition = {
      type: transition.transitionType,
      duration: Math.min(transition.duration, clipA.duration / 2, clipB.duration / 2),
      fromClipId: clipA.id,
      toClipId: clipB.id,
    };
    commandManager.execute(new AddTransitionCommand(timelineAccessor, newTransition));
    setTransitionDialog(undefined);
  }

  function handleAnomalyDetect(clipId: string): void {
    const clip = findClip(clipId);
    setClipMenu(undefined);
    setSelectedClipId(clip.id);
    if (clip.type !== 'video') return;
    const samples: FrameAnalysisSample[] = [];
    for (let t = 0; t < clip.duration; t += 1) {
      const isBlack = t >= 2 && t <= 4;
      const isStatic = t >= 8 && t <= 14;
      samples.push({ time: round(t), lumaMean: isBlack ? 3 : 100, grayscaleDiff: isStatic ? 0.5 : 15 });
    }
    samples.push({ time: round(clip.duration), lumaMean: 100, grayscaleDiff: 15 });
    const anomalies = detectAnomalies(samples);
    commandManager.execute(new UpdateClipCommand(timelineAccessor, clipId, { anomalies }));
    if (anomalies.length > 0) {
      showToast({
        kind: 'info',
        title: zhCN.anomalyDetection.title,
        message: zhCN.anomalyDetection.complete(anomalies.length),
      });
    } else {
      showToast({ kind: 'success', title: zhCN.anomalyDetection.title, message: zhCN.anomalyDetection.noAnomalies });
    }
  }

  function removeAnomaly(clipId: string, anomaly: AnomalyInterval): void {
    const clip = findClip(clipId);
    const remaining = (clip.anomalies ?? []).filter(
      (a) => !(a.startTime === anomaly.startTime && a.endTime === anomaly.endTime && a.type === anomaly.type),
    );
    if (remaining.length === (clip.anomalies ?? []).length) return;
    if (anomaly.type === 'black') {
      const splitStart = Math.max(0, anomaly.startTime - clip.start);
      const splitEnd = Math.min(clip.duration, anomaly.endTime - clip.start);
      if (splitEnd > splitStart) {
        commandManager.execute(new RippleDeleteCommand(timelineAccessor, [clipId]));
      }
      return;
    }
    commandManager.execute(new UpdateClipCommand(timelineAccessor, clipId, { anomalies: remaining }));
  }

  return {
    openSilenceDetection,
    getDialogueDetectionTarget,
    runDialogueDetection,
    generateDialogueSubtitles,
    applySilenceRemoval,
    openSceneDetection,
    startSceneDetection,
    cancelCurrentSceneDetection,
    applySceneDetectionResult,
    openCoverFrameGeneration,
    applyProjectCoverFrame,
    generateSubtitles,
    findSubtitleAlignmentSource,
    alignSubtitlesToWaveform,
    ttsVoiceover,
    handleAiReframe,
    applyAiReframe,
    handleAiTransitionRecommend,
    applyAiTransition,
    handleAnomalyDetect,
    removeAnomaly,
  };
}

function getClipSpeed(clip: Clip): number {
  return clip.speed ?? 1;
}

function getTimelineDuration(timeline: { tracks: { clips: { start: number; duration: number }[] }[] }): number {
  let max = 0;
  for (const track of timeline.tracks) {
    for (const clip of track.clips) {
      max = Math.max(max, clip.start + clip.duration);
    }
  }
  return max;
}

function buildEvenCoverFrameTimestamps(duration: number, count: number): number[] {
  const timestamps: number[] = [];
  for (let i = 0; i < count; i++) {
    timestamps.push((duration * i) / count);
  }
  return timestamps;
}

function sanitizeCoverFileStem(stem: string): string {
  return stem.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 100);
}

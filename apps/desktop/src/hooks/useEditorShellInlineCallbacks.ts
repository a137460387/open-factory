import { useCallback, useMemo } from 'react';
import { useEditorStore } from '../store/editorStore';
import {
  AddClipCommand,
  AddTrackCommand,
  AddTransitionCommand,
  BatchImportSubtitleCommand,
  SmartMontageCommand,
  UpdateProjectSpeakersCommand,
  buildVideoStitchSequence,
  createTrack,
  createId,
  detectSubtitleDataOverlaps,
  mergeOverlappingSubtitleDataCues,
  mergeProjectSpeakers,
  type BeatSensitivity,
  type MediaAsset,
  type Project,
  type SubtitleDataImportMode,
} from '@open-factory/editor-core';
import { commandManager, projectAccessor, timelineAccessor } from '../store/commandManager';
import { useEditorUIStore } from '../store/editorUIStore';
import { pickMediaPaths, probeMediaPaths } from '../lib/media';
import { indexAndTagImportedMedia } from '../media/media-index-integration';
import {
  buildSubtitleTrackFromDataCues,
  buildSubtitleTrackFromSrt,
  collectSubtitleSpeakersFromTrack,
  isSubtitlePath,
  parseSubtitleDataFile,
  pickSubtitleDataPaths,
  pickSubtitlePaths,
  readSubtitleText,
} from '../lib/subtitles';
import { showToast } from '../lib/toast';
import { zhCN } from '../i18n/strings';
import { bridgeConfirm } from '../lib/tauri-bridge';
import { readProjectFile, discardAutosaveRecovery, isEncryptedProjectPath } from '../lib/projectFiles';
import type { AutosaveRecoveryCandidate } from '../lib/projectFiles';
import { getSubtitleDataImportTargetTrackId } from '../lib/timeline-clip-helpers';
import type { ExportPreset } from '../export/export-presets';
import type { VideoStitchWizardSettings } from '../video-stitching/VideoStitchWizardDialog';
import type { AutosaveRecoveryCandidate } from '../lib/projectFiles';
import type { TutorialSignals } from '../tutorial/tutorialState';

interface InlineCallbacksDeps {
  addMedia: (media: MediaAsset[]) => void;
  setSelectedClipId: (id: string | undefined) => void;
  setSelectedClipIds: (ids: string[]) => void;
  setPlayheadTime: (time: number) => void;
  setVideoStitchWizardOpen: (v: boolean) => void;
  setExportDialogOpen: (v: boolean) => void;
  setTemplateExportPreset: (p: ExportPreset) => void;
  persistMediaFingerprints: (media: MediaAsset[]) => Promise<void>;
  queueFrameRateConversionForImportedMedia: (media: MediaAsset[]) => Promise<void>;
  runAutomationForMedia: (trigger: 'on-import' | 'on-export-complete' | 'on-project-open', media: MediaAsset[]) => Promise<void>;
  setTutorialSignals: React.Dispatch<React.SetStateAction<TutorialSignals>>;
  projectPath: string | null | undefined;
  project: Project;
  selectedClipIds: string[];
  requestProjectPassword: (title: string, description: string) => Promise<string | undefined>;
  setProject: (project: Project, path?: string | undefined) => void;
  setDirty: (dirty: boolean) => void;
  setRecoveryCandidate: (c: AutosaveRecoveryCandidate | undefined) => void;
  applyImportedMediaColorConversionChoice: (media: MediaAsset[]) => Promise<MediaAsset[]>;
  // Shortcut handler deps
  togglePlayback: () => void;
  reversePlayback: () => void;
  pausePlayback: () => void;
  forwardPlayback: () => void;
  stepFrame: (delta: -1 | 1) => void;
  markInPoint: () => void;
  markOutPoint: () => void;
  markMultiRangeInPoint: () => void;
  markMultiRangeOutPoint: () => void;
  deleteSelected: () => void;
  rippleDeleteSelected: () => void;
  splitSelected: () => void;
  selectAllTimelineItems: () => void;
  clearSelectedClipIds: () => void;
  addAnnotationAtPlayhead: () => void;
  addBookmarkAtPlayhead: () => void;
  toggleTimelineGridSnap: () => void;
  jumpTimelineNavigationPoint: (dir: 'previous' | 'next') => void;
  undo: () => void;
  switchToPreviousHistoryBranch: () => void;
  redo: () => void;
  saveProject: () => void | Promise<void>;
  exportCurrentFrame: () => void | Promise<void>;
  matchFrameToSource: () => void | Promise<void>;
  revealMediaInTimeline: () => void | Promise<void>;
  navigateToNextInstance: () => void | Promise<void>;
  navigatePrevGap: () => void;
  navigateNextGap: () => void;
  renderInOutRegion: () => Promise<void>;
}

/**
 * Inline callbacks extracted from EditorShell:
 * - Import/generate callbacks (video stitch, smart montage, subtitles)
 * - Recovery helpers (restore, discard)
 * - Drop import handler
 * - Shortcut handlers object
 */
export function useEditorShellInlineCallbacks(deps: InlineCallbacksDeps) {
  const {
    addMedia,
    setSelectedClipId,
    setSelectedClipIds,
    setPlayheadTime,
    setVideoStitchWizardOpen,
    setExportDialogOpen,
    setTemplateExportPreset,
    persistMediaFingerprints,
    queueFrameRateConversionForImportedMedia,
    runAutomationForMedia,
    setTutorialSignals,
    projectPath,
    project,
    selectedClipIds,
    requestProjectPassword,
    setProject,
    setDirty,
    setRecoveryCandidate,
    applyImportedMediaColorConversionChoice,
    togglePlayback,
    reversePlayback,
    pausePlayback,
    forwardPlayback,
    stepFrame,
    markInPoint,
    markOutPoint,
    markMultiRangeInPoint,
    markMultiRangeOutPoint,
    deleteSelected,
    rippleDeleteSelected,
    splitSelected,
    selectAllTimelineItems,
    clearSelectedClipIds,
    addAnnotationAtPlayhead,
    addBookmarkAtPlayhead,
    toggleTimelineGridSnap,
    jumpTimelineNavigationPoint,
    undo,
    switchToPreviousHistoryBranch,
    redo,
    saveProject,
    exportCurrentFrame,
    matchFrameToSource,
    revealMediaInTimeline,
    navigateToNextInstance,
    navigatePrevGap,
    navigateNextGap,
    renderInOutRegion,
  } = deps;

  const importVideosForStitchWizard = useCallback(async (): Promise<string[]> => {
    try {
      const paths = await pickMediaPaths();
      if (paths.length === 0) return [];
      const result = await probeMediaPaths(paths, useEditorStore.getState().project.media);
      if (result.media.length > 0) {
        addMedia(result.media);
        void indexAndTagImportedMedia(result.media, projectPath || '');
        await persistMediaFingerprints(result.media);
        await queueFrameRateConversionForImportedMedia(result.media);
        void runAutomationForMedia('on-import', result.media);
        setTutorialSignals((current: TutorialSignals) => ({ ...current, mediaImported: true }));
        showToast({ kind: 'success', title: zhCN.editorToasts.mediaImported, message: zhCN.editorToasts.mediaImportedMessage(result.media.length) });
      }
      if (result.duplicateCount > 0) {
        showToast({ kind: 'info', title: zhCN.editorToasts.duplicateTitle, message: zhCN.editorToasts.duplicateMessage(result.duplicateCount) });
      }
      return result.media.filter((asset) => asset.type === 'video').map((asset) => asset.id);
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.videoStitchWizard.importFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.importFailedMessage });
      return [];
    }
  }, [addMedia, persistMediaFingerprints, queueFrameRateConversionForImportedMedia, runAutomationForMedia]);

  const generateVideoStitchTimeline = useCallback(
    (settings: VideoStitchWizardSettings) => {
      try {
        const currentProject = useEditorStore.getState().project;
        const assets = settings.assetIds.flatMap((assetId) => {
          const asset = currentProject.media.find((item: MediaAsset) => item.id === assetId && item.type === 'video');
          return asset ? [asset] : [];
        });
        if (assets.length < 2) throw new Error(zhCN.videoStitchWizard.empty);
        const track = createTrack({ id: createId('track'), type: 'video', name: zhCN.videoStitchWizard.trackName, clips: [] });
        const sequence = buildVideoStitchSequence(assets.map((asset) => ({ mediaId: asset.id, name: asset.name, duration: asset.duration || 5 })), { trackId: track.id, transitionEnabled: settings.transitionEnabled, transitionDuration: settings.transitionDuration });
        commandManager.execute(new AddTrackCommand(timelineAccessor, track));
        for (const clip of sequence.clips) commandManager.execute(new AddClipCommand(timelineAccessor, clip));
        for (const transition of sequence.transitions) commandManager.execute(new AddTransitionCommand(timelineAccessor, transition));
        setSelectedClipIds(sequence.clips.map((clip) => clip.id));
        setPlayheadTime(0);
        setTemplateExportPreset({ id: 'video-stitch-wizard', name: zhCN.videoStitchWizard.exportPresetName, description: zhCN.videoStitchWizard.exportPresetDescription, builtin: true, settings: { width: settings.width, height: settings.height, fps: settings.fps, videoCodec: 'libx264', audioCodec: 'aac', format: 'mp4', outputMode: 'video', scaleMode: 'fit', targetAspectRatio: 'source', reframeOffsetX: 0, reframeOffsetY: 0, hardwareEncoding: false } });
        setVideoStitchWizardOpen(false);
        setExportDialogOpen(true);
        showToast({ kind: 'success', title: zhCN.videoStitchWizard.createdTitle, message: zhCN.videoStitchWizard.createdMessage(sequence.clips.length) });
      } catch (error) {
        showToast({ kind: 'error', title: zhCN.videoStitchWizard.generateFailed, message: error instanceof Error ? error.message : zhCN.timeline.timelineRejectedMessage });
      }
    },
    [setPlayheadTime, setSelectedClipIds],
  );

  const generateSmartMontage = useCallback(
    (config: { videoAssetIds: string[]; audioAssetId: string; beatTimes: number[]; sensitivity: BeatSensitivity }) => {
      try {
        const currentProject = useEditorStore.getState().project;
        const videoAssets = config.videoAssetIds.flatMap((id) => {
          const asset = currentProject.media.find((m: MediaAsset) => m.id === id && (m.type === 'video' || m.type === 'image'));
          return asset ? [asset] : [];
        });
        const audioAsset = currentProject.media.find((m: MediaAsset) => m.id === config.audioAssetId && m.type === 'audio');
        if (videoAssets.length === 0 || !audioAsset) throw new Error('素材不足：需要至少 1 个视频素材和 1 个音频素材');
        const videoTrack = createTrack({ id: createId('track'), type: 'video', name: '混剪视频', clips: [] });
        const audioTrack = createTrack({ id: createId('track'), type: 'audio', name: '混剪音乐', clips: [] });
        commandManager.execute(new AddTrackCommand(timelineAccessor, videoTrack));
        commandManager.execute(new AddTrackCommand(timelineAccessor, audioTrack));
        const montageCmd = new SmartMontageCommand(timelineAccessor, { assets: videoAssets, beatTimes: config.beatTimes, videoTrackId: videoTrack.id, audioTrackId: audioTrack.id, audioAsset, strategy: 'sequential' });
        commandManager.execute(montageCmd);
        const result = montageCmd.montageResult;
        setPlayheadTime(0);
        useEditorUIStore.getState().setSmartMontageOpen(false);
        showToast({ kind: 'success', title: 'AI 智能混剪完成', message: `已生成 ${result.clipCount} 个片段，BPM ≈ ${result.estimatedBpm}` });
      } catch (error) {
        showToast({ kind: 'error', title: '混剪生成失败', message: error instanceof Error ? error.message : '时间线操作被拒绝' });
      }
    },
    [setPlayheadTime],
  );

  const importSubtitles = useCallback(async () => {
    try {
      const paths = await pickSubtitlePaths();
      await importSubtitlePaths(paths);
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.editorToasts.subtitleImportFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.subtitleImportFailedMessage });
    }
  }, [project.timeline]);

  const importDataSubtitles = useCallback(
    async (mode: SubtitleDataImportMode) => {
      try {
        const paths = await pickSubtitleDataPaths();
        await importSubtitleDataPaths(paths, mode);
      } catch (error) {
        showToast({ kind: 'error', title: zhCN.editorToasts.subtitleImportFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.subtitleImportFailedMessage });
      }
    },
    [selectedClipIds],
  );

  async function restoreRecovery(recoveryCandidate: AutosaveRecoveryCandidate): Promise<void> {
    if (!recoveryCandidate) return;
    try {
      const password = isEncryptedProjectPath(recoveryCandidate.autosavePath)
        ? await requestProjectPassword(zhCN.projectFiles.encryptedOpenTitle, zhCN.projectFiles.encryptedOpenDescription)
        : undefined;
      if (isEncryptedProjectPath(recoveryCandidate.autosavePath) && !password) return;
      const restored = await readProjectFile(recoveryCandidate.autosavePath, recoveryCandidate.projectPath ?? recoveryCandidate.autosavePath, { password });
      commandManager.clear();
      setProject(restored, recoveryCandidate.projectPath);
      setDirty(true);
      setRecoveryCandidate(undefined);
      showToast({ kind: 'success', title: zhCN.editorToasts.recoveryRestored, message: recoveryCandidate.autosavePath });
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.editorToasts.recoveryFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.recoveryFailedMessage });
    }
  }

  async function discardRecovery(recoveryCandidate: AutosaveRecoveryCandidate): Promise<void> {
    if (!recoveryCandidate) return;
    try {
      await discardAutosaveRecovery(recoveryCandidate);
      setRecoveryCandidate(undefined);
      showToast({ kind: 'info', title: zhCN.editorToasts.recoveryDiscarded });
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.editorToasts.discardFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.discardFailedMessage });
    }
  }

  async function importDropped(paths: string[]): Promise<void> {
    try {
      const subtitlePaths = paths.filter(isSubtitlePath);
      const mediaPaths = paths.filter((path) => !isSubtitlePath(path));
      if (mediaPaths.length > 0) {
        const result = await probeMediaPaths(mediaPaths, project.media);
        if (result.duplicateCount > 0) {
          showToast({ kind: 'info', title: zhCN.editorToasts.duplicateTitle, message: zhCN.editorToasts.duplicateMessage(result.duplicateCount) });
        }
        const importedMedia = await applyImportedMediaColorConversionChoice(result.media);
        addMedia(importedMedia);
        void indexAndTagImportedMedia(importedMedia, projectPath || '');
        await persistMediaFingerprints(importedMedia);
        await queueFrameRateConversionForImportedMedia(importedMedia);
        void runAutomationForMedia('on-import', importedMedia);
      }
      if (subtitlePaths.length > 0) {
        await importSubtitlePaths(subtitlePaths);
      }
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.editorToasts.dropImportFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.dropImportFailedMessage });
    }
  }

  async function importSubtitlePaths(paths: string[]): Promise<void> {
    if (paths.length === 0) return;
    let importedCount = 0;
    for (const path of paths) {
      const contents = await readSubtitleText(path);
      const track = buildSubtitleTrackFromSrt(path, contents, useEditorStore.getState().project.timeline);
      if (track.clips.length === 0) {
        showToast({ kind: 'warning', title: zhCN.editorToasts.noSubtitlesFound, message: path });
        continue;
      }
      commandManager.execute(new AddTrackCommand(timelineAccessor, track));
      const importedSpeakers = collectSubtitleSpeakersFromTrack(track);
      if (importedSpeakers.length > 0) {
        commandManager.execute(new UpdateProjectSpeakersCommand(projectAccessor, mergeProjectSpeakers(useEditorStore.getState().project.speakers, importedSpeakers)));
      }
      importedCount += track.clips.length;
      setSelectedClipId(track.clips[0]?.id);
    }
    if (importedCount > 0) {
      showToast({ kind: 'success', title: zhCN.editorToasts.subtitlesImported, message: zhCN.editorToasts.subtitlesImportedMessage(importedCount) });
    }
  }

  async function importSubtitleDataPaths(paths: string[], mode: SubtitleDataImportMode): Promise<void> {
    if (paths.length === 0) return;
    let importedCount = 0;
    for (const path of paths) {
      const contents = await readSubtitleText(path);
      let cues = parseSubtitleDataFile(path, contents);
      const overlaps = detectSubtitleDataOverlaps(cues);
      if (overlaps.length > 0) {
        showToast({ kind: 'warning', title: zhCN.editorToasts.subtitleDataImportOverlaps, message: zhCN.editorToasts.subtitleDataImportOverlapsMessage(overlaps.length) });
        const shouldMerge = await bridgeConfirm(zhCN.editorToasts.subtitleDataImportMergePrompt(overlaps.length));
        if (shouldMerge) cues = mergeOverlappingSubtitleDataCues(cues);
      }
      const timeline = useEditorStore.getState().project.timeline;
      const targetTrackId = getSubtitleDataImportTargetTrackId(timeline, mode, selectedClipIds);
      const track = buildSubtitleTrackFromDataCues(path, cues, timeline, mode === 'new-track' ? undefined : targetTrackId);
      if (track.clips.length === 0) {
        showToast({ kind: 'warning', title: zhCN.editorToasts.noSubtitlesFound, message: path });
        continue;
      }
      commandManager.execute(new BatchImportSubtitleCommand(timelineAccessor, track, { mode, targetTrackId }));
      importedCount += track.clips.length;
      setSelectedClipIds(track.clips.map((clip) => clip.id));
    }
    if (importedCount > 0) {
      showToast({ kind: 'success', title: zhCN.editorToasts.subtitlesImported, message: zhCN.editorToasts.subtitlesImportedMessage(importedCount) });
    }
  }

  const shortcutHandlers = useMemo(
    () => ({
      togglePlayback,
      reversePlayback,
      pausePlayback,
      forwardPlayback,
      stepBackwardFrame: () => stepFrame(-1),
      stepForwardFrame: () => stepFrame(1),
      setInPoint: markInPoint,
      setOutPoint: markOutPoint,
      addExportRangeIn: markMultiRangeInPoint,
      addExportRangeOut: markMultiRangeOutPoint,
      deleteSelected,
      rippleDeleteSelected,
      splitSelected,
      selectAll: selectAllTimelineItems,
      clearSelection: clearSelectedClipIds,
      addAnnotation: addAnnotationAtPlayhead,
      addBookmark: addBookmarkAtPlayhead,
      toggleGridSnap: toggleTimelineGridSnap,
      jumpToPreviousNavigationPoint: () => jumpTimelineNavigationPoint('previous'),
      jumpToNextNavigationPoint: () => jumpTimelineNavigationPoint('next'),
      undo,
      switchToPreviousHistoryBranch,
      redo,
      save: () => void saveProject(),
      exportCurrentFrame: () => void exportCurrentFrame(),
      matchFrame: () => void matchFrameToSource(),
      revealInTimeline: () => void revealMediaInTimeline(),
      navigateNextInstance: () => void navigateToNextInstance(),
      navigatePrevGap,
      navigateNextGap,
      renderInOut: () => void renderInOutRegion(),
    }),
    [
      togglePlayback, reversePlayback, pausePlayback, forwardPlayback, stepFrame,
      markInPoint, markOutPoint, markMultiRangeInPoint, markMultiRangeOutPoint,
      deleteSelected, rippleDeleteSelected, splitSelected, selectAllTimelineItems,
      clearSelectedClipIds, addAnnotationAtPlayhead, addBookmarkAtPlayhead,
      toggleTimelineGridSnap, jumpTimelineNavigationPoint, undo,
      switchToPreviousHistoryBranch, redo, saveProject, exportCurrentFrame,
      matchFrameToSource, revealMediaInTimeline, navigateToNextInstance,
      navigatePrevGap, navigateNextGap, renderInOutRegion,
    ],
  );

  return {
    importVideosForStitchWizard,
    generateVideoStitchTimeline,
    generateSmartMontage,
    importSubtitles,
    importDataSubtitles,
    restoreRecovery,
    discardRecovery,
    importDropped,
    importSubtitlePaths,
    importSubtitleDataPaths,
    shortcutHandlers,
  };
}

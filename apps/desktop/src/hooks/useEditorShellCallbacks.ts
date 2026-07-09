import { useCallback } from 'react';
import {
  AutoRepairProjectHealthCommand,
  BatchAlignToBeatCommand,
  BatchShiftClipsCommand,
  UpdateClipCommand,
  SplitClipAtTimesCommand,
  AddSpeakerDiarizationTracksCommand,
  AddTrackCommand,
  MergeMediaCommand,
  UpdateProjectBeatMarkersCommand,
  RemoveMediaCommand,
  createBeatMarker,
  estimateBpmFromBeatMarkers,
  calculateBeatSplitTimesForClip,
  createId,
  getClipSpeed,
  getCfrTargetFrameRate,
  getProjectFrameRateConversionTarget,
  isFrameRateMismatch,
  hasLowConfidenceSpeakerSegments,
  resolveAutoAudioSyncApplyRoute,
  type Clip,
  type MediaAsset,
  type Project,
  type AutoAudioSyncApplyMode,
  type AutoAudioSyncResult,
  type DuplicateMediaIssue,
  type MissingMediaIssue,
  type OrphanMediaIssue,
  type ProxyMissingIssue,
} from '@open-factory/editor-core';
import {
  bridgeConfirm,
  cancelDemucs,
  detectBeats,
  startRecording,
  stopRecording,
  type RecordingSource,
} from '../lib/tauri-bridge';
import { showToast } from '../lib/toast';
import { zhCN } from '../i18n/strings';
import { commandManager, projectAccessor, timelineAccessor } from '../store/commandManager';
import { useEditorStore } from '../store/editorStore';
import { useEditorSettingsStore } from '../store/editorSettingsStore';
import { useEditorFeatureStore } from '../store/editorFeatureStore';
import { useProxySettingsStore } from '../store/proxySettingsStore';
import { useRecordingSettingsStore } from '../store/recordingSettingsStore';
import { useEditorUIStore } from '../store/editorUIStore';
import { useMediaJobStore } from '../media/media-job-store';
import { ensureMediaJobRunner } from '../media/media-job-runner';
import { separateAudioForClip, type DemucsAvailability } from '../lib/demucs';
import { analyzeSpeakerDiarizationForClip } from '../lib/speakerDiarization';
import { analyzeAutoAudioSyncTargets, type AutoAudioSyncTarget } from '../lib/autoAudioSync';
import { collectSpeakerDiarizationDialogueIntervals } from '../lib/content-analysis-helpers';
import {
  buildProjectHealthAutoRepairInput,
  scanProjectHealth,
} from '../lib/projectHealth';
import {
  scanMediaHealthDashboard,
  writeMediaHealthAutoShowEnabled,
} from '../lib/mediaHealthDashboard';
import { relinkSingleMedia } from '../media/relink';
import { probeMediaPaths } from '../lib/media';

// ---------------------------------------------------------------------------
// 参数接口：Project Health 回调组
// ---------------------------------------------------------------------------

interface ProjectHealthCallbacksDeps {
  /** 可选的已扫描报告，用于 autoRepair 跳过重复扫描 */
  projectHealthReport: ReturnType<typeof useEditorFeatureStore.getState>['projectHealthReport'];
}

/** 项目健康相关的回调组 */
export function useProjectHealthCallbacks(deps: ProjectHealthCallbacksDeps) {
  const { projectHealthReport } = deps;

  const refreshProjectHealth = useCallback(async () => {
    try {
      useEditorFeatureStore.getState().setProjectHealthScanning(true);
      const state = useEditorStore.getState();
      useEditorFeatureStore.getState().setProjectHealthReport(
        await scanProjectHealth(state.project, useProxySettingsStore.getState().settings)
      );
    } catch (error) {
      showToast({
        kind: 'error',
        title: zhCN.projectHealth.toasts.scanFailed,
        message: error instanceof Error ? error.message : zhCN.projectHealth.toasts.scanFailedMessage
      });
    } finally {
      useEditorFeatureStore.getState().setProjectHealthScanning(false);
    }
  }, []);

  const openProjectHealth = useCallback(() => {
    useEditorFeatureStore.getState().setProjectHealthRepairReport(undefined);
    useEditorUIStore.getState().setProjectHealthOpen(true);
    void refreshProjectHealth();
  }, [refreshProjectHealth]);

  const refreshMediaHealthDashboard = useCallback(async () => {
    try {
      useEditorFeatureStore.getState().setMediaHealthScanning(true);
      const state = useEditorStore.getState();
      const result = await scanMediaHealthDashboard(state.project, useProxySettingsStore.getState().settings);
      useEditorFeatureStore.getState().setMediaHealthDashboard(result.dashboard);
      useEditorFeatureStore.getState().setProjectHealthReport(result.report);
      return result;
    } catch (error) {
      showToast({
        kind: 'error',
        title: zhCN.mediaHealthDashboard.toasts.scanFailed,
        message: error instanceof Error ? error.message : zhCN.mediaHealthDashboard.toasts.scanFailedMessage
      });
      return undefined;
    } finally {
      useEditorFeatureStore.getState().setMediaHealthScanning(false);
    }
  }, []);

  const openMediaHealthDashboard = useCallback(() => {
    useEditorUIStore.getState().setMediaHealthDashboardOpen(true);
    void refreshMediaHealthDashboard();
  }, [refreshMediaHealthDashboard]);

  const setMediaHealthAutoShow = useCallback((enabled: boolean) => {
    useEditorFeatureStore.getState().setMediaHealthAutoShowEnabled(enabled);
    writeMediaHealthAutoShowEnabled(enabled);
  }, []);

  const openMediaHealthRelinkPanel = useCallback(() => {
    useEditorUIStore.getState().setMediaHealthDashboardOpen(false);
    openProjectHealth();
  }, [openProjectHealth]);

  const relinkMissingFromHealth = useCallback(
    async (issue: MissingMediaIssue) => {
      const state = useEditorStore.getState();
      const asset = state.project.media.find((item) => item.id === issue.assetId);
      if (!asset) {
        return;
      }
      try {
        const relinked = await relinkSingleMedia(asset);
        if (relinked) {
          const current = useEditorStore.getState();
          current.setMedia(current.project.media.map((item) => (item.id === issue.assetId ? relinked : item)));
          showToast({ kind: 'success', title: zhCN.editorToasts.mediaRelinked, message: relinked.name });
        }
        await refreshProjectHealth();
      } catch (error) {
        showToast({ kind: 'error', title: zhCN.editorToasts.relinkFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.relinkFailedMessage });
      }
    },
    [refreshProjectHealth]
  );

  const removeOrphanFromHealth = useCallback(
    async (issue: OrphanMediaIssue) => {
      try {
        commandManager.execute(new RemoveMediaCommand(projectAccessor, issue.assetId));
        showToast({ kind: 'success', title: zhCN.projectHealth.toasts.orphanRemoved, message: issue.name });
        await refreshProjectHealth();
      } catch (error) {
        showToast({ kind: 'error', title: zhCN.projectHealth.toasts.fixFailed, message: error instanceof Error ? error.message : zhCN.projectHealth.toasts.fixFailedMessage });
      }
    },
    [refreshProjectHealth]
  );

  const mergeDuplicateFromHealth = useCallback(
    async (issue: DuplicateMediaIssue) => {
      try {
        commandManager.execute(new MergeMediaCommand(projectAccessor, issue.keepAssetId, issue.assets.map((asset) => asset.assetId)));
        showToast({ kind: 'success', title: zhCN.projectHealth.toasts.duplicateMerged });
        await refreshProjectHealth();
      } catch (error) {
        showToast({ kind: 'error', title: zhCN.projectHealth.toasts.fixFailed, message: error instanceof Error ? error.message : zhCN.projectHealth.toasts.fixFailedMessage });
      }
    },
    [refreshProjectHealth]
  );

  const queueProxyFromHealth = useCallback(
    async (issue: ProxyMissingIssue) => {
      const asset = useEditorStore.getState().project.media.find((item) => item.id === issue.assetId);
      if (!asset) {
        return;
      }
      try {
        useMediaJobStore.getState().enqueueProxyJobsForMedia([asset], useProxySettingsStore.getState().settings);
        void ensureMediaJobRunner();
        showToast({ kind: 'success', title: zhCN.projectHealth.toasts.proxyQueued, message: issue.name });
        await refreshProjectHealth();
      } catch (error) {
        showToast({ kind: 'error', title: zhCN.projectHealth.toasts.fixFailed, message: error instanceof Error ? error.message : zhCN.projectHealth.toasts.fixFailedMessage });
      }
    },
    [refreshProjectHealth]
  );

  const autoRepairProjectHealth = useCallback(async () => {
    try {
      const state = useEditorStore.getState();
      const report = projectHealthReport ?? (await scanProjectHealth(state.project, useProxySettingsStore.getState().settings));
      const input = await buildProjectHealthAutoRepairInput(state.project, report);
      let duplicateIssues = input.duplicateIssues ?? [];
      const manualEntries = [...(input.manualEntries ?? [])];
      if (duplicateIssues.length > 0) {
        const confirmed = await bridgeConfirm(zhCN.projectHealth.autoRepairDuplicateConfirm(duplicateIssues.length), {
          title: zhCN.projectHealth.actions.autoRepair
        });
        if (!confirmed) {
          manualEntries.push(
            ...duplicateIssues.map((issue) => ({
              type: 'duplicate-media' as const,
              status: 'manual' as const,
              assetId: issue.keepAssetId,
              message: `${issue.id}: ${zhCN.common.cancel}`
            }))
          );
          duplicateIssues = [];
        }
      }

      const current = useEditorStore.getState();
      const proxyAssets = current.project.media.filter((asset) => (input.proxyAssetIds ?? []).includes(asset.id));
      if (proxyAssets.length > 0) {
        useMediaJobStore.getState().enqueueProxyJobsForMedia(proxyAssets, useProxySettingsStore.getState().settings, { force: true });
      }
      const frameRateAssets = current.project.media.filter((asset) => asset.type === 'video' && (asset.variableFrameRate || isFrameRateMismatch(asset.frameRate, current.project.settings.fps)));
      for (const asset of frameRateAssets) {
        const cfrFrameRate = getProjectFrameRateConversionTarget(current.project.settings.fps, getCfrTargetFrameRate({ avgFrameRate: asset.avgFrameRate, realFrameRate: asset.realFrameRate }, asset.frameRate ?? 30));
        useMediaJobStore.getState().enqueueProxyJobsForMedia([asset], useProxySettingsStore.getState().settings, { force: true, cfrFrameRate });
      }
      if (proxyAssets.length > 0 || frameRateAssets.length > 0) {
        void ensureMediaJobRunner();
      }

      const command = new AutoRepairProjectHealthCommand(projectAccessor, {
        ...input,
        duplicateIssues,
        manualEntries,
        proxyAssetIds: proxyAssets.map((asset) => asset.id),
        frameRateProxyAssetIds: frameRateAssets.map((asset) => asset.id),
        unusedFolderName: zhCN.projectHealth.unusedFolder
      });
      commandManager.execute(command);
      useEditorFeatureStore.getState().setProjectHealthRepairReport(command.report);
      showToast({
        kind: command.report?.successCount ? 'success' : 'warning',
        title: zhCN.projectHealth.toasts.autoRepairComplete,
        message: command.report ? zhCN.projectHealth.repairReportSummary(command.report.successCount, command.report.skippedCount, command.report.manualCount) : undefined
      });
      await refreshProjectHealth();
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.projectHealth.toasts.fixFailed, message: error instanceof Error ? error.message : zhCN.projectHealth.toasts.fixFailedMessage });
    }
  }, [projectHealthReport, refreshProjectHealth]);

  const repairFromMediaHealthDashboard = useCallback(async () => {
    await autoRepairProjectHealth();
    await refreshMediaHealthDashboard();
  }, [autoRepairProjectHealth, refreshMediaHealthDashboard]);

  return {
    refreshProjectHealth,
    openProjectHealth,
    refreshMediaHealthDashboard,
    openMediaHealthDashboard,
    setMediaHealthAutoShow,
    openMediaHealthRelinkPanel,
    relinkMissingFromHealth,
    removeOrphanFromHealth,
    mergeDuplicateFromHealth,
    queueProxyFromHealth,
    autoRepairProjectHealth,
    repairFromMediaHealthDashboard,
  };
}

// ---------------------------------------------------------------------------
// 参数接口：Audio Analysis 回调组
// ---------------------------------------------------------------------------

interface AudioAnalysisCallbacksDeps {
  selectedClip: Clip | undefined;
  selectedClipMedia: MediaAsset | undefined;
  addMedia: (media: MediaAsset[]) => void;
  setSelectedClipId: (id: string) => void;
  setSelectedClipIds: (ids: string[]) => void;
  demucsAvailability: DemucsAvailability;
  demucsExecutablePath: string;
  audioSeparationClipId: string | undefined;
  speakerDiarizationTarget: { clip: Extract<Clip, { type: 'audio' | 'video' }>; asset: MediaAsset } | undefined;
  speakerDiarizationResult: ReturnType<typeof useEditorFeatureStore.getState>['speakerDiarizationResult'];
  autoAudioSyncTargets: AutoAudioSyncTarget[];
  resolvedAutoAudioSyncPrimaryClipId: string;
  autoAudioSyncResults: AutoAudioSyncResult[];
  autoAudioSyncMode: AutoAudioSyncApplyMode;
  project: Project;
}

/** 音频分析相关的回调组（分离、说话人识别、音频同步） */
export function useAudioAnalysisCallbacks(deps: AudioAnalysisCallbacksDeps) {
  const {
    selectedClip,
    selectedClipMedia,
    addMedia,
    setSelectedClipId,
    setSelectedClipIds,
    demucsAvailability,
    demucsExecutablePath,
    audioSeparationClipId,
    speakerDiarizationTarget,
    speakerDiarizationResult,
    autoAudioSyncTargets,
    resolvedAutoAudioSyncPrimaryClipId,
    autoAudioSyncResults,
    autoAudioSyncMode,
    project,
  } = deps;

  const separateSelectedAudio = useCallback(async () => {
    if (!selectedClip || (selectedClip.type !== 'audio' && selectedClip.type !== 'video') || !selectedClipMedia) {
      showToast({ kind: 'warning', title: zhCN.demucs.unavailableTitle, message: zhCN.demucs.noClipSelected });
      return;
    }
    if (!demucsAvailability.ready) {
      showToast({ kind: 'warning', title: zhCN.demucs.unavailableTitle, message: demucsAvailability.error ?? zhCN.demucs.notConfigured });
      return;
    }
    useEditorFeatureStore.getState().setAudioSeparationClipId(selectedClip.id);
    useEditorFeatureStore.getState().setAudioSeparationProgress(0);
    showToast({ kind: 'info', title: zhCN.demucs.runningTitle, message: zhCN.demucs.runningMessage(0) });
    try {
      const separation = await separateAudioForClip(selectedClip, selectedClipMedia, { executablePath: demucsExecutablePath });
      addMedia(separation.media);
      for (const track of separation.tracks) {
        commandManager.execute(new AddTrackCommand(timelineAccessor, track));
      }
      const separatedClipIds = separation.tracks.flatMap((track) => track.clips.map((clip) => clip.id));
      setSelectedClipIds(separatedClipIds);
      showToast({ kind: 'success', title: zhCN.demucs.completeTitle, message: zhCN.demucs.completeMessage(separation.media.length) });
    } catch (error) {
      const message = error instanceof Error ? error.message : zhCN.demucs.failedMessage;
      const canceled = message.toLowerCase().includes('canceled') || message.includes('取消');
      showToast({ kind: canceled ? 'warning' : 'error', title: canceled ? zhCN.demucs.canceledTitle : zhCN.demucs.failedTitle, message });
    } finally {
      useEditorFeatureStore.getState().setAudioSeparationClipId(undefined);
      useEditorFeatureStore.getState().setAudioSeparationProgress(undefined);
    }
  }, [addMedia, demucsAvailability, demucsExecutablePath, selectedClip, selectedClipMedia, setSelectedClipIds]);

  const runSpeakerDiarization = useCallback(async () => {
    const target = speakerDiarizationTarget;
    if (!target) {
      showToast({ kind: 'warning', title: zhCN.speakerDiarization.unavailableTitle, message: zhCN.speakerDiarization.unavailableMessage });
      return;
    }
    useEditorFeatureStore.getState().setSpeakerDiarizationRunning(true);
    showToast({ kind: 'info', title: zhCN.speakerDiarization.runningTitle, message: zhCN.speakerDiarization.runningMessage });
    try {
      const dialogueIntervals = collectSpeakerDiarizationDialogueIntervals(project, target.clip);
      const analysis = await analyzeSpeakerDiarizationForClip(target.clip, target.asset, dialogueIntervals);
      if (analysis.segments.length === 0 || analysis.tracks.length === 0) {
        useEditorFeatureStore.getState().setSpeakerDiarizationResult(undefined);
        showToast({ kind: 'warning', title: zhCN.speakerDiarization.noResultsTitle, message: zhCN.speakerDiarization.noResultsMessage });
        return;
      }
      setSelectedClipId(target.clip.id);
      useEditorFeatureStore.getState().setSpeakerDiarizationResult({
        sourceName: target.clip.name || target.asset.name,
        segments: analysis.segments,
        tracks: analysis.tracks
      });
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.speakerDiarization.failedTitle, message: error instanceof Error ? error.message : zhCN.speakerDiarization.failedMessage });
    } finally {
      useEditorFeatureStore.getState().setSpeakerDiarizationRunning(false);
    }
  }, [project, setSelectedClipId, speakerDiarizationTarget]);

  const applySpeakerDiarization = useCallback(async () => {
    if (!speakerDiarizationResult) {
      return;
    }
    if (hasLowConfidenceSpeakerSegments(speakerDiarizationResult.segments)) {
      const lowCount = speakerDiarizationResult.segments.filter((segment) => segment.confidenceLabel === 'low').length;
      const accepted = await bridgeConfirm(zhCN.speakerDiarization.lowConfidenceConfirm(lowCount), {
        title: zhCN.speakerDiarization.title,
        kind: 'warning'
      });
      if (!accepted) {
        return;
      }
    }
    try {
      commandManager.execute(new AddSpeakerDiarizationTracksCommand(timelineAccessor, speakerDiarizationResult.tracks));
      setSelectedClipIds(speakerDiarizationResult.tracks.flatMap((track) => track.clips.map((clip) => clip.id)));
      showToast({
        kind: 'success',
        title: zhCN.speakerDiarization.completeTitle,
        message: zhCN.speakerDiarization.completeMessage(speakerDiarizationResult.tracks.length, speakerDiarizationResult.segments.length)
      });
      useEditorFeatureStore.getState().setSpeakerDiarizationResult(undefined);
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.speakerDiarization.failedTitle, message: error instanceof Error ? error.message : zhCN.speakerDiarization.failedMessage });
    }
  }, [setSelectedClipIds, speakerDiarizationResult]);

  const openAutoAudioSync = useCallback(() => {
    if (autoAudioSyncTargets.length < 2 || autoAudioSyncTargets.length > 5) {
      showToast({ kind: 'warning', title: zhCN.autoAudioSync.unavailableTitle, message: zhCN.autoAudioSync.unavailableMessage });
      return;
    }
    useEditorFeatureStore.getState().setAutoAudioSyncPrimaryClipId((current) => (current && autoAudioSyncTargets.some((target) => target.clip.id === current) ? current : autoAudioSyncTargets[0].clip.id));
    useEditorFeatureStore.getState().setAutoAudioSyncResults([]);
    useEditorUIStore.getState().setAutoAudioSyncOpen(true);
  }, [autoAudioSyncTargets]);

  const runAutoAudioSync = useCallback(async () => {
    const primary = autoAudioSyncTargets.find((target) => target.clip.id === resolvedAutoAudioSyncPrimaryClipId);
    const secondaryTargets = autoAudioSyncTargets.filter((target) => target.clip.id !== resolvedAutoAudioSyncPrimaryClipId).slice(0, 4);
    if (!primary || secondaryTargets.length === 0) {
      showToast({ kind: 'warning', title: zhCN.autoAudioSync.unavailableTitle, message: zhCN.autoAudioSync.notEnoughTracksMessage });
      return;
    }
    useEditorFeatureStore.getState().setAutoAudioSyncRunning(true);
    showToast({ kind: 'info', title: zhCN.autoAudioSync.runningTitle, message: zhCN.autoAudioSync.runningMessage });
    try {
      const analysis = await analyzeAutoAudioSyncTargets(primary, secondaryTargets);
      useEditorFeatureStore.getState().setAutoAudioSyncResults(analysis.results);
      const lowCount = analysis.results.filter((result) => result.confidence === 'low' || !result.applied).length;
      if (lowCount > 0) {
        showToast({ kind: 'warning', title: zhCN.autoAudioSync.unavailableTitle, message: zhCN.autoAudioSync.skippedLowConfidence(lowCount) });
      }
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.autoAudioSync.failedTitle, message: error instanceof Error ? error.message : zhCN.autoAudioSync.failedMessage });
    } finally {
      useEditorFeatureStore.getState().setAutoAudioSyncRunning(false);
    }
  }, [autoAudioSyncTargets, resolvedAutoAudioSyncPrimaryClipId]);

  const applyAutoAudioSync = useCallback(() => {
    const route = resolveAutoAudioSyncApplyRoute(resolvedAutoAudioSyncPrimaryClipId, autoAudioSyncResults, autoAudioSyncMode);
    const shiftedClipIds = Object.keys(route.offsetsByClipId);
    if (shiftedClipIds.length === 0) {
      showToast({ kind: 'warning', title: zhCN.autoAudioSync.unavailableTitle, message: zhCN.autoAudioSync.noApplicableResults });
      return;
    }
    try {
      commandManager.execute(new BatchShiftClipsCommand(timelineAccessor, route.offsetsByClipId));
      if (route.mutePrimaryClipId) {
        commandManager.execute(new UpdateClipCommand(timelineAccessor, route.mutePrimaryClipId, { muted: true }));
      }
      setSelectedClipIds(shiftedClipIds);
      showToast({ kind: 'success', title: zhCN.autoAudioSync.completeTitle, message: zhCN.autoAudioSync.completeMessage(shiftedClipIds.length) });
      if (route.skippedLowConfidenceClipIds.length > 0) {
        showToast({ kind: 'warning', title: zhCN.autoAudioSync.unavailableTitle, message: zhCN.autoAudioSync.skippedLowConfidence(route.skippedLowConfidenceClipIds.length) });
      }
      useEditorUIStore.getState().setAutoAudioSyncOpen(false);
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.autoAudioSync.failedTitle, message: error instanceof Error ? error.message : zhCN.autoAudioSync.failedMessage });
    }
  }, [autoAudioSyncMode, autoAudioSyncResults, resolvedAutoAudioSyncPrimaryClipId, setSelectedClipIds]);

  const cancelAudioSeparation = useCallback(async () => {
    if (!audioSeparationClipId) {
      return;
    }
    try {
      await cancelDemucs(audioSeparationClipId);
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.demucs.cancelFailedTitle, message: error instanceof Error ? error.message : zhCN.demucs.failedMessage });
    }
  }, [audioSeparationClipId]);

  return {
    separateSelectedAudio,
    runSpeakerDiarization,
    applySpeakerDiarization,
    openAutoAudioSync,
    runAutoAudioSync,
    applyAutoAudioSync,
    cancelAudioSeparation,
  };
}

// ---------------------------------------------------------------------------
// 参数接口：Beat Sync 回调组
// ---------------------------------------------------------------------------

interface BeatSyncCallbacksDeps {
  selectedClip: Clip | undefined;
  selectedClipMedia: MediaAsset | undefined;
  selectedClipId: string | undefined;
  selectedClipIds: string[];
  beatSyncBeatTimes: number[];
  beatSyncSpeedEnabled: boolean;
  beatSyncManualBpm: string;
  beatSensitivity: ReturnType<typeof useEditorSettingsStore.getState>['beatSensitivity'];
  projectBeatMarkers: Project['beatMarkers'];
  setSelectedClipIds: (ids: string[]) => void;
  clearSelectedClipIds: () => void;
}

/** 节拍同步相关的回调组（检测、对齐、分割、手动 BPM） */
export function useBeatSyncCallbacks(deps: BeatSyncCallbacksDeps) {
  const {
    selectedClip,
    selectedClipMedia,
    selectedClipId,
    selectedClipIds,
    beatSyncBeatTimes,
    beatSyncSpeedEnabled,
    beatSyncManualBpm,
    beatSensitivity,
    projectBeatMarkers,
    setSelectedClipIds,
    clearSelectedClipIds,
  } = deps;

  const detectSelectedBeats = useCallback(async () => {
    if (!selectedClip || !selectedClipMedia || (selectedClip.type !== 'audio' && selectedClip.type !== 'video') || (selectedClipMedia.type !== 'audio' && !selectedClipMedia.hasAudio)) {
      showToast({ kind: 'warning', title: zhCN.editorToasts.beatDetectFailed, message: zhCN.editorToasts.beatDetectNoClip });
      return;
    }
    showToast({ kind: 'info', title: zhCN.editorToasts.beatDetectRunning, message: selectedClip.name });
    try {
      const sourceBeatTimes = await detectBeats(selectedClipMedia.path, beatSensitivity);
      const speed = getClipSpeed(selectedClip);
      const localBeatMarkers = sourceBeatTimes
        .map((sourceTime) => {
          const localTime = (sourceTime - selectedClip.trimStart) / speed;
          if (!Number.isFinite(localTime) || localTime < -0.000001 || localTime > selectedClip.duration + 0.000001) {
            return undefined;
          }
          return createBeatMarker(Math.min(selectedClip.duration, Math.max(0, localTime)));
        })
        .filter((marker): marker is ReturnType<typeof createBeatMarker> => Boolean(marker));
      if (localBeatMarkers.length === 0) {
        showToast({ kind: 'warning', title: zhCN.editorToasts.beatDetectFailed, message: zhCN.editorToasts.beatDetectNoMarkers });
        return;
      }
      const detectedBpm = estimateBpmFromBeatMarkers(localBeatMarkers);
      commandManager.execute(new UpdateClipCommand(timelineAccessor, selectedClip.id, { beatMarkers: localBeatMarkers, detectedBpm }));
      const clipStart = selectedClip.start;
      const clipEnd = selectedClip.start + selectedClip.duration;
      const preserved = (projectBeatMarkers ?? []).filter((marker) => marker.time < clipStart - 0.000001 || marker.time > clipEnd + 0.000001);
      const timelineMarkers = localBeatMarkers.map((marker, index) => createBeatMarker(selectedClip.start + marker.time, `${selectedClip.id}-beat-${index + 1}`));
      commandManager.execute(new UpdateProjectBeatMarkersCommand(projectAccessor, [...preserved, ...timelineMarkers]));
      showToast({ kind: 'success', title: zhCN.editorToasts.beatDetectComplete(localBeatMarkers.length), message: detectedBpm ? zhCN.editorToasts.beatDetectBpm(detectedBpm) : undefined });
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.editorToasts.beatDetectFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.beatDetectNoMarkers });
    }
  }, [beatSensitivity, projectBeatMarkers, selectedClip, selectedClipMedia]);

  const snapSelectedToBeats = useCallback(() => {
    const ids = selectedClipIds.length > 0 ? selectedClipIds : selectedClipId ? [selectedClipId] : [];
    if (ids.length === 0) {
      showToast({ kind: 'warning', title: zhCN.editorToasts.beatSnapUnavailable, message: zhCN.editorToasts.beatSnapNoSelection });
      return;
    }
    const beatTimes = beatSyncBeatTimes;
    if (beatTimes.length === 0) {
      showToast({ kind: 'warning', title: zhCN.editorToasts.beatSnapUnavailable, message: zhCN.editorToasts.beatSnapNoMarkers });
      return;
    }
    try {
      const command = new BatchAlignToBeatCommand(timelineAccessor, ids, beatTimes, { maxDistance: 0.05, syncSpeed: beatSyncSpeedEnabled });
      commandManager.execute(command);
      setSelectedClipIds(ids);
      showToast({ kind: 'success', title: zhCN.editorToasts.beatSnapComplete(command.appliedUpdates.length) });
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.editorToasts.beatSnapUnavailable, message: error instanceof Error ? error.message : zhCN.timeline.timelineRejectedMessage });
    }
  }, [beatSyncBeatTimes, beatSyncSpeedEnabled, selectedClipId, selectedClipIds, setSelectedClipIds]);

  const splitSelectedToBeats = useCallback(() => {
    if (!selectedClip) {
      showToast({ kind: 'warning', title: zhCN.editorToasts.beatSplitUnavailable, message: zhCN.editorToasts.beatSplitNoSelection });
      return;
    }
    const beatTimes = beatSyncBeatTimes;
    if (beatTimes.length === 0) {
      showToast({ kind: 'warning', title: zhCN.editorToasts.beatSplitUnavailable, message: zhCN.editorToasts.beatSnapNoMarkers });
      return;
    }
    const splitTimes = calculateBeatSplitTimesForClip(selectedClip, beatTimes);
    if (splitTimes.length === 0) {
      showToast({ kind: 'warning', title: zhCN.editorToasts.beatSplitUnavailable, message: zhCN.editorToasts.beatSplitNoMarkers });
      return;
    }
    try {
      commandManager.execute(new SplitClipAtTimesCommand(timelineAccessor, selectedClip.id, splitTimes));
      clearSelectedClipIds();
      showToast({ kind: 'success', title: zhCN.editorToasts.beatSplitComplete(splitTimes.length + 1), message: zhCN.editorToasts.beatSplitCompleteMessage(splitTimes.length) });
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.editorToasts.beatSplitUnavailable, message: error instanceof Error ? error.message : zhCN.timeline.timelineRejectedMessage });
    }
  }, [beatSyncBeatTimes, clearSelectedClipIds, selectedClip]);

  const applyManualBeatBpm = useCallback(() => {
    if (!selectedClip) {
      showToast({ kind: 'warning', title: zhCN.editorToasts.beatSnapUnavailable, message: zhCN.editorToasts.beatSnapNoSelection });
      return;
    }
    const bpm = Number(beatSyncManualBpm);
    if (!Number.isFinite(bpm) || bpm <= 0) {
      showToast({ kind: 'warning', title: zhCN.editorToasts.beatDetectFailed, message: zhCN.editorToasts.beatBpmInvalid });
      return;
    }
    commandManager.execute(new UpdateClipCommand(timelineAccessor, selectedClip.id, { detectedBpm: bpm }));
    showToast({ kind: 'success', title: zhCN.editorToasts.beatBpmUpdated(Math.round(bpm)) });
  }, [beatSyncManualBpm, selectedClip]);

  return {
    detectSelectedBeats,
    snapSelectedToBeats,
    splitSelectedToBeats,
    applyManualBeatBpm,
  };
}

// ---------------------------------------------------------------------------
// 参数接口：Recording 回调组
// ---------------------------------------------------------------------------

interface RecordingCallbacksDeps {
  addMedia: (media: MediaAsset[]) => void;
  persistMediaFingerprints: (media: MediaAsset[]) => Promise<void>;
  recordingTask: ReturnType<typeof useEditorFeatureStore.getState>['recordingTask'];
  recordingSettings: ReturnType<typeof useRecordingSettingsStore.getState>['settings'];
}

/** 录屏相关的回调组 */
export function useRecordingCallbacks(deps: RecordingCallbacksDeps) {
  const { addMedia, persistMediaFingerprints, recordingTask, recordingSettings } = deps;

  const startEditorRecording = useCallback(
    async (source: RecordingSource) => {
      if (recordingTask) {
        return;
      }
      const taskId = createId('recording');
      try {
        const result = await startRecording({
          taskId,
          source,
          width: recordingSettings.width,
          height: recordingSettings.height,
          frameRate: recordingSettings.frameRate
        });
        useEditorFeatureStore.getState().setRecordingTask({ taskId: result.taskId, source, outputPath: result.outputPath, startedAt: Date.now() });
        showToast({ kind: 'info', title: zhCN.recording.startedTitle, message: zhCN.recording.startedMessage(source) });
      } catch (error) {
        showToast({ kind: 'error', title: zhCN.recording.startFailedTitle, message: error instanceof Error ? error.message : zhCN.recording.failedMessage });
      }
    },
    [recordingSettings, recordingTask]
  );

  const stopEditorRecording = useCallback(async () => {
    const task = recordingTask;
    if (!task) {
      return;
    }
    try {
      const result = await stopRecording(task.taskId);
      const imported = await probeMediaPaths([result.outputPath], useEditorStore.getState().project.media);
      if (imported.media.length > 0) {
        addMedia(imported.media);
        await persistMediaFingerprints(imported.media);
      }
      showToast({ kind: 'success', title: zhCN.recording.stoppedTitle, message: zhCN.recording.importedMessage(imported.media.length) });
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.recording.stopFailedTitle, message: error instanceof Error ? error.message : zhCN.recording.failedMessage });
    } finally {
      useEditorFeatureStore.getState().setRecordingTask(undefined);
      useEditorFeatureStore.getState().setRecordingElapsedSeconds(0);
    }
  }, [addMedia, persistMediaFingerprints, recordingTask]);

  return {
    startEditorRecording,
    stopEditorRecording,
  };
}

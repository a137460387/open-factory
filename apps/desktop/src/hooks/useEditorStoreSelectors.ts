import { useMemo } from 'react';
import { useEditorStore } from '../store/editorStore';
import { useEditorUIStore } from '../store/editorUIStore';
import { useEditorSettingsStore } from '../store/editorSettingsStore';
import { useEditorFeatureStore } from '../store/editorFeatureStore';
import { useCollaborationStore } from '../store/collaborationStore';
import { useProxySettingsStore } from '../store/proxySettingsStore';
import { useDemucsSettingsStore } from '../store/demucsSettingsStore';
import { useRecordingSettingsStore } from '../store/recordingSettingsStore';
import type { Clip, MediaAsset, Project } from '@open-factory/editor-core';

/**
 * 优化的 store selectors，避免不必要的重渲染。
 * 使用 shallow comparison 和 memoization。
 */
export function useEditorStoreSelectors() {
  // --- EditorStore selectors ---
  const project = useEditorStore((state) => state.project);
  const selectedClipId = useEditorStore((state) => state.selectedClipId);
  const selectedClipIds = useEditorStore((state) => state.selectedClipIds);
  const selectedKeyframe = useEditorStore((state) => state.selectedKeyframe);
  const selectedKeyframes = useEditorStore((state) => state.selectedKeyframes);
  const isPlaying = useEditorStore((state) => state.isPlaying);
  const inPoint = useEditorStore((state) => state.inPoint);
  const outPoint = useEditorStore((state) => state.outPoint);
  const dirty = useEditorStore((state) => state.dirty);
  const projectPath = useEditorStore((state) => state.projectPath);

  // --- EditorUIStore selectors ---
  const layoutSettings = useEditorUIStore((state) => state.layoutSettings);
  const reviewMode = useEditorUIStore((state) => state.reviewMode);
  const viewportSize = useEditorUIStore((state) => state.viewportSize);

  // --- EditorSettingsStore selectors ---
  const lastBackupAt = useEditorSettingsStore((state) => state.lastBackupAt);
  const pipLayoutPosition = useEditorSettingsStore((state) => state.pipLayoutPosition);
  const customSplitLayouts = useEditorSettingsStore((state) => state.customSplitLayouts);

  // --- EditorFeatureStore selectors ---
  const colorAnalysisBusy = useEditorFeatureStore((state) => state.colorAnalysisBusy);
  const colorAnalysisResults = useEditorFeatureStore((state) => state.colorAnalysisResults);
  const colorAnalysisJumps = useEditorFeatureStore((state) => state.colorAnalysisJumps);
  const colorHeatmapPoints = useEditorFeatureStore((state) => state.colorHeatmapPoints);
  const colorAnalysisSamples = useEditorFeatureStore((state) => state.colorAnalysisSamples);
  const demucsAvailability = useEditorFeatureStore((state) => state.demucsAvailability);
  const audioSeparationClipId = useEditorFeatureStore((state) => state.audioSeparationClipId);
  const audioSeparationProgress = useEditorFeatureStore((state) => state.audioSeparationProgress);
  const speakerDiarizationRunning = useEditorFeatureStore((state) => state.speakerDiarizationRunning);
  const speakerDiarizationResult = useEditorFeatureStore((state) => state.speakerDiarizationResult);
  const autoAudioSyncRunning = useEditorFeatureStore((state) => state.autoAudioSyncRunning);
  const autoAudioSyncPrimaryClipId = useEditorFeatureStore((state) => state.autoAudioSyncPrimaryClipId);
  const autoAudioSyncMode = useEditorFeatureStore((state) => state.autoAudioSyncMode);
  const autoAudioSyncResults = useEditorFeatureStore((state) => state.autoAudioSyncResults);
  const recordingTask = useEditorFeatureStore((state) => state.recordingTask);
  const recordingElapsedSeconds = useEditorFeatureStore((state) => state.recordingElapsedSeconds);
  const operationRecording = useEditorFeatureStore((state) => state.operationRecording);
  const operationRecordingActive = useEditorFeatureStore((state) => state.operationRecordingActive);
  const operationRecordingStep = useEditorFeatureStore((state) => state.operationRecordingStep);
  const operationReplaySpeed = useEditorFeatureStore((state) => state.operationReplaySpeed);
  const operationReplayRunning = useEditorFeatureStore((state) => state.operationReplayRunning);
  const profilerRecording = useEditorFeatureStore((state) => state.profilerRecording);
  const profilerElapsedMs = useEditorFeatureStore((state) => state.profilerElapsedMs);
  const profilerReport = useEditorFeatureStore((state) => state.profilerReport);

  // --- CollaborationStore selectors ---
  const collaborationEnabled = useCollaborationStore((state) => state.enabled);

  // --- ProxySettingsStore selectors ---
  const proxySettings = useProxySettingsStore((state) => state.settings);

  // --- DemucsSettingsStore selectors ---
  const demucsExecutablePath = useDemucsSettingsStore((state) => state.executablePath);

  // --- RecordingSettingsStore selectors ---
  const recordingSettings = useRecordingSettingsStore((state) => state.settings);

  return {
    // EditorStore
    project,
    selectedClipId,
    selectedClipIds,
    selectedKeyframe,
    selectedKeyframes,
    isPlaying,
    inPoint,
    outPoint,
    dirty,
    projectPath,

    // EditorUIStore
    layoutSettings,
    reviewMode,
    viewportSize,

    // EditorSettingsStore
    lastBackupAt,
    pipLayoutPosition,
    customSplitLayouts,

    // EditorFeatureStore
    colorAnalysisBusy,
    colorAnalysisResults,
    colorAnalysisJumps,
    colorHeatmapPoints,
    colorAnalysisSamples,
    demucsAvailability,
    audioSeparationClipId,
    audioSeparationProgress,
    speakerDiarizationRunning,
    speakerDiarizationResult,
    autoAudioSyncRunning,
    autoAudioSyncPrimaryClipId,
    autoAudioSyncMode,
    autoAudioSyncResults,
    recordingTask,
    recordingElapsedSeconds,
    operationRecording,
    operationRecordingActive,
    operationRecordingStep,
    operationReplaySpeed,
    operationReplayRunning,
    profilerRecording,
    profilerElapsedMs,
    profilerReport,

    // CollaborationStore
    collaborationEnabled,

    // ProxySettingsStore
    proxySettings,

    // DemucsSettingsStore
    demucsExecutablePath,

    // RecordingSettingsStore
    recordingSettings,
  };
}

/**
 * 派生状态 selectors，使用 useMemo 优化计算。
 */
export function useEditorDerivedSelectors() {
  const project = useEditorStore((state) => state.project);
  const selectedClipId = useEditorStore((state) => state.selectedClipId);
  const selectedClipIds = useEditorStore((state) => state.selectedClipIds);

  const selectedClip = useMemo(
    () => selectClipById(project, selectedClipId),
    [project, selectedClipId],
  );

  const selectedClips = useMemo(
    () =>
      selectedClipIds
        .map((id) => selectClipById(project, id))
        .filter((clip): clip is Clip => Boolean(clip)),
    [project, selectedClipIds],
  );

  const selectedClipMedia = useMemo(
    () =>
      selectedClip && 'mediaId' in selectedClip
        ? project.media.find((asset) => asset.id === selectedClip.mediaId)
        : undefined,
    [selectedClip, project.media],
  );

  const allTimelineClips = useMemo(
    () => project.timeline.tracks.flatMap((track) => track.clips),
    [project.timeline.tracks],
  );

  return {
    selectedClip,
    selectedClips,
    selectedClipMedia,
    allTimelineClips,
  };
}

// Helper function
function selectClipById(project: Project, clipId?: string): Clip | undefined {
  if (!clipId) return undefined;
  for (const track of project.timeline.tracks) {
    const clip = track.clips.find((c: Clip) => c.id === clipId);
    if (clip) return clip;
  }
  return undefined;
}

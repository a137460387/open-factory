import { useEditorFeatureStore } from '../store/editorFeatureStore';
import type { DemucsAvailability } from '../lib/demucs';
import type { AutoAudioSyncResult, AutoAudioSyncApplyMode } from '@open-factory/editor-core';
import type { OperationRecordingFile, OperationReplaySpeed, PerformanceProfilerReport } from '@open-factory/editor-core';

/**
 * Feature store selectors，优化 feature store 订阅。
 */
export function useFeatureStoreSelectors() {
  // --- 颜色分析相关 ---
  const colorAnalysisBusy = useEditorFeatureStore((s) => s.colorAnalysisBusy);
  const colorAnalysisResults = useEditorFeatureStore((s) => s.colorAnalysisResults);
  const colorAnalysisJumps = useEditorFeatureStore((s) => s.colorAnalysisJumps);
  const colorHeatmapPoints = useEditorFeatureStore((s) => s.colorHeatmapPoints);
  const colorAnalysisSamples = useEditorFeatureStore((s) => s.colorAnalysisSamples);

  // --- 音频分离相关 ---
  const demucsAvailability = useEditorFeatureStore((s) => s.demucsAvailability);
  const audioSeparationClipId = useEditorFeatureStore((s) => s.audioSeparationClipId);
  const audioSeparationProgress = useEditorFeatureStore((s) => s.audioSeparationProgress);

  // --- 说话人分离相关 ---
  const speakerDiarizationRunning = useEditorFeatureStore((s) => s.speakerDiarizationRunning);
  const speakerDiarizationResult = useEditorFeatureStore((s) => s.speakerDiarizationResult);

  // --- 自动音频同步相关 ---
  const autoAudioSyncRunning = useEditorFeatureStore((s) => s.autoAudioSyncRunning);
  const autoAudioSyncPrimaryClipId = useEditorFeatureStore((s) => s.autoAudioSyncPrimaryClipId);
  const autoAudioSyncMode = useEditorFeatureStore((s) => s.autoAudioSyncMode);
  const autoAudioSyncResults = useEditorFeatureStore((s) => s.autoAudioSyncResults);

  // --- 录制相关 ---
  const recordingTask = useEditorFeatureStore((s) => s.recordingTask);
  const recordingElapsedSeconds = useEditorFeatureStore((s) => s.recordingElapsedSeconds);

  // --- 操作录制相关 ---
  const operationRecording = useEditorFeatureStore((s) => s.operationRecording);
  const operationRecordingActive = useEditorFeatureStore((s) => s.operationRecordingActive);
  const operationRecordingStep = useEditorFeatureStore((s) => s.operationRecordingStep);
  const operationReplaySpeed = useEditorFeatureStore((s) => s.operationReplaySpeed);
  const operationReplayRunning = useEditorFeatureStore((s) => s.operationReplayRunning);

  // --- 性能分析相关 ---
  const profilerRecording = useEditorFeatureStore((s) => s.profilerRecording);
  const profilerElapsedMs = useEditorFeatureStore((s) => s.profilerElapsedMs);
  const profilerReport = useEditorFeatureStore((s) => s.profilerReport);

  // --- 项目健康相关 ---
  const projectHealthReport = useEditorFeatureStore((s) => s.projectHealthReport);
  const projectHealthScanning = useEditorFeatureStore((s) => s.projectHealthScanning);
  const projectHealthRepairReport = useEditorFeatureStore((s) => s.projectHealthRepairReport);

  // --- 媒体健康相关 ---
  const mediaHealthScanning = useEditorFeatureStore((s) => s.mediaHealthScanning);
  const mediaHealthDashboard = useEditorFeatureStore((s) => s.mediaHealthDashboard);

  // --- 批量处理相关 ---
  const batchTranscodeInitialPaths = useEditorFeatureStore((s) => s.batchTranscodeInitialPaths);
  const thumbnailGeneratorAssetIds = useEditorFeatureStore((s) => s.thumbnailGeneratorAssetIds);

  // --- 其他功能 ---
  const gifExportAsset = useEditorFeatureStore((s) => s.gifExportAsset);
  const spectrumAsset = useEditorFeatureStore((s) => s.spectrumAsset);
  const mediaVersionCompare = useEditorFeatureStore((s) => s.mediaVersionCompare);
  const formatConverterMockFiles = useEditorFeatureStore((s) => s.formatConverterMockFiles);
  const mockSubtitleClips = useEditorFeatureStore((s) => s.mockSubtitleClips);
  const mockExportHistory = useEditorFeatureStore((s) => s.mockExportHistory);

  return {
    // 颜色分析
    colorAnalysisBusy,
    colorAnalysisResults,
    colorAnalysisJumps,
    colorHeatmapPoints,
    colorAnalysisSamples,

    // 音频分离
    demucsAvailability,
    audioSeparationClipId,
    audioSeparationProgress,

    // 说话人分离
    speakerDiarizationRunning,
    speakerDiarizationResult,

    // 自动音频同步
    autoAudioSyncRunning,
    autoAudioSyncPrimaryClipId,
    autoAudioSyncMode,
    autoAudioSyncResults,

    // 录制
    recordingTask,
    recordingElapsedSeconds,

    // 操作录制
    operationRecording,
    operationRecordingActive,
    operationRecordingStep,
    operationReplaySpeed,
    operationReplayRunning,

    // 性能分析
    profilerRecording,
    profilerElapsedMs,
    profilerReport,

    // 项目健康
    projectHealthReport,
    projectHealthScanning,
    projectHealthRepairReport,

    // 媒体健康
    mediaHealthScanning,
    mediaHealthDashboard,

    // 批量处理
    batchTranscodeInitialPaths,
    thumbnailGeneratorAssetIds,

    // 其他功能
    gifExportAsset,
    spectrumAsset,
    mediaVersionCompare,
    formatConverterMockFiles,
    mockSubtitleClips,
    mockExportHistory,
  };
}

/**
 * Feature store setters selectors，优化 feature store setter 订阅。
 */
export function useFeatureStoreSetterSelectors() {
  const setColorAnalysisBusy = useEditorFeatureStore((s) => s.setColorAnalysisBusy);
  const setColorAnalysisResults = useEditorFeatureStore((s) => s.setColorAnalysisResults);
  const setColorAnalysisJumps = useEditorFeatureStore((s) => s.setColorAnalysisJumps);
  const setColorHeatmapPoints = useEditorFeatureStore((s) => s.setColorHeatmapPoints);
  const setColorAnalysisSamples = useEditorFeatureStore((s) => s.setColorAnalysisSamples);
  const setDemucsAvailability = useEditorFeatureStore((s) => s.setDemucsAvailability);
  const setAudioSeparationClipId = useEditorFeatureStore((s) => s.setAudioSeparationClipId);
  const setAudioSeparationProgress = useEditorFeatureStore((s) => s.setAudioSeparationProgress);
  const setSpeakerDiarizationRunning = useEditorFeatureStore((s) => s.setSpeakerDiarizationRunning);
  const setSpeakerDiarizationResult = useEditorFeatureStore((s) => s.setSpeakerDiarizationResult);
  const setAutoAudioSyncRunning = useEditorFeatureStore((s) => s.setAutoAudioSyncRunning);
  const setAutoAudioSyncPrimaryClipId = useEditorFeatureStore((s) => s.setAutoAudioSyncPrimaryClipId);
  const setAutoAudioSyncMode = useEditorFeatureStore((s) => s.setAutoAudioSyncMode);
  const setAutoAudioSyncResults = useEditorFeatureStore((s) => s.setAutoAudioSyncResults);
  const setRecordingTask = useEditorFeatureStore((s) => s.setRecordingTask);
  const setRecordingElapsedSeconds = useEditorFeatureStore((s) => s.setRecordingElapsedSeconds);
  const setBatchTranscodeInitialPaths = useEditorFeatureStore((s) => s.setBatchTranscodeInitialPaths);
  const setThumbnailGeneratorAssetIds = useEditorFeatureStore((s) => s.setThumbnailGeneratorAssetIds);
  const setGifExportAsset = useEditorFeatureStore((s) => s.setGifExportAsset);
  const setSpectrumAsset = useEditorFeatureStore((s) => s.setSpectrumAsset);
  const setMediaVersionCompare = useEditorFeatureStore((s) => s.setMediaVersionCompare);
  const setFormatConverterMockFiles = useEditorFeatureStore((s) => s.setFormatConverterMockFiles);
  const setMockSubtitleClips = useEditorFeatureStore((s) => s.setMockSubtitleClips);
  const setMockExportHistory = useEditorFeatureStore((s) => s.setMockExportHistory);

  return {
    setColorAnalysisBusy,
    setColorAnalysisResults,
    setColorAnalysisJumps,
    setColorHeatmapPoints,
    setColorAnalysisSamples,
    setDemucsAvailability,
    setAudioSeparationClipId,
    setAudioSeparationProgress,
    setSpeakerDiarizationRunning,
    setSpeakerDiarizationResult,
    setAutoAudioSyncRunning,
    setAutoAudioSyncPrimaryClipId,
    setAutoAudioSyncMode,
    setAutoAudioSyncResults,
    setRecordingTask,
    setRecordingElapsedSeconds,
    setBatchTranscodeInitialPaths,
    setThumbnailGeneratorAssetIds,
    setGifExportAsset,
    setSpectrumAsset,
    setMediaVersionCompare,
    setFormatConverterMockFiles,
    setMockSubtitleClips,
    setMockExportHistory,
  };
}

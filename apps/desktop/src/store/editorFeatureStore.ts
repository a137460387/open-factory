import { create } from 'zustand';
import type {
  PerformanceProfilerReport,
  TimelineColorAnalysisResult,
  SceneColorDifference,
  TimelineColorHeatmapPoint,
  ColorAnalysisClipSample,
  ProjectHealthReport,
  ProjectHealthRepairReport,
  MediaHealthDashboard,
  MediaCleanupReport,
  DuplicateMediaGroup,
  SmartDuplicateGroup,
  AutoAudioSyncApplyMode,
  AutoAudioSyncResult,
  SpeakerDiarizationSegment,
  Track,
  OperationRecordingFile,
  OperationReplaySpeed,
  MediaVersionCompareRequest,
  MediaAsset,
  SubtitleClip,
  ExportTaskHistoryEntry,
  ClipboardKeyframeGroup,
  BeatSensitivity,
} from '@open-factory/editor-core';
import type { ExportPreset } from '../export/export-presets';
import type { MacroHistoryEntry, ClipMacro } from '../macros/clip-macros';
import type { DemucsAvailability } from '../lib/demucs';
import type { ProjectPasswordRequest } from '../components/dialogs/ProjectPasswordDialog';
import type { AutosaveRecoveryCandidate } from '../lib/projectFiles';
import type { ArchiveProgress } from '../lib/projectArchive';
import type { RecordingSource } from '../lib/tauri-bridge';
import type { ProfilerRecordingBuffer } from '../lib/profiler-helpers';
import type { DroppedFile } from '../components/FormatConverterDialog';

type Updater<T> = T | ((current: T) => T);

function applyUpdater<T>(current: T, updater: Updater<T>): T {
  return typeof updater === 'function' ? (updater as (current: T) => T)(current) : updater;
}

export interface EditorFeatureState {
  // Profiler
  profilerRecording: boolean;
  profilerElapsedMs: number;
  profilerReport: PerformanceProfilerReport | undefined;

  // Color analysis
  colorAnalysisBusy: boolean;
  colorAnalysisResults: TimelineColorAnalysisResult[];
  colorAnalysisJumps: SceneColorDifference[];
  colorHeatmapPoints: TimelineColorHeatmapPoint[];
  colorAnalysisSamples: ColorAnalysisClipSample[];

  // Project & media health
  projectHealthReport: ProjectHealthReport | undefined;
  projectHealthRepairReport: ProjectHealthRepairReport | undefined;
  projectHealthScanning: boolean;
  mediaHealthDashboard: MediaHealthDashboard | undefined;
  mediaHealthScanning: boolean;
  mediaHealthAutoShowEnabled: boolean;

  // Duplicate & organizer
  duplicateMediaGroups: DuplicateMediaGroup[];
  mediaOrganizerGroups: SmartDuplicateGroup[];
  mediaOrganizerCleanup: MediaCleanupReport | undefined;
  mediaOrganizerScanning: boolean;

  // Speaker diarization
  speakerDiarizationRunning: boolean;
  speakerDiarizationResult: { sourceName: string; segments: SpeakerDiarizationSegment[]; tracks: Track[] } | undefined;

  // Recording
  recordingTask: { taskId: string; source: RecordingSource; outputPath: string; startedAt: number } | undefined;
  recordingElapsedSeconds: number;

  // Macro recording
  macroRecordingActive: boolean;
  macroRecordingStepCount: number;

  // Audio separation
  audioSeparationClipId: string | undefined;
  audioSeparationProgress: number | undefined;

  // Content analysis
  contentAnalysisRunningClipId: string | undefined;

  // Demucs
  demucsAvailability: DemucsAvailability;

  // Auto audio sync
  autoAudioSyncRunning: boolean;
  autoAudioSyncPrimaryClipId: string | undefined;
  autoAudioSyncMode: AutoAudioSyncApplyMode;
  autoAudioSyncResults: AutoAudioSyncResult[];

  // Operation recording / replay
  operationRecording: OperationRecordingFile | undefined;
  operationRecordingActive: boolean;
  operationRecordingStep: number;
  operationReplaySpeed: OperationReplaySpeed;
  operationReplayRunning: boolean;

  // Misc feature state
  projectPasswordRequest: ProjectPasswordRequest | undefined;
  timelineTemplateMode: 'save' | 'new' | undefined;
  templateExportPreset: ExportPreset | undefined;
  batchTranscodeInitialPaths: string[];
  thumbnailGeneratorAssetIds: string[] | undefined;
  gifExportAsset: MediaAsset | undefined;
  spectrumAsset: MediaAsset | undefined;
  mediaVersionCompare: MediaVersionCompareRequest | undefined;
  recoveryCandidate: AutosaveRecoveryCandidate | undefined;
  archiveProgress: ArchiveProgress | undefined;
  pasteKeyframeDialogGroups: ClipboardKeyframeGroup[];
  macroHistory: MacroHistoryEntry[];
  mockExportHistory: ExportTaskHistoryEntry[];
  mockSubtitleClips: SubtitleClip[];
  formatConverterMockFiles: DroppedFile[];

  // Profiler setters
  setProfilerRecording: (updater: Updater<boolean>) => void;
  setProfilerElapsedMs: (updater: Updater<number>) => void;
  setProfilerReport: (updater: Updater<PerformanceProfilerReport | undefined>) => void;

  // Color analysis setters
  setColorAnalysisBusy: (updater: Updater<boolean>) => void;
  setColorAnalysisResults: (updater: Updater<TimelineColorAnalysisResult[]>) => void;
  setColorAnalysisJumps: (updater: Updater<SceneColorDifference[]>) => void;
  setColorHeatmapPoints: (updater: Updater<TimelineColorHeatmapPoint[]>) => void;
  setColorAnalysisSamples: (updater: Updater<ColorAnalysisClipSample[]>) => void;

  // Project & media health setters
  setProjectHealthReport: (updater: Updater<ProjectHealthReport | undefined>) => void;
  setProjectHealthRepairReport: (updater: Updater<ProjectHealthRepairReport | undefined>) => void;
  setProjectHealthScanning: (updater: Updater<boolean>) => void;
  setMediaHealthDashboard: (updater: Updater<MediaHealthDashboard | undefined>) => void;
  setMediaHealthScanning: (updater: Updater<boolean>) => void;
  setMediaHealthAutoShowEnabled: (updater: Updater<boolean>) => void;

  // Duplicate & organizer setters
  setDuplicateMediaGroups: (updater: Updater<DuplicateMediaGroup[]>) => void;
  setMediaOrganizerGroups: (updater: Updater<SmartDuplicateGroup[]>) => void;
  setMediaOrganizerCleanup: (updater: Updater<MediaCleanupReport | undefined>) => void;
  setMediaOrganizerScanning: (updater: Updater<boolean>) => void;

  // Speaker diarization setters
  setSpeakerDiarizationRunning: (updater: Updater<boolean>) => void;
  setSpeakerDiarizationResult: (updater: Updater<{ sourceName: string; segments: SpeakerDiarizationSegment[]; tracks: Track[] } | undefined>) => void;

  // Recording setters
  setRecordingTask: (updater: Updater<{ taskId: string; source: RecordingSource; outputPath: string; startedAt: number } | undefined>) => void;
  setRecordingElapsedSeconds: (updater: Updater<number>) => void;

  // Macro recording setters
  setMacroRecordingActive: (updater: Updater<boolean>) => void;
  setMacroRecordingStepCount: (updater: Updater<number>) => void;

  // Audio separation setters
  setAudioSeparationClipId: (updater: Updater<string | undefined>) => void;
  setAudioSeparationProgress: (updater: Updater<number | undefined>) => void;

  // Content analysis setters
  setContentAnalysisRunningClipId: (updater: Updater<string | undefined>) => void;

  // Demucs setters
  setDemucsAvailability: (updater: Updater<DemucsAvailability>) => void;

  // Auto audio sync setters
  setAutoAudioSyncRunning: (updater: Updater<boolean>) => void;
  setAutoAudioSyncPrimaryClipId: (updater: Updater<string | undefined>) => void;
  setAutoAudioSyncMode: (updater: Updater<AutoAudioSyncApplyMode>) => void;
  setAutoAudioSyncResults: (updater: Updater<AutoAudioSyncResult[]>) => void;

  // Operation recording / replay setters
  setOperationRecording: (updater: Updater<OperationRecordingFile | undefined>) => void;
  setOperationRecordingActive: (updater: Updater<boolean>) => void;
  setOperationRecordingStep: (updater: Updater<number>) => void;
  setOperationReplaySpeed: (updater: Updater<OperationReplaySpeed>) => void;
  setOperationReplayRunning: (updater: Updater<boolean>) => void;

  // Misc feature setters
  setProjectPasswordRequest: (updater: Updater<ProjectPasswordRequest | undefined>) => void;
  setTimelineTemplateMode: (updater: Updater<'save' | 'new' | undefined>) => void;
  setTemplateExportPreset: (updater: Updater<ExportPreset | undefined>) => void;
  setBatchTranscodeInitialPaths: (updater: Updater<string[]>) => void;
  setThumbnailGeneratorAssetIds: (updater: Updater<string[] | undefined>) => void;
  setGifExportAsset: (updater: Updater<MediaAsset | undefined>) => void;
  setSpectrumAsset: (updater: Updater<MediaAsset | undefined>) => void;
  setMediaVersionCompare: (updater: Updater<MediaVersionCompareRequest | undefined>) => void;
  setRecoveryCandidate: (updater: Updater<AutosaveRecoveryCandidate | undefined>) => void;
  setArchiveProgress: (updater: Updater<ArchiveProgress | undefined>) => void;
  setPasteKeyframeDialogGroups: (updater: Updater<ClipboardKeyframeGroup[]>) => void;
  setMacroHistory: (updater: Updater<MacroHistoryEntry[]>) => void;
  setMockExportHistory: (updater: Updater<ExportTaskHistoryEntry[]>) => void;
  setMockSubtitleClips: (updater: Updater<SubtitleClip[]>) => void;
  setFormatConverterMockFiles: (updater: Updater<DroppedFile[]>) => void;
}

export const useEditorFeatureStore = create<EditorFeatureState>((set) => ({
  // Profiler
  profilerRecording: false,
  profilerElapsedMs: 0,
  profilerReport: undefined,

  // Color analysis
  colorAnalysisBusy: false,
  colorAnalysisResults: [],
  colorAnalysisJumps: [],
  colorHeatmapPoints: [],
  colorAnalysisSamples: [],

  // Project & media health
  projectHealthReport: undefined,
  projectHealthRepairReport: undefined,
  projectHealthScanning: false,
  mediaHealthDashboard: undefined,
  mediaHealthScanning: false,
  mediaHealthAutoShowEnabled: true,

  // Duplicate & organizer
  duplicateMediaGroups: [],
  mediaOrganizerGroups: [],
  mediaOrganizerCleanup: undefined,
  mediaOrganizerScanning: false,

  // Speaker diarization
  speakerDiarizationRunning: false,
  speakerDiarizationResult: undefined,

  // Recording
  recordingTask: undefined,
  recordingElapsedSeconds: 0,

  // Macro recording
  macroRecordingActive: false,
  macroRecordingStepCount: 0,

  // Audio separation
  audioSeparationClipId: undefined,
  audioSeparationProgress: undefined,

  // Content analysis
  contentAnalysisRunningClipId: undefined,

  // Demucs
  demucsAvailability: { ready: false },

  // Auto audio sync
  autoAudioSyncRunning: false,
  autoAudioSyncPrimaryClipId: undefined,
  autoAudioSyncMode: 'keep-secondary',
  autoAudioSyncResults: [],

  // Operation recording / replay
  operationRecording: undefined,
  operationRecordingActive: false,
  operationRecordingStep: -1,
  operationReplaySpeed: 1,
  operationReplayRunning: false,

  // Misc feature state
  projectPasswordRequest: undefined,
  timelineTemplateMode: undefined,
  templateExportPreset: undefined,
  batchTranscodeInitialPaths: [],
  thumbnailGeneratorAssetIds: undefined,
  gifExportAsset: undefined,
  spectrumAsset: undefined,
  mediaVersionCompare: undefined,
  recoveryCandidate: undefined,
  archiveProgress: undefined,
  pasteKeyframeDialogGroups: [],
  macroHistory: [],
  mockExportHistory: [],
  mockSubtitleClips: [],
  formatConverterMockFiles: [],

  // Profiler setters
  setProfilerRecording(updater) { set((s) => ({ profilerRecording: applyUpdater(s.profilerRecording, updater) })); },
  setProfilerElapsedMs(updater) { set((s) => ({ profilerElapsedMs: applyUpdater(s.profilerElapsedMs, updater) })); },
  setProfilerReport(updater) { set((s) => ({ profilerReport: applyUpdater(s.profilerReport, updater) })); },

  // Color analysis setters
  setColorAnalysisBusy(updater) { set((s) => ({ colorAnalysisBusy: applyUpdater(s.colorAnalysisBusy, updater) })); },
  setColorAnalysisResults(updater) { set((s) => ({ colorAnalysisResults: applyUpdater(s.colorAnalysisResults, updater) })); },
  setColorAnalysisJumps(updater) { set((s) => ({ colorAnalysisJumps: applyUpdater(s.colorAnalysisJumps, updater) })); },
  setColorHeatmapPoints(updater) { set((s) => ({ colorHeatmapPoints: applyUpdater(s.colorHeatmapPoints, updater) })); },
  setColorAnalysisSamples(updater) { set((s) => ({ colorAnalysisSamples: applyUpdater(s.colorAnalysisSamples, updater) })); },

  // Project & media health setters
  setProjectHealthReport(updater) { set((s) => ({ projectHealthReport: applyUpdater(s.projectHealthReport, updater) })); },
  setProjectHealthRepairReport(updater) { set((s) => ({ projectHealthRepairReport: applyUpdater(s.projectHealthRepairReport, updater) })); },
  setProjectHealthScanning(updater) { set((s) => ({ projectHealthScanning: applyUpdater(s.projectHealthScanning, updater) })); },
  setMediaHealthDashboard(updater) { set((s) => ({ mediaHealthDashboard: applyUpdater(s.mediaHealthDashboard, updater) })); },
  setMediaHealthScanning(updater) { set((s) => ({ mediaHealthScanning: applyUpdater(s.mediaHealthScanning, updater) })); },
  setMediaHealthAutoShowEnabled(updater) { set((s) => ({ mediaHealthAutoShowEnabled: applyUpdater(s.mediaHealthAutoShowEnabled, updater) })); },

  // Duplicate & organizer setters
  setDuplicateMediaGroups(updater) { set((s) => ({ duplicateMediaGroups: applyUpdater(s.duplicateMediaGroups, updater) })); },
  setMediaOrganizerGroups(updater) { set((s) => ({ mediaOrganizerGroups: applyUpdater(s.mediaOrganizerGroups, updater) })); },
  setMediaOrganizerCleanup(updater) { set((s) => ({ mediaOrganizerCleanup: applyUpdater(s.mediaOrganizerCleanup, updater) })); },
  setMediaOrganizerScanning(updater) { set((s) => ({ mediaOrganizerScanning: applyUpdater(s.mediaOrganizerScanning, updater) })); },

  // Speaker diarization setters
  setSpeakerDiarizationRunning(updater) { set((s) => ({ speakerDiarizationRunning: applyUpdater(s.speakerDiarizationRunning, updater) })); },
  setSpeakerDiarizationResult(updater) { set((s) => ({ speakerDiarizationResult: applyUpdater(s.speakerDiarizationResult, updater) })); },

  // Recording setters
  setRecordingTask(updater) { set((s) => ({ recordingTask: applyUpdater(s.recordingTask, updater) })); },
  setRecordingElapsedSeconds(updater) { set((s) => ({ recordingElapsedSeconds: applyUpdater(s.recordingElapsedSeconds, updater) })); },

  // Macro recording setters
  setMacroRecordingActive(updater) { set((s) => ({ macroRecordingActive: applyUpdater(s.macroRecordingActive, updater) })); },
  setMacroRecordingStepCount(updater) { set((s) => ({ macroRecordingStepCount: applyUpdater(s.macroRecordingStepCount, updater) })); },

  // Audio separation setters
  setAudioSeparationClipId(updater) { set((s) => ({ audioSeparationClipId: applyUpdater(s.audioSeparationClipId, updater) })); },
  setAudioSeparationProgress(updater) { set((s) => ({ audioSeparationProgress: applyUpdater(s.audioSeparationProgress, updater) })); },

  // Content analysis setters
  setContentAnalysisRunningClipId(updater) { set((s) => ({ contentAnalysisRunningClipId: applyUpdater(s.contentAnalysisRunningClipId, updater) })); },

  // Demucs setters
  setDemucsAvailability(updater) { set((s) => ({ demucsAvailability: applyUpdater(s.demucsAvailability, updater) })); },

  // Auto audio sync setters
  setAutoAudioSyncRunning(updater) { set((s) => ({ autoAudioSyncRunning: applyUpdater(s.autoAudioSyncRunning, updater) })); },
  setAutoAudioSyncPrimaryClipId(updater) { set((s) => ({ autoAudioSyncPrimaryClipId: applyUpdater(s.autoAudioSyncPrimaryClipId, updater) })); },
  setAutoAudioSyncMode(updater) { set((s) => ({ autoAudioSyncMode: applyUpdater(s.autoAudioSyncMode, updater) })); },
  setAutoAudioSyncResults(updater) { set((s) => ({ autoAudioSyncResults: applyUpdater(s.autoAudioSyncResults, updater) })); },

  // Operation recording / replay setters
  setOperationRecording(updater) { set((s) => ({ operationRecording: applyUpdater(s.operationRecording, updater) })); },
  setOperationRecordingActive(updater) { set((s) => ({ operationRecordingActive: applyUpdater(s.operationRecordingActive, updater) })); },
  setOperationRecordingStep(updater) { set((s) => ({ operationRecordingStep: applyUpdater(s.operationRecordingStep, updater) })); },
  setOperationReplaySpeed(updater) { set((s) => ({ operationReplaySpeed: applyUpdater(s.operationReplaySpeed, updater) })); },
  setOperationReplayRunning(updater) { set((s) => ({ operationReplayRunning: applyUpdater(s.operationReplayRunning, updater) })); },

  // Misc feature setters
  setProjectPasswordRequest(updater) { set((s) => ({ projectPasswordRequest: applyUpdater(s.projectPasswordRequest, updater) })); },
  setTimelineTemplateMode(updater) { set((s) => ({ timelineTemplateMode: applyUpdater(s.timelineTemplateMode, updater) })); },
  setTemplateExportPreset(updater) { set((s) => ({ templateExportPreset: applyUpdater(s.templateExportPreset, updater) })); },
  setBatchTranscodeInitialPaths(updater) { set((s) => ({ batchTranscodeInitialPaths: applyUpdater(s.batchTranscodeInitialPaths, updater) })); },
  setThumbnailGeneratorAssetIds(updater) { set((s) => ({ thumbnailGeneratorAssetIds: applyUpdater(s.thumbnailGeneratorAssetIds, updater) })); },
  setGifExportAsset(updater) { set((s) => ({ gifExportAsset: applyUpdater(s.gifExportAsset, updater) })); },
  setSpectrumAsset(updater) { set((s) => ({ spectrumAsset: applyUpdater(s.spectrumAsset, updater) })); },
  setMediaVersionCompare(updater) { set((s) => ({ mediaVersionCompare: applyUpdater(s.mediaVersionCompare, updater) })); },
  setRecoveryCandidate(updater) { set((s) => ({ recoveryCandidate: applyUpdater(s.recoveryCandidate, updater) })); },
  setArchiveProgress(updater) { set((s) => ({ archiveProgress: applyUpdater(s.archiveProgress, updater) })); },
  setPasteKeyframeDialogGroups(updater) { set((s) => ({ pasteKeyframeDialogGroups: applyUpdater(s.pasteKeyframeDialogGroups, updater) })); },
  setMacroHistory(updater) { set((s) => ({ macroHistory: applyUpdater(s.macroHistory, updater) })); },
  setMockExportHistory(updater) { set((s) => ({ mockExportHistory: applyUpdater(s.mockExportHistory, updater) })); },
  setMockSubtitleClips(updater) { set((s) => ({ mockSubtitleClips: applyUpdater(s.mockSubtitleClips, updater) })); },
  setFormatConverterMockFiles(updater) { set((s) => ({ formatConverterMockFiles: applyUpdater(s.formatConverterMockFiles, updater) })); },
}));

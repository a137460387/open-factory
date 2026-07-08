import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  AddAdjustmentLayerCommand,
  AutoRepairProjectHealthCommand,
  AddClipCommand,
  AddMotionGraphicCommand,
  AddMediaFolderCommand,
  AddProjectAnnotationCommand,
  AddReviewAnnotationCommand,
  AddSpeakerDiarizationTracksCommand,
  AddProjectBookmarkCommand,
  AddSubclipCommand,
  ApplyEffectPresetCommand,
  ApplySplitLayoutCommand,
  BatchImportSubtitleCommand,
  BatchAlignToBeatCommand,
  BatchRenameMediaCommand,
  BatchShiftClipsCommand,
  BatchUpdateClipCommand,
  BatchUpdateMetadataCommand,
  AddTrackCommand,
  AddTransitionCommand,
  buildConformMediaReplacements,
  buildConformPreflight,
  buildConformReport,
  analyzeColorFrameSample,
  buildColorAlignmentUpdates,
  buildTimelineColorHeatmapData,
  CreateMulticamSequenceCommand,
  detectSceneColorJumps,
  ConformMediaCommand,
  UpdateProjectMediaCollectionsCommand,
  DEFAULT_TIMELINE_GRID_SETTINGS,
  DEFAULT_PROJECT_ANNOTATION_COLOR,
  DEFAULT_REVIEW_ANNOTATION_COLOR,
  DeleteGroupCommand,
  DeleteClipsCommand,
  DeleteMediaFolderCommand,
  DeleteSubclipCommand,
  ImportEDLCommand,
  LoadProjectCommand,
  MergeMediaCommand,
  MigrateProxiesCommand,
  NewProjectCommand,
  RemoveMediaCommand,
  MoveMediaToFolderCommand,
  RippleDeleteCommand,
  RenameMediaFolderCommand,
  PiPLayoutCommand,
  SetMediaFolderCollapsedCommand,
  SplitClipCommand,
  SplitClipAtTimesCommand,
  UpdateProjectBeatMarkersCommand,
  UpdateProjectBookmarksCommand,
  UpdateProjectExportRangesCommand,
  UpdateProjectReleaseVersionCommand,
  UpdateProjectSpeakersCommand,
  UpdateClipCommand,
  UpdateSubclipCommand,
  createBeatMarker,
  calculateBeatSplitTimesForClip,
  estimateBpmFromBeatMarkers,
  createExportRange,
  createId,
  createProject,
  createSubclip,
  createTrack,
  buildVideoStitchSequence,
  buildCoverFrameBatchTasks,
  buildTimelineNavigationPoints,
  createMainSideSplitLayout,
  detectSubtitleDataOverlaps,
  dirname,
  round,
  replaceMediaPathBasename,
  getSplitLayoutDefinition,
  getClipSpeed,
  getClipSourceVisibleDuration,
  getCfrTargetFrameRate,
  getColorSpaceDisplayName,
  getProjectFrameRateConversionTarget,
  getTimelineDuration,
  isFrameRateMismatch,
  findCompleteClipGroup,
  findSyncCompareClipRefs,
  findTimelineNavigationPoint,
  normalizeClipGroups,
  normalizeProjectWorkingColorSpace,
  normalizeProjectSpeakers,
  normalizeExportRanges,
  resolveAutoAudioSyncApplyRoute,
  applyTimelineVersionDiffSelection,
  instantiateProjectTemplate,
  instantiateTitleTemplate,
  mergeImportedTimelineBookmarks,
  addMediaVersion as appendMediaVersion,
  buildMediaVersionCompareRequest,
  parseTimelineBookmarksJson,
  mergeOverlappingSubtitleDataCues,
  replaceProjectActiveTimeline,
  serializeTimelineBookmarks,
  applyArchiveRelinkPlan,
  shouldAutoShowMediaHealthDashboard,
  type DuplicateMediaGroup,
  type DuplicateMediaIssue,
  type MediaHealthDashboard,
  type MediaCleanupReport,
  type MissingMediaIssue,
  type MediaAsset,
  type OrphanMediaIssue,
  type ProjectHealthReport,
  type Project,
  type ProjectSpeaker,
  type ReviewAnnotation,
  type Clip,
  type Subclip,
  type BatchEditableMediaMetadata,
  type ClipContentAnalysis,
  type BeatSensitivity,
  type KeyframeProperty,
  type PiPLayoutPosition,
  type ProjectTemplateId,
  type ProxyMissingIssue,
  type ProjectHealthRepairReport,
  type SplitLayoutDefinition,
  type SubtitleDataImportMode,
  type Timeline as CoreTimeline,
  type TimelineGridSettings,
  type TimelineGridUnit,
  type TitleTemplateId,
  type ExportTask,
  type EffectPreset,
  type ColorAnalysisClipSample,
  type SceneColorDifference,
  type TimelineColorAnalysisResult,
  type TimelineColorHeatmapPoint,
  type AutoAudioSyncApplyMode,
  type AutoAudioSyncResult,
  type MediaVersionCompareRequest,
  type MediaRenamePreviewItem,
  type SmartDuplicateGroup,
  createOperationRecording,
  recordOperationCommand,
  serializeOperationRecording,
  parseOperationRecording,
  buildOperationReplaySchedule,
  getOperationProjectAtStep,
  generateOperationRecordingSlidesHtml,
  buildProxyMigration,
  matchConformByFilename,
  normalizeOperationReplaySpeed,
  hasLowConfidenceSpeakerSegments,
  type OperationRecordingFile,
  type OperationReplaySpeed,
  type SpeakerDiarizationSegment,
  type Track,
  analyzeExportSpeed,
  appendProfilerMemorySample,
  buildPerformanceProfilerReport,
  type PerformanceProfilerReport,
  type ProfilerExportSpeedSample,
  type ProfilerFrameSample,
  type ProfilerMemorySample,
  type ProfilerQueueSample,
  type ProfilerTraceEvent,
  type SubtitleClip,
  type ExportTaskHistoryEntry
} from '@open-factory/editor-core';
import {
  matchFrameFromClip,
  revealInTimeline as coreRevealInTimeline,
  navigateToNextInstance as coreNavigateToNextInstance,
  getMediaInstanceNavigation,
  type ClipboardKeyframeGroup,
  type PasteMode,
  PasteKeyframesCommand,
  computeTimelineGaps,
  navigateGap
} from '@open-factory/editor-core';
import { ChevronLeft, ChevronRight, GripHorizontal } from 'lucide-react';
import { Toolbar } from './Toolbar';
import { runConfiguredAutomationForMedia, type AutomationActionDependencies } from '../automation/automation-rules';
import { ErrorBoundary } from './common/ErrorBoundary';
import { MediaBin } from './MediaBin/MediaBin';
import { ShortcutCheatsheetPanel } from './ShortcutCheatsheetPanel';
import { Timeline } from './Timeline/Timeline';
import { useAutosave } from '../hooks/useAutosave';
import { useCloseGuard } from '../hooks/useCloseGuard';
import { useExportQueue } from '../hooks/useExportQueue';
import { useMacroShortcuts } from '../hooks/useMacroShortcuts';
import { useShortcuts } from '../hooks/useShortcuts';
import { readCustomKeybindings } from '../shortcuts/keybindings';
import type { TimelineShortcutBindings } from '../shortcuts/timeline-shortcuts';
import { isEditableKeyboardTarget, isShortcutCheatsheetKey } from '../accessibility/keyboard-navigation';
import type { ExportQueueRecoveryCandidate } from '../export/export-queue-persistence';
import { useExportQueueStore } from '../export/export-queue-store';
import { revealExport } from '../lib/exportVideo';
import { clearMediaCache } from '../cache/cache-service';
import { createAdjustmentLayerClip, createClipFromAsset, createMotionGraphicClip, findPreferredTrack } from '../lib/clipFactory';
import { zhCN, t } from '../i18n/strings';
import { usePerformanceMonitorStore } from '../store/performanceMonitorStore';
import { PerformanceAlertIcon } from './PerformanceAlertIcon';
import {
  applyWorkspaceLayout,
  BUILT_IN_WORKSPACE_LAYOUT_IDS,
  clampTimelineHeight,
  createCustomWorkspaceLayout,
  getEffectivePanelState,
  getWorkspaceLayoutById,
  resolveWorkspaceLayoutShortcut,
  type WorkspaceLayoutDefinition,
  type WorkspaceLayoutId
} from '../layout/layoutSettings';
import type { ExportPreset } from '../export/export-presets';
import { pickMediaPaths, probeMediaPaths } from '../lib/media';
import { generateMediaFingerprint, scanDuplicateMediaGroups } from '../lib/duplicateMedia';
import { buildArchiveDestinationPath, buildRenameDestinationPath, scanMediaCleanupReport, scanSmartDuplicateMediaGroups } from '../lib/mediaOrganizer';
import {
  buildSubtitleTrackFromDataCues,
  buildSubtitleTrackFromSrt,
  collectSubtitleSpeakersFromTrack,
  isSubtitlePath,
  parseSubtitleDataFile,
  pickSubtitleDataPaths,
  pickSubtitlePaths,
  readSubtitleText
} from '../lib/subtitles';
import { createProjectArchivePlan, writeProjectArchive, type ArchiveProgress } from '../lib/projectArchive';
import { collectProjectArchivePreflight, saveClipReport, saveOfflineMediaReport } from '../lib/mediaReport';
import { saveProjectSnapshot } from '../lib/projectSnapshots';
import { buildProjectHealthAutoRepairInput, scanProjectHealth } from '../lib/projectHealth';
import { readMediaHealthAutoShowEnabled, scanMediaHealthDashboard, writeMediaHealthAutoShowEnabled } from '../lib/mediaHealthDashboard';
import { getReviewModeShellVisibility } from '../review/reviewMode';
import { saveReviewReport } from '../review/reviewReport';
import type { SharePackageWorkflowProgress } from '../lib/sharePackage';
import { canSeparateAudioForClip, getDemucsAvailability, separateAudioForClip, type DemucsAvailability } from '../lib/demucs';
import { analyzeSpeakerDiarizationForClip } from '../lib/speakerDiarization';
import { analyzeAutoAudioSyncTargets, type AutoAudioSyncTarget } from '../lib/autoAudioSync';
import {
  chooseProjectSavePath,
  chooseProjectToOpen,
  confirmDiscardChanges,
  deleteAutosaveAfterSave,
  discardAutosaveRecovery,
  findStartupAutosaveRecovery,
  isEncryptedProjectPath,
  readAutosaveIntervalSeconds,
  readProjectFile,
  setActiveProjectEncryptionPassword,
  writeAutosaveIntervalSeconds,
  writeProjectFile,
  type AutosaveRecoveryCandidate,
  type ProjectFileEncryptionOptions
} from '../lib/projectFiles';
import {
  bridgeConfirm,
  batchExtractCoverFrames,
  cancelDemucs,
  closePreviewWindow,
  convertLocalFileSrc,
  copyFile as bridgeCopyFile,
  detectBeats,
  emitBridge,
  getAppDataDir,
  getCacheSize,
  getPreviewWindowState,
  listenBridge,
  openPreviewWindow,
  openDirectoryDialog,
  openFileDialog as bridgeOpenFileDialog,
  scanDirectory,
  moveFile as bridgeMoveFile,
  removeFile as bridgeRemoveFile,
  trashFile as bridgeTrashFile,
  readFile as bridgeReadFile,
  readColorMatchFrameSample,
  saveFileDialog as bridgeSaveFileDialog,
  sendNotification,
  startRecording,
  stopRecording,
  writeFile as bridgeWriteFile,
  type DemucsProgressEvent,
  type PreviewWindowState,
  type RecordingSource
} from '../lib/tauri-bridge';
import { renderPreviewCache } from '../lib/tauri-bridge';
import { showToast } from '../lib/toast';
import {
  createPreviewWindowPlaybackState,
  normalizePreviewWindowPlaybackState,
  shouldApplyPreviewWindowPlaybackState
} from '../lib/previewWindowSync';
import {
  appendMacroHistoryEntry,
  buildMacroCommands,
  findMacroTargetClip,
  readClipMacros,
  readMacroHistory,
  snapshotCommand,
  writeClipMacros,
  type ClipMacro,
  type CommandSnapshot,
  type MacroHistoryEntry
} from '../macros/clip-macros';
import {
  readBackupSettings,
  readCollaborationIdentitySettings,
  readCustomSplitLayouts,
  readLayoutSettings,
  readLocalCoeditingSettings,
  readPreviewPerformanceSettings,
  readTutorialProgressSettings,
  readPreviewWindowSettings,
  readTimelineInteractionSettings,
  readTimelineGridSettings,
  readViewSettings,
  DEFAULT_COLLABORATION_IDENTITY_SETTINGS,
  DEFAULT_TIMELINE_INTERACTION_SETTINGS,
  normalizeTimelineHeatmapViewSettings,
  saveCustomSplitLayouts,
  saveLayoutSettings,
  savePreviewPerformanceSettings,
  saveTutorialProgressSettings,
  savePreviewWindowSettings,
  saveTimelineInteractionSettings,
  saveTimelineGridSettings,
  saveViewSettings,
  type PreviewWindowSettings,
  type CollaborationIdentitySettings,
  type TimelineInteractionSettings,
  type TimelineHeatmapViewSettings
} from '../settings/appSettings';
import { collaborationController } from '../collaboration/local-network';
import { applyLocalCoeditingSettings } from '../collaboration/settings';
import { TutorialOverlay } from '../tutorial/TutorialOverlay';
import {
  DEFAULT_TUTORIAL_SIGNALS,
  advanceTutorialProgress,
  normalizeTutorialProgressSettings,
  shouldShowTutorial,
  skipTutorialProgress,
  type TutorialProgressSettings,
  type TutorialSignals
} from '../tutorial/tutorialState';
import { DEFAULT_PREVIEW_PERFORMANCE_SETTINGS, type PreviewPerformanceSettings, type PreviewQualityMode, type PreviewSkipFrames } from '../lib/preview/preview-performance';
import { createProxyForAsset, type ProxyGenerationOptions } from '../media/proxy';
import { ensureMediaJobRunner } from '../media/media-job-runner';
import { runScheduledProxyIntegrityCheck } from '../media/proxy-integrity';
import type { DuplicateMediaMergeSelection } from '../media/DuplicateMediaDialog';
import type { MediaOrganizerDuplicateSelection } from '../media/MediaOrganizerDialog';
import { useMediaJobStore } from '../media/media-job-store';
import { relinkMissingMediaInDirectory, relinkSingleMedia } from '../media/relink';
import { useBackgroundMediaJobs } from '../media/useBackgroundMediaJobs';
import { analyzeClipContentLocally, exportClipContentAnalysisJson } from '../media/contentAnalysis';
import type { ContentAnalysisTarget } from '../media/ContentAnalysisDialog';
import { loadSharedLibrary, type SharedLibraryResource } from '../shared-library/sharedLibrary';
import { commandManager, projectAccessor, timelineAccessor } from '../store/commandManager';
import { useCollaborationStore } from '../store/collaborationStore';
import { useDemucsSettingsStore } from '../store/demucsSettingsStore';
import { selectClipById, useEditorStore } from '../store/editorStore';
import { useProxySettingsStore } from '../store/proxySettingsStore';
import { useRecordingSettingsStore } from '../store/recordingSettingsStore';
import { useEditorUIStore } from '../store/editorUIStore';
import type { VideoStitchWizardSettings } from '../video-stitching/VideoStitchWizardDialog';

const AudioMixer = lazy(() => import('./AudioMixer/AudioMixer').then((module) => ({ default: module.AudioMixer })));
const Inspector = lazy(() => import('./Inspector/Inspector').then((module) => ({ default: module.Inspector })));
const PreviewCanvas = lazy(() => import('./PreviewCanvas/PreviewCanvas').then((module) => ({ default: module.PreviewCanvas })));
const SmartRoughCutPanel = lazy(() => import('./SmartRoughCut/SmartRoughCutPanel').then((module) => ({ default: module.SmartRoughCutPanel })));
const AIRoughCutPanel = lazy(() => import('./AIRoughCut/AIRoughCutPanel').then((module) => ({ default: module.AIRoughCutPanel })));
const DirectorModePanel = lazy(() => import('./DirectorMode/DirectorModePanel').then((module) => ({ default: module.DirectorModePanel })));
const MusicMatchPanel = lazy(() => import('./MusicMatch/MusicMatchPanel').then((module) => ({ default: module.MusicMatchPanel })));
const HighlightReelPanel = lazy(() => import('./HighlightReel/HighlightReelPanel').then((module) => ({ default: module.HighlightReelPanel })));
const ContextualTranslationPanel = lazy(() => import('./ContextualTranslation/ContextualTranslationPanel').then((module) => ({ default: module.ContextualTranslationPanel })));
const AIChatEditorPanel = lazy(() => import('./AIChatEditor/AIChatEditorPanel').then((module) => ({ default: module.AIChatEditorPanel })));
const AIVideoSummaryPanel = lazy(() => import('./AIVideoSummary/AIVideoSummaryPanel').then((module) => ({ default: module.AIVideoSummaryPanel })));
const AINarrationPanel = lazy(() => import('./AINarration/AINarrationPanel').then((module) => ({ default: module.AINarrationPanel })));
const HistoryPanel = lazy(() => import('./History/HistoryPanel').then((module) => ({ default: module.HistoryPanel })));
const ProjectDocumentationPanel = lazy(() => import('./ProjectDocumentationPanel').then((module) => ({ default: module.ProjectDocumentationPanel })));
const ExportDialog = lazy(() => import('../export/ExportDialog').then((module) => ({ default: module.ExportDialog })));
const SettingsDialog = lazy(() => import('../settings/SettingsDialog').then((module) => ({ default: module.SettingsDialog })));
const MacroHistoryDialog = lazy(() => import('../macros/MacroHistoryDialog').then((module) => ({ default: module.MacroHistoryDialog })));
const TimelineExportDialog = lazy(() => import('../timeline-export/TimelineExportDialog').then((module) => ({ default: module.TimelineExportDialog })));
const ProfessionalNleExportDialog = lazy(() => import('../professional-nle/ProfessionalNleExportDialog').then((module) => ({ default: module.ProfessionalNleExportDialog })));
const LutEditorDialog = lazy(() => import('../lut-editor/LutEditorDialog').then((module) => ({ default: module.LutEditorDialog })));
const ColorNodeEditorDialog = lazy(() => import('../color-node-editor/ColorNodeEditorDialog').then((module) => ({ default: module.ColorNodeEditorDialog })));
const ColorAnalysisDialog = lazy(() => import('../color-analysis/ColorAnalysisDialog').then((module) => ({ default: module.ColorAnalysisDialog })));
const BatchTranscodeDialog = lazy(() => import('../media/BatchTranscodeDialog').then((module) => ({ default: module.BatchTranscodeDialog })));
const BatchWatermarkDialog = lazy(() => import('../media/BatchWatermarkDialog').then((module) => ({ default: module.BatchWatermarkDialog })));
const BatchProjectProcessingDialog = lazy(() => import('../projectBatch/BatchProjectProcessingDialog').then((module) => ({ default: module.BatchProjectProcessingDialog })));
const GifExportDialog = lazy(() => import('../media/GifExportDialog'));
const AudioSpectrumDialog = lazy(() => import('../media/AudioSpectrumDialog'));
const MediaPrecheckPanel = lazy(() => import('../media/MediaPrecheckPanel').then((module) => ({ default: module.MediaPrecheckPanel })));
const VideoStitchWizardDialog = lazy(() => import('../video-stitching/VideoStitchWizardDialog').then((module) => ({ default: module.VideoStitchWizardDialog })));
const SyncComparePanel = lazy(() => import('../sync-compare/SyncComparePanel').then((module) => ({ default: module.SyncComparePanel })));
const SceneReorderDialog = lazy(() => import('../scene-reorder/SceneReorderDialog').then((module) => ({ default: module.SceneReorderDialog })));
const StyleTransferDialog = lazy(() => import('../style-transfer/StyleTransferDialog'));
const CollaborationNotesPanel = lazy(() => import('../collaboration/CollaborationNotesPanel'));
const OperationReplayDialog = lazy(() => import('../operation-recording/OperationReplayDialog'));
const SpeakerDiarizationDialog = lazy(() => import('../speaker-diarization/SpeakerDiarizationDialog'));
const ComplexityScorePanel = lazy(() => import('../complexity/ComplexityScorePanel').then((module) => ({ default: module.ComplexityScorePanel })));
const SmartRecommendationsDialog = lazy(() => import('../smart-recommendations/SmartRecommendationsDialog'));
const ContentAnalysisDialog = lazy(() => import('../media/ContentAnalysisDialog').then((module) => ({ default: module.ContentAnalysisDialog })));
const RhythmAnalysisDialog = lazy(() => import('../analysis/RhythmAnalysisDialog').then((module) => ({ default: module.RhythmAnalysisDialog })));
const ProfilerDialog = lazy(() => import('../profiler/ProfilerDialog').then((module) => ({ default: module.ProfilerDialog })));
const TimelineSearchPanel = lazy(() => import('../timeline-search/TimelineSearchPanel').then((module) => ({ default: module.TimelineSearchPanel })));
const SnapshotNameDialog = lazy(() => import('../project-snapshots/SnapshotNameDialog').then((module) => ({ default: module.SnapshotNameDialog })));
const SnapshotHistoryDialog = lazy(() => import('../project-snapshots/SnapshotHistoryDialog').then((module) => ({ default: module.SnapshotHistoryDialog })));
const SnapshotVersionCompareDialog = lazy(() => import('../project-snapshots/SnapshotVersionCompareDialog').then((module) => ({ default: module.SnapshotVersionCompareDialog })));
const TimelineCompareDialog = lazy(() => import('../timeline-compare/TimelineCompareDialog').then((module) => ({ default: module.TimelineCompareDialog })));
const ReleaseWorkflowDialog = lazy(() => import('../release/ReleaseWorkflowDialog').then((module) => ({ default: module.ReleaseWorkflowDialog })));
const ThumbnailGeneratorDialog = lazy(() => import('../thumbnail/ThumbnailGeneratorDialog').then((module) => ({ default: module.ThumbnailGeneratorDialog })));
const ErrorKnowledgeDialog = lazy(() => import('../export-error-knowledge/ErrorKnowledgeDialog').then((module) => ({ default: module.ErrorKnowledgeDialog })));
const SequenceCompareDialog = lazy(() => import('../sequence-compare/SequenceCompareDialog').then((module) => ({ default: module.SequenceCompareDialog })));
const SubtitleSyncPanel = lazy(() => import('../subtitle-sync-monitor/SubtitleSyncPanel').then((module) => ({ default: module.SubtitleSyncPanel })));
const ProxyBatchVerifyDialog = lazy(() => import('../proxy-batch-verify/ProxyBatchVerifyDialog').then((module) => ({ default: module.ProxyBatchVerifyDialog })));

const PerformanceMonitorPanel = lazy(() => import('./PerformanceMonitorPanel').then((module) => ({ default: module.PerformanceMonitorPanel })));
const FormatConverterDialog = lazy(() => import('./FormatConverterDialog').then((module) => ({ default: module.FormatConverterDialog })));
import type { DroppedFile } from './FormatConverterDialog';
const EmotionAnalysisPanel = lazy(() => import('./EmotionAnalysisPanel').then((module) => ({ default: module.EmotionAnalysisPanel })));
const ExportHistoryClassifierPanel = lazy(() => import('./ExportHistoryClassifierPanel').then((module) => ({ default: module.ExportHistoryClassifierPanel })));
const AutoAudioSyncDialog = lazy(() => import('../audio-sync/AutoAudioSyncDialog').then((module) => ({ default: module.AutoAudioSyncDialog })));
const DuplicateMediaDialog = lazy(() => import('../media/DuplicateMediaDialog').then((module) => ({ default: module.DuplicateMediaDialog })));
const MediaOrganizerDialog = lazy(() => import('../media/MediaOrganizerDialog').then((module) => ({ default: module.MediaOrganizerDialog })));
const ProjectHealthDialog = lazy(() => import('../project-health/ProjectHealthDialog').then((module) => ({ default: module.ProjectHealthDialog })));
const MediaHealthDashboardDialog = lazy(() => import('../media/MediaHealthDashboardDialog').then((module) => ({ default: module.MediaHealthDashboardDialog })));
const ProjectTemplateDialog = lazy(() => import('../project-templates/ProjectTemplateDialog').then((module) => ({ default: module.ProjectTemplateDialog })));
const TimelineTemplateDialog = lazy(() => import('../timeline-templates/TimelineTemplateDialog').then((module) => ({ default: module.TimelineTemplateDialog })));
const MediaVersionComparePanel = lazy(() => import('./MediaVersionComparePanel').then((module) => ({ default: module.MediaVersionComparePanel })));
const ProjectEncryptionSaveDialog = lazy(() => import('./dialogs/ProjectEncryptionSaveDialog').then((module) => ({ default: module.ProjectEncryptionSaveDialog })));
const ProjectPasswordDialog = lazy(() => import('./dialogs/ProjectPasswordDialog').then((module) => ({ default: module.ProjectPasswordDialog })));
const AutosaveRecoveryDialog = lazy(() => import('./dialogs/AutosaveRecoveryDialog').then((module) => ({ default: module.AutosaveRecoveryDialog })));
const ExportQueueRecoveryDialog = lazy(() => import('./dialogs/ExportQueueRecoveryDialog').then((module) => ({ default: module.ExportQueueRecoveryDialog })));
const ArchiveProgressDialog = lazy(() => import('./dialogs/ArchiveProgressDialog').then((module) => ({ default: module.ArchiveProgressDialog })));
const PasteKeyframeDialog = lazy(() => import('./dialogs/PasteKeyframeDialog').then((module) => ({ default: module.PasteKeyframeDialog })));
const SharePackageProgressDialog = lazy(() => import('./dialogs/SharePackageProgressDialog').then((module) => ({ default: module.SharePackageProgressDialog })));
const StoryboardView = lazy(() => import('./Storyboard/StoryboardView').then((module) => ({ default: module.StoryboardView })));
const CharacterTimelinePanel = lazy(() => import('./Timeline/CharacterTimelinePanel').then((module) => ({ default: module.CharacterTimelinePanel })));
const PreflightChecklistPanel = lazy(() => import('./Export/PreflightChecklistPanel').then((module) => ({ default: module.PreflightChecklistPanel })));
const DubbingAdaptationPanel = lazy(() => import('./Export/DubbingAdaptationPanel').then((module) => ({ default: module.DubbingAdaptationPanel })));

import { PanelLoading } from './PanelLoading';
import { CollapsedPanelRail } from './CollapsedPanelRail';
import {
  getSubtitleDataImportTargetTrackId,
  findTimelineClipForMediaSourceTime,
  isPiPVisualClip,
  isSceneReorderClip,
  getClipSourceDimensions,
  collectClipKeyframeRefs,
} from '../lib/timeline-clip-helpers';
import {
  isContentAnalysisClip,
  collectContentAnalysisTargets,
  findSpeakerDiarizationTarget,
  collectAutoAudioSyncTargets,
  collectSpeakerDiarizationDialogueIntervals,
  findContentAnalysisTarget,
  summarizeContentAnalysisByMedia,
} from '../lib/content-analysis-helpers';
import {
  readViewportSize,
  isEditableKeyboardEventTarget,
  joinLocalPath,
  getWorkspaceLayoutDisplayName,
  moveAutomationMediaToGroup,
} from '../lib/ui-helpers';
import {
  type ProfilerRecordingBuffer,
  sampleProfilerExportSpeed,
  createProfilerTraceEventsForFrame,
  readBrowserJsHeapBytes,
  estimateUndoHistoryBytes,
} from '../lib/profiler-helpers';
import type { ProjectPasswordRequest } from './dialogs/ProjectPasswordDialog';
import {
  mergeProjectSpeakers,
  sanitizeFileName,
  projectUsesMediaOnTimeline,
} from '@open-factory/editor-core';

export function EditorShell() {
  const project = useEditorStore((state) => state.project);
  const selectedClipId = useEditorStore((state) => state.selectedClipId);
  const selectedClipIds = useEditorStore((state) => state.selectedClipIds);
  const selectedKeyframe = useEditorStore((state) => state.selectedKeyframe);
  const selectedKeyframes = useEditorStore((state) => state.selectedKeyframes);
  const playheadTime = useEditorStore((state) => state.playheadTime);
  const isPlaying = useEditorStore((state) => state.isPlaying);
  const inPoint = useEditorStore((state) => state.inPoint);
  const outPoint = useEditorStore((state) => state.outPoint);
  const dirty = useEditorStore((state) => state.dirty);
  const projectPath = useEditorStore((state) => state.projectPath);
  const setProject = useEditorStore((state) => state.setProject);
  const setMedia = useEditorStore((state) => state.setMedia);
  const addMedia = useEditorStore((state) => state.addMedia);
  const setSelectedKeyframes = useEditorStore((state) => state.setSelectedKeyframes);
  const proxySettings = useProxySettingsStore((state) => state.settings);
  const demucsExecutablePath = useDemucsSettingsStore((state) => state.executablePath);
  const recordingSettings = useRecordingSettingsStore((state) => state.settings);
  const setMediaMetadata = useEditorStore((state) => state.setMediaMetadata);
  const setDirty = useEditorStore((state) => state.setDirty);
  const setProjectPath = useEditorStore((state) => state.setProjectPath);
  const setSelectedClipId = useEditorStore((state) => state.setSelectedClipId);
  const setSelectedClipIds = useEditorStore((state) => state.setSelectedClipIds);
  const clearSelectedClipIds = useEditorStore((state) => state.clearSelectedClipIds);
  const setPlayheadTime = useEditorStore((state) => state.setPlayheadTime);
  const setIsPlaying = useEditorStore((state) => state.setIsPlaying);
  const setPlaybackRate = useEditorStore((state) => state.setPlaybackRate);
  const setInPoint = useEditorStore((state) => state.setInPoint);
  const setOutPoint = useEditorStore((state) => state.setOutPoint);
  const collaborationEnabled = useCollaborationStore((state) => state.enabled);
  const batchTranscodeOpen = useEditorUIStore((s) => s.batchTranscodeOpen);
  const setBatchTranscodeOpen = useEditorUIStore((s) => s.setBatchTranscodeOpen);
  const batchWatermarkOpen = useEditorUIStore((s) => s.batchWatermarkOpen);
  const setBatchWatermarkOpen = useEditorUIStore((s) => s.setBatchWatermarkOpen);
  const batchProjectProcessingOpen = useEditorUIStore((s) => s.batchProjectProcessingOpen);
  const setBatchProjectProcessingOpen = useEditorUIStore((s) => s.setBatchProjectProcessingOpen);
  const [batchTranscodeInitialPaths, setBatchTranscodeInitialPaths] = useState<string[]>([]);
  const [thumbnailGeneratorAssetIds, setThumbnailGeneratorAssetIds] = useState<string[]>();
  const lutEditorOpen = useEditorUIStore((s) => s.lutEditorOpen);
  const setLutEditorOpen = useEditorUIStore((s) => s.setLutEditorOpen);
  const colorNodeEditorOpen = useEditorUIStore((s) => s.colorNodeEditorOpen);
  const setColorNodeEditorOpen = useEditorUIStore((s) => s.setColorNodeEditorOpen);
  const colorAnalysisOpen = useEditorUIStore((s) => s.colorAnalysisOpen);
  const setColorAnalysisOpen = useEditorUIStore((s) => s.setColorAnalysisOpen);
  const [colorAnalysisBusy, setColorAnalysisBusy] = useState(false);
  const [colorAnalysisResults, setColorAnalysisResults] = useState<TimelineColorAnalysisResult[]>([]);
  const [colorAnalysisJumps, setColorAnalysisJumps] = useState<SceneColorDifference[]>([]);
  const [colorHeatmapPoints, setColorHeatmapPoints] = useState<TimelineColorHeatmapPoint[]>([]);
  const [colorAnalysisSamples, setColorAnalysisSamples] = useState<ColorAnalysisClipSample[]>([]);
  const professionalNleExportOpen = useEditorUIStore((s) => s.professionalNleExportOpen);
  const setProfessionalNleExportOpen = useEditorUIStore((s) => s.setProfessionalNleExportOpen);
  const [gifExportAsset, setGifExportAsset] = useState<MediaAsset>();
  const [spectrumAsset, setSpectrumAsset] = useState<MediaAsset>();
  const [mediaVersionCompare, setMediaVersionCompare] = useState<MediaVersionCompareRequest>();
  const mediaPrecheckOpen = useEditorUIStore((s) => s.mediaPrecheckOpen);
  const setMediaPrecheckOpen = useEditorUIStore((s) => s.setMediaPrecheckOpen);
  const videoStitchWizardOpen = useEditorUIStore((s) => s.videoStitchWizardOpen);
  const setVideoStitchWizardOpen = useEditorUIStore((s) => s.setVideoStitchWizardOpen);
  const syncCompareOpen = useEditorUIStore((s) => s.syncCompareOpen);
  const setSyncCompareOpen = useEditorUIStore((s) => s.setSyncCompareOpen);
  const sceneReorderOpen = useEditorUIStore((s) => s.sceneReorderOpen);
  const setSceneReorderOpen = useEditorUIStore((s) => s.setSceneReorderOpen);
  const styleTransferOpen = useEditorUIStore((s) => s.styleTransferOpen);
  const setStyleTransferOpen = useEditorUIStore((s) => s.setStyleTransferOpen);
  const collaborationNotesOpen = useEditorUIStore((s) => s.collaborationNotesOpen);
  const setCollaborationNotesOpen = useEditorUIStore((s) => s.setCollaborationNotesOpen);
  const operationRecordingOpen = useEditorUIStore((s) => s.operationRecordingOpen);
  const setOperationRecordingOpen = useEditorUIStore((s) => s.setOperationRecordingOpen);
  const [operationRecording, setOperationRecording] = useState<OperationRecordingFile>();
  const [operationRecordingActive, setOperationRecordingActive] = useState(false);
  const [operationRecordingStep, setOperationRecordingStep] = useState(-1);
  const [operationReplaySpeed, setOperationReplaySpeed] = useState<OperationReplaySpeed>(1);
  const [operationReplayRunning, setOperationReplayRunning] = useState(false);
  const complexityScoreOpen = useEditorUIStore((s) => s.complexityScoreOpen);
  const setComplexityScoreOpen = useEditorUIStore((s) => s.setComplexityScoreOpen);
  const smartRecommendationsOpen = useEditorUIStore((s) => s.smartRecommendationsOpen);
  const setSmartRecommendationsOpen = useEditorUIStore((s) => s.setSmartRecommendationsOpen);
  const contentAnalysisOpen = useEditorUIStore((s) => s.contentAnalysisOpen);
  const setContentAnalysisOpen = useEditorUIStore((s) => s.setContentAnalysisOpen);
  const profilerOpen = useEditorUIStore((s) => s.profilerOpen);
  const setProfilerOpen = useEditorUIStore((s) => s.setProfilerOpen);
  const [profilerRecording, setProfilerRecording] = useState(false);
  const [profilerElapsedMs, setProfilerElapsedMs] = useState(0);
  const [profilerReport, setProfilerReport] = useState<PerformanceProfilerReport>();
  const rhythmAnalysisOpen = useEditorUIStore((s) => s.rhythmAnalysisOpen);
  const setRhythmAnalysisOpen = useEditorUIStore((s) => s.setRhythmAnalysisOpen);
  const [contentAnalysisRunningClipId, setContentAnalysisRunningClipId] = useState<string>();
  const timelineSearchOpen = useEditorUIStore((s) => s.timelineSearchOpen);
  const setTimelineSearchOpen = useEditorUIStore((s) => s.setTimelineSearchOpen);
  const snapshotNameOpen = useEditorUIStore((s) => s.snapshotNameOpen);
  const setSnapshotNameOpen = useEditorUIStore((s) => s.setSnapshotNameOpen);
  const snapshotHistoryOpen = useEditorUIStore((s) => s.snapshotHistoryOpen);
  const setSnapshotHistoryOpen = useEditorUIStore((s) => s.setSnapshotHistoryOpen);
  const snapshotCompareOpen = useEditorUIStore((s) => s.snapshotCompareOpen);
  const setSnapshotCompareOpen = useEditorUIStore((s) => s.setSnapshotCompareOpen);
  const timelineCompareOpen = useEditorUIStore((s) => s.timelineCompareOpen);
  const setTimelineCompareOpen = useEditorUIStore((s) => s.setTimelineCompareOpen);
  const releaseWorkflowOpen = useEditorUIStore((s) => s.releaseWorkflowOpen);
  const setReleaseWorkflowOpen = useEditorUIStore((s) => s.setReleaseWorkflowOpen);
  const projectEncryptionSaveOpen = useEditorUIStore((s) => s.projectEncryptionSaveOpen);
  const setProjectEncryptionSaveOpen = useEditorUIStore((s) => s.setProjectEncryptionSaveOpen);
  const [projectPasswordRequest, setProjectPasswordRequest] = useState<ProjectPasswordRequest | undefined>();
  const projectTemplateOpen = useEditorUIStore((s) => s.projectTemplateOpen);
  const setProjectTemplateOpen = useEditorUIStore((s) => s.setProjectTemplateOpen);
  const [timelineTemplateMode, setTimelineTemplateMode] = useState<'save' | 'new'>();
  const [templateExportPreset, setTemplateExportPreset] = useState<ExportPreset>();
  const settingsOpen = useEditorUIStore((s) => s.settingsOpen);
  const setSettingsOpen = useEditorUIStore((s) => s.setSettingsOpen);
  const [beatSensitivity, setBeatSensitivity] = useState<BeatSensitivity>('medium');
  const beatSyncOpen = useEditorUIStore((s) => s.beatSyncOpen);
  const setBeatSyncOpen = useEditorUIStore((s) => s.setBeatSyncOpen);
  const [beatSyncSpeedEnabled, setBeatSyncSpeedEnabled] = useState(false);
  const [beatSyncManualBpm, setBeatSyncManualBpm] = useState('');
  const [sceneDetectionRequestId, setSceneDetectionRequestId] = useState(0);
  const smartRoughCutOpen = useEditorUIStore((s) => s.smartRoughCutOpen);
  const setSmartRoughCutOpen = useEditorUIStore((s) => s.setSmartRoughCutOpen);
  const aiRoughCutOpen = useEditorUIStore((s) => s.aiRoughCutOpen);
  const setAiRoughCutOpen = useEditorUIStore((s) => s.setAiRoughCutOpen);
  const directorModeOpen = useEditorUIStore((s) => s.directorModeOpen);
  const setDirectorModeOpen = useEditorUIStore((s) => s.setDirectorModeOpen);
  const musicMatchOpen = useEditorUIStore((s) => s.musicMatchOpen);
  const setMusicMatchOpen = useEditorUIStore((s) => s.setMusicMatchOpen);
  const highlightReelOpen = useEditorUIStore((s) => s.highlightReelOpen);
  const setHighlightReelOpen = useEditorUIStore((s) => s.setHighlightReelOpen);
  const contextualTranslationOpen = useEditorUIStore((s) => s.contextualTranslationOpen);
  const setContextualTranslationOpen = useEditorUIStore((s) => s.setContextualTranslationOpen);
  const aiChatEditorOpen = useEditorUIStore((s) => s.aiChatEditorOpen);
  const setAiChatEditorOpen = useEditorUIStore((s) => s.setAiChatEditorOpen);
  const videoSummaryOpen = useEditorUIStore((s) => s.videoSummaryOpen);
  const setVideoSummaryOpen = useEditorUIStore((s) => s.setVideoSummaryOpen);
  const narrationOpen = useEditorUIStore((s) => s.narrationOpen);
  const setNarrationOpen = useEditorUIStore((s) => s.setNarrationOpen);
  const historyPanelOpen = useEditorUIStore((s) => s.historyPanelOpen);
  const setHistoryPanelOpen = useEditorUIStore((s) => s.setHistoryPanelOpen);
  const projectDocumentationOpen = useEditorUIStore((s) => s.projectDocumentationOpen);
  const setProjectDocumentationOpen = useEditorUIStore((s) => s.setProjectDocumentationOpen);
  const storyboardOpen = useEditorUIStore((s) => s.storyboardOpen);
  const setStoryboardOpen = useEditorUIStore((s) => s.setStoryboardOpen);
  const macroHistoryOpen = useEditorUIStore((s) => s.macroHistoryOpen);
  const setMacroHistoryOpen = useEditorUIStore((s) => s.setMacroHistoryOpen);
  const projectHealthOpen = useEditorUIStore((s) => s.projectHealthOpen);
  const setProjectHealthOpen = useEditorUIStore((s) => s.setProjectHealthOpen);
  const mediaHealthDashboardOpen = useEditorUIStore((s) => s.mediaHealthDashboardOpen);
  const setMediaHealthDashboardOpen = useEditorUIStore((s) => s.setMediaHealthDashboardOpen);
  const reviewMode = useEditorUIStore((s) => s.reviewMode);
  const setReviewMode = useEditorUIStore((s) => s.setReviewMode);
  const [projectHealthReport, setProjectHealthReport] = useState<ProjectHealthReport>();
  const [projectHealthRepairReport, setProjectHealthRepairReport] = useState<ProjectHealthRepairReport>();
  const [projectHealthScanning, setProjectHealthScanning] = useState(false);
  const [mediaHealthDashboard, setMediaHealthDashboard] = useState<MediaHealthDashboard>();
  const [mediaHealthScanning, setMediaHealthScanning] = useState(false);
  const [mediaHealthAutoShowEnabled, setMediaHealthAutoShowEnabled] = useState(() => readMediaHealthAutoShowEnabled());
  const mediaHealthAutoShowCheckedRef = useRef(false);
  const [duplicateMediaGroups, setDuplicateMediaGroups] = useState<DuplicateMediaGroup[]>([]);
  const duplicateMediaOpen = useEditorUIStore((s) => s.duplicateMediaOpen);
  const setDuplicateMediaOpen = useEditorUIStore((s) => s.setDuplicateMediaOpen);
  const mediaOrganizerOpen = useEditorUIStore((s) => s.mediaOrganizerOpen);
  const setMediaOrganizerOpen = useEditorUIStore((s) => s.setMediaOrganizerOpen);
  const [mediaOrganizerGroups, setMediaOrganizerGroups] = useState<SmartDuplicateGroup[]>([]);
  const [mediaOrganizerCleanup, setMediaOrganizerCleanup] = useState<MediaCleanupReport>();
  const [mediaOrganizerScanning, setMediaOrganizerScanning] = useState(false);
  const [shortcutBindings, setShortcutBindings] = useState<TimelineShortcutBindings>({});
  const shortcutCheatsheetOpen = useEditorUIStore((s) => s.shortcutCheatsheetOpen);
  const setShortcutCheatsheetOpen = useEditorUIStore((s) => s.setShortcutCheatsheetOpen);
  const pasteKeyframeDialogOpen = useEditorUIStore((s) => s.pasteKeyframeDialogOpen);
  const setPasteKeyframeDialogOpen = useEditorUIStore((s) => s.setPasteKeyframeDialogOpen);
  const [pasteKeyframeDialogGroups, setPasteKeyframeDialogGroups] = useState<ClipboardKeyframeGroup[]>([]);
  const [macros, setMacros] = useState<ClipMacro[]>([]);
  const [macroHistory, setMacroHistory] = useState<MacroHistoryEntry[]>([]);
  const [sharedLibraryResources, setSharedLibraryResources] = useState<SharedLibraryResource[]>([]);
  const [macroRecordingActive, setMacroRecordingActive] = useState(false);
  const [macroRecordingStepCount, setMacroRecordingStepCount] = useState(0);
  const [autosaveIntervalSeconds, setAutosaveIntervalSeconds] = useState(() => readAutosaveIntervalSeconds());
  const [recoveryCandidate, setRecoveryCandidate] = useState<AutosaveRecoveryCandidate>();
  const [archiveProgress, setArchiveProgress] = useState<ArchiveProgress>();
  const layoutSettings = useEditorUIStore((s) => s.layoutSettings);
  const setLayoutSettings = useEditorUIStore((s) => s.setLayoutSettings);
  const [safeFrameGuides, setSafeFrameGuides] = useState(false);
  const [thumbnailTrackVisible, setThumbnailTrackVisible] = useState(true);
  const [timelineMinimapVisible, setTimelineMinimapVisible] = useState(true);
  const [timelineHeatmap, setTimelineHeatmap] = useState<TimelineHeatmapViewSettings>(() => normalizeTimelineHeatmapViewSettings(undefined));
  const [previewPerformance, setPreviewPerformance] = useState<PreviewPerformanceSettings>(DEFAULT_PREVIEW_PERFORMANCE_SETTINGS);
  const previewWindowOpen = useEditorUIStore((s) => s.previewWindowOpen);
  const setPreviewWindowOpen = useEditorUIStore((s) => s.setPreviewWindowOpen);
  const [previewWindowResolutionScale, setPreviewWindowResolutionScale] = useState<PreviewWindowSettings['resolutionScale']>(1);
  const [timelineGridSettings, setTimelineGridSettings] = useState<TimelineGridSettings>(DEFAULT_TIMELINE_GRID_SETTINGS);
  const [timelineInteractionSettings, setTimelineInteractionSettings] = useState<TimelineInteractionSettings>(DEFAULT_TIMELINE_INTERACTION_SETTINGS);
  const [collaborationIdentity, setCollaborationIdentity] = useState<CollaborationIdentitySettings>(() => ({ ...DEFAULT_COLLABORATION_IDENTITY_SETTINGS }));
  const [tutorialProgress, setTutorialProgress] = useState<TutorialProgressSettings | undefined>();
  const [tutorialCelebrationVisible, setTutorialCelebrationVisible] = useState(false);
  const [tutorialSignals, setTutorialSignals] = useState<TutorialSignals>(DEFAULT_TUTORIAL_SIGNALS);
  const [pipLayoutPosition, setPiPLayoutPosition] = useState<PiPLayoutPosition>('bottom-right');
  const [customSplitLayouts, setCustomSplitLayouts] = useState<SplitLayoutDefinition[]>([]);
  const viewportSize = useEditorUIStore((s) => s.viewportSize);
  const setViewportSize = useEditorUIStore((s) => s.setViewportSize);
  const [lastBackupAt, setLastBackupAt] = useState<string>();
  const [demucsAvailability, setDemucsAvailability] = useState<DemucsAvailability>({ ready: false, error: zhCN.demucs.notConfigured });
  const [audioSeparationClipId, setAudioSeparationClipId] = useState<string>();
  const [audioSeparationProgress, setAudioSeparationProgress] = useState<number>();
  const [speakerDiarizationRunning, setSpeakerDiarizationRunning] = useState(false);
  const [speakerDiarizationResult, setSpeakerDiarizationResult] = useState<{
    sourceName: string;
    segments: SpeakerDiarizationSegment[];
    tracks: Track[];
  }>();
  const [autoAudioSyncOpen, setAutoAudioSyncOpen] = useState(false);
  const [errorKnowledgeOpen, setErrorKnowledgeOpen] = useState(false);
  const [sequenceCompareOpen, setSequenceCompareOpen] = useState(false);
  const [subtitleSyncOpen, setSubtitleSyncOpen] = useState(false);
  const [proxyVerifyOpen, setProxyVerifyOpen] = useState(false);
  const [formatConverterOpen, setFormatConverterOpen] = useState(false);
  const [emotionAnalysisOpen, setEmotionAnalysisOpen] = useState(false);
  const [exportHistoryClassifierOpen, setExportHistoryClassifierOpen] = useState(false);
  const [formatConverterMockFiles, setFormatConverterMockFiles] = useState<DroppedFile[]>([]);
  const [mockSubtitleClips, setMockSubtitleClips] = useState<SubtitleClip[]>([]);
  const [mockExportHistory, setMockExportHistory] = useState<ExportTaskHistoryEntry[]>([]);

  // E2E: expose stores for test instrumentation
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__PERF_MONITOR_STORE__ = usePerformanceMonitorStore;
      window.__APP_STORE__ = {
        setFormatConverterOpen,
        setEmotionAnalysisOpen,
        setEmotionPanelOpen: setEmotionAnalysisOpen,
        setFormatConverterMockFiles,
        setExportHistoryClassifierOpen,
        setExportHistoryPanelOpen: setExportHistoryClassifierOpen,
        setMockSubtitleClips,
        setMockExportHistory,
        setArchiveProgress,
      };
    }
  }, [setFormatConverterOpen, setEmotionAnalysisOpen, setExportHistoryClassifierOpen, setArchiveProgress]);
  const [autoAudioSyncRunning, setAutoAudioSyncRunning] = useState(false);
  const [autoAudioSyncPrimaryClipId, setAutoAudioSyncPrimaryClipId] = useState<string>();
  const [autoAudioSyncMode, setAutoAudioSyncMode] = useState<AutoAudioSyncApplyMode>('keep-secondary');
  const [autoAudioSyncResults, setAutoAudioSyncResults] = useState<AutoAudioSyncResult[]>([]);
  const [recordingTask, setRecordingTask] = useState<{ taskId: string; source: RecordingSource; outputPath: string; startedAt: number }>();
  const [recordingElapsedSeconds, setRecordingElapsedSeconds] = useState(0);
  const {
    lastExportPath,
    setLastExportPath,
    exportDialogOpen,
    setExportDialogOpen,
    timelineExportDialogOpen,
    setTimelineExportDialogOpen,
    exportQueueRecovery,
    sharePackageProgress,
    sharePackageBusy,
    cancelCurrentExport,
    createCurrentSharePackage,
    exportCurrentFrame,
    restoreExportQueueRecovery,
    discardExportQueueRecovery
  } = useExportQueue(project);
  const macroRecorderRef = useRef<{ active: boolean; replaying: boolean; steps: CommandSnapshot[] }>({ active: false, replaying: false, steps: [] });
  const operationRecorderRef = useRef<{ active: boolean; replaying: boolean; recording?: OperationRecordingFile }>({ active: false, replaying: false });
  const operationReplayTimersRef = useRef<number[]>([]);
  const profilerRecordingRef = useRef<ProfilerRecordingBuffer>();
  const latestProfilerTextureBytesRef = useRef(0);

  const selectedClip = useMemo(() => selectClipById(project, selectedClipId), [project, selectedClipId]);
  const selectedClips = useMemo(() => selectedClipIds.map((id) => selectClipById(project, id)).filter((clip): clip is Clip => Boolean(clip)), [project, selectedClipIds]);
  const selectedClipMedia = useMemo(
    () => (selectedClip && 'mediaId' in selectedClip ? project.media.find((asset) => asset.id === selectedClip.mediaId) : undefined),
    [project.media, selectedClip]
  );
  const allTimelineClips = useMemo(() => project.timeline.tracks.flatMap((track) => track.clips), [project.timeline.tracks]);
  const visualTimelineClipRefs = useMemo(
    () =>
      project.timeline.tracks
        .flatMap((track) =>
          track.clips
            .filter((clip) => clip.type === 'video' || clip.type === 'image')
            .map((clip) => ({
              clip,
              trackId: track.id,
              media: project.media.find((asset) => 'mediaId' in clip && asset.id === clip.mediaId)
            }))
        )
        .filter((item): item is { clip: Extract<Clip, { type: 'video' | 'image' }>; trackId: string; media: MediaAsset } => Boolean(item.media))
        .sort((left, right) => left.clip.start - right.clip.start || left.clip.id.localeCompare(right.clip.id)),
    [project.media, project.timeline.tracks]
  );
  const stopProfilerRecording = useCallback(() => {
    const recording = profilerRecordingRef.current;
    if (!recording) {
      setProfilerRecording(false);
      return;
    }
    try {
      const stoppedAtMs = performance.now();
      setProfilerReport(
        buildPerformanceProfilerReport({
          startedAtMs: recording.startedAtMs,
          stoppedAtMs,
          frames: recording.frames,
          exportSpeed: recording.exportSpeed,
          memory: recording.memory,
          queues: recording.queues,
          traceEvents: recording.traceEvents
        })
      );
      setProfilerElapsedMs(stoppedAtMs - recording.startedAtMs);
    } catch (error) {
      console.warn('Unable to finalize profiler recording', error);
    } finally {
      profilerRecordingRef.current = undefined;
      setProfilerRecording(false);
    }
  }, []);
  const startProfilerRecording = useCallback(() => {
    try {
      const startedAtMs = performance.now();
      profilerRecordingRef.current = {
        startedAtMs,
        frames: [],
        exportSpeed: [],
        memory: [],
        queues: [],
        traceEvents: [],
        exportProgressByTaskId: new Map()
      };
      if (import.meta.env.VITE_E2E === 'true') {
        window.__OPEN_FACTORY_PROFILER_DEBUG__ = { frameCount: 0 };
      }
      latestProfilerTextureBytesRef.current = 0;
      setProfilerReport(undefined);
      setProfilerElapsedMs(0);
      setProfilerRecording(true);
    } catch (error) {
      console.warn('Unable to start profiler recording', error);
      profilerRecordingRef.current = undefined;
      setProfilerRecording(false);
    }
  }, []);
  const handleProfilerFrame = useCallback(
    (sample: ProfilerFrameSample) => {
      const recording = profilerRecordingRef.current;
      if (!recording) {
        return;
      }
      try {
        latestProfilerTextureBytesRef.current = Math.max(0, sample.textureBytes);
        recording.frames.push(sample);
        recording.traceEvents.push(...createProfilerTraceEventsForFrame(sample));
        if (import.meta.env.VITE_E2E === 'true') {
          window.__OPEN_FACTORY_PROFILER_DEBUG__ = {
            frameCount: recording.frames.length,
            lastFrameIndex: sample.frameIndex
          };
        }
      } catch (error) {
        console.warn('Unable to record profiler frame', error);
        stopProfilerRecording();
      }
    },
    [stopProfilerRecording]
  );
  const exportProfilerReportJson = useCallback(async () => {
    if (!profilerReport) {
      return;
    }
    try {
      const fileName = `${sanitizeFileName(project.name || 'open-factory')}-performance-report.json`;
      const outputPath = await bridgeSaveFileDialog(fileName, [{ name: zhCN.profiler.exportDialogName, extensions: ['json'] }]);
      if (!outputPath) {
        return;
      }
      await bridgeWriteFile(outputPath, `${JSON.stringify(profilerReport, null, 2)}\n`);
      showToast({ kind: 'success', title: zhCN.profiler.exportedTitle, message: outputPath });
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.profiler.exportFailedTitle, message: error instanceof Error ? error.message : zhCN.common.unavailable });
    }
  }, [profilerReport, project.name]);
  const selectedClipLocked = useMemo(
    () => Boolean(selectedClip && project.timeline.tracks.find((track) => track.id === selectedClip.trackId)?.locked),
    [project.timeline.tracks, selectedClip]
  );

  useEffect(() => {
    if (!profilerRecording) {
      return undefined;
    }
    let disposed = false;
    const sample = async () => {
      const recording = profilerRecordingRef.current;
      if (!recording || disposed) {
        return;
      }
      const now = performance.now();
      setProfilerElapsedMs(now - recording.startedAtMs);
      try {
        const exportTasks = useExportQueueStore.getState().tasks;
        const mediaJobs = useMediaJobStore.getState().jobs;
        const queueSample: ProfilerQueueSample = {
          timestampMs: now,
          exportPending: exportTasks.filter((task) => task.status === 'pending' || task.status === 'scheduled' || task.status === 'interrupted').length,
          exportRunning: exportTasks.filter((task) => task.status === 'running').length,
          mediaPending: mediaJobs.filter((job) => job.status === 'pending').length,
          mediaRunning: mediaJobs.filter((job) => job.status === 'running').length
        };
        recording.queues.push(queueSample);
        sampleProfilerExportSpeed(recording, exportTasks, now, project.settings.fps, queueSample.exportPending + queueSample.exportRunning);
        const proxyCacheBytes = await getCacheSize().catch(() => 0);
        if (disposed || !profilerRecordingRef.current) {
          return;
        }
        profilerRecordingRef.current.memory = appendProfilerMemorySample(profilerRecordingRef.current.memory, {
          timestampMs: now,
          jsHeapBytes: readBrowserJsHeapBytes(),
          webglTextureBytes: latestProfilerTextureBytesRef.current,
          proxyCacheBytes,
          undoHistoryBytes: estimateUndoHistoryBytes(useEditorStore.getState().historyMeta)
        });
      } catch (error) {
        console.warn('Unable to sample profiler metrics', error);
        stopProfilerRecording();
      }
    };
    void sample();
    const timer = window.setInterval(() => void sample(), 1000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [profilerRecording, project.settings.fps, stopProfilerRecording]);

  const canCreateMulticamSequence = useMemo(() => {
    if (selectedClipIds.length < 2 || selectedClipIds.length > 8) {
      return false;
    }
    const selected = selectedClipIds
      .map((id) => project.timeline.tracks.flatMap((track) => track.clips.map((clip) => ({ clip, track }))).find((item) => item.clip.id === id))
      .filter(Boolean);
    return (
      selected.length === selectedClipIds.length &&
      selected.every((item) => item?.track.type === 'video' && (item.clip.type === 'video' || item.clip.type === 'image'))
    );
  }, [project.timeline.tracks, selectedClipIds]);
  const selectedPiPClips = useMemo(() => {
    if (selectedClipIds.length !== 2) {
      return [];
    }
    type ClipWithTrack = { clip: Clip; track: Project['timeline']['tracks'][number]; trackIndex: number; selectedIndex: number };
    const allClips = project.timeline.tracks.flatMap((track, trackIndex) => track.clips.map((clip) => ({ clip, track, trackIndex })));
    return selectedClipIds
      .map((id, selectedIndex) => {
        const item = allClips.find((candidate) => candidate.clip.id === id);
        return item ? { ...item, selectedIndex } : undefined;
      })
      .filter((item): item is ClipWithTrack => item !== undefined)
      .filter((item) => item.track.type === 'video' && isPiPVisualClip(item.clip))
      .sort((left, right) => left.trackIndex - right.trackIndex || left.selectedIndex - right.selectedIndex);
  }, [project.timeline.tracks, selectedClipIds]);
  const canApplyPiPLayout = selectedPiPClips.length === 2;
  const selectedSplitLayoutClips = useMemo(() => {
    if (selectedClipIds.length < 2 || selectedClipIds.length > 4) {
      return [];
    }
    type ClipWithTrack = { clip: Clip; track: Project['timeline']['tracks'][number]; trackIndex: number; selectedIndex: number };
    const allClips = project.timeline.tracks.flatMap((track, trackIndex) => track.clips.map((clip) => ({ clip, track, trackIndex })));
    return selectedClipIds
      .map((id, selectedIndex) => {
        const item = allClips.find((candidate) => candidate.clip.id === id);
        return item ? { ...item, selectedIndex } : undefined;
      })
      .filter((item): item is ClipWithTrack => item !== undefined)
      .filter((item) => item.track.type === 'video' && isPiPVisualClip(item.clip))
      .sort((left, right) => left.trackIndex - right.trackIndex || left.selectedIndex - right.selectedIndex);
  }, [project.timeline.tracks, selectedClipIds]);
  const canApplySplitLayout = selectedSplitLayoutClips.length >= 2 && selectedSplitLayoutClips.length <= 4;
  const syncCompareClipRefs = useMemo(() => findSyncCompareClipRefs(project.timeline, selectedClipIds), [project.timeline, selectedClipIds]);
  const canOpenSyncCompare = syncCompareClipRefs.length === 2;
  const canOpenSceneDetection = Boolean(selectedClip && selectedClipMedia && selectedClip.type === 'video');
  const canOpenSceneReorder = useMemo(() => selectedClips.filter(isSceneReorderClip).length >= 2, [selectedClips]);
  const contentAnalysisTargets = useMemo(() => collectContentAnalysisTargets(project), [project]);
  const mediaContentAnalysis = useMemo(() => summarizeContentAnalysisByMedia(contentAnalysisTargets), [contentAnalysisTargets]);
  const speakerDiarizationTarget = useMemo(() => findSpeakerDiarizationTarget(project, selectedClipIds.length > 0 ? selectedClipIds : selectedClipId ? [selectedClipId] : []), [project, selectedClipId, selectedClipIds]);
  const autoAudioSyncTargets = useMemo(() => collectAutoAudioSyncTargets(project, selectedClipIds.length > 0 ? selectedClipIds : selectedClipId ? [selectedClipId] : []), [project, selectedClipId, selectedClipIds]);
  const resolvedAutoAudioSyncPrimaryClipId = autoAudioSyncTargets.some((target) => target.clip.id === autoAudioSyncPrimaryClipId) ? autoAudioSyncPrimaryClipId! : (autoAudioSyncTargets[0]?.clip.id ?? '');
  const autoAudioSyncDialogTargets = useMemo(
    () =>
      autoAudioSyncTargets.map((target) => ({
        clipId: target.clip.id,
        clipName: target.clip.name,
        mediaName: target.asset.name,
        trackName: target.track.name,
        start: target.clip.start
      })),
    [autoAudioSyncTargets]
  );
  const canSeparateSelectedAudio = canSeparateAudioForClip(selectedClip, selectedClipMedia, demucsAvailability.ready) && !audioSeparationClipId;
  const canRunSpeakerDiarization = Boolean(speakerDiarizationTarget && !speakerDiarizationRunning);
  const canOpenAutoAudioSync = autoAudioSyncTargets.length >= 2 && autoAudioSyncTargets.length <= 5 && !autoAudioSyncRunning;
  const canDetectBeats = Boolean(
    selectedClip &&
      selectedClipMedia &&
      (selectedClip.type === 'audio' || selectedClip.type === 'video') &&
      (selectedClipMedia.type === 'audio' || selectedClipMedia.hasAudio)
  );
  const selectedClipTimelineBeatTimes = useMemo(() => {
    const times = selectedClips.flatMap((clip) => (clip.beatMarkers ?? []).map((marker) => round(clip.start + marker.time)));
    return Array.from(new Set(times)).sort((left, right) => left - right);
  }, [selectedClips]);
  const beatSyncBeatTimes = useMemo(() => {
    return selectedClipTimelineBeatTimes.length > 0 ? selectedClipTimelineBeatTimes : (project.beatMarkers ?? []).map((marker) => marker.time);
  }, [project.beatMarkers, selectedClipTimelineBeatTimes]);
  const detectedBeatBpm = selectedClip?.detectedBpm ?? estimateBpmFromBeatMarkers(selectedClip?.beatMarkers);
  const canSnapToBeats = selectedClipIds.length > 0 && beatSyncBeatTimes.length > 0;
  const canSplitToBeats = Boolean(selectedClip && beatSyncBeatTimes.length > 0);
  useEffect(() => {
    setBeatSyncManualBpm(detectedBeatBpm ? String(detectedBeatBpm) : '');
  }, [detectedBeatBpm, selectedClip?.id]);
  const timelineHeightPx = clampTimelineHeight(layoutSettings.timelineHeightPx, viewportSize.height);
  const effectivePanels = useMemo(() => getEffectivePanelState(layoutSettings, viewportSize.width), [layoutSettings, viewportSize.width]);
  const reviewVisibility = useMemo(() => getReviewModeShellVisibility(reviewMode), [reviewMode]);
  const workspaceLayouts = useMemo<WorkspaceLayoutDefinition[]>(
    () => [...BUILT_IN_WORKSPACE_LAYOUT_IDS.map((id) => getWorkspaceLayoutById(layoutSettings, id)).filter((layout): layout is WorkspaceLayoutDefinition => Boolean(layout)), ...layoutSettings.customWorkspaceLayouts],
    [layoutSettings]
  );
  const editorGridRows = reviewMode ? 'auto minmax(0,1fr)' : `auto minmax(0,1fr) 6px ${timelineHeightPx}px`;
  const mainGridColumns = reviewMode ? 'minmax(0,1fr)' : `${effectivePanels.leftPanelCollapsed ? 48 : layoutSettings.leftPanelWidthPx}px minmax(0,1fr) ${effectivePanels.rightPanelCollapsed ? 48 : layoutSettings.rightPanelWidthPx}px`;
  const rightPanelRows =
    effectivePanels.rightPrimaryPanelVisible && effectivePanels.audioMixerVisible
      ? `minmax(0,1fr) ${layoutSettings.mixerHeightPx}px`
      : 'minmax(0,1fr)';

  const persistLayoutPatch = useEditorUIStore((s) => s.persistLayoutPatch);
  const persistPanelVisibilityPatch = useEditorUIStore((s) => s.persistPanelVisibilityPatch);

  const refreshSharedLibraryResources = useCallback(async () => {
    try {
      setSharedLibraryResources(await loadSharedLibrary());
    } catch (error) {
      console.warn('Unable to load shared library', error);
      setSharedLibraryResources([]);
    }
  }, []);

  useEffect(() => {
    void refreshSharedLibraryResources();
    const onSharedLibraryUpdated = () => {
      void refreshSharedLibraryResources();
    };
    window.addEventListener('open-factory:shared-library-updated', onSharedLibraryUpdated);
    return () => window.removeEventListener('open-factory:shared-library-updated', onSharedLibraryUpdated);
  }, [refreshSharedLibraryResources]);

  const applyWorkspaceLayoutById = useCallback(
    (layoutId: WorkspaceLayoutId) => {
      const layout = getWorkspaceLayoutById(layoutSettings, layoutId);
      if (!layout) {
        showToast({ kind: 'warning', title: zhCN.layout.workspaceApplyFailed, message: zhCN.layout.workspaceMissing });
        return;
      }
      const next = applyWorkspaceLayout(layoutSettings, layout);
      setLayoutSettings(next);
      setHistoryPanelOpen(layout.panels.history);
      setSmartRoughCutOpen(false);
      setAiRoughCutOpen(false);
      setAiChatEditorOpen(false);
      setVideoSummaryOpen(false);
      setNarrationOpen(false);
      void saveLayoutSettings(next).catch((error) => {
        console.warn('Unable to save workspace layout', error);
      });
      showToast({ kind: 'success', title: zhCN.layout.workspaceApplied, message: getWorkspaceLayoutDisplayName(layout) });
    },
    [layoutSettings]
  );

  const saveCurrentWorkspaceLayout = useCallback(async () => {
    const name = window.prompt(zhCN.layout.saveWorkspacePrompt, zhCN.layout.customWorkspaceDefaultName)?.trim();
    if (!name) {
      return;
    }
    const customLayout = createCustomWorkspaceLayout(name, layoutSettings);
    const next = {
      ...layoutSettings,
      activeWorkspaceLayoutId: customLayout.id,
      customWorkspaceLayouts: [...layoutSettings.customWorkspaceLayouts, customLayout]
    };
    setLayoutSettings(next);
    try {
      await saveLayoutSettings(next);
      showToast({ kind: 'success', title: zhCN.layout.workspaceSaved, message: customLayout.shortcutSlot ? zhCN.layout.workspaceShortcut(customLayout.shortcutSlot) : customLayout.name });
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.layout.workspaceSaveFailed, message: error instanceof Error ? error.message : zhCN.layout.workspaceSaveFailedMessage });
    }
  }, [layoutSettings]);

  const toggleSafeFrameGuides = useCallback(() => {
    setSafeFrameGuides((current) => {
      const next = !current;
      void saveViewSettings({ safeFrameGuides: next }).catch((error) => {
        console.warn('Unable to save view settings', error);
      });
      return next;
    });
  }, []);

  const toggleThumbnailTrackVisible = useCallback(() => {
    setThumbnailTrackVisible((current) => {
      const next = !current;
      void saveViewSettings({ thumbnailTrackVisible: next }).catch((error) => {
        console.warn('Unable to save view settings', error);
      });
      return next;
    });
  }, []);

  const toggleTimelineMinimapVisible = useCallback(() => {
    setTimelineMinimapVisible((current) => {
      const next = !current;
      void saveViewSettings({ timelineMinimapVisible: next }).catch((error) => {
        console.warn('Unable to save view settings', error);
      });
      return next;
    });
  }, []);

  const updateTimelineHeatmap = useCallback((patch: Partial<TimelineHeatmapViewSettings>) => {
    setTimelineHeatmap((current) => {
      const optimistic = normalizeTimelineHeatmapViewSettings({ ...current, ...patch });
      void saveViewSettings({ timelineHeatmap: optimistic })
        .then((view) => setTimelineHeatmap(view.timelineHeatmap))
        .catch((error) => {
          console.warn('Unable to save timeline heatmap settings', error);
        });
      return optimistic;
    });
  }, []);

  const updatePreviewPerformance = useCallback((patch: Partial<PreviewPerformanceSettings>) => {
    setPreviewPerformance((current) => {
      const optimistic = { ...current, ...patch };
      void savePreviewPerformanceSettings(optimistic)
        .then((saved) => setPreviewPerformance(saved))
        .catch((error) => {
          console.warn('Unable to save preview performance settings', error);
        });
      return optimistic;
    });
  }, []);

  const updateTimelineInteractionSettings = useCallback((patch: Partial<TimelineInteractionSettings>) => {
    setTimelineInteractionSettings((current) => {
      const optimistic = { ...current, ...patch };
      void saveTimelineInteractionSettings(optimistic)
        .then((saved) => setTimelineInteractionSettings(saved))
        .catch((error) => {
          console.warn('Unable to save timeline interaction settings', error);
        });
      return optimistic;
    });
  }, []);

  const persistPreviewWindowState = useCallback((state: PreviewWindowState) => {
    if (!state.bounds) {
      return;
    }
    setPreviewWindowResolutionScale(state.resolutionScale);
    void savePreviewWindowSettings({
      bounds: state.bounds,
      alwaysOnTop: state.alwaysOnTop,
      resolutionScale: state.resolutionScale
    }).catch((error) => {
      console.warn('Unable to save preview window settings', error);
    });
  }, []);

  const openDetachedPreview = useCallback(async () => {
    try {
      const settings = await readPreviewWindowSettings();
      const state = await openPreviewWindow(settings);
      setPreviewWindowOpen(state.open);
      setPreviewWindowResolutionScale(state.resolutionScale);
      if (state.bounds) {
        persistPreviewWindowState(state);
      }
      await emitBridge('preview-window-project-state', {
        source: 'main',
        project,
        playheadTime,
        isPlaying,
        previewPerformance,
        resolutionScale: state.resolutionScale
      });
      await emitBridge('preview-window-sync', createPreviewWindowPlaybackState('main', playheadTime, isPlaying));
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.toolbar.popoutPreview, message: error instanceof Error ? error.message : zhCN.common.unavailable });
    }
  }, [isPlaying, persistPreviewWindowState, playheadTime, previewPerformance, project]);

  const reembedPreviewWindow = useCallback(async () => {
    const state = await closePreviewWindow().catch(() => undefined);
    if (state) {
      persistPreviewWindowState(state);
    }
    setPreviewWindowOpen(false);
  }, [persistPreviewWindowState]);

  const updateTimelineGridSettings = useCallback((patch: Partial<TimelineGridSettings>) => {
    setTimelineGridSettings((current) => {
      const optimistic = { ...current, ...patch };
      void saveTimelineGridSettings(optimistic)
        .then((saved) => setTimelineGridSettings(saved))
        .catch((error) => {
          console.warn('Unable to save timeline grid settings', error);
        });
      return optimistic;
    });
  }, []);

  const toggleTimelineGridSnap = useCallback(() => {
    setTimelineGridSettings((current) => {
      const optimistic = { ...current, enabled: !current.enabled };
      void saveTimelineGridSettings(optimistic)
        .then((saved) => setTimelineGridSettings(saved))
        .catch((error) => {
          console.warn('Unable to save timeline grid settings', error);
        });
      return optimistic;
    });
  }, []);

  const changeTimelineGridUnit = useCallback(
    (unit: TimelineGridUnit) => {
      updateTimelineGridSettings({ unit });
    },
    [updateTimelineGridSettings]
  );

  const toggleProjectDocumentation = useCallback(() => {
    setProjectDocumentationOpen((open) => {
      const next = !open;
      if (next) {
        setHistoryPanelOpen(false);
        setSmartRoughCutOpen(false);
        setAiRoughCutOpen(false);
        setAiChatEditorOpen(false);
        setVideoSummaryOpen(false);
        setNarrationOpen(false);
        persistLayoutPatch({
          rightPanelCollapsed: false,
          panels: { ...layoutSettings.panels, inspector: true, history: false }
        });
      }
      return next;
    });
  }, [layoutSettings.panels, persistLayoutPatch]);

  const runAutomationForMedia = useCallback(async (trigger: 'on-import' | 'on-export-complete' | 'on-project-open', media: MediaAsset[]) => {
    if (media.length === 0) {
      return;
    }
    const dependencies: AutomationActionDependencies = {
      enqueueProxy: (asset) => {
        useMediaJobStore.getState().enqueueProxyJobsForMedia([asset], useProxySettingsStore.getState().settings, { force: true });
        void ensureMediaJobRunner();
      },
      setLabel: (assetId, labelColor) => {
        useEditorStore.getState().setMediaMetadata(assetId, { labelColor });
      },
      moveToGroup: (asset, groupName) => {
        moveAutomationMediaToGroup(asset.id, groupName);
      },
      notify: (title, body) => sendNotification(title, body)
    };
    try {
      await runConfiguredAutomationForMedia({ trigger, media, projectName: useEditorStore.getState().project.name }, dependencies);
    } catch (error) {
      console.warn('Automation rule execution failed', error);
    }
  }, []);

  useEffect(() => {
    let canceled = false;
    void getDemucsAvailability({ executablePath: demucsExecutablePath }).then((availability) => {
      if (!canceled) {
        setDemucsAvailability(availability);
      }
    });
    return () => {
      canceled = true;
    };
  }, [demucsExecutablePath]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void listenBridge<DemucsProgressEvent>('demucs-progress', (payload) => {
      if (payload.clipId === audioSeparationClipId) {
        setAudioSeparationProgress(payload.progress);
      }
    }).then((dispose) => {
      unlisten = dispose;
    });
    return () => {
      unlisten?.();
    };
  }, [audioSeparationClipId]);

  useEffect(() => {
    if (!recordingTask) {
      setRecordingElapsedSeconds(0);
      return undefined;
    }
    const update = () => setRecordingElapsedSeconds((Date.now() - recordingTask.startedAt) / 1000);
    update();
    const interval = window.setInterval(update, 500);
    return () => window.clearInterval(interval);
  }, [recordingTask]);

  useEffect(() => {
    let canceled = false;
    void readPreviewPerformanceSettings()
      .then((settings) => {
        if (!canceled) {
          setPreviewPerformance(settings);
        }
      })
      .catch((error) => {
        console.warn('Unable to load preview performance settings', error);
      });
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    let canceled = false;
    void Promise.all([readLocalCoeditingSettings(), readCollaborationIdentitySettings()])
      .then(([settings, identity]) => {
        if (!canceled) {
          setCollaborationIdentity(identity);
          void applyLocalCoeditingSettings(settings, identity);
        }
      })
      .catch((error) => {
        console.warn('Unable to load local co-editing settings', error);
      });
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    if (!collaborationEnabled) {
      return;
    }
    collaborationController.updatePresence(playheadTime, collaborationIdentity.name, collaborationIdentity.color);
  }, [collaborationEnabled, collaborationIdentity.color, collaborationIdentity.name, playheadTime]);

  useEffect(() => {
    let canceled = false;
    void getPreviewWindowState()
      .then((state) => {
        if (!canceled) {
          setPreviewWindowOpen(state.open);
          setPreviewWindowResolutionScale(state.resolutionScale);
        }
      })
      .catch(() => undefined);
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    const disposers: Array<() => void> = [];
    void listenBridge<PreviewWindowState>('preview-window-closed', (state) => {
      setPreviewWindowOpen(false);
      persistPreviewWindowState(state);
    }).then((dispose) => disposers.push(dispose));
    void listenBridge('preview-window-sync', (payload) => {
      const incoming = normalizePreviewWindowPlaybackState(payload);
      const current = useEditorStore.getState();
      if (incoming && shouldApplyPreviewWindowPlaybackState({ playheadTime: current.playheadTime, isPlaying: current.isPlaying }, incoming, 'main', 1 / (current.project.settings.fps || 30))) {
        setPlayheadTime(incoming.playheadTime);
        setIsPlaying(incoming.isPlaying);
      }
    }).then((dispose) => disposers.push(dispose));
    return () => {
      for (const dispose of disposers) {
        dispose();
      }
    };
  }, [persistPreviewWindowState, setIsPlaying, setPlayheadTime]);

  useEffect(() => {
    if (!previewWindowOpen) {
      return;
    }
    const state = useEditorStore.getState();
    void emitBridge('preview-window-project-state', {
      source: 'main',
      project,
      playheadTime: state.playheadTime,
      isPlaying: state.isPlaying,
      previewPerformance,
      resolutionScale: previewWindowResolutionScale
    });
  }, [previewPerformance, previewWindowOpen, previewWindowResolutionScale, project]);

  useEffect(() => {
    if (!previewWindowOpen) {
      return;
    }
    void emitBridge('preview-window-sync', createPreviewWindowPlaybackState('main', playheadTime, isPlaying));
  }, [isPlaying, playheadTime, previewWindowOpen]);

  useEffect(() => {
    let canceled = false;
    void readTimelineGridSettings()
      .then((settings) => {
        if (!canceled) {
          setTimelineGridSettings(settings);
        }
      })
      .catch((error) => {
        console.warn('Unable to load timeline grid settings', error);
      });
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    let canceled = false;
    void readTimelineInteractionSettings()
      .then((settings) => {
        if (!canceled) {
          setTimelineInteractionSettings(settings);
        }
      })
      .catch((error) => {
        console.warn('Unable to load timeline interaction settings', error);
      });
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    let canceled = false;
    void readTutorialProgressSettings()
      .then((progress) => {
        if (!canceled) {
          setTutorialProgress(progress);
        }
      })
      .catch((error) => {
        console.warn('Unable to load tutorial progress settings', error);
        if (!canceled) {
          setTutorialProgress(normalizeTutorialProgressSettings(undefined));
        }
      });
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    setTutorialSignals((current) => ({
      ...current,
      mediaImported: current.mediaImported || project.media.length > 0,
      clipOnTimeline: current.clipOnTimeline || allTimelineClips.length > 0,
      clipTrimmed: current.clipTrimmed || allTimelineClips.some((clip) => clip.trimStart > 0.000001 || clip.trimEnd > 0.000001),
      volumeAdjusted: current.volumeAdjusted || allTimelineClips.some((clip) => 'volume' in clip && Math.abs(clip.volume - 1) > 0.000001),
      textAdded: current.textAdded || allTimelineClips.some((clip) => clip.type === 'text' || clip.type === 'credits')
    }));
  }, [allTimelineClips, project.media.length]);

  useEffect(() => {
    if (isPlaying) {
      setTutorialSignals((current) => ({ ...current, previewPlayed: true }));
    }
  }, [isPlaying]);

  useEffect(() => {
    if (!tutorialProgress || !shouldShowTutorial(tutorialProgress)) {
      return;
    }
    const nextProgress = advanceTutorialProgress(tutorialProgress, tutorialSignals);
    if (
      nextProgress.tutorialStep === tutorialProgress.tutorialStep &&
      nextProgress.tutorialSkipped === tutorialProgress.tutorialSkipped &&
      nextProgress.tutorialCompleted === tutorialProgress.tutorialCompleted
    ) {
      return;
    }
    setTutorialProgress(nextProgress);
    if (nextProgress.tutorialCompleted) {
      setTutorialCelebrationVisible(true);
    }
    void saveTutorialProgressSettings(nextProgress).catch((error) => {
      console.warn('Unable to save tutorial progress settings', error);
    });
  }, [tutorialProgress, tutorialSignals]);

  useEffect(() => {
    let canceled = false;
    void readViewSettings()
      .then((view) => {
        if (!canceled) {
          setSafeFrameGuides(view.safeFrameGuides);
          setThumbnailTrackVisible(view.thumbnailTrackVisible);
          setTimelineMinimapVisible(view.timelineMinimapVisible);
          setTimelineHeatmap(view.timelineHeatmap);
        }
      })
      .catch((error) => {
        console.warn('Unable to load view settings', error);
      });
    return () => {
      canceled = true;
    };
  }, []);

  const beginTimelineResize = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const startY = event.clientY;
      const startHeight = timelineHeightPx;
      let nextHeight = startHeight;
      const onPointerMove = (moveEvent: PointerEvent) => {
        nextHeight = clampTimelineHeight(startHeight + startY - moveEvent.clientY, readViewportSize().height);
        setLayoutSettings((current) => ({ ...current, timelineHeightPx: nextHeight }));
      };
      const finish = () => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', finish);
        window.removeEventListener('pointercancel', finish);
        setLayoutSettings((current) => {
          const next = { ...current, timelineHeightPx: nextHeight };
          void saveLayoutSettings(next).catch((error) => {
            console.warn('Unable to save layout settings', error);
          });
          return next;
        });
      };
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', finish);
      window.addEventListener('pointercancel', finish);
    },
    [timelineHeightPx]
  );

  const requestProjectPassword = useCallback((title: string, description: string) => {
    return new Promise<string | undefined>((resolve) => {
      setProjectPasswordRequest({ title, description, resolve });
    });
  }, []);

  const saveProject = useCallback(async (options: ProjectFileEncryptionOptions = {}) => {
    const encryptedSave = options.encrypted === true;
    const nextPath =
      projectPath && !encryptedSave
        ? projectPath
        : await chooseProjectSavePath(`${project.name}${encryptedSave ? '.cutproj.enc' : '.cutproj.json'}`, encryptedSave);
    if (!nextPath && !projectPath) {
      return;
    }
    const targetPath = nextPath ?? projectPath;
    if (!targetPath) {
      return;
    }
    await writeProjectFile(project, targetPath, { ...options, encrypted: encryptedSave || isEncryptedProjectPath(targetPath) });
    await deleteAutosaveAfterSave(targetPath, projectPath);
    try {
      setLastBackupAt((await readBackupSettings()).lastBackupAt);
    } catch (error) {
      console.warn(zhCN.settings.backup.statusSaveFailed, error);
    }
    setProjectPath(targetPath);
    setDirty(false);
    setTutorialSignals((current) => ({ ...current, projectSaved: true }));
    showToast({ kind: 'success', title: zhCN.editorToasts.projectSaved });
  }, [project, projectPath, setDirty, setProjectPath]);

  const saveEncryptedProject = useCallback(() => {
    setProjectEncryptionSaveOpen(true);
  }, []);

  const startTutorial = useCallback(() => {
    const nextProgress = normalizeTutorialProgressSettings({ tutorialStep: 0, tutorialSkipped: false, tutorialCompleted: false });
    setTutorialCelebrationVisible(false);
    setTutorialSignals(DEFAULT_TUTORIAL_SIGNALS);
    setTutorialProgress(nextProgress);
    void saveTutorialProgressSettings(nextProgress).catch((error) => {
      console.warn('Unable to save tutorial progress settings', error);
    });
  }, []);

  const skipTutorial = useCallback(() => {
    setTutorialCelebrationVisible(false);
    setTutorialProgress((current) => {
      const nextProgress = skipTutorialProgress(current ?? normalizeTutorialProgressSettings(undefined));
      void saveTutorialProgressSettings(nextProgress).catch((error) => {
        console.warn('Unable to save tutorial progress settings', error);
      });
      return nextProgress;
    });
  }, []);

  const closeTutorialCelebration = useCallback(() => {
    setTutorialCelebrationVisible(false);
  }, []);

  const confirmProjectEncryptionSave = useCallback(
    async (options: ProjectFileEncryptionOptions) => {
      setProjectEncryptionSaveOpen(false);
      await saveProject(options);
    },
    [saveProject]
  );

  const archiveCurrentProject = useCallback(async () => {
    try {
      const preflight = await collectProjectArchivePreflight(project);
      if (preflight.missingRows.length > 0) {
        const shouldContinue = await bridgeConfirm(zhCN.projectArchive.missingMediaConfirm(preflight.missingRows.length), {
          title: zhCN.projectArchive.title,
          kind: 'warning'
        });
        if (!shouldContinue) {
          return;
        }
      }
      const archiveParentDir = projectPath ? dirname(projectPath) : await openDirectoryDialog();
      if (!archiveParentDir) {
        return;
      }
      const plan = createProjectArchivePlan(project, archiveParentDir, { skipSourcePaths: preflight.missingPaths });
      setArchiveProgress({ copied: 0, total: plan.copyTasks.filter((task) => task.copyRequired).length });
      await writeProjectArchive(plan, { copyFile: bridgeCopyFile, writeFile: bridgeWriteFile }, setArchiveProgress);
      commandManager.clear();
      setProject(plan.project, plan.projectPath);
      setProjectPath(plan.projectPath);
      setDirty(false);
      showToast({ kind: 'success', title: zhCN.projectArchive.success, message: plan.projectPath });
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.projectArchive.failed, message: error instanceof Error ? error.message : zhCN.projectArchive.failedMessage });
    } finally {
      setArchiveProgress(undefined);
    }
  }, [project, projectPath, setDirty, setProject, setProjectPath]);

  const createMediaReport = useCallback(async () => {
    try {
      const outputPath = await saveOfflineMediaReport(project);
      if (outputPath) {
        showToast({ kind: 'success', title: zhCN.mediaReport.success, message: outputPath });
      }
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.mediaReport.failed, message: error instanceof Error ? error.message : zhCN.mediaReport.failedMessage });
    }
  }, [project]);

  const createClipReport = useCallback(async () => {
    try {
      const outputPath = await saveClipReport(project);
      if (outputPath) {
        showToast({ kind: 'success', title: zhCN.clipReport.success, message: outputPath });
      }
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.clipReport.failed, message: error instanceof Error ? error.message : zhCN.clipReport.failedMessage });
    }
  }, [project]);

  const conformMedia = useCallback(async () => {
    try {
      const directory = await openDirectoryDialog();
      if (!directory) {
        showToast({ kind: 'info', title: zhCN.conformMedia.canceledTitle });
        return;
      }
      const paths = await scanDirectory(directory, 3);
      const currentProject = useEditorStore.getState().project;
      const matches = matchConformByFilename(
        currentProject.media,
        paths.map((path) => ({ path })),
        { caseInsensitive: true }
      );
      const preflight = buildConformPreflight(currentProject.media, matches, { fallbackFrameRate: currentProject.settings.fps });
      const replacements = buildConformMediaReplacements(preflight);
      const report = buildConformReport(preflight, { selectedOnly: true });

      if (replacements.length === 0) {
        showToast({ kind: 'warning', title: zhCN.conformMedia.noMatchesTitle, message: zhCN.conformMedia.noMatchesMessage });
        return;
      }

      commandManager.execute(new ConformMediaCommand(projectAccessor, replacements, zhCN.conformMedia.commandDescription));
      showToast({
        kind: report.failureCount > 0 || report.warningCount > 0 ? 'warning' : 'success',
        title: zhCN.conformMedia.completedTitle,
        message: zhCN.conformMedia.completedMessage(report.successCount, report.warningCount, report.failureCount)
      });
    } catch (error) {
      showToast({
        kind: 'error',
        title: zhCN.conformMedia.failedTitle,
        message: error instanceof Error ? error.message : zhCN.conformMedia.failedMessage
      });
    }
  }, []);

  const jumpToMediaAsset = useCallback((assetId: string) => {
    const element = document.querySelector(`[data-testid="media-card-${assetId}"]`) as HTMLElement | null;
    element?.scrollIntoView({ block: 'center', inline: 'nearest' });
    element?.focus();
  }, []);

  useEffect(() => {
    let canceled = false;
    void findStartupAutosaveRecovery()
      .then((candidate) => {
        if (!canceled && candidate) {
          setRecoveryCandidate(candidate);
        }
      })
      .catch((error) => {
        console.warn(zhCN.editorToasts.autosaveCheckFailed, error);
      });
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    let canceled = false;
    void readCustomKeybindings()
      .then((bindings) => {
        if (!canceled) {
          setShortcutBindings(bindings);
        }
      })
      .catch((error) => {
        console.warn(zhCN.settings.shortcuts.loadFailed, error);
      });
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    let canceled = false;
    void readClipMacros()
      .then((entries) => {
        if (!canceled) {
          setMacros(entries);
        }
      })
      .catch((error) => {
        console.warn(zhCN.settings.macros.saveFailed, error);
      });
    void readMacroHistory()
      .then((entries) => {
        if (!canceled) {
          setMacroHistory(entries);
        }
      })
      .catch((error) => {
        console.warn(zhCN.macros.history.title, error);
      });
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    commandManager.setOnExecute((command) => {
      const recorder = macroRecorderRef.current;
      if (recorder.active && !recorder.replaying) {
        const snapshot = snapshotCommand(command);
        if (snapshot) {
          recorder.steps = [...recorder.steps, snapshot];
          setMacroRecordingStepCount(recorder.steps.length);
        }
      }
      const operationRecorder = operationRecorderRef.current;
      if (operationRecorder.active && !operationRecorder.replaying && operationRecorder.recording) {
        const nextRecording = recordOperationCommand(operationRecorder.recording, command, useEditorStore.getState().project);
        operationRecorder.recording = nextRecording;
        setOperationRecording(nextRecording);
        setOperationRecordingStep(nextRecording.commands.length - 1);
      }
    });
    return () => commandManager.setOnExecute(undefined);
  }, []);

  useEffect(() => {
    return () => {
      for (const timer of operationReplayTimersRef.current) {
        window.clearTimeout(timer);
      }
      operationReplayTimersRef.current = [];
    };
  }, []);

  useEffect(() => {
    let canceled = false;
    void readBackupSettings()
      .then((settings) => {
        if (!canceled) {
          setLastBackupAt(settings.lastBackupAt);
        }
      })
      .catch((error) => {
        console.warn(zhCN.settings.backup.statusSaveFailed, error);
      });
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    let canceled = false;
    void readLayoutSettings()
      .then((settings) => {
        if (!canceled) {
          setLayoutSettings(settings);
        }
      })
      .catch((error) => {
        console.warn('Unable to load layout settings', error);
      });
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    let canceled = false;
    void readCustomSplitLayouts()
      .then((layouts) => {
        if (!canceled) {
          setCustomSplitLayouts(layouts);
        }
      })
      .catch((error) => {
        console.warn('Unable to load custom split layouts', error);
      });
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    const updateViewport = () => setViewportSize(readViewportSize());
    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        setTimelineSearchOpen(true);
        return;
      }
      const workspaceLayoutId = resolveWorkspaceLayoutShortcut(event, layoutSettings.customWorkspaceLayouts);
      if (workspaceLayoutId && !isEditableKeyboardEventTarget(event.target)) {
        event.preventDefault();
        applyWorkspaceLayoutById(workspaceLayoutId);
      }
    }
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [applyWorkspaceLayoutById, layoutSettings.customWorkspaceLayouts]);

  useEffect(() => {
    const onHashChange = () => setReviewMode(window.location.hash === '#review');
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    const targetHash = reviewMode ? '#review' : '';
    if (window.location.hash === targetHash) {
      return;
    }
    const nextUrl = `${window.location.pathname}${window.location.search}${targetHash}`;
    window.history.replaceState(null, '', nextUrl);
  }, [reviewMode]);

  const queueFrameRateConversionForImportedMedia = useCallback(
    async (media: MediaAsset[]) => {
      if (project.settings.vfrHandling === 'ignore') {
        return;
      }
      const frameRateMedia = media.filter((asset) => asset.type === 'video' && (asset.variableFrameRate || isFrameRateMismatch(asset.frameRate, project.settings.fps)));
      if (frameRateMedia.length === 0) {
        return;
      }
      if (project.settings.vfrHandling === 'ask') {
        const shouldConvert = await bridgeConfirm(zhCN.editorToasts.frameRateConversionPrompt(frameRateMedia.length, getProjectFrameRateConversionTarget(project.settings.fps)), {
          title: zhCN.editorToasts.frameRateConversionPromptTitle,
          kind: 'warning'
        });
        if (!shouldConvert) {
          return;
        }
      }
      for (const asset of frameRateMedia) {
        const cfrFrameRate = isFrameRateMismatch(asset.frameRate, project.settings.fps)
          ? getProjectFrameRateConversionTarget(project.settings.fps)
          : getCfrTargetFrameRate({ avgFrameRate: asset.avgFrameRate, realFrameRate: asset.realFrameRate }, asset.frameRate ?? project.settings.fps);
        useMediaJobStore.getState().enqueueProxyJobsForMedia([asset], useProxySettingsStore.getState().settings, {
          force: true,
          cfrFrameRate
        });
      }
      void ensureMediaJobRunner();
    },
    [project.settings.fps, project.settings.vfrHandling]
  );

  const persistMediaFingerprints = useCallback(async (media: MediaAsset[]) => {
    for (const asset of media) {
      try {
        const fingerprint = await generateMediaFingerprint(asset);
        if (fingerprint) {
          const metadata = useEditorStore.getState().project.mediaMetadata[asset.id];
          useEditorStore.getState().setMediaMetadata(asset.id, { ...metadata, fingerprint });
        }
      } catch {
        // Fingerprints improve duplicate detection but must not block local import.
      }
    }
  }, []);

  const applyImportedMediaColorConversionChoice = useCallback(async (media: MediaAsset[]): Promise<MediaAsset[]> => {
    const workingColorSpace = normalizeProjectWorkingColorSpace(useEditorStore.getState().project.settings.workingColorSpace);
    const mismatched = media.filter((asset) => asset.colorProfile && asset.colorProfile.sourceColorSpace !== workingColorSpace);
    if (mismatched.length === 0) {
      return media;
    }
    const confirmed = await bridgeConfirm(zhCN.editorToasts.colorConversionPrompt(mismatched.length, getColorSpaceDisplayName(workingColorSpace)), {
      title: zhCN.settings.general.workingColorSpace
    });
    if (!confirmed) {
      return media;
    }
    return media.map((asset) =>
      asset.colorProfile && asset.colorProfile.sourceColorSpace !== workingColorSpace
        ? { ...asset, colorProfile: { ...asset.colorProfile, autoConvertToWorkingSpace: true } }
        : asset
    );
  }, []);

  const importMedia = useCallback(async () => {
    try {
      const paths = await pickMediaPaths();
      if (paths.length === 0) {
        return;
      }
      const result = await probeMediaPaths(paths, project.media);
      if (result.duplicateCount > 0) {
        showToast({ kind: 'info', title: zhCN.editorToasts.duplicateTitle, message: zhCN.editorToasts.duplicateMessage(result.duplicateCount) });
      }
      if (result.media.length > 0) {
        const importedMedia = await applyImportedMediaColorConversionChoice(result.media);
        addMedia(importedMedia);
        await persistMediaFingerprints(importedMedia);
        await queueFrameRateConversionForImportedMedia(importedMedia);
        void runAutomationForMedia('on-import', importedMedia);
        showToast({ kind: 'success', title: zhCN.editorToasts.mediaImported, message: zhCN.editorToasts.mediaImportedMessage(result.media.length) });
      }
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.editorToasts.importFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.importFailedMessage });
    }
  }, [addMedia, applyImportedMediaColorConversionChoice, persistMediaFingerprints, project.media, queueFrameRateConversionForImportedMedia, runAutomationForMedia]);

  const addVersionForMedia = useCallback(
    async (assetId: string) => {
      const currentProject = useEditorStore.getState().project;
      const asset = currentProject.media.find((item) => item.id === assetId);
      if (!asset) {
        showToast({ kind: 'error', title: zhCN.editorToasts.mediaVersionAddFailed, message: zhCN.editorToasts.mediaVersionMissingAsset });
        return;
      }
      try {
        const paths = await pickMediaPaths();
        const path = paths[0];
        if (!path) {
          return;
        }
        if (path === asset.path) {
          showToast({ kind: 'warning', title: zhCN.editorToasts.mediaVersionAddFailed, message: zhCN.editorToasts.mediaVersionSameFile });
          return;
        }
        const latestProject = useEditorStore.getState().project;
        const existing = latestProject.media.find((item) => item.path === path);
        const result = existing ? { media: [] as MediaAsset[], duplicateCount: 1 } : await probeMediaPaths([path], latestProject.media);
        const importedMedia = result.media.length > 0 ? await applyImportedMediaColorConversionChoice(result.media) : result.media;
        const versionAsset = existing ?? importedMedia[0];
        if (!versionAsset) {
          showToast({ kind: 'error', title: zhCN.editorToasts.mediaVersionAddFailed, message: zhCN.editorToasts.importFailedMessage });
          return;
        }
        if (versionAsset.type !== asset.type) {
          showToast({ kind: 'error', title: zhCN.editorToasts.mediaVersionAddFailed, message: zhCN.editorToasts.mediaVersionTypeMismatch });
          return;
        }
        if (importedMedia.length > 0) {
          addMedia(importedMedia);
          await persistMediaFingerprints(importedMedia);
          await queueFrameRateConversionForImportedMedia(importedMedia);
          void runAutomationForMedia('on-import', importedMedia);
        }
        const metadata = useEditorStore.getState().project.mediaMetadata[assetId];
        setMediaMetadata(assetId, appendMediaVersion(metadata, versionAsset));
        showToast({ kind: 'success', title: zhCN.editorToasts.mediaVersionAdded, message: zhCN.editorToasts.mediaVersionAddedMessage(versionAsset.name) });
      } catch (error) {
        showToast({ kind: 'error', title: zhCN.editorToasts.mediaVersionAddFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.importFailedMessage });
      }
    },
    [addMedia, applyImportedMediaColorConversionChoice, persistMediaFingerprints, queueFrameRateConversionForImportedMedia, runAutomationForMedia, setMediaMetadata]
  );

  const openMediaVersionCompare = useCallback(
    (assetId: string) => {
      const request = buildMediaVersionCompareRequest(useEditorStore.getState().project, assetId, undefined, undefined, playheadTime);
      if (!request) {
        showToast({ kind: 'warning', title: zhCN.editorToasts.mediaVersionCompareUnavailable, message: zhCN.editorToasts.mediaVersionCompareUnavailableMessage });
        return;
      }
      setMediaVersionCompare(request);
    },
    [playheadTime]
  );

  const openBatchTranscode = useCallback((paths: string[] = []) => {
    setBatchTranscodeInitialPaths(paths);
    setBatchTranscodeOpen(true);
  }, []);

  const batchGenerateCovers = useCallback(async () => {
    const tasks = buildCoverFrameBatchTasks(useEditorStore.getState().project.media);
    if (tasks.length === 0) {
      showToast({ kind: 'warning', title: zhCN.editorToasts.coverBatchFailed, message: zhCN.editorToasts.coverBatchNoVideo });
      return;
    }
    try {
      const baseDir = projectPath ? dirname(projectPath) : await getAppDataDir();
      const result = await batchExtractCoverFrames({
        outputDir: joinLocalPath(baseDir, 'covers'),
        tasks
      });
      const completed = result.results.filter((item) => item.status === 'completed').length;
      if (completed === 0) {
        showToast({ kind: 'error', title: zhCN.editorToasts.coverBatchFailed, message: result.results.find((item) => item.error)?.error ?? zhCN.editorToasts.coverBatchFailedMessage });
        return;
      }
      showToast({ kind: 'success', title: zhCN.editorToasts.coverBatchCompleted, message: zhCN.editorToasts.coverBatchCompletedMessage(completed) });
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.editorToasts.coverBatchFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.coverBatchFailedMessage });
    }
  }, [projectPath]);

  const importVideosForStitchWizard = useCallback(async (): Promise<string[]> => {
    try {
      const paths = await pickMediaPaths();
      if (paths.length === 0) {
        return [];
      }
      const result = await probeMediaPaths(paths, useEditorStore.getState().project.media);
      if (result.media.length > 0) {
        addMedia(result.media);
        await persistMediaFingerprints(result.media);
        await queueFrameRateConversionForImportedMedia(result.media);
        void runAutomationForMedia('on-import', result.media);
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
          const asset = currentProject.media.find((item) => item.id === assetId && item.type === 'video');
          return asset ? [asset] : [];
        });
        if (assets.length < 2) {
          throw new Error(zhCN.videoStitchWizard.empty);
        }
        const track = createTrack({
          id: createId('track'),
          type: 'video',
          name: zhCN.videoStitchWizard.trackName,
          clips: []
        });
        const sequence = buildVideoStitchSequence(
          assets.map((asset) => ({ mediaId: asset.id, name: asset.name, duration: asset.duration || 5 })),
          {
            trackId: track.id,
            transitionEnabled: settings.transitionEnabled,
            transitionDuration: settings.transitionDuration
          }
        );
        commandManager.execute(new AddTrackCommand(timelineAccessor, track));
        for (const clip of sequence.clips) {
          commandManager.execute(new AddClipCommand(timelineAccessor, clip));
        }
        for (const transition of sequence.transitions) {
          commandManager.execute(new AddTransitionCommand(timelineAccessor, transition));
        }
        setSelectedClipIds(sequence.clips.map((clip) => clip.id));
        setPlayheadTime(0);
        setTemplateExportPreset({
          id: 'video-stitch-wizard',
          name: zhCN.videoStitchWizard.exportPresetName,
          description: zhCN.videoStitchWizard.exportPresetDescription,
          builtin: true,
          settings: {
            width: settings.width,
            height: settings.height,
            fps: settings.fps,
            videoCodec: 'libx264',
            audioCodec: 'aac',
            format: 'mp4',
            outputMode: 'video',
            scaleMode: 'fit',
            targetAspectRatio: 'source',
            reframeOffsetX: 0,
            reframeOffsetY: 0,
            hardwareEncoding: false
          }
        });
        setVideoStitchWizardOpen(false);
        setExportDialogOpen(true);
        showToast({ kind: 'success', title: zhCN.videoStitchWizard.createdTitle, message: zhCN.videoStitchWizard.createdMessage(sequence.clips.length) });
      } catch (error) {
        showToast({ kind: 'error', title: zhCN.videoStitchWizard.generateFailed, message: error instanceof Error ? error.message : zhCN.timeline.timelineRejectedMessage });
      }
    },
    [setPlayheadTime, setSelectedClipIds]
  );

  const saveNamedSnapshot = useCallback(
    async (name: string) => {
      try {
        const snapshot = await saveProjectSnapshot(project, name, projectPath);
        setSnapshotNameOpen(false);
        showToast({ kind: 'success', title: zhCN.projectSnapshots.saved, message: snapshot.name });
      } catch (error) {
        showToast({ kind: 'error', title: zhCN.projectSnapshots.saveFailed, message: error instanceof Error ? error.message : zhCN.projectSnapshots.saveFailed });
      }
    },
    [project, projectPath]
  );

  const restoreSnapshotProject = useCallback(
    (snapshotProject: Project) => {
      commandManager.execute(new LoadProjectCommand(projectAccessor, snapshotProject, zhCN.projectSnapshots.restoreCommand));
      clearSelectedClipIds();
      setPlayheadTime(0);
    },
    [clearSelectedClipIds, setPlayheadTime]
  );

  const applySnapshotDiffSelection = useCallback(
    (sourceProject: Project, itemIds: string[]) => {
      const currentProject = useEditorStore.getState().project;
      const nextTimeline = applyTimelineVersionDiffSelection(currentProject.timeline, sourceProject.timeline, itemIds);
      const nextProject = replaceProjectActiveTimeline(currentProject, nextTimeline);
      commandManager.execute(new LoadProjectCommand(projectAccessor, nextProject, zhCN.projectSnapshots.appliedDiffs));
      clearSelectedClipIds();
      setPlayheadTime(0);
    },
    [clearSelectedClipIds, setPlayheadTime]
  );

  const updateProjectReleaseVersion = useCallback((version: string) => {
    commandManager.execute(new UpdateProjectReleaseVersionCommand(projectAccessor, version));
  }, []);

  const scanDuplicateMedia = useCallback(async () => {
    try {
      const currentProject = useEditorStore.getState().project;
      const groups = await scanDuplicateMediaGroups(currentProject.media, currentProject.mediaMetadata);
      if (groups.length === 0) {
        showToast({ kind: 'info', title: zhCN.duplicateMedia.empty });
        return;
      }
      setDuplicateMediaGroups(groups);
      setDuplicateMediaOpen(true);
    } catch (error) {
      showToast({
        kind: 'error',
        title: zhCN.duplicateMedia.scanFailed,
        message: error instanceof Error ? error.message : zhCN.duplicateMedia.scanFailedMessage
      });
    }
  }, []);

  const mergeDuplicateMediaGroups = useCallback((selections: DuplicateMediaMergeSelection[]) => {
    try {
      for (const selection of selections) {
        commandManager.execute(new MergeMediaCommand(projectAccessor, selection.keepAssetId, selection.assetIds));
      }
      setDuplicateMediaOpen(false);
      setDuplicateMediaGroups([]);
      showToast({ kind: 'success', title: zhCN.duplicateMedia.mergedTitle, message: zhCN.duplicateMedia.mergedMessage(selections.length) });
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.projectHealth.toasts.fixFailed, message: error instanceof Error ? error.message : zhCN.projectHealth.toasts.fixFailedMessage });
    }
  }, []);

  const refreshMediaOrganizer = useCallback(async () => {
    setMediaOrganizerScanning(true);
    try {
      const currentProject = useEditorStore.getState().project;
      const [groups, cleanup] = await Promise.all([
        scanSmartDuplicateMediaGroups(currentProject.media, currentProject.mediaMetadata),
        scanMediaCleanupReport(currentProject)
      ]);
      setMediaOrganizerGroups(groups);
      setMediaOrganizerCleanup(cleanup);
    } catch (error) {
      showToast({
        kind: 'error',
        title: zhCN.mediaOrganizer.scanFailed,
        message: error instanceof Error ? error.message : zhCN.mediaOrganizer.scanFailedMessage
      });
    } finally {
      setMediaOrganizerScanning(false);
    }
  }, []);

  const openMediaOrganizer = useCallback(() => {
    setMediaOrganizerOpen(true);
    void refreshMediaOrganizer();
  }, [refreshMediaOrganizer]);

  const confirmMediaOrganizerDuplicateGroups = useCallback(
    async (selections: MediaOrganizerDuplicateSelection[], moveFilesToTrash: boolean) => {
      try {
        const assetById = new Map(useEditorStore.getState().project.media.map((asset) => [asset.id, asset]));
        if (moveFilesToTrash) {
          for (const assetId of selections.flatMap((selection) => selection.removeAssetIds)) {
            const asset = assetById.get(assetId);
            if (asset) {
              await bridgeTrashFile(asset.path);
            }
          }
        }
        let removedCount = 0;
        for (const selection of selections) {
          commandManager.execute(new MergeMediaCommand(projectAccessor, selection.keepAssetId, [selection.keepAssetId, ...selection.removeAssetIds]));
          removedCount += selection.removeAssetIds.length;
        }
        showToast({ kind: 'success', title: zhCN.mediaOrganizer.removedTitle, message: zhCN.mediaOrganizer.removedMessage(removedCount) });
        void refreshMediaOrganizer();
      } catch (error) {
        showToast({ kind: 'error', title: zhCN.projectHealth.toasts.fixFailed, message: error instanceof Error ? error.message : zhCN.projectHealth.toasts.fixFailedMessage });
      }
    },
    [refreshMediaOrganizer]
  );

  const removeMediaOrganizerReferences = useCallback(
    (assetIds: string[]) => {
      try {
        commandManager.execute(new RemoveMediaCommand(projectAccessor, assetIds));
        showToast({ kind: 'success', title: zhCN.mediaOrganizer.removedTitle, message: zhCN.mediaOrganizer.removedMessage(assetIds.length) });
        void refreshMediaOrganizer();
      } catch (error) {
        showToast({ kind: 'error', title: zhCN.projectHealth.toasts.fixFailed, message: error instanceof Error ? error.message : zhCN.projectHealth.toasts.fixFailedMessage });
      }
    },
    [refreshMediaOrganizer]
  );

  const archiveUnusedMedia = useCallback(async () => {
    const unused = mediaOrganizerCleanup?.unused ?? [];
    if (unused.length === 0) {
      return;
    }
    try {
      const archiveDir = await openDirectoryDialog();
      if (!archiveDir) {
        showToast({ kind: 'info', title: zhCN.mediaOrganizer.archiveCanceled });
        return;
      }
      const relinkEntries = [];
      for (let index = 0; index < unused.length; index += 1) {
        const asset = unused[index];
        const destination = buildArchiveDestinationPath(archiveDir, asset, index);
        await bridgeMoveFile(asset.path, destination);
        relinkEntries.push({ assetId: asset.id, newPath: destination });
      }
      const nextProject = applyArchiveRelinkPlan(useEditorStore.getState().project, relinkEntries);
      commandManager.execute(new LoadProjectCommand(projectAccessor, nextProject, zhCN.mediaOrganizer.archivedTitle));
      showToast({ kind: 'success', title: zhCN.mediaOrganizer.archivedTitle, message: zhCN.mediaOrganizer.archivedMessage(relinkEntries.length) });
      void refreshMediaOrganizer();
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.mediaOrganizer.archiveFailed, message: error instanceof Error ? error.message : zhCN.mediaOrganizer.archiveFailed });
    }
  }, [mediaOrganizerCleanup, refreshMediaOrganizer]);

  const renameUnusedMedia = useCallback(
    async (template: string) => {
      const unused = mediaOrganizerCleanup?.unused ?? [];
      if (unused.length === 0) {
        return;
      }
      try {
        const relinkEntries = [];
        for (let index = 0; index < unused.length; index += 1) {
          const asset = unused[index];
          const destination = buildRenameDestinationPath(asset, template, index);
          await bridgeMoveFile(asset.path, destination);
          relinkEntries.push({ assetId: asset.id, newPath: destination });
        }
        const nextProject = applyArchiveRelinkPlan(useEditorStore.getState().project, relinkEntries);
        commandManager.execute(new LoadProjectCommand(projectAccessor, nextProject, zhCN.mediaOrganizer.renameTitle));
        showToast({ kind: 'success', title: zhCN.mediaOrganizer.renameTitle, message: zhCN.mediaOrganizer.archivedMessage(relinkEntries.length) });
        void refreshMediaOrganizer();
      } catch (error) {
        showToast({ kind: 'error', title: zhCN.projectHealth.toasts.fixFailed, message: error instanceof Error ? error.message : zhCN.projectHealth.toasts.fixFailedMessage });
      }
    },
    [mediaOrganizerCleanup, refreshMediaOrganizer]
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
    [selectedClipIds]
  );

  const openSyncCompare = useCallback(() => {
    const state = useEditorStore.getState();
    const refs = findSyncCompareClipRefs(state.project.timeline, state.selectedClipIds);
    if (refs.length !== 2) {
      showToast({ kind: 'warning', title: zhCN.syncCompare.unavailableTitle, message: zhCN.syncCompare.unavailableMessage });
      return;
    }
    setPlayheadTime(Math.min(refs[0].clip.start, refs[1].clip.start));
    setSyncCompareOpen(true);
  }, [setPlayheadTime]);

  const runSingleContentAnalysis = useCallback(async (target: ContentAnalysisTarget): Promise<boolean> => {
    setContentAnalysisRunningClipId(target.clip.id);
    try {
      const analysis = await analyzeClipContentLocally(target.clip, target.asset);
      commandManager.execute(new UpdateClipCommand(timelineAccessor, target.clip.id, { contentAnalysis: analysis }));
      return true;
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.contentAnalysis.failedTitle, message: error instanceof Error ? error.message : zhCN.contentAnalysis.failedMessage });
      return false;
    } finally {
      setContentAnalysisRunningClipId(undefined);
    }
  }, []);

  const analyzeContentClip = useCallback(
    async (clipId: string) => {
      const target = findContentAnalysisTarget(useEditorStore.getState().project, clipId);
      if (!target) {
        showToast({ kind: 'warning', title: zhCN.contentAnalysis.failedTitle, message: zhCN.contentAnalysis.noTargets });
        return;
      }
      const completed = await runSingleContentAnalysis(target);
      if (completed) {
        showToast({ kind: 'success', title: zhCN.contentAnalysis.completedTitle, message: zhCN.contentAnalysis.completedMessage(1) });
      }
    },
    [runSingleContentAnalysis]
  );

  const analyzePreferredContentTargets = useCallback(async () => {
    const state = useEditorStore.getState();
    const targets = collectContentAnalysisTargets(state.project);
    const selected = targets.filter((target) => state.selectedClipIds.includes(target.clip.id));
    const runTargets = selected.length > 0 ? selected : targets;
    if (runTargets.length === 0) {
      showToast({ kind: 'warning', title: zhCN.contentAnalysis.failedTitle, message: zhCN.contentAnalysis.noTargets });
      return;
    }
    let completed = 0;
    for (const target of runTargets) {
      if (await runSingleContentAnalysis(target)) {
        completed += 1;
      }
    }
    if (completed > 0) {
      showToast({ kind: 'success', title: zhCN.contentAnalysis.completedTitle, message: zhCN.contentAnalysis.completedMessage(completed) });
    }
  }, [runSingleContentAnalysis]);

  const exportContentAnalysis = useCallback(async (clipId: string) => {
    const target = findContentAnalysisTarget(useEditorStore.getState().project, clipId);
    if (!target?.clip.contentAnalysis) {
      showToast({ kind: 'warning', title: zhCN.contentAnalysis.failedTitle, message: zhCN.contentAnalysis.notAnalyzed });
      return;
    }
    try {
      const outputPath = await exportClipContentAnalysisJson(target.clip);
      if (outputPath) {
        showToast({ kind: 'success', title: zhCN.contentAnalysis.exportedTitle, message: outputPath });
      }
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.contentAnalysis.failedTitle, message: error instanceof Error ? error.message : zhCN.contentAnalysis.failedMessage });
    }
  }, []);

  const addAssetToTimeline = useCallback(
    (assetId: string) => {
      const asset = project.media.find((item) => item.id === assetId);
      const track = asset ? findPreferredTrack(project.timeline, asset) : undefined;
      if (!asset || !track) {
        showToast({ kind: 'error', title: zhCN.editorToasts.noCompatibleTrack, message: zhCN.editorToasts.noCompatibleTrackMessage });
        return;
      }
      try {
        const clip = createClipFromAsset(asset, track, project.timeline);
        commandManager.execute(new AddClipCommand(timelineAccessor, clip));
        if (asset.type === 'video') {
          useMediaJobStore.getState().enqueueProxyJobsForMedia([asset], useProxySettingsStore.getState().settings, {
            force: true,
            priority: 'high',
            sourceStart: clip.trimStart,
            sourceDuration: getClipSourceVisibleDuration(clip)
          });
          void ensureMediaJobRunner();
        }
        setSelectedClipId(clip.id);
      } catch (error) {
        showToast({ kind: 'error', title: zhCN.editorToasts.addClipFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.addClipFailedMessage });
      }
    },
    [project, setSelectedClipId]
  );



  const handleAddSubclip = useCallback((subclip: Subclip) => {
    commandManager.execute(new AddSubclipCommand(projectAccessor, subclip));
    showToast({ kind: 'success', title: zhCN.subclip.newSubclip, message: subclip.name });
  }, []);

  const handleUpdateSubclip = useCallback((subclipId: string, patch: Partial<Subclip>) => {
    commandManager.execute(new UpdateSubclipCommand(projectAccessor, subclipId, patch));
  }, []);

  const handleDeleteSubclip = useCallback((subclipId: string) => {
    commandManager.execute(new DeleteSubclipCommand(projectAccessor, subclipId));
    showToast({ kind: 'info', title: zhCN.subclip.deleteSubclip, message: '' });
  }, []);

  const handleAddSubclipToTimeline = useCallback((assetId: string, subclip: Subclip) => {
    const asset = project.media.find((item) => item.id === assetId);
    const track = asset ? findPreferredTrack(project.timeline, asset) : undefined;
    if (!asset || !track) {
      showToast({ kind: 'error', title: zhCN.editorToasts.noCompatibleTrack, message: zhCN.editorToasts.noCompatibleTrackMessage });
      return;
    }
    try {
      const clip = createClipFromAsset(asset, track, project.timeline, { subclip, subclipName: subclip.name });
      commandManager.execute(new AddClipCommand(timelineAccessor, clip));
      setSelectedClipId(clip.id);
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.editorToasts.addClipFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.addClipFailedMessage });
    }
  }, [project, setSelectedClipId]);

  const addAdjustmentLayer = useCallback(() => {
    try {
      const adjustmentTrackCount = project.timeline.tracks.filter((track) => track.type === 'video' && track.clips.some((clip) => clip.type === 'adjustment')).length;
      const track = createTrack({
        id: createId('track'),
        type: 'video',
        name: zhCN.timeline.adjustmentTrackName(adjustmentTrackCount + 1),
        clips: []
      });
      const clip = createAdjustmentLayerClip(track, project.timeline);
      commandManager.execute(new AddAdjustmentLayerCommand(timelineAccessor, track, clip));
      setSelectedClipId(clip.id);
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.editorToasts.addClipFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.addClipFailedMessage });
    }
  }, [project.timeline, setSelectedClipId]);

  const applyEffectPresetToSelectedClip = useCallback(
    (preset: EffectPreset) => {
      if (!selectedClip) {
        showToast({ kind: 'warning', title: zhCN.effectPresetLibrary.noClipSelected, message: zhCN.effectPresetLibrary.noClipSelectedMessage });
        return;
      }
      try {
        commandManager.execute(new ApplyEffectPresetCommand(timelineAccessor, selectedClip.id, preset));
        showToast({ kind: 'success', title: zhCN.effectPresetLibrary.applied, message: preset.name });
      } catch (error) {
        showToast({ kind: 'error', title: zhCN.effectPresetLibrary.applyFailed, message: error instanceof Error ? error.message : zhCN.effectPresetLibrary.applyFailedMessage });
      }
    },
    [selectedClip]
  );

  const addMotionGraphic = useCallback(() => {
    try {
      const trackCount = project.timeline.tracks.filter((track) => track.type === 'video').length;
      const track = createTrack({
        id: createId('track'),
        type: 'video',
        name: zhCN.motionGraphics.trackName(trackCount + 1),
        clips: []
      });
      const clip = createMotionGraphicClip(track, project.timeline, playheadTime);
      commandManager.execute(new AddMotionGraphicCommand(timelineAccessor, track, clip));
      setSelectedClipId(clip.id);
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.editorToasts.addClipFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.addClipFailedMessage });
    }
  }, [playheadTime, project.timeline, setSelectedClipId]);

  const openColorNodeEditor = useCallback(() => {
    if (!selectedClip || selectedClip.type === 'audio') {
      showToast({ kind: 'warning', title: zhCN.colorNodeEditor.unavailableTitle, message: zhCN.colorNodeEditor.unavailableMessage });
      return;
    }
    setColorNodeEditorOpen(true);
  }, [selectedClip]);

  const runTimelineColorAnalysis = useCallback(async () => {
    if (colorAnalysisBusy) {
      return;
    }
    setColorAnalysisBusy(true);
    const results: TimelineColorAnalysisResult[] = [];
    const samples: ColorAnalysisClipSample[] = [];
    for (const item of visualTimelineClipRefs) {
      try {
        const sample = await readColorMatchFrameSample(item.media.path);
        if (!sample) {
          continue;
        }
        const metrics = analyzeColorFrameSample(sample);
        results.push({
          clipId: item.clip.id,
          trackId: item.trackId,
          mediaId: item.media.id,
          name: item.clip.name || item.media.name,
          start: item.clip.start,
          duration: item.clip.duration,
          metrics
        });
        samples.push({ clipId: item.clip.id, sample });
      } catch {
        // Skip unreadable clips so one failed background sample cannot block the whole analysis.
      }
    }
    const jumps = detectSceneColorJumps(results);
    setColorAnalysisResults(results);
    setColorAnalysisSamples(samples);
    setColorAnalysisJumps(jumps);
    setColorHeatmapPoints(buildTimelineColorHeatmapData(results));
    setColorAnalysisBusy(false);
    showToast({ kind: 'success', title: zhCN.colorAnalysis.completedTitle, message: zhCN.colorAnalysis.completedMessage(results.length, jumps.length) });
  }, [colorAnalysisBusy, visualTimelineClipRefs]);

  const alignTimelineColorToReference = useCallback(
    (referenceClipId: string) => {
      const updates = buildColorAlignmentUpdates(colorAnalysisSamples, referenceClipId);
      if (updates.length === 0) {
        showToast({ kind: 'warning', title: zhCN.colorAnalysis.title, message: zhCN.colorAnalysis.alignSkipped });
        return;
      }
      commandManager.execute(
        new BatchUpdateClipCommand(
          timelineAccessor,
          updates.map((update) => ({
            clipId: update.clipId,
            patch: { colorCorrection: update.colorCorrection }
          }))
        )
      );
      showToast({ kind: 'success', title: zhCN.colorAnalysis.title, message: zhCN.colorAnalysis.alignApplied(updates.length) });
    },
    [colorAnalysisSamples]
  );

  const openColorAnalysis = useCallback(() => {
    setColorAnalysisOpen(true);
    if (colorAnalysisResults.length === 0) {
      void runTimelineColorAnalysis();
    }
  }, [colorAnalysisResults.length, runTimelineColorAnalysis]);

  const addTitleTemplate = useCallback(
    (templateId: TitleTemplateId) => {
      const track = project.timeline.tracks.find((item) => item.type === 'text');
      if (!track) {
        showToast({ kind: 'warning', title: zhCN.timeline.noTextTrackTitle, message: zhCN.timeline.noTextTrackMessage });
        return;
      }
      try {
        const label = zhCN.titleTemplates[templateId];
        const clip = instantiateTitleTemplate(templateId, track, project.timeline, {
          name: label.name,
          text: label.defaultText
        });
        commandManager.execute(new AddClipCommand(timelineAccessor, clip));
        setSelectedClipId(clip.id);
      } catch (error) {
        showToast({ kind: 'error', title: zhCN.editorToasts.addClipFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.addClipFailedMessage });
      }
    },
    [project.timeline, setSelectedClipId]
  );

  const createMediaFolder = useCallback((parentId?: string | null) => {
    try {
      commandManager.execute(new AddMediaFolderCommand(projectAccessor, { name: zhCN.mediaBin.newFolder, parentId }));
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.mediaBin.newFolder, message: error instanceof Error ? error.message : zhCN.timeline.timelineRejectedMessage });
    }
  }, []);

  const renameMediaFolder = useCallback((folderId: string, name: string) => {
    commandManager.execute(new RenameMediaFolderCommand(projectAccessor, folderId, name));
  }, []);

  const deleteMediaFolder = useCallback((folderId: string) => {
    commandManager.execute(new DeleteMediaFolderCommand(projectAccessor, folderId));
  }, []);

  const setMediaFolderCollapsed = useCallback((folderId: string, collapsed: boolean) => {
    commandManager.execute(new SetMediaFolderCollapsedCommand(projectAccessor, folderId, collapsed));
  }, []);

  const moveMediaToFolder = useCallback((assetIds: string[], folderId?: string | null) => {
    commandManager.execute(new MoveMediaToFolderCommand(projectAccessor, assetIds, folderId));
  }, []);

  const batchUpdateMediaMetadata = useCallback((assetIds: string[], metadata: BatchEditableMediaMetadata) => {
    if (assetIds.length === 0) {
      return;
    }
    commandManager.execute(new BatchUpdateMetadataCommand(projectAccessor, assetIds.map((assetId) => ({ assetId, metadata }))));
    showToast({ kind: 'success', title: zhCN.mediaBin.batchEditMetadata, message: zhCN.mediaBin.batchMetadataUpdated(assetIds.length) });
  }, []);

  const batchRenameMedia = useCallback(async (_assetIds: string[], preview: MediaRenamePreviewItem[], renameFiles: boolean) => {
    const state = useEditorStore.getState();
    const assetById = new Map(state.project.media.map((asset) => [asset.id, asset]));
    const renamePlan = preview
      .filter((item) => item.changed)
      .map((item) => {
        const asset = assetById.get(item.assetId);
        return asset
          ? {
              assetId: item.assetId,
              name: item.nextName,
              oldPath: asset.path,
              nextPath: renameFiles ? replaceMediaPathBasename(asset.path, item.nextName) : asset.path
            }
          : undefined;
      })
      .filter((item): item is { assetId: string; name: string; oldPath: string; nextPath: string } => Boolean(item));
    if (renamePlan.length === 0) {
      return;
    }
    let commandExecuted = false;
    try {
      commandManager.execute(
        new BatchRenameMediaCommand(
          projectAccessor,
          renamePlan.map((item) => ({
            assetId: item.assetId,
            name: item.name,
            path: renameFiles ? item.nextPath : undefined
          }))
        )
      );
      commandExecuted = true;
      if (renameFiles) {
        for (const item of renamePlan) {
          if (item.oldPath !== item.nextPath) {
            await bridgeMoveFile(item.oldPath, item.nextPath);
          }
        }
      }
      showToast({ kind: 'success', title: zhCN.mediaBin.batchRename, message: zhCN.mediaBin.batchRenameCompleted(renamePlan.length) });
    } catch (error) {
      if (commandExecuted && renameFiles) {
        commandManager.undo();
      }
      showToast({
        kind: 'error',
        title: zhCN.mediaBin.batchRenameFailed,
        message: error instanceof Error ? error.message : zhCN.mediaBin.batchRenameFailedMessage
      });
    }
  }, []);

  const relinkMedia = useCallback(
    async (assetId: string) => {
      const asset = project.media.find((item) => item.id === assetId);
      if (!asset) {
        return;
      }
      try {
        const relinked = await relinkSingleMedia(asset);
        if (!relinked) {
          return;
        }
        setMedia(project.media.map((item) => (item.id === assetId ? relinked : item)));
        showToast({ kind: 'success', title: zhCN.editorToasts.mediaRelinked, message: relinked.name });
      } catch (error) {
        showToast({ kind: 'error', title: zhCN.editorToasts.relinkFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.relinkFailedMessage });
      }
    },
    [project.media, setMedia]
  );

  const relinkAllMissing = useCallback(async () => {
    try {
      const result = await relinkMissingMediaInDirectory(project.media);
      setMedia(result.media);
      showToast({
        kind: result.relinkedCount > 0 ? 'success' : 'warning',
        title: zhCN.editorToasts.relinkComplete,
        message: zhCN.editorToasts.relinkCompleteMessage(result.relinkedCount, result.warnings.length)
      });
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.editorToasts.relinkFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.relinkMissingFailedMessage });
    }
  }, [project.media, setMedia]);

  const refreshProjectHealth = useCallback(async () => {
    try {
      setProjectHealthScanning(true);
      const state = useEditorStore.getState();
      setProjectHealthReport(await scanProjectHealth(state.project, useProxySettingsStore.getState().settings));
    } catch (error) {
      showToast({
        kind: 'error',
        title: zhCN.projectHealth.toasts.scanFailed,
        message: error instanceof Error ? error.message : zhCN.projectHealth.toasts.scanFailedMessage
      });
    } finally {
      setProjectHealthScanning(false);
    }
  }, []);

  const openProjectHealth = useCallback(() => {
    setProjectHealthRepairReport(undefined);
    setProjectHealthOpen(true);
    void refreshProjectHealth();
  }, [refreshProjectHealth]);

  const refreshMediaHealthDashboard = useCallback(async () => {
    try {
      setMediaHealthScanning(true);
      const state = useEditorStore.getState();
      const result = await scanMediaHealthDashboard(state.project, useProxySettingsStore.getState().settings);
      setMediaHealthDashboard(result.dashboard);
      setProjectHealthReport(result.report);
      return result;
    } catch (error) {
      showToast({
        kind: 'error',
        title: zhCN.mediaHealthDashboard.toasts.scanFailed,
        message: error instanceof Error ? error.message : zhCN.mediaHealthDashboard.toasts.scanFailedMessage
      });
      return undefined;
    } finally {
      setMediaHealthScanning(false);
    }
  }, []);

  const openMediaHealthDashboard = useCallback(() => {
    setMediaHealthDashboardOpen(true);
    void refreshMediaHealthDashboard();
  }, [refreshMediaHealthDashboard]);

  const setMediaHealthAutoShow = useCallback((enabled: boolean) => {
    setMediaHealthAutoShowEnabled(enabled);
    writeMediaHealthAutoShowEnabled(enabled);
  }, []);

  const openMediaHealthRelinkPanel = useCallback(() => {
    setMediaHealthDashboardOpen(false);
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
      setProjectHealthRepairReport(command.report);
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

  const separateSelectedAudio = useCallback(async () => {
    if (!selectedClip || (selectedClip.type !== 'audio' && selectedClip.type !== 'video') || !selectedClipMedia) {
      showToast({ kind: 'warning', title: zhCN.demucs.unavailableTitle, message: zhCN.demucs.noClipSelected });
      return;
    }
    if (!demucsAvailability.ready) {
      showToast({ kind: 'warning', title: zhCN.demucs.unavailableTitle, message: demucsAvailability.error ?? zhCN.demucs.notConfigured });
      return;
    }
    setAudioSeparationClipId(selectedClip.id);
    setAudioSeparationProgress(0);
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
      setAudioSeparationClipId(undefined);
      setAudioSeparationProgress(undefined);
    }
  }, [addMedia, demucsAvailability, demucsExecutablePath, selectedClip, selectedClipMedia, setSelectedClipIds]);

  const runSpeakerDiarization = useCallback(async () => {
    const target = speakerDiarizationTarget;
    if (!target) {
      showToast({ kind: 'warning', title: zhCN.speakerDiarization.unavailableTitle, message: zhCN.speakerDiarization.unavailableMessage });
      return;
    }
    setSpeakerDiarizationRunning(true);
    showToast({ kind: 'info', title: zhCN.speakerDiarization.runningTitle, message: zhCN.speakerDiarization.runningMessage });
    try {
      const dialogueIntervals = collectSpeakerDiarizationDialogueIntervals(project, target.clip);
      const analysis = await analyzeSpeakerDiarizationForClip(target.clip, target.asset, dialogueIntervals);
      if (analysis.segments.length === 0 || analysis.tracks.length === 0) {
        setSpeakerDiarizationResult(undefined);
        showToast({ kind: 'warning', title: zhCN.speakerDiarization.noResultsTitle, message: zhCN.speakerDiarization.noResultsMessage });
        return;
      }
      setSelectedClipId(target.clip.id);
      setSpeakerDiarizationResult({
        sourceName: target.clip.name || target.asset.name,
        segments: analysis.segments,
        tracks: analysis.tracks
      });
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.speakerDiarization.failedTitle, message: error instanceof Error ? error.message : zhCN.speakerDiarization.failedMessage });
    } finally {
      setSpeakerDiarizationRunning(false);
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
      setSpeakerDiarizationResult(undefined);
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.speakerDiarization.failedTitle, message: error instanceof Error ? error.message : zhCN.speakerDiarization.failedMessage });
    }
  }, [setSelectedClipIds, speakerDiarizationResult]);

  const openAutoAudioSync = useCallback(() => {
    if (autoAudioSyncTargets.length < 2 || autoAudioSyncTargets.length > 5) {
      showToast({ kind: 'warning', title: zhCN.autoAudioSync.unavailableTitle, message: zhCN.autoAudioSync.unavailableMessage });
      return;
    }
    setAutoAudioSyncPrimaryClipId((current) => (current && autoAudioSyncTargets.some((target) => target.clip.id === current) ? current : autoAudioSyncTargets[0].clip.id));
    setAutoAudioSyncResults([]);
    setAutoAudioSyncOpen(true);
  }, [autoAudioSyncTargets]);

  const runAutoAudioSync = useCallback(async () => {
    const primary = autoAudioSyncTargets.find((target) => target.clip.id === resolvedAutoAudioSyncPrimaryClipId);
    const secondaryTargets = autoAudioSyncTargets.filter((target) => target.clip.id !== resolvedAutoAudioSyncPrimaryClipId).slice(0, 4);
    if (!primary || secondaryTargets.length === 0) {
      showToast({ kind: 'warning', title: zhCN.autoAudioSync.unavailableTitle, message: zhCN.autoAudioSync.notEnoughTracksMessage });
      return;
    }
    setAutoAudioSyncRunning(true);
    showToast({ kind: 'info', title: zhCN.autoAudioSync.runningTitle, message: zhCN.autoAudioSync.runningMessage });
    try {
      const analysis = await analyzeAutoAudioSyncTargets(primary, secondaryTargets);
      setAutoAudioSyncResults(analysis.results);
      const lowCount = analysis.results.filter((result) => result.confidence === 'low' || !result.applied).length;
      if (lowCount > 0) {
        showToast({ kind: 'warning', title: zhCN.autoAudioSync.unavailableTitle, message: zhCN.autoAudioSync.skippedLowConfidence(lowCount) });
      }
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.autoAudioSync.failedTitle, message: error instanceof Error ? error.message : zhCN.autoAudioSync.failedMessage });
    } finally {
      setAutoAudioSyncRunning(false);
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
      setAutoAudioSyncOpen(false);
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
        setRecordingTask({ taskId: result.taskId, source, outputPath: result.outputPath, startedAt: Date.now() });
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
      setRecordingTask(undefined);
      setRecordingElapsedSeconds(0);
    }
  }, [addMedia, persistMediaFingerprints, recordingTask]);

  const executeNewProject = useCallback(
    (nextProject: ReturnType<typeof createProject>, nextTemplatePreset?: ExportPreset) => {
      commandManager.execute(
        new NewProjectCommand(
          {
            getProject: projectAccessor.getProject,
            setProject: (project) => setProject(project, undefined)
          },
          nextProject,
          zhCN.toolbar.newProject
        )
      );
      commandManager.clear();
      setActiveProjectEncryptionPassword(undefined);
      setProjectPath(undefined);
      setDirty(false);
      setTemplateExportPreset(nextTemplatePreset);
    },
    [setDirty, setProject, setProjectPath]
  );

  const newProject = useCallback(async () => {
    if (dirty && !(await confirmDiscardChanges())) {
      return;
    }
    executeNewProject(createProject(zhCN.project.defaultName));
  }, [dirty, executeNewProject]);

  const createProjectFromTemplate = useCallback(
    async (templateId: ProjectTemplateId) => {
      if (dirty && !(await confirmDiscardChanges())) {
        return;
      }
      const copy = projectTemplateCopy(templateId);
      const instance = instantiateProjectTemplate(templateId, { name: copy.name });
      executeNewProject(instance.project, {
        id: `template-${templateId}`,
        name: copy.name,
        description: copy.description,
        builtin: true,
        settings: instance.exportSettings
      });
      setProjectTemplateOpen(false);
    },
    [dirty, executeNewProject]
  );

  const createProjectFromTimelineTemplate = useCallback(
    async (nextProject: Project) => {
      if (dirty && !(await confirmDiscardChanges())) {
        return;
      }
      executeNewProject(nextProject);
      setTimelineTemplateMode(undefined);
    },
    [dirty, executeNewProject]
  );

  const openProject = useCallback(async () => {
    try {
      if (dirty && !(await confirmDiscardChanges())) {
        return;
      }
      const path = await chooseProjectToOpen();
      if (!path) {
        return;
      }
      const password = isEncryptedProjectPath(path)
        ? await requestProjectPassword(zhCN.projectFiles.encryptedOpenTitle, zhCN.projectFiles.encryptedOpenDescription)
        : undefined;
      if (isEncryptedProjectPath(path) && !password) {
        return;
      }
      const nextProject = await readProjectFile(path, path, { password });
      commandManager.clear();
      setProject(nextProject, path);
      void runAutomationForMedia('on-project-open', nextProject.media);
      setTemplateExportPreset(undefined);
      showToast({ kind: 'success', title: zhCN.editorToasts.projectOpened });
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.editorToasts.openFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.openFailedMessage });
    }
  }, [dirty, requestProjectPassword, runAutomationForMedia, setProject]);

  const splitSelected = useCallback(() => {
    if (!selectedClip) {
      return;
    }
    try {
      commandManager.execute(new SplitClipCommand(timelineAccessor, selectedClip.id, playheadTime));
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.editorToasts.splitUnavailable, message: error instanceof Error ? error.message : zhCN.editorToasts.splitUnavailableMessage });
    }
  }, [playheadTime, selectedClip]);

  const seekSpectrumTime = useCallback(
    (asset: MediaAsset, sourceTime: number) => {
      const match = findTimelineClipForMediaSourceTime(project.timeline, asset.id, sourceTime, selectedClip);
      if (match) {
        setSelectedClipId(match.clip.id);
        setPlayheadTime(match.timelineTime);
        return;
      }
      setPlayheadTime(sourceTime);
    },
    [project.timeline, selectedClip, setPlayheadTime, setSelectedClipId]
  );

  const setSpectrumSelectionRange = useCallback(
    (range: { inPoint: number; outPoint: number }) => {
      setInPoint(range.inPoint);
      setOutPoint(range.outPoint);
    },
    [setInPoint, setOutPoint]
  );

  const splitSpectrumAtTime = useCallback(
    (asset: MediaAsset, sourceTime: number) => {
      const match = findTimelineClipForMediaSourceTime(project.timeline, asset.id, sourceTime, selectedClip);
      if (!match) {
        showToast({ kind: 'warning', title: zhCN.mediaBin.spectrum.splitFailedTitle, message: zhCN.mediaBin.spectrum.splitFailedMessage });
        return;
      }
      try {
        setSelectedClipId(match.clip.id);
        setPlayheadTime(match.timelineTime);
        commandManager.execute(new SplitClipCommand(timelineAccessor, match.clip.id, match.timelineTime));
      } catch (error) {
        showToast({ kind: 'warning', title: zhCN.editorToasts.splitUnavailable, message: error instanceof Error ? error.message : zhCN.editorToasts.splitUnavailableMessage });
      }
    },
    [project.timeline, selectedClip, setPlayheadTime, setSelectedClipId]
  );

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
      const preserved = (project.beatMarkers ?? []).filter((marker) => marker.time < clipStart - 0.000001 || marker.time > clipEnd + 0.000001);
      const timelineMarkers = localBeatMarkers.map((marker, index) => createBeatMarker(selectedClip.start + marker.time, `${selectedClip.id}-beat-${index + 1}`));
      commandManager.execute(new UpdateProjectBeatMarkersCommand(projectAccessor, [...preserved, ...timelineMarkers]));
      showToast({ kind: 'success', title: zhCN.editorToasts.beatDetectComplete(localBeatMarkers.length), message: detectedBpm ? zhCN.editorToasts.beatDetectBpm(detectedBpm) : undefined });
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.editorToasts.beatDetectFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.beatDetectNoMarkers });
    }
  }, [beatSensitivity, project.beatMarkers, selectedClip, selectedClipMedia]);

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

  const createMulticamSequence = useCallback(() => {
    try {
      const command = new CreateMulticamSequenceCommand(projectAccessor, selectedClipIds, zhCN.timeline.multicamSequenceName(project.sequences.length));
      commandManager.execute(command);
      if (command.multicamClipId) {
        setSelectedClipId(command.multicamClipId);
        setSelectedClipIds([command.multicamClipId]);
      }
      showToast({ kind: 'success', title: zhCN.editorToasts.multicamCreated });
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.editorToasts.multicamCreateFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.multicamCreateFailedMessage });
    }
  }, [project.sequences.length, selectedClipIds, setSelectedClipId, setSelectedClipIds]);

  const applyPiPLayout = useCallback(() => {
    if (selectedPiPClips.length !== 2) {
      showToast({ kind: 'warning', title: zhCN.editorToasts.pipApplyFailed, message: zhCN.editorToasts.pipApplyFailedMessage });
      return;
    }
    const [main, pip] = selectedPiPClips;
    const pipSource = getClipSourceDimensions(project, pip.clip);
    try {
      commandManager.execute(
        new PiPLayoutCommand(timelineAccessor, main.clip.id, pip.clip.id, {
          position: pipLayoutPosition,
          canvasWidth: project.settings.width,
          canvasHeight: project.settings.height,
          pipSourceWidth: pipSource.width,
          pipSourceHeight: pipSource.height
        })
      );
      setSelectedClipIds([pip.clip.id]);
      showToast({ kind: 'success', title: zhCN.editorToasts.pipApplied });
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.editorToasts.pipApplyFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.pipApplyFailedMessage });
    }
  }, [pipLayoutPosition, project, selectedPiPClips, setSelectedClipIds]);

  const applySplitLayout = useCallback(
    (layoutId: string) => {
      if (!canApplySplitLayout) {
        showToast({ kind: 'warning', title: zhCN.editorToasts.splitLayoutApplyFailed, message: zhCN.editorToasts.splitLayoutApplyFailedMessage });
        return;
      }
      const layout = getSplitLayoutDefinition(layoutId, customSplitLayouts);
      if (!layout) {
        showToast({ kind: 'warning', title: zhCN.editorToasts.splitLayoutApplyFailed, message: zhCN.editorToasts.splitLayoutMissingMessage });
        return;
      }
      const sources = Object.fromEntries(
        selectedSplitLayoutClips.map((item) => {
          const dimensions = getClipSourceDimensions(project, item.clip);
          return [item.clip.id, dimensions];
        })
      );
      try {
        commandManager.execute(
          new ApplySplitLayoutCommand(
            timelineAccessor,
            selectedSplitLayoutClips.map((item) => item.clip.id),
            {
              layout,
              canvasWidth: project.settings.width,
              canvasHeight: project.settings.height,
              sources
            }
          )
        );
        setSelectedClipIds(selectedSplitLayoutClips.map((item) => item.clip.id));
        showToast({ kind: 'success', title: zhCN.editorToasts.splitLayoutApplied });
      } catch (error) {
        showToast({ kind: 'warning', title: zhCN.editorToasts.splitLayoutApplyFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.splitLayoutApplyFailedMessage });
      }
    },
    [canApplySplitLayout, customSplitLayouts, project, selectedSplitLayoutClips, setSelectedClipIds]
  );

  const saveCustomSplitLayout = useCallback(
    async (ratio: number) => {
      const layout = createMainSideSplitLayout(createId('split-layout'), zhCN.toolbar.customSplitLayoutName(customSplitLayouts.length + 1), ratio);
      const next = await saveCustomSplitLayouts([...customSplitLayouts, layout]);
      setCustomSplitLayouts(next);
      return layout.id;
    },
    [customSplitLayouts]
  );

  const importEdlTimeline = useCallback(
    (contents: string, path: string) => {
      const fileName = path.split(/[\\/]/).pop()?.replace(/\.edl$/i, '') || undefined;
      const command = new ImportEDLCommand(projectAccessor, contents, { sequenceName: fileName });
      commandManager.execute(command);
      clearSelectedClipIds();
      setPlayheadTime(0);
      const result = command.result;
      return {
        title: result?.title ?? fileName ?? zhCN.timelineExport.importEdl,
        matchedCount: result?.matchedCount ?? 0,
        missingCount: result?.missingCount ?? 0
      };
    },
    [clearSelectedClipIds, setPlayheadTime]
  );

  const deleteSelected = useCallback(() => {
    const state = useEditorStore.getState();
    const ids = state.selectedClipIds;
    if (ids.length === 0) {
      return;
    }
    const groups = normalizeClipGroups(state.project.clipGroups, state.project.timeline.tracks.flatMap((track) => track.clips.map((clip) => clip.id)));
    const group = findCompleteClipGroup(groups, ids);
    if (group) {
      commandManager.execute(new DeleteGroupCommand(projectAccessor, group.id));
      clearSelectedClipIds();
      return;
    }
    commandManager.execute(new DeleteClipsCommand(timelineAccessor, ids));
    clearSelectedClipIds();
  }, [clearSelectedClipIds]);

  const rippleDeleteSelected = useCallback(() => {
    const state = useEditorStore.getState();
    const ids = state.selectedClipIds;
    if (ids.length === 0) {
      return;
    }
    commandManager.execute(new RippleDeleteCommand(timelineAccessor, ids, state.project.protectedRanges));
    clearSelectedClipIds();
  }, [clearSelectedClipIds]);

  const generateProxyForMedia = useCallback(
    async (assetId: string, options: ProxyGenerationOptions = {}) => {
      const asset = useEditorStore.getState().project.media.find((item) => item.id === assetId);
      if (!asset || asset.type !== 'video') {
        return;
      }
      setMedia(useEditorStore.getState().project.media.map((item) => (item.id === assetId ? { ...item, proxyStatus: 'pending', proxyError: undefined } : item)));
      try {
        const proxyAsset = await createProxyForAsset({ ...asset, proxyStatus: 'pending', proxyError: undefined }, proxySettings, options);
        setMedia(useEditorStore.getState().project.media.map((item) => (item.id === assetId ? proxyAsset : item)));
        showToast({ kind: 'success', title: zhCN.editorToasts.proxyReady, message: proxyAsset.name });
      } catch (error) {
        setMedia(
          useEditorStore
            .getState()
            .project.media.map((item) =>
              item.id === assetId
                ? { ...item, proxyStatus: 'error', proxyError: error instanceof Error ? error.message : zhCN.editorToasts.proxyFailedMessage }
                : item
            )
        );
        showToast({ kind: 'error', title: zhCN.editorToasts.proxyFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.proxyFailedMessage });
      }
    },
    [proxySettings, setMedia]
  );

  const deleteProxiesForMedia = useCallback(
    async (assetIds: string[]) => {
      const ids = new Set(assetIds);
      const media = useEditorStore.getState().project.media;
      const proxyPaths = media.filter((asset) => ids.has(asset.id) && asset.proxyPath).map((asset) => asset.proxyPath!);
      try {
        await Promise.all(proxyPaths.map((path) => bridgeRemoveFile(path).catch(() => undefined)));
        setMedia(
          useEditorStore.getState().project.media.map((asset) =>
            ids.has(asset.id)
              ? {
                  ...asset,
                  proxyPath: undefined,
                  proxyStatus: asset.type === 'video' ? 'none' : undefined,
                  proxyError: undefined
                }
              : asset
          )
        );
        showToast({ kind: 'success', title: zhCN.editorToasts.proxyDeleted, message: zhCN.editorToasts.proxyDeletedMessage(proxyPaths.length) });
      } catch (error) {
        showToast({ kind: 'error', title: zhCN.editorToasts.proxyDeleteFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.proxyDeleteFailedMessage });
      }
    },
    [setMedia]
  );

  const regenerateProxiesForMedia = useCallback(
    async (assetIds: string[]) => {
      for (const assetId of assetIds) {
        await generateProxyForMedia(assetId, { force: true });
      }
    },
    [generateProxyForMedia]
  );

  const migrateProxiesToDirectory = useCallback(async (targetDirectory: string) => {
    const updates = buildProxyMigration(useEditorStore.getState().project.media, targetDirectory);
    if (updates.length === 0) {
      showToast({ kind: 'info', title: zhCN.editorToasts.proxyMigrationSkipped });
      return;
    }
    const moved: typeof updates = [];
    try {
      for (const update of updates) {
        await bridgeMoveFile(update.fromPath, update.toPath);
        moved.push(update);
      }
      commandManager.execute(new MigrateProxiesCommand(projectAccessor, updates));
      showToast({ kind: 'success', title: zhCN.editorToasts.proxyMigrated, message: zhCN.editorToasts.proxyMigratedMessage(updates.length) });
    } catch (error) {
      for (const update of moved.reverse()) {
        await bridgeMoveFile(update.toPath, update.fromPath).catch(() => undefined);
      }
      showToast({ kind: 'error', title: zhCN.editorToasts.proxyMigrationFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.proxyMigrationFailedMessage });
    }
  }, []);

  const convertVfrMediaToCfr = useCallback(
    (assetId: string) => {
      const asset = useEditorStore.getState().project.media.find((item) => item.id === assetId);
      if (!asset || asset.type !== 'video') {
        return;
      }
      const cfrFrameRate = getProjectFrameRateConversionTarget(project.settings.fps, getCfrTargetFrameRate({ avgFrameRate: asset.avgFrameRate, realFrameRate: asset.realFrameRate }, asset.frameRate ?? 30));
      void generateProxyForMedia(assetId, { force: true, cfrFrameRate });
    },
    [generateProxyForMedia, project.settings.fps]
  );

  const clearCache = useCallback(async () => {
    try {
      await clearMediaCache();
      showToast({ kind: 'success', title: zhCN.editorToasts.cacheCleared });
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.editorToasts.cacheClearFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.cacheClearFailedMessage });
    }
  }, []);

  const undo = useCallback(() => commandManager.undo(), []);
  const switchToPreviousHistoryBranch = useCallback(() => commandManager.switchToPreviousBranch(), []);
  const redo = useCallback(() => commandManager.redo(), []);
  const togglePlayback = useCallback(() => {
    if (getTimelineDuration(project.timeline) === 0) {
      return;
    }
    const isPlaying = useEditorStore.getState().isPlaying;
    if (!isPlaying) {
      setPlaybackRate(1);
    }
    setIsPlaying(!isPlaying);
  }, [project.timeline, setIsPlaying, setPlaybackRate]);
  const reversePlayback = useCallback(() => {
    if (getTimelineDuration(useEditorStore.getState().project.timeline) === 0) {
      return;
    }
    setPlaybackRate(-1);
    setIsPlaying(true);
  }, [setIsPlaying, setPlaybackRate]);
  const pausePlayback = useCallback(() => setIsPlaying(false), [setIsPlaying]);
  const forwardPlayback = useCallback(() => {
    if (getTimelineDuration(useEditorStore.getState().project.timeline) === 0) {
      return;
    }
    setPlaybackRate(1);
    setIsPlaying(true);
  }, [setIsPlaying, setPlaybackRate]);
  const stepFrame = useCallback(
    (direction: -1 | 1) => {
      const state = useEditorStore.getState();
      const fps = state.project.settings.fps || 30;
      setIsPlaying(false);
      setPlaybackRate(1);
      state.setPlayheadTime(state.playheadTime + direction / fps);
    },
    [setIsPlaying, setPlaybackRate]
  );

  const addAnnotationAtPlayhead = useCallback(() => {
    const state = useEditorStore.getState();
    try {
      commandManager.execute(
        new AddProjectAnnotationCommand(projectAccessor, {
          time: state.playheadTime,
          text: zhCN.timeline.annotationLabel((state.project.annotations?.length ?? 0) + 1),
          color: DEFAULT_PROJECT_ANNOTATION_COLOR
        })
      );
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.timeline.annotationRejectedTitle, message: error instanceof Error ? error.message : zhCN.timeline.addAnnotationFailed });
    }
  }, []);

  const addReviewAnnotationAtPlayhead = useCallback((annotation: Omit<ReviewAnnotation, 'id'> & Partial<Pick<ReviewAnnotation, 'id'>>) => {
    try {
      commandManager.execute(
        new AddReviewAnnotationCommand(projectAccessor, {
          ...annotation,
          color: annotation.color ?? DEFAULT_REVIEW_ANNOTATION_COLOR
        })
      );
      showToast({ kind: 'success', title: zhCN.preview.reviewAnnotationAdded, message: annotation.text });
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.preview.reviewAnnotationFailedTitle, message: error instanceof Error ? error.message : zhCN.preview.reviewAnnotationFailedMessage });
    }
  }, []);

  const createReviewReport = useCallback(async () => {
    try {
      const outputPath = await saveReviewReport(useEditorStore.getState().project);
      if (outputPath) {
        showToast({ kind: 'success', title: zhCN.preview.reviewReportSaved, message: outputPath });
      }
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.preview.reviewReportFailedTitle, message: error instanceof Error ? error.message : zhCN.preview.reviewReportFailedMessage });
    }
  }, []);

  const addBookmarkAtPlayhead = useCallback(() => {
    const state = useEditorStore.getState();
    try {
      commandManager.execute(
        new AddProjectBookmarkCommand(projectAccessor, {
          id: createId('bookmark'),
          time: state.playheadTime,
          note: zhCN.timeline.bookmarkLabel((state.project.bookmarks?.length ?? 0) + 1)
        })
      );
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.timeline.bookmarkRejectedTitle, message: error instanceof Error ? error.message : zhCN.timeline.addBookmarkFailed });
    }
  }, []);

  const jumpTimelineNavigationPoint = useCallback(
    (direction: 'previous' | 'next') => {
      const state = useEditorStore.getState();
      const points = buildTimelineNavigationPoints(state.project.bookmarks, state.project.timeline.markers, getTimelineDuration(state.project.timeline));
      const point = findTimelineNavigationPoint(points, state.playheadTime, direction);
      if (point) {
        setPlayheadTime(point.time);
      }
    },
    [setPlayheadTime]
  );

  const exportBookmarks = useCallback(async () => {
    try {
      const state = useEditorStore.getState();
      const outputPath = await bridgeSaveFileDialog(`${state.project.name}-bookmarks.json`, [{ name: zhCN.fileDialogs.bookmarks, extensions: ['json'] }]);
      if (!outputPath) {
        return;
      }
      await bridgeWriteFile(outputPath, serializeTimelineBookmarks(state.project.bookmarks ?? [], getTimelineDuration(state.project.timeline)));
      showToast({ kind: 'success', title: zhCN.timeline.bookmarksExported, message: outputPath });
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.timeline.bookmarksExportFailed, message: error instanceof Error ? error.message : zhCN.timeline.bookmarksExportFailedMessage });
    }
  }, []);

  const importBookmarks = useCallback(async () => {
    try {
      const paths = await bridgeOpenFileDialog(false, [{ name: zhCN.fileDialogs.bookmarks, extensions: ['json'] }]);
      const inputPath = paths[0];
      if (!inputPath) {
        return;
      }
      const state = useEditorStore.getState();
      const imported = parseTimelineBookmarksJson(await bridgeReadFile(inputPath), getTimelineDuration(state.project.timeline));
      const nextBookmarks = mergeImportedTimelineBookmarks(state.project.bookmarks ?? [], imported, getTimelineDuration(state.project.timeline));
      commandManager.execute(new UpdateProjectBookmarksCommand(projectAccessor, nextBookmarks));
      showToast({ kind: 'success', title: zhCN.timeline.bookmarksImported, message: zhCN.timeline.bookmarksImportedMessage(imported.length) });
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.timeline.bookmarksImportFailed, message: error instanceof Error ? error.message : zhCN.timeline.bookmarksImportFailedMessage });
    }
  }, []);

  const setSingleExportRange = useCallback((start: number, end: number) => {
    const state = useEditorStore.getState();
    const duration = getTimelineDuration(state.project.timeline);
    const range = createExportRange(
      {
        id: state.project.exportRanges[0]?.id,
        label: zhCN.timeline.exportRangeLabel(1),
        start,
        end
      },
      duration
    );
    if (range.end <= range.start) {
      return;
    }
    commandManager.execute(new UpdateProjectExportRangesCommand(projectAccessor, [range]));
  }, []);

  const appendExportRange = useCallback((start: number, end: number) => {
    const state = useEditorStore.getState();
    const duration = getTimelineDuration(state.project.timeline);
    const existing = normalizeExportRanges(state.project.exportRanges, duration);
    const range = createExportRange(
      {
        label: zhCN.timeline.exportRangeLabel(existing.length + 1),
        start,
        end
      },
      duration
    );
    if (range.end <= range.start) {
      return;
    }
    commandManager.execute(new UpdateProjectExportRangesCommand(projectAccessor, [...existing, range]));
  }, []);

  const markInPoint = useCallback(() => {
    const state = useEditorStore.getState();
    const time = state.playheadTime;
    setInPoint(time);
    if (typeof state.outPoint === 'number') {
      setSingleExportRange(time, state.outPoint);
    }
  }, [setInPoint, setSingleExportRange]);

  const markOutPoint = useCallback(() => {
    const state = useEditorStore.getState();
    const time = state.playheadTime;
    setOutPoint(time);
    if (typeof state.inPoint === 'number') {
      setSingleExportRange(state.inPoint, time);
    }
  }, [setOutPoint, setSingleExportRange]);

  const markMultiRangeInPoint = useCallback(() => {
    setInPoint(useEditorStore.getState().playheadTime);
  }, [setInPoint]);

  const markMultiRangeOutPoint = useCallback(() => {
    const state = useEditorStore.getState();
    const time = state.playheadTime;
    setOutPoint(time);
    if (typeof state.inPoint === 'number') {
      appendExportRange(state.inPoint, time);
    }
  }, [appendExportRange, setOutPoint]);

  const selectAllTimelineItems = useCallback(() => {
    const state = useEditorStore.getState();
    const clip = selectClipById(state.project, state.selectedClipId);
    const keyframes = clip ? collectClipKeyframeRefs(clip) : [];
    if (keyframes.length > 0) {
      setSelectedKeyframes(keyframes);
      return;
    }
    setSelectedClipIds(state.project.timeline.tracks.flatMap((track) => track.clips.map((item) => item.id)));
  }, [setSelectedClipIds, setSelectedKeyframes]);

  const matchFrameToSource = useCallback(() => {
    if (!selectedClipId) return;
    const result = matchFrameFromClip({
      timeline: project.timeline,
      clipId: selectedClipId,
      playheadTime,
      sequences: project.sequences,
      activeSequenceId: project.activeSequenceId,
      penetrationMode: 'source'
    });
    if (result) {
      const asset = project.media.find((m) => m.id === result.mediaId);
      if (asset) {
        showToast({ kind: 'info', title: t('matchFrame.matchFrame'), message: `${asset.name} @ ${result.sourceTime.toFixed(1)}s` });
      }
    }
  }, [selectedClipId, project, playheadTime, showToast]);

  const revealMediaInTimeline = useCallback(() => {
    if (!selectedClipMedia) return;
    const result = coreRevealInTimeline(project.timeline, selectedClipMedia.id, project.sequences);
    if (result.instances.length > 0) {
      setSelectedClipIds(result.instances.map((inst) => inst.clipId));
      if (result.instances[0]) {
        setSelectedClipId(result.instances[0].clipId);
        setPlayheadTime(result.instances[0].startTime);
      }
      showToast({ kind: 'info', title: t('matchFrame.revealInTimeline'), message: `找到 ${result.instances.length} 个实例` });
    } else {
      showToast({ kind: 'warning', title: t('matchFrame.revealInTimeline'), message: t('matchFrame.noSourceFound') });
    }
  }, [selectedClipMedia, project, setSelectedClipIds, setSelectedClipId, setPlayheadTime, showToast]);

  const navigateToNextInstance = useCallback(() => {
    if (!selectedClipMedia || !selectedClipId) return;
    const nextId = coreNavigateToNextInstance(project.timeline, selectedClipMedia.id, selectedClipId, project.sequences);
    if (nextId) {
      setSelectedClipId(nextId);
      const nav = getMediaInstanceNavigation(project.timeline, selectedClipMedia.id, nextId, project.sequences);
      showToast({ kind: 'info', title: t('matchFrame.navigateNext'), message: `${nav.currentIndex + 1}/${nav.total}` });
    }
  }, [selectedClipMedia, selectedClipId, project, setSelectedClipId, showToast]);

  const renderInOutRegion = useCallback(async () => {
    const startSec = inPoint ?? 0;
    const endSec = outPoint ?? getTimelineDuration(project.timeline);
    if (endSec <= startSec) {
      showToast({ kind: 'warning', title: t('renderCache.renderInOut'), message: t('renderCache.noInOutPoint') });
      return;
    }
    try {
      const result = await renderPreviewCache({
        projectId: project.name,
        startSec,
        endSec,
        sourcePath: projectPath ?? '',
        width: project.settings.width,
        height: project.settings.height
      });
      if (result.success) {
        showToast({ kind: 'success', title: t('renderCache.renderInOut'), message: t('renderCache.renderComplete') });
      } else {
        showToast({ kind: 'warning', title: t('renderCache.renderInOut'), message: result.error ?? t('renderCache.renderFailed') });
      }
    } catch {
      showToast({ kind: 'warning', title: t('renderCache.renderInOut'), message: t('renderCache.renderFailed') });
    }
  }, [inPoint, outPoint, project, projectPath, showToast]);

  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [recentMediaIds, setRecentMediaIds] = useState<string[]>([]);

  const handleToggleFavorite = useCallback((assetId: string) => {
    setFavoriteIds((prev) => prev.includes(assetId) ? prev.filter((id) => id !== assetId) : [...prev, assetId]);
  }, []);

  const handlePinToSession = useCallback((assetId: string) => {
    setPinnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(assetId)) next.delete(assetId);
      else next.add(assetId);
      return next;
    });
  }, []);

  const handleRevealFromMediaBin = useCallback((assetId: string) => {
    const result = coreRevealInTimeline(project.timeline, assetId, project.sequences);
    if (result.instances.length > 0) {
      setSelectedClipIds(result.instances.map((inst) => inst.clipId));
      showToast({ kind: 'info', title: t('matchFrame.revealInTimeline'), message: 'Found ' + result.instances.length + ' instances' });
    } else {
      showToast({ kind: 'warning', title: t('matchFrame.revealInTimeline'), message: t('matchFrame.noSourceFound') });
    }
  }, [project, t, setSelectedClipIds, showToast]);

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
      navigatePrevGap: () => {
        const gaps = computeTimelineGaps(project.timeline);
        const target = navigateGap(gaps, playheadTime, -1);
        if (target) setPlayheadTime(target.start);
      },
      navigateNextGap: () => {
        const gaps = computeTimelineGaps(project.timeline);
        const target = navigateGap(gaps, playheadTime, 1);
        if (target) setPlayheadTime(target.start);
      },
      renderInOut: () => void renderInOutRegion()
    }),
    [
      addAnnotationAtPlayhead,
      addBookmarkAtPlayhead,
      clearSelectedClipIds,
      deleteSelected,
      exportCurrentFrame,
      forwardPlayback,
      jumpTimelineNavigationPoint,
      markInPoint,
      markMultiRangeInPoint,
      markMultiRangeOutPoint,
      markOutPoint,
      pausePlayback,
      redo,
      reversePlayback,
      rippleDeleteSelected,
      saveProject,
      selectAllTimelineItems,
      setSelectedClipIds,
      splitSelected,
      stepFrame,
      switchToPreviousHistoryBranch,
      togglePlayback,
      toggleTimelineGridSnap,
      undo,
      matchFrameToSource,
      revealMediaInTimeline,
      navigateToNextInstance,
      renderInOutRegion,
      project,
      playheadTime,
      setPlayheadTime
    ]
  );

  const recordMacroHistory = useCallback(async (entry: MacroHistoryEntry) => {
    try {
      setMacroHistory(await appendMacroHistoryEntry(entry));
    } catch (error) {
      console.warn(zhCN.macros.history.title, error);
    }
  }, []);

  const startMacroRecording = useCallback(() => {
    macroRecorderRef.current = { active: true, replaying: false, steps: [] };
    setMacroRecordingActive(true);
    setMacroRecordingStepCount(0);
    showToast({ kind: 'info', title: zhCN.settings.macros.recordingStarted, message: zhCN.settings.macros.recordingStartedMessage });
  }, []);

  const stopMacroRecording = useCallback(async () => {
    const recorder = macroRecorderRef.current;
    if (!recorder.active) {
      return;
    }
    recorder.active = false;
    setMacroRecordingActive(false);
    setMacroRecordingStepCount(recorder.steps.length);
    const steps = recorder.steps;
    if (steps.length === 0) {
      showToast({ kind: 'warning', title: zhCN.settings.macros.recordingStopped, message: zhCN.settings.macros.recordingEmpty });
      return;
    }
    const defaultName = zhCN.settings.macros.recordingDefaultName(new Date().toLocaleString('zh-CN', { hour12: false }));
    const name = window.prompt(zhCN.settings.macros.recordNamePrompt, defaultName)?.trim();
    if (!name) {
      return;
    }
    try {
      const saved = await writeClipMacros([
        ...macros,
        {
          id: createId('macro'),
          name,
          description: zhCN.settings.macros.savedRecordingMessage(steps.length),
          steps
        }
      ]);
      setMacros(saved);
      showToast({ kind: 'success', title: zhCN.settings.macros.savedRecording, message: zhCN.settings.macros.savedRecordingMessage(steps.length) });
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.settings.macros.saveFailed, message: error instanceof Error ? error.message : zhCN.settings.macros.saveFailedMessage });
    }
  }, [macros]);

  const executeMacro = useCallback(
    async (macro: ClipMacro) => {
      const state = useEditorStore.getState();
      const target = findMacroTargetClip(state.project.timeline, state.selectedClipIds, state.playheadTime);
      const baseEntry = {
        id: createId('macro-history'),
        macroId: macro.id,
        macroName: macro.name,
        triggeredAt: new Date().toISOString(),
        shortcut: macro.shortcut
      };
      if (!target) {
        await recordMacroHistory({
          ...baseEntry,
          success: false,
          error: zhCN.settings.macros.noTargetClip
        });
        showToast({ kind: 'warning', title: zhCN.settings.macros.noTargetClip, message: zhCN.settings.macros.noTargetClipMessage });
        return;
      }
      try {
        const commands = buildMacroCommands(timelineAccessor, macro, target.id);
        if (commands.length === 0) {
          throw new Error(zhCN.settings.macros.invalidSteps);
        }
        macroRecorderRef.current.replaying = true;
        try {
          for (const command of commands) {
            commandManager.execute(command);
          }
        } finally {
          macroRecorderRef.current.replaying = false;
        }
        setSelectedClipId(target.id);
        await recordMacroHistory({
          ...baseEntry,
          targetClipId: target.id,
          targetClipName: target.name,
          success: true
        });
        showToast({ kind: 'success', title: zhCN.settings.macros.executed, message: `${macro.name} · ${target.name}` });
      } catch (error) {
        const message = error instanceof Error ? error.message : zhCN.settings.macros.executeFailed;
        await recordMacroHistory({
          ...baseEntry,
          targetClipId: target.id,
          targetClipName: target.name,
          success: false,
          error: message
        });
        showToast({ kind: 'warning', title: zhCN.settings.macros.executeFailed, message });
      }
    },
    [recordMacroHistory, setSelectedClipId]
  );

  const clearOperationReplayTimers = useCallback(() => {
    for (const timer of operationReplayTimersRef.current) {
      window.clearTimeout(timer);
    }
    operationReplayTimersRef.current = [];
  }, []);

  const applyOperationRecordingStep = useCallback((recording: OperationRecordingFile, stepIndex: number) => {
    const projectAtStep = getOperationProjectAtStep(recording, stepIndex);
    operationRecorderRef.current.replaying = true;
    try {
      commandManager.execute(new LoadProjectCommand(projectAccessor, projectAtStep, zhCN.operationRecording.replayCommand));
    } finally {
      operationRecorderRef.current.replaying = false;
    }
    setOperationRecordingStep(stepIndex);
    setSelectedClipIds([]);
    setSelectedClipId(undefined);
  }, [setSelectedClipId, setSelectedClipIds]);

  const startOperationRecording = useCallback(() => {
    clearOperationReplayTimers();
    const nextRecording = createOperationRecording(useEditorStore.getState().project);
    operationRecorderRef.current = { active: true, replaying: false, recording: nextRecording };
    setOperationRecording(nextRecording);
    setOperationRecordingActive(true);
    setOperationRecordingStep(-1);
    setOperationReplayRunning(false);
    showToast({ kind: 'info', title: zhCN.operationRecording.recordingStarted, message: zhCN.operationRecording.recordingStartedMessage });
  }, [clearOperationReplayTimers]);

  const stopOperationRecording = useCallback(() => {
    operationRecorderRef.current.active = false;
    setOperationRecordingActive(false);
    showToast({
      kind: operationRecorderRef.current.recording?.commands.length ? 'success' : 'warning',
      title: zhCN.operationRecording.recordingStopped,
      message: zhCN.operationRecording.summary(operationRecorderRef.current.recording?.commands.length ?? 0)
    });
  }, []);

  const saveOperationRecording = useCallback(async () => {
    const recording = operationRecorderRef.current.recording ?? operationRecording;
    if (!recording || recording.commands.length === 0) {
      return;
    }
    try {
      const path = await bridgeSaveFileDialog('timeline-demo.ofrecording.json', [
        { name: zhCN.operationRecording.fileDialogName, extensions: ['ofrecording.json', 'json'] }
      ]);
      if (!path) {
        return;
      }
      await bridgeWriteFile(path, serializeOperationRecording(recording));
      showToast({ kind: 'success', title: zhCN.operationRecording.savedTitle, message: zhCN.operationRecording.savedMessage(path) });
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.operationRecording.saveFailed, message: error instanceof Error ? error.message : zhCN.operationRecording.saveFailedMessage });
    }
  }, [operationRecording]);

  const loadOperationRecording = useCallback(async () => {
    try {
      const [path] = await bridgeOpenFileDialog(false, [{ name: zhCN.operationRecording.fileDialogName, extensions: ['ofrecording.json', 'json'] }]);
      if (!path) {
        return;
      }
      const parsed = parseOperationRecording(await bridgeReadFile(path));
      if (!parsed) {
        throw new Error(zhCN.operationRecording.invalidFile);
      }
      clearOperationReplayTimers();
      operationRecorderRef.current = { active: false, replaying: false, recording: parsed };
      setOperationRecording(parsed);
      setOperationRecordingActive(false);
      setOperationReplayRunning(false);
      setOperationRecordingStep(-1);
      applyOperationRecordingStep(parsed, -1);
      showToast({ kind: 'success', title: zhCN.operationRecording.loadedTitle, message: zhCN.operationRecording.summary(parsed.commands.length) });
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.operationRecording.loadFailed, message: error instanceof Error ? error.message : zhCN.operationRecording.loadFailedMessage });
    }
  }, [applyOperationRecordingStep, clearOperationReplayTimers]);

  const pauseOperationReplay = useCallback(() => {
    clearOperationReplayTimers();
    setOperationReplayRunning(false);
  }, [clearOperationReplayTimers]);

  const replayOperationRecording = useCallback(() => {
    const recording = operationRecorderRef.current.recording ?? operationRecording;
    if (!recording || recording.commands.length === 0) {
      return;
    }
    clearOperationReplayTimers();
    setOperationReplayRunning(true);
    applyOperationRecordingStep(recording, -1);
    let elapsedMs = 0;
    for (const step of buildOperationReplaySchedule(recording, operationReplaySpeed)) {
      elapsedMs += step.delayMs;
      const timer = window.setTimeout(() => {
        applyOperationRecordingStep(recording, step.index);
        if (step.index === recording.commands.length - 1) {
          operationReplayTimersRef.current = [];
          setOperationReplayRunning(false);
          showToast({ kind: 'success', title: zhCN.operationRecording.replayFinished });
        }
      }, elapsedMs);
      operationReplayTimersRef.current.push(timer);
    }
  }, [applyOperationRecordingStep, clearOperationReplayTimers, operationRecording, operationReplaySpeed]);

  const jumpOperationRecording = useCallback(
    (stepIndex: number) => {
      const recording = operationRecorderRef.current.recording ?? operationRecording;
      if (!recording) {
        return;
      }
      clearOperationReplayTimers();
      setOperationReplayRunning(false);
      applyOperationRecordingStep(recording, stepIndex);
    },
    [applyOperationRecordingStep, clearOperationReplayTimers, operationRecording]
  );

  const exportOperationRecordingSlides = useCallback(async () => {
    const recording = operationRecorderRef.current.recording ?? operationRecording;
    if (!recording || recording.commands.length === 0) {
      return;
    }
    try {
      const path = await bridgeSaveFileDialog('timeline-demo-slides.html', [{ name: zhCN.operationRecording.slidesFileDialogName, extensions: ['html'] }]);
      if (!path) {
        return;
      }
      await bridgeWriteFile(path, generateOperationRecordingSlidesHtml(recording, 2));
      showToast({ kind: 'success', title: zhCN.operationRecording.exportedTitle, message: path });
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.operationRecording.exportFailed, message: error instanceof Error ? error.message : zhCN.operationRecording.exportFailedMessage });
    }
  }, [operationRecording]);

  useAutosave(autosaveIntervalSeconds);
  useCloseGuard(saveProject);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || !event.shiftKey || event.key.toLowerCase() !== 'd') {
        return;
      }
      if (isEditableKeyboardTarget(event.target)) {
        return;
      }
      event.preventDefault();
      toggleProjectDocumentation();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggleProjectDocumentation]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && shortcutCheatsheetOpen) {
        event.preventDefault();
        setShortcutCheatsheetOpen(false);
        return;
      }
      if (event.defaultPrevented || isEditableKeyboardTarget(event.target) || !isShortcutCheatsheetKey(event)) {
        return;
      }
      event.preventDefault();
      setShortcutCheatsheetOpen(true);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [shortcutCheatsheetOpen]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key !== 'c' || event.shiftKey) return;
      if (isEditableKeyboardTarget(event.target)) return;
      const state = useEditorStore.getState();
      const refs = state.selectedKeyframes;
      if (refs.length === 0) return;
      event.preventDefault();
      const timeline = state.project.timeline;
      const allClips = timeline.tracks.flatMap((t) => t.clips);
      const groups: ClipboardKeyframeGroup[] = [];
      for (const ref of refs) {
        const clip = allClips.find((c) => c.id === ref.clipId);
        if (!clip) continue;
        const kf = clip.keyframes?.[ref.property]?.find((k) => k.id === ref.keyframeId);
        if (!kf) continue;
        const existing = groups.find((g) => g.sourceClipId === ref.clipId && g.property === ref.property);
        if (existing) {
          existing.keyframes.push(kf);
        } else {
          groups.push({ sourceClipId: ref.clipId, sourceClipStart: clip.start, property: ref.property, keyframes: [kf] });
        }
      }
      if (groups.length > 0) {
        state.setClipboardKeyframes(groups);
        const count = groups.reduce((sum, g) => sum + g.keyframes.length, 0);
        showToast({ kind: 'success', title: zhCN.keyframePaste.copied(count) });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key !== 'v' || event.shiftKey) return;
      if (isEditableKeyboardTarget(event.target)) return;
      const state = useEditorStore.getState();
      const groups = state.clipboardKeyframes;
      if (!groups || groups.length === 0) {
        showToast({ kind: 'warning', title: zhCN.keyframePaste.noSelection });
        return;
      }
      if (!state.selectedClipId) {
        showToast({ kind: 'warning', title: zhCN.keyframePaste.noTarget });
        return;
      }
      setPasteKeyframeDialogGroups(groups);
      setPasteKeyframeDialogOpen(true);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);  useShortcuts(shortcutHandlers, shortcutBindings);
  useMacroShortcuts(macros, executeMacro);
  useBackgroundMediaJobs(project.media);
  useEffect(() => {
    let disposed = false;
    const runIntegrityCheck = async () => {
      const currentProject = useEditorStore.getState().project;
      await runScheduledProxyIntegrityCheck(currentProject, {
        enqueueProxyAssets: (assetIds) => {
          if (disposed || assetIds.length === 0) {
            return;
          }
          const latestProject = useEditorStore.getState().project;
          const proxySettings = useProxySettingsStore.getState().settings;
          for (const asset of latestProject.media.filter((item) => assetIds.includes(item.id))) {
            useMediaJobStore.getState().enqueueProxyJobsForMedia([asset], proxySettings, {
              force: true,
              priority: projectUsesMediaOnTimeline(latestProject, asset.id) ? 'high' : 'low'
            });
          }
          void ensureMediaJobRunner();
        }
      }).catch((error) => {
        console.warn('Unable to run proxy integrity check', error);
      });
    };
    void runIntegrityCheck();
    const timer = window.setInterval(() => void runIntegrityCheck(), 60 * 60 * 1000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    if (mediaHealthAutoShowCheckedRef.current || !mediaHealthAutoShowEnabled) {
      return;
    }
    mediaHealthAutoShowCheckedRef.current = true;
    let disposed = false;
    scanMediaHealthDashboard(useEditorStore.getState().project, useProxySettingsStore.getState().settings)
      .then((result) => {
        if (disposed) {
          return;
        }
        setMediaHealthDashboard(result.dashboard);
        setProjectHealthReport(result.report);
        if (shouldAutoShowMediaHealthDashboard({ enabled: mediaHealthAutoShowEnabled, issueCount: result.dashboard.issueCount })) {
          setMediaHealthDashboardOpen(true);
        }
      })
      .catch((error) => {
        console.warn('Unable to auto scan media health dashboard', error);
      });
    return () => {
      disposed = true;
    };
  }, [mediaHealthAutoShowEnabled]);
  const rightPrimaryPanelLabel = projectDocumentationOpen ? zhCN.panels.projectDocumentation : historyPanelOpen ? zhCN.panels.history : aiRoughCutOpen ? zhCN.aiRoughCut.title : directorModeOpen ? zhCN.directorMode.title : musicMatchOpen ? zhCN.musicMatch.title : highlightReelOpen ? zhCN.highlightReel.title : contextualTranslationOpen ? zhCN.contextualTranslation.title : aiChatEditorOpen ? zhCN.aiChatEditor.title : videoSummaryOpen ? zhCN.aiVideoSummary.title : narrationOpen ? zhCN.aiNarration.title : smartRoughCutOpen ? zhCN.panels.smartRoughCut : zhCN.panels.inspector;

  return (
    <ErrorBoundary name={zhCN.panels.editor}>
      <div className="grid h-full min-w-0 overflow-hidden bg-[#edeff3] text-ink transition-[grid-template-rows] duration-200 ease-out" style={{ gridTemplateRows: editorGridRows }} data-testid="editor-shell">
        <Toolbar
          onNewProject={newProject}
          onNewFromTemplate={() => setProjectTemplateOpen(true)}
          onSaveTimelineTemplate={() => setTimelineTemplateMode('save')}
          onNewFromTimelineTemplate={() => setTimelineTemplateMode('new')}
          onOpenProject={openProject}
          onSaveProject={() => void saveProject()}
          onSaveEncryptedProject={saveEncryptedProject}
          onArchiveProject={() => void archiveCurrentProject()}
          onOpenReleaseWorkflow={() => setReleaseWorkflowOpen(true)}
          onCreateMediaReport={() => void createMediaReport()}
          onCreateClipReport={() => void createClipReport()}
          onGenerateVideoSummary={() => setVideoSummaryOpen(true)}
          onGenerateNarration={() => setNarrationOpen(true)}
          onCreateSharePackage={() => void createCurrentSharePackage()}
          onConformMedia={() => void conformMedia()}
          onImportBookmarks={() => void importBookmarks()}
          onExportBookmarks={() => void exportBookmarks()}
          onSaveSnapshot={() => setSnapshotNameOpen(true)}
          onOpenSnapshotHistory={() => setSnapshotHistoryOpen(true)}
          onOpenSnapshotCompare={() => setSnapshotCompareOpen(true)}
          onOpenTimelineCompare={() => setTimelineCompareOpen(true)}
          onImportMedia={() => void importMedia()}
          onBatchTranscode={() => openBatchTranscode()}
          onOpenBatchWatermark={() => setBatchWatermarkOpen(true)}
          onOpenBatchProjectProcessing={() => setBatchProjectProcessingOpen(true)}
          onOpenMediaPrecheck={() => setMediaPrecheckOpen(true)}
          onOpenMediaOrganizer={openMediaOrganizer}
          onOpenMediaHealthDashboard={openMediaHealthDashboard}
          onOpenVideoStitchWizard={() => setVideoStitchWizardOpen(true)}
          onAddMotionGraphic={addMotionGraphic}
          onOpenThumbnailGenerator={() => setThumbnailGeneratorAssetIds([])}
          onOpenLutEditor={() => setLutEditorOpen(true)}
          onOpenColorNodeEditor={openColorNodeEditor}
          onOpenColorAnalysis={openColorAnalysis}
          onOpenSyncCompare={openSyncCompare}
          onOpenSceneDetection={() => setSceneDetectionRequestId((id) => id + 1)}
          onOpenSceneReorder={() => setSceneReorderOpen(true)}
          onOpenStyleTransfer={() => setStyleTransferOpen(true)}
          onOpenCollaborationNotes={() => setCollaborationNotesOpen(true)}
          onOpenOperationRecording={() => setOperationRecordingOpen(true)}
          onOpenComplexityScore={() => setComplexityScoreOpen(true)}
          onOpenSmartRecommendations={() => setSmartRecommendationsOpen(true)}
          onOpenContentAnalysis={() => setContentAnalysisOpen(true)}
          onOpenPerformanceProfiler={() => setProfilerOpen(true)}
          onOpenRhythmAnalysis={() => setRhythmAnalysisOpen(true)}
          onOpenBeatSync={() => setBeatSyncOpen(true)}
          onDetectBeats={() => void detectSelectedBeats()}
          onSnapToBeats={snapSelectedToBeats}
          onSplitToBeats={splitSelectedToBeats}
          onOpenAutoAudioSync={openAutoAudioSync}
          onOpenMacroHistory={() => setMacroHistoryOpen(true)}
          onStartMacroRecording={startMacroRecording}
          onStopMacroRecording={() => void stopMacroRecording()}
          onImportSubtitles={() => void importSubtitles()}
          onImportDataSubtitles={(mode) => void importDataSubtitles(mode)}
          onStartRecording={(source) => void startEditorRecording(source)}
          onStopRecording={() => void stopEditorRecording()}
          onExportVideo={() => setExportDialogOpen(true)}
          onExportTimeline={() => setTimelineExportDialogOpen(true)}
          onExportProfessionalNle={() => setProfessionalNleExportOpen(true)}
          onExportCurrentFrame={() => void exportCurrentFrame()}
          onCancelExport={() => void cancelCurrentExport()}
          onSplitSelected={splitSelected}
          onToggleSmartRoughCut={() => {
            setHistoryPanelOpen(false);
            setProjectDocumentationOpen(false);
            setSmartRoughCutOpen((open) => !open);
          }}
          onToggleAIRoughCut={() => {
            setHistoryPanelOpen(false);
            setProjectDocumentationOpen(false);
            setSmartRoughCutOpen(false);
            setDirectorModeOpen(false);
            setMusicMatchOpen(false);
            setHighlightReelOpen(false);
            setContextualTranslationOpen(false);
            setAiChatEditorOpen(false);
            setVideoSummaryOpen(false);
            setNarrationOpen(false);
            setAiRoughCutOpen((open) => !open);
          }}
          onToggleDirectorMode={() => {
            setHistoryPanelOpen(false);
            setProjectDocumentationOpen(false);
            setSmartRoughCutOpen(false);
            setAiRoughCutOpen(false);
            setMusicMatchOpen(false);
            setHighlightReelOpen(false);
            setContextualTranslationOpen(false);
            setAiChatEditorOpen(false);
            setVideoSummaryOpen(false);
            setNarrationOpen(false);
            setDirectorModeOpen((open) => !open);
          }}
          onToggleMusicMatch={() => {
            setHistoryPanelOpen(false);
            setProjectDocumentationOpen(false);
            setSmartRoughCutOpen(false);
            setAiRoughCutOpen(false);
            setDirectorModeOpen(false);
            setHighlightReelOpen(false);
            setContextualTranslationOpen(false);
            setAiChatEditorOpen(false);
            setVideoSummaryOpen(false);
            setNarrationOpen(false);
            setMusicMatchOpen((open) => !open);
          }}
          onToggleHighlightReel={() => {
            setHistoryPanelOpen(false);
            setProjectDocumentationOpen(false);
            setSmartRoughCutOpen(false);
            setAiRoughCutOpen(false);
            setDirectorModeOpen(false);
            setMusicMatchOpen(false);
            setContextualTranslationOpen(false);
            setAiChatEditorOpen(false);
            setVideoSummaryOpen(false);
            setNarrationOpen(false);
            setHighlightReelOpen((open) => !open);
          }}
          onToggleContextualTranslation={() => {
            setHistoryPanelOpen(false);
            setProjectDocumentationOpen(false);
            setSmartRoughCutOpen(false);
            setAiRoughCutOpen(false);
            setDirectorModeOpen(false);
            setMusicMatchOpen(false);
            setHighlightReelOpen(false);
            setAiChatEditorOpen(false);
            setVideoSummaryOpen(false);
            setNarrationOpen(false);
            setContextualTranslationOpen((open) => !open);
          }}
          onToggleAIChatEditor={() => {
            setHistoryPanelOpen(false);
            setProjectDocumentationOpen(false);
            setSmartRoughCutOpen(false);
            setAiRoughCutOpen(false);
            setDirectorModeOpen(false);
            setMusicMatchOpen(false);
            setHighlightReelOpen(false);
            setContextualTranslationOpen(false);
            setVideoSummaryOpen(false);
            setNarrationOpen(false);
            setAiChatEditorOpen((open) => !open);
          }}
          onSeparateAudio={() => void separateSelectedAudio()}
          onCancelAudioSeparation={() => void cancelAudioSeparation()}
          onRunSpeakerDiarization={() => void runSpeakerDiarization()}
          onCreateMulticamSequence={createMulticamSequence}
          onApplyPiPLayout={applyPiPLayout}
          onApplySplitLayout={applySplitLayout}
          onSaveCustomSplitLayout={(ratio) => saveCustomSplitLayout(ratio)}
          canCreateMulticamSequence={canCreateMulticamSequence}
          canApplyPiPLayout={canApplyPiPLayout}
          canApplySplitLayout={canApplySplitLayout}
          canOpenSyncCompare={canOpenSyncCompare}
          canOpenSceneDetection={canOpenSceneDetection}
          canOpenSceneReorder={canOpenSceneReorder}
          pipLayoutPosition={pipLayoutPosition}
          onPiPLayoutPositionChange={setPiPLayoutPosition}
          customSplitLayouts={customSplitLayouts}
          canDetectBeats={canDetectBeats}
          canSnapToBeats={canSnapToBeats}
          canSplitToBeats={canSplitToBeats}
          canOpenAutoAudioSync={canOpenAutoAudioSync}
          beatSensitivity={beatSensitivity}
          onBeatSensitivityChange={setBeatSensitivity}
          canSeparateAudio={canSeparateSelectedAudio}
          audioSeparationRunning={Boolean(audioSeparationClipId)}
          audioSeparationProgress={audioSeparationProgress}
          canRunSpeakerDiarization={canRunSpeakerDiarization}
          speakerDiarizationRunning={speakerDiarizationRunning}
          autoAudioSyncRunning={autoAudioSyncRunning}
          macroRecordingActive={macroRecordingActive}
          macroRecordingStepCount={macroRecordingStepCount}
          recordingActive={Boolean(recordingTask)}
          recordingElapsedSeconds={recordingElapsedSeconds}
          smartRoughCutOpen={smartRoughCutOpen}
          aiRoughCutOpen={aiRoughCutOpen}
          directorModeOpen={directorModeOpen}
          musicMatchOpen={musicMatchOpen}
          highlightReelOpen={highlightReelOpen}
          contextualTranslationOpen={contextualTranslationOpen}
          aiChatEditorOpen={aiChatEditorOpen}
          historyPanelOpen={historyPanelOpen}
          projectDocumentationOpen={projectDocumentationOpen}
          storyboardOpen={storyboardOpen}
          workspaceLayouts={workspaceLayouts}
          activeWorkspaceLayoutId={layoutSettings.activeWorkspaceLayoutId}
          onApplyWorkspaceLayout={applyWorkspaceLayoutById}
          onSaveWorkspaceLayout={() => void saveCurrentWorkspaceLayout()}
          safeFrameGuides={safeFrameGuides}
          thumbnailTrackVisible={thumbnailTrackVisible}
          timelineMinimapVisible={timelineMinimapVisible}
          timelineHeatmap={timelineHeatmap}
          previewQualityMode={previewPerformance.qualityMode}
          previewWindowOpen={previewWindowOpen}
          timelineGridSettings={timelineGridSettings}
          reviewMode={reviewMode}
          onToggleReviewMode={() => setReviewMode((mode) => !mode)}
          onCreateReviewReport={() => void createReviewReport()}
          onPreviewQualityModeChange={(qualityMode: PreviewQualityMode) => updatePreviewPerformance({ qualityMode, adaptiveEnabled: false })}
          onPopoutPreview={() => void openDetachedPreview()}
          onToggleTimelineGridSnap={toggleTimelineGridSnap}
          onTimelineGridUnitChange={changeTimelineGridUnit}
          onToggleStoryboard={() => setStoryboardOpen((open) => !open)}
          onToggleSafeFrameGuides={toggleSafeFrameGuides}
          onToggleThumbnailTrack={toggleThumbnailTrackVisible}
          onToggleTimelineMinimap={toggleTimelineMinimapVisible}
          onTimelineHeatmapChange={updateTimelineHeatmap}
          onToggleHistoryPanel={() => {
            setSmartRoughCutOpen(false);
            setAiRoughCutOpen(false);
            setProjectDocumentationOpen(false);
            setHistoryPanelOpen((open) => {
              const next = !open;
              persistPanelVisibilityPatch({ history: next });
              return next;
            });
          }}
          onToggleProjectDocumentation={toggleProjectDocumentation}
          onUndo={undo}
          onRedo={redo}
          onClearCache={() => void clearCache()}
          onOpenSettings={() => setSettingsOpen(true)}
              onOpenErrorKnowledge={() => setErrorKnowledgeOpen(true)}
              onOpenSequenceCompare={() => setSequenceCompareOpen(true)}
              onOpenSubtitleSync={() => setSubtitleSyncOpen(true)}
              onOpenProxyVerify={() => setProxyVerifyOpen(true)}
              onOpenFormatConverter={() => setFormatConverterOpen(true)}
              onOpenEmotionAnalysis={() => setEmotionAnalysisOpen(true)}
              onOpenExportHistoryClassifier={() => setExportHistoryClassifierOpen(true)}
          onStartTutorial={startTutorial}
          onOpenProjectHealth={openProjectHealth}
          sharePackageBusy={sharePackageBusy}
          autosaveIntervalSeconds={autosaveIntervalSeconds}
          onAutosaveIntervalSecondsChange={(seconds) => {
            setAutosaveIntervalSeconds(writeAutosaveIntervalSeconds(seconds));
          }}
          lastExportPath={lastExportPath}
          onRevealExport={lastExportPath ? () => void revealExport(lastExportPath) : undefined}
          lastBackupAt={lastBackupAt}
        />
        <div className="absolute right-3 top-2 z-10">
          <PerformanceAlertIcon />
        </div>
        <main
          className="grid min-h-0 min-w-0 gap-px bg-line transition-[grid-template-columns] duration-200 ease-out"
          style={{ gridTemplateColumns: mainGridColumns }}
          data-testid="editor-main-layout"
          data-left-collapsed={effectivePanels.leftPanelCollapsed ? 'true' : 'false'}
          data-right-collapsed={effectivePanels.rightPanelCollapsed ? 'true' : 'false'}
          data-right-auto-collapsed={effectivePanels.rightPanelAutoCollapsed ? 'true' : 'false'}
          data-workspace-layout={layoutSettings.activeWorkspaceLayoutId}
          data-review-mode={reviewMode ? 'true' : 'false'}
        >
          {reviewVisibility.showLeftPanel ? (
            effectivePanels.leftPanelCollapsed ? (
              <CollapsedPanelRail
                side="left"
                label={zhCN.layout.mediaPanelCollapsed}
                title={zhCN.layout.expandMediaPanel}
                testId="left-panel-expand-button"
                onClick={() => persistLayoutPatch({ leftPanelCollapsed: false, panels: { ...layoutSettings.panels, mediaLibrary: true } })}
              />
            ) : (
              <section className="relative h-full min-h-0 min-w-0 overflow-hidden" data-testid="left-panel" data-collapsed="false">
                <button
                  className="absolute right-2 top-2 z-20 inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-white/95 text-slate-600 shadow-sm hover:bg-panel"
                  type="button"
                  title={zhCN.layout.collapseMediaPanel}
                  aria-label={zhCN.layout.collapseMediaPanel}
                  data-testid="left-panel-collapse-button"
                  onClick={() => persistLayoutPatch({ leftPanelCollapsed: true, panels: { ...layoutSettings.panels, mediaLibrary: false } })}
                >
                  <ChevronLeft size={16} />
                </button>
                <MediaBin
                  media={project.media}
                  mediaFolders={project.mediaFolders}
                  mediaMetadata={project.mediaMetadata}
                  mediaContentAnalysis={mediaContentAnalysis}
                  sharedLibraryResources={sharedLibraryResources}
                  selectedClipId={selectedClipId}
                  projectFrameRate={project.settings.fps}
                  onImport={() => void importMedia()}
                  onImportPaths={(paths) => void importDropped(paths)}
                  onBatchTranscode={(paths) => openBatchTranscode(paths)}
                  onBatchGenerateCovers={() => void batchGenerateCovers()}
                  onGenerateThumbnails={(assetIds) => setThumbnailGeneratorAssetIds(assetIds)}
                  onExportGif={(asset) => setGifExportAsset(asset)}
                  onAnalyzeSpectrum={(asset) => setSpectrumAsset(asset)}
                  onScanDuplicates={() => void scanDuplicateMedia()}
                  onAddToTimeline={addAssetToTimeline}
                  onAddVersion={(assetId) => void addVersionForMedia(assetId)}
                  onCompareVersions={openMediaVersionCompare}
                  onAddAdjustmentLayer={addAdjustmentLayer}
                  onRelink={(assetId) => void relinkMedia(assetId)}
                  onRelinkAll={() => void relinkAllMissing()}
                  onGenerateProxy={(assetId) => void generateProxyForMedia(assetId)}
                  onConvertToCfr={convertVfrMediaToCfr}
                  onSetLabel={(assetId, labelColor) => setMediaMetadata(assetId, { ...project.mediaMetadata[assetId], labelColor })}
                  onSetRating={(assetId, rating) => setMediaMetadata(assetId, { ...project.mediaMetadata[assetId], rating })}
                  onSetFlag={(assetId, flag) => setMediaMetadata(assetId, { ...project.mediaMetadata[assetId], flag })}
                  onBatchUpdateMetadata={batchUpdateMediaMetadata}
                  onBatchRenameMedia={batchRenameMedia}
                  onAddTitleTemplate={addTitleTemplate}
                  onCreateFolder={createMediaFolder}
                  onRenameFolder={renameMediaFolder}
                  onDeleteFolder={deleteMediaFolder}
                  onSetFolderCollapsed={setMediaFolderCollapsed}
                  onMoveMediaToFolder={moveMediaToFolder}
                  onApplyEffectPreset={applyEffectPresetToSelectedClip}
                  favoriteIds={favoriteIds}
                  onToggleFavorite={handleToggleFavorite}
                  onRevealInTimeline={handleRevealFromMediaBin}
                  pinnedIds={pinnedIds}
                  onPinToSession={handlePinToSession}
                  recentMediaIds={recentMediaIds}
                  subclips={project.subclips}
                  onAddSubclip={handleAddSubclip}
                  onUpdateSubclip={handleUpdateSubclip}
                  onDeleteSubclip={handleDeleteSubclip}
                  onAddSubclipToTimeline={handleAddSubclipToTimeline}
                  mediaCollections={project.mediaCollections ?? []}
                  onUpdateMediaCollections={(cols) => commandManager.execute(new UpdateProjectMediaCollectionsCommand(projectAccessor, cols))}
                />
              </section>
            )
          ) : null}
          <ErrorBoundary name={zhCN.panels.preview}>
            <Suspense fallback={<PanelLoading label={zhCN.panels.preview} />}>
              {previewWindowOpen ? (
                <section className="grid min-h-0 place-items-center bg-[#111827] p-6 text-center text-white" data-testid="preview-window-placeholder">
                  <div className="max-w-sm">
                    <div className="text-sm font-semibold">{zhCN.preview.detachedPlaceholderTitle}</div>
                    <div className="mt-2 text-xs leading-5 text-slate-300">{zhCN.preview.detachedPlaceholderMessage}</div>
                    <button
                      className="mt-4 inline-flex h-9 items-center justify-center rounded-md border border-white/15 bg-white/10 px-3 text-sm font-medium text-white hover:bg-white/20"
                      type="button"
                      data-testid="preview-window-reembed-button"
                      onClick={() => void reembedPreviewWindow()}
                    >
                      {zhCN.preview.detachedReembed}
                    </button>
                  </div>
                </section>
              ) : (
                <PreviewCanvas
                  safeFrameGuides={safeFrameGuides}
                  previewPerformance={previewPerformance}
                  colorScopesVisible={layoutSettings.panels.colorScopes}
                  onColorScopesVisibleChange={(colorScopes) => persistPanelVisibilityPatch({ colorScopes })}
                  reviewMode={reviewMode}
                  onProfilerFrame={handleProfilerFrame}
                  onAddReviewAnnotation={addReviewAnnotationAtPlayhead}
                  onExportReviewReport={() => void createReviewReport()}
                />
              )}
            </Suspense>
          </ErrorBoundary>
          {reviewVisibility.showRightPanel ? (
            effectivePanels.rightPanelCollapsed ? (
              <CollapsedPanelRail
                side="right"
                label={zhCN.layout.inspectorPanelCollapsed}
                title={zhCN.layout.expandInspectorPanel}
                testId="right-panel-expand-button"
                onClick={() => persistLayoutPatch({ rightPanelCollapsed: false, panels: { ...layoutSettings.panels, inspector: true } })}
              />
            ) : (
              <aside
                className="relative grid h-full min-h-0 min-w-0 gap-px bg-line transition-[grid-template-rows] duration-200 ease-out"
                style={{ gridTemplateRows: rightPanelRows }}
                data-testid="right-panel"
                data-collapsed="false"
              >
              <button
                className="absolute right-2 top-2 z-20 inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-white/95 text-slate-600 shadow-sm hover:bg-panel"
                type="button"
                title={zhCN.layout.collapseInspectorPanel}
                aria-label={zhCN.layout.collapseInspectorPanel}
                data-testid="right-panel-collapse-button"
                onClick={() => persistLayoutPatch({ rightPanelCollapsed: true, panels: { ...layoutSettings.panels, inspector: false, audioMixer: false } })}
              >
                <ChevronRight size={16} />
              </button>
              {effectivePanels.rightPrimaryPanelVisible ? (
                <ErrorBoundary name={rightPrimaryPanelLabel}>
                  <Suspense fallback={<PanelLoading label={rightPrimaryPanelLabel} />}>
                    {projectDocumentationOpen ? (
                      <ProjectDocumentationPanel project={project} />
                    ) : historyPanelOpen ? (
                      <HistoryPanel />
                    ) : aiRoughCutOpen ? (
                      <AIRoughCutPanel media={project.media} onClose={() => setAiRoughCutOpen(false)} />
                    ) : directorModeOpen ? (
                      <DirectorModePanel media={project.media} favoriteIds={favoriteIds} onClose={() => setDirectorModeOpen(false)} />
                    ) : musicMatchOpen ? (
                      <MusicMatchPanel media={project.media} sequenceDuration={project.sequences.find((s) => s.id === project.activeSequenceId)?.settings?.duration ?? 0} onClose={() => setMusicMatchOpen(false)} />
                    ) : highlightReelOpen ? (
                      <HighlightReelPanel media={project.media} clips={project.timeline.tracks.flatMap((t) => t.clips)} selectedClipIds={selectedClipIds} onClose={() => setHighlightReelOpen(false)} />
                    ) : contextualTranslationOpen ? (
                      <ContextualTranslationPanel subtitleClips={project.timeline.tracks.filter((t) => t.type === 'subtitle').flatMap((t) => t.clips).filter((c) => c.type === 'subtitle')} onClose={() => setContextualTranslationOpen(false)} />
                    ) : aiChatEditorOpen ? (
                      <AIChatEditorPanel project={project} onClose={() => setAiChatEditorOpen(false)} />
                    ) : videoSummaryOpen ? (
                      <AIVideoSummaryPanel project={project} onClose={() => setVideoSummaryOpen(false)} />
                    ) : narrationOpen ? (
                      <AINarrationPanel project={project} onClose={() => setNarrationOpen(false)} />
                    ) : smartRoughCutOpen ? (
                      <SmartRoughCutPanel selectedClip={selectedClip} media={project.media} />
                    ) : layoutSettings.panels.inspector ? (
                      <Inspector
                        clip={selectedClip}
                        selectedClips={selectedClips}
                        selectedCount={selectedClipIds.length}
                        selectedClipLocked={selectedClipLocked}
                        selectedKeyframe={selectedKeyframe}
                        selectedKeyframes={selectedKeyframes}
                        media={project.media}
                        playheadTime={playheadTime}
                        projectSettings={project.settings}
                      />
                    ) : null}
                  </Suspense>
                </ErrorBoundary>
              ) : null}
              {effectivePanels.audioMixerVisible ? (
                <ErrorBoundary name={zhCN.panels.audioMixer}>
                  <Suspense fallback={<PanelLoading label={zhCN.panels.audioMixer} compact />}>
                    <AudioMixer />
                  </Suspense>
                </ErrorBoundary>
              ) : null}
              </aside>
            )
          ) : null}
        </main>
        {reviewVisibility.showTimelineResizeHandle ? (
          <div
            className="flex cursor-row-resize items-center justify-center bg-line text-slate-500 transition hover:bg-brand/20 hover:text-brand"
            role="separator"
            aria-orientation="horizontal"
            aria-label={zhCN.layout.resizeTimeline}
            data-testid="timeline-resize-handle"
            onPointerDown={beginTimelineResize}
          >
            <GripHorizontal size={18} />
          </div>
        ) : null}
        {reviewVisibility.showTimeline ? (
          <section className="min-h-0 overflow-hidden transition-[height] duration-200 ease-out" data-testid="timeline-panel" style={{ height: timelineHeightPx }}>
            <ErrorBoundary name={storyboardOpen ? zhCN.storyboard.title : zhCN.panels.timeline}>
              {storyboardOpen ? (
                <Suspense fallback={null}>
                  <StoryboardView />
                </Suspense>
              ) : (
                <Timeline
                  thumbnailTrackVisible={thumbnailTrackVisible}
                  minimapVisible={timelineMinimapVisible}
                  heatmap={timelineHeatmap}
                  colorHeatmap={colorHeatmapPoints}
                  colorJumps={colorAnalysisJumps}
                  timelineGridSettings={timelineGridSettings}
                  reduceMotion={timelineInteractionSettings.reduceMotion}
                  bookmarkPanelOpen={layoutSettings.panels.bookmarks}
                  onBookmarkPanelOpenChange={(bookmarks) => persistPanelVisibilityPatch({ bookmarks })}
                  onConvertMediaFrameRate={convertVfrMediaToCfr}
                  sceneDetectionRequestId={sceneDetectionRequestId}
                />
              )}
            </ErrorBoundary>
          </section>
        ) : null}
        <Suspense fallback={null}>
          <CharacterTimelinePanel />
          <PreflightChecklistPanel />
          <DubbingAdaptationPanel />
        </Suspense>
        <Suspense fallback={null}>
          {exportDialogOpen ? (
            <ExportDialog
              project={project}
              initialPreset={templateExportPreset}
              selectedClipIds={selectedClipIds}
              inPoint={inPoint}
              outPoint={outPoint}
              onClose={() => setExportDialogOpen(false)}
              onCompleted={(path) => {
                setLastExportPath(path);
                setTutorialSignals((current) => ({ ...current, videoExported: true }));
                void runAutomationForMedia('on-export-complete', useEditorStore.getState().project.media);
              }}
              onRelinkMissing={() => void relinkAllMissing()}
            />
          ) : null}
          {projectTemplateOpen ? <ProjectTemplateDialog onSelect={(templateId) => void createProjectFromTemplate(templateId)} onClose={() => setProjectTemplateOpen(false)} /> : null}
          {timelineTemplateMode ? (
            <TimelineTemplateDialog
              mode={timelineTemplateMode}
              project={project}
              selectedClipIds={selectedClipIds}
              onCreate={(nextProject) => void createProjectFromTimelineTemplate(nextProject)}
              onSaved={() => setTimelineTemplateMode(undefined)}
              onClose={() => setTimelineTemplateMode(undefined)}
            />
          ) : null}
          {timelineExportDialogOpen ? <TimelineExportDialog project={project} onClose={() => setTimelineExportDialogOpen(false)} onImportEdl={importEdlTimeline} /> : null}
          {professionalNleExportOpen ? <ProfessionalNleExportDialog project={project} onClose={() => setProfessionalNleExportOpen(false)} /> : null}
          {lutEditorOpen ? <LutEditorDialog onClose={() => setLutEditorOpen(false)} /> : null}
          {colorNodeEditorOpen && selectedClip && selectedClip.type !== 'audio' ? (
            <ColorNodeEditorDialog
              clip={selectedClip}
              onApply={(graph) => {
                commandManager.execute(new UpdateClipCommand(timelineAccessor, selectedClip.id, { colorNodeGraph: graph }));
              }}
              onClose={() => setColorNodeEditorOpen(false)}
            />
          ) : null}
          {colorAnalysisOpen ? (
            <ColorAnalysisDialog
              results={colorAnalysisResults}
              jumps={colorAnalysisJumps}
              busy={colorAnalysisBusy}
              onAnalyze={() => void runTimelineColorAnalysis()}
              onAlign={alignTimelineColorToReference}
              onClose={() => setColorAnalysisOpen(false)}
            />
          ) : null}
          {snapshotNameOpen ? <SnapshotNameDialog defaultName={project.name} onConfirm={(name) => void saveNamedSnapshot(name)} onClose={() => setSnapshotNameOpen(false)} /> : null}
          {snapshotHistoryOpen ? (
            <SnapshotHistoryDialog projectId={project.id} projectPath={projectPath} onRestore={restoreSnapshotProject} onClose={() => setSnapshotHistoryOpen(false)} />
          ) : null}
          {snapshotCompareOpen ? (
            <SnapshotVersionCompareDialog project={project} projectPath={projectPath} onApply={applySnapshotDiffSelection} onClose={() => setSnapshotCompareOpen(false)} />
          ) : null}
          {timelineCompareOpen ? (
            <TimelineCompareDialog project={project} projectPath={projectPath} onApply={applySnapshotDiffSelection} onClose={() => setTimelineCompareOpen(false)} />
          ) : null}
          {releaseWorkflowOpen ? (
            <ReleaseWorkflowDialog
              project={project}
              projectPath={projectPath}
              lastExportPath={lastExportPath}
              onReleaseCreated={updateProjectReleaseVersion}
              onApplyDiff={applySnapshotDiffSelection}
              onClose={() => setReleaseWorkflowOpen(false)}
            />
          ) : null}
          {batchTranscodeOpen ? (
            <BatchTranscodeDialog
              initialPaths={batchTranscodeInitialPaths}
              existingMedia={project.media}
              onImport={addMedia}
              onClose={() => {
                setBatchTranscodeOpen(false);
                setBatchTranscodeInitialPaths([]);
              }}
            />
          ) : null}
          {batchWatermarkOpen ? <BatchWatermarkDialog project={project} onClose={() => setBatchWatermarkOpen(false)} /> : null}
          {batchProjectProcessingOpen ? <BatchProjectProcessingDialog onClose={() => setBatchProjectProcessingOpen(false)} /> : null}
          {thumbnailGeneratorAssetIds ? (
            <ThumbnailGeneratorDialog project={project} initialAssetIds={thumbnailGeneratorAssetIds} onClose={() => setThumbnailGeneratorAssetIds(undefined)} />
          ) : null}
          {gifExportAsset ? <GifExportDialog asset={gifExportAsset} onClose={() => setGifExportAsset(undefined)} /> : null}
          {spectrumAsset ? (
            <AudioSpectrumDialog
              asset={spectrumAsset}
              onClose={() => setSpectrumAsset(undefined)}
              onSeek={(time) => seekSpectrumTime(spectrumAsset, time)}
              onSelection={setSpectrumSelectionRange}
              onSplitAtTime={(time) => splitSpectrumAtTime(spectrumAsset, time)}
            />
          ) : null}
          {mediaVersionCompare ? (
            <MediaVersionComparePanel request={mediaVersionCompare} media={project.media} onClose={() => setMediaVersionCompare(undefined)} />
          ) : null}
          {mediaPrecheckOpen ? <MediaPrecheckPanel project={project} onClose={() => setMediaPrecheckOpen(false)} onJumpToMedia={jumpToMediaAsset} /> : null}
          {videoStitchWizardOpen ? (
            <VideoStitchWizardDialog
              media={project.media}
              projectSettings={project.settings}
              onImportVideos={importVideosForStitchWizard}
              onGenerate={generateVideoStitchTimeline}
              onClose={() => setVideoStitchWizardOpen(false)}
            />
          ) : null}
          {syncCompareOpen && syncCompareClipRefs.length === 2 ? (
            <SyncComparePanel clips={[syncCompareClipRefs[0], syncCompareClipRefs[1]]} project={project} onClose={() => setSyncCompareOpen(false)} />
          ) : null}
          {sceneReorderOpen ? <SceneReorderDialog project={project} selectedClipIds={selectedClipIds} onClose={() => setSceneReorderOpen(false)} /> : null}
          {styleTransferOpen ? (
            <StyleTransferDialog project={project} selectedClipId={selectedClipId} selectedClipIds={selectedClipIds} onClose={() => setStyleTransferOpen(false)} />
          ) : null}
          {collaborationNotesOpen ? <CollaborationNotesPanel project={project} playheadTime={playheadTime} onClose={() => setCollaborationNotesOpen(false)} /> : null}
          {operationRecordingOpen ? (
            <OperationReplayDialog
              recording={operationRecording}
              recordingActive={operationRecordingActive}
              replaying={operationReplayRunning}
              currentStep={operationRecordingStep}
              speed={operationReplaySpeed}
              onStartRecording={startOperationRecording}
              onStopRecording={stopOperationRecording}
              onSaveRecording={() => void saveOperationRecording()}
              onLoadRecording={() => void loadOperationRecording()}
              onReplay={replayOperationRecording}
              onPauseReplay={pauseOperationReplay}
              onJump={jumpOperationRecording}
              onSpeedChange={(speed) => setOperationReplaySpeed(normalizeOperationReplaySpeed(speed))}
              onExportSlides={() => void exportOperationRecordingSlides()}
              onClose={() => setOperationRecordingOpen(false)}
            />
          ) : null}
          {speakerDiarizationResult ? (
            <SpeakerDiarizationDialog
              sourceName={speakerDiarizationResult.sourceName}
              segments={speakerDiarizationResult.segments}
              tracks={speakerDiarizationResult.tracks}
              onApply={() => void applySpeakerDiarization()}
              onClose={() => setSpeakerDiarizationResult(undefined)}
            />
          ) : null}
          {autoAudioSyncOpen ? (
            <AutoAudioSyncDialog
              targets={autoAudioSyncDialogTargets}
              primaryClipId={resolvedAutoAudioSyncPrimaryClipId}
              mode={autoAudioSyncMode}
              running={autoAudioSyncRunning}
              results={autoAudioSyncResults}
              onPrimaryChange={(clipId) => {
                setAutoAudioSyncPrimaryClipId(clipId);
                setAutoAudioSyncResults([]);
              }}
              onModeChange={setAutoAudioSyncMode}
              onAnalyze={() => void runAutoAudioSync()}
              onApply={applyAutoAudioSync}
              onClose={() => setAutoAudioSyncOpen(false)}
            />
          ) : null}
          {complexityScoreOpen ? <ComplexityScorePanel project={project} onClose={() => setComplexityScoreOpen(false)} /> : null}
          {smartRecommendationsOpen ? <SmartRecommendationsDialog project={project} onAddToTimeline={addAssetToTimeline} onClose={() => setSmartRecommendationsOpen(false)} /> : null}
          {contentAnalysisOpen ? (
            <ContentAnalysisDialog
              targets={contentAnalysisTargets}
              selectedClipIds={selectedClipIds}
              analyzingClipId={contentAnalysisRunningClipId}
              onAnalyze={(clipId) => void analyzeContentClip(clipId)}
              onAnalyzePreferred={() => void analyzePreferredContentTargets()}
              onExport={(clipId) => void exportContentAnalysis(clipId)}
              onClose={() => setContentAnalysisOpen(false)}
            />
          ) : null}
          {profilerOpen ? (
            <ProfilerDialog
              recording={profilerRecording}
              elapsedMs={profilerElapsedMs}
              report={profilerReport}
              onStart={startProfilerRecording}
              onStop={stopProfilerRecording}
              onExportJson={() => void exportProfilerReportJson()}
              onClose={() => {
                if (profilerRecording) {
                  stopProfilerRecording();
                }
                setProfilerOpen(false);
              }}
            />
          ) : null}
          {rhythmAnalysisOpen ? <RhythmAnalysisDialog project={project} onClose={() => setRhythmAnalysisOpen(false)} /> : null}
          {beatSyncOpen ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4" role="dialog" aria-modal="true" data-testid="beat-sync-dialog">
              <div className="w-full max-w-md rounded-lg border border-line bg-white p-4 shadow-xl">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-ink">{zhCN.toolbar.beatSync}</h2>
                    <p className="mt-1 text-sm text-slate-600" data-testid="beat-sync-bpm-label">{zhCN.toolbar.beatSyncDetectedBpm(detectedBeatBpm)}</p>
                    <p className="mt-1 text-xs text-slate-500" data-testid="beat-sync-marker-count">{zhCN.toolbar.beatSyncMarkers(beatSyncBeatTimes.length)}</p>
                  </div>
                  <button className="rounded-md border border-line px-2 py-1 text-xs text-slate-600 hover:bg-panel" type="button" data-testid="beat-sync-close-button" onClick={() => setBeatSyncOpen(false)}>
                    {zhCN.toolbar.beatSyncClose}
                  </button>
                </div>
                <div className="space-y-3">
                  <label className="flex items-center justify-between gap-3 text-sm text-slate-700">
                    <span>{zhCN.toolbar.beatSensitivity}</span>
                    <select className="rounded border border-line bg-white px-2 py-1 text-sm" value={beatSensitivity} data-testid="beat-sync-sensitivity-select" onChange={(event) => setBeatSensitivity(event.target.value as BeatSensitivity)}>
                      <option value="low">{zhCN.toolbar.beatSensitivityOptions.low}</option>
                      <option value="medium">{zhCN.toolbar.beatSensitivityOptions.medium}</option>
                      <option value="high">{zhCN.toolbar.beatSensitivityOptions.high}</option>
                    </select>
                  </label>
                  <label className="flex items-center justify-between gap-3 text-sm text-slate-700">
                    <span>{zhCN.toolbar.beatSyncManualBpm}</span>
                    <input
                      className="w-28 rounded border border-line px-2 py-1 text-right text-sm"
                      type="number"
                      min="1"
                      step="0.1"
                      value={beatSyncManualBpm}
                      data-testid="beat-sync-bpm-input"
                      onChange={(event) => setBeatSyncManualBpm(event.target.value)}
                    />
                  </label>
                  <label className="flex items-center justify-between gap-3 text-sm text-slate-700">
                    <span>{zhCN.toolbar.beatSyncSpeed}</span>
                    <input type="checkbox" checked={beatSyncSpeedEnabled} data-testid="beat-sync-speed-checkbox" onChange={(event) => setBeatSyncSpeedEnabled(event.target.checked)} />
                  </label>
                </div>
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <button className="rounded-md border border-line px-3 py-2 text-sm hover:bg-panel" type="button" data-testid="beat-sync-apply-bpm-button" onClick={applyManualBeatBpm}>
                    {zhCN.toolbar.beatSyncApplyBpm}
                  </button>
                  <button className="rounded-md border border-line px-3 py-2 text-sm hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50" type="button" disabled={!canDetectBeats} data-testid="beat-sync-detect-button" onClick={() => void detectSelectedBeats()}>
                    {zhCN.toolbar.beatSyncRunDetect}
                  </button>
                  <button className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50" type="button" disabled={!canSnapToBeats} data-testid="beat-sync-align-button" onClick={snapSelectedToBeats}>
                    {zhCN.toolbar.beatSyncRunAlign}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          {timelineSearchOpen ? <TimelineSearchPanel project={project} onClose={() => setTimelineSearchOpen(false)} /> : null}
          {shortcutCheatsheetOpen ? <ShortcutCheatsheetPanel bindings={shortcutBindings} onClose={() => setShortcutCheatsheetOpen(false)} /> : null}
          {pasteKeyframeDialogOpen && selectedClipId ? (
            <PasteKeyframeDialog
              groups={pasteKeyframeDialogGroups}
              targetClipId={selectedClipId}
              onClose={() => setPasteKeyframeDialogOpen(false)}
            />
          ) : null}
          {settingsOpen ? (
            <SettingsDialog
              open={settingsOpen}
              project={project}
              selectedClip={selectedClip}
              shortcutBindings={shortcutBindings}
              macros={macros}
              onShortcutBindingsChange={setShortcutBindings}
              onMacrosChange={setMacros}
              onExecuteMacro={(macro) => void executeMacro(macro)}
              previewPerformance={previewPerformance}
              timelineInteractionSettings={timelineInteractionSettings}
              onPreviewPerformanceChange={updatePreviewPerformance}
              onPreviewSkipFramesChange={(skipFrames: PreviewSkipFrames) => updatePreviewPerformance({ skipFrames })}
              onTimelineInteractionSettingsChange={updateTimelineInteractionSettings}
              onDeleteProxies={(assetIds) => deleteProxiesForMedia(assetIds)}
              onRegenerateProxies={(assetIds) => regenerateProxiesForMedia(assetIds)}
              onMigrateProxies={(targetDirectory) => migrateProxiesToDirectory(targetDirectory)}
              onClose={() => setSettingsOpen(false)}
            />
          ) : null}
          {macroHistoryOpen ? <MacroHistoryDialog entries={macroHistory} onClose={() => setMacroHistoryOpen(false)} /> : null}
          {errorKnowledgeOpen ? (
            <ErrorKnowledgeDialog
              stderr={""}
              onClose={() => setErrorKnowledgeOpen(false)}
            />
          ) : null}
          {sequenceCompareOpen ? (
            <SequenceCompareDialog
              project={project}
              onClose={() => setSequenceCompareOpen(false)}
            />
          ) : null}
          {subtitleSyncOpen ? (
            <SubtitleSyncPanel
              tracks={project.timeline.tracks}
              timingRefs={[]}
              projectDuration={getTimelineDuration(project.timeline)}
              onClose={() => setSubtitleSyncOpen(false)}
              onRepairSubtitle={(id, start, duration) => {
                commandManager.execute(new UpdateClipCommand(timelineAccessor, id, { start, duration }));
              }}
            />
          ) : null}
          {proxyVerifyOpen ? (
            <ProxyBatchVerifyDialog
              media={project.media}
              onClose={() => setProxyVerifyOpen(false)}
            />
          ) : null}
          {formatConverterOpen ? (
            <FormatConverterDialog
              open={formatConverterOpen}
              onClose={() => setFormatConverterOpen(false)}
              initialFiles={formatConverterMockFiles}
            />
          ) : null}
          {emotionAnalysisOpen ? (
            <EmotionAnalysisPanel
              open={emotionAnalysisOpen}
              onClose={() => setEmotionAnalysisOpen(false)}
              subtitleClips={mockSubtitleClips}
              onApplyStyles={() => {}}
            />
          ) : null}
          {exportHistoryClassifierOpen ? (
            <ExportHistoryClassifierPanel
              open={exportHistoryClassifierOpen}
              onClose={() => setExportHistoryClassifierOpen(false)}
              history={mockExportHistory}
            />
          ) : null}
          <PerformanceMonitorPanel
            open={usePerformanceMonitorStore((s) => s.panelOpen)}
          onClose={() => usePerformanceMonitorStore.getState().setPanelOpen(false)}
         />
        {projectEncryptionSaveOpen ? (
          <ProjectEncryptionSaveDialog
            onConfirm={(options) => void confirmProjectEncryptionSave(options)}
            onClose={() => setProjectEncryptionSaveOpen(false)}
          />
        ) : null}
        {projectPasswordRequest ? (
          <ProjectPasswordDialog
            request={projectPasswordRequest}
            onClose={() => {
              projectPasswordRequest.resolve(undefined);
              setProjectPasswordRequest(undefined);
            }}
            onConfirm={(password) => {
              projectPasswordRequest.resolve(password);
              setProjectPasswordRequest(undefined);
            }}
          />
        ) : null}
        {projectHealthOpen ? (
          <ProjectHealthDialog
            report={projectHealthReport}
            repairReport={projectHealthRepairReport}
            scanning={projectHealthScanning}
            onClose={() => setProjectHealthOpen(false)}
            onRescan={() => void refreshProjectHealth()}
            onAutoRepair={() => void autoRepairProjectHealth()}
            onRelink={(issue) => void relinkMissingFromHealth(issue)}
            onRemoveOrphan={(issue) => void removeOrphanFromHealth(issue)}
            onMergeDuplicate={(issue) => void mergeDuplicateFromHealth(issue)}
            onQueueProxy={(issue) => void queueProxyFromHealth(issue)}
          />
        ) : null}
        {duplicateMediaOpen ? (
          <DuplicateMediaDialog
            groups={duplicateMediaGroups}
            onConfirm={mergeDuplicateMediaGroups}
            onClose={() => setDuplicateMediaOpen(false)}
          />
        ) : null}
        {mediaHealthDashboardOpen ? (
          <MediaHealthDashboardDialog
            dashboard={mediaHealthDashboard}
            scanning={mediaHealthScanning}
            autoShowEnabled={mediaHealthAutoShowEnabled}
            onAutoShowEnabledChange={setMediaHealthAutoShow}
            onClose={() => setMediaHealthDashboardOpen(false)}
            onRescan={() => void refreshMediaHealthDashboard()}
            onRepair={() => void repairFromMediaHealthDashboard()}
            onOpenRelinkPanel={openMediaHealthRelinkPanel}
          />
        ) : null}
        {mediaOrganizerOpen ? (
          <MediaOrganizerDialog
            groups={mediaOrganizerGroups}
            cleanup={mediaOrganizerCleanup}
            scanning={mediaOrganizerScanning}
            onRescan={() => void refreshMediaOrganizer()}
            onConfirmDuplicateGroups={confirmMediaOrganizerDuplicateGroups}
            onRemoveMediaReferences={removeMediaOrganizerReferences}
            onArchiveUnused={() => void archiveUnusedMedia()}
            onApplyRenameTemplate={(template) => void renameUnusedMedia(template)}
            onClose={() => setMediaOrganizerOpen(false)}
          />
        ) : null}
        {recoveryCandidate ? (
          <AutosaveRecoveryDialog
            onRestore={() => void restoreRecovery()}
            onDiscard={() => void discardRecovery()}
          />
        ) : null}
        {exportQueueRecovery ? (
          <ExportQueueRecoveryDialog
            candidate={exportQueueRecovery}
            onRestoreAll={() => void restoreExportQueueRecovery(exportQueueRecovery.tasks.map((task) => task.id))}
            onRestoreSelected={(taskIds) => void restoreExportQueueRecovery(taskIds)}
            onDiscardAll={() => void discardExportQueueRecovery()}
          />
        ) : null}
        {archiveProgress ? <ArchiveProgressDialog progress={archiveProgress} /> : null}
        {sharePackageProgress ? <SharePackageProgressDialog progress={sharePackageProgress} /> : null}
        {tutorialProgress && (shouldShowTutorial(tutorialProgress) || tutorialCelebrationVisible) ? (
          <TutorialOverlay
            progress={tutorialCelebrationVisible ? { ...tutorialProgress, tutorialCompleted: true } : tutorialProgress}
            onSkip={skipTutorial}
            onCloseCelebration={closeTutorialCelebration}
          />
        ) : null}
        </Suspense>
      </div>
    </ErrorBoundary>
  );

  async function restoreRecovery(): Promise<void> {
    if (!recoveryCandidate) {
      return;
    }
    try {
      const password = isEncryptedProjectPath(recoveryCandidate.autosavePath)
        ? await requestProjectPassword(zhCN.projectFiles.encryptedOpenTitle, zhCN.projectFiles.encryptedOpenDescription)
        : undefined;
      if (isEncryptedProjectPath(recoveryCandidate.autosavePath) && !password) {
        return;
      }
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

  async function discardRecovery(): Promise<void> {
    if (!recoveryCandidate) {
      return;
    }
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
    if (paths.length === 0) {
      return;
    }
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
    if (paths.length === 0) {
      return;
    }
    let importedCount = 0;
    for (const path of paths) {
      const contents = await readSubtitleText(path);
      let cues = parseSubtitleDataFile(path, contents);
      const overlaps = detectSubtitleDataOverlaps(cues);
      if (overlaps.length > 0) {
        showToast({
          kind: 'warning',
          title: zhCN.editorToasts.subtitleDataImportOverlaps,
          message: zhCN.editorToasts.subtitleDataImportOverlapsMessage(overlaps.length)
        });
        const shouldMerge = await bridgeConfirm(zhCN.editorToasts.subtitleDataImportMergePrompt(overlaps.length));
        if (shouldMerge) {
          cues = mergeOverlappingSubtitleDataCues(cues);
        }
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
}


function projectTemplateCopy(templateId: ProjectTemplateId): { name: string; description: string } {
  const templates = zhCN.projectTemplates.templates;
  switch (templateId) {
    case 'vertical-short':
      return templates.verticalShort;
    case 'youtube-horizontal':
      return templates.youtubeHorizontal;
    case 'square-social':
      return templates.squareSocial;
    case 'podcast':
      return templates.podcast;
    case 'cinema':
      return templates.cinema;
  }
}

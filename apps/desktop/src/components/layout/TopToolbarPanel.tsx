import { lazy, Suspense } from 'react';
import type { BeatSensitivity, PiPLayoutPosition, SplitLayoutDefinition, SubtitleDataImportMode, TimelineGridSettings, TimelineGridUnit } from '@open-factory/editor-core';
import type { PreviewQualityMode } from '../lib/preview/preview-performance';
import type { WorkspaceLayoutDefinition, WorkspaceLayoutId } from '../layout/layoutSettings';
import type { TimelineHeatmapViewSettings } from '../settings/appSettings';
import type { RecordingSource } from '../lib/tauri-bridge';

const Toolbar = lazy(() => import('./Toolbar').then((module) => ({ default: module.Toolbar })));

interface TopToolbarPanelProps {
  // 项目操作
  onNewProject: () => void;
  onNewFromTemplate: () => void;
  onSaveTimelineTemplate: () => void;
  onNewFromTimelineTemplate: () => void;
  onOpenProject: () => void;
  onSaveProject: () => void;
  onSaveEncryptedProject: () => void;
  onArchiveProject: () => void;
  onOpenReleaseWorkflow: () => void;
  onCreateMediaReport: () => void;
  onCreateClipReport: () => void;
  onGenerateVideoSummary: () => void;
  onGenerateNarration: () => void;
  onOpenAssistEditing: () => void;
  onOpenContentGeneration: () => void;
  onOpenQualityAssessment: () => void;
  onCreateSharePackage: () => void;
  onConformMedia: () => void;
  onImportBookmarks: () => void;
  onExportBookmarks: () => void;
  onSaveSnapshot: () => void;
  onOpenSnapshotHistory: () => void;
  onOpenSnapshotCompare: () => void;
  onOpenTimelineCompare: () => void;

  // 媒体操作
  onImportMedia: () => void;
  onBatchTranscode: () => void;
  onOpenBatchWatermark: () => void;
  onOpenBatchProjectProcessing: () => void;
  onOpenMediaPrecheck: () => void;
  onOpenMediaOrganizer: () => void;
  onOpenMediaHealthDashboard: () => void;
  onOpenVideoStitchWizard: () => void;
  onOpenSmartMontage: () => void;
  onAddMotionGraphic: () => void;
  onOpenThumbnailGenerator: () => void;
  onOpenLutEditor: () => void;
  onOpenColorNodeEditor: () => void;
  onOpenColorAnalysis: () => void;
  onOpenSyncCompare: () => void;
  onOpenSceneDetection: () => void;
  onOpenSceneReorder: () => void;
  onOpenStyleTransfer: () => void;
  onOpenCollaborationNotes: () => void;
  onOpenOperationRecording: () => void;
  onOpenComplexityScore: () => void;
  onOpenSmartRecommendations: () => void;
  onOpenContentAnalysis: () => void;
  onOpenPerformanceProfiler: () => void;
  onOpenRhythmAnalysis: () => void;
  onOpenBeatSync: () => void;
  onDetectBeats: () => void;
  onSnapToBeats: () => void;
  onSplitToBeats: () => void;
  onOpenAutoAudioSync: () => void;
  onOpenMacroHistory: () => void;
  onStartMacroRecording: () => void;
  onStopMacroRecording: () => void;
  onImportSubtitles: () => void;
  onImportDataSubtitles: (mode: SubtitleDataImportMode) => void;
  onStartRecording: (source: RecordingSource) => void;
  onStopRecording: () => void;

  // 导出操作
  onExportVideo: () => void;
  onExportTimeline: () => void;
  onExportProfessionalNle: () => void;
  onExportCurrentFrame: () => void;
  onCancelExport: () => void;

  // 时间线操作
  onSplitSelected: () => void;
  onToggleSmartRoughCut: () => void;
  onToggleAIRoughCut: () => void;
  onToggleDirectorMode: () => void;
  onToggleMusicMatch: () => void;
  onToggleHighlightReel: () => void;
  onToggleContextualTranslation: () => void;
  onToggleAIChatEditor: () => void;
  onToggleSmartCreation: () => void;
  onSeparateAudio: () => void;
  onCancelAudioSeparation: () => void;
  onRunSpeakerDiarization: () => void;
  onCreateMulticamSequence: () => void;
  onApplyPiPLayout: (layout: SplitLayoutDefinition) => void;
  onApplySplitLayout: (layout: SplitLayoutDefinition) => void;
  onSaveCustomSplitLayout: (ratio: [number, number]) => void;

  // 状态
  canCreateMulticamSequence: boolean;
  canApplyPiPLayout: boolean;
  canApplySplitLayout: boolean;
  canOpenSyncCompare: boolean;
  canOpenSceneDetection: boolean;
  canOpenSceneReorder: boolean;
  pipLayoutPosition: PiPLayoutPosition;
  onPiPLayoutPositionChange: (position: PiPLayoutPosition) => void;
  customSplitLayouts: SplitLayoutDefinition[];
  canDetectBeats: boolean;
  canSnapToBeats: boolean;
  canSplitToBeats: boolean;
  canOpenAutoAudioSync: boolean;
  beatSensitivity: BeatSensitivity;
  onBeatSensitivityChange: (sensitivity: BeatSensitivity) => void;
  canSeparateAudio: boolean;
  audioSeparationRunning: boolean;
  audioSeparationProgress: number | undefined;
  canRunSpeakerDiarization: boolean;
  speakerDiarizationRunning: boolean;
  autoAudioSyncRunning: boolean;
  macroRecordingActive: boolean;
  macroRecordingStepCount: number;
  recordingActive: boolean;
  recordingElapsedSeconds: number;

  // 面板状态
  smartRoughCutOpen: boolean;
  aiRoughCutOpen: boolean;
  directorModeOpen: boolean;
  musicMatchOpen: boolean;
  highlightReelOpen: boolean;
  contextualTranslationOpen: boolean;
  aiChatEditorOpen: boolean;
  smartCreationOpen: boolean;
  historyPanelOpen: boolean;
  projectDocumentationOpen: boolean;
  storyboardOpen: boolean;

  // 工作区布局
  workspaceLayouts: WorkspaceLayoutDefinition[];
  activeWorkspaceLayoutId: WorkspaceLayoutId;
  onApplyWorkspaceLayout: (id: WorkspaceLayoutId) => void;
  onSaveWorkspaceLayout: () => void;

  // 视图设置
  safeFrameGuides: boolean;
  thumbnailTrackVisible: boolean;
  timelineMinimapVisible: boolean;
  timelineHeatmap: TimelineHeatmapViewSettings;
  previewQualityMode: PreviewQualityMode;
  previewWindowOpen: boolean;
  timelineGridSettings: TimelineGridSettings;
  reviewMode: boolean;
  onToggleReviewMode: () => void;
  onCreateReviewReport: () => void;
  onPreviewQualityModeChange: (qualityMode: PreviewQualityMode) => void;
  onPopoutPreview: () => void;
  onToggleTimelineGridSnap: () => void;
  onTimelineGridUnitChange: (unit: TimelineGridUnit) => void;
  onToggleStoryboard: () => void;
  onToggleSafeFrameGuides: () => void;
  onToggleThumbnailTrack: () => void;
  onToggleTimelineMinimap: () => void;
  onTimelineHeatmapChange: (heatmap: TimelineHeatmapViewSettings) => void;
  onToggleHistoryPanel: () => void;
  onToggleProjectDocumentation: () => void;

  // 撤销/重做
  onUndo: () => void;
  onRedo: () => void;
  onClearCache: () => void;
  onOpenSettings: () => void;
  onOpenErrorKnowledge: () => void;
  onOpenSequenceCompare: () => void;
  onOpenSubtitleSync: () => void;
  onOpenProxyVerify: () => void;
  onOpenFormatConverter: () => void;
  onOpenEmotionAnalysis: () => void;
  onOpenExportHistoryClassifier: () => void;
  onStartTutorial: () => void;
  onOpenProjectHealth: () => void;
  sharePackageBusy: boolean;
  autosaveIntervalSeconds: number;
  onAutosaveIntervalSecondsChange: (seconds: number) => void;
  lastExportPath: string | undefined;
  onRevealExport: (() => void) | undefined;
  lastBackupAt: string | undefined;
}

/**
 * 顶部工具栏面板组件。
 * 从 EditorShell 中提取，负责渲染 Toolbar 和相关快捷键。
 */
export function TopToolbarPanel(props: TopToolbarPanelProps) {
  return (
    <Suspense fallback={null}>
      <Toolbar {...props} />
    </Suspense>
  );
}

import { lazy } from 'react';

export const AudioMixer = lazy(() => import('./AudioMixer/AudioMixer').then((module) => ({ default: module.AudioMixer })));
export const Inspector = lazy(() => import('./Inspector/Inspector').then((module) => ({ default: module.Inspector })));
export const SmartRoughCutPanel = lazy(() =>
  import('./SmartRoughCut/SmartRoughCutPanel').then((module) => ({ default: module.SmartRoughCutPanel })),
);
export const SmartRoughCutOrchestratorPanel = lazy(() =>
  import('./SmartRoughCut/SmartRoughCutOrchestratorPanel').then((module) => ({
    default: module.SmartRoughCutOrchestratorPanel,
  })),
);
export const AIRoughCutPanel = lazy(() =>
  import('./AIRoughCut/AIRoughCutPanel').then((module) => ({ default: module.AIRoughCutPanel })),
);
export const DirectorModePanel = lazy(() =>
  import('./DirectorMode/DirectorModePanel').then((module) => ({ default: module.DirectorModePanel })),
);
export const MusicMatchPanel = lazy(() =>
  import('./MusicMatch/MusicMatchPanel').then((module) => ({ default: module.MusicMatchPanel })),
);
export const HighlightReelPanel = lazy(() =>
  import('./HighlightReel/HighlightReelPanel').then((module) => ({ default: module.HighlightReelPanel })),
);
export const ContextualTranslationPanel = lazy(() =>
  import('./ContextualTranslation/ContextualTranslationPanel').then((module) => ({
    default: module.ContextualTranslationPanel,
  })),
);
export const AIChatEditorPanel = lazy(() =>
  import('./AIChatEditor/AIChatEditorPanel').then((module) => ({ default: module.AIChatEditorPanel })),
);
export const AIVideoSummaryPanel = lazy(() =>
  import('./AIVideoSummary/AIVideoSummaryPanel').then((module) => ({ default: module.AIVideoSummaryPanel })),
);
export const AINarrationPanel = lazy(() =>
  import('./AINarration/AINarrationPanel').then((module) => ({ default: module.AINarrationPanel })),
);
export const SmartCreationPanel = lazy(() =>
  import('./SmartCreation/SmartCreationPanel').then((module) => ({ default: module.SmartCreationPanel })),
);
export const HistoryPanel = lazy(() => import('./History/HistoryPanel').then((module) => ({ default: module.HistoryPanel })));
export const ProjectDocumentationPanel = lazy(() =>
  import('./ProjectDocumentationPanel').then((module) => ({ default: module.ProjectDocumentationPanel })),
);
export const MediaPrecheckPanel = lazy(() =>
  import('../media/MediaPrecheckPanel').then((module) => ({ default: module.MediaPrecheckPanel })),
);
export const SyncComparePanel = lazy(() =>
  import('../sync-compare/SyncComparePanel').then((module) => ({ default: module.SyncComparePanel })),
);
export const CollaborationNotesPanel = lazy(() => import('../collaboration/CollaborationNotesPanel'));
export const ComplexityScorePanel = lazy(() =>
  import('../complexity/ComplexityScorePanel').then((module) => ({ default: module.ComplexityScorePanel })),
);
export const TimelineSearchPanel = lazy(() =>
  import('../timeline-search/TimelineSearchPanel').then((module) => ({ default: module.TimelineSearchPanel })),
);
export const SnapshotNameDialog = lazy(() =>
  import('../project-snapshots/SnapshotNameDialog').then((module) => ({ default: module.SnapshotNameDialog })),
);
export const SnapshotHistoryDialog = lazy(() =>
  import('../project-snapshots/SnapshotHistoryDialog').then((module) => ({ default: module.SnapshotHistoryDialog })),
);
export const SnapshotVersionCompareDialog = lazy(() =>
  import('../project-snapshots/SnapshotVersionCompareDialog').then((module) => ({
    default: module.SnapshotVersionCompareDialog,
  })),
);
export const TimelineCompareDialog = lazy(() =>
  import('../timeline-compare/TimelineCompareDialog').then((module) => ({ default: module.TimelineCompareDialog })),
);
export const ReleaseWorkflowDialog = lazy(() =>
  import('../release/ReleaseWorkflowDialog').then((module) => ({ default: module.ReleaseWorkflowDialog })),
);
export const ThumbnailGeneratorDialog = lazy(() =>
  import('../thumbnail/ThumbnailGeneratorDialog').then((module) => ({ default: module.ThumbnailGeneratorDialog })),
);
export const PerformanceMonitorPanel = lazy(() =>
  import('./PerformanceMonitorPanel').then((module) => ({ default: module.PerformanceMonitorPanel })),
);
export const AutoAudioSyncDialog = lazy(() =>
  import('../audio-sync/AutoAudioSyncDialog').then((module) => ({ default: module.AutoAudioSyncDialog })),
);
export const DuplicateMediaDialog = lazy(() =>
  import('../media/DuplicateMediaDialog').then((module) => ({ default: module.DuplicateMediaDialog })),
);
export const MediaOrganizerDialog = lazy(() =>
  import('../media/MediaOrganizerDialog').then((module) => ({ default: module.MediaOrganizerDialog })),
);
export const ProjectHealthDialog = lazy(() =>
  import('../project-health/ProjectHealthDialog').then((module) => ({ default: module.ProjectHealthDialog })),
);
export const MediaHealthDashboardDialog = lazy(() =>
  import('../media/MediaHealthDashboardDialog').then((module) => ({ default: module.MediaHealthDashboardDialog })),
);
export const ProjectTemplateDialog = lazy(() =>
  import('../project-templates/ProjectTemplateDialog').then((module) => ({ default: module.ProjectTemplateDialog })),
);
export const TimelineTemplateDialog = lazy(() =>
  import('../timeline-templates/TimelineTemplateDialog').then((module) => ({ default: module.TimelineTemplateDialog })),
);
export const MediaVersionComparePanel = lazy(() =>
  import('./MediaVersionComparePanel').then((module) => ({ default: module.MediaVersionComparePanel })),
);
export const ProjectEncryptionSaveDialog = lazy(() =>
  import('./dialogs/ProjectEncryptionSaveDialog').then((module) => ({ default: module.ProjectEncryptionSaveDialog })),
);
export const ProjectPasswordDialog = lazy(() =>
  import('./dialogs/ProjectPasswordDialog').then((module) => ({ default: module.ProjectPasswordDialog })),
);
export const AutosaveRecoveryDialog = lazy(() =>
  import('./dialogs/AutosaveRecoveryDialog').then((module) => ({ default: module.AutosaveRecoveryDialog })),
);
export const ExportQueueRecoveryDialog = lazy(() =>
  import('./dialogs/ExportQueueRecoveryDialog').then((module) => ({ default: module.ExportQueueRecoveryDialog })),
);
export const ArchiveProgressDialog = lazy(() =>
  import('./dialogs/ArchiveProgressDialog').then((module) => ({ default: module.ArchiveProgressDialog })),
);
export const PasteKeyframeDialog = lazy(() =>
  import('./dialogs/PasteKeyframeDialog').then((module) => ({ default: module.PasteKeyframeDialog })),
);
export const SharePackageProgressDialog = lazy(() =>
  import('./dialogs/SharePackageProgressDialog').then((module) => ({ default: module.SharePackageProgressDialog })),
);
export const CharacterTimelinePanel = lazy(() =>
  import('./Timeline/CharacterTimelinePanel').then((module) => ({ default: module.CharacterTimelinePanel })),
);
export const PreflightChecklistPanel = lazy(() =>
  import('./Export/PreflightChecklistPanel').then((module) => ({ default: module.PreflightChecklistPanel })),
);
export const DubbingAdaptationPanel = lazy(() =>
  import('./Export/DubbingAdaptationPanel').then((module) => ({ default: module.DubbingAdaptationPanel })),
);
export const CommandPalette = lazy(() =>
  import('./CommandPalette/CommandPalette').then((module) => ({ default: module.CommandPalette })),
);
export const GestureTutorialOverlay = lazy(() =>
  import('./GestureControl/GestureTutorial').then((module) => ({ default: module.GestureTutorialOverlay })),
);
export const RoughCutComparePanel = lazy(() =>
  import('./SmartRoughCut/RoughCutComparePanel').then((module) => ({ default: module.RoughCutComparePanel })),
);

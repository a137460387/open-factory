import { useMemo } from 'react';
import type {
  OperationReplaySpeed,
  MediaAsset,
  Project,
  ProjectTemplateId,
  TimelineColorAnalysisResult,
  SceneColorDifference,
  OperationRecordingFile,
  PerformanceProfilerReport,
  SyncCompareClipRef,
  SpeakerDiarizationSegment,
  Track,
  MissingMediaIssue,
  OrphanMediaIssue,
  DuplicateMediaIssue,
  ProxyMissingIssue,
} from '@open-factory/editor-core';
import type { ExportPreset } from '../export/export-presets';
import type { AutosaveRecoveryCandidate, ProjectFileEncryptionOptions } from '../lib/projectFiles';
import type { ArchiveProgress } from '../lib/projectArchive';
import type { ExportQueueRecoveryCandidate } from '../export/export-queue-persistence';
import type { SharePackageWorkflowProgress } from '../lib/sharePackage';
import type { ContentAnalysisTarget } from '../media/ContentAnalysisDialog';
import type { DuplicateMediaMergeSelection } from '../media/DuplicateMediaDialog';
import type { MediaOrganizerDuplicateSelection } from '../media/MediaOrganizerDialog';
import type { VideoStitchWizardSettings } from '../video-stitching/VideoStitchWizardDialog';
import type { ClipMacro } from '../macros/clip-macros';
import type { PreviewPerformanceSettings } from '../lib/preview/preview-performance';
import type { TimelineInteractionSettings } from '../settings/appSettings';
import type { TutorialSignals } from '../tutorial/tutorialState';
import { useEditorStore } from '../store/editorStore';

interface FloatingDialogsDeps {
  templateExportPreset: ExportPreset | undefined;
  exportDialogOpen: boolean;
  setExportDialogOpen: (v: boolean) => void;
  timelineExportDialogOpen: boolean;
  setTimelineExportDialogOpen: (v: boolean) => void;
  lastExportPath: string | undefined;
  setLastExportPath: (p: string) => void;
  setTutorialSignals: React.Dispatch<React.SetStateAction<TutorialSignals>>;
  runAutomationForMedia: (trigger: 'on-import' | 'on-export-complete' | 'on-project-open', media: MediaAsset[]) => Promise<void>;
  relinkAllMissing: () => Promise<void>;
  importEdlTimeline: (contents: string, path: string) => { title: string; matchedCount: number; missingCount: number };
  importFcpXmlTimeline: (contents: string, path: string) => { title: string; matchedCount: number; missingCount: number };
  addMedia: (media: MediaAsset[]) => void;
  createProjectFromTemplate: (templateId: ProjectTemplateId) => Promise<void>;
  createProjectFromTimelineTemplate: (nextProject: Project) => Promise<void>;
  colorAnalysisResults: TimelineColorAnalysisResult[];
  colorAnalysisJumps: SceneColorDifference[];
  colorAnalysisBusy: boolean;
  runTimelineColorAnalysis: () => void;
  alignTimelineColorToReference: (referenceClipId: string) => void;
  seekSpectrumTime: (asset: MediaAsset, sourceTime: number) => void;
  setSpectrumSelectionRange: (range: { inPoint: number; outPoint: number }) => void;
  splitSpectrumAtTime: (asset: MediaAsset, sourceTime: number) => void;
  importVideosForStitchWizard: () => Promise<string[]>;
  generateVideoStitchTimeline: (settings: VideoStitchWizardSettings) => void;
  generateSmartMontage: (config: { videoAssetIds: string[]; audioAssetId: string; beatTimes: number[]; sensitivity: string }) => void;
  addAssetToTimeline: (assetId: string) => void;
  analyzeContentClip: (clipId: string) => Promise<void>;
  analyzePreferredContentTargets: () => void;
  exportContentAnalysis: (clipId: string) => Promise<void>;
  applySpeakerDiarization: () => void;
  speakerDiarizationResult: { sourceName: string; segments: SpeakerDiarizationSegment[]; tracks: Track[] } | undefined;
  contentAnalysisTargets: ContentAnalysisTarget[];
  operationRecording: OperationRecordingFile | undefined;
  operationRecordingActive: boolean;
  operationReplayRunning: boolean;
  operationRecordingStep: number;
  operationReplaySpeed: OperationReplaySpeed;
  startOperationRecording: () => void;
  stopOperationRecording: () => void;
  saveOperationRecording: () => void;
  loadOperationRecording: () => void;
  replayOperationRecording: () => void;
  pauseOperationReplay: () => void;
  jumpOperationRecording: (step: number) => void;
  exportOperationRecordingSlides: () => void;
  profilerRecording: boolean;
  profilerElapsedMs: number;
  profilerReport: PerformanceProfilerReport | undefined;
  startProfilerRecording: () => void;
  stopProfilerRecording: () => void;
  exportProfilerReportJson: () => void;
  saveNamedSnapshot: (name: string) => Promise<void>;
  restoreSnapshotProject: (snapshotProject: Project) => void;
  applySnapshotDiffSelection: (sourceProject: Project, itemIds: string[]) => void;
  updateProjectReleaseVersion: (version: string) => void;
  syncCompareClipRefs: SyncCompareClipRef[];
  jumpToMediaAsset: (assetId: string) => void;
  detectedBeatBpm: number | undefined;
  beatSyncBeatTimes: number[];
  canDetectBeats: boolean;
  canSnapToBeats: boolean;
  applyManualBeatBpm: () => void;
  detectSelectedBeats: () => Promise<void>;
  snapSelectedToBeats: () => void;
  updatePreviewPerformance: (settings: Partial<PreviewPerformanceSettings>) => void;
  updateTimelineInteractionSettings: (settings: Partial<TimelineInteractionSettings>) => void;
  deleteProxiesForMedia: (assetIds: string[]) => Promise<void>;
  regenerateProxiesForMedia: (assetIds: string[]) => Promise<void>;
  migrateProxiesToDirectory: (targetDirectory: string) => Promise<void>;
  executeMacro: (macro: ClipMacro) => Promise<void>;
  confirmProjectEncryptionSave: (options: ProjectFileEncryptionOptions) => Promise<void>;
  refreshProjectHealth: () => Promise<void>;
  autoRepairProjectHealth: () => Promise<void>;
  relinkMissingFromHealth: (issue: MissingMediaIssue) => Promise<void>;
  removeOrphanFromHealth: (issue: OrphanMediaIssue) => Promise<void>;
  mergeDuplicateFromHealth: (group: DuplicateMediaIssue) => Promise<void>;
  queueProxyFromHealth: (issue: ProxyMissingIssue) => Promise<void>;
  mergeDuplicateMediaGroups: (selections: DuplicateMediaMergeSelection[]) => void;
  refreshMediaHealthDashboard: () => Promise<unknown>;
  repairFromMediaHealthDashboard: () => Promise<void>;
  openMediaHealthRelinkPanel: () => void;
  refreshMediaOrganizer: () => Promise<void>;
  confirmMediaOrganizerDuplicateGroups: (selections: MediaOrganizerDuplicateSelection[], moveFilesToTrash: boolean) => Promise<void>;
  removeMediaOrganizerReferences: (assetIds: string[]) => void;
  archiveUnusedMedia: () => Promise<void>;
  renameUnusedMedia: (template: string) => Promise<void>;
  recoveryCandidate: AutosaveRecoveryCandidate | undefined;
  exportQueueRecovery: ExportQueueRecoveryCandidate | undefined;
  archiveProgress: ArchiveProgress | undefined;
  sharePackageProgress: SharePackageWorkflowProgress | undefined;
  restoreRecovery: (candidate: AutosaveRecoveryCandidate) => Promise<void>;
  discardRecovery: (candidate: AutosaveRecoveryCandidate) => Promise<void>;
  restoreExportQueueRecovery: (taskIds: string[]) => Promise<void>;
  discardExportQueueRecovery: () => Promise<void>;
  skipTutorial: () => void;
  closeTutorialCelebration: () => void;
}

/**
 * FloatingDialogs callbacks extracted from EditorShell.
 * Collects all props for the ShellFloatingDialogs component.
 */
export function useEditorShellFloatingDialogsCallbacks(deps: FloatingDialogsDeps) {
  const floatingDialogsCallbacks = useMemo(
    () => ({
      templateExportPreset: deps.templateExportPreset,
      exportDialogOpen: deps.exportDialogOpen,
      setExportDialogOpen: deps.setExportDialogOpen,
      timelineExportDialogOpen: deps.timelineExportDialogOpen,
      setTimelineExportDialogOpen: deps.setTimelineExportDialogOpen,
      lastExportPath: deps.lastExportPath,
      onExportCompleted: (path: string) => {
        deps.setLastExportPath(path);
        deps.setTutorialSignals((current: TutorialSignals) => ({ ...current, videoExported: true }));
        void deps.runAutomationForMedia('on-export-complete', useEditorStore.getState().project.media);
      },
      onRelinkMissing: () => void deps.relinkAllMissing(),
      importEdlTimeline: deps.importEdlTimeline,
      importFcpXmlTimeline: deps.importFcpXmlTimeline,
      addMedia: deps.addMedia,
      createProjectFromTemplate: deps.createProjectFromTemplate,
      createProjectFromTimelineTemplate: deps.createProjectFromTimelineTemplate,
      colorAnalysisResults: deps.colorAnalysisResults,
      colorAnalysisJumps: deps.colorAnalysisJumps,
      colorAnalysisBusy: deps.colorAnalysisBusy,
      runTimelineColorAnalysis: deps.runTimelineColorAnalysis,
      alignTimelineColorToReference: deps.alignTimelineColorToReference,
      seekSpectrumTime: deps.seekSpectrumTime,
      setSpectrumSelectionRange: deps.setSpectrumSelectionRange,
      splitSpectrumAtTime: deps.splitSpectrumAtTime,
      importVideosForStitchWizard: deps.importVideosForStitchWizard,
      generateVideoStitchTimeline: deps.generateVideoStitchTimeline,
      generateSmartMontage: deps.generateSmartMontage,
      addAssetToTimeline: deps.addAssetToTimeline,
      analyzeContentClip: deps.analyzeContentClip,
      analyzePreferredContentTargets: deps.analyzePreferredContentTargets,
      exportContentAnalysis: deps.exportContentAnalysis,
      applySpeakerDiarization: deps.applySpeakerDiarization,
      speakerDiarizationResult: deps.speakerDiarizationResult,
      contentAnalysisTargets: deps.contentAnalysisTargets,
      operationRecording: deps.operationRecording,
      operationRecordingActive: deps.operationRecordingActive,
      operationReplayRunning: deps.operationReplayRunning,
      operationRecordingStep: deps.operationRecordingStep,
      operationReplaySpeed: deps.operationReplaySpeed,
      startOperationRecording: deps.startOperationRecording,
      stopOperationRecording: deps.stopOperationRecording,
      saveOperationRecording: deps.saveOperationRecording,
      loadOperationRecording: deps.loadOperationRecording,
      replayOperationRecording: deps.replayOperationRecording,
      pauseOperationReplay: deps.pauseOperationReplay,
      jumpOperationRecording: deps.jumpOperationRecording,
      exportOperationRecordingSlides: deps.exportOperationRecordingSlides,
      profilerRecording: deps.profilerRecording,
      profilerElapsedMs: deps.profilerElapsedMs,
      profilerReport: deps.profilerReport,
      startProfilerRecording: deps.startProfilerRecording,
      stopProfilerRecording: deps.stopProfilerRecording,
      exportProfilerReportJson: deps.exportProfilerReportJson,
      saveNamedSnapshot: deps.saveNamedSnapshot,
      restoreSnapshotProject: deps.restoreSnapshotProject,
      applySnapshotDiffSelection: deps.applySnapshotDiffSelection,
      updateProjectReleaseVersion: deps.updateProjectReleaseVersion,
      syncCompareClipRefs: deps.syncCompareClipRefs,
      jumpToMediaAsset: deps.jumpToMediaAsset,
      detectedBeatBpm: deps.detectedBeatBpm,
      beatSyncBeatTimes: deps.beatSyncBeatTimes,
      canDetectBeats: deps.canDetectBeats,
      canSnapToBeats: deps.canSnapToBeats,
      applyManualBeatBpm: deps.applyManualBeatBpm,
      detectSelectedBeats: () => void deps.detectSelectedBeats(),
      snapSelectedToBeats: deps.snapSelectedToBeats,
      updatePreviewPerformance: deps.updatePreviewPerformance,
      updateTimelineInteractionSettings: deps.updateTimelineInteractionSettings,
      deleteProxiesForMedia: deps.deleteProxiesForMedia,
      regenerateProxiesForMedia: deps.regenerateProxiesForMedia,
      migrateProxiesToDirectory: deps.migrateProxiesToDirectory,
      executeMacro: deps.executeMacro,
      confirmProjectEncryptionSave: deps.confirmProjectEncryptionSave,
      refreshProjectHealth: deps.refreshProjectHealth,
      autoRepairProjectHealth: deps.autoRepairProjectHealth,
      relinkMissingFromHealth: deps.relinkMissingFromHealth,
      removeOrphanFromHealth: deps.removeOrphanFromHealth,
      mergeDuplicateFromHealth: deps.mergeDuplicateFromHealth,
      queueProxyFromHealth: deps.queueProxyFromHealth,
      mergeDuplicateMediaGroups: deps.mergeDuplicateMediaGroups,
      refreshMediaHealthDashboard: deps.refreshMediaHealthDashboard,
      repairFromMediaHealthDashboard: deps.repairFromMediaHealthDashboard,
      openMediaHealthRelinkPanel: deps.openMediaHealthRelinkPanel,
      refreshMediaOrganizer: deps.refreshMediaOrganizer,
      confirmMediaOrganizerDuplicateGroups: deps.confirmMediaOrganizerDuplicateGroups,
      removeMediaOrganizerReferences: deps.removeMediaOrganizerReferences,
      archiveUnusedMedia: deps.archiveUnusedMedia,
      renameUnusedMedia: deps.renameUnusedMedia,
      recoveryCandidate: deps.recoveryCandidate,
      exportQueueRecovery: deps.exportQueueRecovery,
      archiveProgress: deps.archiveProgress,
      sharePackageProgress: deps.sharePackageProgress,
      restoreRecovery: () => deps.restoreRecovery(deps.recoveryCandidate),
      discardRecovery: () => deps.discardRecovery(deps.recoveryCandidate),
      restoreExportQueueRecovery: deps.restoreExportQueueRecovery,
      discardExportQueueRecovery: deps.discardExportQueueRecovery,
      skipTutorial: deps.skipTutorial,
      closeTutorialCelebration: deps.closeTutorialCelebration,
      runAutomationForMedia: deps.runAutomationForMedia,
      setLastExportPath: deps.setLastExportPath,
      setTutorialSignals: deps.setTutorialSignals,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      deps.templateExportPreset, deps.exportDialogOpen, deps.setExportDialogOpen,
      deps.timelineExportDialogOpen, deps.setTimelineExportDialogOpen, deps.lastExportPath,
      deps.relinkAllMissing, deps.importEdlTimeline, deps.importFcpXmlTimeline,
      deps.addMedia, deps.createProjectFromTemplate, deps.createProjectFromTimelineTemplate,
      deps.colorAnalysisResults, deps.colorAnalysisJumps, deps.colorAnalysisBusy,
      deps.runTimelineColorAnalysis, deps.alignTimelineColorToReference,
      deps.seekSpectrumTime, deps.setSpectrumSelectionRange, deps.splitSpectrumAtTime,
      deps.importVideosForStitchWizard, deps.generateVideoStitchTimeline,
      deps.generateSmartMontage, deps.addAssetToTimeline,
      deps.analyzeContentClip, deps.analyzePreferredContentTargets, deps.exportContentAnalysis,
      deps.applySpeakerDiarization, deps.speakerDiarizationResult, deps.contentAnalysisTargets,
      deps.operationRecording, deps.operationRecordingActive, deps.operationReplayRunning,
      deps.operationRecordingStep, deps.operationReplaySpeed,
      deps.startOperationRecording, deps.stopOperationRecording,
      deps.saveOperationRecording, deps.loadOperationRecording,
      deps.replayOperationRecording, deps.pauseOperationReplay,
      deps.jumpOperationRecording, deps.exportOperationRecordingSlides,
      deps.profilerRecording, deps.profilerElapsedMs, deps.profilerReport,
      deps.startProfilerRecording, deps.stopProfilerRecording, deps.exportProfilerReportJson,
      deps.saveNamedSnapshot, deps.restoreSnapshotProject, deps.applySnapshotDiffSelection,
      deps.updateProjectReleaseVersion, deps.syncCompareClipRefs, deps.jumpToMediaAsset,
      deps.detectedBeatBpm, deps.beatSyncBeatTimes, deps.canDetectBeats, deps.canSnapToBeats,
      deps.applyManualBeatBpm, deps.detectSelectedBeats, deps.snapSelectedToBeats,
      deps.updatePreviewPerformance, deps.updateTimelineInteractionSettings,
      deps.deleteProxiesForMedia, deps.regenerateProxiesForMedia, deps.migrateProxiesToDirectory,
      deps.executeMacro, deps.confirmProjectEncryptionSave,
      deps.refreshProjectHealth, deps.autoRepairProjectHealth,
      deps.relinkMissingFromHealth, deps.removeOrphanFromHealth,
      deps.mergeDuplicateFromHealth, deps.queueProxyFromHealth,
      deps.mergeDuplicateMediaGroups, deps.refreshMediaHealthDashboard,
      deps.repairFromMediaHealthDashboard, deps.openMediaHealthRelinkPanel,
      deps.refreshMediaOrganizer, deps.confirmMediaOrganizerDuplicateGroups,
      deps.removeMediaOrganizerReferences, deps.archiveUnusedMedia, deps.renameUnusedMedia,
      deps.recoveryCandidate, deps.exportQueueRecovery, deps.archiveProgress, deps.sharePackageProgress,
      deps.restoreRecovery, deps.discardRecovery,
      deps.restoreExportQueueRecovery, deps.discardExportQueueRecovery,
      deps.skipTutorial, deps.closeTutorialCelebration,
      deps.runAutomationForMedia, deps.setLastExportPath, deps.setTutorialSignals,
    ],
  );

  return { floatingDialogsCallbacks };
}

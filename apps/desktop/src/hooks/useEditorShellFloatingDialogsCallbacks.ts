import { useMemo } from 'react';
import { useEditorStore } from '../store/editorStore';

interface FloatingDialogsDeps {
  templateExportPreset: any;
  exportDialogOpen: boolean;
  setExportDialogOpen: (v: boolean) => void;
  timelineExportDialogOpen: boolean;
  setTimelineExportDialogOpen: (v: boolean) => void;
  lastExportPath: string;
  setLastExportPath: (p: string) => void;
  setTutorialSignals: React.Dispatch<React.SetStateAction<any>>;
  runAutomationForMedia: (trigger: 'on-import' | 'on-export-complete' | 'on-project-open', media: any[]) => Promise<void>;
  relinkAllMissing: () => Promise<void>;
  importEdlTimeline: () => Promise<void>;
  importFcpXmlTimeline: () => Promise<void>;
  addMedia: (media: any[]) => void;
  createProjectFromTemplate: (templateId: any) => Promise<void>;
  createProjectFromTimelineTemplate: (nextProject: any) => Promise<void>;
  colorAnalysisResults: any;
  colorAnalysisJumps: any;
  colorAnalysisBusy: boolean;
  runTimelineColorAnalysis: () => void;
  alignTimelineColorToReference: (referenceClipId: string) => void;
  seekSpectrumTime: (asset: any, sourceTime: number) => void;
  setSpectrumSelectionRange: (range: { inPoint: number; outPoint: number }) => void;
  splitSpectrumAtTime: (asset: any, sourceTime: number) => void;
  importVideosForStitchWizard: () => Promise<string[]>;
  generateVideoStitchTimeline: (settings: any) => void;
  generateSmartMontage: (config: any) => void;
  addAssetToTimeline: (assetId: string) => Promise<void>;
  analyzeContentClip: (clipId: string) => Promise<void>;
  analyzePreferredContentTargets: () => void;
  exportContentAnalysis: () => void;
  applySpeakerDiarization: () => void;
  speakerDiarizationResult: any;
  contentAnalysisTargets: any;
  operationRecording: any;
  operationRecordingActive: boolean;
  operationReplayRunning: boolean;
  operationRecordingStep: number;
  operationReplaySpeed: number;
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
  profilerReport: any;
  startProfilerRecording: () => void;
  stopProfilerRecording: () => void;
  exportProfilerReportJson: () => void;
  saveNamedSnapshot: (name: string) => Promise<void>;
  restoreSnapshotProject: (snapshotProject: any) => void;
  applySnapshotDiffSelection: (sourceProject: any, itemIds: string[]) => void;
  updateProjectReleaseVersion: (version: string) => void;
  syncCompareClipRefs: any[];
  jumpToMediaAsset: (assetId: string) => void;
  detectedBeatBpm: number | undefined;
  beatSyncBeatTimes: number[];
  canDetectBeats: boolean;
  canSnapToBeats: boolean;
  applyManualBeatBpm: (bpm: number) => void;
  detectSelectedBeats: () => Promise<void>;
  snapSelectedToBeats: () => void;
  updatePreviewPerformance: (settings: any) => void;
  updateTimelineInteractionSettings: (settings: any) => void;
  deleteProxiesForMedia: (assetIds: string[]) => Promise<void>;
  regenerateProxiesForMedia: (assetIds: string[]) => Promise<void>;
  migrateProxiesToDirectory: (assetIds: string[]) => Promise<void>;
  executeMacro: (macro: any) => Promise<void>;
  confirmProjectEncryptionSave: (options: any) => Promise<void>;
  refreshProjectHealth: () => Promise<void>;
  autoRepairProjectHealth: () => Promise<void>;
  relinkMissingFromHealth: (issue: any) => Promise<void>;
  removeOrphanFromHealth: (issue: any) => Promise<void>;
  mergeDuplicateFromHealth: (group: any) => Promise<void>;
  queueProxyFromHealth: (issue: any) => Promise<void>;
  mergeDuplicateMediaGroups: (selections: any[]) => void;
  refreshMediaHealthDashboard: () => Promise<any>;
  repairFromMediaHealthDashboard: (issue: any) => Promise<void>;
  openMediaHealthRelinkPanel: (issue: any) => void;
  refreshMediaOrganizer: () => Promise<void>;
  confirmMediaOrganizerDuplicateGroups: (selections: any[], moveFilesToTrash: boolean) => Promise<void>;
  removeMediaOrganizerReferences: (assetIds: string[]) => void;
  archiveUnusedMedia: (taskIds: string[]) => Promise<void>;
  renameUnusedMedia: (assetIds: string[]) => void;
  recoveryCandidate: any;
  exportQueueRecovery: any;
  archiveProgress: any;
  sharePackageProgress: any;
  restoreRecovery: (candidate: any) => Promise<void>;
  discardRecovery: (candidate: any) => Promise<void>;
  restoreExportQueueRecovery: () => Promise<void>;
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
        deps.setTutorialSignals((current: any) => ({ ...current, videoExported: true }));
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
      restoreRecovery: deps.restoreRecovery,
      discardRecovery: deps.discardRecovery,
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

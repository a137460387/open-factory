import { Suspense, lazy, useMemo } from 'react';
import type {
  Clip,
  MediaAsset,
  OperationRecordingFile,
  OperationReplaySpeed,
  PerformanceProfilerReport,
  Project,
  SceneColorDifference,
  SpeakerDiarizationSegment,
  SyncCompareClipRef,
  TimelineColorAnalysisResult,
  ProjectTemplateId,
  Track,
} from '@open-factory/editor-core';
import { UpdateClipCommand } from '@open-factory/editor-core';
import { selectClipById, useEditorStore } from '../../store/editorStore';
import { useEditorUIStore } from '../../store/editorUIStore';
import { useEditorFeatureStore } from '../../store/editorFeatureStore';
import { useEditorSettingsStore } from '../../store/editorSettingsStore';
import { usePerformanceMonitorStore } from '../../store/performanceMonitorStore';
import { commandManager, timelineAccessor } from '../../store/commandManager';
import type { ExportPreset } from '../../export/export-presets';
import type { ExportQueueRecoveryCandidate } from '../../export/export-queue-persistence';
import type { SharePackageWorkflowProgress } from '../../lib/sharePackage';
import type { ArchiveProgress } from '../../lib/projectArchive';
import type { PreviewPerformanceSettings, PreviewSkipFrames } from '../../lib/preview/preview-performance';
import type { TimelineInteractionSettings } from '../../settings/appSettings';
import type { ClipMacro } from '../../macros/clip-macros';
import type { VideoStitchWizardSettings } from '../../video-stitching/VideoStitchWizardDialog';
import type { DuplicateMediaMergeSelection } from '../../media/DuplicateMediaDialog';
import type { MediaOrganizerDuplicateSelection } from '../../media/MediaOrganizerDialog';
import type { AutosaveRecoveryCandidate, ProjectFileEncryptionOptions } from '../../lib/projectFiles';
import type { ContentAnalysisTarget } from '../../media/ContentAnalysisDialog';
import type { BeatSensitivity } from '@open-factory/editor-core';
import { shouldShowTutorial } from '../../tutorial/tutorialState';
import type { TutorialSignals } from '../../tutorial/tutorialState';

// 延迟加载重型对话框组件，减少首屏加载体积
const ExportDialogs = lazy(() => import('../dialogs/ExportDialogs').then((m) => ({ default: m.ExportDialogs })));
const AnalysisDialogs = lazy(() => import('../dialogs/AnalysisDialogs').then((m) => ({ default: m.AnalysisDialogs })));
const SnapshotDialogs = lazy(() => import('../dialogs/SnapshotDialogs').then((m) => ({ default: m.SnapshotDialogs })));
const MediaCompareDialogs = lazy(() =>
  import('../dialogs/MediaCompareDialogs').then((m) => ({ default: m.MediaCompareDialogs })),
);
const BeatSyncDialog = lazy(() => import('../dialogs/BeatSyncDialog').then((m) => ({ default: m.BeatSyncDialog })));
const SettingsDialogs = lazy(() => import('../dialogs/SettingsDialogs').then((m) => ({ default: m.SettingsDialogs })));
const SecurityDialogs = lazy(() => import('../dialogs/SecurityDialogs').then((m) => ({ default: m.SecurityDialogs })));
const ProjectHealthDialogs = lazy(() =>
  import('../dialogs/ProjectHealthDialogs').then((m) => ({ default: m.ProjectHealthDialogs })),
);
const RecoveryDialogs = lazy(() => import('../dialogs/RecoveryDialogs').then((m) => ({ default: m.RecoveryDialogs })));

const CharacterTimelinePanel = lazy(() =>
  import('../Timeline/CharacterTimelinePanel').then((m) => ({ default: m.CharacterTimelinePanel })),
);
const PreflightChecklistPanel = lazy(() =>
  import('../Export/PreflightChecklistPanel').then((m) => ({ default: m.PreflightChecklistPanel })),
);
const DubbingAdaptationPanel = lazy(() =>
  import('../Export/DubbingAdaptationPanel').then((m) => ({ default: m.DubbingAdaptationPanel })),
);
const ProjectTemplateDialog = lazy(() =>
  import('../../project-templates/ProjectTemplateDialog').then((m) => ({ default: m.ProjectTemplateDialog })),
);
const TimelineTemplateDialog = lazy(() =>
  import('../../timeline-templates/TimelineTemplateDialog').then((m) => ({ default: m.TimelineTemplateDialog })),
);
const TimelineSearchPanel = lazy(() =>
  import('../../timeline-search/TimelineSearchPanel').then((m) => ({ default: m.TimelineSearchPanel })),
);
const ShortcutCheatsheetPanel = lazy(() =>
  import('../ShortcutCheatsheetPanel').then((m) => ({ default: m.ShortcutCheatsheetPanel })),
);
const PasteKeyframeDialog = lazy(() =>
  import('../dialogs/PasteKeyframeDialog').then((m) => ({ default: m.PasteKeyframeDialog })),
);
const PerformanceMonitorPanel = lazy(() =>
  import('../PerformanceMonitorPanel').then((m) => ({ default: m.PerformanceMonitorPanel })),
);
const TutorialOverlay = lazy(() =>
  import('../../tutorial/TutorialOverlay').then((m) => ({ default: m.TutorialOverlay })),
);

// 所有非 store 内状态的回调和数据通过 props 传入
export interface ShellFloatingDialogsProps {
  // Export
  templateExportPreset: ExportPreset | undefined;
  exportDialogOpen: boolean;
  setExportDialogOpen: (open: boolean) => void;
  timelineExportDialogOpen: boolean;
  setTimelineExportDialogOpen: (open: boolean) => void;
  onExportCompleted: (path: string) => void;
  onRelinkMissing: () => void;
  importEdlTimeline: (contents: string, path: string) => unknown;
  importFcpXmlTimeline: (contents: string, path: string) => unknown;
  addMedia: (media: MediaAsset[]) => void;
  lastExportPath: string | undefined;
  // Template
  createProjectFromTemplate: (templateId: ProjectTemplateId) => void;
  createProjectFromTimelineTemplate: (nextProject: Project) => void;
  // Analysis
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
  generateSmartMontage: (config: {
    videoAssetIds: string[];
    audioAssetId: string;
    beatTimes: number[];
    sensitivity: BeatSensitivity;
  }) => void;
  addAssetToTimeline: (assetId: string) => void;
  analyzeContentClip: (clipId: string) => void;
  analyzePreferredContentTargets: () => void;
  exportContentAnalysis: (clipId: string) => void;
  applySpeakerDiarization: () => void;
  speakerDiarizationResult: { sourceName: string; segments: SpeakerDiarizationSegment[]; tracks: Track[] } | undefined;
  contentAnalysisTargets: ContentAnalysisTarget[];
  // Operation recording
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
  jumpOperationRecording: (stepIndex: number) => void;
  exportOperationRecordingSlides: () => void;
  // Profiler
  profilerRecording: boolean;
  profilerElapsedMs: number;
  profilerReport: PerformanceProfilerReport | undefined;
  startProfilerRecording: () => void;
  stopProfilerRecording: () => void;
  exportProfilerReportJson: () => void;
  // Snapshot
  saveNamedSnapshot: (name: string) => void;
  restoreSnapshotProject: (project: Project) => void;
  applySnapshotDiffSelection: (sourceProject: Project, itemIds: string[]) => void;
  updateProjectReleaseVersion: (version: string) => void;
  // Media compare
  syncCompareClipRefs: SyncCompareClipRef[];
  jumpToMediaAsset: (assetId: string) => void;
  // Beat sync
  detectedBeatBpm: number | undefined;
  beatSyncBeatTimes: number[];
  canDetectBeats: boolean;
  canSnapToBeats: boolean;
  applyManualBeatBpm: () => void;
  detectSelectedBeats: () => void;
  snapSelectedToBeats: () => void;
  // Settings
  updatePreviewPerformance: (patch: Partial<PreviewPerformanceSettings>) => void;
  updateTimelineInteractionSettings: (patch: Partial<TimelineInteractionSettings>) => void;
  deleteProxiesForMedia: (assetIds: string[]) => void;
  regenerateProxiesForMedia: (assetIds: string[]) => void;
  migrateProxiesToDirectory: (targetDirectory: string) => void;
  executeMacro: (macro: ClipMacro) => void;
  // Security
  confirmProjectEncryptionSave: (options: ProjectFileEncryptionOptions) => Promise<void>;
  // Health
  refreshProjectHealth: () => Promise<void>;
  autoRepairProjectHealth: () => Promise<void>;
  relinkMissingFromHealth: (issue: unknown) => Promise<void>;
  removeOrphanFromHealth: (issue: unknown) => Promise<void>;
  mergeDuplicateFromHealth: (issue: unknown) => Promise<void>;
  queueProxyFromHealth: (issue: unknown) => Promise<void>;
  mergeDuplicateMediaGroups: (selections: DuplicateMediaMergeSelection[]) => void;
  refreshMediaHealthDashboard: () => Promise<unknown>;
  repairFromMediaHealthDashboard: () => Promise<void>;
  openMediaHealthRelinkPanel: () => void;
  refreshMediaOrganizer: () => Promise<void>;
  confirmMediaOrganizerDuplicateGroups: (
    selections: MediaOrganizerDuplicateSelection[],
    moveFilesToTrash: boolean,
  ) => Promise<void>;
  removeMediaOrganizerReferences: (assetIds: string[]) => void;
  archiveUnusedMedia: () => Promise<void>;
  renameUnusedMedia: (template: string) => Promise<void>;
  // Recovery
  recoveryCandidate: AutosaveRecoveryCandidate | undefined;
  exportQueueRecovery: ExportQueueRecoveryCandidate | undefined;
  archiveProgress: ArchiveProgress | undefined;
  sharePackageProgress: SharePackageWorkflowProgress | undefined;
  restoreRecovery: () => Promise<void>;
  discardRecovery: () => Promise<void>;
  restoreExportQueueRecovery: (taskIds: string[]) => Promise<void>;
  discardExportQueueRecovery: () => void;
  // Tutorial
  skipTutorial: () => void;
  closeTutorialCelebration: () => void;
  setTutorialSignals: (updater: (current: TutorialSignals) => TutorialSignals) => void;
  runAutomationForMedia: (trigger: 'on-export-complete', media: MediaAsset[]) => void;
}

export function ShellFloatingDialogs(props: ShellFloatingDialogsProps) {
  const project = useEditorStore((s) => s.project);
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const selectedClipIds = useEditorStore((s) => s.selectedClipIds);
  const inPoint = useEditorStore((s) => s.inPoint);
  const outPoint = useEditorStore((s) => s.outPoint);
  const projectPath = useEditorStore((s) => s.projectPath);

  const projectTemplateOpen = useEditorUIStore((s) => s.projectTemplateOpen);
  const setProjectTemplateOpen = useEditorUIStore((s) => s.setProjectTemplateOpen);
  const timelineSearchOpen = useEditorUIStore((s) => s.timelineSearchOpen);
  const setTimelineSearchOpen = useEditorUIStore((s) => s.setTimelineSearchOpen);
  const shortcutCheatsheetOpen = useEditorUIStore((s) => s.shortcutCheatsheetOpen);
  const setShortcutCheatsheetOpen = useEditorUIStore((s) => s.setShortcutCheatsheetOpen);
  const pasteKeyframeDialogOpen = useEditorUIStore((s) => s.pasteKeyframeDialogOpen);
  const setPasteKeyframeDialogOpen = useEditorUIStore((s) => s.setPasteKeyframeDialogOpen);

  const timelineTemplateMode = useEditorFeatureStore((s) => s.timelineTemplateMode);
  const setTimelineTemplateMode = useEditorFeatureStore((s) => s.setTimelineTemplateMode);

  const shortcutBindings = useEditorSettingsStore((s) => s.shortcutBindings);
  const macros = useEditorSettingsStore((s) => s.macros);
  const previewPerformance = useEditorSettingsStore((s) => s.previewPerformance);
  const timelineInteractionSettings = useEditorSettingsStore((s) => s.timelineInteractionSettings);
  const tutorialProgress = useEditorSettingsStore((s) => s.tutorialProgress);
  const tutorialCelebrationVisible = useEditorSettingsStore((s) => s.tutorialCelebrationVisible);

  const selectedClip = useMemo(() => selectClipById(project, selectedClipId), [project, selectedClipId]);

  return (
    <>
      <Suspense fallback={null}>
        <CharacterTimelinePanel />
        <PreflightChecklistPanel />
        <DubbingAdaptationPanel />
      </Suspense>
      <Suspense fallback={null}>
        <ExportDialogs
          project={project}
          selectedClipIds={selectedClipIds}
          inPoint={inPoint}
          outPoint={outPoint}
          templateExportPreset={props.templateExportPreset}
          exportDialogOpen={props.exportDialogOpen}
          setExportDialogOpen={props.setExportDialogOpen}
          timelineExportDialogOpen={props.timelineExportDialogOpen}
          setTimelineExportDialogOpen={props.setTimelineExportDialogOpen}
          onExportCompleted={(path) => {
            props.onExportCompleted(path);
          }}
          onRelinkMissing={() => void props.onRelinkMissing()}
          onImportEdl={props.importEdlTimeline}
          onImportFcpXml={props.importFcpXmlTimeline}
          onAddMedia={props.addMedia}
        />
        {projectTemplateOpen ? (
          <ProjectTemplateDialog
            onSelect={(templateId) => void props.createProjectFromTemplate(templateId)}
            onClose={() => setProjectTemplateOpen(false)}
          />
        ) : null}
        {timelineTemplateMode ? (
          <TimelineTemplateDialog
            mode={timelineTemplateMode}
            project={project}
            selectedClipIds={selectedClipIds}
            onCreate={(nextProject) => void props.createProjectFromTimelineTemplate(nextProject)}
            onSaved={() => setTimelineTemplateMode(undefined)}
            onClose={() => setTimelineTemplateMode(undefined)}
          />
        ) : null}
        <AnalysisDialogs
          project={project}
          selectedClip={selectedClip as Clip | undefined}
          selectedClipId={selectedClipId}
          selectedClipIds={selectedClipIds}
          commandManager={commandManager}
          timelineAccessor={timelineAccessor}
          colorAnalysisResults={props.colorAnalysisResults}
          colorAnalysisJumps={props.colorAnalysisJumps}
          colorAnalysisBusy={props.colorAnalysisBusy}
          runTimelineColorAnalysis={props.runTimelineColorAnalysis}
          alignTimelineColorToReference={props.alignTimelineColorToReference}
          seekSpectrumTime={props.seekSpectrumTime}
          setSpectrumSelectionRange={props.setSpectrumSelectionRange}
          splitSpectrumAtTime={props.splitSpectrumAtTime}
          importVideosForStitchWizard={props.importVideosForStitchWizard}
          generateVideoStitchTimeline={props.generateVideoStitchTimeline}
          generateSmartMontage={props.generateSmartMontage}
          operationRecording={props.operationRecording}
          operationRecordingActive={props.operationRecordingActive}
          operationReplayRunning={props.operationReplayRunning}
          operationRecordingStep={props.operationRecordingStep}
          operationReplaySpeed={props.operationReplaySpeed}
          startOperationRecording={props.startOperationRecording}
          stopOperationRecording={props.stopOperationRecording}
          saveOperationRecording={props.saveOperationRecording}
          loadOperationRecording={props.loadOperationRecording}
          replayOperationRecording={props.replayOperationRecording}
          pauseOperationReplay={props.pauseOperationReplay}
          jumpOperationRecording={props.jumpOperationRecording}
          exportOperationRecordingSlides={props.exportOperationRecordingSlides}
          speakerDiarizationResult={props.speakerDiarizationResult}
          applySpeakerDiarization={props.applySpeakerDiarization}
          addAssetToTimeline={props.addAssetToTimeline}
          contentAnalysisTargets={props.contentAnalysisTargets}
          contentAnalysisRunningClipId={undefined}
          analyzeContentClip={props.analyzeContentClip}
          analyzePreferredContentTargets={props.analyzePreferredContentTargets}
          exportContentAnalysis={props.exportContentAnalysis}
          profilerRecording={props.profilerRecording}
          profilerElapsedMs={props.profilerElapsedMs}
          profilerReport={props.profilerReport}
          startProfilerRecording={props.startProfilerRecording}
          stopProfilerRecording={props.stopProfilerRecording}
          exportProfilerReportJson={props.exportProfilerReportJson}
        />
        <SnapshotDialogs
          project={project}
          projectPath={projectPath}
          lastExportPath={props.lastExportPath}
          saveNamedSnapshot={props.saveNamedSnapshot}
          restoreSnapshotProject={props.restoreSnapshotProject}
          applySnapshotDiffSelection={props.applySnapshotDiffSelection}
          updateProjectReleaseVersion={props.updateProjectReleaseVersion}
        />
        <MediaCompareDialogs
          project={project}
          playheadTime={useEditorStore.getState().playheadTime}
          syncCompareClipRefs={props.syncCompareClipRefs}
          jumpToMediaAsset={props.jumpToMediaAsset}
        />
        <BeatSyncDialog
          detectedBeatBpm={props.detectedBeatBpm}
          beatSyncBeatTimes={props.beatSyncBeatTimes}
          canDetectBeats={props.canDetectBeats}
          canSnapToBeats={props.canSnapToBeats}
          applyManualBeatBpm={props.applyManualBeatBpm}
          detectSelectedBeats={() => void props.detectSelectedBeats()}
          snapSelectedToBeats={props.snapSelectedToBeats}
        />
        {timelineSearchOpen ? (
          <TimelineSearchPanel project={project} onClose={() => setTimelineSearchOpen(false)} />
        ) : null}
        {shortcutCheatsheetOpen ? (
          <ShortcutCheatsheetPanel bindings={shortcutBindings} onClose={() => setShortcutCheatsheetOpen(false)} />
        ) : null}
        {pasteKeyframeDialogOpen && selectedClipId ? (
          <PasteKeyframeDialog
            groups={[]}
            targetClipId={selectedClipId}
            onClose={() => setPasteKeyframeDialogOpen(false)}
          />
        ) : null}
        <SettingsDialogs
          project={project}
          selectedClip={selectedClip as Clip | undefined}
          shortcutBindings={shortcutBindings}
          macros={macros}
          previewPerformance={previewPerformance}
          timelineInteractionSettings={timelineInteractionSettings}
          onShortcutBindingsChange={(updater) => useEditorSettingsStore.getState().setShortcutBindings(updater)}
          onMacrosChange={(updater) => useEditorSettingsStore.getState().setMacros(updater)}
          onExecuteMacro={(macro) => void props.executeMacro(macro)}
          onPreviewPerformanceChange={props.updatePreviewPerformance}
          onPreviewSkipFramesChange={(skipFrames: PreviewSkipFrames) => props.updatePreviewPerformance({ skipFrames })}
          onTimelineInteractionSettingsChange={props.updateTimelineInteractionSettings}
          onDeleteProxies={(assetIds) => props.deleteProxiesForMedia(assetIds)}
          onRegenerateProxies={(assetIds) => props.regenerateProxiesForMedia(assetIds)}
          onMigrateProxies={(targetDirectory) => props.migrateProxiesToDirectory(targetDirectory)}
          onRepairSubtitle={(id, start, duration) => {
            commandManager.execute(new UpdateClipCommand(timelineAccessor, id, { start, duration }));
          }}
        />
        <PerformanceMonitorPanel
          open={usePerformanceMonitorStore((s) => s.panelOpen)}
          onClose={() => usePerformanceMonitorStore.getState().setPanelOpen(false)}
        />
        <SecurityDialogs confirmProjectEncryptionSave={props.confirmProjectEncryptionSave} />
        <ProjectHealthDialogs
          project={project}
          refreshProjectHealth={props.refreshProjectHealth}
          autoRepairProjectHealth={props.autoRepairProjectHealth}
          relinkMissingFromHealth={props.relinkMissingFromHealth}
          removeOrphanFromHealth={props.removeOrphanFromHealth}
          mergeDuplicateFromHealth={props.mergeDuplicateFromHealth}
          queueProxyFromHealth={props.queueProxyFromHealth}
          mergeDuplicateMediaGroups={props.mergeDuplicateMediaGroups}
          refreshMediaHealthDashboard={props.refreshMediaHealthDashboard}
          repairFromMediaHealthDashboard={props.repairFromMediaHealthDashboard}
          openMediaHealthRelinkPanel={props.openMediaHealthRelinkPanel}
          refreshMediaOrganizer={props.refreshMediaOrganizer}
          confirmMediaOrganizerDuplicateGroups={props.confirmMediaOrganizerDuplicateGroups}
          removeMediaOrganizerReferences={props.removeMediaOrganizerReferences}
          archiveUnusedMedia={props.archiveUnusedMedia}
          renameUnusedMedia={props.renameUnusedMedia}
        />
        <RecoveryDialogs
          recoveryCandidate={props.recoveryCandidate}
          exportQueueRecovery={props.exportQueueRecovery}
          archiveProgress={props.archiveProgress}
          sharePackageProgress={props.sharePackageProgress}
          restoreRecovery={props.restoreRecovery}
          discardRecovery={props.discardRecovery}
          restoreExportQueueRecovery={props.restoreExportQueueRecovery}
          discardExportQueueRecovery={props.discardExportQueueRecovery}
        />
        {tutorialProgress && (shouldShowTutorial(tutorialProgress) || tutorialCelebrationVisible) ? (
          <TutorialOverlay
            progress={tutorialCelebrationVisible ? { ...tutorialProgress, tutorialCompleted: true } : tutorialProgress}
            onSkip={props.skipTutorial}
            onCloseCelebration={props.closeTutorialCelebration}
          />
        ) : null}
      </Suspense>
    </>
  );
}

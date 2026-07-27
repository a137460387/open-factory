import {
  Archive,
  Captions,
  Download,
  FileDown,
  FilePlus2,
  FileText,
  FolderOpen,
  Grid2X2,
  History,
  ImageDown,
  LayoutGrid,
  LockKeyhole,
  Mic2,
  Monitor,
  PanelsTopLeft,
  Pause,
  PictureInPicture2,
  Play,
  Redo2,
  RotateCcw,
  Save,
  Scissors,
  Settings,
  Trash2,
  Undo2,
  AlertTriangle,
  WandSparkles,
  XCircle,
} from 'lucide-react';
import {
  checkCostAlert,
  timelineHasExportableVideo,
  type PiPLayoutPosition,
  type SplitLayoutDefinition,
  type TimelineGridSettings,
  type TimelineGridUnit,
} from '@open-factory/editor-core';
import { useState } from 'react';
import { formatBackupDisplayTime } from '../../backup/projectBackup';
import { useExportQueueStore } from '../../export/export-queue-store';
import { zhCN } from '../../i18n/strings';
import { featureStrings } from '../../i18n/featureStrings';
import { pickWhisperExecutablePath, pickWhisperModelPath } from '../../lib/whisper';
import { showToast } from '../../lib/toast';
import { useMediaJobStore } from '../../media/media-job-store';
import { PREVIEW_QUALITY_MODES, type PreviewQualityMode } from '../../lib/preview/preview-performance';
import { useEditorStore } from '../../store/editorStore';
import { useWhisperSettingsStore } from '../../store/whisperSettingsStore';
import { useAISettingsStore } from '../../store/aiSettingsStore';
import type { WorkspaceLayoutDefinition, WorkspaceLayoutId } from '../../layout/layoutSettings';
import type { TimelineHeatmapViewSettings } from '../../settings/appSettings';
import { ToolButton, formatRecordingElapsed } from './ToolbarButton';
import { FileMenu } from './FileMenu';
import { EditMenu } from './EditMenu';
import { ViewMenu } from './ViewMenu';
import { ToolsMenu } from './ToolsMenu';
import { HelpMenu } from './HelpMenu';
import { ImportMenu } from './ImportMenu';
import { RecordMenu } from './RecordMenu';
import { SplitLayoutPicker } from './SplitLayoutPicker';
import { WorkspaceLayoutPicker } from './WorkspaceLayoutPicker';

interface ToolbarProps {
  onNewProject(): void;
  onNewFromTemplate(): void;
  onSaveTimelineTemplate(): void;
  onNewFromTimelineTemplate(): void;
  onOpenProject(): void;
  onSaveProject(): void;
  onSaveEncryptedProject(): void;
  onArchiveProject(): void;
  onOpenReleaseWorkflow(): void;
  onCreateMediaReport(): void;
  onCreateClipReport(): void;
  onGenerateVideoSummary(): void;
  onGenerateNarration(): void;
  onOpenAssistEditing(): void;
  onOpenContentGeneration(): void;
  onOpenQualityAssessment(): void;
  onCreateSharePackage(): void;
  onConformMedia(): void;
  onImportBookmarks(): void;
  onExportBookmarks(): void;
  onSaveSnapshot(): void;
  onOpenSnapshotHistory(): void;
  onOpenSnapshotCompare(): void;
  onOpenTimelineCompare(): void;
  onImportMedia(): void;
  onImportDataSubtitles(mode: 'append' | 'new-track' | 'replace-current-track'): void;
  onBatchTranscode(): void;
  onOpenBatchWatermark(): void;
  onOpenBatchProjectProcessing(): void;
  onOpenMediaPrecheck(): void;
  onOpenMediaOrganizer(): void;
  onOpenMediaHealthDashboard(): void;
  onOpenVideoStitchWizard(): void;
  onOpenSmartMontage(): void;
  onAddMotionGraphic(): void;
  onOpenThumbnailGenerator(): void;
  onOpenLutEditor(): void;
  onOpenColorNodeEditor(): void;
  onOpenColorAnalysis(): void;
  onOpenSyncCompare(): void;
  onOpenSceneDetection(): void;
  onOpenSceneReorder(): void;
  onOpenStyleTransfer(): void;
  onOpenCollaborationNotes(): void;
  onOpenOperationRecording(): void;
  onOpenComplexityScore(): void;
  onOpenSmartRecommendations(): void;
  onOpenContentAnalysis(): void;
  onOpenPerformanceProfiler(): void;
  onOpenRhythmAnalysis(): void;
  onOpenBeatSync(): void;
  onDetectBeats(): void;
  onSnapToBeats(): void;
  onSplitToBeats(): void;
  onOpenAutoAudioSync(): void;
  onOpenMacroHistory(): void;
  onOpenErrorKnowledge(): void;
  onOpenSequenceCompare(): void;
  onOpenSubtitleSync(): void;
  onOpenProxyVerify(): void;
  onOpenFormatConverter(): void;
  onOpenEmotionAnalysis(): void;
  onOpenExportHistoryClassifier(): void;
  onStartMacroRecording(): void;
  onStopMacroRecording(): void;
  onImportSubtitles(): void;
  onStartRecording(source: 'screen' | 'camera'): void;
  onStopRecording(): void;
  onExportVideo(): void;
  onExportTimeline(): void;
  onExportProfessionalNle(): void;
  onExportCurrentFrame(): void;
  onCancelExport(): void;
  onSplitSelected(): void;
  onToggleSmartRoughCut(): void;
  onToggleAIRoughCut(): void;
  onToggleDirectorMode(): void;
  onToggleMusicMatch(): void;
  onToggleHighlightReel(): void;
  onToggleContextualTranslation(): void;
  onToggleAIChatEditor(): void;
  onToggleSmartCreation(): void;
  onSeparateAudio(): void;
  onCancelAudioSeparation(): void;
  onRunSpeakerDiarization(): void;
  onCreateMulticamSequence(): void;
  onApplyPiPLayout(): void;
  onApplySplitLayout(layoutId: string): void;
  onSaveCustomSplitLayout(mainRatio: number): Promise<string>;
  canCreateMulticamSequence: boolean;
  canApplyPiPLayout: boolean;
  canApplySplitLayout: boolean;
  canOpenSyncCompare: boolean;
  canOpenSceneDetection: boolean;
  canOpenSceneReorder: boolean;
  pipLayoutPosition: PiPLayoutPosition;
  onPiPLayoutPositionChange(position: PiPLayoutPosition): void;
  customSplitLayouts: SplitLayoutDefinition[];
  canDetectBeats: boolean;
  canSnapToBeats: boolean;
  canSplitToBeats: boolean;
  canOpenAutoAudioSync: boolean;
  beatSensitivity: 'low' | 'medium' | 'high';
  onBeatSensitivityChange(sensitivity: 'low' | 'medium' | 'high'): void;
  canSeparateAudio: boolean;
  audioSeparationRunning: boolean;
  audioSeparationProgress?: number;
  canRunSpeakerDiarization: boolean;
  speakerDiarizationRunning: boolean;
  autoAudioSyncRunning: boolean;
  macroRecordingActive: boolean;
  macroRecordingStepCount: number;
  recordingActive: boolean;
  recordingElapsedSeconds: number;
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
  workspaceLayouts: WorkspaceLayoutDefinition[];
  activeWorkspaceLayoutId: WorkspaceLayoutId;
  onApplyWorkspaceLayout(layoutId: WorkspaceLayoutId): void;
  onSaveWorkspaceLayout(): void;
  safeFrameGuides: boolean;
  thumbnailTrackVisible: boolean;
  timelineMinimapVisible: boolean;
  timelineHeatmap: TimelineHeatmapViewSettings;
  previewQualityMode: PreviewQualityMode;
  previewWindowOpen: boolean;
  timelineGridSettings: TimelineGridSettings;
  onToggleStoryboard(): void;
  reviewMode: boolean;
  onToggleReviewMode(): void;
  onCreateReviewReport(): void;
  onToggleSafeFrameGuides(): void;
  onToggleThumbnailTrack(): void;
  onToggleTimelineMinimap(): void;
  onTimelineHeatmapChange(patch: Partial<TimelineHeatmapViewSettings>): void;
  onPreviewQualityModeChange(mode: PreviewQualityMode): void;
  onPopoutPreview(): void;
  onToggleTimelineGridSnap(): void;
  onTimelineGridUnitChange(unit: TimelineGridUnit): void;
  onToggleHistoryPanel(): void;
  onToggleProjectDocumentation(): void;
  onUndo(): void;
  onRedo(): void;
  onClearCache(): void;
  onOpenSettings(): void;
  onStartTutorial(): void;
  onOpenProjectHealth(): void;
  sharePackageBusy?: boolean;
  autosaveIntervalSeconds: number;
  onAutosaveIntervalSecondsChange(seconds: number): void;
  onRevealExport?(): void;
  lastExportPath?: string;
  lastBackupAt?: string;
}

const TIMELINE_GRID_UNITS: TimelineGridUnit[] = [
  'frame',
  '5-frames',
  '10-frames',
  'second',
  '5-seconds',
  'beat',
  'measure',
  'four-measures',
];

type MenuId = 'file' | 'import' | 'edit' | 'view' | 'tools' | 'help' | 'record' | 'splitLayout' | 'workspaceLayout';

export function Toolbar(props: ToolbarProps) {
  const t = zhCN.toolbar;
  const usageRecords = useAISettingsStore((s) => s.usageRecords);
  const costAlertThreshold = useAISettingsStore((s) => s.costAlertThreshold);
  const [openMenu, setOpenMenu] = useState<MenuId | null>(null);
  const [customSplitRatio, setCustomSplitRatio] = useState(0.67);
  const project = useEditorStore((state) => state.project);
  const isPlaying = useEditorStore((state) => state.isPlaying);
  const setIsPlaying = useEditorStore((state) => state.setIsPlaying);
  const historyMeta = useEditorStore((state) => state.historyMeta);
  const dirty = useEditorStore((state) => state.dirty);
  const runningExportTask = useExportQueueStore((state) => state.tasks.find((task) => task.status === 'running'));
  const activeMediaJobCount = useMediaJobStore(
    (state) => state.jobs.filter((job) => job.status === 'pending' || job.status === 'running').length,
  );
  const whisperExecutablePath = useWhisperSettingsStore((state) => state.executablePath);
  const whisperModelPath = useWhisperSettingsStore((state) => state.modelPath);
  const setWhisperExecutablePath = useWhisperSettingsStore((state) => state.setExecutablePath);
  const setWhisperModelPath = useWhisperSettingsStore((state) => state.setModelPath);
  const isExporting = Boolean(runningExportTask);
  const exportProgress = runningExportTask?.progress;
  const canExport = timelineHasExportableVideo(project.timeline);
  const backupDisplayTime = formatBackupDisplayTime(props.lastBackupAt);

  const toggle = (id: MenuId) => () => setOpenMenu((prev) => (prev === id ? null : id));

  const chooseWhisperExecutable = async () => {
    try {
      const path = await pickWhisperExecutablePath();
      if (path) setWhisperExecutablePath(path);
    } catch (error) {
      showToast({
        kind: 'warning',
        title: t.chooseWhisperExecutable,
        message: error instanceof Error ? error.message : zhCN.common.unavailable,
      });
    }
  };

  const chooseWhisperModel = async () => {
    try {
      const path = await pickWhisperModelPath();
      if (path) setWhisperModelPath(path);
    } catch (error) {
      showToast({
        kind: 'warning',
        title: t.chooseWhisperModel,
        message: error instanceof Error ? error.message : zhCN.common.unavailable,
      });
    }
  };

  if (props.reviewMode) {
    return (
      <header
        className="relative z-30 flex min-h-14 min-w-0 items-center gap-2 overflow-x-auto border-b border-line bg-white px-3"
        data-testid="review-toolbar"
      >
        <div className="mr-2 text-sm font-semibold text-ink">{t.reviewMode}</div>
        <ViewMenu
          open={openMenu === 'view'}
          onToggle={toggle('view')}
          safeFrameGuides={props.safeFrameGuides}
          thumbnailTrackVisible={props.thumbnailTrackVisible}
          timelineMinimapVisible={props.timelineMinimapVisible}
          timelineHeatmap={props.timelineHeatmap}
          reviewMode={props.reviewMode}
          onToggleSafeFrameGuides={props.onToggleSafeFrameGuides}
          onToggleThumbnailTrack={props.onToggleThumbnailTrack}
          onToggleTimelineMinimap={props.onToggleTimelineMinimap}
          onOpenTimelineCompare={props.onOpenTimelineCompare}
          onOpenSequenceCompare={props.onOpenSequenceCompare}
          onTimelineHeatmapChange={props.onTimelineHeatmapChange}
          onToggleReviewMode={props.onToggleReviewMode}
          onCreateReviewReport={props.onCreateReviewReport}
        />
        <div className="ml-auto flex items-center gap-2">
          <ToolButton
            title={isPlaying ? t.pause : t.play}
            onClick={() => setIsPlaying(!isPlaying)}
            icon={isPlaying ? <Pause size={17} /> : <Play size={17} />}
            testId="toolbar-playback-button"
            playbackState={isPlaying ? 'playing' : 'paused'}
          />
        </div>
      </header>
    );
  }

  return (
    <header className="relative z-30 flex min-h-14 min-w-0 items-center gap-2 overflow-x-auto border-b border-line bg-white px-3">
      <FileMenu
        open={openMenu === 'file'}
        onToggle={toggle('file')}
        canExport={canExport}
        isExporting={isExporting}
        sharePackageBusy={props.sharePackageBusy}
        onNewFromTemplate={props.onNewFromTemplate}
        onSaveTimelineTemplate={props.onSaveTimelineTemplate}
        onNewFromTimelineTemplate={props.onNewFromTimelineTemplate}
        onCreateMediaReport={props.onCreateMediaReport}
        onCreateClipReport={props.onCreateClipReport}
        onGenerateVideoSummary={props.onGenerateVideoSummary}
        onConformMedia={props.onConformMedia}
        onArchiveProject={props.onArchiveProject}
        onOpenReleaseWorkflow={props.onOpenReleaseWorkflow}
        onCreateSharePackage={props.onCreateSharePackage}
        onExportProfessionalNle={props.onExportProfessionalNle}
        onOpenProjectHealth={props.onOpenProjectHealth}
        onImportBookmarks={props.onImportBookmarks}
        onExportBookmarks={props.onExportBookmarks}
      />
      <EditMenu
        open={openMenu === 'edit'}
        onToggle={toggle('edit')}
        onSaveSnapshot={props.onSaveSnapshot}
        onOpenSnapshotHistory={props.onOpenSnapshotHistory}
        onOpenSnapshotCompare={props.onOpenSnapshotCompare}
      />
      <ViewMenu
        open={openMenu === 'view'}
        onToggle={toggle('view')}
        safeFrameGuides={props.safeFrameGuides}
        thumbnailTrackVisible={props.thumbnailTrackVisible}
        timelineMinimapVisible={props.timelineMinimapVisible}
        timelineHeatmap={props.timelineHeatmap}
        reviewMode={props.reviewMode}
        onToggleSafeFrameGuides={props.onToggleSafeFrameGuides}
        onToggleThumbnailTrack={props.onToggleThumbnailTrack}
        onToggleTimelineMinimap={props.onToggleTimelineMinimap}
        onOpenTimelineCompare={props.onOpenTimelineCompare}
        onOpenSequenceCompare={props.onOpenSequenceCompare}
        onTimelineHeatmapChange={props.onTimelineHeatmapChange}
        onToggleReviewMode={props.onToggleReviewMode}
        onCreateReviewReport={props.onCreateReviewReport}
      />
      <ToolsMenu
        open={openMenu === 'tools'}
        onToggle={toggle('tools')}
        canOpenSyncCompare={props.canOpenSyncCompare}
        canOpenSceneDetection={props.canOpenSceneDetection}
        canOpenSceneReorder={props.canOpenSceneReorder}
        canDetectBeats={props.canDetectBeats}
        canSnapToBeats={props.canSnapToBeats}
        canSplitToBeats={props.canSplitToBeats}
        canOpenAutoAudioSync={props.canOpenAutoAudioSync}
        canSeparateAudio={props.canSeparateAudio}
        audioSeparationRunning={props.audioSeparationRunning}
        audioSeparationProgress={props.audioSeparationProgress}
        canRunSpeakerDiarization={props.canRunSpeakerDiarization}
        speakerDiarizationRunning={props.speakerDiarizationRunning}
        autoAudioSyncRunning={props.autoAudioSyncRunning}
        macroRecordingActive={props.macroRecordingActive}
        macroRecordingStepCount={props.macroRecordingStepCount}
        beatSensitivity={props.beatSensitivity}
        onBeatSensitivityChange={props.onBeatSensitivityChange}
        onBatchTranscode={props.onBatchTranscode}
        onOpenBatchWatermark={props.onOpenBatchWatermark}
        onOpenBatchProjectProcessing={props.onOpenBatchProjectProcessing}
        onOpenMediaPrecheck={props.onOpenMediaPrecheck}
        onOpenProxyVerify={props.onOpenProxyVerify}
        onOpenMediaOrganizer={props.onOpenMediaOrganizer}
        onOpenMediaHealthDashboard={props.onOpenMediaHealthDashboard}
        onOpenVideoStitchWizard={props.onOpenVideoStitchWizard}
        onOpenSmartMontage={props.onOpenSmartMontage}
        onAddMotionGraphic={props.onAddMotionGraphic}
        onOpenThumbnailGenerator={props.onOpenThumbnailGenerator}
        onOpenLutEditor={props.onOpenLutEditor}
        onOpenColorNodeEditor={props.onOpenColorNodeEditor}
        onOpenColorAnalysis={props.onOpenColorAnalysis}
        onOpenErrorKnowledge={props.onOpenErrorKnowledge}
        onOpenFormatConverter={props.onOpenFormatConverter}
        onOpenEmotionAnalysis={props.onOpenEmotionAnalysis}
        onOpenExportHistoryClassifier={props.onOpenExportHistoryClassifier}
        onOpenSyncCompare={props.onOpenSyncCompare}
        onOpenSceneReorder={props.onOpenSceneReorder}
        onOpenSceneDetection={props.onOpenSceneDetection}
        onOpenStyleTransfer={props.onOpenStyleTransfer}
        onOpenCollaborationNotes={props.onOpenCollaborationNotes}
        onOpenOperationRecording={props.onOpenOperationRecording}
        onOpenComplexityScore={props.onOpenComplexityScore}
        onOpenSmartRecommendations={props.onOpenSmartRecommendations}
        onOpenContentAnalysis={props.onOpenContentAnalysis}
        onOpenPerformanceProfiler={props.onOpenPerformanceProfiler}
        onOpenRhythmAnalysis={props.onOpenRhythmAnalysis}
        onOpenSubtitleSync={props.onOpenSubtitleSync}
        onOpenBeatSync={props.onOpenBeatSync}
        onDetectBeats={props.onDetectBeats}
        onSnapToBeats={props.onSnapToBeats}
        onSplitToBeats={props.onSplitToBeats}
        onSeparateAudio={props.onSeparateAudio}
        onCancelAudioSeparation={props.onCancelAudioSeparation}
        onRunSpeakerDiarization={props.onRunSpeakerDiarization}
        onOpenAutoAudioSync={props.onOpenAutoAudioSync}
        onGenerateNarration={props.onGenerateNarration}
        onOpenAssistEditing={props.onOpenAssistEditing}
        onOpenContentGeneration={props.onOpenContentGeneration}
        onOpenQualityAssessment={props.onOpenQualityAssessment}
        onOpenMacroHistory={props.onOpenMacroHistory}
        onStartMacroRecording={props.onStartMacroRecording}
        onStopMacroRecording={props.onStopMacroRecording}
      />
      <HelpMenu
        open={openMenu === 'help'}
        onToggle={toggle('help')}
        onStartTutorial={props.onStartTutorial}
      />
      <div className="mr-2 min-w-0">
        <div className="truncate text-sm font-semibold text-ink" data-testid="toolbar-project-name">
          {project.name}
        </div>
        <div className="text-xs text-slate-500" data-testid="toolbar-project-status">
          {dirty ? zhCN.common.unsavedChanges : zhCN.common.saved}
          {backupDisplayTime ? (
            <span data-testid="toolbar-backup-status"> · {t.lastBackupAt(backupDisplayTime)}</span>
          ) : null}
        </div>
      </div>
      <ToolButton title={t.newProject} onClick={props.onNewProject} icon={<FilePlus2 size={17} />} testId="toolbar-new-project-button" />
      <ToolButton title={t.openProject} onClick={props.onOpenProject} icon={<FolderOpen size={17} />} testId="toolbar-open-project-button" />
      <ToolButton title={t.saveProject} onClick={props.onSaveProject} icon={<Save size={17} />} testId="toolbar-save-project-button" />
      <ToolButton title={t.saveEncryptedProject} onClick={props.onSaveEncryptedProject} icon={<LockKeyhole size={17} />} testId="toolbar-save-encrypted-project-button" />
      <ToolButton title={t.archiveProject} onClick={props.onArchiveProject} icon={<Archive size={17} />} testId="toolbar-archive-project-button" />
      <div className="mx-1 h-7 w-px bg-line" />
      <ImportMenu
        open={openMenu === 'import'}
        onToggle={toggle('import')}
        onImportMedia={props.onImportMedia}
        onImportSubtitles={props.onImportSubtitles}
        onImportDataSubtitles={props.onImportDataSubtitles}
      />
      <ToolButton title={t.importMedia} onClick={props.onImportMedia} icon={<FileDown size={17} />} testId="toolbar-import-media-button" />
      <ToolButton title={t.importSubtitles} onClick={props.onImportSubtitles} icon={<Captions size={17} />} testId="import-subtitles-button" />
      <RecordMenu
        open={openMenu === 'record'}
        onToggle={toggle('record')}
        recordingActive={props.recordingActive}
        recordingElapsedSeconds={props.recordingElapsedSeconds}
        onStartRecording={props.onStartRecording}
        onStopRecording={props.onStopRecording}
      />
      <ToolButton title={canExport ? t.exportVideo : t.exportDisabled} disabled={!canExport || isExporting} onClick={props.onExportVideo} icon={<Download size={17} />} testId="toolbar-export-button" />
      <ToolButton title={t.exportTimeline} disabled={isExporting} onClick={props.onExportTimeline} icon={<FileDown size={17} />} testId="toolbar-export-timeline-button" />
      <ToolButton title={canExport ? t.exportCurrentFrame : t.exportDisabled} disabled={!canExport || isExporting} onClick={props.onExportCurrentFrame} icon={<ImageDown size={17} />} testId="toolbar-export-frame-button" />
      <label className="inline-flex h-9 items-center gap-1 rounded-md border border-line bg-panel px-2 text-[11px] text-slate-600" title={t.previewQuality}>
        <span>{t.previewQuality}</span>
        <select
          className="h-6 rounded border border-line bg-white px-1 text-xs font-medium text-slate-700"
          value={props.previewQualityMode}
          data-testid="toolbar-preview-quality-select"
          onChange={(event) => props.onPreviewQualityModeChange(event.target.value as PreviewQualityMode)}
        >
          {PREVIEW_QUALITY_MODES.map((mode) => (
            <option key={mode} value={mode}>{t.previewQualityOptions[mode]}</option>
          ))}
        </select>
      </label>
      <ToolButton title={props.previewWindowOpen ? t.previewWindowOpen : t.popoutPreview} onClick={props.onPopoutPreview} icon={<Monitor size={17} />} testId="toolbar-popout-preview-button" active={props.previewWindowOpen} />
      <ToolButton title={t.gridSnap} onClick={props.onToggleTimelineGridSnap} icon={<Grid2X2 size={17} />} testId="toolbar-grid-snap-button" active={props.timelineGridSettings.enabled} />
      <label className="inline-flex h-9 items-center gap-1 rounded-md border border-line bg-panel px-2 text-[11px] text-slate-600" title={t.gridSnapUnit}>
        <span>{t.gridSnapUnit}</span>
        <select
          className="h-6 rounded border border-line bg-white px-1 text-xs font-medium text-slate-700"
          value={props.timelineGridSettings.unit}
          data-testid="toolbar-grid-snap-unit-select"
          onChange={(event) => props.onTimelineGridUnitChange(event.target.value as TimelineGridUnit)}
        >
          {TIMELINE_GRID_UNITS.map((unit) => (
            <option key={unit} value={unit}>{t.gridSnapUnits[unit]}</option>
          ))}
        </select>
      </label>
      <div className="relative">
        <button
          className={`inline-flex h-9 w-9 items-center justify-center rounded-md border border-transparent text-slate-700 transition hover:border-line hover:bg-panel hover:text-ink${openMenu === 'workspaceLayout' ? ' border-brand bg-brand text-white' : ''}`}
          type="button"
          title={t.workspaceLayout}
          aria-label={t.workspaceLayout}
          data-testid="toolbar-workspace-layout-button"
          onClick={toggle('workspaceLayout')}
        >
          <PanelsTopLeft size={17} />
        </button>
        {openMenu === 'workspaceLayout' ? (
          <WorkspaceLayoutPicker
            layouts={props.workspaceLayouts}
            activeLayoutId={props.activeWorkspaceLayoutId}
            onApply={(layoutId) => { setOpenMenu(null); props.onApplyWorkspaceLayout(layoutId); }}
            onSave={() => { setOpenMenu(null); props.onSaveWorkspaceLayout(); }}
          />
        ) : null}
      </div>
      {checkCostAlert(usageRecords, costAlertThreshold) ? (
        <ToolButton title={zhCN.settings.aiServices.costAlertTitle} onClick={props.onOpenSettings} icon={<AlertTriangle size={17} className="text-amber-500" />} testId="toolbar-cost-alert" />
      ) : null}
      <ToolButton title={t.settings} onClick={props.onOpenSettings} icon={<Settings size={17} />} testId="toolbar-settings-button" />
      <ToolButton title={t.clearMediaCache} onClick={props.onClearCache} icon={<Trash2 size={17} />} testId="settings-clear-cache-button" />
      <label className="ml-1 inline-flex h-9 items-center gap-1 rounded-md border border-line bg-panel px-2 text-[11px] text-slate-600" title={t.autosaveInterval}>
        <span>{t.autosave}</span>
        <input
          className="h-6 w-12 rounded border border-line bg-white px-1 text-right tabular-nums text-slate-700"
          type="number"
          min={1}
          max={600}
          step={5}
          value={props.autosaveIntervalSeconds}
          onChange={(event) => props.onAutosaveIntervalSecondsChange(Number(event.target.value))}
          data-testid="autosave-interval-input"
        />
        <span>{zhCN.common.secondsShort}</span>
      </label>
      <div className="flex h-9 min-w-[380px] items-center gap-1 rounded-md border border-line bg-panel px-2 text-[11px] text-slate-600" title={t.whisperExecutable}>
        <Mic2 size={14} />
        <input
          className="h-6 min-w-0 flex-1 rounded border border-line bg-white px-1 text-slate-700"
          value={whisperExecutablePath}
          placeholder={t.whisperExecutable}
          onChange={(event) => setWhisperExecutablePath(event.target.value)}
          data-testid="whisper-executable-path-input"
        />
        <button
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-line bg-white text-slate-600 hover:bg-panel"
          type="button"
          title={t.chooseWhisperExecutable}
          aria-label={t.chooseWhisperExecutable}
          data-testid="choose-whisper-executable-button"
          onClick={() => void chooseWhisperExecutable()}
        >
          <FolderOpen size={13} />
        </button>
        <input
          className="h-6 min-w-0 flex-1 rounded border border-line bg-white px-1 text-slate-700"
          value={whisperModelPath}
          placeholder={t.whisperModel}
          onChange={(event) => setWhisperModelPath(event.target.value)}
          data-testid="whisper-model-path-input"
        />
        <button
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-line bg-white text-slate-600 hover:bg-panel"
          type="button"
          title={t.chooseWhisperModel}
          aria-label={t.chooseWhisperModel}
          data-testid="choose-whisper-model-button"
          onClick={() => void chooseWhisperModel()}
        >
          <FolderOpen size={13} />
        </button>
      </div>
      <div className="mx-1 h-7 w-px bg-line" />
      <ToolButton title={t.undo} disabled={!historyMeta.canUndo} onClick={props.onUndo} icon={<Undo2 size={17} />} testId="toolbar-undo-button" />
      <ToolButton title={t.redo} disabled={!historyMeta.canRedo} onClick={props.onRedo} icon={<Redo2 size={17} />} testId="toolbar-redo-button" />
      <ToolButton title={t.history} onClick={props.onToggleHistoryPanel} icon={<History size={17} />} testId="toolbar-history-button" active={props.historyPanelOpen} />
      <ToolButton title={t.projectDocumentation} onClick={props.onToggleProjectDocumentation} icon={<FileText size={17} />} testId="toolbar-project-documentation-button" active={props.projectDocumentationOpen} />
      <ToolButton title={t.storyboard} onClick={props.onToggleStoryboard} icon={<LayoutGrid size={17} />} testId="storyboard-toggle-button" active={props.storyboardOpen} />
      <ToolButton title={t.splitSelectedClip} onClick={props.onSplitSelected} icon={<Scissors size={17} />} testId="toolbar-split-button" />
      <ToolButton title={t.smartRoughCut} onClick={props.onToggleSmartRoughCut} icon={<WandSparkles size={17} />} testId="toolbar-smart-rough-cut-button" active={props.smartRoughCutOpen} />
      <ToolButton title={zhCN.aiRoughCut.title} onClick={props.onToggleAIRoughCut} icon={<WandSparkles size={17} />} testId="toolbar-ai-rough-cut-button" active={props.aiRoughCutOpen} />
      <ToolButton title={zhCN.directorMode.title} onClick={props.onToggleDirectorMode} icon={<WandSparkles size={17} />} testId="toolbar-director-mode-button" active={props.directorModeOpen} />
      <ToolButton title={zhCN.musicMatch.title} onClick={props.onToggleMusicMatch} icon={<WandSparkles size={17} />} testId="toolbar-music-match-button" active={props.musicMatchOpen} />
      <ToolButton title={zhCN.highlightReel.title} onClick={props.onToggleHighlightReel} icon={<WandSparkles size={17} />} testId="toolbar-highlight-reel-button" active={props.highlightReelOpen} />
      <ToolButton title={zhCN.contextualTranslation.title} onClick={props.onToggleContextualTranslation} icon={<WandSparkles size={17} />} testId="toolbar-contextual-translation-button" active={props.contextualTranslationOpen} />
      <ToolButton title={zhCN.aiChatEditor.title} onClick={props.onToggleAIChatEditor} icon={<WandSparkles size={17} />} testId="toolbar-ai-chat-editor-button" active={props.aiChatEditorOpen} />
      <ToolButton title={featureStrings.smartCreation.title} onClick={props.onToggleSmartCreation} icon={<WandSparkles size={17} />} testId="toolbar-smart-creation-button" active={props.smartCreationOpen} />
      <ToolButton title={t.createMulticamSequence} disabled={!props.canCreateMulticamSequence} onClick={props.onCreateMulticamSequence} icon={<PanelsTopLeft size={17} />} testId="toolbar-create-multicam-button" />
      <div className="relative">
        <button
          className={`inline-flex h-9 w-9 items-center justify-center rounded-md border border-transparent text-slate-700 transition${openMenu === 'splitLayout' ? ' border-brand bg-brand text-white' : ''}${props.canApplySplitLayout ? ' hover:border-line hover:bg-panel hover:text-ink' : ' opacity-40'}`}
          type="button"
          title={t.applySplitLayout}
          aria-label={t.applySplitLayout}
          disabled={!props.canApplySplitLayout}
          data-testid="toolbar-split-layout-button"
          onClick={toggle('splitLayout')}
        >
          <LayoutGrid size={17} />
        </button>
        {openMenu === 'splitLayout' ? (
          <SplitLayoutPicker
            customLayouts={props.customSplitLayouts}
            customRatio={customSplitRatio}
            onCustomRatioChange={setCustomSplitRatio}
            onApply={(layoutId) => { setOpenMenu(null); props.onApplySplitLayout(layoutId); }}
            onSaveCustom={async () => {
              const layoutId = await props.onSaveCustomSplitLayout(customSplitRatio);
              setOpenMenu(null);
              props.onApplySplitLayout(layoutId);
            }}
          />
        ) : null}
      </div>
      <ToolButton title={t.applyPiPLayout} disabled={!props.canApplyPiPLayout} onClick={props.onApplyPiPLayout} icon={<PictureInPicture2 size={17} />} testId="toolbar-pip-button" />
      <select
        className="h-9 rounded-md border border-line bg-panel px-2 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        title={t.pipPosition}
        aria-label={t.pipPosition}
        disabled={!props.canApplyPiPLayout}
        value={props.pipLayoutPosition}
        data-testid="toolbar-pip-position-select"
        onChange={(event) => props.onPiPLayoutPositionChange(event.target.value as PiPLayoutPosition)}
      >
        <option value="bottom-right">{t.pipPositions['bottom-right']}</option>
        <option value="bottom-left">{t.pipPositions['bottom-left']}</option>
        <option value="top-right">{t.pipPositions['top-right']}</option>
        <option value="top-left">{t.pipPositions['top-left']}</option>
      </select>
      <div className="mx-1 h-7 w-px bg-line" />
      <ToolButton
        title={isPlaying ? t.pause : t.play}
        onClick={() => setIsPlaying(!isPlaying)}
        icon={isPlaying ? <Pause size={17} /> : <Play size={17} />}
        testId="toolbar-playback-button"
        playbackState={isPlaying ? 'playing' : 'paused'}
      />
      {activeMediaJobCount > 0 ? (
        <button
          className="inline-flex h-8 items-center gap-1 rounded-full border border-line bg-panel px-2 text-xs font-semibold text-slate-700 hover:bg-white"
          type="button"
          title={zhCN.settings.taskMonitor.title}
          aria-label={zhCN.settings.taskMonitor.title}
          data-testid="media-job-monitor-badge"
          onClick={props.onOpenSettings}
        >
          <Monitor size={13} />
          <span data-testid="media-job-monitor-badge-count">{activeMediaJobCount}</span>
        </button>
      ) : null}
      {typeof exportProgress === 'number' ? (
        <div className="ml-auto flex min-w-[220px] items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full bg-brand transition-all" style={{ width: `${Math.round(exportProgress * 100)}%` }} />
          </div>
          <div className="w-10 text-right text-xs tabular-nums text-slate-600">{Math.round(exportProgress * 100)}%</div>
          {isExporting ? (
            <ToolButton title={t.cancelExport} onClick={props.onCancelExport} icon={<XCircle size={16} />} testId="toolbar-cancel-export-button" />
          ) : null}
          {props.lastExportPath && props.onRevealExport ? (
            <button
              className="rounded-md border border-line bg-white p-2 text-slate-700 hover:bg-panel"
              title={t.openExportFolder}
              onClick={props.onRevealExport}
              data-testid="toolbar-open-export-folder-button"
            >
              <RotateCcw size={15} />
            </button>
          ) : null}
        </div>
      ) : (
        <div className="ml-auto text-xs text-slate-500">{t.localExport}</div>
      )}
    </header>
  );
}

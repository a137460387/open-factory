import { Activity, Archive, Camera, Captions, ChevronDown, CircleHelp, ClipboardList, Download, FileDown, FilePlus2, FileText, FolderOpen, GitCompareArrows, Grid2X2, History, ImageDown, LayoutGrid, LockKeyhole, MessageSquareText, Mic2, Monitor, PanelsTopLeft, Pause, PictureInPicture2, Play, Redo2, RotateCcw, Save, Scissors, Settings, Square, Trash2, Undo2, WandSparkles, XCircle } from 'lucide-react';
import {
  BUILT_IN_SPLIT_LAYOUTS,
  SPLIT_LAYOUT_PRESET_IDS,
  timelineHasExportableVideo,
  type BeatSensitivity,
  type PiPLayoutPosition,
  type SplitLayoutDefinition,
  type SubtitleDataImportMode,
  type TimelineGridSettings,
  type TimelineGridUnit
} from '@open-factory/editor-core';
import { clsx } from 'clsx';
import { useState } from 'react';
import { formatBackupDisplayTime } from '../backup/projectBackup';
import { useExportQueueStore } from '../export/export-queue-store';
import { zhCN } from '../i18n/strings';
import { pickWhisperExecutablePath, pickWhisperModelPath } from '../lib/whisper';
import { showToast } from '../lib/toast';
import { useMediaJobStore } from '../media/media-job-store';
import { PREVIEW_QUALITY_MODES, type PreviewQualityMode } from '../lib/preview/preview-performance';
import { useEditorStore } from '../store/editorStore';
import { useWhisperSettingsStore } from '../store/whisperSettingsStore';
import type { WorkspaceLayoutDefinition, WorkspaceLayoutId } from '../layout/layoutSettings';
import type { TimelineHeatmapViewSettings } from '../settings/appSettings';

interface ToolbarProps {
  onNewProject(): void;
  onNewFromTemplate(): void;
  onSaveTimelineTemplate(): void;
  onNewFromTimelineTemplate(): void;
  onOpenProject(): void;
  onSaveProject(): void;
  onSaveEncryptedProject(): void;
  onArchiveProject(): void;
  onCreateMediaReport(): void;
  onCreateClipReport(): void;
  onCreateSharePackage(): void;
  onImportBookmarks(): void;
  onExportBookmarks(): void;
  onSaveSnapshot(): void;
  onOpenSnapshotHistory(): void;
  onOpenSnapshotCompare(): void;
  onImportMedia(): void;
  onImportDataSubtitles(mode: SubtitleDataImportMode): void;
  onBatchTranscode(): void;
  onOpenBatchWatermark(): void;
  onOpenBatchProjectProcessing(): void;
  onOpenMediaPrecheck(): void;
  onOpenVideoStitchWizard(): void;
  onOpenSyncCompare(): void;
  onOpenSceneReorder(): void;
  onOpenStyleTransfer(): void;
  onOpenCollaborationNotes(): void;
  onOpenOperationRecording(): void;
  onOpenComplexityScore(): void;
  onOpenSmartRecommendations(): void;
  onOpenContentAnalysis(): void;
  onOpenRhythmAnalysis(): void;
  onOpenBeatSync(): void;
  onDetectBeats(): void;
  onSnapToBeats(): void;
  onSplitToBeats(): void;
  onOpenMacroHistory(): void;
  onStartMacroRecording(): void;
  onStopMacroRecording(): void;
  onImportSubtitles(): void;
  onStartRecording(source: 'screen' | 'camera'): void;
  onStopRecording(): void;
  onExportVideo(): void;
  onExportTimeline(): void;
  onExportCurrentFrame(): void;
  onCancelExport(): void;
  onSplitSelected(): void;
  onToggleSmartRoughCut(): void;
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
  canOpenSceneReorder: boolean;
  pipLayoutPosition: PiPLayoutPosition;
  onPiPLayoutPositionChange(position: PiPLayoutPosition): void;
  customSplitLayouts: SplitLayoutDefinition[];
  canDetectBeats: boolean;
  canSnapToBeats: boolean;
  canSplitToBeats: boolean;
  beatSensitivity: BeatSensitivity;
  onBeatSensitivityChange(sensitivity: BeatSensitivity): void;
  canSeparateAudio: boolean;
  audioSeparationRunning: boolean;
  audioSeparationProgress?: number;
  canRunSpeakerDiarization: boolean;
  speakerDiarizationRunning: boolean;
  macroRecordingActive: boolean;
  macroRecordingStepCount: number;
  recordingActive: boolean;
  recordingElapsedSeconds: number;
  smartRoughCutOpen: boolean;
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

const TIMELINE_GRID_UNITS: TimelineGridUnit[] = ['frame', '5-frames', '10-frames', 'second', '5-seconds', 'beat', 'measure', 'four-measures'];

export function Toolbar(props: ToolbarProps) {
  const t = zhCN.toolbar;
  const edit = zhCN.editMenu;
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [importMenuOpen, setImportMenuOpen] = useState(false);
  const [editMenuOpen, setEditMenuOpen] = useState(false);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);
  const [helpMenuOpen, setHelpMenuOpen] = useState(false);
  const [recordMenuOpen, setRecordMenuOpen] = useState(false);
  const [splitLayoutOpen, setSplitLayoutOpen] = useState(false);
  const [workspaceLayoutOpen, setWorkspaceLayoutOpen] = useState(false);
  const [subtitleDataImportMode, setSubtitleDataImportMode] = useState<SubtitleDataImportMode>('append');
  const [customSplitRatio, setCustomSplitRatio] = useState(0.67);
  const project = useEditorStore((state) => state.project);
  const isPlaying = useEditorStore((state) => state.isPlaying);
  const setIsPlaying = useEditorStore((state) => state.setIsPlaying);
  const historyMeta = useEditorStore((state) => state.historyMeta);
  const dirty = useEditorStore((state) => state.dirty);
  const runningExportTask = useExportQueueStore((state) => state.tasks.find((task) => task.status === 'running'));
  const activeMediaJobCount = useMediaJobStore((state) => state.jobs.filter((job) => job.status === 'pending' || job.status === 'running').length);
  const whisperExecutablePath = useWhisperSettingsStore((state) => state.executablePath);
  const whisperModelPath = useWhisperSettingsStore((state) => state.modelPath);
  const setWhisperExecutablePath = useWhisperSettingsStore((state) => state.setExecutablePath);
  const setWhisperModelPath = useWhisperSettingsStore((state) => state.setModelPath);
  const isExporting = Boolean(runningExportTask);
  const exportProgress = runningExportTask?.progress;
  const canExport = timelineHasExportableVideo(project.timeline);
  const backupDisplayTime = formatBackupDisplayTime(props.lastBackupAt);
  const chooseWhisperExecutable = async () => {
    try {
      const path = await pickWhisperExecutablePath();
      if (path) {
        setWhisperExecutablePath(path);
      }
    } catch (error) {
      showToast({ kind: 'warning', title: t.chooseWhisperExecutable, message: error instanceof Error ? error.message : zhCN.common.unavailable });
    }
  };
  const chooseWhisperModel = async () => {
    try {
      const path = await pickWhisperModelPath();
      if (path) {
        setWhisperModelPath(path);
      }
    } catch (error) {
      showToast({ kind: 'warning', title: t.chooseWhisperModel, message: error instanceof Error ? error.message : zhCN.common.unavailable });
    }
  };

  if (props.reviewMode) {
    return (
      <header className="relative z-30 flex min-h-14 min-w-0 items-center gap-2 overflow-x-auto border-b border-line bg-white px-3" data-testid="review-toolbar">
        <div className="mr-2 text-sm font-semibold text-ink">{t.reviewMode}</div>
        <div className="relative">
          <button
            className="inline-flex h-9 items-center gap-1 rounded-md border border-transparent px-3 text-sm font-medium text-slate-700 hover:border-line hover:bg-panel hover:text-ink"
            type="button"
            data-testid="toolbar-view-menu-button"
            onClick={() => {
              setViewMenuOpen((open) => !open);
            }}
          >
            {t.viewMenu}
            <ChevronDown size={14} />
          </button>
          {viewMenuOpen ? (
            <div className="absolute left-0 top-10 z-20 min-w-44 rounded-md border border-line bg-white py-1 shadow-soft" data-testid="toolbar-view-menu">
              <button
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-panel"
                type="button"
                data-testid="toolbar-view-review-mode-menu-item"
                onClick={() => {
                  setViewMenuOpen(false);
                  props.onToggleReviewMode();
                }}
              >
                <span>{t.exitReviewMode}</span>
              </button>
              <button
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-panel"
                type="button"
                data-testid="toolbar-view-export-review-report-menu-item"
                onClick={() => {
                  setViewMenuOpen(false);
                  props.onCreateReviewReport();
                }}
              >
                <span>{t.exportReviewReport}</span>
                <FileDown size={14} />
              </button>
            </div>
          ) : null}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <ToolButton title={isPlaying ? t.pause : t.play} onClick={() => setIsPlaying(!isPlaying)} icon={isPlaying ? <Pause size={17} /> : <Play size={17} />} testId="toolbar-playback-button" playbackState={isPlaying ? 'playing' : 'paused'} />
        </div>
      </header>
    );
  }

  return (
    <header className="relative z-30 flex min-h-14 min-w-0 items-center gap-2 overflow-x-auto border-b border-line bg-white px-3">
      <div className="relative">
        <button
          className="inline-flex h-9 items-center gap-1 rounded-md border border-transparent px-3 text-sm font-medium text-slate-700 hover:border-line hover:bg-panel hover:text-ink"
          type="button"
          data-testid="toolbar-file-menu-button"
          onClick={() => {
            setImportMenuOpen(false);
            setEditMenuOpen(false);
            setViewMenuOpen(false);
            setToolsMenuOpen(false);
            setSplitLayoutOpen(false);
            setWorkspaceLayoutOpen(false);
            setFileMenuOpen((open) => !open);
          }}
        >
          {t.fileMenu}
          <ChevronDown size={14} />
        </button>
        {fileMenuOpen ? (
          <div className="absolute left-0 top-10 z-20 min-w-44 rounded-md border border-line bg-white py-1 shadow-soft" data-testid="toolbar-file-menu">
            <button
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-panel"
              type="button"
              data-testid="toolbar-file-new-template-menu-item"
              onClick={() => {
                setFileMenuOpen(false);
                props.onNewFromTemplate();
              }}
            >
              <span>{t.newFromTemplate}</span>
            </button>
            <button
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-panel"
              type="button"
              data-testid="toolbar-file-save-timeline-template-menu-item"
              onClick={() => {
                setFileMenuOpen(false);
                props.onSaveTimelineTemplate();
              }}
            >
              <span>{t.saveTimelineTemplate}</span>
            </button>
            <button
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-panel"
              type="button"
              data-testid="toolbar-file-new-timeline-template-menu-item"
              onClick={() => {
                setFileMenuOpen(false);
                props.onNewFromTimelineTemplate();
              }}
            >
              <span>{t.newFromTimelineTemplate}</span>
            </button>
            <button
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-panel"
              type="button"
              data-testid="toolbar-file-media-report-menu-item"
              onClick={() => {
                setFileMenuOpen(false);
                props.onCreateMediaReport();
              }}
            >
              <span>{t.mediaReport}</span>
            </button>
            <button
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-panel"
              type="button"
              data-testid="toolbar-file-clip-report-menu-item"
              onClick={() => {
                setFileMenuOpen(false);
                props.onCreateClipReport();
              }}
            >
              <span>{t.clipReport}</span>
            </button>
            <button
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-panel"
              type="button"
              data-testid="toolbar-file-archive-project-menu-item"
              onClick={() => {
                setFileMenuOpen(false);
                props.onArchiveProject();
              }}
            >
              <span>{t.archiveProject}</span>
            </button>
            <button
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-panel"
              type="button"
              disabled={!canExport || isExporting || props.sharePackageBusy}
              data-testid="toolbar-file-share-package-menu-item"
              onClick={() => {
                setFileMenuOpen(false);
                props.onCreateSharePackage();
              }}
            >
              <span>{t.createSharePackage}</span>
            </button>
            <button
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-panel"
              type="button"
              data-testid="toolbar-file-project-health-menu-item"
              onClick={() => {
                setFileMenuOpen(false);
                props.onOpenProjectHealth();
              }}
            >
              <span>{t.projectHealthCheck}</span>
            </button>
            <div className="my-1 h-px bg-line" />
            <button
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-panel"
              type="button"
              data-testid="toolbar-file-import-bookmarks-menu-item"
              onClick={() => {
                setFileMenuOpen(false);
                props.onImportBookmarks();
              }}
            >
              <span>{t.importBookmarks}</span>
            </button>
            <button
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-panel"
              type="button"
              data-testid="toolbar-file-export-bookmarks-menu-item"
              onClick={() => {
                setFileMenuOpen(false);
                props.onExportBookmarks();
              }}
            >
              <span>{t.exportBookmarks}</span>
            </button>
          </div>
        ) : null}
      </div>
      <div className="relative">
        <button
          className="inline-flex h-9 items-center gap-1 rounded-md border border-transparent px-3 text-sm font-medium text-slate-700 hover:border-line hover:bg-panel hover:text-ink"
          type="button"
          data-testid="toolbar-edit-menu-button"
          onClick={() => {
            setFileMenuOpen(false);
            setImportMenuOpen(false);
            setViewMenuOpen(false);
            setToolsMenuOpen(false);
            setSplitLayoutOpen(false);
            setWorkspaceLayoutOpen(false);
            setEditMenuOpen((open) => !open);
          }}
        >
          {t.editMenu}
          <ChevronDown size={14} />
        </button>
        {editMenuOpen ? (
          <div className="absolute left-0 top-10 z-20 min-w-44 rounded-md border border-line bg-white py-1 shadow-soft" data-testid="toolbar-edit-menu">
            <button
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-panel"
              type="button"
              data-testid="toolbar-edit-save-snapshot-menu-item"
              onClick={() => {
                setEditMenuOpen(false);
                props.onSaveSnapshot();
              }}
            >
              <span>{edit.saveSnapshot}</span>
            </button>
            <button
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-panel"
              type="button"
              data-testid="toolbar-edit-snapshot-history-menu-item"
              onClick={() => {
                setEditMenuOpen(false);
                props.onOpenSnapshotHistory();
              }}
            >
              <span>{edit.snapshotHistory}</span>
            </button>
            <button
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-panel"
              type="button"
              data-testid="toolbar-edit-version-compare-menu-item"
              onClick={() => {
                setEditMenuOpen(false);
                props.onOpenSnapshotCompare();
              }}
            >
              <span>{edit.versionCompare}</span>
            </button>
          </div>
        ) : null}
      </div>
      <div className="relative">
        <button
          className="inline-flex h-9 items-center gap-1 rounded-md border border-transparent px-3 text-sm font-medium text-slate-700 hover:border-line hover:bg-panel hover:text-ink"
          type="button"
          data-testid="toolbar-view-menu-button"
          onClick={() => {
            setFileMenuOpen(false);
            setEditMenuOpen(false);
            setToolsMenuOpen(false);
            setSplitLayoutOpen(false);
            setWorkspaceLayoutOpen(false);
            setViewMenuOpen((open) => !open);
          }}
        >
          {t.viewMenu}
          <ChevronDown size={14} />
        </button>
        {viewMenuOpen ? (
          <div className="absolute left-0 top-10 z-20 min-w-44 rounded-md border border-line bg-white py-1 shadow-soft" data-testid="toolbar-view-menu">
            <button
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-panel"
              type="button"
              data-testid="toolbar-view-safe-frame-guides-menu-item"
              aria-pressed={props.safeFrameGuides}
              onClick={() => {
                props.onToggleSafeFrameGuides();
              }}
            >
              <span>{t.safeFrameGuides}</span>
              <span className="text-xs text-slate-500">{props.safeFrameGuides ? t.safeFrameGuidesVisible : t.safeFrameGuidesHidden}</span>
            </button>
            <button
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-panel"
              type="button"
              data-testid="toolbar-view-thumbnail-track-menu-item"
              aria-pressed={props.thumbnailTrackVisible}
              onClick={() => {
                props.onToggleThumbnailTrack();
              }}
            >
              <span>{t.thumbnailTrack}</span>
              <span className="text-xs text-slate-500">{props.thumbnailTrackVisible ? t.safeFrameGuidesVisible : t.safeFrameGuidesHidden}</span>
            </button>
            <button
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-panel"
              type="button"
              data-testid="toolbar-view-minimap-menu-item"
              aria-pressed={props.timelineMinimapVisible}
              onClick={() => {
                props.onToggleTimelineMinimap();
              }}
            >
              <span>{t.timelineMinimap}</span>
              <span className="text-xs text-slate-500">{props.timelineMinimapVisible ? t.safeFrameGuidesVisible : t.safeFrameGuidesHidden}</span>
            </button>
            <div className="my-1 border-t border-line" />
            <button
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-panel"
              type="button"
              data-testid="toolbar-view-heatmap-menu-item"
              aria-pressed={props.timelineHeatmap.enabled}
              onClick={() => props.onTimelineHeatmapChange({ enabled: !props.timelineHeatmap.enabled })}
            >
              <span>{t.timelineHeatmap}</span>
              <span className="text-xs text-slate-500">{props.timelineHeatmap.enabled ? t.safeFrameGuidesVisible : t.safeFrameGuidesHidden}</span>
            </button>
            {props.timelineHeatmap.enabled ? (
              <div className="space-y-2 px-3 pb-2 text-xs text-slate-600" data-testid="toolbar-view-heatmap-controls">
                <label className="block">
                  <span className="sr-only">{t.timelineHeatmap}</span>
                  <select
                    className="mt-1 w-full rounded border border-line bg-white px-2 py-1 text-xs"
                    value={props.timelineHeatmap.type}
                    data-testid="toolbar-view-heatmap-type-select"
                    onChange={(event) => props.onTimelineHeatmapChange({ type: event.target.value as TimelineHeatmapViewSettings['type'] })}
                  >
                    {(['edit-density', 'volume', 'cut-frequency'] as const).map((type) => (
                      <option key={type} value={type}>
                        {t.heatmapTypes[type]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="flex items-center justify-between">
                    <span>{t.heatmapOpacity}</span>
                    <span className="tabular-nums">{Math.round(props.timelineHeatmap.opacity * 100)}%</span>
                  </span>
                  <input
                    className="mt-1 w-full accent-brand"
                    type="range"
                    min={0}
                    max={80}
                    step={5}
                    value={Math.round(props.timelineHeatmap.opacity * 100)}
                    data-testid="toolbar-view-heatmap-opacity-input"
                    onChange={(event) => props.onTimelineHeatmapChange({ opacity: Number(event.target.value) / 100 })}
                  />
                </label>
                <label className="block">
                  <span>{t.heatmapColorScheme}</span>
                  <select
                    className="mt-1 w-full rounded border border-line bg-white px-2 py-1 text-xs"
                    value={props.timelineHeatmap.colorScheme}
                    data-testid="toolbar-view-heatmap-color-select"
                    onChange={(event) => props.onTimelineHeatmapChange({ colorScheme: event.target.value as TimelineHeatmapViewSettings['colorScheme'] })}
                  >
                    {(['warm', 'cool', 'mono'] as const).map((scheme) => (
                      <option key={scheme} value={scheme}>
                        {t.heatmapColorSchemes[scheme]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}
            <button
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-panel"
              type="button"
              data-testid="toolbar-view-review-mode-menu-item"
              aria-pressed={props.reviewMode}
              onClick={() => {
                setViewMenuOpen(false);
                props.onToggleReviewMode();
              }}
            >
              <span>{t.reviewMode}</span>
              <span className="text-xs text-slate-500">#review</span>
            </button>
          </div>
        ) : null}
      </div>
      <div className="relative">
        <button
          className="inline-flex h-9 items-center gap-1 rounded-md border border-transparent px-3 text-sm font-medium text-slate-700 hover:border-line hover:bg-panel hover:text-ink"
          type="button"
          data-testid="toolbar-tools-menu-button"
          onClick={() => {
            setFileMenuOpen(false);
            setEditMenuOpen(false);
            setViewMenuOpen(false);
            setSplitLayoutOpen(false);
            setWorkspaceLayoutOpen(false);
            setToolsMenuOpen((open) => !open);
          }}
        >
          {t.toolsMenu}
          <ChevronDown size={14} />
        </button>
        {toolsMenuOpen ? (
          <div className="absolute left-0 top-10 z-20 min-w-44 rounded-md border border-line bg-white py-1 shadow-soft" data-testid="toolbar-tools-menu">
            <button
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-panel"
              type="button"
              data-testid="toolbar-tools-batch-transcode-menu-item"
              onClick={() => {
                setToolsMenuOpen(false);
                props.onBatchTranscode();
              }}
            >
              <span>{t.batchTranscode}</span>
            </button>
            <button
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-panel"
              type="button"
              data-testid="toolbar-tools-batch-watermark-menu-item"
              onClick={() => {
                setToolsMenuOpen(false);
                props.onOpenBatchWatermark();
              }}
            >
              <span>{t.batchWatermark}</span>
              <ImageDown size={14} />
            </button>
            <button
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-panel"
              type="button"
              data-testid="toolbar-tools-batch-project-menu-item"
              onClick={() => {
                setToolsMenuOpen(false);
                props.onOpenBatchProjectProcessing();
              }}
            >
              <span>{t.batchProjectProcessing}</span>
              <ClipboardList size={14} />
            </button>
            <button
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-panel"
              type="button"
              data-testid="toolbar-tools-media-precheck-menu-item"
              onClick={() => {
                setToolsMenuOpen(false);
                props.onOpenMediaPrecheck();
              }}
            >
              <span>{t.mediaPrecheck}</span>
            </button>
            <button
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-panel"
              type="button"
              data-testid="toolbar-tools-video-stitch-menu-item"
              onClick={() => {
                setToolsMenuOpen(false);
                props.onOpenVideoStitchWizard();
              }}
            >
              <span>{t.videoStitchWizard}</span>
            </button>
            <button
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={!props.canOpenSyncCompare}
              data-testid="toolbar-tools-sync-compare-menu-item"
              onClick={() => {
                setToolsMenuOpen(false);
                props.onOpenSyncCompare();
              }}
            >
              <span>{t.syncCompare}</span>
              <GitCompareArrows size={14} />
            </button>
            <button
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={!props.canOpenSceneReorder}
              data-testid="toolbar-tools-scene-reorder-menu-item"
              onClick={() => {
                setToolsMenuOpen(false);
                props.onOpenSceneReorder();
              }}
            >
              <span>{t.sceneReorder}</span>
              <WandSparkles size={14} />
            </button>
            <button
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-panel"
              type="button"
              data-testid="toolbar-tools-style-transfer-menu-item"
              onClick={() => {
                setToolsMenuOpen(false);
                props.onOpenStyleTransfer();
              }}
            >
              <span>{t.styleTransfer}</span>
              <WandSparkles size={14} />
            </button>
            <button
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-panel"
              type="button"
              data-testid="toolbar-tools-collaboration-notes-menu-item"
              onClick={() => {
                setToolsMenuOpen(false);
                props.onOpenCollaborationNotes();
              }}
            >
              <span>{t.collaborationNotes}</span>
              <MessageSquareText size={14} />
            </button>
            <button
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-panel"
              type="button"
              data-testid="toolbar-tools-operation-recording-menu-item"
              onClick={() => {
                setToolsMenuOpen(false);
                props.onOpenOperationRecording();
              }}
            >
              <span>{t.operationRecording}</span>
              <History size={14} />
            </button>
            <button
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-panel"
              type="button"
              data-testid="toolbar-tools-complexity-score-menu-item"
              onClick={() => {
                setToolsMenuOpen(false);
                props.onOpenComplexityScore();
              }}
            >
              <span>{t.complexityScore}</span>
              <Activity size={14} />
            </button>
            <button
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-panel"
              type="button"
              data-testid="toolbar-tools-smart-recommendations-menu-item"
              onClick={() => {
                setToolsMenuOpen(false);
                props.onOpenSmartRecommendations();
              }}
            >
              <span>{t.smartRecommendations}</span>
              <WandSparkles size={14} />
            </button>
            <button
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-panel"
              type="button"
              data-testid="toolbar-tools-content-analysis-menu-item"
              onClick={() => {
                setToolsMenuOpen(false);
                props.onOpenContentAnalysis();
              }}
            >
              <span>{t.contentAnalysis}</span>
              <Activity size={14} />
            </button>
            <button
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-panel"
              type="button"
              data-testid="toolbar-tools-rhythm-analysis-menu-item"
              onClick={() => {
                setToolsMenuOpen(false);
                props.onOpenRhythmAnalysis();
              }}
            >
              <span>{t.rhythmAnalysis}</span>
              <Activity size={14} />
            </button>
            <button
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-panel"
              type="button"
              data-testid="toolbar-tools-beat-sync-menu-item"
              onClick={() => {
                setToolsMenuOpen(false);
                props.onOpenBeatSync();
              }}
            >
              <span>{t.beatSync}</span>
              <Activity size={14} />
            </button>
            <label className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs text-slate-600" data-testid="toolbar-tools-beat-sensitivity-row">
              <span>{t.beatSensitivity}</span>
              <select
                className="rounded border border-line bg-white px-2 py-1 text-xs text-slate-700"
                value={props.beatSensitivity}
                data-testid="toolbar-tools-beat-sensitivity-select"
                onClick={(event) => event.stopPropagation()}
                onChange={(event) => props.onBeatSensitivityChange(event.target.value as BeatSensitivity)}
              >
                <option value="low">{t.beatSensitivityOptions.low}</option>
                <option value="medium">{t.beatSensitivityOptions.medium}</option>
                <option value="high">{t.beatSensitivityOptions.high}</option>
              </select>
            </label>
            <button
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={!props.canDetectBeats}
              data-testid="toolbar-tools-detect-beats-menu-item"
              onClick={() => {
                setToolsMenuOpen(false);
                props.onDetectBeats();
              }}
            >
              <span>{t.detectBeats}</span>
            </button>
            <button
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={!props.canSnapToBeats}
              data-testid="toolbar-tools-snap-to-beats-menu-item"
              onClick={() => {
                setToolsMenuOpen(false);
                props.onSnapToBeats();
              }}
            >
              <span>{t.snapToBeats}</span>
            </button>
            <button
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={!props.canSplitToBeats}
              data-testid="toolbar-tools-split-to-beats-menu-item"
              onClick={() => {
                setToolsMenuOpen(false);
                props.onSplitToBeats();
              }}
            >
              <span>{t.splitToBeats}</span>
            </button>
            <button
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={!props.canSeparateAudio && !props.audioSeparationRunning}
              data-testid="toolbar-tools-audio-separation-menu-item"
              onClick={() => {
                setToolsMenuOpen(false);
                if (props.audioSeparationRunning) {
                  props.onCancelAudioSeparation();
                } else {
                  props.onSeparateAudio();
                }
              }}
            >
              <span>{props.audioSeparationRunning ? t.cancelAudioSeparation : t.audioSeparation}</span>
              {props.audioSeparationRunning && props.audioSeparationProgress !== undefined ? <span className="text-xs text-slate-500">{Math.round(props.audioSeparationProgress * 100)}%</span> : null}
            </button>
            <button
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={!props.canRunSpeakerDiarization || props.speakerDiarizationRunning}
              data-testid="toolbar-tools-speaker-diarization-menu-item"
              onClick={() => {
                setToolsMenuOpen(false);
                props.onRunSpeakerDiarization();
              }}
            >
              <span>{t.speakerDiarization}</span>
              <Mic2 size={14} />
            </button>
            <button
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-panel"
              type="button"
              data-testid="toolbar-tools-macro-history-menu-item"
              onClick={() => {
                setToolsMenuOpen(false);
                props.onOpenMacroHistory();
              }}
            >
              <span>{t.macroHistory}</span>
            </button>
            <button
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={props.macroRecordingActive}
              data-testid="toolbar-tools-start-macro-recording-menu-item"
              onClick={() => {
                setToolsMenuOpen(false);
                props.onStartMacroRecording();
              }}
            >
              <span>{t.startMacroRecording}</span>
            </button>
            <button
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={!props.macroRecordingActive}
              data-testid="toolbar-tools-stop-macro-recording-menu-item"
              onClick={() => {
                setToolsMenuOpen(false);
                props.onStopMacroRecording();
              }}
            >
              <span>{t.stopMacroRecording}</span>
              <span className="text-xs text-slate-500">{t.macroRecordingSteps(props.macroRecordingStepCount)}</span>
            </button>
          </div>
        ) : null}
      </div>
      <div className="relative">
        <button
          className="inline-flex h-9 items-center gap-1 rounded-md border border-transparent px-3 text-sm font-medium text-slate-700 hover:border-line hover:bg-panel hover:text-ink"
          type="button"
          data-testid="toolbar-help-menu-button"
          onClick={() => {
            setFileMenuOpen(false);
            setImportMenuOpen(false);
            setEditMenuOpen(false);
            setViewMenuOpen(false);
            setToolsMenuOpen(false);
            setSplitLayoutOpen(false);
            setWorkspaceLayoutOpen(false);
            setHelpMenuOpen((open) => !open);
          }}
        >
          {t.helpMenu}
          <ChevronDown size={14} />
        </button>
        {helpMenuOpen ? (
          <div className="absolute left-0 top-10 z-20 min-w-44 rounded-md border border-line bg-white py-1 shadow-soft" data-testid="toolbar-help-menu">
            <button
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-panel"
              type="button"
              data-testid="toolbar-help-tutorial-menu-item"
              onClick={() => {
                setHelpMenuOpen(false);
                props.onStartTutorial();
              }}
            >
              <span>{zhCN.tutorial.start}</span>
              <CircleHelp size={14} />
            </button>
          </div>
        ) : null}
      </div>
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
      <div className="relative">
        <button
          className="inline-flex h-9 items-center gap-1 rounded-md border border-transparent px-3 text-sm font-medium text-slate-700 hover:border-line hover:bg-panel hover:text-ink"
          type="button"
          data-testid="toolbar-import-menu-button"
          onClick={() => {
            setFileMenuOpen(false);
            setEditMenuOpen(false);
            setViewMenuOpen(false);
            setToolsMenuOpen(false);
            setRecordMenuOpen(false);
            setSplitLayoutOpen(false);
            setWorkspaceLayoutOpen(false);
            setImportMenuOpen((open) => !open);
          }}
        >
          {t.importMenu}
          <ChevronDown size={14} />
        </button>
        {importMenuOpen ? (
          <div className="absolute left-0 top-10 z-20 w-64 rounded-md border border-line bg-white p-2 shadow-soft" data-testid="toolbar-import-menu">
            <button
              className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm text-slate-700 hover:bg-panel"
              type="button"
              data-testid="toolbar-import-media-menu-item"
              onClick={() => {
                setImportMenuOpen(false);
                props.onImportMedia();
              }}
            >
              <FileDown size={14} />
              <span>{t.importMedia}</span>
            </button>
            <button
              className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm text-slate-700 hover:bg-panel"
              type="button"
              data-testid="toolbar-import-subtitles-menu-item"
              onClick={() => {
                setImportMenuOpen(false);
                props.onImportSubtitles();
              }}
            >
              <Captions size={14} />
              <span>{t.importSubtitles}</span>
            </button>
            <div className="my-2 h-px bg-line" />
            <label className="mb-1 block px-2 text-[11px] font-medium uppercase tracking-wide text-slate-500" htmlFor="subtitle-data-import-mode-select">
              {t.subtitleDataImportMode}
            </label>
            <select
              id="subtitle-data-import-mode-select"
              className="mb-2 h-8 w-full rounded border border-line bg-white px-2 text-xs text-slate-700"
              value={subtitleDataImportMode}
              data-testid="subtitle-data-import-mode-select"
              onChange={(event) => setSubtitleDataImportMode(event.target.value as SubtitleDataImportMode)}
            >
              <option value="append">{t.subtitleDataImportModes.append}</option>
              <option value="new-track">{t.subtitleDataImportModes['new-track']}</option>
              <option value="replace-current-track">{t.subtitleDataImportModes['replace-current-track']}</option>
            </select>
            <button
              className="flex w-full items-center gap-2 rounded bg-brand px-2 py-2 text-left text-sm font-medium text-white"
              type="button"
              data-testid="import-data-subtitles-button"
              onClick={() => {
                setImportMenuOpen(false);
                props.onImportDataSubtitles(subtitleDataImportMode);
              }}
            >
              <Captions size={14} />
              <span>{t.importDataSubtitles}</span>
            </button>
          </div>
        ) : null}
      </div>
      <ToolButton title={t.importMedia} onClick={props.onImportMedia} icon={<FileDown size={17} />} testId="toolbar-import-media-button" />
      <ToolButton title={t.importSubtitles} onClick={props.onImportSubtitles} icon={<Captions size={17} />} testId="import-subtitles-button" />
      <div className="relative">
        <button
          className="inline-flex h-9 items-center gap-1 rounded-md border border-line bg-panel px-2 text-sm font-medium text-slate-700 hover:bg-white"
          type="button"
          data-testid="toolbar-record-menu-button"
          onClick={() => {
            if (props.recordingActive) {
              props.onStopRecording();
              return;
            }
            setFileMenuOpen(false);
            setEditMenuOpen(false);
            setViewMenuOpen(false);
            setToolsMenuOpen(false);
            setSplitLayoutOpen(false);
            setWorkspaceLayoutOpen(false);
            setRecordMenuOpen((open) => !open);
          }}
        >
          {props.recordingActive ? <Square size={15} /> : <Monitor size={15} />}
          <span>{props.recordingActive ? t.stopRecording : t.record}</span>
          {props.recordingActive ? <span className="text-xs tabular-nums text-slate-500">{formatRecordingElapsed(props.recordingElapsedSeconds)}</span> : <ChevronDown size={14} />}
        </button>
        {recordMenuOpen ? (
          <div className="absolute left-0 top-10 z-20 min-w-40 rounded-md border border-line bg-white py-1 shadow-soft" data-testid="toolbar-record-menu">
            <button
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-panel"
              type="button"
              data-testid="toolbar-record-screen-menu-item"
              onClick={() => {
                setRecordMenuOpen(false);
                props.onStartRecording('screen');
              }}
            >
              <Monitor size={14} />
              <span>{t.recordScreen}</span>
            </button>
            <button
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-panel"
              type="button"
              data-testid="toolbar-record-camera-menu-item"
              onClick={() => {
                setRecordMenuOpen(false);
                props.onStartRecording('camera');
              }}
            >
              <Camera size={14} />
              <span>{t.recordCamera}</span>
            </button>
          </div>
        ) : null}
      </div>
      <ToolButton title={canExport ? t.exportVideo : t.exportDisabled} disabled={!canExport || isExporting} onClick={props.onExportVideo} icon={<Download size={17} />} testId="toolbar-export-button" />
      <ToolButton title={t.exportTimeline} disabled={isExporting} onClick={props.onExportTimeline} icon={<FileDown size={17} />} testId="toolbar-export-timeline-button" />
      <ToolButton
        title={canExport ? t.exportCurrentFrame : t.exportDisabled}
        disabled={!canExport || isExporting}
        onClick={props.onExportCurrentFrame}
        icon={<ImageDown size={17} />}
        testId="toolbar-export-frame-button"
      />
      <label className="inline-flex h-9 items-center gap-1 rounded-md border border-line bg-panel px-2 text-[11px] text-slate-600" title={t.previewQuality}>
        <span>{t.previewQuality}</span>
        <select
          className="h-6 rounded border border-line bg-white px-1 text-xs font-medium text-slate-700"
          value={props.previewQualityMode}
          data-testid="toolbar-preview-quality-select"
          onChange={(event) => props.onPreviewQualityModeChange(event.target.value as PreviewQualityMode)}
        >
          {PREVIEW_QUALITY_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {t.previewQualityOptions[mode]}
            </option>
          ))}
        </select>
      </label>
      <ToolButton
        title={props.previewWindowOpen ? t.previewWindowOpen : t.popoutPreview}
        onClick={props.onPopoutPreview}
        icon={<Monitor size={17} />}
        testId="toolbar-popout-preview-button"
        active={props.previewWindowOpen}
      />
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
            <option key={unit} value={unit}>
              {t.gridSnapUnits[unit]}
            </option>
          ))}
        </select>
      </label>
      <div className="relative">
        <button
          className={clsx(
            'inline-flex h-9 w-9 items-center justify-center rounded-md border border-transparent text-slate-700 transition hover:border-line hover:bg-panel hover:text-ink',
            workspaceLayoutOpen ? 'border-brand bg-brand text-white' : undefined
          )}
          type="button"
          title={t.workspaceLayout}
          aria-label={t.workspaceLayout}
          data-testid="toolbar-workspace-layout-button"
          onClick={() => {
            setFileMenuOpen(false);
            setImportMenuOpen(false);
            setEditMenuOpen(false);
            setViewMenuOpen(false);
            setToolsMenuOpen(false);
            setRecordMenuOpen(false);
            setSplitLayoutOpen(false);
            setWorkspaceLayoutOpen((open) => !open);
          }}
        >
          <PanelsTopLeft size={17} />
        </button>
        {workspaceLayoutOpen ? (
          <WorkspaceLayoutPicker
            layouts={props.workspaceLayouts}
            activeLayoutId={props.activeWorkspaceLayoutId}
            onApply={(layoutId) => {
              setWorkspaceLayoutOpen(false);
              props.onApplyWorkspaceLayout(layoutId);
            }}
            onSave={() => {
              setWorkspaceLayoutOpen(false);
              props.onSaveWorkspaceLayout();
            }}
          />
        ) : null}
      </div>
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
      <ToolButton title={t.createMulticamSequence} disabled={!props.canCreateMulticamSequence} onClick={props.onCreateMulticamSequence} icon={<PanelsTopLeft size={17} />} testId="toolbar-create-multicam-button" />
      <div className="relative">
        <button
          className={clsx(
            'inline-flex h-9 w-9 items-center justify-center rounded-md border border-transparent text-slate-700 transition',
            splitLayoutOpen ? 'border-brand bg-brand text-white' : undefined,
            props.canApplySplitLayout ? 'hover:border-line hover:bg-panel hover:text-ink' : 'opacity-40'
          )}
          type="button"
          title={t.applySplitLayout}
          aria-label={t.applySplitLayout}
          disabled={!props.canApplySplitLayout}
          data-testid="toolbar-split-layout-button"
          onClick={() => {
            setFileMenuOpen(false);
            setEditMenuOpen(false);
            setViewMenuOpen(false);
            setToolsMenuOpen(false);
            setRecordMenuOpen(false);
            setWorkspaceLayoutOpen(false);
            setSplitLayoutOpen((open) => !open);
          }}
        >
          <LayoutGrid size={17} />
        </button>
        {splitLayoutOpen ? (
          <SplitLayoutPicker
            customLayouts={props.customSplitLayouts}
            customRatio={customSplitRatio}
            onCustomRatioChange={setCustomSplitRatio}
            onApply={(layoutId) => {
              setSplitLayoutOpen(false);
              props.onApplySplitLayout(layoutId);
            }}
            onSaveCustom={async () => {
              const layoutId = await props.onSaveCustomSplitLayout(customSplitRatio);
              setSplitLayoutOpen(false);
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
      <ToolButton title={isPlaying ? t.pause : t.play} onClick={() => setIsPlaying(!isPlaying)} icon={isPlaying ? <Pause size={17} /> : <Play size={17} />} testId="toolbar-playback-button" playbackState={isPlaying ? 'playing' : 'paused'} />
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
          {isExporting ? <ToolButton title={t.cancelExport} onClick={props.onCancelExport} icon={<XCircle size={16} />} testId="toolbar-cancel-export-button" /> : null}
          {props.lastExportPath && props.onRevealExport ? (
            <button className="rounded-md border border-line bg-white p-2 text-slate-700 hover:bg-panel" title={t.openExportFolder} onClick={props.onRevealExport} data-testid="toolbar-open-export-folder-button">
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

interface ToolButtonProps {
  title: string;
  icon: React.ReactNode;
  disabled?: boolean;
  active?: boolean;
  onClick(): void;
  testId?: string;
  playbackState?: 'playing' | 'paused';
}

function SplitLayoutPicker({
  customLayouts,
  customRatio,
  onCustomRatioChange,
  onApply,
  onSaveCustom
}: {
  customLayouts: SplitLayoutDefinition[];
  customRatio: number;
  onCustomRatioChange(value: number): void;
  onApply(layoutId: string): void;
  onSaveCustom(): Promise<void>;
}) {
  const t = zhCN.toolbar;
  const layouts = [...SPLIT_LAYOUT_PRESET_IDS.map((id) => BUILT_IN_SPLIT_LAYOUTS[id]), ...customLayouts];
  return (
    <div className="absolute left-0 top-10 z-30 w-80 rounded-md border border-line bg-white p-3 text-xs shadow-soft" data-testid="split-layout-picker">
      <div className="mb-2 font-semibold text-slate-700">{t.applySplitLayout}</div>
      <div className="grid grid-cols-2 gap-2">
        {layouts.map((layout) => (
          <button
            key={layout.id}
            className="rounded-md border border-line bg-panel p-2 text-left hover:border-brand hover:bg-white"
            type="button"
            data-testid={`split-layout-option-${layout.id}`}
            onClick={() => onApply(layout.id)}
          >
            <SplitLayoutPreview layout={layout} />
            <div className="mt-1 truncate font-medium text-slate-700">{t.splitLayouts[layout.id as keyof typeof t.splitLayouts] ?? layout.name}</div>
          </button>
        ))}
      </div>
      <div className="mt-3 rounded-md border border-line bg-panel p-2">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="font-medium text-slate-700">{t.customSplitLayout}</span>
          <span className="tabular-nums text-slate-500">{Math.round(customRatio * 100)}%</span>
        </div>
        <input
          className="w-full"
          type="range"
          min={20}
          max={80}
          step={1}
          value={Math.round(customRatio * 100)}
          data-testid="split-layout-custom-ratio-input"
          onChange={(event) => onCustomRatioChange(Number(event.target.value) / 100)}
        />
        <button
          className="mt-2 inline-flex w-full items-center justify-center rounded-md border border-line bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-panel"
          type="button"
          data-testid="split-layout-save-custom"
          onClick={() => void onSaveCustom()}
        >
          {t.saveCustomSplitLayout}
        </button>
      </div>
    </div>
  );
}

function WorkspaceLayoutPicker({
  layouts,
  activeLayoutId,
  onApply,
  onSave
}: {
  layouts: WorkspaceLayoutDefinition[];
  activeLayoutId: WorkspaceLayoutId;
  onApply(layoutId: WorkspaceLayoutId): void;
  onSave(): void;
}) {
  const t = zhCN.toolbar;
  const builtInLayouts = layouts.filter((layout) => layout.builtIn);
  const customLayouts = layouts.filter((layout) => !layout.builtIn);
  return (
    <div className="absolute left-0 top-10 z-30 w-72 rounded-md border border-line bg-white p-3 text-xs shadow-soft" data-testid="workspace-layout-picker">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="font-semibold text-slate-700">{t.workspaceLayout}</div>
        <button
          className="rounded border border-line bg-panel px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-white"
          type="button"
          data-testid="workspace-layout-save-button"
          onClick={onSave}
        >
          {t.saveWorkspaceLayout}
        </button>
      </div>
      <WorkspaceLayoutGroup title={t.builtInWorkspaceLayouts} layouts={builtInLayouts} activeLayoutId={activeLayoutId} onApply={onApply} />
      <div className="mt-3">
        <div className="mb-1 px-1 text-[11px] font-semibold uppercase text-slate-500">{t.customWorkspaceLayouts}</div>
        {customLayouts.length > 0 ? (
          <div className="space-y-1">
            {customLayouts.map((layout) => (
              <WorkspaceLayoutOption key={layout.id} layout={layout} active={layout.id === activeLayoutId} onApply={onApply} />
            ))}
          </div>
        ) : (
          <div className="rounded border border-dashed border-line px-2 py-3 text-center text-slate-500" data-testid="workspace-layout-empty-custom">
            {t.noCustomWorkspaceLayouts}
          </div>
        )}
      </div>
    </div>
  );
}

function WorkspaceLayoutGroup({
  title,
  layouts,
  activeLayoutId,
  onApply
}: {
  title: string;
  layouts: WorkspaceLayoutDefinition[];
  activeLayoutId: WorkspaceLayoutId;
  onApply(layoutId: WorkspaceLayoutId): void;
}) {
  return (
    <div>
      <div className="mb-1 px-1 text-[11px] font-semibold uppercase text-slate-500">{title}</div>
      <div className="space-y-1">
        {layouts.map((layout) => (
          <WorkspaceLayoutOption key={layout.id} layout={layout} active={layout.id === activeLayoutId} onApply={onApply} />
        ))}
      </div>
    </div>
  );
}

function WorkspaceLayoutOption({
  layout,
  active,
  onApply
}: {
  layout: WorkspaceLayoutDefinition;
  active: boolean;
  onApply(layoutId: WorkspaceLayoutId): void;
}) {
  const t = zhCN.toolbar;
  const name = layout.builtIn ? t.workspaceLayouts[layout.id as keyof typeof t.workspaceLayouts] ?? layout.name : layout.name;
  return (
    <button
      className={clsx('flex w-full items-center justify-between gap-2 rounded-md border px-2 py-2 text-left hover:bg-panel', active ? 'border-brand bg-brand/5 text-brand' : 'border-line text-slate-700')}
      type="button"
      data-testid={`workspace-layout-option-${layout.id}`}
      aria-pressed={active}
      onClick={() => onApply(layout.id)}
    >
      <span className="min-w-0 truncate font-medium">{name}</span>
      <span className="shrink-0 text-[11px] text-slate-500">{active ? t.workspaceLayoutActive : layout.shortcutSlot ? t.workspaceShortcut(layout.shortcutSlot) : ''}</span>
    </button>
  );
}

function SplitLayoutPreview({ layout }: { layout: SplitLayoutDefinition }) {
  return (
    <svg className="h-16 w-full rounded border border-line bg-black" viewBox="0 0 120 68" role="img" aria-hidden="true">
      {layout.cells.map((cell, index) => (
        <rect
          key={`${cell.x}-${cell.y}-${cell.width}-${cell.height}-${index}`}
          x={cell.x * 120 + 1}
          y={cell.y * 68 + 1}
          width={Math.max(1, cell.width * 120 - 2)}
          height={Math.max(1, cell.height * 68 - 2)}
          fill={index % 2 === 0 ? '#2dd4bf' : '#60a5fa'}
          opacity={0.9}
        />
      ))}
    </svg>
  );
}

function ToolButton({ title, icon, disabled, active, onClick, testId, playbackState }: ToolButtonProps) {
  return (
    <button
      className={clsx(
        'inline-flex h-9 w-9 items-center justify-center rounded-md border border-transparent text-slate-700 transition',
        active ? 'border-brand bg-brand text-white' : undefined,
        disabled ? 'opacity-40' : 'hover:border-line hover:bg-panel hover:text-ink'
      )}
      title={title}
      aria-label={title}
      data-testid={testId}
      data-playback-state={playbackState}
      disabled={disabled}
      onClick={onClick}
    >
      {icon}
    </button>
  );
}

function formatRecordingElapsed(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60)
    .toString()
    .padStart(2, '0');
  const remainingSeconds = (safeSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainingSeconds}`;
}

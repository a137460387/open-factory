import { Archive, Captions, ChevronDown, Download, FileDown, FilePlus2, FolderOpen, ImageDown, Mic2, PanelsTopLeft, Pause, Play, Redo2, RotateCcw, Save, Scissors, Settings, Trash2, Undo2, WandSparkles, XCircle } from 'lucide-react';
import { timelineHasExportableVideo } from '@open-factory/editor-core';
import { clsx } from 'clsx';
import { useState } from 'react';
import { useExportQueueStore } from '../export/export-queue-store';
import { zhCN } from '../i18n/strings';
import { pickWhisperExecutablePath, pickWhisperModelPath } from '../lib/whisper';
import { showToast } from '../lib/toast';
import { useEditorStore } from '../store/editorStore';
import { useWhisperSettingsStore } from '../store/whisperSettingsStore';

interface ToolbarProps {
  onNewProject(): void;
  onNewFromTemplate(): void;
  onOpenProject(): void;
  onSaveProject(): void;
  onArchiveProject(): void;
  onCreateMediaReport(): void;
  onCreateSharePackage(): void;
  onImportMedia(): void;
  onBatchTranscode(): void;
  onImportSubtitles(): void;
  onExportVideo(): void;
  onExportTimeline(): void;
  onExportCurrentFrame(): void;
  onCancelExport(): void;
  onSplitSelected(): void;
  onToggleSmartRoughCut(): void;
  onCreateMulticamSequence(): void;
  canCreateMulticamSequence: boolean;
  smartRoughCutOpen: boolean;
  onUndo(): void;
  onRedo(): void;
  onClearCache(): void;
  onOpenSettings(): void;
  onOpenProjectHealth(): void;
  sharePackageBusy?: boolean;
  autosaveIntervalSeconds: number;
  onAutosaveIntervalSecondsChange(seconds: number): void;
  onRevealExport?(): void;
  lastExportPath?: string;
}

export function Toolbar(props: ToolbarProps) {
  const t = zhCN.toolbar;
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);
  const project = useEditorStore((state) => state.project);
  const isPlaying = useEditorStore((state) => state.isPlaying);
  const setIsPlaying = useEditorStore((state) => state.setIsPlaying);
  const historyMeta = useEditorStore((state) => state.historyMeta);
  const dirty = useEditorStore((state) => state.dirty);
  const runningExportTask = useExportQueueStore((state) => state.tasks.find((task) => task.status === 'running'));
  const whisperExecutablePath = useWhisperSettingsStore((state) => state.executablePath);
  const whisperModelPath = useWhisperSettingsStore((state) => state.modelPath);
  const setWhisperExecutablePath = useWhisperSettingsStore((state) => state.setExecutablePath);
  const setWhisperModelPath = useWhisperSettingsStore((state) => state.setModelPath);
  const isExporting = Boolean(runningExportTask);
  const exportProgress = runningExportTask?.progress;
  const canExport = timelineHasExportableVideo(project.timeline);
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

  return (
    <header className="flex min-h-14 min-w-0 items-center gap-2 overflow-x-auto border-b border-line bg-white px-3">
      <div className="relative">
        <button
          className="inline-flex h-9 items-center gap-1 rounded-md border border-transparent px-3 text-sm font-medium text-slate-700 hover:border-line hover:bg-panel hover:text-ink"
          type="button"
          data-testid="toolbar-file-menu-button"
          onClick={() => {
            setToolsMenuOpen(false);
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
          </div>
        ) : null}
      </div>
      <div className="mr-2 min-w-0">
        <div className="truncate text-sm font-semibold text-ink">{project.name}</div>
        <div className="text-xs text-slate-500">{dirty ? zhCN.common.unsavedChanges : zhCN.common.saved}</div>
      </div>
      <ToolButton title={t.newProject} onClick={props.onNewProject} icon={<FilePlus2 size={17} />} testId="toolbar-new-project-button" />
      <ToolButton title={t.openProject} onClick={props.onOpenProject} icon={<FolderOpen size={17} />} testId="toolbar-open-project-button" />
      <ToolButton title={t.saveProject} onClick={props.onSaveProject} icon={<Save size={17} />} testId="toolbar-save-project-button" />
      <ToolButton title={t.archiveProject} onClick={props.onArchiveProject} icon={<Archive size={17} />} testId="toolbar-archive-project-button" />
      <div className="mx-1 h-7 w-px bg-line" />
      <ToolButton title={t.importMedia} onClick={props.onImportMedia} icon={<FileDown size={17} />} testId="toolbar-import-media-button" />
      <ToolButton title={t.importSubtitles} onClick={props.onImportSubtitles} icon={<Captions size={17} />} testId="import-subtitles-button" />
      <ToolButton title={canExport ? t.exportVideo : t.exportDisabled} disabled={!canExport || isExporting} onClick={props.onExportVideo} icon={<Download size={17} />} testId="toolbar-export-button" />
      <ToolButton title={t.exportTimeline} disabled={!canExport || isExporting} onClick={props.onExportTimeline} icon={<FileDown size={17} />} testId="toolbar-export-timeline-button" />
      <ToolButton
        title={canExport ? t.exportCurrentFrame : t.exportDisabled}
        disabled={!canExport || isExporting}
        onClick={props.onExportCurrentFrame}
        icon={<ImageDown size={17} />}
        testId="toolbar-export-frame-button"
      />
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
      <ToolButton title={t.splitSelectedClip} onClick={props.onSplitSelected} icon={<Scissors size={17} />} testId="toolbar-split-button" />
      <ToolButton title={t.smartRoughCut} onClick={props.onToggleSmartRoughCut} icon={<WandSparkles size={17} />} testId="toolbar-smart-rough-cut-button" active={props.smartRoughCutOpen} />
      <ToolButton title={t.createMulticamSequence} disabled={!props.canCreateMulticamSequence} onClick={props.onCreateMulticamSequence} icon={<PanelsTopLeft size={17} />} testId="toolbar-create-multicam-button" />
      <div className="mx-1 h-7 w-px bg-line" />
      <ToolButton title={isPlaying ? t.pause : t.play} onClick={() => setIsPlaying(!isPlaying)} icon={isPlaying ? <Pause size={17} /> : <Play size={17} />} testId="toolbar-playback-button" playbackState={isPlaying ? 'playing' : 'paused'} />
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

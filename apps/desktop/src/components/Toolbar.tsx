import { Captions, Download, FileDown, FilePlus2, FolderOpen, Pause, Play, Redo2, RotateCcw, Save, Scissors, Trash2, Undo2, XCircle } from 'lucide-react';
import { timelineHasExportableVideo } from '@open-factory/editor-core';
import { clsx } from 'clsx';
import { useExportQueueStore } from '../export/export-queue-store';
import { useEditorStore } from '../store/editorStore';

interface ToolbarProps {
  onNewProject(): void;
  onOpenProject(): void;
  onSaveProject(): void;
  onImportMedia(): void;
  onImportSubtitles(): void;
  onExportVideo(): void;
  onCancelExport(): void;
  onSplitSelected(): void;
  onUndo(): void;
  onRedo(): void;
  onClearCache(): void;
  autosaveIntervalSeconds: number;
  onAutosaveIntervalSecondsChange(seconds: number): void;
  onRevealExport?(): void;
  lastExportPath?: string;
}

export function Toolbar(props: ToolbarProps) {
  const project = useEditorStore((state) => state.project);
  const isPlaying = useEditorStore((state) => state.isPlaying);
  const setIsPlaying = useEditorStore((state) => state.setIsPlaying);
  const historyMeta = useEditorStore((state) => state.historyMeta);
  const dirty = useEditorStore((state) => state.dirty);
  const runningExportTask = useExportQueueStore((state) => state.tasks.find((task) => task.status === 'running'));
  const isExporting = Boolean(runningExportTask);
  const exportProgress = runningExportTask?.progress;
  const canExport = timelineHasExportableVideo(project.timeline);

  return (
    <header className="flex min-h-14 items-center gap-2 border-b border-line bg-white px-3">
      <div className="mr-2 min-w-0">
        <div className="truncate text-sm font-semibold text-ink">{project.name}</div>
        <div className="text-xs text-slate-500">{dirty ? 'Unsaved changes' : 'Saved'}</div>
      </div>
      <ToolButton title="New project" onClick={props.onNewProject} icon={<FilePlus2 size={17} />} />
      <ToolButton title="Open project" onClick={props.onOpenProject} icon={<FolderOpen size={17} />} />
      <ToolButton title="Save project" onClick={props.onSaveProject} icon={<Save size={17} />} />
      <div className="mx-1 h-7 w-px bg-line" />
      <ToolButton title="Import media" onClick={props.onImportMedia} icon={<FileDown size={17} />} />
      <ToolButton title="Import subtitles" onClick={props.onImportSubtitles} icon={<Captions size={17} />} testId="import-subtitles-button" />
      <ToolButton title={canExport ? 'Export video' : 'Please add media to the timeline'} disabled={!canExport || isExporting} onClick={props.onExportVideo} icon={<Download size={17} />} />
      <ToolButton title="Clear media cache" onClick={props.onClearCache} icon={<Trash2 size={17} />} testId="settings-clear-cache-button" />
      <label className="ml-1 inline-flex h-9 items-center gap-1 rounded-md border border-line bg-panel px-2 text-[11px] text-slate-600" title="Autosave interval">
        <span>Autosave</span>
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
        <span>s</span>
      </label>
      <div className="mx-1 h-7 w-px bg-line" />
      <ToolButton title="Undo" disabled={!historyMeta.canUndo} onClick={props.onUndo} icon={<Undo2 size={17} />} />
      <ToolButton title="Redo" disabled={!historyMeta.canRedo} onClick={props.onRedo} icon={<Redo2 size={17} />} />
      <ToolButton title="Split selected clip" onClick={props.onSplitSelected} icon={<Scissors size={17} />} />
      <div className="mx-1 h-7 w-px bg-line" />
      <ToolButton title={isPlaying ? 'Pause' : 'Play'} onClick={() => setIsPlaying(!isPlaying)} icon={isPlaying ? <Pause size={17} /> : <Play size={17} />} />
      {typeof exportProgress === 'number' ? (
        <div className="ml-auto flex min-w-[220px] items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full bg-brand transition-all" style={{ width: `${Math.round(exportProgress * 100)}%` }} />
          </div>
          <div className="w-10 text-right text-xs tabular-nums text-slate-600">{Math.round(exportProgress * 100)}%</div>
          {isExporting ? <ToolButton title="Cancel export" onClick={props.onCancelExport} icon={<XCircle size={16} />} /> : null}
          {props.lastExportPath && props.onRevealExport ? (
            <button className="rounded-md border border-line bg-white p-2 text-slate-700 hover:bg-panel" title="Open export folder" onClick={props.onRevealExport}>
              <RotateCcw size={15} />
            </button>
          ) : null}
        </div>
      ) : (
        <div className="ml-auto text-xs text-slate-500">Local multitrack export</div>
      )}
    </header>
  );
}

interface ToolButtonProps {
  title: string;
  icon: React.ReactNode;
  disabled?: boolean;
  onClick(): void;
  testId?: string;
}

function ToolButton({ title, icon, disabled, onClick, testId }: ToolButtonProps) {
  return (
    <button
      className={clsx(
        'inline-flex h-9 w-9 items-center justify-center rounded-md border border-transparent text-slate-700 transition',
        disabled ? 'opacity-40' : 'hover:border-line hover:bg-panel hover:text-ink'
      )}
      title={title}
      aria-label={title}
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
    >
      {icon}
    </button>
  );
}

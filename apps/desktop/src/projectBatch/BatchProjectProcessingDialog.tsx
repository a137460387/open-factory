import {
  buildExportProjectFromProject,
  buildFfmpegCurrentFrameExportPlan,
  buildFfmpegExportPlan,
  type Project,
  type SubtitleStyle,
} from '@open-factory/editor-core';
import { ClipboardList, FolderOpen, Loader2, Play, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { zhCN } from '../i18n/strings';
import { readProjectFile, writeProjectFile } from '../lib/projectFiles';
import { getFfmpegCapabilities, openDirectoryDialog, openFileDialog, runExport } from '../lib/tauri-bridge';
import { fileNameFromPath } from '../lib/tauri';
import { showToast } from '../lib/toast';
import {
  buildProjectBatchQueue,
  replaceProjectMediaPathPrefix,
  runProjectBatchQueue,
  serializeProjectBatchReport,
  updateProjectSubtitleStyle,
  type ProjectBatchOperation,
  type ProjectBatchReport,
  type ProjectBatchTask,
  type ProjectBatchTaskResult,
  type ProjectBatchTaskStatus,
} from './projectBatch';

interface BatchProjectProcessingDialogProps {
  onClose(): void;
}

const OPERATIONS: ProjectBatchOperation[] = ['batch-export', 'subtitle-style', 'replace-media-prefix', 'cover-frame'];

export function BatchProjectProcessingDialog({ onClose }: BatchProjectProcessingDialogProps) {
  const t = zhCN.batchProjectProcessing;
  const [paths, setPaths] = useState<string[]>([]);
  const [operation, setOperation] = useState<ProjectBatchOperation>('batch-export');
  const [outputDirectory, setOutputDirectory] = useState('C:/Exports');
  const [fromPrefix, setFromPrefix] = useState('D:/OldMedia');
  const [toPrefix, setToPrefix] = useState('E:/NewMedia');
  const [subtitleFontSize, setSubtitleFontSize] = useState(42);
  const [subtitleColor, setSubtitleColor] = useState('#ffffff');
  const [subtitleBold, setSubtitleBold] = useState(false);
  const [busy, setBusy] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, ProjectBatchTaskStatus>>({});
  const [report, setReport] = useState<ProjectBatchReport>();
  const [reportText, setReportText] = useState('');

  const subtitleStylePatch = useMemo<Partial<SubtitleStyle>>(
    () => ({ fontSize: subtitleFontSize, color: subtitleColor, bold: subtitleBold }),
    [subtitleBold, subtitleColor, subtitleFontSize],
  );
  const tasks = useMemo(
    () =>
      buildProjectBatchQueue(paths, {
        operation,
        outputDirectory,
        pathPrefix: { from: fromPrefix, to: toPrefix },
        subtitleStylePatch,
      }),
    [fromPrefix, operation, outputDirectory, paths, subtitleStylePatch, toPrefix],
  );

  const chooseProjects = async () => {
    const picked = await openFileDialog(true, [
      { name: zhCN.projectFiles.projectFilter, extensions: ['cutproj.json', 'json'] },
    ]);
    if (picked.length > 0) {
      setPaths((current) => uniquePaths([...current, ...picked]));
      setReport(undefined);
      setReportText('');
    }
  };

  const chooseOutputDirectory = async () => {
    const directory = await openDirectoryDialog();
    if (directory) {
      setOutputDirectory(directory);
    }
  };

  const runBatch = async () => {
    if (tasks.length === 0) {
      showToast({ kind: 'warning', title: t.title, message: t.selectFilesFirst });
      return;
    }
    setBusy(true);
    setReport(undefined);
    setReportText('');
    setStatuses(Object.fromEntries(tasks.map((task) => [task.id, 'pending'])));
    try {
      const nextReport = await runProjectBatchQueue(tasks, async (task) => {
        setStatuses((current) => ({ ...current, [task.id]: 'running' }));
        const result = await executeProjectBatchTask(task);
        setStatuses((current) => ({ ...current, [task.id]: result.status ?? 'success' }));
        return result;
      });
      setReport(nextReport);
      setStatuses(Object.fromEntries(nextReport.results.map((result) => [result.task.id, result.status])));
      setReportText(serializeProjectBatchReport(nextReport));
      showToast({
        kind: 'success',
        title: t.completedTitle,
        message: t.completedMessage(nextReport.succeeded, nextReport.failed, nextReport.skipped),
      });
    } catch (error) {
      showToast({
        kind: 'error',
        title: t.failedTitle,
        message: error instanceof Error ? error.message : t.failedMessage,
      });
    } finally {
      setBusy(false);
    }
  };

  const removePath = (path: string) => {
    if (busy) {
      return;
    }
    setPaths((current) => current.filter((item) => item !== path));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
      data-testid="batch-project-dialog"
    >
      <div className="grid max-h-[88vh] w-full max-w-4xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-md border border-line bg-white shadow-soft">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-base font-semibold text-ink">
              <ClipboardList size={18} />
              {t.title}
            </div>
            <div className="mt-0.5 truncate text-xs text-slate-500" data-testid="batch-project-summary">
              {t.summary(tasks.length, report?.succeeded ?? 0, report?.failed ?? 0)}
            </div>
          </div>
          <button
            className="rounded-md p-2 text-slate-500 hover:bg-panel disabled:opacity-50"
            type="button"
            aria-label={zhCN.common.close}
            data-testid="batch-project-close"
            disabled={busy}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_300px] gap-px bg-line">
          <div className="flex min-h-0 flex-col bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
              <div className="text-sm font-semibold text-ink">{t.projectFiles}</div>
              <button
                className="inline-flex items-center gap-2 rounded-md border border-line bg-panel px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white disabled:opacity-50"
                type="button"
                disabled={busy}
                data-testid="batch-project-select-files-button"
                onClick={() => void chooseProjects()}
              >
                <FolderOpen size={14} />
                {paths.length > 0 ? t.addProjects : t.chooseProjects}
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {paths.length === 0 ? (
                <button
                  className="flex min-h-[220px] w-full flex-col items-center justify-center rounded-md border border-dashed border-slate-300 bg-panel p-6 text-center text-sm text-slate-600"
                  type="button"
                  data-testid="batch-project-empty"
                  onClick={() => void chooseProjects()}
                >
                  <ClipboardList className="mb-3 text-slate-500" size={30} />
                  {t.empty}
                </button>
              ) : (
                <div className="space-y-2" data-testid="batch-project-file-list">
                  {tasks.map((task) => {
                    const status = statuses[task.id] ?? 'pending';
                    return (
                      <div
                        key={task.id}
                        className="rounded-md border border-line bg-white p-3"
                        data-testid={`batch-project-task-${fileNameFromPath(task.projectPath)}`}
                        data-status={status}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-ink" title={task.projectPath}>
                              {fileNameFromPath(task.projectPath)}
                            </div>
                            <div className="truncate text-xs text-slate-500">{task.outputPath ?? task.projectPath}</div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusTone(status)}`}
                            >
                              {t.status[status]}
                            </span>
                            {!busy ? (
                              <button
                                className="rounded-md border border-line px-2 py-1 text-xs text-slate-600 hover:bg-panel"
                                type="button"
                                data-testid="batch-project-remove-file"
                                onClick={() => removePath(task.projectPath)}
                              >
                                {zhCN.common.delete}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <div className="min-h-0 overflow-y-auto bg-panel p-4">
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-600">
                {t.operation}
                <select
                  className="mt-1 h-9 w-full rounded-md border border-line bg-white px-2 text-sm text-slate-700"
                  value={operation}
                  data-testid="batch-project-operation-select"
                  disabled={busy}
                  onChange={(event) => setOperation(event.target.value as ProjectBatchOperation)}
                >
                  {OPERATIONS.map((item) => (
                    <option key={item} value={item}>
                      {t.operations[item]}
                    </option>
                  ))}
                </select>
              </label>
              {operation === 'batch-export' || operation === 'cover-frame' ? (
                <label className="block text-xs font-semibold text-slate-600">
                  {t.outputDirectory}
                  <div className="mt-1 flex gap-2">
                    <input
                      className="min-w-0 flex-1 rounded-md border border-line px-2 py-1.5 text-sm text-slate-700"
                      value={outputDirectory}
                      data-testid="batch-project-output-directory-input"
                      disabled={busy}
                      onChange={(event) => setOutputDirectory(event.target.value)}
                    />
                    <button
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line bg-white text-slate-600 hover:bg-panel disabled:opacity-50"
                      type="button"
                      title={t.chooseDirectory}
                      aria-label={t.chooseDirectory}
                      disabled={busy}
                      data-testid="batch-project-output-directory-button"
                      onClick={() => void chooseOutputDirectory()}
                    >
                      <FolderOpen size={15} />
                    </button>
                  </div>
                </label>
              ) : null}
              {operation === 'replace-media-prefix' ? (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-600">
                    {t.fromPrefix}
                    <input
                      className="mt-1 h-9 w-full rounded-md border border-line px-2 text-sm text-slate-700"
                      value={fromPrefix}
                      data-testid="batch-project-from-prefix-input"
                      disabled={busy}
                      onChange={(event) => setFromPrefix(event.target.value)}
                    />
                  </label>
                  <label className="block text-xs font-semibold text-slate-600">
                    {t.toPrefix}
                    <input
                      className="mt-1 h-9 w-full rounded-md border border-line px-2 text-sm text-slate-700"
                      value={toPrefix}
                      data-testid="batch-project-to-prefix-input"
                      disabled={busy}
                      onChange={(event) => setToPrefix(event.target.value)}
                    />
                  </label>
                </div>
              ) : null}
              {operation === 'subtitle-style' ? (
                <div className="grid grid-cols-2 gap-2">
                  <label className="block text-xs font-semibold text-slate-600">
                    {t.subtitleFontSize}
                    <input
                      className="mt-1 h-9 w-full rounded-md border border-line px-2 text-sm text-slate-700"
                      type="number"
                      min={12}
                      max={120}
                      value={subtitleFontSize}
                      data-testid="batch-project-subtitle-font-size-input"
                      disabled={busy}
                      onChange={(event) => setSubtitleFontSize(Number(event.target.value))}
                    />
                  </label>
                  <label className="block text-xs font-semibold text-slate-600">
                    {t.subtitleColor}
                    <input
                      className="mt-1 h-9 w-full rounded-md border border-line px-2 text-sm text-slate-700"
                      type="color"
                      value={subtitleColor}
                      data-testid="batch-project-subtitle-color-input"
                      disabled={busy}
                      onChange={(event) => setSubtitleColor(event.target.value)}
                    />
                  </label>
                  <label className="col-span-2 inline-flex items-center gap-2 rounded-md border border-line bg-white px-2 py-2 text-xs font-semibold text-slate-600">
                    <input
                      className="h-4 w-4 accent-brand"
                      type="checkbox"
                      checked={subtitleBold}
                      data-testid="batch-project-subtitle-bold-input"
                      disabled={busy}
                      onChange={(event) => setSubtitleBold(event.target.checked)}
                    />
                    {t.subtitleBold}
                  </label>
                </div>
              ) : null}
              <div
                className="rounded-md border border-line bg-white p-2 text-xs text-slate-600"
                data-testid="batch-project-operation-hint"
              >
                {t.operationHint[operation]}
              </div>
              {reportText ? (
                <pre
                  className="max-h-56 overflow-auto rounded-md border border-line bg-white p-2 text-[11px] text-slate-700"
                  data-testid="batch-project-report"
                >
                  {reportText}
                </pre>
              ) : (
                <div
                  className="rounded-md border border-dashed border-slate-300 bg-white p-3 text-xs text-slate-500"
                  data-testid="batch-project-report"
                >
                  {t.reportEmpty}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
          <div className="min-w-0 truncate text-xs text-slate-500" data-testid="batch-project-selected-count">
            {t.selectedCount(tasks.length)}
          </div>
          <div className="flex items-center gap-2">
            <button
              className="rounded-md border border-line px-3 py-2 text-sm font-medium text-slate-700 hover:bg-panel disabled:opacity-50"
              type="button"
              disabled={busy}
              onClick={onClose}
            >
              {zhCN.common.close}
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
              type="button"
              disabled={busy || tasks.length === 0}
              data-testid="batch-project-run-button"
              onClick={() => void runBatch()}
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
              {busy ? t.running : t.run}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

async function executeProjectBatchTask(task: ProjectBatchTask): Promise<ProjectBatchTaskResultLike> {
  const project = await readProjectFile(task.projectPath, task.projectPath);
  if (task.operation === 'batch-export') {
    const outputPath = requireOutputPath(task);
    const capabilities = await getFfmpegCapabilities();
    if (!capabilities.available) {
      throw new Error(zhCN.errors.ffmpegMissing);
    }
    const exportProject = buildExportProjectFromProject(project, { outputPath });
    const plan = buildFfmpegExportPlan(exportProject, capabilities);
    await runExport(plan, task.id);
    return { projectName: project.name, outputPath };
  }
  if (task.operation === 'cover-frame') {
    const outputPath = requireOutputPath(task);
    const capabilities = await getFfmpegCapabilities();
    if (!capabilities.available) {
      throw new Error(zhCN.errors.ffmpegMissing);
    }
    const exportProject = buildExportProjectFromProject(project, {
      outputPath,
      settings: { format: 'png', outputMode: 'video' },
    });
    const plan = buildFfmpegCurrentFrameExportPlan(exportProject, 0, capabilities);
    await runExport(plan, task.id);
    return { projectName: project.name, outputPath };
  }
  if (task.operation === 'replace-media-prefix') {
    const prefix = task.pathPrefix;
    if (!prefix?.from.trim() || !prefix.to.trim()) {
      return { status: 'skipped', projectName: project.name, message: zhCN.batchProjectProcessing.emptyPrefixSkipped };
    }
    const result = replaceProjectMediaPathPrefix(project, prefix.from, prefix.to);
    if (result.changedCount === 0) {
      return {
        status: 'skipped',
        projectName: project.name,
        changedCount: 0,
        message: zhCN.batchProjectProcessing.noMatchedPaths,
      };
    }
    await writeProjectFile(result.project, task.projectPath);
    return {
      projectName: project.name,
      changedCount: result.changedCount,
      message: zhCN.batchProjectProcessing.changedCount(result.changedCount),
    };
  }
  const result = updateProjectSubtitleStyle(project, task.subtitleStylePatch ?? {});
  if (result.changedCount === 0) {
    return {
      status: 'skipped',
      projectName: project.name,
      changedCount: 0,
      message: zhCN.batchProjectProcessing.noSubtitleClips,
    };
  }
  await writeProjectFile(result.project, task.projectPath);
  return {
    projectName: project.name,
    changedCount: result.changedCount,
    message: zhCN.batchProjectProcessing.changedCount(result.changedCount),
  };
}

type ProjectBatchTaskResultLike = {
  status?: 'success' | 'skipped';
  projectName?: string;
  outputPath?: string;
  changedCount?: number;
  message?: string;
};

function requireOutputPath(task: ProjectBatchTask): string {
  if (!task.outputPath) {
    throw new Error(zhCN.batchProjectProcessing.outputPathMissing);
  }
  return task.outputPath;
}

function uniquePaths(paths: string[]): string[] {
  return Array.from(new Set(paths.filter(Boolean)));
}

function statusTone(status: ProjectBatchTaskStatus): string {
  if (status === 'success') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  if (status === 'failed') {
    return 'border-rose-200 bg-rose-50 text-rose-700';
  }
  if (status === 'skipped') {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }
  if (status === 'running') {
    return 'border-sky-200 bg-sky-50 text-sky-700';
  }
  return 'border-slate-200 bg-white text-slate-600';
}

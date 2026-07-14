import { createId, type MediaAsset } from '@open-factory/editor-core';
import { FileVideo2, FolderOpen, Loader2, Play, Trash2, X, XCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { zhCN } from '../i18n/strings';
import { pickVideoPaths, probeMediaPaths } from '../lib/media';
import {
  batchTranscodeMedia,
  cancelBatchTranscodeTask,
  listenBatchTranscodeProgress,
  type BatchTranscodePreset,
  type BatchTranscodeProgressEvent,
} from '../lib/tauri-bridge';
import { fileNameFromPath } from '../lib/tauri';
import { showToast } from '../lib/toast';

interface BatchTranscodeDialogProps {
  initialPaths?: string[];
  existingMedia: MediaAsset[];
  onImport(media: MediaAsset[]): void;
  onClose(): void;
}

type BatchTranscodeStatus = 'pending' | 'running' | 'completed' | 'failed' | 'canceled';

interface BatchTranscodeJob {
  taskId: string;
  sourcePath: string;
  outputPath?: string;
  status: BatchTranscodeStatus;
  progress: number;
  error?: string;
}

const PRESETS: BatchTranscodePreset[] = ['h264-720p', 'h264-1080p', 'prores-proxy'];

export function BatchTranscodeDialog({
  initialPaths = [],
  existingMedia,
  onImport,
  onClose,
}: BatchTranscodeDialogProps) {
  const t = zhCN.batchTranscode;
  const [paths, setPaths] = useState(() => uniquePaths(initialPaths));
  const [preset, setPreset] = useState<BatchTranscodePreset>('h264-720p');
  const [jobs, setJobs] = useState<BatchTranscodeJob[]>([]);
  const [busy, setBusy] = useState(false);
  const completedCount = jobs.filter((job) => job.status === 'completed').length;
  const failedCount = jobs.filter((job) => job.status === 'failed').length;
  const canceledCount = jobs.filter((job) => job.status === 'canceled').length;
  const hasStarted = jobs.length > 0;
  const visibleJobs: BatchTranscodeJob[] = hasStarted
    ? jobs
    : paths.map((sourcePath) => ({ taskId: sourcePath, sourcePath, status: 'pending', progress: 0 }));
  const canStart = !busy && paths.length > 0;
  const summary = useMemo(
    () =>
      hasStarted
        ? `${t.status.completed} ${completedCount} · ${t.status.failed} ${failedCount} · ${t.status.canceled} ${canceledCount}`
        : t.noFiles,
    [canceledCount, completedCount, failedCount, hasStarted, t],
  );

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void listenBatchTranscodeProgress((payload) => {
      if (!disposed) {
        applyProgress(payload);
      }
    }).then((dispose) => {
      if (disposed) {
        dispose();
      } else {
        unlisten = dispose;
      }
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  const chooseFiles = async () => {
    const picked = await pickVideoPaths();
    if (picked.length > 0) {
      setPaths((current) => uniquePaths([...current, ...picked]));
    }
  };

  const removePath = (path: string) => {
    if (busy) {
      return;
    }
    setPaths((current) => current.filter((item) => item !== path));
  };

  const startTranscode = async () => {
    if (paths.length === 0) {
      showToast({ kind: 'warning', title: t.title, message: t.selectFilesFirst });
      return;
    }
    const taskRequests = paths.map((sourcePath) => ({
      taskId: createId('transcode'),
      sourcePath,
    }));
    setJobs(taskRequests.map((task) => ({ ...task, status: 'pending', progress: 0 })));
    setBusy(true);
    try {
      const response = await batchTranscodeMedia({ tasks: taskRequests, preset });
      setJobs((current) =>
        current.map((job) => {
          const result = response.results.find((item) => item.taskId === job.taskId);
          return result
            ? {
                ...job,
                outputPath: result.outputPath ?? job.outputPath,
                status: result.status,
                progress: result.status === 'completed' ? 1 : job.progress,
                error: result.error,
              }
            : job;
        }),
      );
      const outputPaths = response.results
        .filter((result) => result.status === 'completed' && result.outputPath)
        .map((result) => result.outputPath as string);
      if (outputPaths.length === 0) {
        showToast({ kind: 'warning', title: t.failedToast, message: t.failedMessage });
        return;
      }
      const imported = await probeMediaPaths(outputPaths, existingMedia);
      if (imported.media.length > 0) {
        onImport(imported.media);
        showToast({
          kind: 'success',
          title: t.completedToast,
          message: t.completedToastMessage(imported.media.length),
        });
      } else {
        showToast({ kind: 'warning', title: t.completedToast, message: t.failedMessage });
      }
    } catch (error) {
      showToast({
        kind: 'error',
        title: t.failedToast,
        message: error instanceof Error ? error.message : t.failedMessage,
      });
    } finally {
      setBusy(false);
    }
  };

  const cancelTask = async (taskId: string) => {
    setJobs((current) =>
      current.map((job) => (job.taskId === taskId ? { ...job, status: 'canceled', progress: 0 } : job)),
    );
    try {
      await cancelBatchTranscodeTask(taskId);
    } catch (error) {
      showToast({
        kind: 'error',
        title: t.failedToast,
        message: error instanceof Error ? error.message : t.failedMessage,
      });
    }
  };

  function applyProgress(payload: BatchTranscodeProgressEvent) {
    setJobs((current) =>
      current.map((job) =>
        job.taskId === payload.taskId
          ? {
              ...job,
              sourcePath: payload.sourcePath,
              outputPath: payload.outputPath ?? job.outputPath,
              status: payload.status,
              progress: payload.progress,
            }
          : job,
      ),
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
      data-testid="batch-transcode-dialog"
    >
      <div className="flex max-h-[86vh] w-full max-w-3xl flex-col overflow-hidden rounded-md border border-line bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="min-w-0">
            <div className="text-base font-semibold text-ink">{t.title}</div>
            <div className="mt-0.5 truncate text-xs text-slate-500" data-testid="batch-transcode-summary">
              {summary}
            </div>
          </div>
          <button
            className="rounded-md p-2 text-slate-500 hover:bg-panel disabled:opacity-50"
            type="button"
            aria-label={zhCN.common.close}
            disabled={busy}
            onClick={onClose}
            data-testid="batch-transcode-close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-[240px_minmax(0,1fr)] gap-px bg-line">
          <div className="bg-panel p-4">
            <label className="block text-xs font-semibold uppercase text-slate-500">{t.format}</label>
            <div className="mt-2 space-y-2" data-testid="batch-transcode-preset-list">
              {PRESETS.map((item) => (
                <button
                  key={item}
                  className={`w-full rounded-md border px-3 py-2 text-left text-sm ${preset === item ? 'border-brand bg-white text-brand shadow-sm' : 'border-line bg-white text-slate-700 hover:bg-white/80'}`}
                  type="button"
                  disabled={busy}
                  data-testid={`batch-transcode-preset-${item}`}
                  onClick={() => setPreset(item)}
                >
                  <span className="block font-semibold">{t.presets[item]}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">{t.presetDescription[item]}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex min-h-0 flex-col bg-white">
            <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
              <div className="text-sm font-semibold text-ink">{t.sourceFiles}</div>
              <button
                className="inline-flex items-center gap-2 rounded-md border border-line bg-panel px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-white disabled:opacity-50"
                type="button"
                disabled={busy}
                data-testid="batch-transcode-add-files"
                onClick={() => void chooseFiles()}
              >
                <FolderOpen size={15} />
                {paths.length > 0 ? t.addFiles : t.chooseFiles}
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {paths.length === 0 ? (
                <button
                  className="flex min-h-[220px] w-full flex-col items-center justify-center rounded-md border border-dashed border-slate-300 bg-panel p-6 text-center text-sm text-slate-600"
                  type="button"
                  data-testid="batch-transcode-empty"
                  onClick={() => void chooseFiles()}
                >
                  <FileVideo2 className="mb-3 text-slate-500" size={30} />
                  {t.noFiles}
                </button>
              ) : (
                <div className="space-y-2" data-testid="batch-transcode-file-list">
                  {visibleJobs.map((job) => (
                    <div
                      key={job.taskId}
                      className="rounded-md border border-line bg-white p-3"
                      data-testid={`batch-transcode-task-${fileNameFromPath(job.sourcePath)}`}
                      data-status={job.status}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-ink" title={job.sourcePath}>
                            {fileNameFromPath(job.sourcePath)}
                          </div>
                          <div className="truncate text-xs text-slate-500">{job.outputPath ?? job.sourcePath}</div>
                        </div>
                        {hasStarted ? (
                          <span
                            className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusTone(job.status)}`}
                          >
                            {job.status === 'running' ? <Loader2 className="animate-spin" size={12} /> : null}
                            {t.status[job.status]}
                          </span>
                        ) : (
                          <button
                            className="rounded-md border border-line bg-panel p-1.5 text-slate-600 hover:bg-white"
                            type="button"
                            title={t.removeFile}
                            aria-label={t.removeFile}
                            data-testid="batch-transcode-remove-file"
                            onClick={() => removePath(job.sourcePath)}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      {hasStarted ? (
                        <div className="mt-3 flex items-center gap-2">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                            <div
                              className="h-full bg-brand transition-all"
                              style={{ width: `${Math.round(job.progress * 100)}%` }}
                            />
                          </div>
                          <div className="w-10 text-right text-xs tabular-nums text-slate-600">
                            {Math.round(job.progress * 100)}%
                          </div>
                          {(job.status === 'pending' || job.status === 'running') && busy ? (
                            <button
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line bg-white text-slate-600 hover:bg-panel"
                              type="button"
                              title={t.cancelTask}
                              aria-label={t.cancelTask}
                              data-testid={`batch-transcode-cancel-${job.taskId}`}
                              onClick={() => void cancelTask(job.taskId)}
                            >
                              <XCircle size={14} />
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                      {job.error ? <div className="mt-2 text-xs text-rose-600">{job.error}</div> : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-line px-4 py-3">
          <button
            className="rounded-md border border-line bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-panel disabled:opacity-50"
            type="button"
            disabled={busy}
            onClick={onClose}
          >
            {t.closeWhenDone}
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-[#176858] disabled:opacity-50"
            type="button"
            disabled={!canStart}
            data-testid="batch-transcode-start"
            onClick={() => void startTranscode()}
          >
            {busy ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />}
            {t.start}
          </button>
        </div>
      </div>
    </div>
  );
}

function uniquePaths(paths: string[]): string[] {
  return Array.from(new Set(paths.filter(Boolean)));
}

function statusTone(status: BatchTranscodeStatus): string {
  if (status === 'completed') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  if (status === 'failed') {
    return 'border-rose-200 bg-rose-50 text-rose-700';
  }
  if (status === 'canceled') {
    return 'border-slate-200 bg-slate-50 text-slate-600';
  }
  if (status === 'running') {
    return 'border-sky-200 bg-sky-50 text-sky-700';
  }
  return 'border-slate-200 bg-white text-slate-600';
}

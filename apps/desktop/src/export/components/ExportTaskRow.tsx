import { FileText, Copy } from 'lucide-react';
import type { ExportTaskStatus } from '@open-factory/editor-core';
import { convertLocalFileSrc, openPath } from '../../lib/tauri-bridge';
import { formatLoudness, priorityLabel } from '../lib/exportFormatHelpers';
import { formatDuration } from '../lib/pipelineHelpers';
import { cancelQueuedExportTask, pauseQueuedExportTask, retryQueuedExportTask } from '../export-queue-runner';
import { useExportQueueStore } from '../export-queue-store';
import { matchExportDiagnostics } from '../export-diagnostics';
import { useSafeTimeout } from '../../hooks/useSafeTimeout';
import { zhCN } from '../../i18n/strings';
import { useState } from 'react';
import { revealExport } from '../../lib/exportVideo';

export function ExportTaskRow({ taskId }: { taskId: string }) {
  const task = useExportQueueStore((state) => state.tasks.find((item) => item.id === taskId));
  if (!task) {
    return null;
  }
  const progress = Math.round(task.progress * 100);
  const canCancel = task.status === 'scheduled' || task.status === 'pending' || task.status === 'running';
  const progressivePreviewSrc = task.progressive ? convertLocalFileSrc(task.progressive.partialPath) : undefined;
  return (
    <div className="border-b border-line px-3 py-2 last:border-b-0" data-testid={`export-task-${task.id}`}>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium text-slate-800" title={task.outputPath}>
            {task.name}
          </div>
          <div className="truncate text-[11px] text-slate-500">{task.outputPath}</div>
        </div>
        <span className="shrink-0 text-[11px] text-slate-500" data-testid="export-task-priority">
          {priorityLabel(task.priority)}
        </span>
        <StatusPill status={task.status} />
        {task.logPath ? (
          <button className="rounded-md border border-line px-2 py-1 text-xs font-medium hover:bg-panel" data-testid="export-task-log-button" onClick={() => void openPath(task.logPath!)}>
            <FileText size={13} className="inline-block" /> {zhCN.exportDialog.viewLog}
          </button>
        ) : null}
        {task.progressive && task.status === 'running' ? (
          <button
            className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
            data-testid="export-task-progressive-pause-button"
            onClick={() => void pauseQueuedExportTask(task.id)}
          >
            {zhCN.exportDialog.progressive.pause}
          </button>
        ) : null}
        {canCancel ? (
          <button
            className="rounded-md border border-rose-300 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-800 hover:bg-rose-100"
            data-testid="export-task-cancel-button"
            onClick={() => void cancelQueuedExportTask(task.id)}
          >
            {zhCN.exportDialog.cancelTask}
          </button>
        ) : task.status === 'success' ? (
          <button className="rounded-md border border-line px-2 py-1 text-xs font-medium hover:bg-panel" onClick={() => void revealExport(task.outputPath)}>
            {zhCN.exportDialog.openFolder}
          </button>
        ) : task.status === 'error' || task.status === 'canceled' || task.status === 'interrupted' ? (
          <button className="rounded-md border border-line px-2 py-1 text-xs font-medium hover:bg-panel" data-testid="export-task-retry-button" onClick={() => retryQueuedExportTask(task.id)}>
            {zhCN.exportDialog.retryTask}
          </button>
        ) : null}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full bg-brand transition-all" style={{ width: `${progress}%` }} />
        </div>
        <div className="w-9 text-right text-[11px] tabular-nums text-slate-500">{progress}%</div>
      </div>
      {task.progressive ? (
        <div className="mt-2 grid gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-2 text-[11px] text-emerald-900" data-testid="export-progressive-state">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="font-semibold">{zhCN.exportDialog.progressive.partialPath}</div>
              <div className="truncate font-mono" title={task.progressive.partialPath} data-testid="export-progressive-partial-path">
                {task.progressive.partialPath}
              </div>
            </div>
            <div className="tabular-nums" data-testid="export-progressive-completed">
              {zhCN.exportDialog.progressive.completed(formatDuration(task.progressive.completedDuration))}
            </div>
          </div>
          {progressivePreviewSrc ? (
            <div className="grid gap-2 sm:grid-cols-[160px_auto] sm:items-center">
              <video className="h-20 w-40 rounded border border-emerald-200 bg-black object-contain" src={progressivePreviewSrc} controls preload="metadata" data-testid="export-progressive-preview" />
              <button className="justify-self-start rounded-md border border-emerald-300 bg-white px-2 py-1 font-medium hover:bg-emerald-100" type="button" data-testid="export-progressive-open-partial" onClick={() => void openPath(task.progressive!.partialPath)}>
                {zhCN.exportDialog.progressive.preview}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      {task.segments?.length ? (
        <div className="mt-2 grid gap-1" data-testid="export-task-segments">
          {task.segments.map((segment) => {
            const segmentProgress = Math.round(segment.progress * 100);
            return (
              <div key={segment.id} className="grid grid-cols-[72px_1fr_42px] items-center gap-2 text-[11px] text-slate-500" data-testid="export-task-segment-row" data-status={segment.status}>
                <span>{zhCN.exportDialog.renderFarm.segmentLabel(segment.index + 1)}</span>
                <div className="h-1 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full bg-sky-500 transition-all" style={{ width: `${segmentProgress}%` }} />
                </div>
                <span className="text-right tabular-nums">{segmentProgress}%</span>
              </div>
            );
          })}
        </div>
      ) : null}
      {task.error ? <ExportDiagnosticsPanel error={task.error} /> : null}
      {task.report?.loudness ? (
        <div className="mt-1 text-[11px] text-slate-600" data-testid="export-task-loudness-report">
          {zhCN.exportDialog.loudnessReport(formatLoudness(task.report.loudness.integratedLoudness))}
        </div>
      ) : null}
    </div>
  );
}

export function StatusPill({ status }: { status: ExportTaskStatus }) {
  const className =
    status === 'success'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : status === 'running'
        ? 'bg-sky-50 text-sky-700 border-sky-200'
        : status === 'error'
          ? 'bg-rose-50 text-rose-700 border-rose-200'
          : status === 'canceled'
            ? 'bg-slate-100 text-slate-600 border-slate-200'
            : status === 'interrupted'
              ? 'bg-orange-50 text-orange-700 border-orange-200'
              : 'bg-amber-50 text-amber-700 border-amber-200';
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${className}`} data-testid="export-task-status" data-status={status}>
      {zhCN.exportDialog.status[status]}
    </span>
  );
}

export function ExportDiagnosticsPanel({ error }: { error: string }) {
  const [copied, setCopied] = useState(false);
  const matches = matchExportDiagnostics(error);
  const safeTimeout = useSafeTimeout();
  const handleCopy = () => {
    void navigator.clipboard.writeText(error).then(() => {
      setCopied(true);
      safeTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="mt-1 rounded-md border border-rose-200 bg-rose-50 p-2 text-[11px]" data-testid="export-diagnostics-panel">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 whitespace-pre-wrap text-rose-700">{error}</div>
        <button
          className="shrink-0 inline-flex items-center gap-1 rounded border border-rose-300 bg-white px-1.5 py-0.5 font-medium text-rose-700 hover:bg-rose-100"
          type="button"
          onClick={handleCopy}
          data-testid="export-diagnostics-copy"
        >
          <Copy size={11} />
          {copied ? '\u5df2\u590d\u5236' : '\u590d\u5236'}
        </button>
      </div>
      {matches.length > 0 ? (
        <div className="mt-2 space-y-1" data-testid="export-diagnostics-suggestions">
          {matches.map((match) => (
            <div key={match.label} className="rounded border border-amber-200 bg-amber-50 p-1.5">
              <div className="font-semibold text-amber-800">{match.label}</div>
              <div className="mt-0.5 text-amber-700">{match.suggestion}</div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

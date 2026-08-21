import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, GripVertical, RotateCcw, XCircle } from 'lucide-react';
import { zhCN } from '../i18n/strings';
import { getSystemResourceSnapshot, type SystemResourceSnapshot } from '../lib/tauri-bridge';
import { ensureMediaJobRunner } from '../media/media-job-runner';
import { calculateMediaJobEtaSeconds, sortMediaJobsForMonitor } from '../media/media-job-monitor';
import { useMediaJobStore, type MediaJobPriority, type MediaJobStatus, type MediaJobType } from '../media/media-job-store';
import { useMediaJobSettingsStore, type BackgroundConcurrency } from '../store/mediaJobSettingsStore';
import { formatBytes } from './formatHelpers';

const PRIORITY_STEPS: MediaJobPriority[] = ['high', 'normal', 'low'];

export function TaskMonitorSettingsPanel() {
  const t = zhCN.settings.taskMonitor;
  const jobs = useMediaJobStore((state) => state.jobs);
  const cancelJob = useMediaJobStore((state) => state.cancelJob);
  const cancelAllJobs = useMediaJobStore((state) => state.cancelAllJobs);
  const retryJob = useMediaJobStore((state) => state.retryJob);
  const retryFailedJobs = useMediaJobStore((state) => state.retryFailedJobs);
  const clearFinishedJobs = useMediaJobStore((state) => state.clearFinishedJobs);
  const moveJobBefore = useMediaJobStore((state) => state.moveJobBefore);
  const setJobPriority = useMediaJobStore((state) => state.setJobPriority);
  const backgroundConcurrency = useMediaJobSettingsStore((state) => state.backgroundConcurrency);
  const setBackgroundConcurrency = useMediaJobSettingsStore((state) => state.setBackgroundConcurrency);
  const paused = useMediaJobSettingsStore((state) => state.paused);
  const setPaused = useMediaJobSettingsStore((state) => state.setPaused);
  const [draggedJobId, setDraggedJobId] = useState<string>();
  const [resourceSnapshot, setResourceSnapshot] = useState<SystemResourceSnapshot>();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const orderedJobs = useMemo(() => sortMediaJobsForMonitor(jobs), [jobs]);
  const activeCount = jobs.filter((job) => job.status === 'pending' || job.status === 'running').length;
  const failedCount = jobs.filter((job) => job.status === 'error').length;

  useEffect(() => {
    let canceled = false;
    const refresh = async () => {
      setNowMs(Date.now());
      try {
        const snapshot = await getSystemResourceSnapshot();
        if (!canceled) {
          setResourceSnapshot(snapshot);
        }
      } catch {
        if (!canceled) {
          setResourceSnapshot(undefined);
        }
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 2000);
    return () => {
      canceled = true;
      window.clearInterval(timer);
    };
  }, []);

  function retry(jobId: string): void {
    retryJob(jobId);
    void ensureMediaJobRunner();
  }

  function retryAllFailed(): void {
    retryFailedJobs();
    void ensureMediaJobRunner();
  }

  function togglePaused(): void {
    const next = !paused;
    setPaused(next);
    if (!next) {
      void ensureMediaJobRunner();
    }
  }

  function stepPriority(jobId: string, direction: -1 | 1): void {
    const job = jobs.find((item) => item.id === jobId);
    if (!job || job.status !== 'pending') {
      return;
    }
    const index = PRIORITY_STEPS.indexOf(job.priority);
    const nextIndex = Math.min(PRIORITY_STEPS.length - 1, Math.max(0, index + direction));
    setJobPriority(jobId, PRIORITY_STEPS[nextIndex]);
  }

  return (
    <div className="space-y-4" data-testid="task-monitor-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">{t.title}</h3>
          <p className="text-xs text-slate-500">{t.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            {t.backgroundConcurrency}
            <select
              className="rounded-md border border-line bg-white px-2 py-1.5 text-xs text-slate-700"
              value={String(backgroundConcurrency)}
              data-testid="task-monitor-background-concurrency"
              onChange={(event) => setBackgroundConcurrency(parseBackgroundConcurrency(event.target.value))}
            >
              <option value="auto">{t.backgroundConcurrencyAuto}</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
            </select>
          </label>
          <button
            className="rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel"
            type="button"
            data-testid="task-monitor-toggle-pause"
            onClick={togglePaused}
          >
            {paused ? t.resume : t.pause}
          </button>
          <button
            className="rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel"
            type="button"
            data-testid="task-monitor-cancel-all"
            disabled={activeCount === 0}
            onClick={cancelAllJobs}
          >
            {t.cancelAll}
          </button>
          <button
            className="rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel"
            type="button"
            data-testid="task-monitor-retry-failed"
            disabled={failedCount === 0}
            onClick={retryAllFailed}
          >
            {t.retryFailed}
          </button>
          <button
            className="rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel"
            type="button"
            data-testid="task-monitor-clear-finished"
            onClick={clearFinishedJobs}
          >
            {t.clearFinished}
          </button>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-3" data-testid="task-monitor-resource-summary">
        <ResourceMetric
          label={t.cpuUsage}
          value={resourceSnapshot ? `${Math.round(resourceSnapshot.cpuUsage)}%` : zhCN.common.unavailable}
        />
        <ResourceMetric
          label={t.memoryUsage}
          value={
            resourceSnapshot
              ? `${formatBytes(resourceSnapshot.usedMemoryBytes)} / ${formatBytes(resourceSnapshot.totalMemoryBytes)}`
              : zhCN.common.unavailable
          }
        />
        <ResourceMetric label={t.runningCount} value={String(activeCount)} />
      </div>
      {orderedJobs.length === 0 ? (
        <div
          className="rounded-md border border-line bg-panel p-3 text-sm text-slate-600"
          data-testid="task-monitor-empty"
        >
          {t.empty}
        </div>
      ) : null}
      <div className="overflow-hidden rounded-md border border-line bg-white">
        {orderedJobs.map((job) => {
          const etaSeconds = calculateMediaJobEtaSeconds(job, nowMs);
          return (
            <div
              key={job.id}
              className="grid grid-cols-[auto_minmax(0,1.4fr)_minmax(0,1fr)_96px_96px_auto] items-center gap-3 border-b border-line px-3 py-2 last:border-b-0"
              draggable={job.status === 'pending'}
              data-testid={`task-monitor-row-${job.id}`}
              data-task-status={job.status}
              onDragStart={(event) => {
                setDraggedJobId(job.id);
                event.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(event) => {
                if (draggedJobId && draggedJobId !== job.id) {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (draggedJobId && draggedJobId !== job.id) {
                  moveJobBefore(draggedJobId, job.id);
                }
                setDraggedJobId(undefined);
              }}
              onDragEnd={() => setDraggedJobId(undefined)}
            >
              <GripVertical size={15} className={job.status === 'pending' ? 'text-slate-400' : 'text-slate-200'} />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-ink" data-testid={`task-monitor-file-${job.id}`}>
                  {job.assetName}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>{taskTypeLabel(job.type)}</span>
                  {job.status === 'pending' ? (
                    <span
                      className={'inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-medium ' + priorityTone(job.priority)}
                      data-testid={'task-monitor-priority-' + job.id}
                      data-priority={job.priority}
                    >
                      {priorityLabel(job.priority)}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="min-w-0">
                <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full bg-brand transition-all"
                    style={{ width: `${Math.round(job.progress * 100)}%` }}
                  />
                </div>
                <div
                  className="mt-1 text-[11px] tabular-nums text-slate-500"
                  data-testid={`task-monitor-progress-${job.id}`}
                >
                  {Math.round(job.progress * 100)}%
                </div>
              </div>
              <span
                className={`inline-flex justify-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${taskStatusTone(job.status)}`}
                data-testid={`task-monitor-status-${job.id}`}
              >
                {taskStatusLabel(job.status)}
              </span>
              <span
                className="text-right text-xs tabular-nums text-slate-500"
                data-testid={`task-monitor-eta-${job.id}`}
              >
                {etaSeconds === undefined ? t.etaUnknown : t.etaSeconds(Math.ceil(etaSeconds))}
              </span>
              <div className="flex justify-end gap-1">
                {job.status === 'pending' ? (
                  <>
                    <button
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line text-slate-600 hover:bg-panel"
                      type="button"
                      title={t.raisePriority}
                      aria-label={t.raisePriority}
                      data-testid={'task-monitor-raise-' + job.id}
                      disabled={PRIORITY_STEPS.indexOf(job.priority) === 0}
                      onClick={() => stepPriority(job.id, -1)}
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line text-slate-600 hover:bg-panel"
                      type="button"
                      title={t.lowerPriority}
                      aria-label={t.lowerPriority}
                      data-testid={'task-monitor-lower-' + job.id}
                      disabled={PRIORITY_STEPS.indexOf(job.priority) === PRIORITY_STEPS.length - 1}
                      onClick={() => stepPriority(job.id, 1)}
                    >
                      <ArrowDown size={14} />
                    </button>
                  </>
                ) : null}
                {job.status === 'pending' || job.status === 'running' ? (
                  <button
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line text-slate-600 hover:bg-panel"
                    type="button"
                    title={t.cancel}
                    aria-label={t.cancel}
                    data-testid={`task-monitor-cancel-${job.id}`}
                    onClick={() => cancelJob(job.id)}
                  >
                    <XCircle size={14} />
                  </button>
                ) : null}
                {job.status === 'error' || job.status === 'canceled' ? (
                  <button
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line text-slate-600 hover:bg-panel"
                    type="button"
                    title={t.retry}
                    aria-label={t.retry}
                    data-testid={`task-monitor-retry-${job.id}`}
                    onClick={() => retry(job.id)}
                  >
                    <RotateCcw size={14} />
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ResourceMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-panel p-3">
      <div className="text-[11px] font-semibold text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-ink">{value}</div>
    </div>
  );
}

function taskTypeLabel(type: MediaJobType): string {
  return zhCN.settings.taskMonitor.types[type];
}

function taskStatusLabel(status: MediaJobStatus): string {
  return zhCN.settings.taskMonitor.statuses[status];
}

function parseBackgroundConcurrency(value: string): BackgroundConcurrency {
  return value === 'auto' ? 'auto' : (Number(value) as BackgroundConcurrency);
}

function priorityLabel(priority: MediaJobPriority): string {
  if (priority === 'high') {
    return zhCN.settings.taskMonitor.priorityHigh;
  }
  if (priority === 'normal') {
    return zhCN.settings.taskMonitor.priorityNormal;
  }
  return zhCN.settings.taskMonitor.priorityLow;
}

function priorityTone(priority: MediaJobPriority): string {
  if (priority === 'high') {
    return 'border-rose-200 bg-rose-50 text-rose-700';
  }
  if (priority === 'normal') {
    return 'border-slate-200 bg-slate-50 text-slate-600';
  }
  return 'border-emerald-200 bg-emerald-50 text-emerald-700';
}

function taskStatusTone(status: MediaJobStatus): string {
  if (status === 'running') {
    return 'border-blue-200 bg-blue-50 text-blue-700';
  }
  if (status === 'pending') {
    return 'border-slate-200 bg-slate-50 text-slate-600';
  }
  if (status === 'success') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  if (status === 'canceled') {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }
  return 'border-rose-200 bg-rose-50 text-rose-700';
}

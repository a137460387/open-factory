import type { MediaJob, MediaJobStatus } from './media-job-store';

const STATUS_ORDER: Record<MediaJobStatus, number> = {
  running: 0,
  pending: 1,
  error: 2,
  canceled: 3,
  success: 4,
};

const PRIORITY_ORDER = {
  high: 0,
  low: 1,
} as const;

export function sortMediaJobsForMonitor(jobs: MediaJob[]): MediaJob[] {
  return [...jobs].sort(compareMediaJobPriority);
}

export function compareMediaJobPriority(left: MediaJob, right: MediaJob): number {
  return (
    STATUS_ORDER[left.status] - STATUS_ORDER[right.status] ||
    PRIORITY_ORDER[left.priority ?? 'low'] - PRIORITY_ORDER[right.priority ?? 'low'] ||
    timestamp(left.createdAt) - timestamp(right.createdAt) ||
    left.id.localeCompare(right.id)
  );
}

export function moveMediaJobBefore(jobs: MediaJob[], jobId: string, targetJobId: string): MediaJob[] {
  if (jobId === targetJobId) {
    return [...jobs];
  }
  const from = jobs.findIndex((job) => job.id === jobId);
  const to = jobs.findIndex((job) => job.id === targetJobId);
  if (from === -1 || to === -1) {
    return [...jobs];
  }
  const next = [...jobs];
  const [item] = next.splice(from, 1);
  const adjustedTo = from < to ? to - 1 : to;
  next.splice(adjustedTo, 0, item);
  return next;
}

export function calculateMediaJobEtaSeconds(
  job: Pick<MediaJob, 'status' | 'progress' | 'startedAt'>,
  nowMs = Date.now(),
): number | undefined {
  if (
    job.status !== 'running' ||
    !job.startedAt ||
    typeof job.progress !== 'number' ||
    job.progress <= 0 ||
    job.progress >= 1
  ) {
    return undefined;
  }
  const elapsedSeconds = Math.max(0, (nowMs - timestamp(job.startedAt)) / 1000);
  if (elapsedSeconds <= 0) {
    return undefined;
  }
  const unitsPerSecond = job.progress / elapsedSeconds;
  if (unitsPerSecond <= 0) {
    return undefined;
  }
  return Math.max(0, (1 - job.progress) / unitsPerSecond);
}

export function shouldIgnoreMediaJobCompletion(status: MediaJobStatus): boolean {
  return status === 'canceled';
}

export function normalizeMediaJobProgress(progress: number | undefined): number {
  return Math.min(1, Math.max(0, typeof progress === 'number' && Number.isFinite(progress) ? progress : 0));
}

function timestamp(value: string | undefined): number {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

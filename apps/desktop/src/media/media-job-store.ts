import type { MediaAsset, ProxySettings } from '@open-factory/editor-core';
import { shouldGenerateProxy } from '@open-factory/editor-core';
import { create } from 'zustand';
import { compareMediaJobPriority, moveMediaJobBefore as reorderMediaJobs, normalizeMediaJobProgress } from './media-job-monitor';

export type MediaJobType = 'proxy' | 'waveform' | 'gif-preview' | 'vfr-conversion' | 'frame-rate-conversion' | 'stabilization-analysis';
export type MediaJobStatus = 'pending' | 'running' | 'success' | 'error' | 'canceled';
type MediaJobPriority = 'high' | 'low';

export interface MediaJob {
  id: string;
  key: string;
  assetId: string;
  assetName: string;
  type: MediaJobType;
  status: MediaJobStatus;
  progress: number;
  priority: MediaJobPriority;
  force?: boolean;
  cfrFrameRate?: number;
  sourceStart?: number;
  sourceDuration?: number;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
  canceledAt?: string;
  error?: string;
}

export interface MediaJobOptions {
  force?: boolean;
  cfrFrameRate?: number;
  priority?: MediaJobPriority;
  sourceStart?: number;
  sourceDuration?: number;
}

interface MediaJobInput {
  id?: string;
  key?: string;
  assetId: string;
  assetName: string;
  type: MediaJobType;
  status?: MediaJobStatus;
  progress?: number;
  priority?: MediaJobPriority;
  error?: string;
}

export interface MediaJobState {
  jobs: MediaJob[];
  runnerActive: boolean;
  enqueueJobsForMedia: (media: MediaAsset[], proxySettings?: ProxySettings) => void;
  enqueueProxyJobsForMedia: (media: MediaAsset[], proxySettings?: ProxySettings, options?: MediaJobOptions) => void;
  enqueueMonitorJob: (job: MediaJobInput) => string;
  startNextJob: () => MediaJob | undefined;
  updateJobProgress: (jobId: string, progress: number) => void;
  finishJob: (jobId: string) => void;
  failJob: (jobId: string, error: string) => void;
  cancelJob: (jobId: string) => void;
  cancelAllJobs: () => void;
  retryJob: (jobId: string) => void;
  retryFailedJobs: () => void;
  moveJobBefore: (jobId: string, targetJobId: string) => void;
  setRunnerActive: (runnerActive: boolean) => void;
  clearFinishedJobs: () => void;
}

export const useMediaJobStore = create<MediaJobState>((set, get) => ({
  jobs: [],
  runnerActive: false,
  enqueueJobsForMedia: (media, proxySettings) => {
    const existingKeys = new Set(get().jobs.map((job) => job.key));
    const jobsToAdd = media.flatMap((asset) => buildJobsForAsset(asset, proxySettings, { priority: 'low' })).filter((job) => !existingKeys.has(job.key));
    if (jobsToAdd.length === 0) {
      return;
    }
    set((state) => ({ jobs: sortQueueJobs([...state.jobs, ...jobsToAdd]) }));
  },
  enqueueProxyJobsForMedia: (media, proxySettings, options) => {
    const jobsToAdd = media
      .flatMap((asset) => buildJobsForAsset(asset, proxySettings, options).filter((job) => job.type === 'proxy'))
      .filter((job) => !get().jobs.some((existing) => existing.key === job.key && existing.priority === job.priority && existing.sourceStart === job.sourceStart && existing.sourceDuration === job.sourceDuration));
    if (jobsToAdd.length === 0) {
      return;
    }
    set((state) => ({ jobs: sortQueueJobs([...upgradeExistingProxyJobs(state.jobs, jobsToAdd), ...jobsToAdd.filter((job) => !state.jobs.some((existing) => existing.key === job.key))]) }));
  },
  enqueueMonitorJob: (input) => {
    const now = new Date().toISOString();
    const id = input.id ?? `${input.type}-${input.assetId}-${Math.random().toString(36).slice(2)}`;
    const job: MediaJob = {
      id,
      key: input.key ?? `${input.type}|${input.assetId}|${id}`,
      assetId: input.assetId,
      assetName: input.assetName,
      type: input.type,
      status: input.status ?? 'pending',
      progress: normalizeMediaJobProgress(input.progress),
      priority: input.priority ?? 'low',
      createdAt: now,
      updatedAt: now,
      startedAt: input.status === 'running' ? now : undefined,
      finishedAt: input.status === 'success' || input.status === 'error' || input.status === 'canceled' ? now : undefined,
      canceledAt: input.status === 'canceled' ? now : undefined,
      error: input.error
    };
    set((state) => ({ jobs: sortQueueJobs([...state.jobs.filter((item) => item.id !== id), job]) }));
    return id;
  },
  startNextJob: () => {
    const next = [...get().jobs].filter((job) => job.status === 'pending').sort(compareMediaJobPriority)[0];
    if (!next) {
      return undefined;
    }
    const startedAt = new Date().toISOString();
    set((state) => ({
      jobs: state.jobs.map((job) => (job.id === next.id ? { ...job, status: 'running', startedAt, updatedAt: startedAt, finishedAt: undefined, canceledAt: undefined, progress: Math.max(job.progress, 0.01) } : job))
    }));
    return { ...next, status: 'running', startedAt, updatedAt: startedAt, progress: Math.max(next.progress, 0.01) };
  },
  updateJobProgress: (jobId, progress) => {
    const updatedAt = new Date().toISOString();
    set((state) => ({
      jobs: state.jobs.map((job) => (job.id === jobId && job.status === 'running' ? { ...job, progress: normalizeMediaJobProgress(progress), updatedAt } : job))
    }));
  },
  finishJob: (jobId) => {
    const finishedAt = new Date().toISOString();
    set((state) => ({
      jobs: state.jobs.map((job) => (job.id === jobId && job.status !== 'canceled' ? { ...job, status: 'success', progress: 1, finishedAt, updatedAt: finishedAt, error: undefined } : job))
    }));
  },
  failJob: (jobId, error) => {
    const finishedAt = new Date().toISOString();
    set((state) => ({
      jobs: state.jobs.map((job) => (job.id === jobId && job.status !== 'canceled' ? { ...job, status: 'error', finishedAt, updatedAt: finishedAt, error } : job))
    }));
  },
  cancelJob: (jobId) => {
    const canceledAt = new Date().toISOString();
    set((state) => ({
      jobs: state.jobs.map((job) => (job.id === jobId && (job.status === 'pending' || job.status === 'running') ? { ...job, status: 'canceled', canceledAt, finishedAt: canceledAt, updatedAt: canceledAt } : job))
    }));
  },
  cancelAllJobs: () => {
    const canceledAt = new Date().toISOString();
    set((state) => ({
      jobs: state.jobs.map((job) => (job.status === 'pending' || job.status === 'running' ? { ...job, status: 'canceled', canceledAt, finishedAt: canceledAt, updatedAt: canceledAt } : job))
    }));
  },
  retryJob: (jobId) => {
    const updatedAt = new Date().toISOString();
    set((state) => ({
      jobs: state.jobs.map((job) =>
        job.id === jobId && (job.status === 'error' || job.status === 'canceled')
          ? { ...job, status: 'pending', progress: 0, startedAt: undefined, finishedAt: undefined, canceledAt: undefined, updatedAt, error: undefined }
          : job
      )
    }));
  },
  retryFailedJobs: () => {
    const updatedAt = new Date().toISOString();
    set((state) => ({
      jobs: state.jobs.map((job) => (job.status === 'error' ? { ...job, status: 'pending', progress: 0, startedAt: undefined, finishedAt: undefined, updatedAt, error: undefined } : job))
    }));
  },
  moveJobBefore: (jobId, targetJobId) => set((state) => ({ jobs: reorderMediaJobs(state.jobs, jobId, targetJobId) })),
  setRunnerActive: (runnerActive) => set({ runnerActive }),
  clearFinishedJobs: () => {
    set((state) => ({ jobs: state.jobs.filter((job) => job.status === 'pending' || job.status === 'running') }));
  }
}));

function buildJobsForAsset(asset: MediaAsset, proxySettings?: ProxySettings, options: MediaJobOptions = {}): MediaJob[] {
  if (asset.missing) {
    return [];
  }
  const jobs: MediaJob[] = [];
  const canQueueProxy = asset.type === 'video' && !(asset.proxyPath && asset.proxyStatus === 'ready');
  if (canQueueProxy && (options.force || shouldGenerateProxy(asset, proxySettings))) {
    jobs.push(createJob(asset, 'proxy', proxySettings, options));
  }
  if (asset.type === 'audio' || (asset.type === 'video' && asset.hasAudio)) {
    jobs.push(createJob(asset, 'waveform'));
  }
  return jobs;
}

function createJob(asset: MediaAsset, type: MediaJobType, proxySettings?: ProxySettings, options: MediaJobOptions = {}): MediaJob {
  const sourceStamp = `${asset.path}|${asset.size ?? 0}|${asset.mtimeMs ?? 0}`;
  const cfrStamp = type === 'proxy' && options.cfrFrameRate ? `|cfr=${options.cfrFrameRate}` : '';
  const segmentStamp = type === 'proxy' && (options.sourceStart !== undefined || options.sourceDuration !== undefined) ? `|seg=${options.sourceStart ?? 0}:${options.sourceDuration ?? 0}` : '';
  const settingsStamp = type === 'proxy' && proxySettings ? `|${proxySettings.maxWidth}x${proxySettings.maxHeight}|${proxySettings.triggerShortEdge}|${proxySettings.videoBitrate}${cfrStamp}${segmentStamp}` : '';
  return {
    id: `${type}-${asset.id}-${Math.random().toString(36).slice(2)}`,
    key: `${type}|${asset.id}|${sourceStamp}${settingsStamp}`,
    assetId: asset.id,
    assetName: asset.name,
    type,
    status: 'pending',
    progress: 0,
    priority: options.priority ?? 'low',
    force: options.force || undefined,
    cfrFrameRate: options.cfrFrameRate,
    sourceStart: options.sourceStart,
    sourceDuration: options.sourceDuration,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function upgradeExistingProxyJobs(jobs: MediaJob[], incoming: MediaJob[]): MediaJob[] {
  return jobs.map((job) => {
    const matching = incoming.find((candidate) => candidate.key === job.key && candidate.type === 'proxy');
    if (!matching) {
      return job;
    }
    return {
      ...job,
      priority: compareMediaJobPriority(matching, job) < 0 ? matching.priority : job.priority,
      force: job.force || matching.force,
      cfrFrameRate: matching.cfrFrameRate ?? job.cfrFrameRate,
      sourceStart: matching.sourceStart ?? job.sourceStart,
      sourceDuration: matching.sourceDuration ?? job.sourceDuration,
      updatedAt: new Date().toISOString()
    };
  });
}

function sortQueueJobs(jobs: MediaJob[]): MediaJob[] {
  const activeOrPending = jobs.filter((job) => job.status === 'running' || job.status === 'pending').sort(compareMediaJobPriority);
  const rest = jobs.filter((job) => job.status !== 'running' && job.status !== 'pending');
  return [...activeOrPending, ...rest];
}

import type { MediaAsset, ProxySettings } from '@open-factory/editor-core';
import { shouldGenerateProxy } from '@open-factory/editor-core';
import { create } from 'zustand';
import { moveMediaJobBefore as reorderMediaJobs, normalizeMediaJobProgress } from './media-job-monitor';

export type MediaJobType = 'proxy' | 'waveform' | 'gif-preview' | 'vfr-conversion' | 'frame-rate-conversion' | 'stabilization-analysis';
export type MediaJobStatus = 'pending' | 'running' | 'success' | 'error' | 'canceled';

export interface MediaJob {
  id: string;
  key: string;
  assetId: string;
  assetName: string;
  type: MediaJobType;
  status: MediaJobStatus;
  progress: number;
  force?: boolean;
  cfrFrameRate?: number;
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
}

export interface MediaJobInput {
  id?: string;
  key?: string;
  assetId: string;
  assetName: string;
  type: MediaJobType;
  status?: MediaJobStatus;
  progress?: number;
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
    const jobsToAdd = media.flatMap((asset) => buildJobsForAsset(asset, proxySettings)).filter((job) => !existingKeys.has(job.key));
    if (jobsToAdd.length === 0) {
      return;
    }
    set((state) => ({ jobs: [...state.jobs, ...jobsToAdd] }));
  },
  enqueueProxyJobsForMedia: (media, proxySettings, options) => {
    const existingKeys = new Set(get().jobs.map((job) => job.key));
    const jobsToAdd = media
      .flatMap((asset) => buildJobsForAsset(asset, proxySettings, options).filter((job) => job.type === 'proxy'))
      .filter((job) => !existingKeys.has(job.key));
    if (jobsToAdd.length === 0) {
      return;
    }
    set((state) => ({ jobs: [...state.jobs, ...jobsToAdd] }));
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
      createdAt: now,
      updatedAt: now,
      startedAt: input.status === 'running' ? now : undefined,
      finishedAt: input.status === 'success' || input.status === 'error' || input.status === 'canceled' ? now : undefined,
      canceledAt: input.status === 'canceled' ? now : undefined,
      error: input.error
    };
    set((state) => ({ jobs: [...state.jobs.filter((item) => item.id !== id), job] }));
    return id;
  },
  startNextJob: () => {
    const next = get().jobs.find((job) => job.status === 'pending');
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
    jobs.push(createJob(asset, 'proxy', proxySettings, options.force, options.cfrFrameRate));
  }
  if (asset.type === 'audio' || (asset.type === 'video' && asset.hasAudio)) {
    jobs.push(createJob(asset, 'waveform'));
  }
  return jobs;
}

function createJob(asset: MediaAsset, type: MediaJobType, proxySettings?: ProxySettings, force?: boolean, cfrFrameRate?: number): MediaJob {
  const sourceStamp = `${asset.path}|${asset.size ?? 0}|${asset.mtimeMs ?? 0}`;
  const cfrStamp = type === 'proxy' && cfrFrameRate ? `|cfr=${cfrFrameRate}` : '';
  const settingsStamp = type === 'proxy' && proxySettings ? `|${proxySettings.maxWidth}x${proxySettings.maxHeight}|${proxySettings.triggerShortEdge}|${proxySettings.videoBitrate}${cfrStamp}` : '';
  return {
    id: `${type}-${asset.id}-${Math.random().toString(36).slice(2)}`,
    key: `${type}|${asset.id}|${sourceStamp}${settingsStamp}`,
    assetId: asset.id,
    assetName: asset.name,
    type,
    status: 'pending',
    progress: 0,
    force: force || undefined,
    cfrFrameRate,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

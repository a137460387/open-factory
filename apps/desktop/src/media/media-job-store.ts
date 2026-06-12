import type { MediaAsset, ProxySettings } from '@open-factory/editor-core';
import { shouldGenerateProxy } from '@open-factory/editor-core';
import { create } from 'zustand';

export type MediaJobType = 'proxy' | 'waveform';
export type MediaJobStatus = 'pending' | 'running' | 'success' | 'error';

export interface MediaJob {
  id: string;
  key: string;
  assetId: string;
  assetName: string;
  type: MediaJobType;
  status: MediaJobStatus;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
}

export interface MediaJobState {
  jobs: MediaJob[];
  runnerActive: boolean;
  enqueueJobsForMedia: (media: MediaAsset[], proxySettings?: ProxySettings) => void;
  enqueueProxyJobsForMedia: (media: MediaAsset[], proxySettings?: ProxySettings) => void;
  startNextJob: () => MediaJob | undefined;
  finishJob: (jobId: string) => void;
  failJob: (jobId: string, error: string) => void;
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
  enqueueProxyJobsForMedia: (media, proxySettings) => {
    const existingKeys = new Set(get().jobs.map((job) => job.key));
    const jobsToAdd = media
      .flatMap((asset) => buildJobsForAsset(asset, proxySettings).filter((job) => job.type === 'proxy'))
      .filter((job) => !existingKeys.has(job.key));
    if (jobsToAdd.length === 0) {
      return;
    }
    set((state) => ({ jobs: [...state.jobs, ...jobsToAdd] }));
  },
  startNextJob: () => {
    const next = get().jobs.find((job) => job.status === 'pending');
    if (!next) {
      return undefined;
    }
    const startedAt = new Date().toISOString();
    set((state) => ({
      jobs: state.jobs.map((job) => (job.id === next.id ? { ...job, status: 'running', startedAt } : job))
    }));
    return { ...next, status: 'running', startedAt };
  },
  finishJob: (jobId) => {
    set((state) => ({
      jobs: state.jobs.map((job) => (job.id === jobId ? { ...job, status: 'success', finishedAt: new Date().toISOString(), error: undefined } : job))
    }));
  },
  failJob: (jobId, error) => {
    set((state) => ({
      jobs: state.jobs.map((job) => (job.id === jobId ? { ...job, status: 'error', finishedAt: new Date().toISOString(), error } : job))
    }));
  },
  setRunnerActive: (runnerActive) => set({ runnerActive }),
  clearFinishedJobs: () => {
    set((state) => ({ jobs: state.jobs.filter((job) => job.status === 'pending' || job.status === 'running') }));
  }
}));

function buildJobsForAsset(asset: MediaAsset, proxySettings?: ProxySettings): MediaJob[] {
  if (asset.missing) {
    return [];
  }
  const jobs: MediaJob[] = [];
  if (shouldGenerateProxy(asset, proxySettings)) {
    jobs.push(createJob(asset, 'proxy', proxySettings));
  }
  if (asset.type === 'audio' || (asset.type === 'video' && asset.hasAudio)) {
    jobs.push(createJob(asset, 'waveform'));
  }
  return jobs;
}

function createJob(asset: MediaAsset, type: MediaJobType, proxySettings?: ProxySettings): MediaJob {
  const sourceStamp = `${asset.path}|${asset.size ?? 0}|${asset.mtimeMs ?? 0}`;
  const settingsStamp = type === 'proxy' && proxySettings ? `|${proxySettings.maxWidth}x${proxySettings.maxHeight}|${proxySettings.triggerShortEdge}|${proxySettings.videoBitrate}` : '';
  return {
    id: `${type}-${asset.id}-${Math.random().toString(36).slice(2)}`,
    key: `${type}|${asset.id}|${sourceStamp}${settingsStamp}`,
    assetId: asset.id,
    assetName: asset.name,
    type,
    status: 'pending',
    createdAt: new Date().toISOString()
  };
}

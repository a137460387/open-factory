import type { MediaAsset } from '@open-factory/editor-core';
import { useEditorStore } from '../store/editorStore';
import { createProxyForAsset } from './proxy';
import { getWaveform } from './waveform';
import { useMediaJobStore, type MediaJob } from './media-job-store';

let runnerPromise: Promise<void> | undefined;

export function enqueueBackgroundMediaJobs(media: MediaAsset[]): void {
  useMediaJobStore.getState().enqueueJobsForMedia(media);
  ensureMediaJobRunner();
}

export function ensureMediaJobRunner(): Promise<void> {
  if (runnerPromise) {
    return runnerPromise;
  }
  useMediaJobStore.getState().setRunnerActive(true);
  runnerPromise = runJobs().finally(() => {
    runnerPromise = undefined;
    useMediaJobStore.getState().setRunnerActive(false);
  });
  return runnerPromise;
}

async function runJobs(): Promise<void> {
  while (true) {
    const job = useMediaJobStore.getState().startNextJob();
    if (!job) {
      return;
    }
    try {
      await runJob(job);
      useMediaJobStore.getState().finishJob(job.id);
    } catch (error) {
      useMediaJobStore.getState().failJob(job.id, error instanceof Error ? error.message : 'Media job failed.');
      if (job.type === 'proxy') {
        updateMediaAsset(job.assetId, (asset) => ({
          ...asset,
          proxyStatus: 'error',
          proxyError: error instanceof Error ? error.message : 'Proxy generation failed.'
        }));
      }
    }
  }
}

async function runJob(job: MediaJob): Promise<void> {
  const asset = useEditorStore.getState().project.media.find((item) => item.id === job.assetId);
  if (!asset || asset.missing) {
    return;
  }
  if (job.type === 'proxy') {
    updateMediaAsset(job.assetId, (item) => ({ ...item, proxyStatus: 'pending', proxyError: undefined }));
    const proxyAsset = await createProxyForAsset({ ...asset, proxyStatus: 'pending', proxyError: undefined });
    updateMediaAsset(job.assetId, () => proxyAsset);
    return;
  }
  await getWaveform(asset);
}

function updateMediaAsset(assetId: string, mapAsset: (asset: MediaAsset) => MediaAsset): void {
  const state = useEditorStore.getState();
  state.setMedia(state.project.media.map((asset) => (asset.id === assetId ? mapAsset(asset) : asset)));
}

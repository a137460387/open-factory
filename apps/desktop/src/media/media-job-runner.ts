import type { MediaAsset, ProxySettings } from '@open-factory/editor-core';
import { zhCN } from '../i18n/strings';
import { useEditorStore } from '../store/editorStore';
import { useProxySettingsStore } from '../store/proxySettingsStore';
import { createProxyForAsset } from './proxy';
import { getWaveform } from './waveform';
import { useMediaJobStore, type MediaJob } from './media-job-store';
import { shouldIgnoreMediaJobCompletion } from './media-job-monitor';
import { backgroundMediaPool } from './media-concurrency';

let runnerPromise: Promise<void> | undefined;

export function enqueueBackgroundMediaJobs(media: MediaAsset[], proxySettings?: ProxySettings): void {
  useMediaJobStore.getState().enqueueJobsForMedia(media, proxySettings);
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
  const running = new Set<Promise<void>>();
  while (true) {
    // 共享全局后台池:proxy / 导入 waveform 等批量任务共用槽位,
    // 避免一次导入大量素材时瞬间撑满系统资源(审计 H2)。
    while (running.size < backgroundMediaPool.limit) {
      const job = useMediaJobStore.getState().startNextJob();
      if (!job) {
        break;
      }
      let promise: Promise<void>;
      promise = runJobWithStatus(job).finally(() => {
        running.delete(promise);
      });
      running.add(promise);
    }
    if (running.size === 0) {
      return;
    }
    await Promise.race(running);
  }
}

async function runJobWithStatus(job: MediaJob): Promise<void> {
  try {
    await runJob(job);
    if (
      shouldIgnoreMediaJobCompletion(
        useMediaJobStore.getState().jobs.find((item) => item.id === job.id)?.status ?? job.status,
      )
    ) {
      return;
    }
    useMediaJobStore.getState().finishJob(job.id);
  } catch (error) {
    if (
      shouldIgnoreMediaJobCompletion(
        useMediaJobStore.getState().jobs.find((item) => item.id === job.id)?.status ?? job.status,
      )
    ) {
      return;
    }
    useMediaJobStore.getState().failJob(job.id, error instanceof Error ? error.message : zhCN.errors.mediaJobFailed);
    if (job.type === 'proxy') {
      updateMediaAsset(job.assetId, (asset) => ({
        ...asset,
        proxyStatus: 'error',
        proxyError: error instanceof Error ? error.message : zhCN.errors.proxyGenerationFailed,
      }));
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
    const proxyAsset = await createProxyForAsset(
      { ...asset, proxyStatus: 'pending', proxyError: undefined },
      useProxySettingsStore.getState().settings,
      {
        force: job.force,
        cfrFrameRate: job.cfrFrameRate,
        sourceStart: job.sourceStart,
        sourceDuration: job.sourceDuration,
      },
    );
    updateMediaAsset(job.assetId, () => proxyAsset);
    return;
  }
  await getWaveform(asset);
}

function updateMediaAsset(assetId: string, mapAsset: (asset: MediaAsset) => MediaAsset): void {
  const state = useEditorStore.getState();
  state.setMedia(state.project.media.map((asset) => (asset.id === assetId ? mapAsset(asset) : asset)));
}

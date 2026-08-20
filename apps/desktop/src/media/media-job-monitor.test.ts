import { describe, expect, it, beforeEach } from 'vitest';
import { calculateMediaJobEtaSeconds, moveMediaJobBefore, sortMediaJobsForMonitor } from './media-job-monitor';
import { useMediaJobStore, type MediaJob, type MediaJobStatus } from './media-job-store';
import type { MediaAsset } from '@open-factory/editor-core';

describe('media job monitor', () => {
  beforeEach(() => {
    useMediaJobStore.setState({ jobs: [], runnerActive: false });
  });

  it('sorts queue rows by active status, proxy priority, and creation time', () => {
    const jobs = [
      makeJob('done', 'success', '2026-06-15T10:00:03.000Z'),
      makeJob('waiting-late', 'pending', '2026-06-15T10:00:02.000Z'),
      makeJob('running', 'running', '2026-06-15T10:00:04.000Z'),
      makeJob('waiting-early', 'pending', '2026-06-15T10:00:01.000Z'),
      { ...makeJob('waiting-high', 'pending', '2026-06-15T10:00:05.000Z'), priority: 'high' as const },
      makeJob('failed', 'error', '2026-06-15T10:00:00.000Z'),
    ];

    expect(sortMediaJobsForMonitor(jobs).map((job) => job.id)).toEqual([
      'running',
      'waiting-high',
      'waiting-early',
      'waiting-late',
      'failed',
      'done',
    ]);
  });

  it('moves a job before another job when priority is adjusted', () => {
    expect(moveMediaJobBefore([makeJob('a'), makeJob('b'), makeJob('c')], 'c', 'a').map((job) => job.id)).toEqual([
      'c',
      'a',
      'b',
    ]);
    expect(moveMediaJobBefore([makeJob('a'), makeJob('b'), makeJob('c')], 'a', 'missing').map((job) => job.id)).toEqual(
      ['a', 'b', 'c'],
    );
  });

  it('starts high priority proxy jobs before older low priority proxy jobs', () => {
    const store = useMediaJobStore.getState();
    store.enqueueMonitorJob({
      id: 'low-a',
      assetId: 'asset-low-a',
      assetName: 'low-a.mov',
      type: 'proxy',
      priority: 'low',
    });
    store.enqueueMonitorJob({
      id: 'low-b',
      assetId: 'asset-low-b',
      assetName: 'low-b.mov',
      type: 'proxy',
      priority: 'low',
    });
    store.enqueueMonitorJob({
      id: 'high',
      assetId: 'asset-high',
      assetName: 'high.mov',
      type: 'proxy',
      priority: 'high',
    });

    expect(useMediaJobStore.getState().startNextJob()?.id).toBe('high');
  });

  it('setJobPriority updates a pending job priority and re-sorts the queue', () => {
    useMediaJobStore.setState({
      jobs: [
        makeJob('a', 'pending', '2026-06-15T10:00:00.000Z'),
        makeJob('b', 'pending', '2026-06-15T10:00:01.000Z'),
      ],
    });

    useMediaJobStore.getState().setJobPriority('b', 'high');

    expect(useMediaJobStore.getState().jobs.find((job) => job.id === 'b')?.priority).toBe('high');
    expect(useMediaJobStore.getState().startNextJob()?.id).toBe('b');
  });

  it('enqueueWaveformJobsForMedia enqueues waveform jobs only for audio-bearing assets', () => {
    useMediaJobStore.getState().enqueueWaveformJobsForMedia([
      makeAsset('audio-1', 'audio'),
      makeAsset('video-audio', 'video', true),
      makeAsset('video-silent', 'video', false),
      makeAsset('missing', 'audio', true, true),
    ]);

    const waveform = useMediaJobStore.getState().jobs.filter((job) => job.type === 'waveform');
    expect(waveform.map((job) => job.assetId)).toEqual(['audio-1', 'video-audio']);
  });

  it('calculates remaining time from progress speed', () => {
    const eta = calculateMediaJobEtaSeconds(
      makeJob('running', 'running', '2026-06-15T10:00:00.000Z', 0.25, '2026-06-15T10:00:00.000Z'),
      Date.parse('2026-06-15T10:00:10.000Z'),
    );

    expect(eta).toBeCloseTo(30, 6);
    expect(calculateMediaJobEtaSeconds(makeJob('pending', 'pending'))).toBeUndefined();
  });

  it('marks cancelable jobs as canceled without touching completed jobs', () => {
    useMediaJobStore.setState({
      jobs: [makeJob('pending', 'pending'), makeJob('running', 'running'), makeJob('done', 'success')],
    });

    useMediaJobStore.getState().cancelAllJobs();

    expect(useMediaJobStore.getState().jobs.map((job) => [job.id, job.status])).toEqual([
      ['pending', 'canceled'],
      ['running', 'canceled'],
      ['done', 'success'],
    ]);
  });
});

function makeAsset(id: string, type: 'audio' | 'video', hasAudio = false, missing = false): MediaAsset {
  return {
    id,
    name: id,
    type,
    hasAudio,
    missing,
    path: 'C:/media/' + id,
  } as MediaAsset;
}

function makeJob(
  id: string,
  status: MediaJobStatus = 'pending',
  createdAt = '2026-06-15T10:00:00.000Z',
  progress = 0,
  startedAt?: string,
): MediaJob {
  return {
    id,
    key: id,
    assetId: `asset-${id}`,
    assetName: `${id}.mp4`,
    type: 'proxy',
    status,
    progress,
    priority: 'low',
    createdAt,
    updatedAt: createdAt,
    startedAt,
  };
}

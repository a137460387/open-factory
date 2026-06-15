import { describe, expect, it, beforeEach } from 'vitest';
import { calculateMediaJobEtaSeconds, moveMediaJobBefore, sortMediaJobsForMonitor } from './media-job-monitor';
import { useMediaJobStore, type MediaJob, type MediaJobStatus } from './media-job-store';

describe('media job monitor', () => {
  beforeEach(() => {
    useMediaJobStore.setState({ jobs: [], runnerActive: false });
  });

  it('sorts queue rows by active status and creation time', () => {
    const jobs = [
      makeJob('done', 'success', '2026-06-15T10:00:03.000Z'),
      makeJob('waiting-late', 'pending', '2026-06-15T10:00:02.000Z'),
      makeJob('running', 'running', '2026-06-15T10:00:04.000Z'),
      makeJob('waiting-early', 'pending', '2026-06-15T10:00:01.000Z'),
      makeJob('failed', 'error', '2026-06-15T10:00:00.000Z')
    ];

    expect(sortMediaJobsForMonitor(jobs).map((job) => job.id)).toEqual(['running', 'waiting-early', 'waiting-late', 'failed', 'done']);
  });

  it('moves a job before another job when priority is adjusted', () => {
    expect(moveMediaJobBefore([makeJob('a'), makeJob('b'), makeJob('c')], 'c', 'a').map((job) => job.id)).toEqual(['c', 'a', 'b']);
    expect(moveMediaJobBefore([makeJob('a'), makeJob('b'), makeJob('c')], 'a', 'missing').map((job) => job.id)).toEqual(['a', 'b', 'c']);
  });

  it('calculates remaining time from progress speed', () => {
    const eta = calculateMediaJobEtaSeconds(makeJob('running', 'running', '2026-06-15T10:00:00.000Z', 0.25, '2026-06-15T10:00:00.000Z'), Date.parse('2026-06-15T10:00:10.000Z'));

    expect(eta).toBeCloseTo(30, 6);
    expect(calculateMediaJobEtaSeconds(makeJob('pending', 'pending'))).toBeUndefined();
  });

  it('marks cancelable jobs as canceled without touching completed jobs', () => {
    useMediaJobStore.setState({
      jobs: [makeJob('pending', 'pending'), makeJob('running', 'running'), makeJob('done', 'success')]
    });

    useMediaJobStore.getState().cancelAllJobs();

    expect(useMediaJobStore.getState().jobs.map((job) => [job.id, job.status])).toEqual([
      ['pending', 'canceled'],
      ['running', 'canceled'],
      ['done', 'success']
    ]);
  });
});

function makeJob(id: string, status: MediaJobStatus = 'pending', createdAt = '2026-06-15T10:00:00.000Z', progress = 0, startedAt?: string): MediaJob {
  return {
    id,
    key: id,
    assetId: `asset-${id}`,
    assetName: `${id}.mp4`,
    type: 'proxy',
    status,
    progress,
    createdAt,
    updatedAt: createdAt,
    startedAt
  };
}

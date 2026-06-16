import { describe, expect, it } from 'vitest';
import { buildCoverFrameBatchTasks, buildEvenCoverFrameTimestamps, sanitizeCoverFileStem } from '../src';
import { makeProject } from './test-utils';

describe('cover frame planning', () => {
  it('calculates stable evenly spaced extraction timestamps', () => {
    expect(buildEvenCoverFrameTimestamps(14, 6)).toEqual([2, 4, 6, 8, 10, 12]);
    expect(buildEvenCoverFrameTimestamps(1, 3)).toEqual([0.25, 0.5, 0.75]);
    expect(buildEvenCoverFrameTimestamps(Number.NaN, 2)).toEqual([0, 0]);
  });

  it('builds batch tasks for available video assets only', () => {
    const project = makeProject();
    const tasks = buildCoverFrameBatchTasks([
      ...project.media,
      { id: 'audio-1', type: 'audio', name: 'voice.wav', path: 'C:/Media/voice.wav', duration: 1, width: 0, height: 0 },
      { id: 'missing-video', type: 'video', name: 'missing.mp4', path: 'C:/Missing/missing.mp4', duration: 1, width: 1280, height: 720, missing: true }
    ]);

    expect(tasks).toEqual([
      {
        assetId: 'asset-1',
        sourcePath: 'C:\\Videos\\sample.mp4',
        outputFileName: 'sample-cover.png'
      }
    ]);
  });

  it('sanitizes cover file stems without losing readable names', () => {
    expect(sanitizeCoverFileStem('A Roll / scene 01.mov')).toBe('A-Roll-scene-01');
    expect(sanitizeCoverFileStem('???.mp4')).toBe('cover-frame');
  });
});

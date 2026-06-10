import { describe, expect, it } from 'vitest';
import { scoreRelinkCandidate, sortRelinkCandidates } from '../src';
import { makeProject } from './test-utils';

describe('relink scoring', () => {
  it('scores exact filename and size matches highly', () => {
    const asset = makeProject().media[0];
    const score = scoreRelinkCandidate(asset, {
      path: 'E:/Moved/sample.mp4',
      size: asset.size,
      duration: asset.duration,
      width: asset.width,
      height: asset.height
    });

    expect(score.score).toBeGreaterThan(0.7);
    expect(score.reasons).toContain('name');
  });

  it('sorts stronger candidates first', () => {
    const asset = { ...makeProject().media[0], size: 4096 };
    const sorted = sortRelinkCandidates(asset, [
      { path: 'D:/Other/unrelated.mov', size: 1 },
      { path: 'D:/Other/sample.mp4', size: 4096, duration: asset.duration }
    ]);

    expect(sorted[0].path).toBe('D:/Other/sample.mp4');
  });

  it('gives partial credit for near matches', () => {
    const asset = { ...makeProject().media[0], size: 1000, duration: 10 };
    const score = scoreRelinkCandidate(asset, {
      path: 'D:/Other/sample.mp4',
      size: 1010,
      duration: 10.2,
      width: asset.width,
      height: asset.height
    });

    expect(score.reasons).toContain('near-size');
    expect(score.reasons).toContain('near-duration');
    expect(score.score).toBeGreaterThan(0.6);
  });

  it('scores basename matches and handles candidates without extensions', () => {
    const asset = { ...makeProject().media[0], name: 'sample.mp4', size: undefined, duration: 0, width: 0, height: 0 };
    const score = scoreRelinkCandidate(asset, { path: 'D:/Other/sample.mov', name: 'sample.mov' });
    const noExtensionScore = scoreRelinkCandidate({ ...asset, name: 'sample' }, { path: 'D:/Other/sample' });

    expect(score.reasons).toContain('basename');
    expect(score.reasons).not.toContain('extension');
    expect(noExtensionScore.reasons).toEqual(['name', 'extension']);
  });

  it('sorts empty candidate lists without errors', () => {
    expect(sortRelinkCandidates(makeProject().media[0], [])).toEqual([]);
  });
});

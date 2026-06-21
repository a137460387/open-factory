import { describe, it, expect } from 'vitest';
import {
  checkClipCompatibility,
  matchByFilename,
  buildBatchReplacePrecheckReport,
  detectPostReplaceWarnings
} from '../src/batch-media-replace';
import type { MediaAsset } from '../src/model-types';

function makeAsset(overrides: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id: 'asset-1', type: 'video', name: 'clip.mp4', path: '/tmp/clip.mp4',
    duration: 10, width: 1920, height: 1080,
    ...overrides
  } as MediaAsset;
}

describe('checkClipCompatibility', () => {
  it('should report resolution mismatch as error', () => {
    const oldAsset = makeAsset({ width: 1920, height: 1080 });
    const newAsset = makeAsset({ id: 'asset-2', width: 1280, height: 720 });
    const result = checkClipCompatibility(
      { id: 'c1', name: 'clip1', duration: 5 }, oldAsset, newAsset
    );
    expect(result.severity).toBe('error');
    expect(result.issues.some(i => i.type === 'resolution')).toBe(true);
  });

  it('should report duration insufficient as error when strategy is keep', () => {
    const oldAsset = makeAsset({ duration: 10 });
    const newAsset = makeAsset({ id: 'asset-2', duration: 3 });
    const result = checkClipCompatibility(
      { id: 'c1', name: 'clip1', duration: 5 }, oldAsset, newAsset, 'keep'
    );
    expect(result.issues.some(i => i.type === 'duration')).toBe(true);
  });

  it('should report codec change as warning', () => {
    const oldAsset = makeAsset({ videoCodec: 'h264' } as any);
    const newAsset = makeAsset({ id: 'asset-2', videoCodec: 'hevc' } as any);
    const result = checkClipCompatibility(
      { id: 'c1', name: 'clip1', duration: 5 }, oldAsset, newAsset
    );
    expect(result.issues.some(i => i.type === 'codec' && i.severity === 'warning')).toBe(true);
  });

  it('should pass when assets match', () => {
    const oldAsset = makeAsset();
    const newAsset = makeAsset({ id: 'asset-2' });
    const result = checkClipCompatibility(
      { id: 'c1', name: 'clip1', duration: 5 }, oldAsset, newAsset
    );
    expect(result.severity).toBe('ok');
  });
});

describe('matchByFilename', () => {
  it('should match files with same base name regardless of extension', () => {
    const old = { name: 'scene1.mp4' };
    const candidates = [
      makeAsset({ id: 'a1', name: 'other.mp4' }),
      makeAsset({ id: 'a2', name: 'scene1.mov' }),
      makeAsset({ id: 'a3', name: 'Scene1.MP4' })
    ];
    const result = matchByFilename(old, candidates);
    expect(result?.id).toBe('a2');
  });

  it('should return undefined when no match found', () => {
    const old = { name: 'unique.mp4' };
    const candidates = [makeAsset({ id: 'a1', name: 'other.mp4' })];
    expect(matchByFilename(old, candidates)).toBeUndefined();
  });
});

describe('detectPostReplaceWarnings', () => {
  it('should detect keyframes beyond new asset duration', () => {
    const clip = {
      id: 'c1', name: 'clip1', duration: 10,
      keyframes: {
        opacity: [
          { id: 'k1', time: 2, value: 1, easing: 'linear' as const },
          { id: 'k2', time: 15, value: 0, easing: 'linear' as const }
        ]
      }
    };
    const newAsset = makeAsset({ duration: 8 });
    const warnings = detectPostReplaceWarnings(clip, newAsset);
    expect(warnings.length).toBe(1);
    expect(warnings[0].warningType).toBe('keyframe-out-of-range');
    expect(warnings[0].detail).toContain('15.00');
  });

  it('should return empty when all keyframes within range', () => {
    const clip = {
      id: 'c1', name: 'clip1', duration: 10,
      keyframes: {
        volume: [
          { id: 'k1', time: 5, value: 0.8, easing: 'linear' as const }
        ]
      }
    };
    const newAsset = makeAsset({ duration: 10 });
    expect(detectPostReplaceWarnings(clip, newAsset)).toEqual([]);
  });

  it('should return empty when clip has no keyframes', () => {
    const clip = { id: 'c1', name: 'clip1', duration: 10 };
    const newAsset = makeAsset({ duration: 5 });
    expect(detectPostReplaceWarnings(clip, newAsset)).toEqual([]);
  });
});

describe('buildBatchReplacePrecheckReport', () => {
  it('should report canProceed false when any clip has error', () => {
    const mappings = [
      {
        clipId: 'c1', oldAssetId: 'a1', newAssetId: 'a2',
        newAsset: makeAsset({ id: 'a2', width: 1280, height: 720 }),
        durationStrategy: 'keep' as const
      }
    ];
    const getOld = () => makeAsset({ id: 'a1', width: 1920, height: 1080 });
    const report = buildBatchReplacePrecheckReport(mappings, getOld);
    expect(report.canProceed).toBe(false);
    expect(report.errorClips).toBe(1);
  });

  it('should report canProceed true when all compatible', () => {
    const mappings = [
      {
        clipId: 'c1', oldAssetId: 'a1', newAssetId: 'a2',
        newAsset: makeAsset({ id: 'a2' }),
        durationStrategy: 'keep' as const
      }
    ];
    const getOld = () => makeAsset({ id: 'a1' });
    const report = buildBatchReplacePrecheckReport(mappings, getOld);
    expect(report.canProceed).toBe(true);
    expect(report.compatibleClips).toBe(1);
  });
});

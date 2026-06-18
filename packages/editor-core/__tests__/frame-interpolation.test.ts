import { describe, expect, it } from 'vitest';
import {
  buildFrameInterpolationCacheKey,
  buildSceneBoundaryProtectionRanges,
  clampFrameInterpolationProtectionFrames,
  collectMissingInterpolationFrames,
  frameInterpolationCachePath,
  isFrameProtectedBySceneBoundary,
  mapSsimToFrameInterpolationQualityGrade,
  resolveFrameInterpolationMode,
  selectAdaptiveFrameInterpolationMode
} from '../src/export/frame-interpolation';

describe('frame interpolation v2', () => {
  it('clamps scene boundary protection frames between 0 and 5', () => {
    expect(clampFrameInterpolationProtectionFrames(-2)).toBe(0);
    expect(clampFrameInterpolationProtectionFrames(2.4)).toBe(2);
    expect(clampFrameInterpolationProtectionFrames(9)).toBe(5);
  });

  it('protects scene boundary frames around each detected cut', () => {
    const ranges = buildSceneBoundaryProtectionRanges([1], 30, 3, 2);
    expect(ranges).toEqual([{ startFrame: 28, endFrame: 32 }]);
    expect(isFrameProtectedBySceneBoundary(30, ranges)).toBe(true);
    expect(isFrameProtectedBySceneBoundary(33, ranges)).toBe(false);
  });

  it('selects adaptive modes for static, fast, and extreme motion', () => {
    expect(selectAdaptiveFrameInterpolationMode(0.05)).toBe('blend');
    expect(selectAdaptiveFrameInterpolationMode(0.55)).toBe('mci');
    expect(selectAdaptiveFrameInterpolationMode(0.95)).toBe('copy');
    expect(resolveFrameInterpolationMode('blend', 0.95)).toBe('blend');
  });

  it('generates stable cache keys from media path and parameters', () => {
    const first = buildFrameInterpolationCacheKey('D:\\Media\\Clip.MP4', { targetFps: 60, mode: 'adaptive', protectionFrames: 2 });
    const same = buildFrameInterpolationCacheKey('d:/media/clip.mp4', { targetFps: 60, mode: 'adaptive', protectionFrames: 2 });
    const changed = buildFrameInterpolationCacheKey('d:/media/clip.mp4', { targetFps: 120, mode: 'adaptive', protectionFrames: 2 });
    expect(first).toBe(same);
    expect(changed).not.toBe(first);
    expect(frameInterpolationCachePath('C:/Users/E2E/AppData/Roaming/open-factory', 'd:/media/clip.mp4', { targetFps: 60, mode: 'adaptive', protectionFrames: 2 })).toContain('/interp-cache/interp-');
  });

  it('maps SSIM to quality grades', () => {
    expect(mapSsimToFrameInterpolationQualityGrade(0.981)).toBe('excellent');
    expect(mapSsimToFrameInterpolationQualityGrade(0.98)).toBe('good');
    expect(mapSsimToFrameInterpolationQualityGrade(0.9)).toBe('good');
    expect(mapSsimToFrameInterpolationQualityGrade(0.899)).toBe('poor');
  });

  it('skips existing frames when resuming interpolation', () => {
    expect(collectMissingInterpolationFrames(6, [0, 2, 5, 99])).toEqual([1, 3, 4]);
  });
});

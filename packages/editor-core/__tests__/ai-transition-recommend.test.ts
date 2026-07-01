import { describe, expect, it } from 'vitest';
import {
  calculateRGBHistogramChiSquareDistance,
  estimateMotionFromFrameDifferences,
  estimateMotionFromLumaDiffs,
  mapToValidTransitionType,
  recommendTransition,
  recommendTransitionSafe,
  type TransitionClipFeatures
} from '../src';

describe('chi-square color histogram distance', () => {
  it('returns 0 for identical histograms', () => {
    expect(calculateRGBHistogramChiSquareDistance([10, 20, 30], [10, 20, 30])).toBe(0);
  });

  it('returns positive distance for different histograms', () => {
    const dist = calculateRGBHistogramChiSquareDistance([100, 0, 0], [0, 0, 100]);
    expect(dist).toBeGreaterThan(0);
  });

  it('returns 0 for empty histograms', () => {
    expect(calculateRGBHistogramChiSquareDistance([], [])).toBe(0);
  });

  it('handles different length histograms', () => {
    const dist = calculateRGBHistogramChiSquareDistance([10, 20], [5, 15, 25]);
    expect(dist).toBeGreaterThanOrEqual(0);
  });

  it('treats negative histogram values as 0', () => {
    const dist = calculateRGBHistogramChiSquareDistance([-5, 10], [3, 20]);
    expect(dist).toBeGreaterThanOrEqual(0);
  });
});

describe('motion estimation from frame differences', () => {
  it('returns 0 for single frame', () => {
    expect(estimateMotionFromLumaDiffs([])).toBe(0);
  });

  it('computes average luma difference', () => {
    expect(estimateMotionFromLumaDiffs([10, 20, 30])).toBe(20);
  });

  it('handles zero differences', () => {
    expect(estimateMotionFromLumaDiffs([0, 0, 0])).toBe(0);
  });

  it('handles negative luma diffs by taking absolute', () => {
    expect(estimateMotionFromLumaDiffs([-10, -20])).toBe(15);
  });
});

describe('estimateMotionFromFrameDifferences', () => {
  it('returns 0 for empty frame array', () => {
    expect(estimateMotionFromFrameDifferences([], 0, 0)).toBe(0);
  });

  it('returns 0 for single frame', () => {
    expect(estimateMotionFromFrameDifferences([[100, 150, 200, 50]], 2, 2)).toBe(0);
  });

  it('computes average pixel difference for two frames', () => {
    const frameA = [100, 150, 200, 50];
    const frameB = [110, 140, 210, 60];
    const result = estimateMotionFromFrameDifferences([frameA, frameB], 2, 2);
    expect(result).toBe(10);
  });

  it('handles frames with different pixel counts', () => {
    const frameA = [100, 150];
    const frameB = [110, 140, 210, 60];
    const result = estimateMotionFromFrameDifferences([frameA, frameB], 2, 2);
    expect(result).toBe(10);
  });

  it('handles three frames', () => {
    const frameA = [100, 150];
    const frameB = [110, 140];
    const frameC = [120, 130];
    const result = estimateMotionFromFrameDifferences([frameA, frameB, frameC], 2, 1);
    expect(result).toBe(10);
  });

  it('returns 0 when all pixels are identical', () => {
    const frameA = [100, 100, 100];
    const frameB = [100, 100, 100];
    expect(estimateMotionFromFrameDifferences([frameA, frameB], 3, 1)).toBe(0);
  });
});

describe('transition type mapping', () => {
  it('maps known types directly', () => {
    expect(mapToValidTransitionType('dissolve')).toBe('dissolve');
    expect(mapToValidTransitionType('fade-black')).toBe('fade-black');
    expect(mapToValidTransitionType('wipe-left')).toBe('wipe-left');
  });

  it('falls back to dissolve for unknown types', () => {
    expect(mapToValidTransitionType('some-unknown-effect')).toBe('dissolve');
  });

  it('maps cross-fade to dissolve', () => {
    expect(mapToValidTransitionType('cross-fade')).toBe('dissolve');
  });

  it('is case insensitive', () => {
    expect(mapToValidTransitionType('DISSOLVE')).toBe('dissolve');
  });

  it('maps flash+white correctly', () => {
    expect(mapToValidTransitionType('flash white effect')).toBe('flash-white');
  });

  it('maps flash+black correctly', () => {
    expect(mapToValidTransitionType('flash black')).toBe('flash-black');
  });

  it('maps wipe variants', () => {
    expect(mapToValidTransitionType('wipe-right')).toBe('wipe-right');
    expect(mapToValidTransitionType('wipe-up')).toBe('wipe-up');
    expect(mapToValidTransitionType('wipe-down')).toBe('wipe-down');
  });

  it('trims whitespace', () => {
    expect(mapToValidTransitionType('  dissolve  ')).toBe('dissolve');
  });
});

describe('transition recommendation', () => {
  const clipA: TransitionClipFeatures = { colorHist: [0.3, 0.2, 0.1, 0.4], motionScore: 5, sceneTag: 'indoor' };
  const clipB: TransitionClipFeatures = { colorHist: [0.1, 0.4, 0.3, 0.2], motionScore: 15, sceneTag: 'outdoor' };

  it('returns sorted recommendations by confidence', () => {
    const result = recommendTransition(clipA, clipB);
    expect(result.recommended.length).toBeGreaterThanOrEqual(1);
    for (let i = 1; i < result.recommended.length; i++) {
      expect(result.recommended[i - 1].confidence).toBeGreaterThanOrEqual(result.recommended[i].confidence);
    }
  });

  it('includes dissolve for high color distance', () => {
    const result = recommendTransition(
      { colorHist: [1, 0, 0, 0], motionScore: 5 },
      { colorHist: [0, 0, 0, 1], motionScore: 5 }
    );
    expect(result.recommended.some((r) => r.transitionType === 'dissolve')).toBe(true);
  });

  it('includes flash-white for high motion', () => {
    const result = recommendTransition(
      { colorHist: [0.25, 0.25, 0.25, 0.25], motionScore: 20 },
      { colorHist: [0.25, 0.25, 0.25, 0.25], motionScore: 20 }
    );
    expect(result.recommended.some((r) => r.transitionType === 'flash-white')).toBe(true);
  });

  it('includes fade-black for static scenes', () => {
    const result = recommendTransition(
      { colorHist: [0.25, 0.25, 0.25, 0.25], motionScore: 1 },
      { colorHist: [0.25, 0.25, 0.25, 0.25], motionScore: 1 }
    );
    expect(result.recommended.some((r) => r.transitionType === 'fade-black')).toBe(true);
  });

  it('returns default dissolve when no strong signal', () => {
    const result = recommendTransition(
      { colorHist: [0.25, 0.25, 0.25, 0.25], motionScore: 5 },
      { colorHist: [0.25, 0.25, 0.25, 0.25], motionScore: 5 }
    );
    expect(result.recommended[0].transitionType).toBe('dissolve');
  });

  it('includes wipe-left for different scene tags', () => {
    const result = recommendTransition(
      { colorHist: [0.25, 0.25, 0.25, 0.25], motionScore: 5, sceneTag: 'indoor' },
      { colorHist: [0.25, 0.25, 0.25, 0.25], motionScore: 5, sceneTag: 'outdoor' }
    );
    expect(result.recommended.some((r) => r.transitionType === 'wipe-left')).toBe(true);
  });

  it('does not include wipe-left for same scene tags', () => {
    const result = recommendTransition(
      { colorHist: [0.25, 0.25, 0.25, 0.25], motionScore: 5, sceneTag: 'indoor' },
      { colorHist: [0.25, 0.25, 0.25, 0.25], motionScore: 5, sceneTag: 'indoor' }
    );
    expect(result.recommended.every((r) => r.transitionType !== 'wipe-left')).toBe(true);
  });

  it('does not include wipe-left when one clip has no scene tag', () => {
    const result = recommendTransition(
      { colorHist: [0.25, 0.25, 0.25, 0.25], motionScore: 5, sceneTag: 'indoor' },
      { colorHist: [0.25, 0.25, 0.25, 0.25], motionScore: 5 }
    );
    expect(result.recommended.every((r) => r.transitionType !== 'wipe-left')).toBe(true);
  });

  it('does not include wipe-left when both clips have no scene tags', () => {
    const result = recommendTransition(
      { colorHist: [0.25, 0.25, 0.25, 0.25], motionScore: 5 },
      { colorHist: [0.25, 0.25, 0.25, 0.25], motionScore: 5 }
    );
    expect(result.recommended.every((r) => r.transitionType !== 'wipe-left')).toBe(true);
  });

  it('high motion + high color distance produces multiple recommendations', () => {
    const result = recommendTransition(
      { colorHist: [1, 0, 0, 0], motionScore: 20 },
      { colorHist: [0, 0, 0, 1], motionScore: 20 }
    );
    expect(result.recommended.length).toBeGreaterThanOrEqual(2);
  });
});

describe('recommendTransitionSafe', () => {
  const clipA: TransitionClipFeatures = { colorHist: [0.3, 0.2, 0.1, 0.4], motionScore: 5 };
  const clipB: TransitionClipFeatures = { colorHist: [0.1, 0.4, 0.3, 0.2], motionScore: 15 };

  it('returns success result with data', async () => {
    const result = await recommendTransitionSafe(clipA, clipB);
    expect(result.error).toBeNull();
    expect(result.isProcessing).toBe(false);
    expect(result.data.recommended.length).toBeGreaterThan(0);
  });

  it('uses identity translator by default', async () => {
    const result = await recommendTransitionSafe(clipA, clipB);
    for (const rec of result.data.recommended) {
      expect(typeof rec.reason).toBe('string');
    }
  });

  it('applies custom translator to reasons', async () => {
    const t = (key: string) => `translated:${key}`;
    const result = await recommendTransitionSafe(clipA, clipB, t);
    for (const rec of result.data.recommended) {
      expect(rec.reason).toMatch(/^translated:/);
    }
  });

  it('returns localized fallback reason', async () => {
    const t = (key: string) => `T:${key}`;
    const result = await recommendTransitionSafe(
      { colorHist: [0.25, 0.25, 0.25, 0.25], motionScore: 5 },
      { colorHist: [0.25, 0.25, 0.25, 0.25], motionScore: 5 },
      t
    );
    expect(result.data.recommended[0].reason).toBe('T:aiTransitionRecommend.reasons.fallback');
  });

  it('catches error and returns error result', async () => {
    const brokenClip = new Proxy({}, {
      get(_, prop) {
        if (prop === Symbol.toPrimitive || prop === Symbol.toStringTag) {
          return () => { throw new Error('test error'); };
        }
        throw new Error('test error');
      },
    }) as unknown as TransitionClipFeatures;
    const result = await recommendTransitionSafe(brokenClip, clipB);
    expect(result.error).not.toBeNull();
    expect(result.isProcessing).toBe(false);
    expect(result.data.recommended).toEqual([]);
  });

  it('localizes error message via t()', async () => {
    const t = (key: string) => `ERR:${key}`;
    const brokenClip = new Proxy({}, {
      get(_, prop) {
        if (prop === Symbol.toPrimitive || prop === Symbol.toStringTag) {
          return () => { throw new Error('boom'); };
        }
        throw new Error('boom');
      },
    }) as unknown as TransitionClipFeatures;
    const result = await recommendTransitionSafe(brokenClip, clipB, t);
    expect(result.error).toBe('ERR:aiModules.error.computationFailed');
  });
});

describe('coverage edge cases', () => {
  it('returns 0 when pixel count is 0 (width*height=0)', () => {
    expect(estimateMotionFromFrameDifferences([[1, 2], [3, 4]], 0, 0)).toBe(0);
  });

  it('maps fade+black via includes (non-exact)', () => {
    expect(mapToValidTransitionType('fade to black')).toBe('fade-black');
  });

  it('maps wipe+left via includes (non-exact)', () => {
    expect(mapToValidTransitionType('wipe to left')).toBe('wipe-left');
  });

  it('maps wipe+right via includes (non-exact)', () => {
    expect(mapToValidTransitionType('wipe right transition')).toBe('wipe-right');
  });

  it('maps wipe+up via includes (non-exact)', () => {
    expect(mapToValidTransitionType('wipe up effect')).toBe('wipe-up');
  });

  it('maps wipe+down via includes (non-exact)', () => {
    expect(mapToValidTransitionType('wipe down effect')).toBe('wipe-down');
  });
});
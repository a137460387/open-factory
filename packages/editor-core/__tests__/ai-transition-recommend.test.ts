import { describe, expect, it } from 'vitest';
import {
  calculateRGBHistogramChiSquareDistance,
  estimateMotionFromLumaDiffs,
  mapToValidTransitionType,
  recommendTransition,
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
});

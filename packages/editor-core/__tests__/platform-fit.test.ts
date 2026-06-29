import { describe, expect, it } from 'vitest';
import {
  calculateClipImportance,
  snapToSceneChange,
  generatePlatformFitSuggestion,
  PLATFORM_LIMITS,
  type ClipWithDurationAndScore
} from '../src';

// -- calculateClipImportance --------------------------------------

describe('calculateClipImportance', () => {
  it('returns explicit score when provided', () => {
    expect(calculateClipImportance({ clipId: 'a', start: 0, end: 5, score: 0.8 })).toBe(0.8);
  });

  it('returns default score when score is undefined', () => {
    expect(calculateClipImportance({ clipId: 'a', start: 0, end: 5 })).toBe(0.5);
  });

  it('returns custom default score when score is undefined', () => {
    expect(calculateClipImportance({ clipId: 'a', start: 0, end: 5 }, 0.3)).toBe(0.3);
  });

  it('clamps score to [0, 1]', () => {
    expect(calculateClipImportance({ clipId: 'a', start: 0, end: 5, score: 1.5 })).toBe(1);
    expect(calculateClipImportance({ clipId: 'a', start: 0, end: 5, score: -0.5 })).toBe(0);
  });

  it('returns default for NaN score', () => {
    expect(calculateClipImportance({ clipId: 'a', start: 0, end: 5, score: NaN })).toBe(0.5);
  });

  it('returns default for Infinity score', () => {
    expect(calculateClipImportance({ clipId: 'a', start: 0, end: 5, score: Infinity })).toBe(0.5);
  });

  it('handles score of exactly 0', () => {
    expect(calculateClipImportance({ clipId: 'a', start: 0, end: 5, score: 0 })).toBe(0);
  });

  it('handles score of exactly 1', () => {
    expect(calculateClipImportance({ clipId: 'a', start: 0, end: 5, score: 1 })).toBe(1);
  });
});

// -- snapToSceneChange -------------------------------------------

describe('snapToSceneChange', () => {
  it('returns original time for empty scene changes', () => {
    expect(snapToSceneChange(3.5, [])).toBe(3.5);
  });

  it('snaps to nearest scene change within tolerance', () => {
    expect(snapToSceneChange(3.2, [1, 3, 5, 7])).toBe(3);
  });

  it('does not snap when outside tolerance', () => {
    expect(snapToSceneChange(3.8, [1, 3, 5, 7], 0.5)).toBe(3.8);
  });

  it('snaps exactly on scene change', () => {
    expect(snapToSceneChange(5, [1, 3, 5, 7])).toBe(5);
  });

  it('respects custom tolerance', () => {
    // tolerance=0.1, distance to nearest (3) is 0.2 → no snap
    expect(snapToSceneChange(3.2, [1, 3, 5, 7], 0.1)).toBe(3.2);
  });

  it('picks closest scene change when multiple within tolerance', () => {
    expect(snapToSceneChange(2.6, [2, 3], 1)).toBe(3);
  });

  it('handles single scene change time', () => {
    expect(snapToSceneChange(5.2, [5])).toBe(5);
  });

  it('snaps to exact boundary at tolerance edge', () => {
    expect(snapToSceneChange(3.5, [3], 0.5)).toBe(3);
  });

  it('does not snap beyond tolerance', () => {
    expect(snapToSceneChange(3.6, [3], 0.5)).toBe(3.6);
  });
});

// -- generatePlatformFitSuggestion --------------------------------

describe('generatePlatformFitSuggestion', () => {
  const clips: ClipWithDurationAndScore[] = [
    { clipId: 'a', start: 0, end: 10, score: 0.9 },
    { clipId: 'b', start: 10, end: 25, score: 0.5 },
    { clipId: 'c', start: 25, end: 40, score: 0.7 },
    { clipId: 'd', start: 40, end: 55, score: 0.3 }
  ];

  it('keeps all clips when total duration fits within limit', () => {
    const result = generatePlatformFitSuggestion(clips, 60);
    expect(result.keptSegments.length).toBe(4);
    expect(result.removedSegments.length).toBe(0);
  });

  it('removes lowest-scoring clips when exceeding limit', () => {
    // Total duration = 55s. Limit = 30s.
    // By score: a=0.9(10s), c=0.7(15s), b=0.5(15s), d=0.3(15s)
    // Greedy: a(10s) + c(15s) = 25s → fits. b(15s) → 40s > 30 → skip. d(15s) → 40s > 30 → skip.
    const result = generatePlatformFitSuggestion(clips, 30);
    const keptIds = result.keptSegments.map(s => s.clipId);
    expect(keptIds).toContain('a');
    expect(keptIds).toContain('c');
    expect(result.removedSegments.map(s => s.clipId)).toContain('d');
  });

  it('keeps clips sorted by original time order', () => {
    const result = generatePlatformFitSuggestion(clips, 30);
    const starts = result.keptSegments.map(s => s.start);
    for (let i = 1; i < starts.length; i++) {
      expect(starts[i]).toBeGreaterThanOrEqual(starts[i - 1]);
    }
  });

  it('returns empty kept for zero limit', () => {
    const result = generatePlatformFitSuggestion(clips, 0);
    expect(result.keptSegments.length).toBe(0);
    expect(result.removedSegments.length).toBe(4);
  });

  it('returns empty kept for negative limit', () => {
    const result = generatePlatformFitSuggestion(clips, -10);
    expect(result.keptSegments.length).toBe(0);
  });

  it('handles empty clips', () => {
    const result = generatePlatformFitSuggestion([], 60);
    expect(result.keptSegments.length).toBe(0);
    expect(result.removedSegments.length).toBe(0);
  });

  it('uses median score for clips without explicit score', () => {
    const mixedClips: ClipWithDurationAndScore[] = [
      { clipId: 'scored', start: 0, end: 10, score: 0.9 },
      { clipId: 'unscored-1', start: 10, end: 20 },
      { clipId: 'unscored-2', start: 20, end: 30 },
      { clipId: 'low', start: 30, end: 40, score: 0.1 }
    ];
    // Median of [0.1, 0.9] = 0.9 (index 1 of 2 sorted values, floor(2/2)=1)
    // With limit=20: scored(0.9, 10s) + unscored-1(median, 10s) = 20s → fits
    const result = generatePlatformFitSuggestion(mixedClips, 20);
    const keptIds = result.keptSegments.map(s => s.clipId);
    expect(keptIds).toContain('scored');
  });

  it('handles all clips having no score (median fallback=0.5)', () => {
    const unscoredClips: ClipWithDurationAndScore[] = [
      { clipId: 'a', start: 0, end: 10 },
      { clipId: 'b', start: 10, end: 20 },
      { clipId: 'c', start: 20, end: 30 }
    ];
    // All get score 0.5. With limit=15: greedy picks first two (10s + 10s = 20 > 15? No: first is 10s, second is 10s → 20 > 15, so only first fits... wait)
    // Actually: sorted by score descending, all have 0.5 so order is preserved.
    // a(10s) → remaining=5. b(10s) → 10 > 5+0.001 → skip. c(10s) → skip.
    const result = generatePlatformFitSuggestion(unscoredClips, 15);
    expect(result.keptSegments.length).toBe(1);
    expect(result.keptSegments[0].clipId).toBe('a');
  });

  it('handles clips with zero or negative duration', () => {
    const clips: ClipWithDurationAndScore[] = [
      { clipId: 'zero', start: 5, end: 5, score: 0.9 },
      { clipId: 'neg', start: 10, end: 8, score: 0.8 },
      { clipId: 'valid', start: 0, end: 10, score: 0.5 }
    ];
    const result = generatePlatformFitSuggestion(clips, 20);
    // zero-duration and negative-duration clips should be skipped in greedy
    const keptIds = result.keptSegments.map(s => s.clipId);
    expect(keptIds).toContain('valid');
  });

  it('snaps to scene change boundaries when provided', () => {
    const clips: ClipWithDurationAndScore[] = [
      { clipId: 'a', start: 0.2, end: 9.8, score: 0.9 }
    ];
    const sceneChanges = [0, 3, 6, 10];
    const result = generatePlatformFitSuggestion(clips, 60, sceneChanges, 0.5);
    const seg = result.keptSegments[0];
    // start 0.2 snaps to 0 (within 0.5 tolerance)
    expect(seg.start).toBe(0);
    // end 9.8 snaps to 10 (within 0.5 tolerance)
    expect(seg.end).toBe(10);
  });

  it('does not snap when scene change times are empty', () => {
    const clips: ClipWithDurationAndScore[] = [
      { clipId: 'a', start: 0.2, end: 9.8, score: 0.9 }
    ];
    const result = generatePlatformFitSuggestion(clips, 60, []);
    expect(result.keptSegments[0].start).toBe(0.2);
    expect(result.keptSegments[0].end).toBe(9.8);
  });

  it('reverts snap when it makes end <= start', () => {
    const clips: ClipWithDurationAndScore[] = [
      { clipId: 'a', start: 4.8, end: 5.2, score: 0.9 }
    ];
    // Both snap to 5 → end <= start → revert to original
    const result = generatePlatformFitSuggestion(clips, 60, [5], 0.5);
    expect(result.keptSegments[0].start).toBe(4.8);
    expect(result.keptSegments[0].end).toBe(5.2);
  });

  it('limits seconds are correct for platform constants', () => {
    expect(PLATFORM_LIMITS.tiktok).toBe(60);
    expect(PLATFORM_LIMITS.reels).toBe(90);
    expect(PLATFORM_LIMITS.shorts).toBe(60);
  });

  it('sets limitSeconds on result', () => {
    const result = generatePlatformFitSuggestion(clips, 30);
    expect(result.limitSeconds).toBe(30);
  });

  it('all clips removed when limit is 1 second', () => {
    const result = generatePlatformFitSuggestion(clips, 1);
    expect(result.keptSegments.length).toBe(0);
    expect(result.removedSegments.length).toBe(clips.length);
  });

  it('single clip exactly equals limit', () => {
    const single: ClipWithDurationAndScore[] = [
      { clipId: 'a', start: 0, end: 60, score: 1.0 }
    ];
    const result = generatePlatformFitSuggestion(single, 60);
    expect(result.keptSegments.length).toBe(1);
    expect(result.removedSegments.length).toBe(0);
  });

  it('single clip exceeds limit by tiny amount', () => {
    const single: ClipWithDurationAndScore[] = [
      { clipId: 'a', start: 0, end: 60.002, score: 1.0 }
    ];
    const result = generatePlatformFitSuggestion(single, 60);
    // 60.002 <= 60 + 0.001? 60.002 > 60.001 → no
    expect(result.keptSegments.length).toBe(0);
  });
});

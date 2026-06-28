import { describe, expect, it } from 'vitest';
import {
  findNearestBeatBinarySearch,
  isWithinSnapTolerance,
  calculateBeatSnapForClips,
  applyBeatSnapToClip,
  removeSuggestion,
  BEAT_SNAP_TOLERANCE_MS,
  type BeatSnapResult
} from '../src';
import type { BeatSnapSuggestion, Clip } from '../src/model-types';

const makeClip = (id: string, start: number, duration: number): Clip => ({
  id,
  type: 'video',
  trackId: 'track-1',
  mediaId: 'media-1',
  start,
  duration,
  end: start + duration,
  mediaIn: 0,
  mediaOut: duration,
  speed: 1,
  volume: 1,
  opacity: 1,
  transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, anchorX: 0.5, anchorY: 0.5 },
  colorCorrection: { temperature: 0, tint: 0, exposure: 0, contrast: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0, saturation: 0, vibrance: 0, hue: 0, threeWay: { lift: { r: 0, g: 0, b: 0, intensity: 1 }, gamma: { r: 0, g: 0, b: 0, intensity: 1 }, gain: { r: 0, g: 0, b: 0, intensity: 1 } }, curves: { master: [{ x: 0, y: 0 }, { x: 1, y: 1 }], r: [{ x: 0, y: 0 }, { x: 1, y: 1 }], g: [{ x: 0, y: 0 }, { x: 1, y: 1 }], b: [{ x: 0, y: 0 }, { x: 1, y: 1 }] } },
  masks: [],
  filters: [],
  effects: [],
  keyframes: [],
  name: id,
  labels: [],
  markers: [],
  audioEffects: []
});

describe('findNearestBeatBinarySearch', () => {
  it('returns undefined for empty beats', () => {
    expect(findNearestBeatBinarySearch(1.0, [])).toBeUndefined();
  });

  it('finds the nearest beat time', () => {
    const beats = [0, 0.5, 1.0, 1.5, 2.0];
    expect(findNearestBeatBinarySearch(0.8, beats)).toBe(1.0);
    expect(findNearestBeatBinarySearch(1.2, beats)).toBe(1.0);
    expect(findNearestBeatBinarySearch(0.3, beats)).toBe(0.5);
  });

  it('returns exact match', () => {
    const beats = [0, 1, 2, 3];
    expect(findNearestBeatBinarySearch(2, beats)).toBe(2);
  });

  it('handles unsorted beats', () => {
    const beats = [3, 1, 2, 0];
    expect(findNearestBeatBinarySearch(0.8, beats)).toBe(1);
  });

  it('filters out invalid beat times', () => {
    const beats = [0, Number.NaN, -1, 1.5, 2.0];
    expect(findNearestBeatBinarySearch(1.6, beats)).toBe(1.5);
  });
});

describe('isWithinSnapTolerance', () => {
  it('returns true within 150ms tolerance', () => {
    expect(isWithinSnapTolerance(1.0, 1.1)).toBe(true);
    expect(isWithinSnapTolerance(1.0, 1.149)).toBe(true);
  });

  it('returns false outside 150ms tolerance', () => {
    expect(isWithinSnapTolerance(1.0, 1.2)).toBe(false);
    expect(isWithinSnapTolerance(1.0, 0.8)).toBe(false);
  });

  it('returns true for exact match', () => {
    expect(isWithinSnapTolerance(1.0, 1.0)).toBe(true);
  });

  it('returns true at boundary (149ms)', () => {
    expect(isWithinSnapTolerance(1.0, 1.0 + 0.149)).toBe(true);
  });

  it('returns false at boundary (151ms)', () => {
    expect(isWithinSnapTolerance(1.0, 1.0 + 0.151)).toBe(false);
  });
});

describe('calculateBeatSnapForClips', () => {
  it('returns empty for empty beats', () => {
    const result = calculateBeatSnapForClips([makeClip('c1', 1, 2)], []);
    expect(result.snappedClipIds).toEqual([]);
    expect(result.suggestions).toEqual([]);
  });

  it('returns empty for empty clips', () => {
    const result = calculateBeatSnapForClips([], [0, 1, 2]);
    expect(result.snappedClipIds).toEqual([]);
    expect(result.suggestions).toEqual([]);
  });

  it('auto-snaps when within 150ms tolerance', () => {
    const beats = [0, 1, 2, 3];
    const clip = makeClip('c1', 0.95, 2); // start is 50ms from beat at 1
    const result = calculateBeatSnapForClips([clip], beats);
    expect(result.snappedClipIds).toContain('c1');
  });

  it('generates suggestion when near beat but outside tolerance', () => {
    const beats = [0, 1, 2, 3];
    const clip = makeClip('c1', 0.7, 2); // start is 300ms from beat at 1, end at 2.7
    const result = calculateBeatSnapForClips([clip], beats);
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  it('handles 3 clips: 2 auto-snap, 1 suggestion', () => {
    const beats = [0, 1, 2, 3, 4, 5];
    const clips = [
      makeClip('c1', 0.0, 1), // in=0 exact, out=1 exact → snap
      makeClip('c2', 1.0, 1), // in=1 exact, out=2 exact → snap
      makeClip('c3', 2.3, 1) // in=2.3 (300ms from beat 2), out=3.3 (300ms from beat 3) → suggestion
    ];
    const result = calculateBeatSnapForClips(clips, beats);
    expect(result.snappedClipIds).toContain('c1');
    expect(result.snappedClipIds).toContain('c2');
    expect(result.snappedClipIds).not.toContain('c3');
    expect(result.suggestions.some((s) => s.clipId === 'c3')).toBe(true);
  });
});

describe('applyBeatSnapToClip', () => {
  it('adjusts start time for in-edge', () => {
    const clip = makeClip('c1', 1.0, 2);
    const result = applyBeatSnapToClip(clip, 'in', 1.5);
    expect(result.start).toBe(1.5);
    expect(result.duration).toBe(1.5);
    expect(result.beatSnapped).toBe(true);
  });

  it('adjusts duration for out-edge', () => {
    const clip = makeClip('c1', 1.0, 2);
    const result = applyBeatSnapToClip(clip, 'out', 3.5);
    expect(result.duration).toBe(2.5);
    expect(result.beatSnapped).toBe(true);
  });
});

describe('removeSuggestion', () => {
  it('removes matching suggestion', () => {
    const suggestions: BeatSnapSuggestion[] = [
      { clipId: 'c1', edge: 'in', suggestedTime: 1.5, originalTime: 1.0 },
      { clipId: 'c2', edge: 'out', suggestedTime: 3.0, originalTime: 2.8 }
    ];
    const result = removeSuggestion(suggestions, 'c1', 'in');
    expect(result).toHaveLength(1);
    expect(result[0].clipId).toBe('c2');
  });

  it('returns same array when no match', () => {
    const suggestions: BeatSnapSuggestion[] = [
      { clipId: 'c1', edge: 'in', suggestedTime: 1.5, originalTime: 1.0 }
    ];
    const result = removeSuggestion(suggestions, 'c2', 'out');
    expect(result).toHaveLength(1);
  });
});

import { describe, expect, it } from 'vitest';
import {
  detectTrackGaps,
  computeTimelineGaps,
  getGapStats,
  navigateGap,
  type TrackGap
} from '../src';
import { makeTimeline, makeVideoClip } from './test-utils';

describe('timeline gaps', () => {
  describe('detectTrackGaps', () => {
    it('detects gaps between clips', () => {
      const track = {
        id: 'track-1',
        type: 'video' as const,
        name: 'V1',
        clips: [
          makeVideoClip({ id: 'c1', trackId: 'track-1', start: 0, duration: 2 }),
          makeVideoClip({ id: 'c2', trackId: 'track-1', start: 5, duration: 2 }),
        ],
      };
      const gaps = detectTrackGaps(track);
      expect(gaps).toHaveLength(1);
      expect(gaps[0]).toMatchObject({ trackId: 'track-1', start: 2, end: 5, duration: 3 });
    });

    it('returns empty for contiguous clips (adjacent, no gap)', () => {
      const track = {
        id: 'track-1',
        type: 'video' as const,
        name: 'V1',
        clips: [
          makeVideoClip({ id: 'c1', trackId: 'track-1', start: 0, duration: 2 }),
          makeVideoClip({ id: 'c2', trackId: 'track-1', start: 2, duration: 3 }),
        ],
      };
      expect(detectTrackGaps(track)).toHaveLength(0);
    });

    it('ignores leading space before first clip (open interval)', () => {
      const track = {
        id: 'track-1',
        type: 'video' as const,
        name: 'V1',
        clips: [
          makeVideoClip({ id: 'c1', trackId: 'track-1', start: 5, duration: 2 }),
        ],
      };
      expect(detectTrackGaps(track)).toHaveLength(0);
    });

    it('ignores trailing space after last clip (open interval)', () => {
      const track = {
        id: 'track-1',
        type: 'video' as const,
        name: 'V1',
        clips: [
          makeVideoClip({ id: 'c1', trackId: 'track-1', start: 0, duration: 2 }),
        ],
      };
      expect(detectTrackGaps(track)).toHaveLength(0);
    });

    it('returns empty for empty track', () => {
      const track = { id: 'track-1', type: 'video' as const, name: 'V1', clips: [] };
      expect(detectTrackGaps(track)).toHaveLength(0);
    });

    it('filters gaps smaller than minDuration', () => {
      const track = {
        id: 'track-1',
        type: 'video' as const,
        name: 'V1',
        clips: [
          makeVideoClip({ id: 'c1', trackId: 'track-1', start: 0, duration: 2 }),
          makeVideoClip({ id: 'c2', trackId: 'track-1', start: 2.01, duration: 3 }),
          makeVideoClip({ id: 'c3', trackId: 'track-1', start: 8, duration: 2 }),
        ],
      };
      const allGaps = detectTrackGaps(track);
      const filteredGaps = detectTrackGaps(track, { minDuration: 0.5 });
      expect(allGaps.length).toBeGreaterThanOrEqual(1);
      expect(filteredGaps).toHaveLength(1);
    });

    it('handles unsorted clips correctly', () => {
      const track = {
        id: 'track-1',
        type: 'video' as const,
        name: 'V1',
        clips: [
          makeVideoClip({ id: 'c2', trackId: 'track-1', start: 5, duration: 2 }),
          makeVideoClip({ id: 'c1', trackId: 'track-1', start: 0, duration: 2 }),
        ],
      };
      const gaps = detectTrackGaps(track);
      expect(gaps).toHaveLength(1);
      expect(gaps[0]).toMatchObject({ start: 2, end: 5, duration: 3 });
    });

    it('detects multiple gaps', () => {
      const track = {
        id: 'track-1',
        type: 'video' as const,
        name: 'V1',
        clips: [
          makeVideoClip({ id: 'c1', trackId: 'track-1', start: 0, duration: 1 }),
          makeVideoClip({ id: 'c2', trackId: 'track-1', start: 3, duration: 1 }),
          makeVideoClip({ id: 'c3', trackId: 'track-1', start: 7, duration: 1 }),
        ],
      };
      const gaps = detectTrackGaps(track);
      expect(gaps).toHaveLength(2);
      expect(gaps[0]).toMatchObject({ start: 1, end: 3, duration: 2 });
      expect(gaps[1]).toMatchObject({ start: 4, end: 7, duration: 3 });
    });
  });

  describe('computeTimelineGaps', () => {
    it('collects gaps from all tracks', () => {
      const timeline = makeTimeline([
        makeVideoClip({ id: 'c1', trackId: 'track-video', start: 0, duration: 2 }),
        makeVideoClip({ id: 'c2', trackId: 'track-video', start: 5, duration: 2 }),
      ]);
      const gaps = computeTimelineGaps(timeline);
      expect(gaps.length).toBeGreaterThanOrEqual(1);
      expect(gaps.some((g) => g.trackId === 'track-video')).toBe(true);
    });
  });

  describe('getGapStats', () => {
    it('returns zero stats for empty gaps', () => {
      const stats = getGapStats([]);
      expect(stats.totalCount).toBe(0);
      expect(stats.totalDuration).toBe(0);
      expect(stats.maxGap).toBeUndefined();
      expect(stats.minGap).toBeUndefined();
      expect(stats.byTrack).toEqual({});
    });

    it('computes total duration, max and min', () => {
      const gaps: TrackGap[] = [
        { trackId: 't1', start: 2, end: 5, duration: 3 },
        { trackId: 't1', start: 8, end: 9, duration: 1 },
        { trackId: 't2', start: 0, end: 4, duration: 4 },
      ];
      const stats = getGapStats(gaps);
      expect(stats.totalCount).toBe(3);
      expect(stats.totalDuration).toBeCloseTo(8, 5);
      expect(stats.maxGap).toMatchObject({ duration: 4, trackId: 't2' });
      expect(stats.minGap).toMatchObject({ duration: 1, trackId: 't1' });
    });

    it('groups by track', () => {
      const gaps: TrackGap[] = [
        { trackId: 't1', start: 2, end: 5, duration: 3 },
        { trackId: 't1', start: 8, end: 9, duration: 1 },
        { trackId: 't2', start: 0, end: 4, duration: 4 },
      ];
      const stats = getGapStats(gaps);
      expect(stats.byTrack['t1']).toEqual({ count: 2, totalDuration: 4 });
      expect(stats.byTrack['t2']).toEqual({ count: 1, totalDuration: 4 });
    });
  });

  describe('navigateGap', () => {
    const gaps: TrackGap[] = [
      { trackId: 't1', start: 2, end: 5, duration: 3 },
      { trackId: 't1', start: 8, end: 10, duration: 2 },
      { trackId: 't2', start: 15, end: 20, duration: 5 },
    ];

    it('navigates to next gap from current time', () => {
      const next = navigateGap(gaps, 0, 1);
      expect(next).toMatchObject({ start: 2 });
    });

    it('navigates to next gap after current', () => {
      const next = navigateGap(gaps, 3, 1);
      expect(next).toMatchObject({ start: 8 });
    });

    it('wraps to first gap when past all gaps (next)', () => {
      const next = navigateGap(gaps, 25, 1);
      expect(next).toMatchObject({ start: 2 });
    });

    it('navigates to previous gap', () => {
      const prev = navigateGap(gaps, 12, -1);
      expect(prev).toMatchObject({ start: 8 });
    });

    it('wraps to last gap when before all gaps (previous)', () => {
      const prev = navigateGap(gaps, 0, -1);
      expect(prev).toMatchObject({ start: 15 });
    });

    it('returns undefined for empty gaps', () => {
      expect(navigateGap([], 0, 1)).toBeUndefined();
      expect(navigateGap([], 0, -1)).toBeUndefined();
    });

    it('handles single gap correctly', () => {
      const single = [{ trackId: 't1', start: 5, end: 10, duration: 5 }];
      expect(navigateGap(single, 0, 1)).toMatchObject({ start: 5 });
      expect(navigateGap(single, 20, 1)).toMatchObject({ start: 5 });
      expect(navigateGap(single, 20, -1)).toMatchObject({ start: 5 });
      expect(navigateGap(single, 0, -1)).toMatchObject({ start: 5 });
    });
  });
});

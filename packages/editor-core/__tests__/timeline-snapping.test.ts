import { describe, expect, it } from 'vitest';
import { findTimelineSnapTarget, snapCandidatePriority, snapCandidateKindLabel, type SnapCandidateKind } from '../src';

describe('timeline snapping', () => {
  it('snaps a clip start to the nearest candidate inside the pixel threshold', () => {
    const target = findTimelineSnapTarget({
      clipStart: 1.92,
      clipDuration: 1,
      candidates: [{ time: 2, kind: 'clip-start', clipId: 'neighbor' }],
      pixelsPerSecond: 100,
      thresholdPx: 8
    });

    expect(target).toMatchObject({
      edge: 'start',
      snappedStart: 2,
      delta: 0.08,
      candidate: { time: 2, kind: 'clip-start', clipId: 'neighbor' }
    });
  });

  it('snaps a clip end by moving the start by the same delta', () => {
    const target = findTimelineSnapTarget({
      clipStart: 1.02,
      clipDuration: 1,
      candidates: [{ time: 2, kind: 'clip-end' }],
      pixelsPerSecond: 100,
      thresholdPx: 8
    });

    expect(target).toMatchObject({
      edge: 'end',
      snappedStart: 1,
      delta: -0.02,
      candidate: { time: 2, kind: 'clip-end' }
    });
  });

  it('returns null when every candidate is outside the threshold', () => {
    expect(
      findTimelineSnapTarget({
        clipStart: 1.89,
        clipDuration: 1,
        candidates: [2],
        pixelsPerSecond: 100,
        thresholdPx: 8
      })
    ).toBeNull();
  });

  it('can restrict snapping to a single edge for trimming', () => {
    const target = findTimelineSnapTarget({
      clipStart: 3.95,
      clipDuration: 1.5,
      candidates: [{ time: 4, kind: 'playhead' }],
      pixelsPerSecond: 120,
      thresholdPx: 8,
      edges: ['start']
    });

    expect(target).toMatchObject({ edge: 'start', snappedStart: 4, candidate: { time: 4, kind: 'playhead' } });
  });

  it('snaps clip edges to timeline marker candidates', () => {
    const target = findTimelineSnapTarget({
      clipStart: 2.45,
      clipDuration: 1,
      candidates: [{ time: 2.5, kind: 'marker' }],
      pixelsPerSecond: 100,
      thresholdPx: 8,
      edges: ['start']
    });

    expect(target).toMatchObject({ edge: 'start', snappedStart: 2.5, candidate: { time: 2.5, kind: 'marker' } });
  });

  it('keeps beat snap candidates ahead of clip edges when distances match', () => {
    const target = findTimelineSnapTarget({
      clipStart: 2.45,
      clipDuration: 1,
      candidates: [
        { time: 2.4, kind: 'clip-end', clipId: 'neighbor' },
        { time: 2.5, kind: 'beat' }
      ],
      pixelsPerSecond: 100,
      thresholdPx: 8,
      edges: ['start']
    });

    expect(target).toMatchObject({ edge: 'start', snappedStart: 2.5, candidate: { time: 2.5, kind: 'beat' } });
  });

  it('respects disabled snapping, matching the Alt-drag behavior', () => {
    expect(
      findTimelineSnapTarget({
        clipStart: 0.04,
        clipDuration: 1,
        candidates: [{ time: 0, kind: 'timeline-start' }],
        pixelsPerSecond: 200,
        disabled: true
      })
    ).toBeNull();
  });

  describe('snap candidate priority hierarchy', () => {
    const orderedKinds: Array<{ kind: SnapCandidateKind; priority: number; label: string }> = [
      { kind: 'beat', priority: 5, label: '节拍' },
      { kind: 'marker', priority: 4, label: '标记点' },
      { kind: 'grid', priority: 3, label: '网格' },
      { kind: 'playhead', priority: 2, label: '播放头' },
      { kind: 'timeline-start', priority: 2, label: '时间线起点' },
      { kind: 'clip-start', priority: 1, label: 'clip起点' },
      { kind: 'clip-end', priority: 1, label: 'clip终点' },
    ];

    it('returns correct priority for each kind', () => {
      for (const { kind, priority } of orderedKinds) {
        expect(snapCandidatePriority({ time: 0, kind })).toBe(priority);
      }
    });

    it('returns correct label for each kind', () => {
      for (const { kind, label } of orderedKinds) {
        expect(snapCandidateKindLabel(kind)).toBe(label);
      }
    });

    it('unknown kind defaults to priority 0', () => {
      expect(snapCandidatePriority({ time: 0 })).toBe(0);
      expect(snapCandidateKindLabel(undefined)).toBe('吸附');
    });

    it('beat beats marker at equal distance', () => {
      const target = findTimelineSnapTarget({
        clipStart: 2.45, clipDuration: 1,
        candidates: [
          { time: 2.5, kind: 'marker' },
          { time: 2.5, kind: 'beat' },
        ],
        pixelsPerSecond: 100, thresholdPx: 8, edges: ['start'],
      });
      expect(target?.candidate.kind).toBe('beat');
    });

    it('marker beats grid at equal distance', () => {
      const target = findTimelineSnapTarget({
        clipStart: 2.45, clipDuration: 1,
        candidates: [
          { time: 2.5, kind: 'grid' },
          { time: 2.5, kind: 'marker' },
        ],
        pixelsPerSecond: 100, thresholdPx: 8, edges: ['start'],
      });
      expect(target?.candidate.kind).toBe('marker');
    });

    it('grid beats playhead at equal distance', () => {
      const target = findTimelineSnapTarget({
        clipStart: 2.45, clipDuration: 1,
        candidates: [
          { time: 2.5, kind: 'playhead' },
          { time: 2.5, kind: 'grid' },
        ],
        pixelsPerSecond: 100, thresholdPx: 8, edges: ['start'],
      });
      expect(target?.candidate.kind).toBe('grid');
    });

    it('playhead beats clip-start at equal distance', () => {
      const target = findTimelineSnapTarget({
        clipStart: 2.45, clipDuration: 1,
        candidates: [
          { time: 2.5, kind: 'clip-start', clipId: 'a' },
          { time: 2.5, kind: 'playhead' },
        ],
        pixelsPerSecond: 100, thresholdPx: 8, edges: ['start'],
      });
      expect(target?.candidate.kind).toBe('playhead');
    });

    it('clip-start and clip-end have equal priority', () => {
      const target = findTimelineSnapTarget({
        clipStart: 2.45, clipDuration: 1,
        candidates: [
          { time: 2.5, kind: 'clip-end', clipId: 'a' },
          { time: 2.5, kind: 'clip-start', clipId: 'b' },
        ],
        pixelsPerSecond: 100, thresholdPx: 8, edges: ['start'],
      });
      expect(target).not.toBeNull();
      expect([1, 1]).toContain(snapCandidatePriority(target!.candidate));
    });

    it('closer distance always wins regardless of priority', () => {
      const target = findTimelineSnapTarget({
        clipStart: 2.48, clipDuration: 1,
        candidates: [
          { time: 2.5, kind: 'beat' },
          { time: 2.49, kind: 'clip-start', clipId: 'a' },
        ],
        pixelsPerSecond: 100, thresholdPx: 8, edges: ['start'],
      });
      expect(target?.candidate.kind).toBe('clip-start');
    });
  });
});

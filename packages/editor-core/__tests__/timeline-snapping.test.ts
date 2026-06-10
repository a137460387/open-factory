import { describe, expect, it } from 'vitest';
import { findTimelineSnapTarget } from '../src';

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
});

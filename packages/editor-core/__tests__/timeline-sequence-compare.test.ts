import { describe, expect, it, vi } from 'vitest';
import {
  createSequenceCompareLayout,
  normalizeSplitRatio,
  findSyncMarkerPairs,
  buildCrossSequenceDragPlan,
  serializeSequenceCompareLayout,
  deserializeSequenceCompareLayout,
  areSequencesIndependent,
  collectTimelineMarkers,
  createId,
  createTrack,
  type SequenceCompareLayout,
  type SyncMarkerPair,
  type Clip,
  type Sequence,
  type TimelineMarker,
  type VideoClip,
} from '../src';

function makeVideoClip(overrides: Partial<VideoClip> = {}): VideoClip {
  return {
    id: overrides.id ?? createId('clip'),
    type: 'video',
    name: overrides.name ?? 'clip',
    trackId: overrides.trackId ?? 'track-1',
    start: overrides.start ?? 0,
    duration: overrides.duration ?? 10,
    trimStart: 0,
    trimEnd: 0,
    speed: 1,
    mediaId: 'asset-1',
    volume: 1,
    transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
    colorCorrection: { brightness: 0, contrast: 1, saturation: 1, hue: 0 },
  };
}

function makeMarker(id: string, label: string, time: number): TimelineMarker {
  return { id, label, time, color: '#f97316' };
}

function makeSequence(id: string, name: string, clipIds: string[]): Sequence {
  return {
    id,
    name,
    timeline: {
      tracks: [
        createTrack({
          id: `${id}-track`,
          type: 'video',
          name: 'Video',
          clips: clipIds.map((cid) => makeVideoClip({ id: cid, trackId: `${id}-track` })),
        }),
      ],
    },
  };
}

describe('createSequenceCompareLayout', () => {
  it('creates layout with given ids', () => {
    const layout = createSequenceCompareLayout('seq-a', 'seq-b');
    expect(layout.leftSequenceId).toBe('seq-a');
    expect(layout.rightSequenceId).toBe('seq-b');
    expect(layout.splitRatio).toBe(0.5);
    expect(layout.syncMarkersEnabled).toBe(false);
  });

  it('applies overrides', () => {
    const layout = createSequenceCompareLayout('a', 'b', { splitRatio: 0.7, syncMarkersEnabled: true });
    expect(layout.splitRatio).toBe(0.7);
    expect(layout.syncMarkersEnabled).toBe(true);
  });
});

describe('normalizeSplitRatio', () => {
  it('returns 0.5 for non-finite values', () => {
    expect(normalizeSplitRatio(NaN)).toBe(0.5);
    expect(normalizeSplitRatio(undefined)).toBe(0.5);
  });

  it('clamps to [0.2, 0.8]', () => {
    expect(normalizeSplitRatio(0.1)).toBe(0.2);
    expect(normalizeSplitRatio(0.9)).toBe(0.8);
    expect(normalizeSplitRatio(0.5)).toBe(0.5);
  });
});

describe('findSyncMarkerPairs', () => {
  it('matches markers by label (case-insensitive)', () => {
    const left = [makeMarker('l1', 'Intro', 0), makeMarker('l2', 'Outro', 60)];
    const right = [makeMarker('r1', 'intro', 5), makeMarker('r2', 'OUTRO', 65)];
    const pairs = findSyncMarkerPairs(left, right);
    expect(pairs).toHaveLength(2);
    expect(pairs[0].label).toBe('Intro');
    expect(pairs[0].leftTime).toBe(0);
    expect(pairs[0].rightTime).toBe(5);
  });

  it('returns empty when no labels match', () => {
    const left = [makeMarker('l1', 'A', 0)];
    const right = [makeMarker('r1', 'B', 0)];
    expect(findSyncMarkerPairs(left, right)).toHaveLength(0);
  });

  it('ignores markers with empty labels', () => {
    const left = [makeMarker('l1', '', 0)];
    const right = [makeMarker('r1', '', 0)];
    expect(findSyncMarkerPairs(left, right)).toHaveLength(0);
  });

  it('does not reuse right markers', () => {
    const left = [makeMarker('l1', 'X', 0), makeMarker('l2', 'X', 10)];
    const right = [makeMarker('r1', 'X', 5)];
    const pairs = findSyncMarkerPairs(left, right);
    expect(pairs).toHaveLength(1);
  });
});

describe('buildCrossSequenceDragPlan', () => {
  it('creates add clip with new id and target track', () => {
    const sourceClip = makeVideoClip({ id: 'src-clip', trackId: 'track-a', start: 5, duration: 8 });
    const plan = buildCrossSequenceDragPlan(sourceClip, 'track-a', 'track-b', 15, 100);
    expect(plan.addClip.id).not.toBe('src-clip');
    expect(plan.addClip.trackId).toBe('track-b');
    expect(plan.addClip.start).toBe(15);
    expect(plan.addClip.duration).toBe(8);
    expect(plan.removeClipId).toBe('src-clip');
    expect(plan.sourceTrackId).toBe('track-a');
    expect(plan.targetTrackId).toBe('track-b');
  });

  it('clamps insert time to [0, targetDuration]', () => {
    const sourceClip = makeVideoClip();
    const plan1 = buildCrossSequenceDragPlan(sourceClip, 'a', 'b', -5, 100);
    expect(plan1.addClip.start).toBe(0);
    const plan2 = buildCrossSequenceDragPlan(sourceClip, 'a', 'b', 200, 100);
    expect(plan2.addClip.start).toBe(100);
  });
});

describe('serialize/deserializeSequenceCompareLayout', () => {
  it('round-trips layout', () => {
    const layout = createSequenceCompareLayout('a', 'b', { splitRatio: 0.6, syncMarkersEnabled: true });
    const json = serializeSequenceCompareLayout(layout);
    const restored = deserializeSequenceCompareLayout(json);
    expect(restored).toBeDefined();
    expect(restored!.leftSequenceId).toBe('a');
    expect(restored!.splitRatio).toBe(0.6);
    expect(restored!.syncMarkersEnabled).toBe(true);
  });

  it('returns undefined for null input', () => {
    expect(deserializeSequenceCompareLayout(null)).toBeUndefined();
  });

  it('returns undefined for invalid JSON', () => {
    expect(deserializeSequenceCompareLayout('not json')).toBeUndefined();
  });

  it('returns undefined for missing required fields', () => {
    expect(deserializeSequenceCompareLayout('{}')).toBeUndefined();
  });
});

describe('areSequencesIndependent', () => {
  it('returns false for same sequence id', () => {
    const seq = makeSequence('a', 'A', ['c1']);
    expect(areSequencesIndependent(seq, seq)).toBe(false);
  });

  it('returns true when no clip ids overlap', () => {
    const a = makeSequence('a', 'A', ['c1', 'c2']);
    const b = makeSequence('b', 'B', ['c3', 'c4']);
    expect(areSequencesIndependent(a, b)).toBe(true);
  });

  it('returns false when clips overlap', () => {
    const a = makeSequence('a', 'A', ['c1', 'shared']);
    const b = makeSequence('b', 'B', ['shared', 'c4']);
    expect(areSequencesIndependent(a, b)).toBe(false);
  });
});

describe('collectTimelineMarkers', () => {
  it('returns markers array or empty', () => {
    expect(collectTimelineMarkers({})).toEqual([]);
    expect(collectTimelineMarkers({ markers: [makeMarker('m1', 'X', 0)] })).toHaveLength(1);
  });
});

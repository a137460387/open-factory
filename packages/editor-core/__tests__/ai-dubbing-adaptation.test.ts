import { describe, it, expect } from 'vitest';
import {
  computeTimingAdaptation,
  hasOutpointConflict,
  batchComputeAdaptations,
  getSegmentsNeedingAdaptation,
  DURATION_DELTA_THRESHOLD,
  ATEMPO_MIN,
  ATEMPO_MAX,
} from '../src/ai-dubbing-adaptation';
import type { TtsSegment, Project } from '../src/model-types';

describe('computeTimingAdaptation', () => {
  it('returns none when delta is within 15% threshold', () => {
    const result = computeTimingAdaptation(10, 11); // 10% delta
    expect(result.adaptationType).toBe('none');
    expect(result.atempoRatio).toBeNull();
    expect(result.suggestedOutPoint).toBeNull();
  });

  it('returns none when delta equals exactly 15%', () => {
    const result = computeTimingAdaptation(10, 11.5); // 15% delta
    expect(result.adaptationType).toBe('none');
  });

  it('returns none when delta is negative within threshold', () => {
    const result = computeTimingAdaptation(10, 9); // 10% delta
    expect(result.adaptationType).toBe('none');
  });

  it('returns compress when dubbed is >15% longer', () => {
    const result = computeTimingAdaptation(10, 13); // 30% delta
    expect(result.adaptationType).toBe('compress');
    expect(result.durationDelta).toBeCloseTo(3);
    expect(result.atempoRatio).toBeCloseTo(10 / 13);
    expect(result.atempoRatio!).toBeGreaterThanOrEqual(ATEMPO_MIN);
    expect(result.atempoRatio!).toBeLessThanOrEqual(ATEMPO_MAX);
  });

  it('clamps atempo ratio to ATEMPO_MIN (0.75) when extreme compression needed', () => {
    // dubbedDuration = 20, original = 10 → raw atempo = 0.5 → clamped to 0.75
    const result = computeTimingAdaptation(10, 20);
    expect(result.adaptationType).toBe('compress');
    expect(result.atempoRatio).toBe(ATEMPO_MIN);
  });

  it('clamps atempo ratio to ATEMPO_MAX (1.0) when barely over threshold', () => {
    // dubbedDuration = 12, original = 10 → raw atempo = 10/12 ≈ 0.833
    const result = computeTimingAdaptation(10, 12);
    expect(result.adaptationType).toBe('compress');
    expect(result.atempoRatio).toBeCloseTo(10 / 12);
    expect(result.atempoRatio!).toBeLessThanOrEqual(ATEMPO_MAX);
  });

  it('returns pad when dubbed is >15% shorter', () => {
    const result = computeTimingAdaptation(10, 7); // 30% delta
    expect(result.adaptationType).toBe('pad');
    expect(result.durationDelta).toBeCloseTo(-3);
    expect(result.atempoRatio).toBeNull();
  });

  it('returns none for zero originalDuration', () => {
    const result = computeTimingAdaptation(0, 5);
    expect(result.adaptationType).toBe('none');
  });

  it('returns none for negative originalDuration', () => {
    const result = computeTimingAdaptation(-1, 5);
    expect(result.adaptationType).toBe('none');
  });

  it('detects outpoint conflict when next segment starts before suggested outpoint', () => {
    const result = computeTimingAdaptation(10, 20, 15);
    expect(result.adaptationType).toBe('compress');
    // suggestedOutPoint would be 20 but next starts at 15 → conflict
    if (result.suggestedOutPoint !== null) {
      expect(hasOutpointConflict(result.suggestedOutPoint, 15)).toBe(true);
    }
  });

  it('no conflict when next segment starts after suggested outpoint', () => {
    expect(hasOutpointConflict(12, 15)).toBe(false);
  });

  it('no conflict when next segment starts exactly at suggested outpoint', () => {
    expect(hasOutpointConflict(15, 15)).toBe(false);
  });
});

describe('batchComputeAdaptations', () => {
  it('returns empty array for empty input', () => {
    expect(batchComputeAdaptations([])).toEqual([]);
  });

  it('computes adaptation for each segment', () => {
    const segments: TtsSegment[] = [
      { id: 's1', subtitleClipId: 'c1', originalDuration: 10, dubbedDuration: 13 },
      { id: 's2', subtitleClipId: 'c2', originalDuration: 5, dubbedDuration: 3 },
    ];
    const result = batchComputeAdaptations(segments);
    expect(result).toHaveLength(2);
    expect(result[0].timingAdaptation!.adaptationType).toBe('compress');
    expect(result[1].timingAdaptation!.adaptationType).toBe('pad');
  });

  it('does not mutate original segments', () => {
    const seg: TtsSegment = { id: 's1', subtitleClipId: 'c1', originalDuration: 10, dubbedDuration: 13 };
    const result = batchComputeAdaptations([seg]);
    expect(seg.timingAdaptation).toBeUndefined();
    expect(result[0].timingAdaptation).toBeDefined();
  });
});

  it('computes adaptation for next segment with dubbedDuration > originalDuration', () => {
    const segments: TtsSegment[] = [
      { id: 's1', subtitleClipId: 'c1', originalDuration: 10, dubbedDuration: 13 },
      { id: 's2', subtitleClipId: 'c2', originalDuration: 5, dubbedDuration: 8 },
    ];
    const result = batchComputeAdaptations(segments);
    expect(result).toHaveLength(2);
    expect(result[0].timingAdaptation!.adaptationType).toBe('compress');
    expect(result[1].timingAdaptation!.adaptationType).toBe('compress');
  });

describe('getSegmentsNeedingAdaptation', () => {
  it('returns empty when project has no ttsSegments', () => {
    const project = { ttsSegments: [] } as unknown as Project;
    expect(getSegmentsNeedingAdaptation(project)).toEqual([]);
  });

  it('returns empty when ttsSegments is undefined', () => {
    const project = {} as unknown as Project;
    expect(getSegmentsNeedingAdaptation(project)).toEqual([]);
  });

  it('filters only segments with non-none adaptation', () => {
    const project = {
      ttsSegments: [
        { id: 's1', subtitleClipId: 'c1', originalDuration: 10, dubbedDuration: 13, timingAdaptation: { durationDelta: 3, adaptationType: 'compress', atempoRatio: 0.77, suggestedOutPoint: null } },
        { id: 's2', subtitleClipId: 'c2', originalDuration: 5, dubbedDuration: 5.1, timingAdaptation: { durationDelta: 0.1, adaptationType: 'none', atempoRatio: null, suggestedOutPoint: null } },
      ],
    } as unknown as Project;
    const result = getSegmentsNeedingAdaptation(project);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('s1');
  });
});

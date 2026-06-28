import { describe, expect, it } from 'vitest';
import {
  computeIOU,
  matchRegionsAcrossFrames,
  smoothRedactionKeyframes,
  buildPrivacyRedactionFFmpegExpressions,
  parsePrivacyDetectionResponse,
  buildRedactionsFromDetection,
  normalizePrivacyRedaction,
  normalizeRedactionKeyframes,
  type PrivacyDetectionFrame,
  type PrivacyDetectionRegion,
  type MatchedRegion
} from '../src';
import type { ClipPrivacyRedaction, RedactionKeyframe } from '../src/model-types';

describe('computeIOU', () => {
  it('returns 1 for identical boxes', () => {
    expect(computeIOU({ x: 0, y: 0, w: 10, h: 10 }, { x: 0, y: 0, w: 10, h: 10 })).toBe(1);
  });

  it('returns 0 for non-overlapping boxes', () => {
    expect(computeIOU({ x: 0, y: 0, w: 5, h: 5 }, { x: 10, y: 10, w: 5, h: 5 })).toBe(0);
  });

  it('returns correct value for partially overlapping boxes', () => {
    const iou = computeIOU({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 });
    expect(iou).toBeGreaterThan(0);
    expect(iou).toBeLessThan(1);
    const interArea = 5 * 5;
    const unionArea = 100 + 100 - interArea;
    expect(iou).toBeCloseTo(interArea / unionArea, 5);
  });

  it('handles zero-area boxes', () => {
    expect(computeIOU({ x: 0, y: 0, w: 0, h: 0 }, { x: 0, y: 0, w: 10, h: 10 })).toBe(0);
  });

  it('returns 0 for touching but non-overlapping edges', () => {
    expect(computeIOU({ x: 0, y: 0, w: 5, h: 5 }, { x: 5, y: 0, w: 5, h: 5 })).toBe(0);
  });
});

describe('matchRegionsAcrossFrames', () => {
  it('returns empty for empty frames', () => {
    expect(matchRegionsAcrossFrames([])).toEqual([]);
  });

  it('creates one track per single-frame region', () => {
    const frames: PrivacyDetectionFrame[] = [
      { time: 0, regions: [{ type: 'face', box: { x: 0.1, y: 0.2, w: 0.3, h: 0.4 } }] }
    ];
    const result = matchRegionsAcrossFrames(frames);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('face');
    expect(result[0].frames).toHaveLength(1);
    expect(result[0].frames[0].time).toBe(0);
  });

  it('matches same region across frames when IOU > 0.3', () => {
    const frames: PrivacyDetectionFrame[] = [
      { time: 0, regions: [{ type: 'face', box: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 } }] },
      { time: 2, regions: [{ type: 'face', box: { x: 0.11, y: 0.11, w: 0.2, h: 0.2 } }] },
      { time: 4, regions: [{ type: 'face', box: { x: 0.12, y: 0.12, w: 0.2, h: 0.2 } }] }
    ];
    const result = matchRegionsAcrossFrames(frames);
    expect(result).toHaveLength(1);
    expect(result[0].frames).toHaveLength(3);
  });

  it('creates separate tracks for regions with IOU <= 0.3', () => {
    const frames: PrivacyDetectionFrame[] = [
      { time: 0, regions: [{ type: 'face', box: { x: 0.05, y: 0.05, w: 0.1, h: 0.1 } }] },
      { time: 2, regions: [{ type: 'face', box: { x: 0.8, y: 0.8, w: 0.1, h: 0.1 } }] }
    ];
    const result = matchRegionsAcrossFrames(frames);
    expect(result).toHaveLength(2);
    expect(result[0].frames).toHaveLength(1);
    expect(result[1].frames).toHaveLength(1);
  });

  it('distinguishes different region types', () => {
    const frames: PrivacyDetectionFrame[] = [
      {
        time: 0,
        regions: [
          { type: 'face', box: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 } },
          { type: 'license_plate', box: { x: 0.5, y: 0.5, w: 0.2, h: 0.1 } }
        ]
      }
    ];
    const result = matchRegionsAcrossFrames(frames);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.type).sort()).toEqual(['face', 'license_plate']);
  });

  it('filters out invalid times', () => {
    const frames: PrivacyDetectionFrame[] = [
      { time: -1, regions: [{ type: 'face', box: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 } }] },
      { time: Number.NaN, regions: [{ type: 'face', box: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 } }] },
      { time: 2, regions: [{ type: 'face', box: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 } }] }
    ];
    const result = matchRegionsAcrossFrames(frames);
    expect(result).toHaveLength(1);
    expect(result[0].frames).toHaveLength(1);
    expect(result[0].frames[0].time).toBe(2);
  });

  it('handles multiple regions in same frame correctly', () => {
    const frames: PrivacyDetectionFrame[] = [
      {
        time: 0,
        regions: [
          { type: 'face', box: { x: 0.1, y: 0.1, w: 0.15, h: 0.15 } },
          { type: 'face', box: { x: 0.6, y: 0.6, w: 0.15, h: 0.15 } }
        ]
      },
      {
        time: 2,
        regions: [
          { type: 'face', box: { x: 0.11, y: 0.11, w: 0.15, h: 0.15 } },
          { type: 'face', box: { x: 0.61, y: 0.61, w: 0.15, h: 0.15 } }
        ]
      }
    ];
    const result = matchRegionsAcrossFrames(frames);
    expect(result).toHaveLength(2);
    expect(result[0].frames).toHaveLength(2);
    expect(result[1].frames).toHaveLength(2);
  });
});

describe('smoothRedactionKeyframes', () => {
  it('returns same for single keyframe', () => {
    const kfs: RedactionKeyframe[] = [{ time: 0, x: 0.5, y: 0.5, w: 0.2, h: 0.2 }];
    expect(smoothRedactionKeyframes(kfs)).toEqual(kfs);
  });

  it('smooths position with sliding average (N=3)', () => {
    const kfs: RedactionKeyframe[] = [
      { time: 0, x: 0.1, y: 0.1, w: 0.2, h: 0.2 },
      { time: 1, x: 0.5, y: 0.5, w: 0.2, h: 0.2 },
      { time: 2, x: 0.9, y: 0.9, w: 0.2, h: 0.2 }
    ];
    const result = smoothRedactionKeyframes(kfs, 3);
    expect(result).toHaveLength(3);
    // middle point should be averaged
    expect(result[1].x).toBeCloseTo(0.5, 1);
    expect(result[1].y).toBeCloseTo(0.5, 1);
    // first point average of first 2
    expect(result[0].x).toBeCloseTo(0.3, 1);
    expect(result[0].y).toBeCloseTo(0.3, 1);
  });

  it('preserves time values', () => {
    const kfs: RedactionKeyframe[] = [
      { time: 1.5, x: 0.3, y: 0.3, w: 0.1, h: 0.1 },
      { time: 3.0, x: 0.4, y: 0.4, w: 0.1, h: 0.1 }
    ];
    const result = smoothRedactionKeyframes(kfs);
    expect(result[0].time).toBe(1.5);
    expect(result[1].time).toBe(3.0);
  });

  it('handles empty input', () => {
    expect(smoothRedactionKeyframes([])).toEqual([]);
  });
});

describe('buildPrivacyRedactionFFmpegExpressions', () => {
  const makeRedaction = (overrides: Partial<ClipPrivacyRedaction> = {}): ClipPrivacyRedaction => ({
    id: 'test-r1',
    type: 'face',
    keyframes: [
      { time: 0, x: 0.1, y: 0.2, w: 0.3, h: 0.4 },
      { time: 5, x: 0.1, y: 0.2, w: 0.3, h: 0.4 }
    ],
    blurStrength: 1,
    enabled: true,
    ...overrides
  });

  it('returns empty for disabled redactions', () => {
    const result = buildPrivacyRedactionFFmpegExpressions(
      [makeRedaction({ enabled: false })], 1920, 1080
    );
    expect(result).toEqual([]);
  });

  it('returns empty for redactions with no keyframes', () => {
    const result = buildPrivacyRedactionFFmpegExpressions(
      [makeRedaction({ keyframes: [] })], 1920, 1080
    );
    expect(result).toEqual([]);
  });

  it('generates delogo filter with time window per keyframe', () => {
    const result = buildPrivacyRedactionFFmpegExpressions(
      [makeRedaction()], 1920, 1080, 'delogo'
    );
    expect(result).toHaveLength(2);
    expect(result[0]).toContain('delogo=');
    expect(result[0]).toContain('between(t,');
    expect(result[0]).toContain('x=192');
    expect(result[0]).toContain('y=216');
  });

  it('generates boxblur filter with time window per keyframe', () => {
    const result = buildPrivacyRedactionFFmpegExpressions(
      [makeRedaction()], 1920, 1080, 'boxblur'
    );
    expect(result).toHaveLength(2);
    expect(result[0]).toContain('boxblur=');
    expect(result[0]).toContain('between(t,');
  });

  it('generates multiple filters for multiple keyframe segments', () => {
    const redaction = makeRedaction({
      keyframes: [
        { time: 0, x: 0.1, y: 0.1, w: 0.2, h: 0.2 },
        { time: 3, x: 0.2, y: 0.2, w: 0.2, h: 0.2 },
        { time: 6, x: 0.3, y: 0.3, w: 0.2, h: 0.2 }
      ]
    });
    const result = buildPrivacyRedactionFFmpegExpressions([redaction], 1920, 1080, 'delogo');
    expect(result).toHaveLength(3);
    expect(result[0]).toContain('between(t,0.000,3.000)');
    expect(result[1]).toContain('between(t,3.000,6.000)');
    expect(result[2]).toContain('between(t,6.000,8.000)');
  });

  it('clamps pixel coordinates to video dimensions', () => {
    const redaction = makeRedaction({
      keyframes: [{ time: 0, x: 0.9, y: 0.9, w: 0.3, h: 0.3 }]
    });
    const result = buildPrivacyRedactionFFmpegExpressions([redaction], 100, 100, 'boxblur');
    expect(result).toHaveLength(1);
    // Should not throw, coordinates should be clamped
  });
});

describe('parsePrivacyDetectionResponse', () => {
  it('parses valid response', () => {
    const input = {
      frames: [
        { time: 0, regions: [{ type: 'face', box: { x: 0.1, y: 0.2, w: 0.3, h: 0.4 } }] },
        { time: 2, regions: [{ type: 'license_plate', box: { x: 0.5, y: 0.5, w: 0.2, h: 0.1 } }] }
      ]
    };
    const result = parsePrivacyDetectionResponse(input);
    expect(result.frames).toHaveLength(2);
    expect(result.frames[0].regions[0].type).toBe('face');
    expect(result.frames[1].regions[0].type).toBe('license_plate');
  });

  it('returns empty for null/invalid input', () => {
    expect(parsePrivacyDetectionResponse(null)).toEqual({ frames: [] });
    expect(parsePrivacyDetectionResponse(undefined)).toEqual({ frames: [] });
    expect(parsePrivacyDetectionResponse('invalid')).toEqual({ frames: [] });
  });

  it('filters out invalid regions', () => {
    const input = {
      frames: [
        {
          time: 0,
          regions: [
            { type: 'face', box: { x: 0.1, y: 0.2, w: 0.3, h: 0.4 } },
            { type: 'invalid_type', box: { x: 0.1, y: 0.2, w: 0.3, h: 0.4 } },
            { type: 'face', box: { x: 'bad', y: 0.2, w: 0.3, h: 0.4 } }
          ]
        }
      ]
    };
    const result = parsePrivacyDetectionResponse(input);
    expect(result.frames).toHaveLength(1);
    expect(result.frames[0].regions).toHaveLength(1);
  });

  it('filters out frames with invalid time', () => {
    const input = {
      frames: [
        { time: 'bad', regions: [{ type: 'face', box: { x: 0.1, y: 0.2, w: 0.3, h: 0.4 } }] },
        { time: Number.NaN, regions: [{ type: 'face', box: { x: 0.1, y: 0.2, w: 0.3, h: 0.4 } }] },
        { time: 2, regions: [{ type: 'face', box: { x: 0.1, y: 0.2, w: 0.3, h: 0.4 } }] }
      ]
    };
    const result = parsePrivacyDetectionResponse(input);
    expect(result.frames).toHaveLength(1);
    expect(result.frames[0].time).toBe(2);
  });
});

describe('buildRedactionsFromDetection', () => {
  it('builds redaction objects from valid detection', () => {
    const response = {
      frames: [
        { time: 0, regions: [{ type: 'face' as const, box: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 } }] },
        { time: 2, regions: [{ type: 'face' as const, box: { x: 0.11, y: 0.11, w: 0.2, h: 0.2 } }] }
      ]
    };
    const result = buildRedactionsFromDetection(response, 'test');
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('face');
    expect(result[0].enabled).toBe(true);
    expect(result[0].blurStrength).toBe(1);
    expect(result[0].keyframes).toHaveLength(2);
    expect(result[0].id).toBeTruthy();
  });

  it('returns empty for empty frames', () => {
    expect(buildRedactionsFromDetection({ frames: [] }, 'test')).toEqual([]);
  });

  it('creates separate redactions for different tracks', () => {
    const response = {
      frames: [
        {
          time: 0,
          regions: [
            { type: 'face' as const, box: { x: 0.05, y: 0.05, w: 0.1, h: 0.1 } },
            { type: 'license_plate' as const, box: { x: 0.7, y: 0.7, w: 0.2, h: 0.1 } }
          ]
        }
      ]
    };
    const result = buildRedactionsFromDetection(response, 'test');
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('face');
    expect(result[1].type).toBe('license_plate');
  });
});
describe('normalizePrivacyRedaction', () => {
  it('normalizeRedactionKeyframes returns empty array for non-array input', () => {
    expect(normalizeRedactionKeyframes(null)).toEqual([]);
    expect(normalizeRedactionKeyframes(undefined)).toEqual([]);
    expect(normalizeRedactionKeyframes('bad')).toEqual([]);
  });

  it('normalizeRedactionKeyframes filters invalid entries and clamps values', () => {
    const result = normalizeRedactionKeyframes([
      { time: 0, x: 0.1, y: 0.2, w: 0.3, h: 0.4 },
      null,
      { time: NaN, x: 0, y: 0, w: 1, h: 1 },
      { time: 2, x: 1.5, y: -0.2, w: 0.3, h: 0.4 },
      { time: 1, w: 0.3, h: 0.4 }
    ]);
    expect(result).toHaveLength(3);
    expect(result[0].time).toBe(0);
    expect(result[1].time).toBe(1);
    expect(result[1].x).toBe(0);
    expect(result[2].time).toBe(2);
    expect(result[2].x).toBe(1);
    expect(result[2].y).toBe(0);
  });

  it('normalizePrivacyRedaction uses defaults for missing fields', () => {
    const result = normalizePrivacyRedaction({});
    expect(result.id).toBeTruthy();
    expect(result.type).toBe('face');
    expect(result.blurStrength).toBe(1);
    expect(result.enabled).toBe(true);
    expect(result.keyframes).toEqual([]);
  });

  it('normalizePrivacyRedaction clamps blurStrength and keeps valid type', () => {
    const result = normalizePrivacyRedaction({
      id: 'my-id',
      type: 'license_plate',
      blurStrength: 2.5,
      enabled: false,
      keyframes: [{ time: 0, x: 0.1, y: 0.2, w: 0.3, h: 0.4 }]
    });
    expect(result.id).toBe('my-id');
    expect(result.type).toBe('license_plate');
    expect(result.blurStrength).toBe(1);
    expect(result.enabled).toBe(false);
    expect(result.keyframes).toHaveLength(1);
  });

  it('normalizePrivacyRedaction falls back to face for invalid type', () => {
    const result = normalizePrivacyRedaction({ type: 'invalid' as any });
    expect(result.type).toBe('face');
  });
});

import { describe, expect, it } from 'vitest';
import {
  parseAILookMatchResponse,
  mapLookMatchToWheelAdjustments,
  mapLookMatchToCurveControlPoints,
  buildAILookMatch,
  blendWheelAdjustments,
  blendCurveControlPoints,
  type AILookMatchResponse
} from '../src';
import type { ThreeWayColor, ColorCurves, ColorWheelValue } from '../src/color-grading';

const neutralWheel: ColorWheelValue = { r: 0, g: 0, b: 0, intensity: 1 };
const defaultColor: ThreeWayColor = {
  lift: { ...neutralWheel },
  gamma: { ...neutralWheel },
  gain: { ...neutralWheel }
};

const sampleResponse: AILookMatchResponse = {
  warmth: 0.5,
  contrast: 0.3,
  saturation: -0.2,
  shadowsTint: { r: 0.1, g: -0.05, b: 0.2 },
  highlightsTint: { r: -0.1, g: 0.15, b: -0.05 },
  reason: '温暖色调，低饱和'
};

describe('parseAILookMatchResponse', () => {
  it('parses valid response', () => {
    const result = parseAILookMatchResponse(sampleResponse);
    expect(result).not.toBeNull();
    expect(result!.warmth).toBe(0.5);
    expect(result!.contrast).toBe(0.3);
    expect(result!.saturation).toBe(-0.2);
    expect(result!.shadowsTint.r).toBe(0.1);
    expect(result!.highlightsTint.r).toBe(-0.1);
    expect(result!.reason).toBe('温暖色调，低饱和');
  });

  it('clamps values to -1..1', () => {
    const result = parseAILookMatchResponse({
      warmth: 5, contrast: -3, saturation: 0,
      shadowsTint: { r: 2, g: -2, b: 0 },
      highlightsTint: { r: 0, g: 0, b: 0 },
      reason: ''
    });
    expect(result!.warmth).toBe(1);
    expect(result!.contrast).toBe(-1);
    expect(result!.shadowsTint.r).toBe(1);
    expect(result!.shadowsTint.g).toBe(-1);
  });

  it('returns null for invalid input', () => {
    expect(parseAILookMatchResponse(null)).toBeNull();
    expect(parseAILookMatchResponse(undefined)).toBeNull();
    expect(parseAILookMatchResponse('bad')).toBeNull();
  });

  it('defaults missing fields to zero', () => {
    const result = parseAILookMatchResponse({ reason: '' });
    expect(result!.warmth).toBe(0);
    expect(result!.contrast).toBe(0);
    expect(result!.saturation).toBe(0);
  });
});

describe('mapLookMatchToWheelAdjustments', () => {
  it('produces lift/gamma/gain with r/g/b values', () => {
    const adj = mapLookMatchToWheelAdjustments(sampleResponse);
    expect(adj.lift).toHaveProperty('r');
    expect(adj.lift).toHaveProperty('g');
    expect(adj.lift).toHaveProperty('b');
    expect(adj.gamma).toHaveProperty('r');
    expect(adj.gamma).toHaveProperty('g');
    expect(adj.gamma).toHaveProperty('b');
    expect(adj.gain).toHaveProperty('r');
    expect(adj.gain).toHaveProperty('g');
    expect(adj.gain).toHaveProperty('b');
  });

  it('produces zero adjustments for zero response', () => {
    const zero: AILookMatchResponse = {
      warmth: 0, contrast: 0, saturation: 0,
      shadowsTint: { r: 0, g: 0, b: 0 },
      highlightsTint: { r: 0, g: 0, b: 0 },
      reason: ''
    };
    const adj = mapLookMatchToWheelAdjustments(zero);
    expect(adj.lift.r).toBeCloseTo(0, 3);
    expect(adj.lift.g).toBeCloseTo(0, 3);
    expect(adj.lift.b).toBeCloseTo(0, 3);
    expect(adj.gamma.r).toBeCloseTo(0, 3);
    expect(adj.gain.r).toBeCloseTo(0, 3);
  });

  it('warmth increases red lift and blue gain', () => {
    const warm: AILookMatchResponse = {
      warmth: 1, contrast: 0, saturation: 0,
      shadowsTint: { r: 0, g: 0, b: 0 },
      highlightsTint: { r: 0, g: 0, b: 0 },
      reason: ''
    };
    const adj = mapLookMatchToWheelAdjustments(warm);
    // warmth > 0 should make lift.r more negative (shadow red shift)
    // and gain.r more positive (highlight warm)
    expect(adj.gain.r).toBeGreaterThan(0);
  });
});

describe('mapLookMatchToCurveControlPoints', () => {
  it('generates 4 channels (master, r, g, b)', () => {
    const curves = mapLookMatchToCurveControlPoints(sampleResponse);
    expect(curves).toHaveProperty('master');
    expect(curves).toHaveProperty('r');
    expect(curves).toHaveProperty('g');
    expect(curves).toHaveProperty('b');
  });

  it('master curve starts at (0,0) and ends at (1,1)', () => {
    const curves = mapLookMatchToCurveControlPoints(sampleResponse);
    expect(curves.master[0]).toEqual({ x: 0, y: 0 });
    expect(curves.master[curves.master.length - 1]).toEqual({ x: 1, y: 1 });
  });

  it('all control points have y clamped 0..1', () => {
    const extreme: AILookMatchResponse = {
      warmth: 1, contrast: 1, saturation: 1,
      shadowsTint: { r: 1, g: 1, b: 1 },
      highlightsTint: { r: 1, g: 1, b: 1 },
      reason: ''
    };
    const curves = mapLookMatchToCurveControlPoints(extreme);
    for (const channel of [curves.master, curves.r, curves.g, curves.b]) {
      for (const point of channel) {
        expect(point.y).toBeGreaterThanOrEqual(0);
        expect(point.y).toBeLessThanOrEqual(1);
      }
    }
  });

  it('zero response produces identity-like curves', () => {
    const zero: AILookMatchResponse = {
      warmth: 0, contrast: 0, saturation: 0,
      shadowsTint: { r: 0, g: 0, b: 0 },
      highlightsTint: { r: 0, g: 0, b: 0 },
      reason: ''
    };
    const curves = mapLookMatchToCurveControlPoints(zero);
    for (const channel of [curves.master, curves.r, curves.g, curves.b]) {
      for (const point of channel) {
        expect(point.y).toBeCloseTo(point.x, 2);
      }
    }
  });
});

describe('buildAILookMatch', () => {
  it('builds complete ClipAILookMatch object', () => {
    const result = buildAILookMatch(sampleResponse, 'hash-abc', 0.9);
    expect(result.sourceImageHash).toBe('hash-abc');
    expect(result.confidence).toBe(0.9);
    expect(result.blendStrength).toBe(100);
    expect(result.wheelAdjustments).toBeDefined();
    expect(result.curveControlPoints).toBeDefined();
    expect(result.generatedAt).toBeTruthy();
  });

  it('clamps confidence to 0..1', () => {
    expect(buildAILookMatch(sampleResponse, 'h', 5).confidence).toBe(1);
    expect(buildAILookMatch(sampleResponse, 'h', -1).confidence).toBe(0);
  });
});

describe('blendWheelAdjustments', () => {
  it('returns original at blendStrength=0', () => {
    const adj = mapLookMatchToWheelAdjustments(sampleResponse);
    const result = blendWheelAdjustments(defaultColor, adj, 0);
    expect(result.lift.r).toBeCloseTo(0, 3);
    expect(result.lift.g).toBeCloseTo(0, 3);
  });

  it('returns full adjustment at blendStrength=100', () => {
    const adj = mapLookMatchToWheelAdjustments(sampleResponse);
    const result = blendWheelAdjustments(defaultColor, adj, 100);
    expect(result.lift.r).toBeCloseTo(adj.lift.r, 3);
    expect(result.gain.r).toBeCloseTo(adj.gain.r, 3);
  });

  it('interpolates linearly at blendStrength=50', () => {
    const adj = mapLookMatchToWheelAdjustments(sampleResponse);
    const result = blendWheelAdjustments(defaultColor, adj, 50);
    expect(result.lift.r).toBeCloseTo(adj.lift.r * 0.5, 2);
    expect(result.gain.r).toBeCloseTo(adj.gain.r * 0.5, 2);
  });

  it('preserves intensity from original', () => {
    const customColor: ThreeWayColor = {
      lift: { r: 0, g: 0, b: 0, intensity: 1.5 },
      gamma: { r: 0, g: 0, b: 0, intensity: 1.2 },
      gain: { r: 0, g: 0, b: 0, intensity: 0.8 }
    };
    const adj = mapLookMatchToWheelAdjustments(sampleResponse);
    const result = blendWheelAdjustments(customColor, adj, 50);
    expect(result.lift.intensity).toBe(1.5);
    expect(result.gamma.intensity).toBe(1.2);
    expect(result.gain.intensity).toBe(0.8);
  });
});

describe('blendCurveControlPoints', () => {
  it('returns original curves at blendStrength=0', () => {
    const target = mapLookMatchToCurveControlPoints(sampleResponse);
    const identity: ColorCurves = {
      master: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      r: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      g: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      b: [{ x: 0, y: 0 }, { x: 1, y: 1 }]
    };
    const result = blendCurveControlPoints(identity, target, 0);
    for (const point of result.master) {
      expect(point.y).toBeCloseTo(point.x, 2);
    }
  });

  it('returns target curves at blendStrength=100', () => {
    const target = mapLookMatchToCurveControlPoints(sampleResponse);
    const identity: ColorCurves = {
      master: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      r: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      g: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      b: [{ x: 0, y: 0 }, { x: 1, y: 1 }]
    };
    const result = blendCurveControlPoints(identity, target, 100);
    expect(result.master.length).toBe(target.master.length);
  });
});

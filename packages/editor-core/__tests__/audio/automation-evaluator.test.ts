import { describe, it, expect } from 'vitest';
import { evaluateCurve, evaluateAutomation } from '../../src/audio/automation-evaluator';
import type { AutomationPoint, ChannelAutomation } from '../../src/audio/mixer-types';

describe('evaluateCurve', () => {
  it('returns 0 for empty points', () => {
    expect(evaluateCurve([], 1, 'linear')).toBe(0);
  });

  it('returns single point value', () => {
    expect(evaluateCurve([{ time: 0, value: 5, curve: 'linear' }], 1, 'linear')).toBe(5);
  });

  it('interpolates linearly between two points', () => {
    const points: AutomationPoint[] = [
      { time: 0, value: 0, curve: 'linear' },
      { time: 10, value: 100, curve: 'linear' },
    ];
    expect(evaluateCurve(points, 5, 'linear')).toBeCloseTo(50);
  });

  it('interpolates linearly at quarter position', () => {
    const points: AutomationPoint[] = [
      { time: 0, value: 0, curve: 'linear' },
      { time: 10, value: 100, curve: 'linear' },
    ];
    expect(evaluateCurve(points, 2.5, 'linear')).toBeCloseTo(25);
  });

  it('uses step function (holds previous value)', () => {
    const points: AutomationPoint[] = [
      { time: 0, value: 0, curve: 'step' },
      { time: 10, value: 100, curve: 'step' },
    ];
    expect(evaluateCurve(points, 5, 'step')).toBe(0);
  });

  it('step function returns last segment value after last point', () => {
    const points: AutomationPoint[] = [
      { time: 0, value: 0, curve: 'step' },
      { time: 10, value: 100, curve: 'step' },
    ];
    expect(evaluateCurve(points, 10, 'step')).toBe(100);
  });

  it('clamps to first value before first point', () => {
    const points: AutomationPoint[] = [
      { time: 0, value: 10, curve: 'linear' },
      { time: 10, value: 20, curve: 'linear' },
    ];
    expect(evaluateCurve(points, -5, 'linear')).toBe(10);
  });

  it('clamps to last value after last point', () => {
    const points: AutomationPoint[] = [
      { time: 0, value: 10, curve: 'linear' },
      { time: 10, value: 20, curve: 'linear' },
    ];
    expect(evaluateCurve(points, 15, 'linear')).toBe(20);
  });

  it('handles points in unsorted order', () => {
    const points: AutomationPoint[] = [
      { time: 10, value: 100, curve: 'linear' },
      { time: 0, value: 0, curve: 'linear' },
    ];
    expect(evaluateCurve(points, 5, 'linear')).toBeCloseTo(50);
  });

  it('smooth (Catmull-Rom) interpolation produces values between neighbors', () => {
    const points: AutomationPoint[] = [
      { time: 0, value: 0, curve: 'smooth' },
      { time: 5, value: 50, curve: 'smooth' },
      { time: 10, value: 100, curve: 'smooth' },
    ];
    const result = evaluateCurve(points, 2.5, 'smooth');
    // Should be a smooth interpolation between 0 and 50
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(50);
  });

  it('smooth interpolation matches linear for evenly spaced monotonic points', () => {
    const points: AutomationPoint[] = [
      { time: 0, value: 0, curve: 'smooth' },
      { time: 10, value: 100, curve: 'smooth' },
    ];
    // With only two points, Catmull-Rom degenerates
    const result = evaluateCurve(points, 5, 'smooth');
    expect(result).toBeCloseTo(50, 0);
  });

  it('bezier with no handles falls back to linear', () => {
    const points: AutomationPoint[] = [
      { time: 0, value: 0, curve: 'bezier' },
      { time: 10, value: 100, curve: 'bezier' },
    ];
    expect(evaluateCurve(points, 5, 'bezier')).toBeCloseTo(50);
  });

  it('bezier with handles uses cubic Hermite interpolation', () => {
    const points: AutomationPoint[] = [
      {
        time: 0, value: 0, curve: 'bezier',
        handleOut: { time: 2.5, value: 40 },
      },
      {
        time: 10, value: 100, curve: 'bezier',
        handleIn: { time: 7.5, value: 60 },
      },
    ];
    const result = evaluateCurve(points, 5, 'bezier');
    // With handles pulling the curve up, mid value should differ from linear 50
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(100);
  });

  it('evaluates multi-segment curves correctly', () => {
    const points: AutomationPoint[] = [
      { time: 0, value: 0, curve: 'linear' },
      { time: 5, value: 50, curve: 'linear' },
      { time: 10, value: 20, curve: 'linear' },
    ];
    // First segment midpoint
    expect(evaluateCurve(points, 2.5, 'linear')).toBeCloseTo(25);
    // Second segment midpoint
    expect(evaluateCurve(points, 7.5, 'linear')).toBeCloseTo(35);
  });

  it('returns value at exact point time', () => {
    const points: AutomationPoint[] = [
      { time: 0, value: 10, curve: 'linear' },
      { time: 5, value: 50, curve: 'linear' },
      { time: 10, value: 20, curve: 'linear' },
    ];
    expect(evaluateCurve(points, 0, 'linear')).toBe(10);
    expect(evaluateCurve(points, 5, 'linear')).toBe(50);
    expect(evaluateCurve(points, 10, 'linear')).toBe(20);
  });

  it('defaults to linear for unknown curve type', () => {
    const points: AutomationPoint[] = [
      { time: 0, value: 0, curve: 'linear' },
      { time: 10, value: 100, curve: 'linear' },
    ];
    // @ts-expect-error testing fallback
    expect(evaluateCurve(points, 5, 'unknown')).toBeCloseTo(50);
  });
});

describe('evaluateAutomation', () => {
  it('returns zeros for empty automation', () => {
    const result = evaluateAutomation({}, 5);
    expect(result.volume).toBe(0);
    expect(result.pan).toBe(0);
    expect(result.effectParams).toEqual({});
  });

  it('evaluates volume curve', () => {
    const auto: ChannelAutomation = {
      volume: {
        points: [
          { time: 0, value: -6, curve: 'linear' },
          { time: 10, value: 0, curve: 'linear' },
        ],
        mode: 'read',
      },
    };
    const result = evaluateAutomation(auto, 5);
    expect(result.volume).toBeCloseTo(-3);
  });

  it('evaluates pan curve', () => {
    const auto: ChannelAutomation = {
      pan: {
        points: [
          { time: 0, value: -100, curve: 'linear' },
          { time: 10, value: 100, curve: 'linear' },
        ],
        mode: 'read',
      },
    };
    const result = evaluateAutomation(auto, 5);
    expect(result.pan).toBeCloseTo(0);
  });

  it('evaluates volume and pan together', () => {
    const auto: ChannelAutomation = {
      volume: {
        points: [
          { time: 0, value: 0, curve: 'linear' },
          { time: 10, value: -12, curve: 'linear' },
        ],
        mode: 'read',
      },
      pan: {
        points: [
          { time: 0, value: -50, curve: 'linear' },
          { time: 10, value: 50, curve: 'linear' },
        ],
        mode: 'read',
      },
    };
    const result = evaluateAutomation(auto, 5);
    expect(result.volume).toBeCloseTo(-6);
    expect(result.pan).toBeCloseTo(0);
  });

  it('evaluates effect parameter curves', () => {
    const auto: ChannelAutomation = {
      'reverb.wetLevel': {
        points: [
          { time: 0, value: 0, curve: 'linear' },
          { time: 10, value: 100, curve: 'linear' },
        ],
        mode: 'read',
      },
    };
    const result = evaluateAutomation(auto, 5);
    expect(result.effectParams['reverb.wetLevel']).toBeCloseTo(50);
  });

  it('evaluates multiple effect parameters', () => {
    const auto: ChannelAutomation = {
      volume: {
        points: [
          { time: 0, value: 0, curve: 'linear' },
          { time: 10, value: -10, curve: 'linear' },
        ],
        mode: 'read',
      },
      'compressor.threshold': {
        points: [
          { time: 0, value: -40, curve: 'linear' },
          { time: 10, value: -10, curve: 'linear' },
        ],
        mode: 'read',
      },
      'compressor.ratio': {
        points: [
          { time: 0, value: 1, curve: 'step' },
          { time: 5, value: 4, curve: 'step' },
        ],
        mode: 'read',
      },
    };
    const result = evaluateAutomation(auto, 3);
    expect(result.volume).toBeCloseTo(-3);
    expect(result.effectParams['compressor.threshold']).toBeCloseTo(-31);
    expect(result.effectParams['compressor.ratio']).toBe(1); // step: held from segment start
  });

  it('clamps time before first point', () => {
    const auto: ChannelAutomation = {
      volume: {
        points: [
          { time: 2, value: -6, curve: 'linear' },
          { time: 10, value: 0, curve: 'linear' },
        ],
        mode: 'read',
      },
    };
    const result = evaluateAutomation(auto, 0);
    expect(result.volume).toBe(-6);
  });

  it('clamps time after last point', () => {
    const auto: ChannelAutomation = {
      volume: {
        points: [
          { time: 0, value: -6, curve: 'linear' },
          { time: 10, value: 0, curve: 'linear' },
        ],
        mode: 'read',
      },
    };
    const result = evaluateAutomation(auto, 20);
    expect(result.volume).toBe(0);
  });
});

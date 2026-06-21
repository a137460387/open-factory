import { describe, expect, it } from 'vitest';
import {
  mapAudioFadeCurveToFfmpeg,
  mapFfmpegCurveToAudioFadeCurve,
  getAudioFadeCurveLabel,
  inferCurveTypeFromHandleAngle,
  evaluateFadeCurve,
  getFadeCurveSamplePoints,
  normalizeAudioFadeCurveType,
  type AudioFadeCurveType
} from '../src/audio-fade-curves';

describe('mapAudioFadeCurveToFfmpeg', () => {
  it('maps linear to tri', () => {
    expect(mapAudioFadeCurveToFfmpeg('linear')).toBe('tri');
  });

  it('maps logarithmic to log', () => {
    expect(mapAudioFadeCurveToFfmpeg('logarithmic')).toBe('log');
  });

  it('maps exponential to exp', () => {
    expect(mapAudioFadeCurveToFfmpeg('exponential')).toBe('exp');
  });

  it('maps s-curve to qsin', () => {
    expect(mapAudioFadeCurveToFfmpeg('s-curve')).toBe('qsin');
  });
});

describe('mapFfmpegCurveToAudioFadeCurve', () => {
  it('maps tri to linear', () => {
    expect(mapFfmpegCurveToAudioFadeCurve('tri')).toBe('linear');
  });

  it('maps log to logarithmic', () => {
    expect(mapFfmpegCurveToAudioFadeCurve('log')).toBe('logarithmic');
  });

  it('maps exp to exponential', () => {
    expect(mapFfmpegCurveToAudioFadeCurve('exp')).toBe('exponential');
  });

  it('maps qsin to s-curve', () => {
    expect(mapFfmpegCurveToAudioFadeCurve('qsin')).toBe('s-curve');
  });

  it('returns linear for unknown curve', () => {
    expect(mapFfmpegCurveToAudioFadeCurve('unknown')).toBe('linear');
  });
});

describe('getAudioFadeCurveLabel', () => {
  it('returns correct label for each curve type', () => {
    expect(getAudioFadeCurveLabel('linear')).toBe('线性');
    expect(getAudioFadeCurveLabel('logarithmic')).toBe('对数');
    expect(getAudioFadeCurveLabel('exponential')).toBe('指数');
    expect(getAudioFadeCurveLabel('s-curve')).toBe('S形');
  });
});

describe('inferCurveTypeFromHandleAngle', () => {
  it('infers linear from 0 degrees', () => {
    expect(inferCurveTypeFromHandleAngle(0)).toBe('linear');
  });

  it('infers logarithmic from 90 degrees', () => {
    expect(inferCurveTypeFromHandleAngle(90)).toBe('logarithmic');
  });

  it('infers s-curve from 180 degrees', () => {
    expect(inferCurveTypeFromHandleAngle(180)).toBe('s-curve');
  });

  it('infers exponential from 270 degrees', () => {
    expect(inferCurveTypeFromHandleAngle(270)).toBe('exponential');
  });

  it('handles negative angles', () => {
    expect(inferCurveTypeFromHandleAngle(-90)).toBe('exponential');
  });

  it('handles angles over 360', () => {
    expect(inferCurveTypeFromHandleAngle(450)).toBe('logarithmic');
  });
});

describe('evaluateFadeCurve', () => {
  it('linear at t=0 is 0', () => {
    expect(evaluateFadeCurve('linear', 0)).toBe(0);
  });

  it('linear at t=1 is 1', () => {
    expect(evaluateFadeCurve('linear', 1)).toBeCloseTo(1);
  });

  it('linear at t=0.5 is 0.5', () => {
    expect(evaluateFadeCurve('linear', 0.5)).toBeCloseTo(0.5);
  });

  it('logarithmic at t=1 is close to 1', () => {
    expect(evaluateFadeCurve('logarithmic', 1)).toBeCloseTo(1);
  });

  it('exponential at t=0 is 0', () => {
    expect(evaluateFadeCurve('exponential', 0)).toBeCloseTo(0);
  });

  it('s-curve at t=0 is close to 0', () => {
    expect(evaluateFadeCurve('s-curve', 0)).toBeCloseTo(0, 1);
  });

  it('s-curve at t=1 is close to 1', () => {
    expect(evaluateFadeCurve('s-curve', 1)).toBeCloseTo(1, 1);
  });

  it('s-curve at t=0.5 is 0.5', () => {
    expect(evaluateFadeCurve('s-curve', 0.5)).toBeCloseTo(0.5);
  });

  it('clamps t below 0', () => {
    expect(evaluateFadeCurve('linear', -0.5)).toBe(0);
  });

  it('clamps t above 1', () => {
    expect(evaluateFadeCurve('linear', 1.5)).toBeCloseTo(1);
  });
});

describe('getFadeCurveSamplePoints', () => {
  it('returns correct number of points', () => {
    const points = getFadeCurveSamplePoints('linear', 10);
    expect(points.length).toBe(11);
  });

  it('starts at x=0 and ends at x=1', () => {
    const points = getFadeCurveSamplePoints('linear', 10);
    expect(points[0].x).toBe(0);
    expect(points[points.length - 1].x).toBe(1);
  });
});

describe('normalizeAudioFadeCurveType', () => {
  it('returns valid curve types as-is', () => {
    expect(normalizeAudioFadeCurveType('linear')).toBe('linear');
    expect(normalizeAudioFadeCurveType('logarithmic')).toBe('logarithmic');
    expect(normalizeAudioFadeCurveType('exponential')).toBe('exponential');
    expect(normalizeAudioFadeCurveType('s-curve')).toBe('s-curve');
  });

  it('returns linear for invalid input', () => {
    expect(normalizeAudioFadeCurveType(undefined)).toBe('linear');
    expect(normalizeAudioFadeCurveType('invalid')).toBe('linear');
    expect(normalizeAudioFadeCurveType(null)).toBe('linear');
  });
});

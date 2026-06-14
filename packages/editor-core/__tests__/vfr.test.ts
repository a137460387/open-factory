import { describe, expect, it } from 'vitest';
import { buildCfrFpsFilter, getCfrTargetFrameRate, getProjectFrameRateConversionTarget, isFrameRateMismatch, isVariableFrameRateProbe, parseFrameRateRatio } from '../src';

describe('variable frame rate helpers', () => {
  it('detects VFR from avg_frame_rate and r_frame_rate ratios', () => {
    expect(parseFrameRateRatio('30000/1001')).toBeCloseTo(29.97003);
    expect(isVariableFrameRateProbe({ avgFrameRate: '24000/1001', realFrameRate: '30/1' })).toBe(true);
    expect(isVariableFrameRateProbe({ avgFrameRate: '30000/1001', realFrameRate: '30000/1001' })).toBe(false);
    expect(isVariableFrameRateProbe({ avgFrameRate: '0/0', realFrameRate: '30/1' })).toBe(false);
  });

  it('builds CFR fps filters from the target frame rate', () => {
    expect(getCfrTargetFrameRate({ avgFrameRate: '24000/1001', realFrameRate: '30/1' })).toBe(23.976);
    expect(buildCfrFpsFilter(23.9764)).toBe('fps=23.976');
  });

  it('detects media frame rates that do not match the project frame rate', () => {
    expect(isFrameRateMismatch(25, 30)).toBe(true);
    expect(isFrameRateMismatch(29.97003, 29.97)).toBe(false);
    expect(isFrameRateMismatch(undefined, 30)).toBe(false);
    expect(getProjectFrameRateConversionTarget(59.9402)).toBe(59.94);
  });
});

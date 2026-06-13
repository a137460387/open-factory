import { describe, expect, it } from 'vitest';
import { assessQualityMetric } from '../src';

describe('export quality assessment', () => {
  it('classifies SSIM above 0.98 as excellent', () => {
    expect(assessQualityMetric('ssim', 0.981)).toBe('excellent');
    expect(assessQualityMetric('ssim', 0.96)).toBe('average');
    expect(assessQualityMetric('ssim', 0.9)).toBe('poor');
  });

  it('classifies PSNR and VMAF with stable thresholds', () => {
    expect(assessQualityMetric('psnr', 41)).toBe('excellent');
    expect(assessQualityMetric('psnr', 35)).toBe('average');
    expect(assessQualityMetric('psnr', 24)).toBe('poor');
    expect(assessQualityMetric('vmaf', 92)).toBe('excellent');
    expect(assessQualityMetric('vmaf', 75)).toBe('average');
    expect(assessQualityMetric('vmaf', 60)).toBe('poor');
  });

  it('returns no level for missing or invalid quality scores', () => {
    expect(assessQualityMetric('ssim', undefined)).toBeUndefined();
    expect(assessQualityMetric('psnr', Number.NaN)).toBeUndefined();
    expect(assessQualityMetric('vmaf', Number.POSITIVE_INFINITY)).toBeUndefined();
  });
});

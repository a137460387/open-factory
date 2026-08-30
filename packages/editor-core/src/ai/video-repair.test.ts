import { describe, it, expect } from 'vitest';
import { createDefaultVideoRepairConfig, validateVideoRepairConfig } from './video-repair';

describe('createDefaultVideoRepairConfig', () => {
  it('returns expected defaults', () => {
    const config = createDefaultVideoRepairConfig();
    expect(config.stabilizationStrength).toBe(0.5);
    expect(config.deblurStrength).toBe(0.3);
    expect(config.colorRepairStrength).toBe(0.5);
    expect(config.denoiseStrength).toBe(0.3);
    expect(config.scratchRepairStrength).toBe(0.5);
    expect(config.enableFrameInterpolation).toBe(false);
    expect(config.frameInterpolationFactor).toBe(2);
    expect(config.gpuAccelerated).toBe(true);
    expect(config.quality).toBe(0.8);
  });
});

describe('validateVideoRepairConfig', () => {
  it('returns empty for valid config', () => {
    expect(validateVideoRepairConfig(createDefaultVideoRepairConfig())).toEqual([]);
  });

  it('reports out-of-range stabilizationStrength', () => {
    const errors = validateVideoRepairConfig({ ...createDefaultVideoRepairConfig(), stabilizationStrength: 1.5 });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('reports out-of-range deblurStrength', () => {
    const errors = validateVideoRepairConfig({ ...createDefaultVideoRepairConfig(), deblurStrength: -0.1 });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('reports out-of-range colorRepairStrength', () => {
    const errors = validateVideoRepairConfig({ ...createDefaultVideoRepairConfig(), colorRepairStrength: 2 });
    expect(errors.some((e) => e.includes('色彩'))).toBe(true);
  });

  it('reports out-of-range denoiseStrength', () => {
    const errors = validateVideoRepairConfig({ ...createDefaultVideoRepairConfig(), denoiseStrength: 1.5 });
    expect(errors.some((e) => e.includes('降噪'))).toBe(true);
  });

  it('reports out-of-range scratchRepairStrength', () => {
    const errors = validateVideoRepairConfig({ ...createDefaultVideoRepairConfig(), scratchRepairStrength: -0.5 });
    expect(errors.some((e) => e.includes('划痕'))).toBe(true);
  });

  it('reports out-of-range quality', () => {
    const errors = validateVideoRepairConfig({ ...createDefaultVideoRepairConfig(), quality: 1.5 });
    expect(errors.some((e) => e.includes('质量'))).toBe(true);
  });

  it('reports invalid frameInterpolationFactor', () => {
    const errors = validateVideoRepairConfig({ ...createDefaultVideoRepairConfig(), frameInterpolationFactor: 1 });
    expect(errors.some((e) => e.includes('插值'))).toBe(true);
  });

  it('reports out-of-range frameInterpolationFactor high', () => {
    const errors = validateVideoRepairConfig({ ...createDefaultVideoRepairConfig(), frameInterpolationFactor: 10 });
    expect(errors.some((e) => e.includes('插值'))).toBe(true);
  });
});

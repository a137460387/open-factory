import { describe, it, expect } from 'vitest';
import {
  createDefaultSuperResolutionConfig,
  validateSuperResolutionConfig,
  prepareGPUInferenceRequest,
  estimateGPUMemoryRequirement,
  createTemporalFrameCache,
} from './super-resolution';

describe('createDefaultSuperResolutionConfig', () => {
  it('returns expected defaults', () => {
    const config = createDefaultSuperResolutionConfig();
    expect(config.scaleFactor).toBe(4);
    expect(config.model).toBe('auto');
    expect(config.denoiseStrength).toBe(0.3);
    expect(config.sharpenStrength).toBe(0.5);
    expect(config.preserveFaces).toBe(true);
    expect(config.temporalConsistency).toBe(true);
    expect(config.outputQuality).toBe(0.9);
    expect(config.gpuMode).toBe('auto');
    expect(config.batchSize).toBe(4);
    expect(config.tileSize).toBe(512);
    expect(config.tileOverlap).toBe(32);
  });
});

describe('validateSuperResolutionConfig', () => {
  it('returns empty for valid config', () => {
    expect(validateSuperResolutionConfig(createDefaultSuperResolutionConfig())).toEqual([]);
  });

  it('reports invalid scaleFactor', () => {
    const errors = validateSuperResolutionConfig({ ...createDefaultSuperResolutionConfig(), scaleFactor: 3 as any });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('reports out-of-range denoiseStrength', () => {
    const errors = validateSuperResolutionConfig({ ...createDefaultSuperResolutionConfig(), denoiseStrength: 1.5 });
    expect(errors.some((e) => e.includes('降噪'))).toBe(true);
  });

  it('reports out-of-range sharpenStrength', () => {
    const errors = validateSuperResolutionConfig({ ...createDefaultSuperResolutionConfig(), sharpenStrength: -0.1 });
    expect(errors.some((e) => e.includes('锐化'))).toBe(true);
  });

  it('reports out-of-range outputQuality', () => {
    const errors = validateSuperResolutionConfig({ ...createDefaultSuperResolutionConfig(), outputQuality: 2 });
    expect(errors.some((e) => e.includes('质量'))).toBe(true);
  });

  it('reports out-of-range tileSize', () => {
    const errors = validateSuperResolutionConfig({ ...createDefaultSuperResolutionConfig(), tileSize: 10 });
    expect(errors.some((e) => e.includes('瓦片大小'))).toBe(true);
  });

  it('reports invalid tileOverlap', () => {
    const errors = validateSuperResolutionConfig({ ...createDefaultSuperResolutionConfig(), tileOverlap: 300 });
    expect(errors.some((e) => e.includes('重叠'))).toBe(true);
  });

  it('reports out-of-range batchSize', () => {
    const errors = validateSuperResolutionConfig({ ...createDefaultSuperResolutionConfig(), batchSize: 0 });
    expect(errors.some((e) => e.includes('批处理'))).toBe(true);
  });
});

describe('prepareGPUInferenceRequest', () => {
  it('creates request with required fields', () => {
    const req = prepareGPUInferenceRequest('esrgan-x4', 4);
    expect(req.model).toBe('esrgan-x4');
    expect(req.scaleFactor).toBe(4);
    expect(req.inputTextureId).toBeDefined();
  });

  it('includes tile info when provided', () => {
    const req = prepareGPUInferenceRequest('esrgan-x4', 4, 1, 10);
    expect(req.tileIndex).toBe(1);
    expect(req.totalTiles).toBe(10);
  });
});

describe('estimateGPUMemoryRequirement', () => {
  it('returns positive number', () => {
    const mem = estimateGPUMemoryRequirement(1920, 1080, 4, 'esrgan-x4');
    expect(mem).toBeGreaterThan(0);
  });

  it('is larger for x4 than x2', () => {
    const mem4 = estimateGPUMemoryRequirement(1920, 1080, 4, 'esrgan-x4');
    const mem2 = estimateGPUMemoryRequirement(1920, 1080, 2, 'realesrgan-x2plus');
    expect(mem4).toBeGreaterThan(mem2);
  });

  it('is larger for bigger images', () => {
    const small = estimateGPUMemoryRequirement(640, 480, 4, 'esrgan-x4');
    const large = estimateGPUMemoryRequirement(1920, 1080, 4, 'esrgan-x4');
    expect(large).toBeGreaterThan(small);
  });
});

describe('createTemporalFrameCache', () => {
  it('creates cache with expected fields', () => {
    const cache = createTemporalFrameCache();
    expect(cache.previousFrame).toBeNull();
    expect(cache.motionVectors).toBeNull();
    expect(cache.blendWeight).toBe(0.2);
  });
});

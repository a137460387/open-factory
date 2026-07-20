import { describe, it, expect } from 'vitest';
import {
  createDefaultEnhancementParams,
  createDefaultBatchEnhancementConfig,
  estimateProcessingTime,
  estimateQualityImprovement,
  computeStyleTransferParams,
  computeColorCorrectionParams,
  computeFrameInterpolationParams,
  computeDenoiseParams,
  executeEnhancement,
  executeBatchEnhancement,
  validateEnhancementParams,
  validateBatchEnhancementConfig,
  getAvailableStylePresets,
  executeBatchEnhancementSafe,
} from './enhancement-processor';
import type {
  EnhancementOperation,
  EnhancementTask,
  BatchEnhancementConfig,
  StyleTransferConfig,
  FrameInterpolationConfig,
} from './enhancement-processor';

// ==================== 测试辅助函数 ====================

function createTestTask(operation: EnhancementOperation, overrides?: Partial<EnhancementTask>): EnhancementTask {
  return {
    id: `task-${operation}`,
    operation,
    params: createDefaultEnhancementParams(operation),
    priority: 5,
    ...overrides,
  };
}

function createTestBatchConfig(overrides?: Partial<BatchEnhancementConfig>): BatchEnhancementConfig {
  return {
    ...createDefaultBatchEnhancementConfig(),
    ...overrides,
  };
}

// ==================== createDefaultEnhancementParams ====================

describe('createDefaultEnhancementParams', () => {
  it('should create params for denoise', () => {
    const params = createDefaultEnhancementParams('denoise');
    expect(params.denoiseStrength).toBe(0.5);
    expect(params.quality).toBe('balanced');
  });

  it('should create params for super-resolution', () => {
    const params = createDefaultEnhancementParams('super-resolution');
    expect(params.superResolutionScale).toBe(2);
  });

  it('should create params for color-correction', () => {
    const params = createDefaultEnhancementParams('color-correction');
    expect(params.colorCorrectionMode).toBe('auto');
  });

  it('should create params for style-transfer', () => {
    const params = createDefaultEnhancementParams('style-transfer');
    expect(params.styleTransferPreset).toBe('cinematic');
  });

  it('should create params for frame-interpolation', () => {
    const params = createDefaultEnhancementParams('frame-interpolation');
    expect(params.targetFrameRate).toBe(60);
  });

  it('should create params for all operations', () => {
    const operations: EnhancementOperation[] = [
      'denoise', 'super-resolution', 'color-correction', 'stabilization',
      'style-transfer', 'frame-interpolation', 'motion-blur-reduction',
      'hdr-tone-mapping', 'deinterlace', 'sharpen',
    ];

    for (const op of operations) {
      const params = createDefaultEnhancementParams(op);
      expect(params).toBeDefined();
      if (op === 'deinterlace') {
        expect(params.quality).toBe('fast');
      } else {
        expect(params.quality).toBe('balanced');
      }
    }
  });
});

// ==================== estimateProcessingTime ====================

describe('estimateProcessingTime', () => {
  it('should estimate time for denoise', () => {
    const params = createDefaultEnhancementParams('denoise');
    const time = estimateProcessingTime('denoise', params, 100, 1920, 1080);
    expect(time).toBeGreaterThan(0);
  });

  it('should take longer for higher quality', () => {
    const fastParams = { ...createDefaultEnhancementParams('denoise'), quality: 'fast' as const };
    const ultraParams = { ...createDefaultEnhancementParams('denoise'), quality: 'ultra' as const };

    const fastTime = estimateProcessingTime('denoise', fastParams, 100, 1920, 1080);
    const ultraTime = estimateProcessingTime('denoise', ultraParams, 100, 1920, 1080);

    expect(ultraTime).toBeGreaterThan(fastTime);
  });

  it('should take longer for higher resolution', () => {
    const params = createDefaultEnhancementParams('denoise');
    const time720 = estimateProcessingTime('denoise', params, 100, 1280, 720);
    const time4k = estimateProcessingTime('denoise', params, 100, 3840, 2160);

    expect(time4k).toBeGreaterThan(time720);
  });

  it('should scale with frame count', () => {
    const params = createDefaultEnhancementParams('denoise');
    const time100 = estimateProcessingTime('denoise', params, 100, 1920, 1080);
    const time1000 = estimateProcessingTime('denoise', params, 1000, 1920, 1080);

    expect(time1000).toBeGreaterThan(time100);
  });
});

// ==================== estimateQualityImprovement ====================

describe('estimateQualityImprovement', () => {
  it('should estimate improvement for low quality input', () => {
    const params = createDefaultEnhancementParams('denoise');
    const improvement = estimateQualityImprovement('denoise', params, 30);
    expect(improvement).toBeGreaterThan(0);
  });

  it('should estimate less improvement for high quality input', () => {
    const params = createDefaultEnhancementParams('denoise');
    const lowImprovement = estimateQualityImprovement('denoise', params, 90);
    const highImprovement = estimateQualityImprovement('denoise', params, 30);

    expect(highImprovement).toBeGreaterThan(lowImprovement);
  });

  it('should return improvement for all operations', () => {
    const operations: EnhancementOperation[] = [
      'denoise', 'super-resolution', 'color-correction', 'stabilization',
      'style-transfer', 'frame-interpolation', 'motion-blur-reduction',
      'hdr-tone-mapping', 'deinterlace', 'sharpen',
    ];

    for (const op of operations) {
      const params = createDefaultEnhancementParams(op);
      const improvement = estimateQualityImprovement(op, params, 50);
      expect(improvement).toBeGreaterThanOrEqual(0);
    }
  });
});

// ==================== computeStyleTransferParams ====================

describe('computeStyleTransferParams', () => {
  it('should compute params for cinematic preset', () => {
    const config: StyleTransferConfig = {
      preset: 'cinematic',
      strength: 0.7,
      preserveColors: false,
      temporalConsistency: 0.8,
    };

    const params = computeStyleTransferParams(config);
    expect(params.colorTemperature).toBeDefined();
    expect(params.saturation).toBeDefined();
    expect(params.contrast).toBeDefined();
    expect(params.vignette).toBeGreaterThanOrEqual(0);
    expect(params.edgePreservation).toBeGreaterThan(0);
    expect(params.temporalBlend).toBeGreaterThanOrEqual(0);
  });

  it('should scale with strength', () => {
    const weak: StyleTransferConfig = { preset: 'cinematic', strength: 0.2, preserveColors: false, temporalConsistency: 0.5 };
    const strong: StyleTransferConfig = { preset: 'cinematic', strength: 0.9, preserveColors: false, temporalConsistency: 0.5 };

    const weakParams = computeStyleTransferParams(weak);
    const strongParams = computeStyleTransferParams(strong);

    expect(Math.abs(strongParams.contrast - 1)).toBeGreaterThan(Math.abs(weakParams.contrast - 1));
  });

  it('should reduce color changes when preserveColors is true', () => {
    const noPreserve: StyleTransferConfig = { preset: 'vintage', strength: 0.8, preserveColors: false, temporalConsistency: 0.5 };
    const preserve: StyleTransferConfig = { preset: 'vintage', strength: 0.8, preserveColors: true, temporalConsistency: 0.5 };

    const noPreserveParams = computeStyleTransferParams(noPreserve);
    const preserveParams = computeStyleTransferParams(preserve);

    expect(Math.abs(preserveParams.saturation - 1)).toBeLessThan(Math.abs(noPreserveParams.saturation - 1));
  });

  it('should compute params for all presets', () => {
    const presets = getAvailableStylePresets();
    for (const { preset } of presets) {
      const config: StyleTransferConfig = { preset, strength: 0.5, preserveColors: false, temporalConsistency: 0.5 };
      const params = computeStyleTransferParams(config);
      expect(params).toBeDefined();
    }
  });
});

// ==================== computeColorCorrectionParams ====================

describe('computeColorCorrectionParams', () => {
  it('should compute params for auto mode', () => {
    const params = computeColorCorrectionParams('auto', 0.5);
    expect(params.brightness).toBeDefined();
    expect(params.contrast).toBeDefined();
    expect(params.saturation).toBeDefined();
  });

  it('should scale with strength', () => {
    const weak = computeColorCorrectionParams('full', 0.2);
    const strong = computeColorCorrectionParams('full', 0.9);

    expect(Math.abs(strong.brightness)).toBeGreaterThan(Math.abs(weak.brightness));
  });

  it('should compute for all modes', () => {
    const modes = ['auto', 'white-balance', 'exposure', 'contrast', 'saturation', 'full'] as const;
    for (const mode of modes) {
      const params = computeColorCorrectionParams(mode, 0.5);
      expect(params).toBeDefined();
    }
  });
});

// ==================== computeFrameInterpolationParams ====================

describe('computeFrameInterpolationParams', () => {
  it('should compute ratio for 30->60 fps', () => {
    const config: FrameInterpolationConfig = {
      sourceFrameRate: 30,
      targetFrameRate: 60,
      motionBlurReduction: false,
      motionBlurStrength: 0,
      algorithm: 'linear',
    };

    const params = computeFrameInterpolationParams(config);
    expect(params.interpolationRatio).toBe(2);
    expect(params.motionEstimationAccuracy).toBe('low');
    expect(params.blendMode).toBe('linear');
  });

  it('should use high accuracy for ai-interpolation', () => {
    const config: FrameInterpolationConfig = {
      sourceFrameRate: 24,
      targetFrameRate: 60,
      motionBlurReduction: false,
      motionBlurStrength: 0,
      algorithm: 'ai-interpolation',
    };

    const params = computeFrameInterpolationParams(config);
    expect(params.motionEstimationAccuracy).toBe('high');
    expect(params.blendMode).toBe('motion-compensated');
    expect(params.occlusionHandling).toBe(true);
  });

  it('should enable motion blur reduction when configured', () => {
    const config: FrameInterpolationConfig = {
      sourceFrameRate: 24,
      targetFrameRate: 60,
      motionBlurReduction: true,
      motionBlurStrength: 0.7,
      algorithm: 'optical-flow',
    };

    const params = computeFrameInterpolationParams(config);
    expect(params.motionBlurReductionFactor).toBe(0.7);
  });
});

// ==================== computeDenoiseParams ====================

describe('computeDenoiseParams', () => {
  it('should compute params with default values', () => {
    const params = computeDenoiseParams(0.5, 'balanced');
    expect(params.spatialSigma).toBeGreaterThan(0);
    expect(params.temporalSigma).toBeGreaterThan(0);
    expect(params.kernelSize).toBeGreaterThan(0);
    expect(params.preserveDetail).toBeGreaterThan(0);
    expect(params.iterations).toBeGreaterThan(0);
  });

  it('should use larger kernel for higher quality', () => {
    const fast = computeDenoiseParams(0.5, 'fast');
    const ultra = computeDenoiseParams(0.5, 'ultra');

    expect(ultra.kernelSize).toBeGreaterThan(fast.kernelSize);
    expect(ultra.iterations).toBeGreaterThan(fast.iterations);
  });

  it('should reduce detail preservation with higher strength', () => {
    const weak = computeDenoiseParams(0.2, 'balanced');
    const strong = computeDenoiseParams(0.9, 'balanced');

    expect(strong.preserveDetail).toBeLessThan(weak.preserveDetail);
  });
});

// ==================== executeEnhancement ====================

describe('executeEnhancement', () => {
  it('should execute denoise task successfully', () => {
    const task = createTestTask('denoise');
    const result = executeEnhancement(task, 1920, 1080, 30, 100);

    expect(result.success).toBe(true);
    expect(result.taskId).toBe(task.id);
    expect(result.operation).toBe('denoise');
    expect(result.output.width).toBe(1920);
    expect(result.output.height).toBe(1080);
    expect(result.qualityImprovement).toBeGreaterThanOrEqual(0);
  });

  it('should upscale for super-resolution', () => {
    const task = createTestTask('super-resolution', {
      params: { superResolutionScale: 4, quality: 'balanced' },
    });
    const result = executeEnhancement(task, 1920, 1080, 30, 100);

    expect(result.output.width).toBe(7680);
    expect(result.output.height).toBe(4320);
  });

  it('should change frame rate for frame-interpolation', () => {
    const task = createTestTask('frame-interpolation', {
      params: { targetFrameRate: 120, quality: 'balanced' },
    });
    const result = executeEnhancement(task, 1920, 1080, 30, 100);

    expect(result.output.frameRate).toBe(120);
  });

  it('should warn for 4K super-resolution', () => {
    const task = createTestTask('super-resolution');
    const result = executeEnhancement(task, 3840, 2160, 30, 100);

    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('should warn for high denoise strength', () => {
    const task = createTestTask('denoise', {
      params: { denoiseStrength: 0.9, quality: 'balanced' },
    });
    const result = executeEnhancement(task, 1920, 1080, 30, 100);

    expect(result.warnings.some((w) => w.includes('去噪'))).toBe(true);
  });
});

// ==================== executeBatchEnhancement ====================

describe('executeBatchEnhancement', () => {
  it('should execute multiple tasks', () => {
    const config = createTestBatchConfig({
      tasks: [
        createTestTask('denoise'),
        createTestTask('color-correction'),
        createTestTask('sharpen'),
      ],
    });

    const result = executeBatchEnhancement(config, 1920, 1080, 30, 100);

    expect(result.results.length).toBe(3);
    expect(result.successCount).toBe(3);
    expect(result.failureCount).toBe(0);
  });

  it('should sort by priority', () => {
    const config = createTestBatchConfig({
      tasks: [
        createTestTask('denoise', { priority: 1, id: 'low' }),
        createTestTask('sharpen', { priority: 10, id: 'high' }),
      ],
    });

    const result = executeBatchEnhancement(config, 1920, 1080, 30, 100);

    expect(result.results[0].taskId).toBe('high');
    expect(result.results[1].taskId).toBe('low');
  });

  it('should handle preview mode', () => {
    const config = createTestBatchConfig({
      tasks: [createTestTask('denoise')],
      previewMode: true,
    });

    const result = executeBatchEnhancement(config, 1920, 1080, 30, 100);

    expect(result.results[0].warnings).toContain('预览模式：结果为估算值');
  });

  it('should calculate average quality improvement', () => {
    const config = createTestBatchConfig({
      tasks: [
        createTestTask('denoise'),
        createTestTask('sharpen'),
      ],
    });

    const result = executeBatchEnhancement(config, 1920, 1080, 30, 100);

    expect(result.averageQualityImprovement).toBeGreaterThanOrEqual(0);
  });
});

// ==================== validateEnhancementParams ====================

describe('validateEnhancementParams', () => {
  it('should accept valid params', () => {
    expect(validateEnhancementParams(createDefaultEnhancementParams('denoise'))).toBe(true);
  });

  it('should reject invalid denoiseStrength', () => {
    expect(validateEnhancementParams({ denoiseStrength: -0.1 })).toBe(false);
    expect(validateEnhancementParams({ denoiseStrength: 1.1 })).toBe(false);
  });

  it('should reject invalid targetFrameRate', () => {
    expect(validateEnhancementParams({ targetFrameRate: 0 })).toBe(false);
    expect(validateEnhancementParams({ targetFrameRate: 300 })).toBe(false);
  });
});

// ==================== validateBatchEnhancementConfig ====================

describe('validateBatchEnhancementConfig', () => {
  it('should accept valid config', () => {
    expect(validateBatchEnhancementConfig(createTestBatchConfig())).toBe(true);
  });

  it('should reject invalid maxParallel', () => {
    expect(validateBatchEnhancementConfig(createTestBatchConfig({ maxParallel: 0 }))).toBe(false);
    expect(validateBatchEnhancementConfig(createTestBatchConfig({ maxParallel: 20 }))).toBe(false);
  });

  it('should reject tasks with invalid priority', () => {
    const config = createTestBatchConfig({
      tasks: [{ id: 'bad', operation: 'denoise', params: {}, priority: 0 }],
    });
    expect(validateBatchEnhancementConfig(config)).toBe(false);
  });
});

// ==================== getAvailableStylePresets ====================

describe('getAvailableStylePresets', () => {
  it('should return all presets', () => {
    const presets = getAvailableStylePresets();
    expect(presets.length).toBe(10);
  });

  it('should have name and description for each preset', () => {
    const presets = getAvailableStylePresets();
    for (const preset of presets) {
      expect(preset.preset).toBeTruthy();
      expect(preset.name).toBeTruthy();
      expect(preset.description).toBeTruthy();
    }
  });
});

// ==================== executeBatchEnhancementSafe ====================

describe('executeBatchEnhancementSafe', () => {
  it('should return result for valid config', async () => {
    const config = createTestBatchConfig({
      tasks: [createTestTask('denoise')],
    });
    const result = await executeBatchEnhancementSafe(config, 1920, 1080, 30, 100);
    expect(result.error).toBeNull();
    expect(result.data.successCount).toBe(1);
  });

  it('should return error for invalid config', async () => {
    const config = createTestBatchConfig({ maxParallel: 0 });
    const result = await executeBatchEnhancementSafe(config, 1920, 1080, 30, 100);
    expect(result.error).toBeTruthy();
  });
});

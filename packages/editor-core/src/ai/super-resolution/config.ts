/**
 * Configuration defaults and validation for super-resolution
 */

import type { SuperResolutionConfig } from './types';

/**
 * 创建默认超分辨率配置
 */
export function createDefaultSuperResolutionConfig(): SuperResolutionConfig {
  return {
    scaleFactor: 4,
    model: 'auto',
    denoiseStrength: 0.3,
    sharpenStrength: 0.5,
    preserveFaces: true,
    temporalConsistency: true,
    outputQuality: 0.9,
    gpuMode: 'auto',
    batchSize: 4,
    tileSize: 512,
    tileOverlap: 32,
  };
}

/**
 * 验证超分辨率配置
 */
export function validateSuperResolutionConfig(config: SuperResolutionConfig): string[] {
  const errors: string[] = [];
  if (config.scaleFactor !== 2 && config.scaleFactor !== 4) {
    errors.push('缩放因子必须为 2 或 4');
  }
  if (config.denoiseStrength < 0 || config.denoiseStrength > 1) {
    errors.push('降噪强度必须在 0-1 之间');
  }
  if (config.sharpenStrength < 0 || config.sharpenStrength > 1) {
    errors.push('锐化强度必须在 0-1 之间');
  }
  if (config.outputQuality < 0 || config.outputQuality > 1) {
    errors.push('输出质量必须在 0-1 之间');
  }
  if (config.tileSize < 32 || config.tileSize > 2048) {
    errors.push('瓦片大小必须在 32-2048 之间');
  }
  if (config.tileOverlap < 0 || config.tileOverlap >= config.tileSize / 2) {
    errors.push('瓦片重叠必须小于瓦片大小的一半');
  }
  if (config.batchSize < 1 || config.batchSize > 32) {
    errors.push('批处理大小必须在 1-32 之间');
  }
  return errors;
}

/**
 * Default configuration and validation for intelligent sync
 */

import type { IntelligentSyncConfig } from './types';

/**
 * Create default intelligent sync configuration
 */
export function createDefaultIntelligentSyncConfig(): IntelligentSyncConfig {
  return {
    method: 'hybrid',
    audioWeight: 0.6,
    visualWeight: 0.4,
    maxOffset: 10,
    confidenceThreshold: 0.5,
    enableDriftDetection: true,
    driftWindow: 60,
    contentWindow: 1,
    minSwitchInterval: 1.5,
  };
}

/**
 * Validate intelligent sync configuration
 */
export function validateIntelligentSyncConfig(config: IntelligentSyncConfig): string[] {
  const errors: string[] = [];
  if (config.audioWeight < 0 || config.visualWeight < 0) {
    errors.push('权重不能为负数');
  }
  if (Math.abs(config.audioWeight + config.visualWeight - 1) > 0.01 && config.audioWeight + config.visualWeight > 0) {
    errors.push('音频和视觉权重之和应为 1');
  }
  if (config.maxOffset < 0 || config.maxOffset > 60) {
    errors.push('最大偏移必须在 0-60 秒之间');
  }
  if (config.confidenceThreshold < 0 || config.confidenceThreshold > 1) {
    errors.push('置信度阈值必须在 0-1 之间');
  }
  if (config.contentWindow < 0.1 || config.contentWindow > 10) {
    errors.push('内容分析窗口必须在 0.1-10 秒之间');
  }
  if (config.minSwitchInterval < 0.5 || config.minSwitchInterval > 10) {
    errors.push('切换最小间隔必须在 0.5-10 秒之间');
  }
  return errors;
}

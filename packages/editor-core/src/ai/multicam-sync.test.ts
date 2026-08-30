import { describe, it, expect } from 'vitest';
import { createDefaultIntelligentSyncConfig, validateIntelligentSyncConfig } from './multicam-sync';

describe('createDefaultIntelligentSyncConfig', () => {
  it('returns expected defaults', () => {
    const config = createDefaultIntelligentSyncConfig();
    expect(config.method).toBe('hybrid');
    expect(config.audioWeight).toBe(0.6);
    expect(config.visualWeight).toBe(0.4);
    expect(config.maxOffset).toBe(10);
    expect(config.confidenceThreshold).toBe(0.5);
    expect(config.enableDriftDetection).toBe(true);
    expect(config.driftWindow).toBe(60);
    expect(config.contentWindow).toBe(1);
    expect(config.minSwitchInterval).toBe(1.5);
  });
});

describe('validateIntelligentSyncConfig', () => {
  it('returns empty for valid config', () => {
    expect(validateIntelligentSyncConfig(createDefaultIntelligentSyncConfig())).toEqual([]);
  });

  it('reports negative weights', () => {
    const errors = validateIntelligentSyncConfig({ ...createDefaultIntelligentSyncConfig(), audioWeight: -0.1 });
    expect(errors.some((e) => e.includes('权重'))).toBe(true);
  });

  it('reports weights not summing to 1', () => {
    const errors = validateIntelligentSyncConfig({
      ...createDefaultIntelligentSyncConfig(),
      audioWeight: 0.3,
      visualWeight: 0.3,
    });
    expect(errors.some((e) => e.includes('之和'))).toBe(true);
  });

  it('reports out-of-range maxOffset', () => {
    const errors = validateIntelligentSyncConfig({ ...createDefaultIntelligentSyncConfig(), maxOffset: 100 });
    expect(errors.some((e) => e.includes('偏移'))).toBe(true);
  });

  it('reports out-of-range confidenceThreshold', () => {
    const errors = validateIntelligentSyncConfig({ ...createDefaultIntelligentSyncConfig(), confidenceThreshold: 1.5 });
    expect(errors.some((e) => e.includes('置信度'))).toBe(true);
  });

  it('reports out-of-range contentWindow', () => {
    const errors = validateIntelligentSyncConfig({ ...createDefaultIntelligentSyncConfig(), contentWindow: 0 });
    expect(errors.some((e) => e.includes('窗口'))).toBe(true);
  });

  it('reports out-of-range minSwitchInterval', () => {
    const errors = validateIntelligentSyncConfig({ ...createDefaultIntelligentSyncConfig(), minSwitchInterval: 0 });
    expect(errors.some((e) => e.includes('间隔'))).toBe(true);
  });
});

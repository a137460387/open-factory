import { describe, it, expect } from 'vitest';
import { runHwDecodeBenchmark } from './hw-decode-benchmark.mjs';

describe('hw-decode-benchmark', () => {
  it('returns a valid benchmark report structure', async () => {
    const report = await runHwDecodeBenchmark({
      frameCount: 2,
      resolutions: ['640x360'],
    });

    expect(report).toHaveProperty('generatedAt');
    expect(report).toHaveProperty('platform');
    expect(report).toHaveProperty('availableBackends');
    expect(report).toHaveProperty('testFrames', 2);
    expect(report).toHaveProperty('results');
    expect(report).toHaveProperty('summary');
    expect(Array.isArray(report.availableBackends)).toBe(true);
    expect(report.availableBackends).toContain('software');
  }, 60_000);

  it('includes software backend result for each resolution', async () => {
    const report = await runHwDecodeBenchmark({
      frameCount: 2,
      resolutions: ['640x360'],
    });

    for (const result of report.results) {
      const software = result.backends.find(b => b.backend === 'software');
      expect(software).toBeDefined();
      expect(software.label).toBe('软件解码');
    }
  }, 60_000);

  it('software decode produces valid metrics', async () => {
    const report = await runHwDecodeBenchmark({
      frameCount: 3,
      resolutions: ['640x360'],
    });

    for (const result of report.results) {
      const software = result.backends.find(b => b.backend === 'software');
      if (software?.available) {
        expect(software.avgDecodeMs).toBeGreaterThan(0);
        expect(software.fps).toBeGreaterThan(0);
        expect(software.successCount).toBeGreaterThan(0);
        expect(software.minDecodeMs).toBeGreaterThan(0);
        expect(software.maxDecodeMs).toBeGreaterThanOrEqual(software.minDecodeMs);
      }
    }
  }, 60_000);

  it('summary contains best backend per resolution', async () => {
    const report = await runHwDecodeBenchmark({
      frameCount: 2,
      resolutions: ['640x360'],
    });

    for (const item of report.summary) {
      expect(item).toHaveProperty('resolution');
      expect(item).toHaveProperty('bestBackend');
      expect(item).toHaveProperty('bestLabel');
      expect(item).toHaveProperty('bestFps');
      expect(item).toHaveProperty('softwareFps');
      expect(item).toHaveProperty('speedup');
      expect(item.bestFps).toBeGreaterThan(0);
    }
  }, 60_000);
});

import { describe, it, expect } from 'vitest';
import {
  determineMonitoringMode,
  generateVmafSamplePlan,
  buildVmafSampleCommand,
  parseVmafResult,
  analyzeVmafResults,
  generateVmafReport,
} from './vmaf-monitoring';

describe('determineMonitoringMode', () => {
  it('returns disabled when vmaf not available', () => {
    expect(determineMonitoringMode({ vmafAvailable: false, realtimeSupported: false })).toBe('disabled');
  });

  it('returns post-export by default', () => {
    expect(determineMonitoringMode({ vmafAvailable: true, realtimeSupported: false })).toBe('post-export');
  });

  it('returns realtime when supported', () => {
    expect(determineMonitoringMode({ vmafAvailable: true, realtimeSupported: true }, { mode: 'realtime' })).toBe('realtime');
  });

  it('falls back to post-export when realtime not supported', () => {
    expect(determineMonitoringMode({ vmafAvailable: true, realtimeSupported: false }, { mode: 'realtime' })).toBe('post-export');
  });

  it('returns configured mode', () => {
    expect(determineMonitoringMode({ vmafAvailable: true, realtimeSupported: true }, { mode: 'post-export' })).toBe('post-export');
  });
});

describe('generateVmafSamplePlan', () => {
  const config = { mode: 'post-export' as const, sampleInterval: 10, maxSamples: 100, modelPath: '/model', enablePerFrame: false };

  it('returns empty for disabled mode', () => {
    expect(generateVmafSamplePlan(100, { ...config, mode: 'disabled' })).toEqual([]);
  });

  it('returns empty for zero duration', () => {
    expect(generateVmafSamplePlan(0, config)).toEqual([]);
  });

  it('generates samples within duration', () => {
    const samples = generateVmafSamplePlan(100, config);
    expect(samples.length).toBeGreaterThan(0);
    for (const s of samples) {
      expect(s).toBeGreaterThan(0);
      expect(s).toBeLessThan(100);
    }
  });

  it('respects maxSamples', () => {
    const samples = generateVmafSamplePlan(10000, { ...config, maxSamples: 5 });
    expect(samples.length).toBeLessThanOrEqual(5);
  });
});

describe('buildVmafSampleCommand', () => {
  const config = { mode: 'post-export' as const, sampleInterval: 10, maxSamples: 100, modelPath: '/model/vmaf', enablePerFrame: false };

  it('builds ffmpeg command', () => {
    const cmd = buildVmafSampleCommand('/source.mp4', '/output.mp4', 10, config);
    expect(cmd).toBeDefined();
    expect(cmd.length).toBeGreaterThan(0);
    expect(cmd[0]).toBe('ffmpeg');
  });

  it('includes source path', () => {
    const cmd = buildVmafSampleCommand('/source.mp4', '/output.mp4', 10, config);
    expect(cmd.some((c) => c.includes('source'))).toBe(true);
  });
});

describe('parseVmafResult', () => {
  it('parses valid JSON', () => {
    const result = parseVmafResult(JSON.stringify({ vmaf: 85.5, ms_ssim: 0.99 }));
    expect(result).toBeDefined();
  });

  it('handles invalid JSON gracefully', () => {
    const result = parseVmafResult('not json');
    expect(result).toBeDefined();
  });

  it('handles empty string', () => {
    const result = parseVmafResult('');
    expect(result).toBeDefined();
  });
});

describe('analyzeVmafResults', () => {
  it('analyzes empty points', () => {
    const result = analyzeVmafResults([]);
    expect(result).toBeDefined();
    expect(result.samples).toEqual([]);
  });

  it('analyzes single point', () => {
    const result = analyzeVmafResults([{ timestamp: 10, vmafScore: 85 }]);
    expect(result.samples.length).toBe(1);
  });

  it('analyzes multiple points', () => {
    const points = [
      { timestamp: 0, vmafScore: 90 },
      { timestamp: 10, vmafScore: 85 },
      { timestamp: 20, vmafScore: 80 },
    ];
    const result = analyzeVmafResults(points);
    expect(result.samples.length).toBe(3);
  });
});

describe('generateVmafReport', () => {
  it('generates report from result', () => {
    const analysis = analyzeVmafResults([{ timestamp: 10, vmafScore: 85 }]);
    const result = { ...analysis, mode: 'post-export' as const, processingTimeMs: 1234 };
    const report = generateVmafReport(result);
    expect(typeof report).toBe('string');
    expect(report.length).toBeGreaterThan(0);
  });

  it('includes project name', () => {
    const analysis = analyzeVmafResults([{ timestamp: 10, vmafScore: 85 }]);
    const result = { ...analysis, mode: 'post-export' as const, processingTimeMs: 1234 };
    const report = generateVmafReport(result, 'TestProject');
    expect(report).toContain('TestProject');
  });
});

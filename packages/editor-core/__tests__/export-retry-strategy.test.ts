import { describe, it, expect } from 'vitest';
import {
  calculateRetryInterval,
  shouldAutoRetry,
  decideRetryDegrade,
  buildRetryTimelineData,
  normalizeRetryConfig,
  DEFAULT_RETRY_CONFIG,
  MAX_ALLOWED_RETRIES
} from '../src/export/export-retry-strategy';

describe('calculateRetryInterval', () => {
  it('should return 0 for attempt 0', () => {
    expect(calculateRetryInterval(DEFAULT_RETRY_CONFIG, 0)).toBe(0);
  });
  it('should return base interval for exponential attempt 1', () => {
    expect(calculateRetryInterval(DEFAULT_RETRY_CONFIG, 1)).toBe(2000);
  });
  it('should double for each exponential attempt', () => {
    expect(calculateRetryInterval(DEFAULT_RETRY_CONFIG, 2)).toBe(4000);
    expect(calculateRetryInterval(DEFAULT_RETRY_CONFIG, 3)).toBe(8000);
  });
  it('should always return base interval for fixed mode', () => {
    const config = { ...DEFAULT_RETRY_CONFIG, backoffMode: 'fixed' as const };
    expect(calculateRetryInterval(config, 1)).toBe(2000);
    expect(calculateRetryInterval(config, 3)).toBe(2000);
  });
});

describe('shouldAutoRetry', () => {
  it('should return true for retryable error within limit', () => {
    expect(shouldAutoRetry(DEFAULT_RETRY_CONFIG, 'out-of-memory', 1)).toBe(true);
  });
  it('should return false for ffmpeg-crash', () => {
    expect(shouldAutoRetry(DEFAULT_RETRY_CONFIG, 'ffmpeg-crash', 1)).toBe(false);
  });
  it('should return false when max retries reached', () => {
    expect(shouldAutoRetry(DEFAULT_RETRY_CONFIG, 'out-of-memory', 3)).toBe(false);
  });
  it('should return false for unknown errors', () => {
    expect(shouldAutoRetry(DEFAULT_RETRY_CONFIG, 'unknown', 1)).toBe(false);
  });
  it('should return false for non-retryable error kind', () => {
    const config = { ...DEFAULT_RETRY_CONFIG, retryableErrorKinds: ['out-of-memory' as const] };
    expect(shouldAutoRetry(config, 'unsupported-codec', 1)).toBe(false);
  });
});

describe('decideRetryDegrade', () => {
  it('should degrade concurrency on attempt 2', () => {
    const d = decideRetryDegrade(2);
    expect(d.shouldDegrade).toBe(true);
    expect(d.degradeType).toBe('reduce-concurrency');
  });
  it('should fallback codec on attempt 3', () => {
    const d = decideRetryDegrade(3);
    expect(d.shouldDegrade).toBe(true);
    expect(d.degradeType).toBe('fallback-codec');
  });
  it('should not degrade on attempt 1', () => {
    expect(decideRetryDegrade(1).shouldDegrade).toBe(false);
  });
  it('should not degrade on attempt 4+', () => {
    expect(decideRetryDegrade(4).shouldDegrade).toBe(false);
  });
});

describe('buildRetryTimelineData', () => {
  it('should map entries to timeline labels', () => {
    const entries = [
      { attempt: 1, timestamp: 'T1', action: 'initial-fail' as const, degraded: false, result: 'failed' as const, errorMessage: 'OOM' },
      { attempt: 2, timestamp: 'T2', action: 'retry' as const, degraded: true, degradeReason: '降低并行', result: 'success' as const }
    ];
    const data = buildRetryTimelineData(entries);
    expect(data.length).toBe(2);
    expect(data[0].label).toBe('首次失败');
    expect(data[1].label).toContain('自动重试 1');
    expect(data[1].label).toContain('降级');
    expect(data[1].status).toBe('success');
  });
});

describe('normalizeRetryConfig', () => {
  it('should clamp maxRetries to MAX_ALLOWED_RETRIES', () => {
    const config = normalizeRetryConfig({ maxRetries: 100 });
    expect(config.maxRetries).toBe(MAX_ALLOWED_RETRIES);
  });
  it('should clamp maxRetries minimum to 0', () => {
    const config = normalizeRetryConfig({ maxRetries: -5 });
    expect(config.maxRetries).toBe(0);
  });
  it('should use defaults for missing fields', () => {
    const config = normalizeRetryConfig({});
    expect(config.backoffMode).toBe('exponential');
    expect(config.baseIntervalMs).toBe(2000);
  });
  it('should default to exponential backoff', () => {
    expect(normalizeRetryConfig({}).backoffMode).toBe('exponential');
  });
});

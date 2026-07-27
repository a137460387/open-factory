import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PerformanceTracker } from '../performance-tracker';

describe('PerformanceTracker', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('trackOperation', () => {
    it('returns the result of the async function', async () => {
      const result = await PerformanceTracker.trackOperation('test', async () => 42);
      expect(result).toBe(42);
    });

    it('records duration metric on success', async () => {
      const { metrics } = await import('../metrics');
      const spy = vi.spyOn(metrics, 'histogram');
      await PerformanceTracker.trackOperation('op', async () => 'ok');
      expect(spy).toHaveBeenCalledWith('operation.op.duration', expect.any(Number));
    });

    it('records error duration metric on failure', async () => {
      const { metrics } = await import('../metrics');
      const spy = vi.spyOn(metrics, 'histogram');
      await expect(
        PerformanceTracker.trackOperation('fail', async () => {
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');
      expect(spy).toHaveBeenCalledWith('operation.fail.error_duration', expect.any(Number));
    });
  });

  describe('trackRender', () => {
    it('returns a function', () => {
      const end = PerformanceTracker.trackRender('Component');
      expect(typeof end).toBe('function');
    });
  });
});

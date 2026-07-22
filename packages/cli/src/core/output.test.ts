/**
 * CLI output.ts 测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ExitCode,
  createLogger,
  createOutput,
} from './output.js';

describe('CLI Output', () => {
  describe('ExitCode', () => {
    it('should define standard exit codes', () => {
      expect(ExitCode.SUCCESS).toBe(0);
      expect(ExitCode.GENERAL_ERROR).toBe(1);
      expect(ExitCode.QUALITY_FAILED).toBe(2);
      expect(ExitCode.DEPENDENCY_MISSING).toBe(3);
    });
  });

  describe('createLogger', () => {
    let stderrSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation((() => true) as any) as any;
    });

    it('should create logger with all methods', () => {
      const logger = createLogger('debug');
      expect(logger.debug).toBeTypeOf('function');
      expect(logger.info).toBeTypeOf('function');
      expect(logger.warn).toBeTypeOf('function');
      expect(logger.error).toBeTypeOf('function');
    });

    it('debug level should log all levels', () => {
      const logger = createLogger('debug');
      logger.debug('test-debug');
      logger.info('test-info');
      logger.warn('test-warn');
      logger.error('test-error');
      expect(stderrSpy).toHaveBeenCalledTimes(4);
    });

    it('info level should not log debug', () => {
      const logger = createLogger('info');
      logger.debug('test-debug');
      logger.info('test-info');
      logger.warn('test-warn');
      logger.error('test-error');
      expect(stderrSpy).toHaveBeenCalledTimes(3);
    });

    it('warn level should only log warn and error', () => {
      const logger = createLogger('warn');
      logger.debug('test-debug');
      logger.info('test-info');
      logger.warn('test-warn');
      logger.error('test-error');
      expect(stderrSpy).toHaveBeenCalledTimes(2);
    });

    it('error level should only log error', () => {
      const logger = createLogger('error');
      logger.debug('test-debug');
      logger.info('test-info');
      logger.warn('test-warn');
      logger.error('test-error');
      expect(stderrSpy).toHaveBeenCalledTimes(1);
    });

    it('silent level should not log anything', () => {
      const logger = createLogger('silent');
      logger.debug('test-debug');
      logger.info('test-info');
      logger.warn('test-warn');
      logger.error('test-error');
      expect(stderrSpy).toHaveBeenCalledTimes(0);
    });

    it('should format message with args', () => {
      const logger = createLogger('debug');
      logger.info('test', { key: 'value' });
      const written = stderrSpy.mock.calls[0]?.[0] as string;
      expect(written).toContain('[INFO] test');
      expect(written).toContain('"key":"value"');
    });

    it('should not append args when none provided', () => {
      const logger = createLogger('info');
      logger.info('simple message');
      const written = stderrSpy.mock.calls[0]?.[0] as string;
      expect(written).toBe('[INFO] simple message\n');
    });
  });

  describe('createOutput', () => {
    it('should create success output', () => {
      const before = Date.now();
      const output = createOutput('test-cmd', true, { result: 42 }, null, [], before);

      expect(output.success).toBe(true);
      expect(output.command).toBe('test-cmd');
      expect(output.data).toEqual({ result: 42 });
      expect(output.error).toBeNull();
      expect(output.warnings).toEqual([]);
      expect(output.meta.version).toBe('0.1.0');
      expect(output.meta.timestamp).toBeTruthy();
      expect(output.meta.duration).toBeGreaterThanOrEqual(0);
    });

    it('should create error output', () => {
      const output = createOutput('test-cmd', false, null, 'something failed', ['warn1'], Date.now());

      expect(output.success).toBe(false);
      expect(output.data).toBeNull();
      expect(output.error).toBe('something failed');
      expect(output.warnings).toEqual(['warn1']);
    });

    it('should calculate duration in seconds', () => {
      const startTime = Date.now() - 2500; // 2.5 seconds ago
      const output = createOutput('cmd', true, null, null, [], startTime);
      expect(output.meta.duration).toBeGreaterThanOrEqual(2);
      expect(output.meta.duration).toBeLessThan(4);
    });
  });
});

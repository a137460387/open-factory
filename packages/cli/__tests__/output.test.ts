import { describe, test, expect, vi } from 'vitest';
import {
  ExitCode,
  createOutput,
  createLogger,
} from '../src/core/output';

describe('CLI Output Standards', () => {
  test('ExitCode values are correct', () => {
    expect(ExitCode.SUCCESS).toBe(0);
    expect(ExitCode.GENERAL_ERROR).toBe(1);
    expect(ExitCode.QUALITY_FAILED).toBe(2);
    expect(ExitCode.DEPENDENCY_MISSING).toBe(3);
  });

  test('createOutput produces valid structure', () => {
    const output = createOutput('test', true, { key: 'value' }, null, [], Date.now());

    expect(output.success).toBe(true);
    expect(output.command).toBe('test');
    expect(output.data).toEqual({ key: 'value' });
    expect(output.error).toBeNull();
    expect(output.warnings).toEqual([]);
    expect(output.meta.timestamp).toBeTruthy();
    expect(output.meta.version).toBe('0.1.0');
    expect(typeof output.meta.duration).toBe('number');
  });

  test('createOutput includes warnings', () => {
    const output = createOutput('test', true, null, null, ['warning1', 'warning2'], Date.now());
    expect(output.warnings).toEqual(['warning1', 'warning2']);
  });

  test('createOutput handles errors', () => {
    const output = createOutput('test', false, null, 'something failed', [], Date.now());
    expect(output.success).toBe(false);
    expect(output.error).toBe('something failed');
    expect(output.data).toBeNull();
  });
});

describe('CLI Logger', () => {
  test('createLogger respects log level', () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const silentLogger = createLogger('silent');
    silentLogger.error('test');
    expect(stderrSpy).not.toHaveBeenCalled();

    const errorLogger = createLogger('error');
    errorLogger.error('test error');
    expect(stderrSpy).toHaveBeenCalledTimes(1);
    expect(stderrSpy.mock.calls[0][0]).toContain('[ERROR]');

    stderrSpy.mockClear();

    errorLogger.warn('test warn');
    expect(stderrSpy).not.toHaveBeenCalled();

    const debugLogger = createLogger('debug');
    debugLogger.debug('test debug');
    expect(stderrSpy).toHaveBeenCalledTimes(1);
    expect(stderrSpy.mock.calls[0][0]).toContain('[DEBUG]');

    stderrSpy.mockRestore();
  });
});

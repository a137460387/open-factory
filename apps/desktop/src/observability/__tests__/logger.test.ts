import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Logger } from '../logger';

describe('Logger', () => {
  let logger: Logger;
  let consoleDebugSpy: ReturnType<typeof vi.spyOn>;
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('logs debug messages when minLevel is debug', () => {
    logger = new Logger('debug');
    logger.debug('test message');
    expect(consoleDebugSpy).toHaveBeenCalledTimes(1);
  });

  it('does not log debug when minLevel is info', () => {
    logger = new Logger('info');
    logger.debug('should not appear');
    expect(consoleDebugSpy).not.toHaveBeenCalled();
  });

  it('logs info messages', () => {
    logger = new Logger('debug');
    logger.info('info msg');
    expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
  });

  it('logs warn messages', () => {
    logger = new Logger('debug');
    logger.warn('warn msg');
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
  });

  it('logs error messages', () => {
    logger = new Logger('debug');
    logger.error('error msg');
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
  });

  it('includes context in log output', () => {
    logger = new Logger('debug');
    logger.info('with context', { key: 'value' });
    expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
    const allArgs = consoleInfoSpy.mock.calls[0];
    const serialized = allArgs.join(' ');
    expect(serialized).toContain('value');
  });

  it('respects minLevel priority', () => {
    logger = new Logger('error');
    logger.debug('no');
    logger.info('no');
    logger.warn('no');
    logger.error('yes');
    expect(consoleDebugSpy).not.toHaveBeenCalled();
    expect(consoleInfoSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
  });

  it('supports custom transports', () => {
    const transport = { write: vi.fn() };
    logger = new Logger('debug', [transport]);
    logger.info('custom');
    expect(transport.write).toHaveBeenCalledTimes(1);
    expect(transport.write.mock.calls[0][0]).toMatchObject({
      level: 'info',
      message: 'custom',
    });
  });

  it('addTransport appends a new transport', () => {
    const transport = { write: vi.fn() };
    logger = new Logger('debug', []);
    logger.addTransport(transport);
    logger.info('added');
    expect(transport.write).toHaveBeenCalledTimes(1);
  });

  it('writes to all transports', () => {
    const t1 = { write: vi.fn() };
    const t2 = { write: vi.fn() };
    logger = new Logger('debug', [t1, t2]);
    logger.info('multi');
    expect(t1.write).toHaveBeenCalledTimes(1);
    expect(t2.write).toHaveBeenCalledTimes(1);
  });

  it('includes timestamp in ISO format', () => {
    const transport = { write: vi.fn() };
    logger = new Logger('debug', [transport]);
    logger.info('ts');
    const entry = transport.write.mock.calls[0][0];
    expect(entry.timestamp).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

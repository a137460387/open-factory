import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ErrorReporter } from '../error-reporter';

describe('ErrorReporter', () => {
  let reporter: ErrorReporter;

  beforeEach(() => {
    reporter = new ErrorReporter(true, []);
  });

  afterEach(() => {
    reporter.uninstall();
  });

  it('report calls all transports', () => {
    const transport = { report: vi.fn() };
    reporter.addTransport(transport);
    const error = new Error('test error');
    reporter.report(error, { extra: 'data' });
    expect(transport.report).toHaveBeenCalledWith(error, { extra: 'data' });
  });

  it('report does nothing when disabled', () => {
    const disabled = new ErrorReporter(false, []);
    const transport = { report: vi.fn() };
    disabled.addTransport(transport);
    disabled.report(new Error('no'));
    expect(transport.report).not.toHaveBeenCalled();
  });

  it.skipIf(typeof window === 'undefined')('install registers global error handlers', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    reporter.install();
    expect(addSpy).toHaveBeenCalledWith('error', expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
    addSpy.mockRestore();
  });

  it.skipIf(typeof window === 'undefined')('uninstall removes global error handlers', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    reporter.install();
    reporter.uninstall();
    expect(removeSpy).toHaveBeenCalledWith('error', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
    removeSpy.mockRestore();
  });

  it.skipIf(typeof window === 'undefined')('install does nothing when disabled', () => {
    const disabled = new ErrorReporter(false, []);
    const addSpy = vi.spyOn(window, 'addEventListener');
    disabled.install();
    expect(addSpy).not.toHaveBeenCalledWith('error', expect.any(Function));
    addSpy.mockRestore();
  });

  it('handles Error instances in report', () => {
    const transport = { report: vi.fn() };
    reporter.addTransport(transport);
    const error = new Error('specific');
    reporter.report(error);
    expect(transport.report).toHaveBeenCalledWith(error, undefined);
  });
});

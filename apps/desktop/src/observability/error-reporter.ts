import { logger } from './logger';

export interface ErrorTransport {
  report(error: Error, context?: Record<string, unknown>): void;
}

class ConsoleErrorTransport implements ErrorTransport {
  report(error: Error, context?: Record<string, unknown>): void {
    console.error('[ErrorReporter]', error.message, error.stack, context);
  }
}

export class ErrorReporter {
  private transports: ErrorTransport[];
  private enabled: boolean;
  private cleanupFns: Array<() => void> = [];

  constructor(
    enabled: boolean = import.meta.env.VITE_ERROR_REPORTING_ENABLED === 'true',
    transports: ErrorTransport[] = [new ConsoleErrorTransport()],
  ) {
    this.enabled = enabled;
    this.transports = transports;
  }

  addTransport(transport: ErrorTransport): void {
    this.transports.push(transport);
  }

  install(): void {
    if (!this.enabled) return;

    const onError = (event: ErrorEvent) => {
      event.preventDefault();
      this.report(event.error ?? new Error(event.message), {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      event.preventDefault();
      const error =
        event.reason instanceof Error
          ? event.reason
          : new Error(String(event.reason));
      this.report(error, { type: 'unhandledrejection' });
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);

    this.cleanupFns.push(
      () => window.removeEventListener('error', onError),
      () => window.removeEventListener('unhandledrejection', onUnhandledRejection),
    );
  }

  uninstall(): void {
    for (const fn of this.cleanupFns) fn();
    this.cleanupFns = [];
  }

  report(error: Error, context?: Record<string, unknown>): void {
    if (!this.enabled) return;
    logger.error(error.message, { ...context, stack: error.stack });
    for (const transport of this.transports) {
      transport.report(error, context);
    }
  }
}

export const errorReporter = new ErrorReporter();

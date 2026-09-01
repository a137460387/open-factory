/* eslint-disable no-console -- 这是 logger 的 ConsoleTransport 实现，必须直接调用 console */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
}

export interface LoggerTransport {
  write(entry: LogEntry): void;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class ConsoleTransport implements LoggerTransport {
  write(entry: LogEntry): void {
    const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}]`;
    const msg = entry.context
      ? `${prefix} ${entry.message} ${JSON.stringify(entry.context)}`
      : `${prefix} ${entry.message}`;
    switch (entry.level) {
      case 'debug':
        console.debug(msg);
        break;
      case 'info':
        console.info(msg);
        break;
      case 'warn':
        console.warn(msg);
        break;
      case 'error':
        console.error(msg);
        break;
    }
  }
}

export class Logger {
  private minLevel: LogLevel;
  private transports: LoggerTransport[];

  constructor(
    minLevel: LogLevel = import.meta.env.DEV ? 'debug' : 'warn',
    transports: LoggerTransport[] = [new ConsoleTransport()],
  ) {
    this.minLevel = minLevel;
    this.transports = transports;
  }

  addTransport(transport: LoggerTransport): void {
    this.transports.push(transport);
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.log('error', message, context);
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[this.minLevel]) {
      return;
    }
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
    };
    for (const transport of this.transports) {
      transport.write(entry);
    }
  }
}

export const logger = new Logger();

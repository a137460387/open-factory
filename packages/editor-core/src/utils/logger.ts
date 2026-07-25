/**
 * Lightweight application logger.
 *
 * Replaces direct console.* calls with level-filtered, prefixed output.
 * In production builds (NODE_ENV=production) debug and info are silenced.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function resolveMinLevel(): LogLevel {
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') {
    return 'warn';
  }
  return 'debug';
}

let minLevel: LogLevel = resolveMinLevel();

export function setLogLevel(level: LogLevel): void {
  minLevel = level;
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[minLevel];
}

const PREFIX = '[open-factory]';

export const logger = {
  debug(message: string, ...args: unknown[]): void {
    if (shouldLog('debug')) {
      console.debug(PREFIX, message, ...args);
    }
  },

  info(message: string, ...args: unknown[]): void {
    if (shouldLog('info')) {
      console.info(PREFIX, message, ...args);
    }
  },

  warn(message: string, ...args: unknown[]): void {
    if (shouldLog('warn')) {
      console.warn(PREFIX, message, ...args);
    }
  },

  error(message: string, ...args: unknown[]): void {
    if (shouldLog('error')) {
      console.error(PREFIX, message, ...args);
    }
  },
};

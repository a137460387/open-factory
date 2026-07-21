/**
 * CLI output and exit code standards.
 *
 * All CLI commands produce structured JSON output and use
 * standardized exit codes for CI/CD integration.
 */

export enum ExitCode {
  /** Command succeeded */
  SUCCESS = 0,
  /** General error */
  GENERAL_ERROR = 1,
  /** Quality check failed */
  QUALITY_FAILED = 2,
  /** Missing dependency */
  DEPENDENCY_MISSING = 3,
}

export interface CliOutput<T = unknown> {
  /** Whether the command succeeded */
  success: boolean;
  /** Command name */
  command: string;
  /** Result data (null on error) */
  data: T | null;
  /** Error message (null on success) */
  error: string | null;
  /** Warnings collected during execution */
  warnings: string[];
  /** Execution metadata */
  meta: {
    /** ISO timestamp */
    timestamp: string;
    /** Execution duration in seconds */
    duration: number;
    /** CLI version */
    version: string;
  };
}

export interface CliLogger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug';

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

/**
 * Create a CLI logger with the specified log level.
 */
export function createLogger(level: LogLevel): CliLogger {
  const priority = LOG_LEVEL_PRIORITY[level];

  return {
    debug(message, ...args) {
      if (priority >= 4) {
        process.stderr.write(`[DEBUG] ${message}${args.length ? ' ' + JSON.stringify(args) : ''}\n`);
      }
    },
    info(message, ...args) {
      if (priority >= 3) {
        process.stderr.write(`[INFO] ${message}${args.length ? ' ' + JSON.stringify(args) : ''}\n`);
      }
    },
    warn(message, ...args) {
      if (priority >= 2) {
        process.stderr.write(`[WARN] ${message}${args.length ? ' ' + JSON.stringify(args) : ''}\n`);
      }
    },
    error(message, ...args) {
      if (priority >= 1) {
        process.stderr.write(`[ERROR] ${message}${args.length ? ' ' + JSON.stringify(args) : ''}\n`);
      }
    },
  };
}

/**
 * Create a structured CLI output.
 */
export function createOutput<T>(
  command: string,
  success: boolean,
  data: T | null,
  error: string | null,
  warnings: string[],
  startTime: number,
): CliOutput<T> {
  return {
    success,
    command,
    data,
    error,
    warnings,
    meta: {
      timestamp: new Date().toISOString(),
      duration: Math.round((Date.now() - startTime) / 1000 * 100) / 100,
      version: '0.1.0',
    },
  };
}

/**
 * Write CLI output to stdout and exit with the specified code.
 */
export function exitWith(output: CliOutput, exitCode: ExitCode): never {
  process.stdout.write(JSON.stringify(output, null, 2) + '\n');
  process.exit(exitCode);
}

/**
 * Wrap a command handler with standardized error handling and output.
 */
export async function withCliOutput<T>(
  command: string,
  handler: () => Promise<{ data: T; warnings?: string[] }>,
): Promise<void> {
  const startTime = Date.now();

  try {
    const result = await handler();
    const output = createOutput(command, true, result.data, null, result.warnings ?? [], startTime);
    exitWith(output, ExitCode.SUCCESS);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const exitCode = isDependencyError(err) ? ExitCode.DEPENDENCY_MISSING : ExitCode.GENERAL_ERROR;
    const output = createOutput(command, false, null, message, [], startTime);
    exitWith(output, exitCode);
  }
}

function isDependencyError(err: unknown): boolean {
  if (err instanceof Error) {
    return (
      err.message.includes('ENOENT') ||
      err.message.includes('not found') ||
      err.message.includes('not installed')
    );
  }
  return false;
}

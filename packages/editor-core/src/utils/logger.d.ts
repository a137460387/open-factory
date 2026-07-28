/**
 * Lightweight application logger.
 *
 * Replaces direct console.* calls with level-filtered, prefixed output.
 * In production builds (NODE_ENV=production) debug and info are silenced.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export declare function setLogLevel(level: LogLevel): void;
export declare const logger: {
    debug(message: string, ...args: unknown[]): void;
    info(message: string, ...args: unknown[]): void;
    warn(message: string, ...args: unknown[]): void;
    error(message: string, ...args: unknown[]): void;
};
//# sourceMappingURL=logger.d.ts.map
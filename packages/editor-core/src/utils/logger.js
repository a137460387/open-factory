/**
 * Lightweight application logger.
 *
 * Replaces direct console.* calls with level-filtered, prefixed output.
 * In production builds (NODE_ENV=production) debug and info are silenced.
 */
/* eslint-disable no-console */
const LEVEL_PRIORITY = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};
function resolveMinLevel() {
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') {
        return 'warn';
    }
    return 'debug';
}
let minLevel = resolveMinLevel();
export function setLogLevel(level) {
    minLevel = level;
}
function shouldLog(level) {
    return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[minLevel];
}
const PREFIX = '[open-factory]';
export const logger = {
    debug(message, ...args) {
        if (shouldLog('debug')) {
            console.debug(PREFIX, message, ...args);
        }
    },
    info(message, ...args) {
        if (shouldLog('info')) {
            console.info(PREFIX, message, ...args);
        }
    },
    warn(message, ...args) {
        if (shouldLog('warn')) {
            console.warn(PREFIX, message, ...args);
        }
    },
    error(message, ...args) {
        if (shouldLog('error')) {
            console.error(PREFIX, message, ...args);
        }
    },
};
//# sourceMappingURL=logger.js.map
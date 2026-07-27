/**
 * Resource Manager Types
 * Local resource intelligent management system
 */
/** Default resource configuration */
export const DEFAULT_RESOURCE_CONFIG = {
    proxy: {
        enabled: true,
        width: 640,
        height: 360,
        bitrate: 1000000,
        codec: 'h264',
        autoGenerate: true,
        generateThreshold: 100 * 1024 * 1024, // 100MB
    },
    cache: {
        maxSize: 5 * 1024 * 1024 * 1024, // 5GB
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        autoCleanup: true,
        cleanupThreshold: 4 * 1024 * 1024 * 1024, // 4GB
    },
    duplicates: {
        enabled: true,
        hashAlgorithm: 'sha256',
        similarityThreshold: 0.95,
        autoRemove: false,
    },
    unused: {
        enabled: true,
        olderThan: 30, // 30 days
        excludePatterns: ['*.project', '*.aep', '*.prproj'],
    },
    performance: {
        maxConcurrentOps: 2,
        backgroundProcessing: true,
        throttleIO: true,
    },
};
//# sourceMappingURL=types.js.map
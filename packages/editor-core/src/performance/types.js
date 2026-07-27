/**
 * Performance Monitor Types
 * Real-time performance monitoring and optimization center
 */
/** Default monitor configuration */
export const DEFAULT_MONITOR_CONFIG = {
    sampleInterval: 1000,
    historyRetention: 60,
    enableGpu: true,
    thresholds: {
        cpuWarning: 70,
        cpuCritical: 90,
        memoryWarning: 75,
        memoryCritical: 90,
        gpuWarning: 80,
        gpuCritical: 95,
        diskWarning: 80,
        diskCritical: 95,
    },
    optimization: {
        enableAutoOptimize: false,
        preferQuality: true,
        maxConcurrentTasks: 2,
        throttleBackground: true,
    },
};
//# sourceMappingURL=types.js.map
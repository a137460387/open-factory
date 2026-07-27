export type MulticamSyncConfidence = 'high' | 'medium' | 'low';
export interface MulticamSyncWindowResult {
    windowIndex: number;
    startTime: number;
    endTime: number;
    offsetSeconds: number;
    score: number;
}
export interface MulticamSyncDriftReport {
    hasDrift: boolean;
    slope: number;
    intercept: number;
    rSquared: number;
    driftRateMsPerMin: number;
    message: string;
}
export interface MulticamAtempoSegment {
    startTime: number;
    endTime: number;
    tempoFactor: number;
}
export interface MulticamSyncReport {
    clipId: string;
    medianOffsetSeconds: number;
    medianOffsetMs: number;
    windowResults: MulticamSyncWindowResult[];
    drift: MulticamSyncDriftReport;
    confidence: MulticamSyncConfidence;
    atempoSegments: MulticamAtempoSegment[];
}
export interface MulticamSyncOptions {
    windowDurationSeconds?: number;
    sampleRate?: number;
    maxOffsetSeconds?: number;
    driftDetectionThresholdMsPerMin?: number;
}
export declare function calculateSegmentedOffsets(referenceSamples: ArrayLike<number>, candidateSamples: ArrayLike<number>, sampleRate: number, windowDurationSeconds: number, maxOffsetSeconds: number): MulticamSyncWindowResult[];
export declare function calculateMedianOffset(windowResults: MulticamSyncWindowResult[]): number;
export declare function detectDrift(windowResults: MulticamSyncWindowResult[], thresholdMsPerMin?: number): MulticamSyncDriftReport;
export declare function generateAtempoSegments(windowResults: MulticamSyncWindowResult[], drift: MulticamSyncDriftReport): MulticamAtempoSegment[];
export declare function syncMulticamAudio(referenceSamples: ArrayLike<number>, candidateSamples: ArrayLike<number>, clipId: string, options?: MulticamSyncOptions): MulticamSyncReport;
//# sourceMappingURL=multicam-audio-sync.d.ts.map
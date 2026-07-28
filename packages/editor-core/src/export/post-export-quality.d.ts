export type PostExportQualityCheckId = 'duration' | 'blackFrames' | 'silence' | 'fileSize' | 'resolution';
export type PostExportQualityStatus = 'pass' | 'warning' | 'fail';
export interface PostExportQualityAssuranceSettings {
    enabled: boolean;
    duration: boolean;
    blackFrames: boolean;
    silence: boolean;
    fileSize: boolean;
    resolution: boolean;
    minFileSizeBytes?: number;
    maxFileSizeBytes?: number;
    blackFrameDurationSeconds: number;
    silenceThresholdDb: number;
    silenceDurationSeconds: number;
    autoRetry: boolean;
}
export interface DetectedMediaRange {
    start: number;
    end: number;
    duration: number;
}
export interface PostExportQualityCheckResult {
    id: PostExportQualityCheckId;
    status: PostExportQualityStatus;
    message: string;
    expected?: string | number;
    actual?: string | number;
    ranges?: DetectedMediaRange[];
}
export interface PostExportQualityAssuranceResult {
    status: PostExportQualityStatus;
    checks: PostExportQualityCheckResult[];
    retryRecommended: boolean;
    completedAt: string;
}
export interface PostExportQualityMeasurements {
    expectedDuration?: number;
    actualDuration?: number;
    fps?: number;
    expectedWidth?: number;
    expectedHeight?: number;
    actualWidth?: number;
    actualHeight?: number;
    fileSizeBytes?: number;
    blackFrames?: DetectedMediaRange[];
    silence?: DetectedMediaRange[];
}
export declare const DEFAULT_POST_EXPORT_QUALITY_ASSURANCE_SETTINGS: PostExportQualityAssuranceSettings;
export declare function normalizePostExportQualityAssuranceSettings(settings: Partial<PostExportQualityAssuranceSettings> | undefined): PostExportQualityAssuranceSettings;
export declare function hasEnabledPostExportQualityChecks(settings: PostExportQualityAssuranceSettings): boolean;
export declare function buildPostExportBlackDetectArgs(outputPath: string, minDurationSeconds?: number): string[];
export declare function buildPostExportSilenceDetectArgs(outputPath: string, thresholdDb?: number, minDurationSeconds?: number): string[];
export declare function parseBlackDetectOutput(text: string): DetectedMediaRange[];
export declare function parseSilenceDetectOutput(text: string): DetectedMediaRange[];
export declare function buildPostExportQualityAssuranceResult(settings: PostExportQualityAssuranceSettings, measurements: PostExportQualityMeasurements, completedAt?: string): PostExportQualityAssuranceResult;
export declare function summarizePostExportQualityStatus(checks: PostExportQualityCheckResult[]): PostExportQualityStatus;
export declare function shouldRetryPostExportQuality(result: Pick<PostExportQualityAssuranceResult, 'status'>, settings: Pick<PostExportQualityAssuranceSettings, 'autoRetry'>, retryAttempt: number): boolean;
//# sourceMappingURL=post-export-quality.d.ts.map
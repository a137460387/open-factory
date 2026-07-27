export interface DecodedAudioSamples {
    channels: Float32Array[];
    sampleRate: number;
    duration?: number;
}
export interface SilenceDetectionOptions {
    thresholdDb?: number;
    minSilenceDuration?: number;
    marginDuration?: number;
    frameDuration?: number;
}
export interface SilentRange {
    start: number;
    end: number;
    duration: number;
}
export interface NormalizedSilenceDetectionOptions {
    thresholdDb: number;
    minSilenceDuration: number;
    marginDuration: number;
    frameDuration: number;
}
export declare function calculateRms(channels: Float32Array[], startSample?: number, endSample?: number): number;
export declare function amplitudeToDb(amplitude: number): number;
export declare function normalizeSilenceDetectionOptions(options?: SilenceDetectionOptions): NormalizedSilenceDetectionOptions;
export declare function findSilentRanges(audio: DecodedAudioSamples, options?: SilenceDetectionOptions): SilentRange[];
export declare function mergeCloseSilentRanges(ranges: SilentRange[], marginDuration: number): SilentRange[];
export declare function applySilenceMargins(ranges: SilentRange[], maxDuration: number, marginDuration: number): SilentRange[];
//# sourceMappingURL=silence-detection.d.ts.map
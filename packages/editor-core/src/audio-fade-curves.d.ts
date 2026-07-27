export type AudioFadeCurveType = 'linear' | 'logarithmic' | 'exponential' | 's-curve';
export declare const AUDIO_FADE_CURVE_TYPES: readonly AudioFadeCurveType[];
export interface AudioFadeCurveMapping {
    curveType: AudioFadeCurveType;
    ffmpegCurve: string;
    label: string;
}
export declare const AUDIO_FADE_CURVE_MAPPINGS: readonly AudioFadeCurveMapping[];
export declare function mapAudioFadeCurveToFfmpeg(curve: AudioFadeCurveType): string;
export declare function mapFfmpegCurveToAudioFadeCurve(ffmpegCurve: string): AudioFadeCurveType;
export declare function getAudioFadeCurveLabel(curve: AudioFadeCurveType): string;
export declare function inferCurveTypeFromHandleAngle(angleDegrees: number): AudioFadeCurveType;
export declare function getFadeCurveSamplePoints(curve: AudioFadeCurveType, steps?: number): Array<{
    x: number;
    y: number;
}>;
export declare function evaluateFadeCurve(curve: AudioFadeCurveType, t: number): number;
export declare function normalizeAudioFadeCurveType(value: unknown): AudioFadeCurveType;
//# sourceMappingURL=audio-fade-curves.d.ts.map
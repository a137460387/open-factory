import type { ClipPitchDataPoint } from './model-types';
export interface PitchDetectionOptions {
    minFrequency?: number;
    maxFrequency?: number;
    threshold?: number;
}
export interface PitchFrameAnalysisOptions extends PitchDetectionOptions {
    frameSize?: number;
    hopSize?: number;
}
export interface PitchSummary {
    primaryNote?: string;
    minHz?: number;
    maxHz?: number;
    stability: number;
    sampleCount: number;
}
export declare function detectPitchYin(samples: ArrayLike<number>, sampleRate: number, options?: PitchDetectionOptions): number | undefined;
export declare function analyzePitchFrames(samples: ArrayLike<number>, sampleRate: number, options?: PitchFrameAnalysisOptions): ClipPitchDataPoint[];
export declare function hzToNoteName(hz: number): string;
export declare function noteNameToPitchClass(note: string | undefined): string;
export declare function pitchNoteColor(note: string | undefined): string;
export declare function summarizePitchData(data: readonly ClipPitchDataPoint[] | undefined): PitchSummary;
export declare function normalizeClipPitchData(data: unknown): ClipPitchDataPoint[] | undefined;
export declare function serializePitchDataCsv(data: readonly ClipPitchDataPoint[] | undefined): string;
//# sourceMappingURL=audio-pitch.d.ts.map
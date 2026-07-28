import type { ClipAudioRestoration, ClipAudioRestorationGap } from './model-types';
export declare const AUDIO_FILL_GAP_THRESHOLD_SECONDS = 0.1;
export declare const DEFAULT_AUDIO_RESTORATION: ClipAudioRestoration;
type PartialAudioRestoration = Partial<{
    [Key in keyof ClipAudioRestoration]: Partial<ClipAudioRestoration[Key]>;
}>;
export interface AudioRestorationFilterOptions {
    duration?: number;
}
export interface AudioRestorationWaveformComparison {
    before: number[];
    after: number[];
    changed: boolean;
}
export declare function normalizeAudioRestoration(restoration: PartialAudioRestoration | undefined): ClipAudioRestoration;
export declare function isAudioRestorationEnabled(restoration: PartialAudioRestoration | undefined): boolean;
export declare function buildAudioRestorationFilterArgs(restoration: PartialAudioRestoration | undefined, options?: AudioRestorationFilterOptions): string[];
export declare function buildAudioRestorationFilterChain(restoration: PartialAudioRestoration | undefined, options?: AudioRestorationFilterOptions): string;
export declare function detectAudioFillGaps(gaps: ClipAudioRestorationGap[] | undefined, threshold?: number): ClipAudioRestorationGap[];
export declare function buildAudioRestorationWaveformComparison(peaks: number[] | undefined, restoration: PartialAudioRestoration | undefined): AudioRestorationWaveformComparison;
export {};
//# sourceMappingURL=audio-restoration.d.ts.map
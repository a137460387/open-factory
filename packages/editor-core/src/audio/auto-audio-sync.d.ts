export type AutoAudioSyncConfidence = 'high' | 'medium' | 'low';
export type AutoAudioSyncApplyMode = 'keep-secondary' | 'replace-primary-audio';
export interface AutoAudioSyncTrackInput {
    clipId: string;
    samples: ArrayLike<number>;
    sampleRate: number;
}
export interface AutoAudioSyncCorrelationPeak {
    lagSamples: number;
    offsetSeconds: number;
    score: number;
    overlapSamples: number;
}
export interface AutoAudioSyncRefinement {
    lagSamples: number;
    offsetSeconds: number;
    rmsError: number;
    overlapSamples: number;
}
export interface AutoAudioSyncResult {
    clipId: string;
    offsetSeconds: number;
    offsetMs: number;
    coarseOffsetSeconds: number;
    refinedOffsetSeconds: number;
    peakScore: number;
    confidence: AutoAudioSyncConfidence;
    applied: boolean;
}
export interface AutoAudioSyncOptions {
    targetSampleRate?: number;
    maxDurationSeconds?: number;
    maxOffsetSeconds?: number;
    fineSearchWindowSeconds?: number;
}
export interface AutoAudioSyncApplyRoute {
    mode: AutoAudioSyncApplyMode;
    offsetsByClipId: Record<string, number>;
    skippedLowConfidenceClipIds: string[];
    mutePrimaryClipId?: string;
}
export declare function prepareAudioSyncSamples(samples: ArrayLike<number>, sourceSampleRate: number, options?: Pick<AutoAudioSyncOptions, 'targetSampleRate' | 'maxDurationSeconds'>): number[];
export declare function findAudioSyncCorrelationPeak(referenceSamples: ArrayLike<number>, candidateSamples: ArrayLike<number>, sampleRate: number, maxOffsetSeconds?: number): AutoAudioSyncCorrelationPeak;
export declare function refineAudioSyncOffsetByRms(referenceSamples: ArrayLike<number>, candidateSamples: ArrayLike<number>, sampleRate: number, coarseOffsetSeconds: number, searchWindowSeconds?: number): AutoAudioSyncRefinement;
export declare function labelAutoAudioSyncConfidence(score: number): AutoAudioSyncConfidence;
export declare function analyzeAutoAudioSyncTracks(reference: AutoAudioSyncTrackInput, candidates: AutoAudioSyncTrackInput[], options?: AutoAudioSyncOptions): AutoAudioSyncResult[];
export declare function resolveAutoAudioSyncApplyRoute(primaryClipId: string, results: AutoAudioSyncResult[], mode?: AutoAudioSyncApplyMode): AutoAudioSyncApplyRoute;
export declare function normalizeAutoAudioSyncApplyMode(mode: string | undefined): AutoAudioSyncApplyMode;
//# sourceMappingURL=auto-audio-sync.d.ts.map
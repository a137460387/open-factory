import type { ClipContentAnalysis } from './content-analysis';
import type { AudioClip, Clip, MediaAsset } from './model-types';
export interface SmartDialogueInterval {
    start: number;
    end: number;
    duration?: number;
    confidence?: number;
}
export type SmartRoughCutMediaClip = Extract<Clip, {
    type: 'video';
}> | Extract<Clip, {
    type: 'audio';
}>;
export type SmartRoughCutVisualClip = Extract<Clip, {
    type: 'video';
}> | Extract<Clip, {
    type: 'image';
}>;
export interface SmartRoughCutKeywordSource {
    name?: string;
    path?: string;
    type?: string;
    keywords?: string[];
    contentAnalysis?: ClipContentAnalysis;
}
export type SmartRoughCutBrollCandidate = {
    kind: 'clip';
    clip: SmartRoughCutVisualClip;
    keywords?: string[];
} | {
    kind: 'media';
    asset: MediaAsset;
    contentAnalysis?: ClipContentAnalysis;
    keywords?: string[];
};
export declare function buildDialogueRoughCutClips(sourceClip: SmartRoughCutMediaClip, intervals: SmartDialogueInterval[]): SmartRoughCutMediaClip[];
export declare function scoreBrollKeywordMatch(main: SmartRoughCutKeywordSource, candidate: SmartRoughCutKeywordSource): number;
export declare function buildBrollInsertClips(mainClips: SmartRoughCutVisualClip[], candidates: SmartRoughCutBrollCandidate[], targetTrackId: string): SmartRoughCutVisualClip[];
export declare function buildRhythmAssembleClips(videoClips: SmartRoughCutVisualClip[], beatTimes: number[], targetTrackId?: string): SmartRoughCutVisualClip[];
export declare function createVisualClipFromAsset(asset: MediaAsset, input: {
    id: string;
    name: string;
    trackId: string;
    start: number;
    duration: number;
}): SmartRoughCutVisualClip;
export interface SmartMontageConfig {
    assets: MediaAsset[];
    beatTimes: number[];
    videoTrackId: string;
    audioTrackId: string;
    audioAsset: MediaAsset;
    strategy?: 'sequential' | 'random';
}
export interface SmartMontageResult {
    visualClips: SmartRoughCutVisualClip[];
    audioClip: AudioClip;
    estimatedBpm: number;
    beatCount: number;
}
export declare function estimateBpmFromTimes(beatTimes: number[]): number;
export declare function buildSmartMontageClips(config: SmartMontageConfig): SmartMontageResult | null;
//# sourceMappingURL=smart-rough-cut-v2.d.ts.map
export interface SubtitleTranslationCue {
    id: string;
    text: string;
}
export interface SubtitleTranslationBatch {
    startIndex: number;
    cues: SubtitleTranslationCue[];
}
export declare function buildSubtitleTranslationBatches(cues: SubtitleTranslationCue[], maxBatchSize?: number): SubtitleTranslationBatch[];
//# sourceMappingURL=translation.d.ts.map
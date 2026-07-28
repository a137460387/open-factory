export interface GlossaryTerm {
    original: string;
    type: 'person' | 'product' | 'place' | 'organization' | 'terminology' | 'slang' | 'other';
    translation?: string;
}
export interface SubtitleGlossary {
    terms: GlossaryTerm[];
}
export declare function buildSubtitleGlossarySystemPrompt(): string;
export declare function buildGlossaryExtractionUserPrompt(subtitleLines: Array<{
    index: number;
    time: string;
    text: string;
}>): string;
export declare function parseSubtitleGlossaryResponse(json: unknown): SubtitleGlossary;
export declare function buildContextualTranslationSystemPrompt(glossary: GlossaryTerm[], targetLanguage: string, speakerStyle?: string): string;
export interface ContextualTranslationItem {
    index: number;
    translatedText: string;
}
export declare function parseContextualTranslationResponse(json: unknown): ContextualTranslationItem[];
export interface TranslationComparison {
    index: number;
    original: string;
    withoutContext: string;
    withContext: string;
    hasDifference: boolean;
}
/**
 * Compare two translation versions to highlight differences.
 */
export declare function compareTranslationVersions(originalTexts: string[], withoutContext: string[], withContext: string[]): TranslationComparison[];
export declare function calculateContextualTranslationBatches(subtitleCount: number, maxBatchSize?: number): number[];
//# sourceMappingURL=contextual-translation.d.ts.map
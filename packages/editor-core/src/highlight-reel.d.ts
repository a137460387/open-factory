export interface HighlightScoreWeights {
    visual: number;
    loudness: number;
    aiContent: number;
}
export interface HighlightScoreInput {
    clipId: string;
    visualScore: number;
    loudnessScore: number;
    aiScore: number;
}
export interface HighlightScore {
    clipId: string;
    visualScore: number;
    loudnessScore: number;
    aiScore: number;
    totalScore: number;
}
export declare const DEFAULT_HIGHLIGHT_WEIGHTS: HighlightScoreWeights;
/**
 * Score a single clip for highlight potential using weighted 3D scoring.
 */
export declare function scoreHighlightClip(input: HighlightScoreInput, weights?: HighlightScoreWeights): HighlightScore;
/**
 * Score all clips and return sorted by totalScore descending.
 */
export declare function scoreAllHighlightClips(inputs: HighlightScoreInput[], weights?: HighlightScoreWeights): HighlightScore[];
export interface HighlightSelection {
    selected: HighlightScore[];
    totalDuration: number;
}
/**
 * Extract top highlight clips to fit within target duration ± tolerance.
 * Selects clips in score order until the target duration is reached.
 * clipDurations maps clipId → duration in seconds.
 */
export declare function extractTopHighlightClips(scores: HighlightScore[], clipDurations: Map<string, number>, targetDuration: number, tolerance?: number): HighlightSelection;
/**
 * Extract mood keywords from aiAnalysis for AI-based content scoring.
 * Returns a score 0-1 based on how many "exciting" keywords are present.
 */
export declare function scoreAIMoodKeywords(mood: string): number;
export declare function buildHighlightReelSystemPrompt(): string;
export declare function buildHighlightReelUserPrompt(description: string, candidates: Array<{
    clipId: string;
    duration: number;
    totalScore: number;
    mood?: string;
}>): string;
export declare function parseHighlightReelResponse(json: unknown): {
    selectedIds: string[];
    transitionNotes: string[];
};
//# sourceMappingURL=highlight-reel.d.ts.map
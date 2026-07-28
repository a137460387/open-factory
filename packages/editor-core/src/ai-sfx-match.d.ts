/**
 * AI sound-effect intelligent matching and recommendation.
 *
 * Detects action candidate points from motion magnitude spikes
 * (motion delta > 50%), maps AI response categories to local SFX library,
 * and provides timeline insertion support.
 */
export interface ActionCandidatePoint {
    time: number;
    previousMagnitude: number;
    currentMagnitude: number;
    deltaRatio: number;
}
export interface SfxLibraryEntry {
    id: string;
    category: string;
    filename: string;
    duration: number;
}
export interface SfxMatchSuggestion {
    time: number;
    category: string;
    confidence: number;
    matchedAssetId: string | null;
    status: 'pending' | 'accepted' | 'rejected';
}
export interface SfxAISuggestion {
    time: number;
    soundEffectCategory: string;
    reason: string;
    confidence: number;
}
export interface SfxAIResponse {
    suggestions: SfxAISuggestion[];
}
export interface SfxCandidateMoment {
    time: number;
    sceneTag?: string;
    nearbySubtitle?: string;
}
export declare const ACTION_DELTA_RATIO_THRESHOLD = 0.5;
export declare const MIN_SUGGESTION_CONFIDENCE = 0.3;
export declare function detectActionCandidatePoints(motionMagnitudes: number[]): ActionCandidatePoint[];
export declare function buildSfxMatchPrompt(moments: SfxCandidateMoment[]): string;
export declare function parseSfxMatchResponse(json: string): SfxAISuggestion[];
export declare function normalizeCategory(raw: string): string;
export declare function matchLocalSfxLibrary(category: string, library: SfxLibraryEntry[]): SfxLibraryEntry | null;
export declare function buildSfxSuggestions(aiSuggestions: SfxAISuggestion[], library: SfxLibraryEntry[]): SfxMatchSuggestion[];
//# sourceMappingURL=ai-sfx-match.d.ts.map
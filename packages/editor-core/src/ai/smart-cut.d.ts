/**
 * AI smart cut suggestion engine.
 *
 * Analyzes voice activity detection (VAD) intervals and visual content
 * to automatically identify and suggest removal of redundant segments
 * such as silence, static frames, filler words, and low-content sections.
 * All functions are pure computation with no side effects.
 */
import type { ContentAnalysisVisualSample } from '../content-analysis';
/** Voice activity interval from VAD analysis. */
export interface VADInterval {
    /** Start time in seconds. */
    start: number;
    /** End time in seconds. */
    end: number;
    /** Speech confidence (0.0 ~ 1.0). */
    confidence: number;
    /** Whether this interval contains a filler word. */
    isFiller?: boolean;
}
/** A segment identified for potential removal. */
export interface CutSuggestion {
    /** Unique suggestion ID. */
    id: string;
    /** Start time of the cut region in seconds. */
    start: number;
    /** End time of the cut region in seconds. */
    end: number;
    /** Duration in seconds. */
    duration: number;
    /** Category of redundancy. */
    reason: CutReason;
    /** Confidence score (0.0 ~ 1.0). */
    confidence: number;
    /** Human-readable description. */
    description: string;
    /** Whether this cut has been accepted by the user. */
    accepted?: boolean;
}
/** Categories of cut suggestions. */
export type CutReason = 'silence' | 'static-frame' | 'filler-word' | 'low-energy' | 'repetitive-content' | 'long-pause';
/** Configuration for smart cut analysis. */
export interface SmartCutOptions {
    /** Minimum silence duration to suggest cut (default 1.0s). */
    minSilenceDuration?: number;
    /** Minimum static frame duration to suggest cut (default 2.0s). */
    minStaticDuration?: number;
    /** Maximum motion variance to consider "static" (default 0.05). */
    staticMotionThreshold?: number;
    /** Minimum gap between speech segments to suggest cut (default 0.8s). */
    minPauseDuration?: number;
    /** Padding to keep around speech (default 0.15s). */
    speechPadding?: number;
    /** Minimum confidence to include suggestion (default 0.4). */
    minConfidence?: number;
    /** Maximum number of suggestions (default 50). */
    maxSuggestions?: number;
    /** Enable filler word detection (default true). */
    detectFillers?: boolean;
}
/** Complete result of smart cut analysis. */
export interface SmartCutResult {
    /** List of cut suggestions sorted by time. */
    suggestions: CutSuggestion[];
    /** Total removable duration in seconds. */
    totalRemovableDuration: number;
    /** Original duration in seconds. */
    originalDuration: number;
    /** Estimated duration after applying all cuts. */
    estimatedDuration: number;
    /** Statistics by reason category. */
    stats: Record<CutReason, {
        count: number;
        duration: number;
    }>;
}
/** A contiguous speech segment. */
export interface SpeechSegment {
    start: number;
    end: number;
    confidence: number;
}
/**
 * Generate smart cut suggestions by analyzing VAD intervals and visual samples.
 *
 * @param vadIntervals - Voice activity detection intervals.
 * @param visualSamples - Visual content samples (brightness, motion, etc.).
 * @param clipDuration - Total clip duration in seconds.
 * @param options - Analysis configuration.
 * @returns Smart cut result with suggestions and statistics.
 */
export declare function generateSmartCuts(vadIntervals: VADInterval[], visualSamples: ContentAnalysisVisualSample[], clipDuration: number, options?: SmartCutOptions): SmartCutResult;
/**
 * Apply cut suggestions to a timeline, returning adjusted cut points.
 *
 * @param suggestions - Accepted cut suggestions.
 * @param clipDuration - Original clip duration.
 * @returns Array of retained time ranges.
 */
export declare function applyCutsToTimeline(suggestions: CutSuggestion[], clipDuration: number): Array<{
    start: number;
    end: number;
}>;
/**
 * Compute the impact score of a cut suggestion.
 * Higher score = more impactful removal.
 *
 * @param suggestion - The cut suggestion.
 * @param speechSegments - Surrounding speech segments.
 * @returns Impact score (0.0 ~ 1.0).
 */
export declare function computeCutImpact(suggestion: CutSuggestion, speechSegments: SpeechSegment[]): number;
/**
 * Detect low-energy segments where visual content is unchanging
 * and audio is minimal.
 */
export declare function detectLowEnergySegments(visualSamples: ContentAnalysisVisualSample[], vadIntervals: VADInterval[], duration: number, options?: {
    energyThreshold?: number;
    minDuration?: number;
}): Array<{
    start: number;
    end: number;
    confidence: number;
}>;
//# sourceMappingURL=smart-cut.d.ts.map
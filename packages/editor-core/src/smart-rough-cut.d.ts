/**
 * Smart Rough Cut Generator
 *
 * Generates rough cut suggestions by combining:
 * - Visual highlight markers
 * - Audio rhythm/beat alignment
 * - Pacing analysis
 *
 * Produces multiple cut proposals ranked by quality score.
 */
import type { VisualHighlightMarker } from './visual-highlight-engine';
import type { OnsetEvent } from './audio-rhythm-analysis';
export interface RoughCutConfig {
    /** Target output duration in seconds */
    targetDuration: number;
    /** Tolerance for duration matching (fraction, e.g. 0.1 = 10%) */
    durationTolerance: number;
    /** Minimum clip duration in seconds */
    minClipDuration: number;
    /** Maximum clip duration in seconds */
    maxClipDuration: number;
    /** Weight for visual highlight score */
    visualWeight: number;
    /** Weight for audio alignment score */
    audioWeight: number;
    /** Weight for pacing score */
    pacingWeight: number;
    /** Preferred cuts per minute for pacing */
    targetCpm: number;
}
export declare const DEFAULT_ROUGH_CUT_CONFIG: RoughCutConfig;
export interface CutPoint {
    /** Time in the source timeline (seconds) */
    time: number;
    /** Confidence score 0-1 */
    confidence: number;
    /** Why this cut point was chosen */
    reason: 'visual-highlight' | 'audio-beat' | 'combined' | 'pacing';
}
export interface RoughCutSegment {
    /** Start time in source (seconds) */
    sourceStart: number;
    /** End time in source (seconds) */
    sourceEnd: number;
    /** Duration of this segment */
    duration: number;
    /** Quality score 0-1 */
    score: number;
    /** Visual highlight score at this segment */
    visualScore: number;
    /** Audio alignment score */
    audioScore: number;
}
export interface RoughCutProposal {
    /** Unique proposal ID */
    id: string;
    /** Proposal name */
    name: string;
    /** Ordered segments */
    segments: RoughCutSegment[];
    /** Total duration */
    totalDuration: number;
    /** Overall quality score 0-1 */
    qualityScore: number;
    /** Pacing score (how well it matches target CPM) */
    pacingScore: number;
    /** Visual highlight coverage (fraction of highlights used) */
    highlightCoverage: number;
    /** Cut points */
    cutPoints: CutPoint[];
    /** Description of the proposal strategy */
    description: string;
}
export interface RoughCutResult {
    /** Generated proposals (sorted by quality) */
    proposals: RoughCutProposal[];
    /** Input highlight count */
    inputHighlightCount: number;
    /** Input beat count */
    inputBeatCount: number;
    /** Source duration */
    sourceDuration: number;
}
/**
 * Generate candidate cut points from visual highlights and audio beats.
 */
export declare function generateCutPoints(highlights: VisualHighlightMarker[], audioBeats: OnsetEvent[], sourceDuration: number, minGap?: number): CutPoint[];
/**
 * Select segments from cut points to fill target duration.
 * Uses a greedy approach: pick highest-confidence segments first.
 */
export declare function selectSegments(cutPoints: CutPoint[], sourceDuration: number, config: RoughCutConfig): RoughCutSegment[];
/**
 * Calculate pacing score based on cuts per minute.
 */
export declare function calculatePacingScore(segments: RoughCutSegment[], targetCpm: number): number;
/**
 * Calculate highlight coverage (fraction of input highlights included).
 */
export declare function calculateHighlightCoverage(segments: RoughCutSegment[], highlights: VisualHighlightMarker[]): number;
/**
 * Generate smart rough cut proposals.
 *
 * @param highlights - Visual highlight markers
 * @param audioBeats - Audio onset events
 * @param sourceDuration - Total source duration (seconds)
 * @param config - Generation configuration
 */
export declare function generateRoughCutProposals(highlights: VisualHighlightMarker[], audioBeats: OnsetEvent[], sourceDuration: number, config?: Partial<RoughCutConfig>): RoughCutResult;
/**
 * Build system prompt for AI-assisted rough cut refinement.
 */
export declare function buildRoughCutSystemPrompt(): string;
/**
 * Build user prompt for AI rough cut refinement.
 */
export declare function buildRoughCutUserPrompt(result: RoughCutResult): string;
//# sourceMappingURL=smart-rough-cut.d.ts.map
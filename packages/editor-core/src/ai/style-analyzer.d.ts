/**
 * Creator Style Analyzer
 *
 * Extracts quantitative "style fingerprints" from user's historical projects.
 * Analyzes transitions, rhythm, color grading, audio processing, and effects
 * to build a reusable style profile.
 *
 * Pipeline:
 * 1. Collect clips, transitions, effects from historical projects
 * 2. Extract per-dimension statistical features
 * 3. Build a unified StyleFingerprint JSON
 * 4. Apply style to new editing plans via blend/match
 *
 * Privacy: All analysis is local. Style fingerprints contain no media data.
 */
import type { TransitionType, Project } from '../model-types';
import type { EffectType } from '../effects';
import { type StyleSummary, type NumericStyleStat } from '../style-transfer';
/** Style fingerprint version */
export declare const STYLE_FINGERPRINT_VERSION: "1.0";
/** Transition preference extracted from history */
export interface StyleTransitionPreference {
    /** Transition type */
    type: TransitionType;
    /** Usage count */
    count: number;
    /** Average duration in seconds */
    avgDurationSec: number;
    /** Standard deviation of duration */
    durationStddev: number;
    /** Usage ratio 0-1 (relative to total transitions) */
    ratio: number;
}
/** Rhythm profile: measures pacing patterns */
export interface StyleRhythmProfile {
    /** Average clip duration in seconds */
    avgClipDurationSec: number;
    /** Stddev of clip durations */
    clipDurationStddev: number;
    /** Cuts per minute */
    cutsPerMinute: number;
    /** Rhythm regularity 0-1 (1 = very regular, 0 = highly variable) */
    regularity: number;
    /** Duration distribution histogram (bins of 0.5s, up to 30s) */
    durationHistogram: number[];
    /** Short clip ratio (clips < 2s / total) */
    shortClipRatio: number;
    /** Long clip ratio (clips > 10s / total) */
    longClipRatio: number;
}
/** Color grading style */
export interface ColorGradingStyle {
    /** Per-channel statistics */
    brightness: NumericStyleStat;
    contrast: NumericStyleStat;
    saturation: NumericStyleStat;
    hue: NumericStyleStat;
    /** Preferred LUT path (most frequently used) */
    preferredLutPath: string | null;
    /** LUT usage ratio 0-1 */
    lutUsageRatio: number;
    /** Color temperature tendency: 'warm' | 'neutral' | 'cool' */
    temperatureTendency: 'warm' | 'neutral' | 'cool';
}
/** Audio processing style */
export interface AudioProcessingStyle {
    /** Average target loudness (LUFS) */
    avgTargetLoudness: number;
    /** Loudness stddev */
    loudnessStddev: number;
    /** Preferred fade-in duration (seconds) */
    avgFadeInSec: number;
    /** Preferred fade-out duration (seconds) */
    avgFadeOutSec: number;
    /** Music-to-speech ratio preference 0-1 */
    musicSpeechRatio: number;
    /** Crossfade usage ratio 0-1 */
    crossfadeRatio: number;
}
/** Effect usage pattern */
export interface EffectUsagePattern {
    /** Effect type */
    type: EffectType;
    /** Usage count across all projects */
    totalCount: number;
    /** Usage ratio 0-1 */
    ratio: number;
    /** Average parameter values */
    avgParams: Record<string, number>;
    /** Whether typically enabled on application */
    typicallyEnabled: boolean;
}
/** Composite style fingerprint */
export interface StyleFingerprint {
    /** Schema version */
    version: typeof STYLE_FINGERPRINT_VERSION;
    /** Fingerprint unique ID */
    id: string;
    /** Human-readable name */
    name: string;
    /** Creation timestamp */
    createdAt: string;
    /** Last update timestamp */
    updatedAt: string;
    /** Number of projects analyzed */
    analyzedProjectCount: number;
    /** Total clips analyzed */
    totalClipCount: number;
    /** Total duration analyzed (seconds) */
    totalDurationSec: number;
    /** Transition preferences (sorted by usage) */
    transitions: StyleTransitionPreference[];
    /** Rhythm and pacing profile */
    rhythm: StyleRhythmProfile;
    /** Color grading style */
    colorGrading: ColorGradingStyle;
    /** Audio processing style */
    audioProcessing: AudioProcessingStyle;
    /** Effect usage patterns (sorted by usage) */
    effects: EffectUsagePattern[];
    /** User-provided description */
    description?: string;
    /** Auto-generated tags */
    tags: string[];
}
/** Options for style extraction */
export interface StyleExtractionOptions {
    /** Minimum number of clips required for valid extraction */
    minClipCount?: number;
    /** Histogram bin count for rhythm analysis */
    histogramBins?: number;
    /** Max duration for histogram bins (seconds) */
    histogramMaxDurationSec?: number;
}
/**
 * Extract a style fingerprint from a single project.
 */
export declare function extractProjectStyle(project: Project, options?: StyleExtractionOptions): StyleFingerprint | null;
/**
 * Merge multiple style fingerprints into a composite profile.
 * Weights by clip count for each dimension.
 */
export declare function mergeStyleFingerprints(fingerprints: ReadonlyArray<StyleFingerprint>, name?: string): StyleFingerprint | null;
/**
 * Apply a style fingerprint to an editing plan's parameters.
 * Returns modified instructions with style-informed adjustments.
 */
export declare function applyStyleToInstructions(instructions: ReadonlyArray<{
    action: string;
    params: Record<string, unknown>;
}>, style: StyleFingerprint, strength?: number): Array<{
    action: string;
    params: Record<string, unknown>;
}>;
/**
 * Compute similarity between two style fingerprints (0-1).
 */
export declare function computeStyleSimilarity(a: StyleFingerprint, b: StyleFingerprint): number;
/**
 * Convert a StyleSummary (from style-transfer.ts) to a partial StyleFingerprint.
 * Useful for lightweight style comparison without full project analysis.
 */
export declare function summaryToFingerprint(summary: StyleSummary, name?: string): Partial<StyleFingerprint>;
//# sourceMappingURL=style-analyzer.d.ts.map
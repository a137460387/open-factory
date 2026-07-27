/**
 * Content-Aware Template Adaptation Engine
 *
 * Analyzes media assets (duration, visual complexity, audio features)
 * and automatically adapts EditingTemplate parameters to fit the content.
 *
 * Pipeline: analyze media -> map dimensions -> apply adjustments -> return result
 * Design: pure functions, immutable operations, no classes.
 */
import type { EditingTemplate } from '../models/template-schema';
import type { Project, MediaAsset } from '../model-types';
/** Audio feature profile extracted from media metadata */
export interface AudioFeatures {
    avgLoudnessDb: number;
    peakLoudnessDb: number;
    dynamicRangeDb: number;
    dominantBand: 'bass' | 'mid' | 'treble';
    beatsPerSecond: number;
    hasSpeech: boolean;
    snrDb: number;
}
/** Visual complexity metrics (0-1 scale) */
export interface VisualComplexity {
    edgeDensity: number;
    colorVariance: number;
    motionIntensity: number;
    overallScore: number;
}
/** Result of analyzing a single media asset */
export interface MediaAnalysis {
    mediaId: string;
    durationSec: number;
    width: number;
    height: number;
    frameRate: number;
    hasAudio: boolean;
    visualComplexity: VisualComplexity | null;
    audioFeatures: AudioFeatures | null;
}
/** A single adaptation change (clip or audio level) */
export interface AdaptationChange {
    /** Target identifier: track name for clips, role name for audio */
    target: string;
    /** Index within the target (clip index, or -1 for track-level) */
    index: number;
    field: string;
    originalValue: number;
    adaptedValue: number;
    reason: string;
}
/** Complete result of template adaptation */
export interface TemplateAdaptationResult {
    template: EditingTemplate;
    changes: AdaptationChange[];
    adaptedDurationSec: number;
    summary: string;
}
/**
 * Analyze a single media asset and extract content features.
 * Uses available metadata for heuristic estimation of visual/audio properties.
 */
export declare function analyzeMedia(media: MediaAsset): MediaAnalysis;
/** Analyze multiple media assets. */
export declare function analyzeMediaBatch(assets: readonly MediaAsset[]): readonly MediaAnalysis[];
/**
 * Adapt a template to fit analyzed media content.
 *
 * - **Duration**: scales flexible clip durations to match media length
 * - **Visual complexity**: adjusts effect intensity to avoid over/under-processing
 * - **Audio**: adjusts volumes, ducking, fades to match source audio profile
 */
export declare function adaptTemplateToContent(template: EditingTemplate, analysis: MediaAnalysis): TemplateAdaptationResult;
/**
 * One-click smart adaptation: selects the primary media from the project
 * (video > image > audio) and adapts the template to fit it.
 * Returns null if no suitable media exists.
 */
export declare function createSmartAdaptation(project: Project, template: EditingTemplate): TemplateAdaptationResult | null;
//# sourceMappingURL=template-adapter.d.ts.map
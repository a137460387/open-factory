/**
 * AI-enhanced scene detection with CLIP embedding support.
 *
 * Extends the histogram-based scene detector with CLIP visual embedding
 * similarity analysis for more accurate scene boundary detection.
 * All functions are pure computation with no side effects.
 */
import type { ContentAnalysisVisualSample, ContentSceneType } from '../content-analysis';
/** CLIP embedding vector for a single frame. */
export interface CLIPFrameEmbedding {
    /** Timestamp in seconds. */
    time: number;
    /** Normalized embedding vector (typically 512 or 768 dimensions). */
    vector: Float32Array;
}
/** Configuration for CLIP-enhanced scene detection. */
export interface CLIPSceneDetectionOptions {
    /** Similarity threshold below which a scene break is detected (default 0.75). */
    similarityThreshold?: number;
    /** Minimum scene duration in seconds (default 0.5). */
    minSceneDuration?: number;
    /** Weight of CLIP similarity in combined score (default 0.6). */
    clipWeight?: number;
    /** Weight of histogram difference in combined score (default 0.3). */
    histogramWeight?: number;
    /** Weight of motion change in combined score (default 0.1). */
    motionWeight?: number;
    /** Adaptive threshold window size (default 5). */
    windowSize?: number;
    /** Sensitivity factor for adaptive threshold (default 1.0). */
    sensitivity?: number;
}
/** A scene boundary detected by CLIP-enhanced analysis. */
export interface CLIPSceneBoundary {
    /** Time of the boundary in seconds. */
    time: number;
    /** Overall confidence score (0.0 ~ 1.0). */
    confidence: number;
    /** CLIP cosine similarity at this point (0.0 ~ 1.0). */
    clipSimilarity: number;
    /** Histogram difference score (0.0 ~ 1.0). */
    histogramDiff: number;
    /** Motion change score (0.0 ~ 1.0). */
    motionDiff: number;
    /** Adaptive threshold used. */
    threshold: number;
}
/** A scene segment with classification. */
export interface CLIPSceneSegment {
    /** Segment start time in seconds. */
    start: number;
    /** Segment end time in seconds. */
    end: number;
    /** Classified scene type. */
    sceneType: ContentSceneType;
    /** Average CLIP embedding for the segment (for similarity search). */
    avgEmbedding?: Float32Array;
    /** Average brightness. */
    avgBrightness: number;
    /** Average motion. */
    avgMotion: number;
    /** Segment confidence (0.0 ~ 1.0). */
    confidence: number;
}
/** Result of CLIP-enhanced scene detection. */
export interface CLIPSceneDetectionResult {
    /** Detected scene boundaries. */
    boundaries: CLIPSceneBoundary[];
    /** Scene segments. */
    segments: CLIPSceneSegment[];
    /** Confidence curve for visualization. */
    confidenceCurve: Array<{
        time: number;
        confidence: number;
    }>;
    /** Number of frames processed. */
    frameCount: number;
}
/** Boundary refinement adjustment. */
export interface BoundaryRefinement {
    /** Original boundary time. */
    originalTime: number;
    /** Refined boundary time. */
    refinedTime: number;
    /** Refinement confidence (0.0 ~ 1.0). */
    confidence: number;
    /** Reason for refinement. */
    reason: 'snap-to-motion' | 'snap-to-audio' | 'merge-close' | 'split-long';
}
/**
 * Detect scene boundaries using CLIP embeddings combined with visual samples.
 *
 * @param embeddings - CLIP embeddings for video frames.
 * @param samples - Visual samples (brightness, motion, etc.).
 * @param options - Detection configuration.
 * @returns Detection result with boundaries and segments.
 */
export declare function detectScenesWithCLIP(embeddings: CLIPFrameEmbedding[], samples: ContentAnalysisVisualSample[], options?: CLIPSceneDetectionOptions): CLIPSceneDetectionResult;
/**
 * Refine detected boundaries by snapping to nearby motion peaks or audio events.
 *
 * @param boundaries - Detected boundaries.
 * @param samples - Visual samples for motion analysis.
 * @param audioEvents - Optional audio event times (e.g., speech onset/offset).
 * @param maxSnapDistance - Maximum snap distance in seconds (default 0.2).
 * @returns Refinement list.
 */
export declare function refineBoundaries(boundaries: CLIPSceneBoundary[], samples: ContentAnalysisVisualSample[], audioEvents?: number[], maxSnapDistance?: number): BoundaryRefinement[];
/**
 * Compute CLIP-based scene similarity for a pair of frames.
 * Returns cosine similarity (0.0 ~ 1.0).
 */
export declare function computeCLIPSimilarity(a: Float32Array, b: Float32Array): number;
/**
 * Find similar scenes across a video using CLIP embeddings.
 *
 * @param segments - Scene segments with average embeddings.
 * @param threshold - Similarity threshold (default 0.8).
 * @returns Groups of similar scene indices.
 */
export declare function findSimilarScenes(segments: CLIPSceneSegment[], threshold?: number): Array<{
    indices: number[];
    similarity: number;
}>;
//# sourceMappingURL=scene-detection.d.ts.map
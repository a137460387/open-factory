/**
 * AI scene detection algorithm.
 *
 * Detects scene boundaries in video clips using color histogram
 * difference analysis, motion vector estimation, and adaptive thresholds.
 * All functions are pure with no side effects.
 */
import type { ContentAnalysisVisualSample, ContentSceneType } from './content-analysis';
/** Configuration options for scene detection. */
export interface SceneDetectionOptions {
    /** Histogram difference threshold base (default 0.35). */
    histogramThreshold?: number;
    /** Motion intensity threshold base (default 0.55). */
    motionThreshold?: number;
    /** Minimum scene duration in seconds (default 0.5). */
    minSceneDuration?: number;
    /** Histogram bin count per HSV channel (default 8). */
    histogramBins?: number;
    /** Weight of histogram difference in combined score (default 0.6). */
    histogramWeight?: number;
    /** Weight of motion change in combined score (default 0.4). */
    motionWeight?: number;
    /** Adaptive threshold sensitivity factor (default 1.0). */
    adaptiveSensitivity?: number;
}
/** A detected scene boundary point. */
export interface SceneBoundary {
    /** Time of the scene boundary in seconds. */
    time: number;
    /** Combined detection score at this boundary (0.0 ~ 1.0). */
    score: number;
    /** HSV histogram difference score (0.0 ~ 1.0). */
    histogramDiff: number;
    /** Motion vector change score (0.0 ~ 1.0). */
    motionDiff: number;
    /** Adaptive threshold used at this boundary (0.0 ~ 1.0). */
    threshold: number;
}
/** Result of scene detection over a sequence of samples. */
export interface SceneDetectionResult {
    /** Detected scene boundaries. */
    boundaries: SceneBoundary[];
    /** Scene segments derived from boundaries. */
    segments: Array<{
        start: number;
        end: number;
        sceneType: ContentSceneType;
        avgBrightness: number;
        avgMotion: number;
    }>;
    /** Adaptive threshold curve for debugging / visualization. */
    thresholdCurve: Array<{
        time: number;
        threshold: number;
    }>;
    /** Number of input samples processed. */
    sampleCount: number;
}
/**
 * Detect scene boundaries from visual samples.
 *
 * Uses a combination of HSV histogram difference analysis and motion vector
 * estimation with an adaptive threshold to identify scene transitions.
 *
 * @param samples - Visual samples extracted from video frames.
 * @param options - Optional detection configuration.
 * @returns Detection result with boundaries, segments, and diagnostics.
 */
export declare function detectScenes(samples: ContentAnalysisVisualSample[], options?: SceneDetectionOptions): SceneDetectionResult;
//# sourceMappingURL=ai-scene-detector.d.ts.map
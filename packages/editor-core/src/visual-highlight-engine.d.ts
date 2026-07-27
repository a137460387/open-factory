/**
 * Visual Highlight Detection Engine
 *
 * Detects highlight-worthy moments in video frames using:
 * - Motion intensity analysis (frame differencing)
 * - Scene transition detection (histogram comparison)
 * - Visual energy scoring (combined metric)
 *
 * All computations are local-only, no external AI calls.
 */
export interface VisualHighlightConfig {
    /** Minimum motion intensity to consider (0-1) */
    motionThreshold: number;
    /** Minimum scene change score to flag (0-1) */
    sceneChangeThreshold: number;
    /** Sliding window size in frames for smoothing */
    windowSize: number;
    /** Minimum gap between highlight markers (seconds) */
    minGapSeconds: number;
    /** Target FPS for time conversion */
    fps: number;
}
export declare const DEFAULT_VISUAL_HIGHLIGHT_CONFIG: VisualHighlightConfig;
export interface FrameVisualMetrics {
    /** Frame index */
    frameIndex: number;
    /** Timestamp in seconds */
    time: number;
    /** Motion intensity 0-1 */
    motionIntensity: number;
    /** Scene change score 0-1 */
    sceneChangeScore: number;
    /** Combined visual energy 0-1 */
    visualEnergy: number;
}
export interface VisualHighlightMarker {
    /** Timestamp in seconds */
    time: number;
    /** Frame index */
    frameIndex: number;
    /** Highlight score 0-1 */
    score: number;
    /** Type of highlight */
    type: 'motion-peak' | 'scene-change' | 'combined';
    /** Duration of the highlight moment (seconds) */
    duration: number;
}
export interface VisualHighlightResult {
    /** All frame metrics */
    frameMetrics: FrameVisualMetrics[];
    /** Detected highlight markers */
    highlights: VisualHighlightMarker[];
    /** Normalized energy curve (for timeline display) */
    energyCurve: Array<{
        time: number;
        value: number;
    }>;
    /** Statistics */
    stats: {
        totalFrames: number;
        highlightCount: number;
        avgMotionIntensity: number;
        avgSceneChange: number;
    };
}
/**
 * Calculate motion intensity between two frames using pixel difference.
 * frames are flat grayscale arrays (width * height).
 */
export declare function calculateMotionIntensity(prevFrame: ArrayLike<number>, currFrame: ArrayLike<number>, pixelCount: number): number;
/**
 * Calculate scene change score using histogram-based comparison.
 * Divides each frame into blocks and compares average brightness.
 */
export declare function calculateSceneChangeScore(prevFrame: ArrayLike<number>, currFrame: ArrayLike<number>, width: number, height: number, gridSize?: number): number;
/**
 * Calculate combined visual energy from motion and scene change scores.
 */
export declare function calculateVisualEnergy(motionIntensity: number, sceneChangeScore: number, motionWeight?: number, sceneWeight?: number): number;
/**
 * Smooth a metric array using a sliding window average.
 */
export declare function smoothMetrics(values: number[], windowSize: number): number[];
/**
 * Find local maxima in an array that exceed a threshold.
 */
export declare function findPeaks(values: number[], threshold: number, minGap: number): Array<{
    index: number;
    value: number;
}>;
/**
 * Run full visual highlight detection on a sequence of frames.
 *
 * @param frames - Array of grayscale frame data (flat arrays)
 * @param width - Frame width in pixels
 * @param height - Frame height in pixels
 * @param config - Detection configuration
 */
export declare function detectVisualHighlights(frames: Array<ArrayLike<number>>, width: number, height: number, config?: Partial<VisualHighlightConfig>): VisualHighlightResult;
/**
 * Merge visual highlights with audio beat markers for combined scoring.
 * Highlights near audio beats get a boost.
 */
export declare function mergeWithAudioBeats(visualHighlights: VisualHighlightMarker[], audioBeatTimes: number[], toleranceSeconds?: number): VisualHighlightMarker[];
/**
 * Extract highlight time ranges for MediaBin display.
 * Groups nearby highlights into ranges.
 */
export declare function extractHighlightRanges(highlights: VisualHighlightMarker[], mergeGap?: number): Array<{
    start: number;
    end: number;
    peakScore: number;
    count: number;
}>;
//# sourceMappingURL=visual-highlight-engine.d.ts.map
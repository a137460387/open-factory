/**
 * AI auto-reframe module with subject tracking and dynamic cropping.
 *
 * Intelligently tracks subjects in video frames and generates smooth
 * crop keyframes to adapt content for different target aspect ratios.
 * All functions are pure computation with no side effects.
 */
import type { TargetAspectRatio } from '../reframe';
/** Bounding box for a detected subject or face. */
export interface SubjectBoundingBox {
    /** Left edge (0.0 ~ 1.0, normalized). */
    x: number;
    /** Top edge (0.0 ~ 1.0, normalized). */
    y: number;
    /** Width (0.0 ~ 1.0, normalized). */
    w: number;
    /** Height (0.0 ~ 1.0, normalized). */
    h: number;
}
/** A subject detected in a frame. */
export interface DetectedSubject {
    /** Unique subject ID for tracking across frames. */
    id: string;
    /** Bounding box (normalized coordinates). */
    bbox: SubjectBoundingBox;
    /** Detection confidence (0.0 ~ 1.0). */
    confidence: number;
    /** Subject type. */
    type: 'face' | 'person' | 'object' | 'text';
    /** Importance weight (0.0 ~ 1.0). Faces are typically highest. */
    importance: number;
}
/** A frame with detected subjects. */
export interface SubjectFrame {
    /** Timestamp in seconds. */
    time: number;
    /** Source video width in pixels. */
    sourceWidth: number;
    /** Source video height in pixels. */
    sourceHeight: number;
    /** Detected subjects in this frame. */
    subjects: DetectedSubject[];
}
/** A crop keyframe for the reframed output. */
export interface AutoReframeKeyframe {
    /** Time in seconds. */
    time: number;
    /** Crop X offset in pixels. */
    cropX: number;
    /** Crop Y offset in pixels. */
    cropY: number;
    /** Crop width in pixels. */
    cropW: number;
    /** Crop height in pixels. */
    cropH: number;
    /** Tracking confidence (0.0 ~ 1.0). */
    confidence: number;
    /** Primary subject ID being tracked. */
    primarySubjectId?: string;
}
/** Configuration for auto-reframe. */
export interface AutoReframeOptions {
    /** Target aspect ratio. */
    targetAspect: TargetAspectRatio;
    /** Padding around subject as fraction of crop (default 0.1). */
    padding?: number;
    /** Smoothing window size (default 5). */
    smoothingWindow?: number;
    /** Maximum crop speed in pixels/second (default 200). */
    maxCropSpeed?: number;
    /** Minimum crop width in pixels (default 320). */
    minCropWidth?: number;
    /** Minimum crop height in pixels (default 180). */
    minCropHeight?: number;
    /** Prefer faces over other subjects (default true). */
    preferFaces?: boolean;
    /** Subject importance threshold (default 0.3). */
    importanceThreshold?: number;
}
/** Result of auto-reframe analysis. */
export interface AutoReframeResult {
    /** Generated crop keyframes. */
    keyframes: AutoReframeKeyframe[];
    /** Primary subject tracking info. */
    trackingInfo: {
        /** ID of the primary subject. */
        primarySubjectId: string | null;
        /** Number of frames where subject was tracked. */
        trackedFrames: number;
        /** Total frames processed. */
        totalFrames: number;
        /** Tracking continuity score (0.0 ~ 1.0). */
        continuity: number;
    };
    /** Overall confidence (0.0 ~ 1.0). */
    confidence: number;
    /** FFmpeg crop filter expression. */
    ffmpegExpression?: string;
}
/**
 * Generate auto-reframe keyframes from subject detection data.
 *
 * @param frames - Frames with detected subjects.
 * @param options - Reframe configuration.
 * @returns Reframe result with keyframes and tracking info.
 */
export declare function generateAutoReframe(frames: SubjectFrame[], options: AutoReframeOptions): AutoReframeResult;
/**
 * Interpolate a crop window at an arbitrary time from keyframes.
 *
 * @param keyframes - Sorted keyframes.
 * @param time - Target time in seconds.
 * @returns Interpolated crop window, or undefined if no keyframes.
 */
export declare function interpolateAutoReframeAtTime(keyframes: AutoReframeKeyframe[], time: number): AutoReframeKeyframe | undefined;
/**
 * Compute multiple aspect ratio crops for the same frame data.
 * Useful for batch export to different platforms.
 *
 * @param frames - Subject frames.
 * @param aspects - Target aspect ratios.
 * @param options - Common options (excluding targetAspect).
 * @returns Map of aspect ratio to reframe result.
 */
export declare function multiAspectReframe(frames: SubjectFrame[], aspects: TargetAspectRatio[], options: Omit<AutoReframeOptions, 'targetAspect'>): Map<TargetAspectRatio, AutoReframeResult>;
/**
 * Validate that crop windows stay within source bounds.
 *
 * @param keyframes - Keyframes to validate.
 * @param sourceWidth - Source video width.
 * @param sourceHeight - Source video height.
 * @returns Validation issues.
 */
export declare function validateReframeKeyframes(keyframes: AutoReframeKeyframe[], sourceWidth: number, sourceHeight: number): Array<{
    index: number;
    issue: string;
}>;
//# sourceMappingURL=auto-reframe.d.ts.map
import type { TargetAspectRatio } from './reframe';
export declare const DEFAULT_REFrame_SAMPLE_INTERVAL = 2;
export declare const DEFAULT_SMOOTHING_WINDOW = 3;
export interface ReframeKeyframe {
    time: number;
    cropX: number;
    cropY: number;
    cropW: number;
    cropH: number;
}
export interface ReframeBoundingBox {
    x: number;
    y: number;
    w: number;
    h: number;
}
export interface ReframeAIFrame {
    time: number;
    faceBox: ReframeBoundingBox | null;
    subjectBox: ReframeBoundingBox;
}
export interface ReframeAIResult {
    frames: ReframeAIFrame[];
}
export interface ClipAIReframe {
    targetAspect: string;
    keyframes: ReframeKeyframe[];
    confidence: number;
    generatedAt: number;
}
export declare function computeSampleTimes(clipDuration: number, interval?: number, sceneCuts?: readonly number[]): number[];
export declare function bboxToCropWindow(bbox: ReframeBoundingBox, sourceWidth: number, sourceHeight: number, targetAspect: Exclude<TargetAspectRatio, 'source'>): {
    cropX: number;
    cropY: number;
    cropW: number;
    cropH: number;
};
export declare function generateReframeKeyframes(aiFrames: ReframeAIFrame[], sourceWidth: number, sourceHeight: number, targetAspect: TargetAspectRatio): ReframeKeyframe[];
export declare function smoothKeyframes(keyframes: readonly ReframeKeyframe[], windowSize?: number): ReframeKeyframe[];
export declare function interpolateReframeAtTime(keyframes: readonly ReframeKeyframe[], time: number): ReframeKeyframe | undefined;
export declare function buildReframeCropFFmpegExpression(keyframes: readonly ReframeKeyframe[]): string | undefined;
export declare function computeReframeConfidence(aiFrames: readonly ReframeAIFrame[]): number;
//# sourceMappingURL=ai-reframe.d.ts.map
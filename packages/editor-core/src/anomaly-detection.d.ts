export declare const BLACK_FRAME_LUMA_THRESHOLD = 8;
export declare const BLACK_FRAME_MERGE_GAP = 1;
export declare const STATIC_MOTION_THRESHOLD = 2;
export declare const STATIC_MIN_DURATION = 5;
export declare const SEVERITY_HIGH_STATIC_DURATION = 10;
export declare const SEVERITY_HIGH_BLACK_DURATION = 3;
export type AnomalyType = 'black' | 'static';
export type AnomalySeverity = 'low' | 'medium' | 'high';
export interface AnomalyInterval {
    type: AnomalyType;
    startTime: number;
    endTime: number;
    severity: AnomalySeverity;
}
export interface FrameAnalysisSample {
    time: number;
    lumaMean: number;
    grayscaleDiff: number;
}
export declare function isBlackFrame(lumaMean: number, threshold?: number): boolean;
export declare function classifyBlackFrameSeverity(duration: number): AnomalySeverity;
export declare function classifyStaticSeverity(duration: number): AnomalySeverity;
export declare function mergeAdjacentIntervals(times: readonly number[], maxGap?: number): Array<{
    startTime: number;
    endTime: number;
}>;
export declare function detectBlackFrameIntervals(samples: readonly FrameAnalysisSample[], lumaThreshold?: number, mergeGap?: number): AnomalyInterval[];
export declare function detectStaticIntervals(samples: readonly FrameAnalysisSample[], motionThreshold?: number, minDuration?: number): AnomalyInterval[];
export declare function detectAnomalies(samples: readonly FrameAnalysisSample[], options?: {
    lumaThreshold?: number;
    motionThreshold?: number;
    mergeGap?: number;
    minStaticDuration?: number;
}): AnomalyInterval[];
//# sourceMappingURL=anomaly-detection.d.ts.map
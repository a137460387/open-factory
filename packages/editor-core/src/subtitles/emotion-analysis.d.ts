import type { SubtitleClip, SubtitleStyle } from '../model-types';
import type { TimelineHeatmapSegment } from '../timeline-heatmap';
export type SubtitleEmotionType = 'anger' | 'joy' | 'sadness' | 'surprise' | 'neutral';
export interface SubtitleEmotionScore {
    clipId: string;
    emotion: SubtitleEmotionType;
    confidence: number;
    scores: Record<SubtitleEmotionType, number>;
}
export interface EmotionColorSuggestion {
    emotion: SubtitleEmotionType;
    color: string;
    outlineColor: string;
    label: string;
}
export interface EmotionStyledSubtitle {
    clipId: string;
    partialStyle: Partial<SubtitleStyle>;
}
/** Compute raw emotion scores from text using keyword frequency and punctuation. */
export declare function scoreEmotionFromText(text: string): Record<SubtitleEmotionType, number>;
/** Analyze a single subtitle clip and return the dominant emotion with confidence. */
export declare function analyzeSubtitleEmotion(clip: SubtitleClip): SubtitleEmotionScore;
/** Batch-analyze subtitle clips. */
export declare function analyzeSubtitleClipEmotions(clips: SubtitleClip[]): SubtitleEmotionScore[];
/** Map emotion to suggested visual style. */
export declare const EMOTION_COLOR_MAP: Record<SubtitleEmotionType, EmotionColorSuggestion>;
/** Suggest color for an emotion score result. */
export declare function suggestEmotionColor(score: SubtitleEmotionScore): EmotionColorSuggestion;
/** Build partial style overrides for a given emotion. */
export declare function buildEmotionStyleOverrides(emotion: SubtitleEmotionType): Partial<SubtitleStyle>;
/** Batch-apply emotion styles: returns a mapping of clipId → partial style. */
export declare function batchApplyEmotionStyles(scores: SubtitleEmotionScore[], filterEmotion?: SubtitleEmotionType): EmotionStyledSubtitle[];
export interface EmotionHeatmapOptions {
    bucketSeconds?: number;
    duration?: number;
}
/** Compute an emotion-intensity heatmap over the timeline, reusing the heatmap segment structure. */
export declare function calculateEmotionHeatmap(clips: SubtitleClip[], scores: SubtitleEmotionScore[], options?: EmotionHeatmapOptions): TimelineHeatmapSegment[];
export declare const EMOTION_ACCURACY_DISCLAIMER = "\u57FA\u4E8E\u5173\u952E\u8BCD\u7684\u542F\u53D1\u5F0F\u5206\u6790\uFF0C\u4EC5\u4F9B\u53C2\u8003";
//# sourceMappingURL=emotion-analysis.d.ts.map
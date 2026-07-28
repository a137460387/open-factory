/**
 * AI Emotion Analyzer.
 *
 * Analyzes emotional content from audio and visual features,
 * generating emotion curves and identifying emotional peaks.
 * Combines audio energy analysis with visual feature mapping.
 */
import type { ContentAnalysisVisualSample, ContentAnalysisAudioSample } from './content-analysis';
export interface EmotionAnalysisResult {
    curve: EmotionPoint[];
    peaks: EmotionPeak[];
    overallMood: string;
    emotionalArc: 'rising' | 'falling' | 'stable' | 'peak' | 'valley';
}
export interface EmotionPoint {
    time: number;
    value: number;
    arousal: number;
    source: 'audio' | 'visual' | 'fused';
}
export interface EmotionPeak {
    time: number;
    value: number;
    type: 'positive' | 'negative' | 'neutral';
}
export interface EmotionAnalysisOptions {
    windowSize?: number;
    peakThreshold?: number;
    audioWeight?: number;
    visualWeight?: number;
}
/**
 * Analyze emotion from visual and audio samples.
 *
 * Fuses audio energy analysis with visual feature mapping to produce
 * a comprehensive emotion curve with identified peaks.
 */
export declare function analyzeEmotion(visualSamples: ContentAnalysisVisualSample[], audioSamples?: ContentAnalysisAudioSample[], options?: EmotionAnalysisOptions): EmotionAnalysisResult;
//# sourceMappingURL=ai-emotion-analyzer.d.ts.map
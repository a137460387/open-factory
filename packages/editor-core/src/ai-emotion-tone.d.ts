/**
 * AI scene emotional tone tagging.
 *
 * Analyzes video clip middle frames to detect emotional tone.
 * Supports batch mode with concurrency ≤3 and interruptible processing.
 */
/** 最小化 Project 引用，避免循环依赖 */
interface ProjectLike {
    timeline: {
        tracks: Array<{
            clips: Array<{
                type: string;
                emotionAnalysis?: EmotionAnalysis;
                [key: string]: unknown;
            }>;
        }>;
    };
}
/** 最小化 VideoClip 引用 */
interface VideoClipLike {
    id: string;
    type: 'video';
    emotionAnalysis?: EmotionAnalysis;
    [key: string]: unknown;
}
export type EmotionTone = 'energetic' | 'calm' | 'tense' | 'happy' | 'sad' | 'neutral';
export interface EmotionAnalysis {
    emotionTone: EmotionTone;
    intensity: number;
    reason: string;
    analyzedAt: string;
}
export interface EmotionToneAIResponse {
    emotionTone: EmotionTone;
    intensity: number;
    reason: string;
}
/** Mapping of emotion tone to UI color for timeline display */
export declare const EMOTION_COLORS: Record<EmotionTone, string>;
export declare const VALID_EMOTION_TONES: readonly EmotionTone[];
/**
 * Build an AI prompt for emotion tone analysis of a clip.
 */
export declare function buildEmotionTonePrompt(sceneTag?: string): string;
/**
 * Parse AI emotion tone response JSON.
 * Returns null if invalid.
 */
export declare function parseEmotionToneResponse(json: string): EmotionToneAIResponse | null;
/**
 * Get all video clips from a project that need emotion analysis.
 * Returns clips that don't have emotionAnalysis yet.
 */
export declare function getClipsNeedingEmotionAnalysis(project: ProjectLike): VideoClipLike[];
/**
 * Batch analyze emotion tones with concurrency control.
 *
 * @param clips - Clips to analyze
 * @param analyzeFn - Async function that analyzes a single clip and returns EmotionAnalysis
 * @param maxConcurrency - Maximum concurrent requests (default 3)
 * @param signal - AbortSignal for cancellation
 * @returns Map of clipId → EmotionAnalysis for completed analyses
 */
export declare function batchAnalyzeEmotionTones(clips: VideoClipLike[], analyzeFn: (clip: VideoClipLike) => Promise<EmotionAnalysis | null>, maxConcurrency?: number, signal?: AbortSignal): Promise<Map<string, EmotionAnalysis>>;
export {};
//# sourceMappingURL=ai-emotion-tone.d.ts.map
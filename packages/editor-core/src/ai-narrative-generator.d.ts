/**
 * AI Narrative Generator.
 *
 * Generates story line suggestions based on video content analysis,
 * including scene sequences, emotion curves, and speech understanding.
 * Supports multiple narrative templates (documentary, vlog, tutorial, cinematic).
 */
import type { ContentSceneType } from './content-analysis';
import type { EmotionAnalysisResult } from './ai-emotion-analyzer';
import type { SpeechUnderstandingResult } from './ai-speech-understanding';
export type NarrativeTemplate = 'documentary' | 'vlog' | 'tutorial' | 'cinematic';
export type PacingType = 'slow' | 'moderate' | 'fast';
export interface NarrativeGenerationResult {
    storyline: StorylineSegment[];
    totalDuration: number;
    pacing: PacingType;
    template: NarrativeTemplate;
    generatedAt: string;
}
export interface StorylineSegment {
    id: string;
    sceneType: ContentSceneType;
    purpose: string;
    suggestedClips: string[];
    duration: number;
    emotionTarget: number;
    transitionType: 'cut' | 'fade' | 'dissolve' | 'wipe';
}
export interface NarrativeGenerationOptions {
    template?: NarrativeTemplate;
    targetDuration?: number;
    pacing?: PacingType;
}
/** Scene segment for narrative analysis */
export interface SceneSegment {
    start: number;
    end: number;
    sceneType: ContentSceneType;
    avgBrightness: number;
    avgMotion: number;
}
/**
 * Generate a narrative storyline based on content analysis results.
 *
 * Uses template-based generation with scene matching and emotion alignment.
 */
export declare function generateNarrative(analysisResults: {
    scenes: SceneSegment[];
    emotions: EmotionAnalysisResult;
    speech?: SpeechUnderstandingResult;
}, options?: NarrativeGenerationOptions): NarrativeGenerationResult;
//# sourceMappingURL=ai-narrative-generator.d.ts.map
/**
 * AI Smart Creation Orchestrator.
 *
 * Coordinates scene detection, emotion analysis, speech understanding,
 * narrative analysis, recommendation, and storyline generation
 * to provide a unified smart creation workflow.
 */
import type { MediaAsset } from './model-types';
import type { SceneDetectionResult, SceneDetectionOptions } from './ai-scene-detector';
import type { EmotionAnalysisResult } from './ai-emotion-analyzer';
import type { SpeechUnderstandingResult } from './ai-speech-understanding';
import type { NarrativeAnalysisResult } from './ai-narrative-analyzer';
import type { RecommendationResult } from './ai-smart-recommender';
import type { NarrativeGenerationResult, NarrativeTemplate } from './ai-narrative-generator';
export type SmartCreationPhase = 'scene_detection' | 'emotion_analysis' | 'speech_understanding' | 'narrative_analysis' | 'recommendation' | 'storyline';
export interface SmartCreationProgress {
    phase: SmartCreationPhase;
    progress: number;
    message: string;
}
export interface SmartCreationResult {
    scenes: SceneDetectionResult;
    emotions: EmotionAnalysisResult;
    speech?: SpeechUnderstandingResult;
    narrative: NarrativeAnalysisResult;
    recommendations: RecommendationResult;
    storyline?: NarrativeGenerationResult;
    analyzedAt: string;
}
export interface SmartCreationOptions {
    enableSpeechUnderstanding?: boolean;
    narrativeTemplate?: NarrativeTemplate;
    targetDuration?: number;
    pacing?: 'slow' | 'moderate' | 'fast';
    maxRecommendations?: number;
    sceneDetection?: SceneDetectionOptions;
    onProgress?: (progress: SmartCreationProgress) => void;
}
/**
 * Orchestrate the smart creation analysis pipeline.
 *
 * Runs scene detection, emotion analysis, speech understanding,
 * narrative analysis, recommendation, and optional storyline generation
 * in sequence, reporting progress via callback.
 */
export declare function orchestrateSmartCreation(media: MediaAsset[], options?: SmartCreationOptions): Promise<SmartCreationResult>;
//# sourceMappingURL=ai-smart-creation-orchestrator.d.ts.map
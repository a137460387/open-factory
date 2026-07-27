/**
 * Template Recommender Engine
 *
 * Scores and ranks editing templates based on project content characteristics
 * and user preferences. Uses weighted cosine similarity across three dimensions:
 * - Content match (40%): duration, category, pacing fit
 * - User preference (30%): historical category/pace/transition affinity
 * - Material fit (30%): how well project assets match template requirements
 */
import type { EditingTemplate, TemplateCategory } from '../models/template-schema';
import type { Project, Clip } from '../model-types';
/** Content characteristics extracted from a project */
export interface ProjectContentProfile {
    duration: number;
    clipCount: number;
    /** Average motion intensity 0-1 (derived from clip speed variance) */
    avgMotion: number;
    hasDialogue: boolean;
    /** Detected music genre hint from track names, or null */
    musicGenre: string | null;
    /** Overall mood based on pacing */
    mood: 'energetic' | 'calm' | 'neutral';
    dominantClipType: Clip['type'];
    avgClipDuration: number;
    /** Transitions per minute */
    transitionDensity: number;
}
/** User preference profile for template selection */
export interface UserPreference {
    /** Categories ordered by affinity */
    favoriteCategories: ReadonlyArray<TemplateCategory>;
    preferredPace: 'fast' | 'medium' | 'slow';
    preferredTransitions: ReadonlyArray<string>;
}
/** A scored template recommendation with reasoning */
export interface AITemplateRecommendation {
    template: EditingTemplate;
    /** Composite score 0-1 */
    score: number;
    reasons: ReadonlyArray<string>;
    matchDimensions: {
        contentMatch: number;
        preferenceMatch: number;
        materialFit: number;
    };
}
/**
 * Extract a content profile from a project's timeline.
 * Analyzes clip durations, types, transitions, and audio tracks
 * to characterize the project's editing style.
 */
export declare function extractProjectContentProfile(project: Project): ProjectContentProfile;
/**
 * Score a single template against a project profile and user preferences.
 * Uses weighted cosine similarity across content, preference, and material dimensions.
 */
export declare function scoreTemplate(template: EditingTemplate, profile: ProjectContentProfile, preferences: UserPreference): AITemplateRecommendation;
/**
 * Recommend Top-K templates from a list of candidates.
 * Scores all templates and returns the highest-scoring ones sorted by score descending.
 */
export declare function recommendTemplates(templates: ReadonlyArray<EditingTemplate>, profile: ProjectContentProfile, preferences: UserPreference, topK?: number): ReadonlyArray<AITemplateRecommendation>;
/**
 * Generate a human-readable explanation for a recommendation.
 * Includes dimension scores and individual reasons.
 */
export declare function explainRecommendation(recommendation: AITemplateRecommendation): string;
//# sourceMappingURL=template-recommender.d.ts.map
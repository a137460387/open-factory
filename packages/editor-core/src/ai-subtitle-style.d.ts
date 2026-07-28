import type { BuiltinSubtitleStyleTemplateId } from './subtitles/style-templates';
import type { AiModuleResult, TranslateFn } from './ai-module-types';
export declare const SUBTITLE_STYLE_LANDSCAPE_ONLY: BuiltinSubtitleStyleTemplateId[];
export interface SubtitleStyleVideoContext {
    width: number;
    height: number;
    isPortrait: boolean;
    mediaTags?: string[];
    scene?: string;
    mood?: string;
}
export interface SubtitleStyleRecommendation {
    templateId: string;
    reason: string;
    confidence: number;
}
export interface SubtitleStyleAIResponse {
    recommended: SubtitleStyleRecommendation[];
}
/**
 * Build video context for subtitle style AI analysis.
 */
export declare function buildSubtitleStyleVideoContext(videoMedia: {
    width?: number;
    height?: number;
    aiAnalysis?: {
        tags?: string[];
        scene?: string;
        mood?: string;
        objects?: string[];
    };
} | undefined): SubtitleStyleVideoContext;
export declare function parseSubtitleStyleResponseSafe(json: unknown, t?: TranslateFn): Promise<AiModuleResult<SubtitleStyleAIResponse>>;
/**
 * Filter out styles that are not suitable for portrait video.
 */
export declare function filterPortraitStyles(recommendations: SubtitleStyleRecommendation[], isPortrait: boolean): SubtitleStyleRecommendation[];
export declare function buildSubtitleStyleSystemPrompt(): string;
export declare function buildSubtitleStyleUserPrompt(context: SubtitleStyleVideoContext): string;
export declare function parseSubtitleStyleResponse(json: unknown): SubtitleStyleAIResponse;
//# sourceMappingURL=ai-subtitle-style.d.ts.map
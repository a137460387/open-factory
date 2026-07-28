export type AIProtocol = 'openai-compatible' | 'custom';
export interface AIProvider {
    id: string;
    name: string;
    protocol: AIProtocol;
    baseUrl: string;
    apiKey?: string;
    defaultModel: string;
    enabled: boolean;
    customHeaders?: Record<string, string>;
    isBuiltIn: boolean;
}
export interface AIUsageRecord {
    providerId: string;
    timestamp: number;
    inputTokens: number;
    outputTokens: number;
    estimatedCostCny: number;
    /** Which AI feature generated this record (optional for backward compat) */
    service?: string;
}
export interface AITestConnectionResult {
    ok: boolean;
    latencyMs?: number;
    error?: string;
}
export interface AISubtitlePolishItem {
    index: number;
    text: string;
}
export interface AIChapterResult {
    time: number;
    title: string;
}
export interface AIVisionAnalysisResult {
    tags: string[];
    scene: string;
    mood: string;
    objects: string[];
}
export interface MediaAIAnalysis {
    tags: string[];
    scene: string;
    mood: string;
    objects: string[];
    analysisTime: string;
    providerId: string;
}
export interface BuiltInProviderPreset {
    id: string;
    name: string;
    baseUrl: string;
    defaultModel: string;
    needsKey: boolean;
}
export declare const BUILT_IN_PROVIDER_PRESETS: BuiltInProviderPreset[];
export declare const VISION_KEYWORDS: string[];
export declare function createBuiltInProvider(preset: BuiltInProviderPreset): AIProvider;
export declare function createAllBuiltInProviders(): AIProvider[];
export declare function normalizeAIProvider(input: Partial<AIProvider> & {
    id: string;
}): AIProvider;
export declare function isVisionCapable(modelName: string): boolean;
export declare function isProviderConfigured(provider: AIProvider): boolean;
export declare function calculateSubtitlePolishBatchSplit(total: number, batchSize?: number): number[];
export declare function parseSubtitlePolishResponse(json: unknown): AISubtitlePolishItem[];
export declare const FILLER_WORDS_ZH: string[];
export declare function removeFillerWords(text: string, fillers?: string[]): string;
export declare function splitChapterSegments(durationSeconds: number, segmentMinSeconds?: number, segmentMaxSeconds?: number): Array<{
    start: number;
    end: number;
}>;
export declare function suggestChapterCount(durationSeconds: number): {
    min: number;
    max: number;
};
export declare function parseChapterResponse(json: unknown): AIChapterResult[];
export declare function formatChaptersYouTube(chapters: AIChapterResult[]): string;
export declare function formatChaptersBilibili(chapters: AIChapterResult[]): string;
export declare function calculateExtractFrameTimes(duration: number, maxFrames?: number): number[];
export declare function parseVisionAnalysisResponse(json: unknown): AIVisionAnalysisResult;
export declare function mergeAITags(existing: string[], newTags: string[]): string[];
export declare function estimateVisionCost(frameCount: number, model: string): {
    tokens: number;
    costCny: number;
};
export interface AIColorGradingSuggestion {
    style: string;
    issues: string[];
    suggestions: AIColorGradingSuggestionItem[];
}
export interface AIColorGradingSuggestionItem {
    parameter: string;
    currentValue?: number;
    recommendedValue: number;
    reason: string;
}
export declare const COLOR_GRADING_PARAMETER_LIMITS: Record<string, {
    min: number;
    max: number;
}>;
export declare function parseColorGradingSuggestionResponse(json: unknown): AIColorGradingSuggestion | null;
export declare function buildColorGradingSystemPrompt(): string;
export declare function mapColorParameterToColorCorrection(parameter: string, value: number): {
    brightness?: number;
    contrast?: number;
    saturation?: number;
    hue?: number;
    threeWayColor?: {
        lift?: {
            r?: number;
            g?: number;
            b?: number;
        };
        gain?: {
            r?: number;
            g?: number;
            b?: number;
        };
    };
} | null;
export declare function buildColorGradingColorCorrectionPatch(selectedItems: Array<{
    parameter: string;
    recommendedValue: number;
}>): Record<string, unknown> | null;
export interface AIRoughCutClip {
    mediaId: string;
    startTime: number;
    duration: number;
    trackIndex: number;
    reason: string;
}
export interface AIRoughCutMediaInfo {
    mediaId: string;
    filename: string;
    type: string;
    duration: number;
    tags?: string[];
    scene?: string;
    mood?: string;
}
export declare function buildMediaInfoForAI(media: Array<{
    id: string;
    name: string;
    type: string;
    duration: number;
    aiAnalysis?: {
        tags?: string[];
        scene?: string;
        mood?: string;
    };
}>): AIRoughCutMediaInfo[];
export declare function buildRoughCutSystemPrompt(): string;
export declare function parseRoughCutAIResponse(json: unknown): AIRoughCutClip[];
export declare function buildRoughCutUserPrompt(description: string, mediaInfo: AIRoughCutMediaInfo[]): string;
export declare const ROUGH_CUT_TEMPLATES: Array<{
    id: string;
    name: string;
    segments: Array<{
        label: string;
        defaultDuration: number;
    }>;
}>;
export type TTSEngine = 'elevenlabs' | 'openai' | 'compatible';
export interface TTSConfig {
    providerId: string;
    baseUrl: string;
    engine: TTSEngine;
    voiceId: string;
    speed: number;
    /** ElevenLabs stability parameter (0-1), ignored for other engines */
    stability?: number;
    model?: string;
}
export interface TTSTask {
    text: string;
    startTime: number;
    duration: number;
    clipId?: string;
}
export interface TTSResult {
    cachePath: string;
    text: string;
    startTime: number;
    duration: number;
}
/**
 * Build TTS request endpoint URL for the given engine.
 * ElevenLabs: {baseUrl}/text-to-speech/{voiceId}
 * OpenAI / compatible: {baseUrl}/audio/speech
 */
export declare function buildTtsEndpoint(config: TTSConfig): string;
/**
 * Build TTS request body.
 * ElevenLabs: { text, model_id, voice_settings: { stability, speed } }
 * OpenAI: { model, input, voice, speed }
 */
export declare function buildTtsRequestBody(text: string, config: TTSConfig): Record<string, unknown>;
/**
 * Generate a deterministic cache key for a TTS request.
 * Based on text content + voice + speed + stability + engine.
 */
export declare function generateTtsCacheKey(text: string, config: TTSConfig): string;
/**
 * Detect TTS engine from provider baseUrl patterns.
 */
export declare function detectTtsEngine(baseUrl: string, providerId: string): TTSEngine;
export declare const EXPORT_SUGGESTION_CACHE_TTL_MS: number;
export type AIExportSuggestionPriority = 'high' | 'medium' | 'low';
export interface AIExportSuggestion {
    parameter: string;
    currentValue: string;
    suggestedValue: string;
    reason: string;
    priority: AIExportSuggestionPriority;
}
export interface AIExportProjectInfo {
    durationSeconds: number;
    width: number;
    height: number;
    fps: number;
    trackCount: number;
    effectCount: number;
    hasSubtitle: boolean;
    hasHDR: boolean;
    clipCount: number;
}
/**
 * Build project info summary for AI export optimization.
 */
export declare function buildExportProjectInfo(project: {
    settings: {
        width: number;
        height: number;
        fps: number;
    };
    timeline: {
        tracks: Array<{
            type: string;
            clips: Array<Record<string, unknown>>;
        }>;
    };
}): AIExportProjectInfo;
/**
 * Build system prompt for AI export optimization.
 */
export declare function buildExportOptimizationSystemPrompt(): string;
/**
 * Build user prompt for AI export optimization.
 */
export declare function buildExportOptimizationUserPrompt(projectInfo: AIExportProjectInfo, presetSettings: {
    format?: string;
    videoCodec?: string;
    audioCodec?: string;
    videoBitrate?: string;
    audioBitrate?: string;
    width?: number;
    height?: number;
    fps?: number;
    loudnessNormalization?: string;
    subtitleFormat?: string;
    hardwareEncoding?: boolean;
    outputMode?: string;
}): string;
/**
 * Parse AI export optimization response into typed suggestions.
 */
export declare function parseExportOptimizationResponse(json: unknown): AIExportSuggestion[];
/**
 * Sort suggestions by priority (high first).
 */
export declare function sortExportSuggestionsByPriority(suggestions: AIExportSuggestion[]): AIExportSuggestion[];
//# sourceMappingURL=ai-service.d.ts.map
/** 最小化剪辑引用接口，避免对 model-types 的循环依赖 */
interface ClipLike {
    id: string;
    name: string;
    contentAnalysis?: ClipContentAnalysis;
}
export declare const CONTENT_ANALYSIS_VERSION = 1;
export declare const CONTENT_SCENE_TYPES: readonly ["indoor", "outdoor", "night", "action", "dialogue", "close-up"];
export type ContentSceneType = (typeof CONTENT_SCENE_TYPES)[number];
export interface ContentAnalysisVisualSample {
    time: number;
    brightness: number;
    saturation: number;
    motion: number;
    faceRatio?: number;
    colorTemperature?: number;
}
export interface ContentAnalysisAudioSample {
    time: number;
    loudness: number;
}
export interface ContentAnalysisSegment {
    start: number;
    end: number;
    sceneTypes: ContentSceneType[];
    brightness: number;
    motion: number;
    loudness?: number;
}
export interface ContentEmotionPoint {
    time: number;
    value: number;
    brightness: number;
}
export interface ContentDialogueTurn {
    start: number;
    end: number;
    loudness: number;
}
export interface ClipContentAnalysis {
    version: number;
    analyzedAt: string;
    sceneTypes: ContentSceneType[];
    primarySceneType: ContentSceneType;
    segments: ContentAnalysisSegment[];
    emotionCurve: ContentEmotionPoint[];
    dialogueTurns: ContentDialogueTurn[];
    summary?: string;
}
export interface BuildClipContentAnalysisInput {
    duration: number;
    analyzedAt?: string;
    visualSamples: ContentAnalysisVisualSample[];
    audioSamples?: ContentAnalysisAudioSample[];
    segmentDuration?: number;
}
export declare function classifySceneTypes(input: {
    brightness: number;
    saturation: number;
    motion: number;
    faceRatio?: number;
    colorTemperature?: number;
    loudnessVariance?: number;
    silenceRatio?: number;
}): ContentSceneType[];
export declare function sampleEmotionCurve(samples: ContentAnalysisVisualSample[], segmentDuration: number): ContentEmotionPoint[];
export declare function detectDialogueTurns(samples: ContentAnalysisAudioSample[], options?: {
    silenceThreshold?: number;
    minTurnDuration?: number;
    mergeGap?: number;
}): ContentDialogueTurn[];
export declare function buildClipContentAnalysis(input: BuildClipContentAnalysisInput): ClipContentAnalysis;
export declare function normalizeClipContentAnalysis(input: unknown): ClipContentAnalysis | undefined;
export declare function serializeClipContentAnalysisJson(clip: ClipLike): string;
export {};
//# sourceMappingURL=content-analysis.d.ts.map
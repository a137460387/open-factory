export declare const SUMMARY_FRAME_COUNT = 8;
export declare const SUMMARY_MAX_SUBTITLE_CHARS = 1000;
import type { Project } from './model-types';
export interface VideoSummaryScene {
    time: number;
    description: string;
}
export interface VideoSummaryKeyMoment {
    time: number;
    description: string;
}
export interface VideoSummaryResult {
    title: string;
    summary: string;
    scenes: VideoSummaryScene[];
    emotionArc: string;
    keyMoments: VideoSummaryKeyMoment[];
    tags: string[];
}
export interface VideoSummaryDataPack {
    duration: number;
    trackCount: number;
    clipCount: number;
    markers: Array<{
        time: number;
        label: string;
    }>;
    subtitleText: string;
    aiSummaries: string[];
}
export declare function buildSummaryFrameTimestamps(duration: number, count?: number): number[];
export declare function buildSummaryDataPack(project: Project): VideoSummaryDataPack;
export declare function buildSummarySystemPrompt(): string;
export declare function buildSummaryUserPrompt(data: VideoSummaryDataPack): string;
export declare function parseVideoSummaryResponse(json: unknown): VideoSummaryResult;
export declare function generateSummaryFilename(projectName: string): string;
export declare function generateSummaryHtml(result: VideoSummaryResult, projectName: string, frameBase64s: string[]): string;
//# sourceMappingURL=ai-video-summary.d.ts.map
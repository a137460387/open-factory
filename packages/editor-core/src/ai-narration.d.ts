export type NarrationStyle = 'commentary' | 'advertisement' | 'documentary' | 'social-media';
export declare const NARRATION_STYLES: NarrationStyle[];
export declare const NARRATION_CHARS_PER_SECOND_ZH = 4;
export declare const NARRATION_WORDS_PER_SECOND_EN = 2.5;
export interface NarrationSegment {
    markerTime: number;
    duration: number;
    text: string;
    speakerNote: string;
}
export interface NarrationChapterInput {
    time: number;
    duration: number;
    label: string;
    sceneDescription: string;
    subtitleText: string;
}
export declare function estimateWordCount(durationSeconds: number, isChinese: boolean): {
    min: number;
    max: number;
};
export declare function buildNarrationSystemPrompt(style: NarrationStyle, isChinese: boolean): string;
export declare function buildNarrationUserPrompt(chapters: NarrationChapterInput[]): string;
export declare function buildChaptersFromMarkers(markers: Array<{
    time: number;
    label?: string;
}>, totalDuration: number, sceneDescriptions: Map<number, string>, subtitleTextMap: Map<number, string>): NarrationChapterInput[];
export declare function parseNarrationResponse(json: unknown): NarrationSegment[];
export declare function buildTtsRequests(segments: NarrationSegment[], voiceId: string): Array<{
    text: string;
    markerTime: number;
    voiceId: string;
}>;
//# sourceMappingURL=ai-narration.d.ts.map
import { type TimecodeFormat } from '../time';
export type SubtitleProofreadingIssueType = 'too-short' | 'too-long' | 'reading-speed' | 'overlap' | 'blank';
export interface SubtitleProofreadingClipInput {
    id: string;
    trackId?: string;
    start: number;
    duration: number;
    text: string;
}
export interface SubtitleProofreadingSettings {
    minDuration?: number;
    maxDuration?: number;
    chineseMaxCharsPerSecond?: number;
    englishMaxCharsPerSecond?: number;
}
export interface SubtitleProofreadingIssue {
    id: string;
    type: SubtitleProofreadingIssueType;
    clipId: string;
    relatedClipId?: string;
    trackId?: string;
    start: number;
    duration: number;
    text: string;
    value?: number;
    limit?: number;
}
export interface SubtitleProofreadingFix {
    clipId: string;
    duration?: number;
    delete?: boolean;
}
export declare const DEFAULT_SUBTITLE_PROOFREADING_SETTINGS: {
    readonly minDuration: 1;
    readonly maxDuration: 7;
    readonly chineseMaxCharsPerSecond: 12;
    readonly englishMaxCharsPerSecond: 20;
};
export declare function analyzeSubtitleProofreading(clips: SubtitleProofreadingClipInput[], settings?: SubtitleProofreadingSettings): SubtitleProofreadingIssue[];
export declare function calculateSubtitleReadingSpeed(text: string, duration: number, settings?: SubtitleProofreadingSettings): {
    speed: number;
    characterCount: number;
    language: 'chinese' | 'english';
    limit: number;
};
export declare function buildSubtitleProofreadingFixes(clips: SubtitleProofreadingClipInput[], issues: SubtitleProofreadingIssue[], settings?: SubtitleProofreadingSettings): SubtitleProofreadingFix[];
export declare function serializeSubtitleProofreadingCsv(issues: SubtitleProofreadingIssue[], options?: {
    fps?: number;
    timecodeFormat?: TimecodeFormat;
}): string;
export declare function normalizeSubtitleProofreadingSettings(settings?: SubtitleProofreadingSettings): Required<SubtitleProofreadingSettings>;
//# sourceMappingURL=proofreading.d.ts.map
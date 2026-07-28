export interface SubtitleLineBreakConfig {
    chineseMaxCharsPerLine: number;
    englishMaxCharsPerLine: number;
    preferPunctuationBreak: boolean;
    preferPrepositionBreak: boolean;
}
export interface SubtitleLineBreakIssue {
    subtitleId: string;
    text: string;
    issueType: 'line-too-long' | 'bad-break-point' | 'single-line-too-long';
    detail: string;
    maxLineLength: number;
    threshold: number;
}
export interface SubtitleLineBreakResult {
    subtitleId: string;
    originalText: string;
    rebrokenText: string;
    changed: boolean;
}
export interface SubtitleLineBreakPreview {
    originalText: string;
    previewText: string;
    lines: string[];
}
export declare const DEFAULT_CHINESE_MAX_CHARS = 20;
export declare const DEFAULT_ENGLISH_MAX_CHARS = 42;
export declare function isChineseChar(char: string): boolean;
export declare function getDisplayWidth(text: string): number;
export declare function classifyText(text: string): 'chinese' | 'english' | 'mixed';
export declare function getMaxCharsForText(text: string, config?: SubtitleLineBreakConfig): number;
export declare function findBestBreakPoint(text: string, maxChars: number, config?: SubtitleLineBreakConfig): number;
export declare function smartLineBreak(text: string, config?: SubtitleLineBreakConfig): string;
export declare function detectLineBreakIssues(subtitles: Array<{
    id: string;
    text: string;
}>, config?: SubtitleLineBreakConfig): SubtitleLineBreakIssue[];
export declare function batchRebreakSubtitles(subtitles: Array<{
    id: string;
    text: string;
}>, config?: SubtitleLineBreakConfig): SubtitleLineBreakResult[];
export declare function previewLineBreak(text: string, config?: SubtitleLineBreakConfig): SubtitleLineBreakPreview;
export declare function applyLineBreakToWhisperOutput(text: string, config?: SubtitleLineBreakConfig): string;
export declare function normalizeLineBreakConfig(config: Partial<SubtitleLineBreakConfig> | undefined): SubtitleLineBreakConfig;
//# sourceMappingURL=line-break.d.ts.map
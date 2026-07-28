import { type TimecodeFormat } from '../time';
export interface SpellCheckEntry {
    pattern: string;
    replacement: string;
    language: 'zh' | 'en';
    description?: string;
}
export interface SpellCheckResult {
    id: string;
    clipId: string;
    start: number;
    originalText: string;
    matchedWord: string;
    suggestions: string[];
    startIndex: number;
    endIndex: number;
}
export interface SpellCheckScanInput {
    clipId: string;
    start: number;
    text: string;
}
export interface SpellCheckReplaceInput {
    clipId: string;
    startIndex: number;
    endIndex: number;
    replacement: string;
}
export declare const CHINESE_SPELL_CHECK_DICT: SpellCheckEntry[];
export declare const ENGLISH_SPELL_CHECK_DICT: SpellCheckEntry[];
export declare const DEFAULT_SPELL_CHECK_DICT: SpellCheckEntry[];
export declare function scanSubtitleSpelling(inputs: SpellCheckScanInput[], dictionary?: SpellCheckEntry[], glossary?: string[]): SpellCheckResult[];
export declare function applySpellCheckReplacement(text: string, result: SpellCheckResult, replacement: string): string;
export declare function buildSpellCheckReplacement(text: string, replaceInputs: SpellCheckReplaceInput[]): string;
export declare function serializeSpellCheckReportCsv(results: SpellCheckResult[], options?: {
    fps?: number;
    timecodeFormat?: TimecodeFormat;
}): string;
//# sourceMappingURL=spell-check.d.ts.map
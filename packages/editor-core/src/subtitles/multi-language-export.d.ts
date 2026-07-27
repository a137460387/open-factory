import type { SubtitleClip, Timeline } from '../model';
import { type SubtitleTextFormat } from './srt';
/** 多语言字幕导出选项 */
export interface MultiLanguageSubtitleExportOptions {
    /** 导出格式 */
    format: SubtitleTextFormat;
    /** 要导出的语言（为空则导出全部） */
    languages?: string[];
    /** 是否合并为单个文件 */
    mergeIntoSingleFile?: boolean;
    /** 合并时的语言分隔符 */
    mergeSeparator?: string;
    /** 是否包含语言标识 */
    includeLanguageMetadata?: boolean;
    /** 自定义文件名模板 */
    filenameTemplate?: string;
}
/** 语言字幕组 */
export interface LanguageSubtitleGroup {
    /** 语言代码 */
    language: string;
    /** 语言显示名称 */
    displayName: string;
    /** 该语言的字幕片段 */
    clips: SubtitleClip[];
    /** 所属轨道 */
    trackId: string;
}
/** 导出结果 */
export interface MultiLanguageSubtitleExportResult {
    /** 导出的文件列表 */
    files: SubtitleExportFile[];
    /** 总字幕数 */
    totalCues: number;
    /** 导出的语言数 */
    languageCount: number;
}
/** 导出文件 */
export interface SubtitleExportFile {
    /** 文件名 */
    filename: string;
    /** 文件内容 */
    content: string;
    /** 语言代码 */
    language: string;
    /** 格式 */
    format: SubtitleTextFormat;
    /** 字幕数量 */
    cueCount: number;
}
/**
 * 导出多语言字幕
 */
export declare function exportMultiLanguageSubtitles(timeline: Timeline, options: MultiLanguageSubtitleExportOptions): MultiLanguageSubtitleExportResult;
/**
 * 按语言分组字幕
 */
export declare function groupSubtitlesByLanguage(timeline: Timeline): LanguageSubtitleGroup[];
/**
 * 获取可用的语言列表
 */
export declare function getAvailableLanguages(timeline: Timeline): Array<{
    code: string;
    name: string;
    count: number;
}>;
/**
 * 导出为独立文件（每种语言一个文件）
 */
export declare function exportSubtitlesAsSeparateFiles(timeline: Timeline, format: SubtitleTextFormat, languages?: string[]): SubtitleExportFile[];
/**
 * 导出为合并文件
 */
export declare function exportSubtitlesAsMergedFile(timeline: Timeline, format: SubtitleTextFormat, options?: {
    languages?: string[];
    separator?: string;
    includeLanguageHeaders?: boolean;
}): SubtitleExportFile | null;
/**
 * 嵌入字幕到视频（生成 FFmpeg 参数）
 */
export declare function buildSubtitleEmbedArgs(timeline: Timeline, options: {
    format: SubtitleTextFormat;
    languages?: string[];
    burnIn?: boolean;
    defaultLanguage?: string;
}): SubtitleEmbedResult;
/** 字幕嵌入结果 */
export interface SubtitleEmbedResult {
    /** FFmpeg 参数 */
    args: string[];
    /** 字幕文件列表 */
    files: Array<{
        filename: string;
        content: string;
        language: string;
    }>;
    /** 烧录滤镜（硬字幕） */
    burnInFilter: string | null;
}
//# sourceMappingURL=multi-language-export.d.ts.map
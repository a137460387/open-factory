import type { SubtitleClip, SubtitleStyle, SubtitleMode, SubtitleTrackType } from '../model-types';
/** 支持的转录语言 */
export type TranscriptionLanguage = 'zh' | 'en' | 'ja' | 'ko' | 'auto';
/** 转录片段 */
export interface TranscriptionSegment {
    startMs: number;
    endMs: number;
    text: string;
    confidence?: number;
    speaker?: string;
    speakerId?: number;
}
/** 转录结果 */
export interface TranscriptionResult {
    segments: TranscriptionSegment[];
    language: TranscriptionLanguage;
    durationMs: number;
    modelLoadedMs?: number;
}
/** 转录配置 */
export interface TranscriptionConfig {
    language?: TranscriptionLanguage;
    minSegmentDurationMs?: number;
    maxSegmentDurationMs?: number;
    mergeGapMs?: number;
    maxCharsPerSegment?: number;
    style?: SubtitleStyle;
    subtitleMode?: SubtitleMode;
    subtitleType?: SubtitleTrackType;
}
/** 转录进度事件 */
export interface TranscriptionProgressEvent {
    phase: 'loading-model' | 'decoding' | 'post-processing';
    progress: number;
    estimatedMs?: number;
}
/** 转录验证问题 */
export interface TranscriptionValidationIssue {
    index: number;
    type: 'too-short' | 'too-long' | 'overlap' | 'empty-text' | 'invalid-time';
    message: string;
}
/**
 * 从文本内容检测语言
 * 基于 Unicode 字符范围的简单启发式检测
 */
export declare function detectLanguageFromText(text: string): TranscriptionLanguage;
/**
 * 将 Whisper 输出的 SRT 内容解析为转录片段
 * 复用现有 parseSrt 解析器
 */
export declare function parseWhisperSrt(srtContent: string): TranscriptionSegment[];
/**
 * 将原始时间戳片段转换为 TranscriptionSegment
 * 接受毫秒级时间戳
 */
export declare function createSegmentsFromTimestamps(timestamps: Array<{
    startMs: number;
    endMs: number;
    text: string;
}>): TranscriptionSegment[];
/**
 * 合并间隔过短的相邻片段
 * 当两个片段之间的间隔小于 mergeGapMs 且合并后不超过 maxChars 时合并
 */
export declare function mergeShortSegments(segments: TranscriptionSegment[], minDurationMs?: number, mergeGapMs?: number, maxChars?: number): TranscriptionSegment[];
/**
 * 拆分过长的片段
 * 按句号、问号、感叹号等标点拆分，保持语义完整
 */
export declare function splitLongSegments(segments: TranscriptionSegment[], maxDurationMs?: number, maxChars?: number): TranscriptionSegment[];
/**
 * 时间戳偏移对齐
 * 将所有片段的时间戳整体偏移指定毫秒数
 */
export declare function alignTimestamps(segments: TranscriptionSegment[], offsetMs: number): TranscriptionSegment[];
/**
 * 估算文本阅读时间（毫秒）
 * 基于语言类型的平均阅读速度
 */
export declare function estimateReadingTimeMs(text: string, language?: TranscriptionLanguage): number;
/**
 * 将转录片段转换为 SubtitleClip 对象
 * 用于插入时间线
 */
export declare function segmentsToSubtitleClips(segments: TranscriptionSegment[], trackId: string, config?: TranscriptionConfig): SubtitleClip[];
/**
 * 验证转录结果的质量
 * 返回问题列表，空数组表示结果有效
 */
export declare function validateTranscriptionResult(segments: TranscriptionSegment[], minDurationMs?: number): TranscriptionValidationIssue[];
/**
 * 完整的转录后处理流水线
 * 解析 → 合并短片段 → 拆分长片段 → 验证
 */
export declare function processWhisperOutput(srtContent: string, config?: TranscriptionConfig): {
    segments: TranscriptionSegment[];
    issues: TranscriptionValidationIssue[];
    language: TranscriptionLanguage;
};
//# sourceMappingURL=transcription.d.ts.map
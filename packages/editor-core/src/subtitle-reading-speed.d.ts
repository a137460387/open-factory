export type ReadingSpeedSeverity = 'ok' | 'warning' | 'critical';
export interface ReadingSpeedWarning {
    charsPerSecond: number;
    recommendedMax: number;
    severity: ReadingSpeedSeverity;
}
export interface SubtitleSplitResult {
    textA: string;
    textB: string;
    splitTime: number;
}
/** 各语言推荐阅读速度上限（字符/秒） */
export declare const READING_SPEED_LIMITS: Record<string, number>;
export declare const WARNING_THRESHOLD_RATIO = 1;
export declare const CRITICAL_THRESHOLD_RATIO = 1.2;
/**
 * 计算字符数：中文按字数，英文按单词数
 */
export declare function countCharacters(text: string, language: string): number;
/**
 * 获取语言推荐速度上限
 */
export declare function getRecommendedMax(language: string): number;
/**
 * 计算阅读速度警告
 */
export declare function calculateReadingSpeed(text: string, startTime: number, endTime: number, language?: string): ReadingSpeedWarning | null;
/**
 * 检测连续字幕是否共享前缀（断句不当）
 */
export declare function detectSharedPrefix(textA: string, textB: string, minPrefixLength?: number): boolean;
/**
 * 自动拆分字幕文本
 * 按标点或中点粗略二分
 */
export declare function autoSplitSubtitle(text: string, startTime: number, endTime: number): SubtitleSplitResult;
/**
 * 计算延长至安全时长后的结束时间
 */
export declare function calculateSafeDuration(text: string, startTime: number, language?: string): number;
/**
 * 检查延长后是否与下一字幕重叠
 */
export declare function wouldOverlapNextSegment(newEndTime: number, nextStartTime: number, tolerance?: number): boolean;
//# sourceMappingURL=subtitle-reading-speed.d.ts.map
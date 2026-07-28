/**
 * 媒体库批量标签建议学习系统。
 * 纯本地模式匹配，不上传任何数据。
 */
export type TagLearningAspectClass = 'vertical' | 'horizontal' | 'square' | 'unknown';
export interface TagLearningRecord {
    /** 媒体特征指纹：宽高比分类 + 是否有音频 */
    aspectClass: TagLearningAspectClass;
    hasAudio: boolean;
    /** 用户添加的标签 */
    tag: string;
    /** 记录时间 */
    timestamp: string;
}
export interface TagSuggestion {
    tag: string;
    confidence: number;
    matchCount: number;
    totalCount: number;
}
export interface TagLearningData {
    version: 1;
    records: TagLearningRecord[];
}
export declare function classifyTagLearningAspect(width: number, height: number): TagLearningAspectClass;
/**
 * 记录用户手动添加标签的行为。
 */
export declare function recordTagAction(data: TagLearningData, aspectClass: TagLearningAspectClass, hasAudio: boolean, tag: string, now?: () => Date): TagLearningData;
/**
 * 基于历史记录生成标签建议。
 * 返回按置信度降序排列的建议列表。
 */
export declare function suggestTags(data: TagLearningData, aspectClass: TagLearningAspectClass, hasAudio: boolean): TagSuggestion[];
/**
 * 获取建议的置信等级。
 */
export declare function getConfidenceLevel(confidence: number): 'high' | 'medium' | 'low';
/**
 * 是否应该主动推送建议（高置信度）。
 */
export declare function shouldProactivelySuggest(suggestion: TagSuggestion): boolean;
/**
 * 序列化学习数据为 JSON 字符串。
 */
export declare function serializeTagLearningData(data: TagLearningData): string;
/**
 * 从 JSON 字符串解析学习数据。
 */
export declare function parseTagLearningData(contents: string): TagLearningData;
/**
 * 重置学习数据。
 */
export declare function resetTagLearningData(): TagLearningData;
/**
 * 创建空的学习数据。
 */
export declare function createEmptyTagLearningData(): TagLearningData;
//# sourceMappingURL=tag-learning.d.ts.map
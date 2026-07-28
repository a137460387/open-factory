/**
 * 媒体库批量标签建议学习系统。
 * 纯本地模式匹配，不上传任何数据。
 */
/** 高置信度阈值：一致性 >= 90% 直接建议 */
const HIGH_CONFIDENCE_THRESHOLD = 0.9;
/** 中置信度阈值：一致性 >= 50% 在面板显示 */
const MEDIUM_CONFIDENCE_THRESHOLD = 0.5;
/** 最少匹配次数才触发建议 */
const MIN_MATCH_COUNT = 2;
export function classifyTagLearningAspect(width, height) {
    const safeWidth = Math.max(1, width);
    const safeHeight = Math.max(1, height);
    const ratio = safeHeight / safeWidth;
    if (ratio >= 1.2)
        return 'vertical';
    if (ratio >= 0.9 && ratio <= 1.1)
        return 'square';
    if (ratio < 0.9)
        return 'horizontal';
    return 'horizontal';
}
/**
 * 记录用户手动添加标签的行为。
 */
export function recordTagAction(data, aspectClass, hasAudio, tag, now) {
    const record = {
        aspectClass,
        hasAudio,
        tag: tag.trim().toLowerCase(),
        timestamp: (now ?? (() => new Date()))().toISOString(),
    };
    if (!record.tag)
        return data;
    return {
        version: 1,
        records: [...data.records, record],
    };
}
/**
 * 基于历史记录生成标签建议。
 * 返回按置信度降序排列的建议列表。
 */
export function suggestTags(data, aspectClass, hasAudio) {
    const relevant = data.records.filter((r) => r.aspectClass === aspectClass && r.hasAudio === hasAudio);
    if (relevant.length === 0)
        return [];
    const tagCounts = new Map();
    for (const record of relevant) {
        tagCounts.set(record.tag, (tagCounts.get(record.tag) ?? 0) + 1);
    }
    const suggestions = [];
    for (const [tag, matchCount] of tagCounts) {
        if (matchCount < MIN_MATCH_COUNT)
            continue;
        const confidence = matchCount / relevant.length;
        suggestions.push({
            tag,
            confidence: Math.round(confidence * 100) / 100,
            matchCount,
            totalCount: relevant.length,
        });
    }
    return suggestions.sort((a, b) => b.confidence - a.confidence || b.matchCount - a.matchCount);
}
/**
 * 获取建议的置信等级。
 */
export function getConfidenceLevel(confidence) {
    if (confidence >= HIGH_CONFIDENCE_THRESHOLD)
        return 'high';
    if (confidence >= MEDIUM_CONFIDENCE_THRESHOLD)
        return 'medium';
    return 'low';
}
/**
 * 是否应该主动推送建议（高置信度）。
 */
export function shouldProactivelySuggest(suggestion) {
    return getConfidenceLevel(suggestion.confidence) === 'high';
}
/**
 * 序列化学习数据为 JSON 字符串。
 */
export function serializeTagLearningData(data) {
    return JSON.stringify(data, null, 2) + '\n';
}
/**
 * 从 JSON 字符串解析学习数据。
 */
export function parseTagLearningData(contents) {
    try {
        const parsed = JSON.parse(contents);
        if (parsed && parsed.version === 1 && Array.isArray(parsed.records)) {
            return {
                version: 1,
                records: parsed.records.filter((r) => r &&
                    typeof r.tag === 'string' &&
                    typeof r.aspectClass === 'string'),
            };
        }
        return { version: 1, records: [] };
    }
    catch {
        return { version: 1, records: [] };
    }
}
/**
 * 重置学习数据。
 */
export function resetTagLearningData() {
    return { version: 1, records: [] };
}
/**
 * 创建空的学习数据。
 */
export function createEmptyTagLearningData() {
    return { version: 1, records: [] };
}
//# sourceMappingURL=tag-learning.js.map
/** AI智能B-roll素材推荐：覆盖空隙检测 + 关键词匹配 + AI响应解析 */
/**
 * 检测覆盖空隙：同一clip持续覆盖>minDuration秒且无B-roll叠加的字幕区间。
 * 简化逻辑：对字幕轨道，检查每个字幕片段是否属于持续覆盖区。
 */
export function detectCoverageGaps(subtitleSegments, brollTrackClipRanges, minDuration = 3) {
    if (subtitleSegments.length === 0)
        return [];
    const gaps = [];
    for (const seg of subtitleSegments) {
        const duration = seg.end - seg.start;
        if (duration < minDuration)
            continue;
        // 检查该区间是否有B-roll覆盖
        const hasBroll = brollTrackClipRanges.some((range) => range.start < seg.end && range.end > seg.start);
        if (!hasBroll) {
            gaps.push({
                segmentId: seg.id,
                trackId: 'subtitle',
                start: seg.start,
                end: seg.end,
                duration,
            });
        }
    }
    return gaps;
}
/**
 * 关键词匹配：对文本做子串/模糊匹配。
 * 返回匹配到的关键词列表。
 */
export function matchKeywords(text, tags, fuzzyThreshold = 0.6) {
    if (!text || !tags.length)
        return [];
    const normalized = text.toLowerCase();
    const matched = [];
    for (const tag of tags) {
        const tagLower = tag.toLowerCase().trim();
        if (!tagLower)
            continue;
        // 精确子串匹配
        if (normalized.includes(tagLower)) {
            matched.push(tag);
            continue;
        }
        // 模糊匹配：基于字符重叠率
        const overlap = calculateCharOverlap(normalized, tagLower);
        if (overlap >= fuzzyThreshold) {
            matched.push(tag);
        }
    }
    return matched;
}
/**
 * 计算两个字符串的字符重叠率（Jaccard相似度的简化版）。
 */
export function calculateCharOverlap(a, b) {
    if (!a || !b)
        return 0;
    const setA = new Set(a);
    const setB = new Set(b);
    let intersection = 0;
    for (const c of setA) {
        if (setB.has(c))
            intersection++;
    }
    const union = setA.size + setB.size - intersection;
    return union === 0 ? 0 : intersection / union;
}
/**
 * 解析AI返回的B-roll建议响应。
 */
export function parseBrollAiResponse(json) {
    const empty = { suggestions: [] };
    if (!json || typeof json !== 'object')
        return empty;
    const obj = json;
    if (!Array.isArray(obj.suggestions))
        return empty;
    const suggestions = obj.suggestions
        .filter((item) => {
        if (!item || typeof item !== 'object')
            return false;
        const i = item;
        return (typeof i.segmentId === 'string' &&
            typeof i.mediaId === 'string' &&
            typeof i.insertTime === 'number' &&
            typeof i.reason === 'string' &&
            typeof i.confidence === 'number');
    })
        .map((item) => ({
        segmentId: item.segmentId,
        mediaId: item.mediaId,
        insertTime: Math.max(0, item.insertTime),
        reason: item.reason.trim(),
        confidence: Math.min(1, Math.max(0, item.confidence)),
    }));
    return { suggestions };
}
/**
 * 将AI返回的建议转换为BrollSuggestion（带pending状态）。
 */
export function createBrollSuggestions(response) {
    return response.suggestions.map((s) => ({
        segmentId: s.segmentId,
        mediaId: s.mediaId,
        insertTime: s.insertTime,
        reason: s.reason,
        confidence: s.confidence,
        status: 'pending',
    }));
}
/**
 * 规范化BrollSuggestion数组，处理旧项目兼容。
 */
export function normalizeBrollSuggestions(input) {
    if (!Array.isArray(input))
        return undefined;
    return input
        .filter((item) => {
        if (!item || typeof item !== 'object')
            return false;
        const i = item;
        return typeof i.segmentId === 'string' && typeof i.mediaId === 'string' && typeof i.insertTime === 'number';
    })
        .map((item) => ({
        segmentId: item.segmentId,
        mediaId: item.mediaId,
        insertTime: typeof item.insertTime === 'number' ? item.insertTime : 0,
        reason: typeof item.reason === 'string' ? item.reason : '',
        confidence: typeof item.confidence === 'number' ? item.confidence : 0,
        status: (['pending', 'accepted', 'rejected'].includes(item.status)
            ? item.status
            : 'pending'),
    }));
}
//# sourceMappingURL=ai-broll-suggestion.js.map
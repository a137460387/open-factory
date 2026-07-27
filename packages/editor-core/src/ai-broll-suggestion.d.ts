/** AI智能B-roll素材推荐：覆盖空隙检测 + 关键词匹配 + AI响应解析 */
/** B-roll建议状态 */
export type BrollSuggestionStatus = 'pending' | 'accepted' | 'rejected';
/** 覆盖空隙候选 */
export interface CoverageGap {
    segmentId: string;
    trackId: string;
    start: number;
    end: number;
    duration: number;
}
/** B-roll建议 */
export interface BrollSuggestion {
    segmentId: string;
    mediaId: string;
    insertTime: number;
    reason: string;
    confidence: number;
    status: BrollSuggestionStatus;
}
/** AI返回的B-roll建议项 */
interface AiBrollSuggestionItem {
    segmentId: string;
    mediaId: string;
    insertTime: number;
    reason: string;
    confidence: number;
}
/** AI返回的B-roll建议响应 */
export interface BrollAiResponse {
    suggestions: AiBrollSuggestionItem[];
}
/** 字幕/旁白片段信息 */
interface SubtitleSegmentInfo {
    id: string;
    start: number;
    end: number;
    text: string;
}
/**
 * 检测覆盖空隙：同一clip持续覆盖>minDuration秒且无B-roll叠加的字幕区间。
 * 简化逻辑：对字幕轨道，检查每个字幕片段是否属于持续覆盖区。
 */
export declare function detectCoverageGaps(subtitleSegments: SubtitleSegmentInfo[], brollTrackClipRanges: Array<{
    start: number;
    end: number;
}>, minDuration?: number): CoverageGap[];
/**
 * 关键词匹配：对文本做子串/模糊匹配。
 * 返回匹配到的关键词列表。
 */
export declare function matchKeywords(text: string, tags: string[], fuzzyThreshold?: number): string[];
/**
 * 计算两个字符串的字符重叠率（Jaccard相似度的简化版）。
 */
export declare function calculateCharOverlap(a: string, b: string): number;
/**
 * 解析AI返回的B-roll建议响应。
 */
export declare function parseBrollAiResponse(json: unknown): BrollAiResponse;
/**
 * 将AI返回的建议转换为BrollSuggestion（带pending状态）。
 */
export declare function createBrollSuggestions(response: BrollAiResponse): BrollSuggestion[];
/**
 * 规范化BrollSuggestion数组，处理旧项目兼容。
 */
export declare function normalizeBrollSuggestions(input: unknown): BrollSuggestion[] | undefined;
export {};
//# sourceMappingURL=ai-broll-suggestion.d.ts.map
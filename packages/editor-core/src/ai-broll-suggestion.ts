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

/** 媒体标签信息 */
interface MediaTagInfo {
  id: string;
  tags: string[];
}

/**
 * 检测覆盖空隙：同一clip持续覆盖>minDuration秒且无B-roll叠加的字幕区间。
 * 简化逻辑：对字幕轨道，检查每个字幕片段是否属于持续覆盖区。
 */
export function detectCoverageGaps(
  subtitleSegments: SubtitleSegmentInfo[],
  brollTrackClipRanges: Array<{ start: number; end: number }>,
  minDuration = 3
): CoverageGap[] {
  if (subtitleSegments.length === 0) return [];
  const gaps: CoverageGap[] = [];

  for (const seg of subtitleSegments) {
    const duration = seg.end - seg.start;
    if (duration < minDuration) continue;

    // 检查该区间是否有B-roll覆盖
    const hasBroll = brollTrackClipRanges.some(
      (range) => range.start < seg.end && range.end > seg.start
    );
    if (!hasBroll) {
      gaps.push({
        segmentId: seg.id,
        trackId: 'subtitle',
        start: seg.start,
        end: seg.end,
        duration
      });
    }
  }
  return gaps;
}

/**
 * 关键词匹配：对文本做子串/模糊匹配。
 * 返回匹配到的关键词列表。
 */
export function matchKeywords(
  text: string,
  tags: string[],
  fuzzyThreshold = 0.6
): string[] {
  if (!text || !tags.length) return [];
  const normalized = text.toLowerCase();
  const matched: string[] = [];

  for (const tag of tags) {
    const tagLower = tag.toLowerCase().trim();
    if (!tagLower) continue;
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
export function calculateCharOverlap(a: string, b: string): number {
  if (!a || !b) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const c of setA) {
    if (setB.has(c)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * 解析AI返回的B-roll建议响应。
 */
export function parseBrollAiResponse(json: unknown): BrollAiResponse {
  const empty: BrollAiResponse = { suggestions: [] };
  if (!json || typeof json !== 'object') return empty;
  const obj = json as Record<string, unknown>;
  if (!Array.isArray(obj.suggestions)) return empty;

  const suggestions: AiBrollSuggestionItem[] = obj.suggestions
    .filter((item: unknown): item is AiBrollSuggestionItem => {
      if (!item || typeof item !== 'object') return false;
      const i = item as Record<string, unknown>;
      return (
        typeof i.segmentId === 'string' &&
        typeof i.mediaId === 'string' &&
        typeof i.insertTime === 'number' &&
        typeof i.reason === 'string' &&
        typeof i.confidence === 'number'
      );
    })
    .map((item) => ({
      segmentId: item.segmentId,
      mediaId: item.mediaId,
      insertTime: Math.max(0, item.insertTime),
      reason: item.reason.trim(),
      confidence: Math.min(1, Math.max(0, item.confidence))
    }));

  return { suggestions };
}

/**
 * 将AI返回的建议转换为BrollSuggestion（带pending状态）。
 */
export function createBrollSuggestions(response: BrollAiResponse): BrollSuggestion[] {
  return response.suggestions.map((s) => ({
    segmentId: s.segmentId,
    mediaId: s.mediaId,
    insertTime: s.insertTime,
    reason: s.reason,
    confidence: s.confidence,
    status: 'pending' as BrollSuggestionStatus
  }));
}

/**
 * 规范化BrollSuggestion数组，处理旧项目兼容。
 */
export function normalizeBrollSuggestions(
  input: unknown
): BrollSuggestion[] | undefined {
  if (!Array.isArray(input)) return undefined;
  return input
    .filter((item: unknown): item is BrollSuggestion => {
      if (!item || typeof item !== 'object') return false;
      const i = item as Record<string, unknown>;
      return (
        typeof i.segmentId === 'string' &&
        typeof i.mediaId === 'string' &&
        typeof i.insertTime === 'number'
      );
    })
    .map((item) => ({
      segmentId: item.segmentId,
      mediaId: item.mediaId,
      insertTime: typeof item.insertTime === 'number' ? item.insertTime : 0,
      reason: typeof item.reason === 'string' ? item.reason : '',
      confidence: typeof item.confidence === 'number' ? item.confidence : 0,
      status: (['pending', 'accepted', 'rejected'].includes(item.status) ? item.status : 'pending') as BrollSuggestionStatus
    }));
}

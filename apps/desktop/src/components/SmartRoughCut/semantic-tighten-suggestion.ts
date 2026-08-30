/**
 * M3 扩展·首实施：contentAnalysis 派生收紧建议（纯函数）
 *
 * 双源勘察共识第一梯队：掐头收紧（head-trim）+ 收尾收紧（tail-trim），
 * 均为单区间 keep-range（suggestionToSegments 审阅链零改造复用）。
 * 数据前提 = clip.contentAnalysis 就绪（与 Compare 入口同源信号）；
 * 时间域换算：contentAnalysis 为源素材域，建议 timeRange 为时间线绝对
 * 时间（abs = clip.start + (source − trimStart) / speed，与
 * semantic-suggestion-review.ts 的逆向换算互逆）。
 */
import {
  detectHeadTrimStart,
  detectTailTrimEnd,
  getClipSpeed,
  round,
  type Clip,
  type ClipContentAnalysis,
  type ContentAnalysisSegment,
} from '@open-factory/editor-core';
import { ONSET_DELTA_THRESHOLD, ONSET_LOUDNESS_FLOOR } from './useRoughCutAnalysis';
import type { SemanticRoughCutSuggestion } from './semantic-suggestion';

/** 启发式建议固定置信度（定性：非语义推断，中低强度，审阅链照常展示百分比） */
const TIGHTEN_SUGGESTION_CONFIDENCE = 0.6;

/** 收紧建议 label / reason（zh 文案，en-overrides 不动——沿 M3-2 先例） */
const TIGHTEN_TEXT = {
  'head-trim': {
    label: '掐头收紧',
    reason: '片头存在可收紧的空余区间（启发式判定，请人工确认）',
  },
  'tail-trim': {
    label: '收尾收紧',
    reason: '片尾存在可收紧的低能量区间（启发式判定，请人工确认）',
  },
} as const;

/** 派生建议 id（与 narrative 的 semantic-{index} 命名空间不冲突，单类型至多一条） */
const TIGHTEN_ID = {
  'head-trim': 'semantic-head-trim',
  'tail-trim': 'semantic-tail-trim',
} as const;

/** 区间相等判定容差（与 suggestionCoversEntireClip 命令侧口径一致） */
const RANGE_EPSILON = 0.000001;

/** 派生建议固定展示顺序：掐头在前、收尾殿后（与 clip 时序一致） */
const TIGHTEN_SOURCE_ORDER: Array<'head-trim' | 'tail-trim'> = ['head-trim', 'tail-trim'];

/**
 * 从 contentAnalysis 派生收紧建议（源域检测 → 绝对时间域建议）。
 *
 * 掐头：首个内容起点（首 turn.start，onset 兜底）前留 margin 余量，
 * keep-range = [trimStart 点, clip 末端]；收尾：尾部低能量段回溯，
 * keep-range = [clip 起点, 回溯终点]。任一无可剪区间则该类不产出。
 * contentAnalysis 缺失 / clip 缺失 → []。
 */
export function deriveTightenSuggestions(
  analysis: ClipContentAnalysis | undefined,
  clip: Clip | undefined,
): SemanticRoughCutSuggestion[] {
  if (!clip || !analysis) {
    return [];
  }
  const speed = getClipSpeed(clip);
  const sourceStart = clip.trimStart;
  const sourceEnd = sourceStart + clip.duration * speed;
  const toAbs = (time: number): number => round(clip.start + (time - sourceStart) / speed);
  const inWindow = (time: number): boolean => time >= sourceStart - RANGE_EPSILON && time <= sourceEnd + RANGE_EPSILON;
  const clipEndAbs = clip.start + clip.duration;

  const suggestions: SemanticRoughCutSuggestion[] = [];

  const turns = analysis.dialogueTurns.filter((turn) => inWindow(turn.start));
  const onsets = deriveSourceOnsets(analysis.segments);
  const headStart = detectHeadTrimStart(turns, onsets, { clipDuration: sourceEnd - sourceStart });
  if (headStart !== null) {
    suggestions.push({
      id: TIGHTEN_ID['head-trim'],
      timeRange: { start: toAbs(headStart), end: clipEndAbs },
      markerType: 'opening',
      confidence: TIGHTEN_SUGGESTION_CONFIDENCE,
      label: TIGHTEN_TEXT['head-trim'].label,
      reason: TIGHTEN_TEXT['head-trim'].reason,
      source: 'head-trim',
    });
  }

  const segments = analysis.segments.filter((segment) => inWindow(segment.start));
  const tailEnd = detectTailTrimEnd(segments);
  if (tailEnd !== null) {
    suggestions.push({
      id: TIGHTEN_ID['tail-trim'],
      timeRange: { start: clip.start, end: toAbs(tailEnd) },
      markerType: 'ending',
      confidence: TIGHTEN_SUGGESTION_CONFIDENCE,
      label: TIGHTEN_TEXT['tail-trim'].label,
      reason: TIGHTEN_TEXT['tail-trim'].reason,
      source: 'tail-trim',
    });
  }

  return suggestions;
}

/**
 * 多源建议合并（排序 + 去重共存规则，确定性逻辑）。
 *
 * 排序：climax 组（narrative climax + emotional-climax，confidence 降序）
 * → 非 climax narrative（时间升序）→ head-trim → tail-trim（climax 优先
 * 原则不变，派生启发式殿后）。
 * 去重：派生项（head/tail/emotional-climax）与任一 narrative 项 timeRange
 * 完全相等（容差 1e-6）时剔除派生项（narrative 语义建议优先）；head 与
 * tail 结构上不可能完全相等（head.start 严格大于 clip.start，tail.end
 * 严格小于 clip 末端）；emotional-climax 组内由 top-K 内核保证互斥无重复。
 * 同区间重复出现视为缺陷，由测试断言合并结果无重复区间兜底。
 */
export function mergeSemanticSuggestions(
  narrative: SemanticRoughCutSuggestion[],
  tighten: SemanticRoughCutSuggestion[],
  climax: SemanticRoughCutSuggestion[] = [],
): SemanticRoughCutSuggestion[] {
  const orderedClimax = [...narrative.filter((item) => item.markerType === 'climax'), ...climax].sort(
    (left, right) => right.confidence - left.confidence,
  );
  const orderedNarrative = [
    ...orderedClimax,
    ...narrative
      .filter((item) => item.markerType !== 'climax')
      .sort((left, right) => left.timeRange.start - right.timeRange.start),
  ];
  const orderedTighten = TIGHTEN_SOURCE_ORDER.flatMap((source) => tighten.filter((item) => item.source === source));
  return [...orderedNarrative, ...orderedTighten].filter(
    (item) =>
      item.source === 'narrative' ||
      !narrative.some(
        (candidate) =>
          Math.abs(candidate.timeRange.start - item.timeRange.start) < RANGE_EPSILON &&
          Math.abs(candidate.timeRange.end - item.timeRange.end) < RANGE_EPSILON,
      ),
  );
}

/** 源域 onset 派生：segments.loudness 上升沿（阈值与 useRoughCutAnalysis 同口径） */
function deriveSourceOnsets(segments: ContentAnalysisSegment[]): Array<{ time: number }> {
  const measured = segments
    .filter((segment) => typeof segment.loudness === 'number' && Number.isFinite(segment.loudness))
    .sort((left, right) => left.start - right.start);
  const onsets: Array<{ time: number }> = [];
  for (let index = 1; index < measured.length; index += 1) {
    const previous = measured[index - 1].loudness ?? 0;
    const current = measured[index].loudness ?? 0;
    if (current - previous > ONSET_DELTA_THRESHOLD && current > ONSET_LOUDNESS_FLOOR) {
      onsets.push({ time: measured[index].start });
    }
  }
  return onsets;
}

/**
 * M3 扩展·第二梯队：情感高潮 top-K 建议派生（纯函数）
 *
 * 闸门放行背景：top-K 互斥内核 selectTopKMutuallyExclusive 于 #186 入池，
 * 经人类定调（b+d 真实使用信号达成）组装接入。数据源 = contentAnalysis
 * 的 emotionCurve（源域），经 selectEmotionalClimaxIntervals 组装层
 * （窗口过滤 + 内核互斥选取 + 边界 clamp + 极短保护）产出局部高光区间，
 * 换算为时间线绝对时间后作为「情感高潮」建议条目。
 *
 * 互斥语义：top-K 组内互斥（内核保证）；与 head/tail-trim 不跨组互斥
 * （局部高光区间 vs 整 clip keep-range，语义不同），区间完全相等时由
 * mergeSemanticSuggestions 既有去重规则兜底。
 *
 * 双入口分工：Compare 方案卡 = 整段粗剪重构（多区间策略提案）；本建议
 * 列表条目 = 局部高光保留（单区间），同一 ApplyRoughCutProposalCommand
 * 命令通道。
 */
import {
  getClipSpeed,
  round,
  selectEmotionalClimaxIntervals,
  type Clip,
  type ClipContentAnalysis,
} from '@open-factory/editor-core';
import type { SemanticRoughCutSuggestion } from './semantic-suggestion';

/** 情感高潮建议 label / reason（zh 文案，en-overrides 不动——沿 M3-2 先例） */
const CLIMAX_TEXT = {
  label: '情感高潮',
  reason: '情感曲线高光区间（top-K 互斥选取，启发式判定，请人工确认）',
} as const;

/**
 * 从 contentAnalysis.emotionCurve 派生情感高潮 top-K 建议（源域选取 →
 * 绝对时间域建议）。
 *
 * 区间 = 高潮点向后延伸（默认 5s）并 clamp 至 clip 源窗口，短于 1s 的
 * 区间不产出（组装层极短保护）。confidence = 区间 score（情感采样值），
 * 与 narrative climax 的置信度同口径参与合并排序。
 * contentAnalysis 缺失 / clip 缺失 / 曲线空 → []。
 */
export function deriveEmotionalClimaxSuggestions(
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

  const intervals = selectEmotionalClimaxIntervals(analysis.emotionCurve, sourceStart, sourceEnd);
  return intervals.map((interval, index) => ({
    id: `semantic-emotional-climax-${index}`,
    timeRange: { start: toAbs(interval.start), end: toAbs(interval.end) },
    markerType: 'climax' as const,
    confidence: interval.score,
    label: CLIMAX_TEXT.label,
    reason: CLIMAX_TEXT.reason,
    source: 'emotional-climax' as const,
  }));
}

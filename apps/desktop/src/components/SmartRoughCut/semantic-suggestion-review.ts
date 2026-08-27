/**
 * M3-3 A1 语义建议审阅纯函数层
 *
 * 职责一（映射）：SemanticRoughCutSuggestion.timeRange 为时间线绝对时间，
 * ApplyRoughCutProposalCommand 的 segments 为源素材时间——此处完成正向换算
 * source = trimStart + (绝对时间 − clip.start) × speed（命令内部的
 * buildProposalLocalRanges 已有反向换算，两处口径互逆）。
 * 职责二（审阅模型）：构造 before/after 对比视图模型（原 clip 使用区间 vs
 * 采纳后保留区间 + 保留比例），供 SemanticSuggestionReviewDialog 渲染。
 * 仅纯函数，零 UI / 零 store / 零命令副作用。
 */
import type {Clip} from '@open-factory/editor-core';
import {getClipSpeed} from '@open-factory/editor-core';
import type {RoughCutSegment} from '@open-factory/editor-core/smart-rough-cut';
import type {SemanticRoughCutSuggestion} from './semantic-suggestion';

/** 时间区间（秒，含端点语义由调用方定义） */
export interface ReviewTimeRange {
  start: number;
  end: number;
}

/** 语义建议审阅视图模型（before/after 对比数据） */
export interface SuggestionReviewModel {
  /** 采纳前：clip 实际使用的源素材区间（trimStart → trimEnd） */
  before: ReviewTimeRange;
  /** 采纳后：保留的源素材区间（建议区间换算至源域） */
  after: ReviewTimeRange;
  /** 采纳后保留时长（秒） */
  keptDuration: number;
  /** 采纳前 clip 时长（秒） */
  originalDuration: number;
  /** 保留比例 0-1（keptDuration / originalDuration） */
  retentionRatio: number;
}

/**
 * 时间线绝对时间 → 源素材时间的换算因子与偏移。
 * source = trimStart + (abs − clip.start) × speed
 */
function toSourceTime(clip: Clip, speed: number, absoluteTime: number): number {
  return clip.trimStart + (absoluteTime - clip.start) * speed;
}

/**
 * 将单条语义建议换算为 ApplyRoughCutProposalCommand 可消费的单元素
 * segments（source 域）。score 族字段透传建议 confidence（命令侧仅作
 * 展示/统计用途，不参与裁剪计算）。
 */
export function suggestionToSegments(
  suggestion: SemanticRoughCutSuggestion,
  clip: Clip,
): RoughCutSegment[] {
  const speed = getClipSpeed(clip);
  const sourceStart = toSourceTime(clip, speed, suggestion.timeRange.start);
  const sourceEnd = toSourceTime(clip, speed, suggestion.timeRange.end);
  return [
    {
      sourceStart,
      sourceEnd,
      duration: sourceEnd - sourceStart,
      score: suggestion.confidence,
      visualScore: suggestion.confidence,
      audioScore: suggestion.confidence,
    },
  ];
}

/**
 * 构造语义建议审阅视图模型。
 *
 * before = clip 当前使用区间（trimStart → trimStart + duration × speed，
 * 即源域覆盖范围）；after = 建议区间换算至源域。保留比例按源域时长计算，
 * 与播放速率无关（speed 抵消）。
 */
export function buildSuggestionReviewModel(
  suggestion: SemanticRoughCutSuggestion,
  clip: Clip,
): SuggestionReviewModel {
  const speed = getClipSpeed(clip);
  const sourceTrimEnd = clip.trimStart + clip.duration * speed;
  const keptStart = toSourceTime(clip, speed, suggestion.timeRange.start);
  const keptEnd = toSourceTime(clip, speed, suggestion.timeRange.end);
  const originalDuration = Math.max(0, sourceTrimEnd - clip.trimStart);
  const keptDuration = Math.max(0, keptEnd - keptStart);
  return {
    before: {start: clip.trimStart, end: sourceTrimEnd},
    after: {start: keptStart, end: keptEnd},
    keptDuration,
    originalDuration,
    retentionRatio: originalDuration > 0 ? keptDuration / originalDuration : 0,
  };
}

/**
 * 判定建议是否覆盖整个 clip（ApplyRoughCutProposalCommand 对「保留
 * 整个 clip」的提案抛错，此判定供 UI 在采纳前给出可预期的失败反馈）。
 * 容差沿用命令侧 1e-6 口径。
 */
export function suggestionCoversEntireClip(
  suggestion: SemanticRoughCutSuggestion,
  clip: Clip,
): boolean {
  const EPSILON = 0.000001;
  return (
    suggestion.timeRange.start <= clip.start + EPSILON &&
    suggestion.timeRange.end >= clip.start + clip.duration - EPSILON
  );
}

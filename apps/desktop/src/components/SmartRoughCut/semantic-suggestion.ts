/**
 * M3-1 语义建议生成层（纯函数）
 *
 * 从桥接产出 speechUnderstanding.understanding 的 narrativeMarkers
 * 派生粗剪建议列表：climax 项优先（confidence 降序），其余按时间
 * 升序殿后；区间 = marker.time → 下一个 marker.time（最后项延伸至
 * clip 末端）。仅数据层，零 UI / 零 e2e 依赖；上游（understandSpeech
 * 桥接）零改动，只在桥接产出之上派生。
 */
import type { Clip, NarrativeMarker, SpeechUnderstandingResult } from '@open-factory/editor-core';

/** 语义粗剪建议（M3 产品输出契约，非持久化 schema，不落库） */
export interface SemanticRoughCutSuggestion {
  id: string;
  /** 时间线绝对时间区间（秒） */
  timeRange: { start: number; end: number };
  markerType: NarrativeMarker['type'];
  /** 透传 narrativeMarker.confidence */
  confidence: number;
  /** 中文展示标签 */
  label: string;
  /** 透传 narrativeMarker.description */
  reason: string;
}

/** marker.type → 中文展示标签 */
const MARKER_LABELS: Record<SemanticRoughCutSuggestion['markerType'], string> = {
  opening: '开场',
  rising: '铺垫',
  climax: '高潮片段',
  falling: '回落',
  ending: '收尾',
};

export interface GenerateSemanticSuggestionsOptions {
  /** 生成建议数量上限（默认全部保留） */
  maxSuggestions?: number;
}

/**
 * 从语义理解结果派生粗剪建议列表。
 *
 * 区间推导：markers 先按 time 升序（understandSpeech 返回已排序，
 * 此处防御性重排），第 i 项区间 = [markers[i].time, markers[i+1].time]，
 * 最后一项延伸至 clip 末端（clip.start + clip.duration）。
 * 排序：climax 项（confidence 降序）在前，其余按 time 升序殿后。
 * 边界：markers 空 / understanding undefined → []；marker.time 落在
 * clip 范围外的项剔除（时间线与 clip 不重叠，无法形成 clip 内建议
 * 区间；详见测试用例）。
 */
export function generateSemanticRoughCutSuggestions(
  understanding: SpeechUnderstandingResult | undefined,
  clip: Clip | undefined,
  options: GenerateSemanticSuggestionsOptions = {},
): SemanticRoughCutSuggestion[] {
  if (!clip || !understanding || understanding.narrativeMarkers.length === 0) {
    return [];
  }
  const clipStart = clip.start;
  const clipEnd = clip.start + clip.duration;
  // 防御性过滤 + 排序（上游已按 time 升序，此处不依赖该实现细节）
  const markers = understanding.narrativeMarkers
    .filter((marker) => marker.time >= clipStart && marker.time <= clipEnd)
    .sort((left, right) => left.time - right.time);
  if (markers.length === 0) {
    return [];
  }
  const suggestions = markers.map((marker, index) => {
    const end = index + 1 < markers.length ? markers[index + 1].time : clipEnd;
    return {
      id: `semantic-${index}`,
      timeRange: { start: marker.time, end },
      markerType: marker.type,
      confidence: marker.confidence,
      label: MARKER_LABELS[marker.type],
      reason: marker.description,
    };
  });
  const ordered = [
    ...suggestions.filter((item) => item.markerType === 'climax').sort((left, right) => right.confidence - left.confidence),
    ...suggestions.filter((item) => item.markerType !== 'climax'),
  ];
  const max = options.maxSuggestions;
  return typeof max === 'number' && max >= 0 ? ordered.slice(0, max) : ordered;
}

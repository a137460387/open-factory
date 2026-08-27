/**
 * 智能粗剪提案数据管线（D1-B：contentAnalysis 派生）
 *
 * 从时间线 clip 的 contentAnalysis 同步派生提案引擎输入：
 * - highlights：segments.motion>0.6 → motion-peak；emotionCurve.value>0.7 → combined
 *   （派生规则与 MediaBin useMediaBinState 先例一致，时间基准换算到 clip 本地域）
 * - onsets：segments.loudness 上升沿 + dialogueTurns 起点派生（零 bridge 调用）
 * 未分析 clip（无 contentAnalysis）返回空输入，入口侧负责禁用。
 */
import {
  getClipSpeed,
  round,
  type Clip,
} from '@open-factory/editor-core';
import type { OnsetEvent } from '@open-factory/editor-core/audio-rhythm-analysis';
import type { VisualHighlightMarker } from '@open-factory/editor-core/visual-highlight-engine';
import { useMemo } from 'react';

export interface UseRoughCutAnalysisResult {
  /** 视觉高光 marker（已换算到 clip 本地时间域） */
  highlights: VisualHighlightMarker[];
  /** 音频 onset 事件（由 loudness 上升沿派生，clip 本地时间域） */
  onsets: OnsetEvent[];
  /** 提案工作域时长（= clip 本地可见时长） */
  sourceDuration: number;
  /** clip 是否已有内容分析结果（无则入口禁用） */
  hasAnalysis: boolean;
}

/** loudness 上升沿判定阈值（相邻采样增量）；semantic-tighten-suggestion 源域派生同口径复用 */
export const ONSET_DELTA_THRESHOLD = 0.2;
/** onset 触发的最低 loudness 水平；semantic-tighten-suggestion 源域派生同口径复用 */
export const ONSET_LOUDNESS_FLOOR = 0.25;

export function useRoughCutAnalysis(selectedClip: Clip | undefined): UseRoughCutAnalysisResult {
  return useMemo(() => deriveRoughCutAnalysis(selectedClip), [selectedClip]);
}

export function deriveRoughCutAnalysis(selectedClip: Clip | undefined): UseRoughCutAnalysisResult {
  const analysis = selectedClip?.contentAnalysis;
  if (!selectedClip || !analysis) {
    return { highlights: [], onsets: [], sourceDuration: 0, hasAnalysis: false };
  }
  const speed = getClipSpeed(selectedClip);
  const sourceStart = selectedClip.trimStart;
  const sourceEnd = sourceStart + selectedClip.duration * speed;
  const toLocal = (time: number): number => round((time - sourceStart) / speed);
  const inWindow = (time: number): boolean =>
    time >= sourceStart - 0.000001 && time <= sourceEnd + 0.000001;

  const highlights: VisualHighlightMarker[] = [];
  for (const segment of analysis.segments) {
    if (segment.motion > 0.6 && inWindow(segment.start)) {
      highlights.push({
        time: toLocal(segment.start),
        frameIndex: 0,
        score: segment.motion,
        type: 'motion-peak',
        duration: round((segment.end - segment.start) / speed),
      });
    }
  }
  for (const point of analysis.emotionCurve) {
    if (point.value > 0.7 && inWindow(point.time)) {
      highlights.push({
        time: toLocal(point.time),
        frameIndex: 0,
        score: point.value,
        type: 'combined',
        duration: 1,
      });
    }
  }
  highlights.sort((left, right) => left.time - right.time);

  const onsets: OnsetEvent[] = [];
  const loudSegments = analysis.segments
    .filter((segment) => typeof segment.loudness === 'number' && inWindow(segment.start))
    .sort((left, right) => left.start - right.start);
  for (let index = 1; index < loudSegments.length; index += 1) {
    const previous = loudSegments[index - 1];
    const current = loudSegments[index];
    const delta = (current.loudness ?? 0) - (previous.loudness ?? 0);
    if (delta > ONSET_DELTA_THRESHOLD && (current.loudness ?? 0) > ONSET_LOUDNESS_FLOOR) {
      onsets.push({
        time: toLocal(current.start),
        strength: Math.min(1, round(delta * 2)),
        band: 'mid',
      });
    }
  }
  for (const turn of analysis.dialogueTurns) {
    if (inWindow(turn.start)) {
      onsets.push({
        time: toLocal(turn.start),
        strength: Math.min(1, round(turn.loudness)),
        band: 'mid',
      });
    }
  }
  onsets.sort((left, right) => left.time - right.time);

  return {
    highlights,
    onsets,
    sourceDuration: selectedClip.duration,
    hasAnalysis: true,
  };
}

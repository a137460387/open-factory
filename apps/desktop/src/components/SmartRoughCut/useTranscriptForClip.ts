/**
 * 转写文本 → 语义引擎桥接 hook
 *
 * 从时间线 subtitle 轨收集指定 clip 范围内的转写文本（whisper 产物，
 * clip 级 text + 时间对齐），组装 understandSpeech(transcript,
 * timeAlignment) 入参并激活沉睡的语义引擎，产出
 * keywords/topics/narrativeMarkers。零新增数据结构：全部复用
 * subtitle clip text、editor-core understandSpeech 与
 * useSmartRoughCut 扩展位（Compare 面板数据就绪信号）。
 */
import { understandSpeech, type Clip, type SpeechUnderstandingResult, type Timeline } from '@open-factory/editor-core';
import { useMemo } from 'react';
import { collectSubtitleTranscriptForClip, type SubtitleTranscriptSource } from './smart-rough-cut-utils';

export interface UseTranscriptForClipResult extends SubtitleTranscriptSource {
  /** 转写文本就绪信号（subtitle 轨存在与 clip 重叠的非空文本） */
  ready: boolean;
  /** 语义理解结果（understandSpeech 产出；无转写时为 undefined） */
  understanding: SpeechUnderstandingResult | undefined;
}

export function useTranscriptForClip(clip: Clip | undefined, timeline: Timeline): UseTranscriptForClipResult {
  const source = useMemo(() => collectSubtitleTranscriptForClip(timeline, clip), [timeline, clip]);
  const understanding = useMemo(
    () => (source.transcript.length > 0 ? understandSpeech(source.transcript, source.timeAlignment) : undefined),
    [source],
  );
  return { ...source, ready: source.transcript.length > 0, understanding };
}

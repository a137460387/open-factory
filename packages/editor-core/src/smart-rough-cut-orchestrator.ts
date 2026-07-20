/**
 * 智能粗剪编排器
 *
 * 整合场景检测、静音检测、Whisper 字幕、对话检测、节拍检测等 AI 分析结果，
 * 生成统一的、按优先级排序的剪辑建议列表，供 SmartRoughCutPanel 消费。
 *
 * 设计原则：
 * - 纯函数，无副作用，方便测试
 * - 接受预分析数据（Tauri bridge 调用在 app 层完成）
 * - 输出标准化的建议与报告
 */

import { round } from './time';
import type { SilentRange } from './audio/silence-detection';
import type { DialogueInterval } from './audio/dialogue-detection';
import type { SceneDetectionResult, SceneBoundary } from './ai-scene-detector';
import type { EmotionAnalysisResult } from './ai-emotion-analyzer';
import type { SpeechUnderstandingResult } from './ai-speech-understanding';
import type { NarrativeAnalysisResult } from './ai-narrative-analyzer';
import type { ContentSceneType } from './content-analysis';

// ─── 建议类型 ──────────────────────────────────────────────

export type SmartRoughCutSuggestionType =
  | 'scene_split'
  | 'silence_remove'
  | 'subtitle_add'
  | 'dialogue_extract'
  | 'broll_insert'
  | 'rhythm_cut'
  | 'emotion_highlight'
  | 'narrative_structure';

export type SmartRoughCutActionType = 'split' | 'remove' | 'add_track' | 'extract' | 'insert' | 'reorder';

export interface SmartRoughCutSuggestion {
  id: string;
  type: SmartRoughCutSuggestionType;
  action: SmartRoughCutActionType;
  priority: number;
  confidence: number;
  timeStart: number;
  timeEnd: number;
  reason: string;
  metadata: Record<string, unknown>;
  selected: boolean;
}

// ─── 输入数据 ──────────────────────────────────────────────

export interface SmartRoughCutSceneInput {
  mediaId: string;
  result: SceneDetectionResult;
}

export interface SmartRoughCutSilenceInput {
  mediaId: string;
  clipId: string;
  ranges: SilentRange[];
}

export interface SmartRoughCutSubtitleInput {
  mediaId: string;
  clipId: string;
  cueCount: number;
  totalDuration: number;
}

export interface SmartRoughCutDialogueInput {
  mediaId: string;
  clipId: string;
  intervals: DialogueInterval[];
}

export interface SmartRoughCutBeatInput {
  beatTimes: number[];
  bpm?: number;
}

export interface SmartRoughCutEmotionInput {
  result: EmotionAnalysisResult;
}

export interface SmartRoughCutSpeechInput {
  result: SpeechUnderstandingResult;
}

export interface SmartRoughCutNarrativeInput {
  result: NarrativeAnalysisResult;
}

export interface SmartRoughCutAnalysisData {
  scenes?: SmartRoughCutSceneInput[];
  silences?: SmartRoughCutSilenceInput[];
  subtitles?: SmartRoughCutSubtitleInput[];
  dialogues?: SmartRoughCutDialogueInput[];
  beats?: SmartRoughCutBeatInput;
  emotions?: SmartRoughCutEmotionInput;
  speech?: SmartRoughCutSpeechInput;
  narrative?: SmartRoughCutNarrativeInput;
}

// ─── 编排选项 ──────────────────────────────────────────────

export interface SmartRoughCutOrchestratorOptions {
  enableSceneSplit?: boolean;
  enableSilenceRemoval?: boolean;
  enableSubtitleGeneration?: boolean;
  enableDialogueExtraction?: boolean;
  enableRhythmCut?: boolean;
  enableEmotionHighlight?: boolean;
  enableNarrativeStructure?: boolean;
  minConfidence?: number;
  silenceThresholdDb?: number;
  minSilenceDuration?: number;
  maxSuggestions?: number;
}

const DEFAULT_OPTIONS: Required<SmartRoughCutOrchestratorOptions> = {
  enableSceneSplit: true,
  enableSilenceRemoval: true,
  enableSubtitleGeneration: true,
  enableDialogueExtraction: true,
  enableRhythmCut: true,
  enableEmotionHighlight: true,
  enableNarrativeStructure: true,
  minConfidence: 0.3,
  silenceThresholdDb: -40,
  minSilenceDuration: 0.5,
  maxSuggestions: 200,
};

// ─── 报告类型 ──────────────────────────────────────────────

export interface SmartRoughCutReport {
  totalMediaAnalyzed: number;
  sceneBoundaries: number;
  silenceRangesFound: number;
  silenceDurationRemoved: number;
  subtitleCuesGenerated: number;
  dialogueIntervalsFound: number;
  dialogueDurationTotal: number;
  beatCount: number;
  estimatedBpm: number;
  suggestionsByType: Record<SmartRoughCutSuggestionType, number>;
  totalSuggestions: number;
  selectedSuggestions: number;
  estimatedOutputDuration: number;
  emotionPeaks: number;
  narrativeActs: number;
  generatedAt: string;
}

// ─── 编排结果 ──────────────────────────────────────────────

export interface SmartRoughCutOrchestrationResult {
  suggestions: SmartRoughCutSuggestion[];
  report: SmartRoughCutReport;
}

// ─── 主编排函数 ──────────────────────────────────────────────

export function orchestrateSmartRoughCut(
  data: SmartRoughCutAnalysisData,
  options?: SmartRoughCutOrchestratorOptions,
): SmartRoughCutOrchestrationResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const suggestions: SmartRoughCutSuggestion[] = [];
  let idCounter = 0;

  const nextId = (prefix: string): string => `${prefix}-${++idCounter}`;

  // ── 场景检测建议 ──
  if (opts.enableSceneSplit && data.scenes) {
    for (const sceneInput of data.scenes) {
      for (const boundary of sceneInput.result.boundaries) {
        if (boundary.score < opts.minConfidence) continue;
        suggestions.push({
          id: nextId('scene'),
          type: 'scene_split',
          action: 'split',
          priority: calculateScenePriority(boundary),
          confidence: boundary.score,
          timeStart: boundary.time,
          timeEnd: boundary.time,
          reason: buildSceneReason(boundary),
          metadata: {
            mediaId: sceneInput.mediaId,
            histogramDiff: boundary.histogramDiff,
            motionDiff: boundary.motionDiff,
            threshold: boundary.threshold,
          },
          selected: true,
        });
      }
    }
  }

  // ── 静音检测建议 ──
  if (opts.enableSilenceRemoval && data.silences) {
    for (const silenceInput of data.silences) {
      for (const range of silenceInput.ranges) {
        if (range.duration < opts.minSilenceDuration) continue;
        suggestions.push({
          id: nextId('silence'),
          type: 'silence_remove',
          action: 'remove',
          priority: calculateSilencePriority(range),
          confidence: Math.min(1, range.duration / 3),
          timeStart: range.start,
          timeEnd: range.end,
          reason: buildSilenceReason(range),
          metadata: {
            mediaId: silenceInput.mediaId,
            clipId: silenceInput.clipId,
            duration: range.duration,
          },
          selected: true,
        });
      }
    }
  }

  // ── 字幕建议 ──
  if (opts.enableSubtitleGeneration && data.subtitles) {
    for (const subtitleInput of data.subtitles) {
      if (subtitleInput.cueCount === 0) continue;
      suggestions.push({
        id: nextId('subtitle'),
        type: 'subtitle_add',
        action: 'add_track',
        priority: 70,
        confidence: 0.9,
        timeStart: 0,
        timeEnd: subtitleInput.totalDuration,
        reason: `生成 ${subtitleInput.cueCount} 条字幕，覆盖 ${round(subtitleInput.totalDuration)}s`,
        metadata: {
          mediaId: subtitleInput.mediaId,
          clipId: subtitleInput.clipId,
          cueCount: subtitleInput.cueCount,
        },
        selected: true,
      });
    }
  }

  // ── 对话提取建议 ──
  if (opts.enableDialogueExtraction && data.dialogues) {
    for (const dialogueInput of data.dialogues) {
      const totalDuration = dialogueInput.intervals.reduce((sum, interval) => sum + (interval.end - interval.start), 0);
      if (dialogueInput.intervals.length === 0) continue;
      suggestions.push({
        id: nextId('dialogue'),
        type: 'dialogue_extract',
        action: 'extract',
        priority: 65,
        confidence: calculateDialogueConfidence(dialogueInput.intervals),
        timeStart: dialogueInput.intervals[0]?.start ?? 0,
        timeEnd: dialogueInput.intervals[dialogueInput.intervals.length - 1]?.end ?? 0,
        reason: `检测到 ${dialogueInput.intervals.length} 段对话，合计 ${round(totalDuration)}s`,
        metadata: {
          mediaId: dialogueInput.mediaId,
          clipId: dialogueInput.clipId,
          intervalCount: dialogueInput.intervals.length,
          totalDuration,
        },
        selected: true,
      });
    }
  }

  // ── 节拍剪辑建议 ──
  if (opts.enableRhythmCut && data.beats && data.beats.beatTimes.length >= 2) {
    const beatTimes = data.beats.beatTimes;
    suggestions.push({
      id: nextId('rhythm'),
      type: 'rhythm_cut',
      action: 'reorder',
      priority: 55,
      confidence: 0.8,
      timeStart: beatTimes[0],
      timeEnd: beatTimes[beatTimes.length - 1],
      reason: `基于 ${beatTimes.length} 个节拍点${data.beats.bpm ? `（约 ${round(data.beats.bpm)} BPM）` : ''}进行节奏剪辑`,
      metadata: {
        beatCount: beatTimes.length,
        bpm: data.beats.bpm,
        beatTimes,
      },
      selected: true,
    });
  }

  // ── 情感高亮建议 ──
  if (opts.enableEmotionHighlight && data.emotions) {
    const peaks = data.emotions.result.peaks;
    for (const peak of peaks) {
      if (Math.abs(peak.value) < 0.5) continue;
      suggestions.push({
        id: nextId('emotion'),
        type: 'emotion_highlight',
        action: 'split',
        priority: calculateEmotionPriority(peak.value),
        confidence: Math.abs(peak.value),
        timeStart: peak.time,
        timeEnd: peak.time,
        reason: `情感${peak.type === 'positive' ? '正面' : peak.type === 'negative' ? '负面' : '中性'}峰值（${round(peak.value, 2)}）`,
        metadata: {
          emotionType: peak.type,
          value: peak.value,
        },
        selected: false,
      });
    }
  }

  // ── 叙事结构建议 ──
  if (opts.enableNarrativeStructure && data.narrative) {
    const acts = data.narrative.result.structure.acts;
    for (const act of acts) {
      suggestions.push({
        id: nextId('narrative'),
        type: 'narrative_structure',
        action: 'split',
        priority: 40,
        confidence: 0.7,
        timeStart: act.start,
        timeEnd: act.end,
        reason: `叙事${act.label === 'setup' ? '铺垫' : act.label === 'development' ? '发展' : act.label === 'climax' ? '高潮' : '收尾'}段落`,
        metadata: {
          actLabel: act.label,
          segmentIndices: act.segmentIndices,
        },
        selected: false,
      });
    }
  }

  // 排序：优先级降序，同优先级按时间升序
  suggestions.sort((a, b) => b.priority - a.priority || a.timeStart - b.timeStart);

  // 限制数量
  const trimmed = opts.maxSuggestions > 0 ? suggestions.slice(0, opts.maxSuggestions) : suggestions;

  // 标记选中状态
  for (const s of trimmed) {
    s.selected = s.confidence >= opts.minConfidence && s.selected;
  }

  const report = buildSmartRoughCutReport(data, trimmed);

  return { suggestions: trimmed, report };
}

// ─── 建议选择管理 ──────────────────────────────────────────────

export function toggleSuggestionSelection(
  suggestions: SmartRoughCutSuggestion[],
  id: string,
): SmartRoughCutSuggestion[] {
  return suggestions.map((s) => (s.id === id ? { ...s, selected: !s.selected } : s));
}

export function setAllSuggestionSelection(
  suggestions: SmartRoughCutSuggestion[],
  selected: boolean,
): SmartRoughCutSuggestion[] {
  return suggestions.map((s) => ({ ...s, selected }));
}

export function selectSuggestionsByType(
  suggestions: SmartRoughCutSuggestion[],
  type: SmartRoughCutSuggestionType,
  selected: boolean,
): SmartRoughCutSuggestion[] {
  return suggestions.map((s) => (s.type === type ? { ...s, selected } : s));
}

export function getSelectedSuggestions(suggestions: SmartRoughCutSuggestion[]): SmartRoughCutSuggestion[] {
  return suggestions.filter((s) => s.selected);
}

export function reorderSuggestions(
  suggestions: SmartRoughCutSuggestion[],
  fromIndex: number,
  toIndex: number,
): SmartRoughCutSuggestion[] {
  const result = [...suggestions];
  const [moved] = result.splice(fromIndex, 1);
  if (moved) {
    result.splice(toIndex, 0, moved);
  }
  return result;
}

// ─── 报告生成 ──────────────────────────────────────────────

export function buildSmartRoughCutReport(
  data: SmartRoughCutAnalysisData,
  suggestions: SmartRoughCutSuggestion[],
): SmartRoughCutReport {
  const suggestionsByType: Record<SmartRoughCutSuggestionType, number> = {
    scene_split: 0,
    silence_remove: 0,
    subtitle_add: 0,
    dialogue_extract: 0,
    broll_insert: 0,
    rhythm_cut: 0,
    emotion_highlight: 0,
    narrative_structure: 0,
  };

  for (const s of suggestions) {
    suggestionsByType[s.type]++;
  }

  const silenceDurationRemoved = (data.silences ?? []).reduce(
    (sum, si) => sum + si.ranges.reduce((s, r) => s + r.duration, 0),
    0,
  );

  const dialogueDurationTotal = (data.dialogues ?? []).reduce(
    (sum, di) => sum + di.intervals.reduce((s, i) => s + (i.end - i.start), 0),
    0,
  );

  const totalSubtitleCues = (data.subtitles ?? []).reduce((sum, s) => sum + s.cueCount, 0);

  const sceneBoundaryCount = (data.scenes ?? []).reduce((sum, s) => sum + s.result.boundaries.length, 0);

  const dialogueIntervalCount = (data.dialogues ?? []).reduce((sum, d) => sum + d.intervals.length, 0);

  // 估算输出时长：从场景段总时长减去静音时长
  const sceneSegmentDuration = (data.scenes ?? []).reduce(
    (sum, s) => sum + s.result.segments.reduce((segSum, seg) => segSum + (seg.end - seg.start), 0),
    0,
  );
  const estimatedOutputDuration = Math.max(0, sceneSegmentDuration - silenceDurationRemoved);

  return {
    totalMediaAnalyzed: (data.scenes ?? []).length || (data.silences ?? []).length || 0,
    sceneBoundaries: sceneBoundaryCount,
    silenceRangesFound: (data.silences ?? []).reduce((sum, s) => sum + s.ranges.length, 0),
    silenceDurationRemoved: round(silenceDurationRemoved),
    subtitleCuesGenerated: totalSubtitleCues,
    dialogueIntervalsFound: dialogueIntervalCount,
    dialogueDurationTotal: round(dialogueDurationTotal),
    beatCount: data.beats?.beatTimes.length ?? 0,
    estimatedBpm: data.beats?.bpm ?? 0,
    suggestionsByType,
    totalSuggestions: suggestions.length,
    selectedSuggestions: suggestions.filter((s) => s.selected).length,
    estimatedOutputDuration: round(estimatedOutputDuration),
    emotionPeaks: data.emotions?.result.peaks.length ?? 0,
    narrativeActs: data.narrative?.result.structure.acts.length ?? 0,
    generatedAt: new Date().toISOString(),
  };
}

// ─── 辅助函数 ──────────────────────────────────────────────

function calculateScenePriority(boundary: SceneBoundary): number {
  // 场景切换越明显，优先级越高
  return round(Math.min(100, 50 + boundary.score * 50));
}

function calculateSilencePriority(range: SilentRange): number {
  // 静音越长，优先级越高
  return round(Math.min(100, 60 + range.duration * 10));
}

function calculateEmotionPriority(value: number): number {
  return round(Math.min(100, 40 + Math.abs(value) * 40));
}

function calculateDialogueConfidence(intervals: DialogueInterval[]): number {
  if (intervals.length === 0) return 0;
  const avgConfidence = intervals.reduce((sum, i) => sum + i.confidence, 0) / intervals.length;
  return round(avgConfidence, 2);
}

function buildSceneReason(boundary: SceneBoundary): string {
  const parts: string[] = [];
  if (boundary.histogramDiff > 0.5) parts.push('色彩变化显著');
  if (boundary.motionDiff > 0.5) parts.push('运动变化显著');
  if (parts.length === 0) parts.push('场景切换');
  return parts.join('，');
}

function buildSilenceReason(range: SilentRange): string {
  return `静音段 ${round(range.duration, 2)}s（${round(range.start, 2)}s - ${round(range.end, 2)}s）`;
}

// ─── 快捷编排：从原始数据一步生成 ──────────────────────────────

/**
 * 从原始的 Tauri bridge 分析结果构建编排输入。
 * 适用于 app 层直接调用 bridge 后传入结果。
 */
export function buildOrchestrationInput(
  mediaId: string,
  sceneResult?: SceneDetectionResult,
  silenceRanges?: SilentRange[],
  clipId?: string,
  dialogueIntervals?: DialogueInterval[],
  beatTimes?: number[],
  bpm?: number,
): SmartRoughCutAnalysisData {
  const data: SmartRoughCutAnalysisData = {};

  if (sceneResult) {
    data.scenes = [{ mediaId, result: sceneResult }];
  }

  if (silenceRanges && silenceRanges.length > 0 && clipId) {
    data.silences = [{ mediaId, clipId, ranges: silenceRanges }];
  }

  if (dialogueIntervals && dialogueIntervals.length > 0 && clipId) {
    data.dialogues = [{ mediaId, clipId, intervals: dialogueIntervals }];
  }

  if (beatTimes && beatTimes.length >= 2) {
    data.beats = { beatTimes, bpm };
  }

  return data;
}

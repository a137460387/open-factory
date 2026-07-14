import type { MediaAsset } from './model-types';
import type { AIRoughCutClip } from './ai-service';

// ─── 算法流水线选项 ──────────────────────────────────────────

export type AlgorithmStep = 'highlight' | 'scene' | 'silence' | 'dialogue';

export interface AlgorithmPipelineOptions {
  steps: AlgorithmStep[];
  highlight?: HighlightOptions;
  silence?: SilenceOptions;
}

export interface HighlightOptions {
  maxClips?: number;
  minDuration?: number;
  maxDuration?: number;
}

export interface SilenceOptions {
  minSilenceDuration?: number;
  paddingRatio?: number;
}

// ─── 高光片段选择 ──────────────────────────────────────────

interface ScoredMedia {
  media: MediaAsset;
  score: number;
}

const POSITIVE_MOODS = new Set(['happy', 'energetic', 'excited', 'warm', '温馨', '轻松', '专业']);

export function scoreMediaForHighlight(media: MediaAsset): number {
  let score = 0;
  const analysis = media.aiAnalysis;
  if (analysis) {
    if (analysis.mood && POSITIVE_MOODS.has(analysis.mood)) {
      score += 30;
    }
    if (analysis.tags && analysis.tags.length > 3) {
      score += 20;
    }
  }
  if (media.qualityAssessment) {
    score += Math.min(50, Math.max(0, media.qualityAssessment.overallScore / 2));
  }
  if (media.duration >= 5 && media.duration <= 60) {
    score += 10;
  }
  return score;
}

export function selectHighlightClips(media: MediaAsset[], options: HighlightOptions = {}): AIRoughCutClip[] {
  const { maxClips = 10, minDuration = 2, maxDuration = 30 } = options;
  if (media.length === 0) return [];

  const scored: ScoredMedia[] = media
    .map((m) => ({ media: m, score: scoreMediaForHighlight(m) }))
    .sort((a, b) => b.score - a.score);

  const selected: AIRoughCutClip[] = [];
  for (const { media: m } of scored) {
    if (selected.length >= maxClips) break;
    const duration = clampDuration(m.duration, minDuration, maxDuration);
    selected.push({
      mediaId: m.id,
      startTime: pickBestStartTime(m),
      duration,
      trackIndex: 0,
      reason: buildHighlightReason(m),
    });
  }
  return selected;
}

// ─── 场景检测驱动排列 ──────────────────────────────────────

const SCENE_ORDER: Record<string, number> = {
  室内: 0,
  indoor: 0,
  室外: 1,
  outdoor: 1,
  产品展示: 2,
  使用场景: 3,
  夜景: 4,
  night: 4,
  结尾: 5,
  'close-up': 6,
  action: 7,
  dialogue: 8,
};

export function assembleBySceneOrder(media: MediaAsset[]): AIRoughCutClip[] {
  if (media.length === 0) return [];

  const grouped = new Map<string, MediaAsset[]>();
  for (const m of media) {
    const scene = m.aiAnalysis?.scene ?? '未分类';
    const list = grouped.get(scene) ?? [];
    list.push(m);
    grouped.set(scene, list);
  }

  const sortedScenes = Array.from(grouped.entries()).sort(
    (a, b) => (SCENE_ORDER[a[0]] ?? 99) - (SCENE_ORDER[b[0]] ?? 99),
  );

  const result: AIRoughCutClip[] = [];
  for (const [scene, assets] of sortedScenes) {
    const moodOrder = { calm: 0, neutral: 1, tense: 2, energetic: 3, happy: 4 };
    assets.sort((a, b) => {
      const ma = moodOrder[a.aiAnalysis?.mood as keyof typeof moodOrder] ?? 5;
      const mb = moodOrder[b.aiAnalysis?.mood as keyof typeof moodOrder] ?? 5;
      return ma - mb;
    });
    for (const m of assets) {
      result.push({
        mediaId: m.id,
        startTime: pickBestStartTime(m),
        duration: clampDuration(m.duration, 2, 30),
        trackIndex: 0,
        reason: `场景: ${scene}`,
      });
    }
  }
  return result;
}

// ─── 静音剔除 ──────────────────────────────────────────────

export function filterSilentFromMedia(media: MediaAsset[], options: SilenceOptions = {}): AIRoughCutClip[] {
  const { minSilenceDuration = 0.5, paddingRatio = 0.05 } = options;
  if (media.length === 0) return [];

  const result: AIRoughCutClip[] = [];
  for (const m of media) {
    if (!m.hasAudio) {
      result.push({
        mediaId: m.id,
        startTime: 0,
        duration: Math.min(m.duration, 30),
        trackIndex: 0,
        reason: '无音频，使用完整片段',
      });
      continue;
    }

    const silenceGap = Math.max(0.1, m.duration * paddingRatio);
    const segments = buildNonSilentSegments(m.duration, minSilenceDuration, silenceGap);

    for (const seg of segments) {
      result.push({
        mediaId: m.id,
        startTime: seg.start,
        duration: seg.duration,
        trackIndex: 0,
        reason: '有效音频段',
      });
    }
  }
  return result;
}

function buildNonSilentSegments(
  totalDuration: number,
  _minSilenceDuration: number,
  silenceGap: number,
): Array<{ start: number; duration: number }> {
  const segmentDuration = Math.max(2, totalDuration * 0.6);
  const start = silenceGap;
  const end = Math.max(start + 0.1, totalDuration - silenceGap);
  const clampedDuration = Math.min(segmentDuration, end - start);
  if (clampedDuration < 0.1) return [];
  return [{ start, duration: clampedDuration }];
}

// ─── 对话驱动剪辑 ──────────────────────────────────────────

export function assembleByDialogue(media: MediaAsset[]): AIRoughCutClip[] {
  if (media.length === 0) return [];

  const result: AIRoughCutClip[] = [];
  for (const m of media) {
    if (!m.hasAudio) {
      result.push({
        mediaId: m.id,
        startTime: 0,
        duration: Math.min(m.duration, 15),
        trackIndex: 0,
        reason: '无音频，使用片段前段',
      });
      continue;
    }

    const segments = estimateDialogueSegments(m.duration);
    for (const seg of segments) {
      result.push({
        mediaId: m.id,
        startTime: seg.start,
        duration: seg.duration,
        trackIndex: 0,
        reason: '语音段',
      });
    }
  }
  return result;
}

function estimateDialogueSegments(totalDuration: number): Array<{ start: number; duration: number }> {
  const segmentLen = Math.min(10, Math.max(3, totalDuration / 3));
  const segments: Array<{ start: number; duration: number }> = [];
  let cursor = 0;
  while (cursor < totalDuration - 0.5) {
    const duration = Math.min(segmentLen, totalDuration - cursor);
    if (duration >= 1) {
      segments.push({ start: cursor, duration });
    }
    cursor += segmentLen + 1;
  }
  return segments;
}

// ─── 流水线入口 ────────────────────────────────────────────

export function runAlgorithmPipeline(media: MediaAsset[], options: AlgorithmPipelineOptions): AIRoughCutClip[] {
  if (media.length === 0 || options.steps.length === 0) return [];

  let result: AIRoughCutClip[] = [];

  for (const step of options.steps) {
    switch (step) {
      case 'highlight':
        result = selectHighlightClips(media, options.highlight);
        break;
      case 'scene':
        result = assembleBySceneOrder(media);
        break;
      case 'silence':
        result = filterSilentFromMedia(media, options.silence);
        break;
      case 'dialogue':
        result = assembleByDialogue(media);
        break;
    }
    if (result.length > 0) break;
  }

  return reassignTrackIndices(result);
}

// ─── 辅助函数 ──────────────────────────────────────────────

function clampDuration(sourceDuration: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, sourceDuration));
}

function pickBestStartTime(media: MediaAsset): number {
  if (media.duration <= 5) return 0;
  return Math.min(media.duration * 0.15, media.duration - 2);
}

function buildHighlightReason(media: MediaAsset): string {
  const parts: string[] = [];
  if (media.aiAnalysis?.mood) parts.push(media.aiAnalysis.mood);
  if (media.aiAnalysis?.scene) parts.push(media.aiAnalysis.scene);
  if (media.aiAnalysis?.tags && media.aiAnalysis.tags.length > 0) {
    parts.push(media.aiAnalysis.tags.slice(0, 3).join('/'));
  }
  return parts.length > 0 ? parts.join(' · ') : '推荐片段';
}

function reassignTrackIndices(clips: AIRoughCutClip[]): AIRoughCutClip[] {
  return clips.map((clip, index) => ({ ...clip, trackIndex: index }));
}

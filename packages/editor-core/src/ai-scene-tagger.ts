/**
 * AI Scene Tagger
 *
 * Analyzes media assets and generates semantic tags based on
 * content analysis results. Uses local AI analysis data (brightness,
 * motion, scene types, dialogue detection) — no external API calls.
 */

import type { MediaAsset, MediaMetadata } from './model-types';
import type { ClipContentAnalysis, ContentSceneType } from './content-analysis';
import { CONTENT_SCENE_TYPES } from './content-analysis';

// ─── Types ──────────────────────────────────────────────

export interface SceneTag {
  tag: string;
  confidence: number;
  source: 'ai-analysis' | 'content-heuristic' | 'audio-analysis';
}

export interface MediaTagSuggestion {
  mediaId: string;
  tags: SceneTag[];
  analyzedAt: string;
}

export interface AutoTagOptions {
  /** Minimum confidence to include a tag */
  minConfidence?: number;
  /** Maximum number of tags per asset */
  maxTagsPerAsset?: number;
  /** Whether to include content analysis scene types */
  includeSceneTypes?: boolean;
  /** Whether to generate mood tags from brightness/emotion */
  includeMoodTags?: boolean;
  /** Whether to generate audio tags */
  includeAudioTags?: boolean;
}

const DEFAULT_OPTIONS: Required<AutoTagOptions> = {
  minConfidence: 0.5,
  maxTagsPerAsset: 12,
  includeSceneTypes: true,
  includeMoodTags: true,
  includeAudioTags: true,
};

// ─── Scene Type Labels (Chinese) ────────────────────────

const SCENE_TYPE_LABELS: Record<ContentSceneType, string> = {
  indoor: '室内',
  outdoor: '户外',
  night: '夜景',
  action: '动态',
  dialogue: '对话',
  'close-up': '特写',
};

// ─── Public API ──────────────────────────────────────────

export function generateAutoTags(
  asset: MediaAsset,
  contentAnalysis?: ClipContentAnalysis,
  options?: AutoTagOptions,
): MediaTagSuggestion {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const tags: SceneTag[] = [];

  if (opts.includeSceneTypes && contentAnalysis) {
    tags.push(...generateSceneTypeTags(contentAnalysis));
  }

  if (opts.includeMoodTags && contentAnalysis) {
    tags.push(...generateMoodTags(contentAnalysis));
  }

  if (opts.includeAudioTags && contentAnalysis) {
    tags.push(...generateAudioTags(contentAnalysis));
  }

  tags.push(...generateMetadataTags(asset));

  // Deduplicate, filter by confidence, limit count
  const seen = new Set<string>();
  const unique = tags
    .filter((t) => t.confidence >= opts.minConfidence && !seen.has(t.tag) && seen.add(t.tag))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, opts.maxTagsPerAsset);

  return {
    mediaId: asset.id,
    tags: unique,
    analyzedAt: new Date().toISOString(),
  };
}

export function generateAutoTagsBatch(
  assets: MediaAsset[],
  metadata: Record<string, MediaMetadata>,
  contentAnalyses: Record<string, ClipContentAnalysis>,
  options?: AutoTagOptions,
): MediaTagSuggestion[] {
  return assets.map((asset) =>
    generateAutoTags(asset, contentAnalyses[asset.id], options),
  );
}

export function mergeAutoTagsWithExisting(
  existing: string[],
  autoTags: SceneTag[],
): string[] {
  const merged = new Set(existing);
  for (const tag of autoTags) {
    merged.add(tag.tag);
  }
  return Array.from(merged);
}

export function getTagsByCategory(tags: SceneTag[]): Record<string, SceneTag[]> {
  const categories: Record<string, SceneTag[]> = {};
  for (const tag of tags) {
    const category = tag.source === 'ai-analysis' ? 'AI 分析'
      : tag.source === 'audio-analysis' ? '音频分析'
      : '内容启发';
    if (!categories[category]) categories[category] = [];
    categories[category].push(tag);
  }
  return categories;
}

// ─── Tag Generation ──────────────────────────────────────

function generateSceneTypeTags(analysis: ClipContentAnalysis): SceneTag[] {
  const tags: SceneTag[] = [];

  // Primary scene type gets highest confidence
  if (analysis.primarySceneType) {
    const label = SCENE_TYPE_LABELS[analysis.primarySceneType];
    if (label) {
      tags.push({
        tag: label,
        confidence: 0.9,
        source: 'ai-analysis',
      });
    }
  }

  // Secondary scene types with count-based confidence
  const typeCounts = new Map<ContentSceneType, number>();
  for (const seg of analysis.segments) {
    for (const st of seg.sceneTypes) {
      typeCounts.set(st, (typeCounts.get(st) ?? 0) + 1);
    }
  }

  const totalSegments = Math.max(1, analysis.segments.length);
  for (const [type, count] of typeCounts) {
    if (type === analysis.primarySceneType) continue;
    const ratio = count / totalSegments;
    const label = SCENE_TYPE_LABELS[type];
    if (label && ratio > 0.2) {
      tags.push({ tag: label, confidence: Math.min(0.85, 0.5 + ratio * 0.4), source: 'ai-analysis' });
    }
  }

  return tags;
}

function generateMoodTags(analysis: ClipContentAnalysis): SceneTag[] {
  const tags: SceneTag[] = [];

  // Average brightness
  const avgBrightness = average(analysis.segments.map((s) => s.brightness));
  if (avgBrightness > 0.7) {
    tags.push({ tag: '明亮', confidence: 0.75, source: 'content-heuristic' });
  } else if (avgBrightness < 0.3) {
    tags.push({ tag: '暗调', confidence: 0.75, source: 'content-heuristic' });
  }

  // Average motion
  const avgMotion = average(analysis.segments.map((s) => s.motion));
  if (avgMotion > 0.6) {
    tags.push({ tag: '高运动', confidence: 0.7, source: 'content-heuristic' });
  } else if (avgMotion < 0.2) {
    tags.push({ tag: '静态', confidence: 0.7, source: 'content-heuristic' });
  }

  // Emotion curve variance
  if (analysis.emotionCurve.length > 2) {
    const values = analysis.emotionCurve.map((e) => e.value);
    const variance = calculateVariance(values);
    if (variance > 0.1) {
      tags.push({ tag: '情绪丰富', confidence: 0.65, source: 'content-heuristic' });
    }
  }

  return tags;
}

function generateAudioTags(analysis: ClipContentAnalysis): SceneTag[] {
  const tags: SceneTag[] = [];

  if (analysis.dialogueTurns.length > 0) {
    const totalDialogueDuration = analysis.dialogueTurns.reduce(
      (sum, t) => sum + (t.end - t.start),
      0,
    );
    const segmentDuration = analysis.segments.reduce(
      (sum, s) => sum + (s.end - s.start),
      0,
    );
    const dialogueRatio = segmentDuration > 0 ? totalDialogueDuration / segmentDuration : 0;

    if (dialogueRatio > 0.5) {
      tags.push({ tag: '对话为主', confidence: 0.8, source: 'audio-analysis' });
    } else if (dialogueRatio < 0.15 && analysis.dialogueTurns.length > 0) {
      tags.push({ tag: '少量对话', confidence: 0.6, source: 'audio-analysis' });
    }

    if (analysis.dialogueTurns.length >= 3) {
      tags.push({ tag: '多人对话', confidence: 0.65, source: 'audio-analysis' });
    }
  } else {
    tags.push({ tag: '无对话', confidence: 0.7, source: 'audio-analysis' });
  }

  return tags;
}

function generateMetadataTags(asset: MediaAsset): SceneTag[] {
  const tags: SceneTag[] = [];

  // Resolution-based tags
  if (asset.width >= 3840 || asset.height >= 2160) {
    tags.push({ tag: '4K', confidence: 1, source: 'content-heuristic' });
  } else if (asset.width >= 1920 || asset.height >= 1080) {
    tags.push({ tag: '1080p', confidence: 1, source: 'content-heuristic' });
  }

  // Duration-based tags
  if (asset.duration > 600) {
    tags.push({ tag: '长视频', confidence: 0.8, source: 'content-heuristic' });
  } else if (asset.duration < 15) {
    tags.push({ tag: '短视频', confidence: 0.8, source: 'content-heuristic' });
  }

  // Media type
  if (asset.type === 'video') {
    tags.push({ tag: '视频', confidence: 1, source: 'content-heuristic' });
  } else if (asset.type === 'audio') {
    tags.push({ tag: '音频', confidence: 1, source: 'content-heuristic' });
  } else if (asset.type === 'image') {
    tags.push({ tag: '图片', confidence: 1, source: 'content-heuristic' });
  }

  return tags;
}

// ─── Helpers ──────────────────────────────────────────

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function calculateVariance(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = average(values);
  return average(values.map((v) => (v - avg) ** 2));
}

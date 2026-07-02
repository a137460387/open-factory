import type { AiModuleResult, TranslateFn } from './ai-module-types';
import { identityTranslator } from './ai-module-types';

export const SCENE_MATCH_MAX_SIMILAR = 3;
export const SCENE_MATCH_MAX_CONTRAST = 3;

export interface SceneMatchMediaItem {
  mediaId: string;
  name: string;
  type: string;
  aiAnalysis?: {
    tags?: string[];
    scene?: string;
    mood?: string;
    objects?: string[];
  };
}

export interface SceneMatchClipContext {
  clipId: string;
  clipName: string;
  clipType: string;
  aiAnalysis?: {
    tags?: string[];
    scene?: string;
    mood?: string;
    objects?: string[];
  };
  prevScene?: string;
  nextScene?: string;
}

export interface SceneMatchResult {
  mediaId: string;
  score: number;
  reason: string;
}

export interface SceneMatchResponse {
  similar: SceneMatchResult[];
  contrast: SceneMatchResult[];
}

export interface SceneMatchDragParams {
  mediaId: string;
  name: string;
  type: string;
  path: string;
  duration: number;
  width: number;
  height: number;
}

/**
 * Build the context for scene match analysis from the selected clip and its timeline neighbors.
 */
export function buildSceneMatchContext(
  clip: { id: string; name: string; type: string; mediaId?: string; aiAnalysis?: { tags?: string[]; scene?: string; mood?: string; objects?: string[] } },
  timelineClips: Array<{ id: string; start: number; mediaId?: string; aiAnalysis?: { tags?: string[]; scene?: string; mood?: string; objects?: string[] } }>,
  media: Array<{ id: string; aiAnalysis?: { tags?: string[]; scene?: string; mood?: string; objects?: string[] } }>
): SceneMatchClipContext {
  const sorted = [...timelineClips].sort((a, b) => a.start - b.start);
  const idx = sorted.findIndex((c) => c.id === clip.id);

  let prevScene: string | undefined;
  let nextScene: string | undefined;

  if (idx > 0) {
    const prev = sorted[idx - 1];
    const prevAnalysis = prev.aiAnalysis ?? (prev.mediaId ? media.find((m) => m.id === prev.mediaId)?.aiAnalysis : undefined);
    prevScene = prevAnalysis?.scene;
  }
  if (idx >= 0 && idx < sorted.length - 1) {
    const next = sorted[idx + 1];
    const nextAnalysis = next.aiAnalysis ?? (next.mediaId ? media.find((m) => m.id === next.mediaId)?.aiAnalysis : undefined);
    nextScene = nextAnalysis?.scene;
  }

  // Resolve aiAnalysis from media if clip doesn't have it directly
  const clipAnalysis = clip.aiAnalysis ?? (clip.mediaId ? media.find((m) => m.id === clip.mediaId)?.aiAnalysis : undefined);

  return {
    clipId: clip.id,
    clipName: clip.name,
    clipType: clip.type,
    aiAnalysis: clipAnalysis,
    prevScene,
    nextScene
  };
}

/**
 * Build media pool payload for scene match. Only includes items with aiAnalysis when library is large.
 */
export function buildSceneMatchMediaPayload(
  media: Array<{ id: string; name: string; type: string; aiAnalysis?: { tags?: string[]; scene?: string; mood?: string; objects?: string[] } }>,
  largeLibraryThreshold = 200
): SceneMatchMediaItem[] {
  const shouldFilter = media.length > largeLibraryThreshold;
  if (shouldFilter) {
    return media
      .filter((m) => m.aiAnalysis)
      .map((m) => ({
        mediaId: m.id,
        name: m.name,
        type: m.type,
        aiAnalysis: m.aiAnalysis
      }));
  }
  return media.map((m) => ({
    mediaId: m.id,
    name: m.name,
    type: m.type,
    aiAnalysis: m.aiAnalysis
      ? m.aiAnalysis
      : { tags: [], scene: m.name, mood: '', objects: [] }
  }));
}

export function buildSceneMatchSystemPrompt(): string {
  return '你是一个专业的视频剪辑素材推荐助手。根据当前选中片段的内容分析（标签、场景、情绪、物体）以及时间线上下文（前后片段的场景），从媒体库中推荐相关素材。\n\n返回格式必须是JSON对象：\n{"similar":[{"mediaId":"素材ID","score":0~1,"reason":"推荐原因"}],"contrast":[{"mediaId":"素材ID","score":0~1,"reason":"推荐原因"}]}\n\nsimilar：场景/情绪相近的素材，适合连续使用保持视觉连贯性。\ncontrast：情绪/明暗/色彩对比的素材，适合剪辑节奏变化和视觉冲击。\n\n要求：\n1. 每组按score降序排列\n2. 每组最多返回3个结果\n3. score为0的不要返回\n4. reason用中文简述推荐理由\n5. 优先推荐与当前片段有明确关联的素材';
}

export function buildSceneMatchUserPrompt(context: SceneMatchClipContext, mediaItems: SceneMatchMediaItem[]): string {
  const parts: string[] = [`当前选中片段：${context.clipName}（类型：${context.clipType}）`];

  if (context.aiAnalysis) {
    const a = context.aiAnalysis;
    const analysisParts: string[] = [];
    if (a.tags && a.tags.length > 0) analysisParts.push(`标签：${a.tags.join(',')}`);
    if (a.scene) analysisParts.push(`场景：${a.scene}`);
    if (a.mood) analysisParts.push(`氛围：${a.mood}`);
    if (a.objects && a.objects.length > 0) analysisParts.push(`物体：${a.objects.join(',')}`);
    if (analysisParts.length > 0) parts.push(`内容分析：${analysisParts.join('；')}`);
  } else {
    parts.push('内容分析：无（将基于文件名推断）');
  }

  if (context.prevScene) parts.push(`前一片段场景：${context.prevScene}`);
  if (context.nextScene) parts.push(`后一片段场景：${context.nextScene}`);

  const mediaInfo = mediaItems.map((m) => {
    const analysis = m.aiAnalysis;
    const mParts = [`id:${m.mediaId}`, `name:${m.name}`, `type:${m.type}`];
    if (analysis) {
      if (analysis.tags && analysis.tags.length > 0) mParts.push(`tags:${analysis.tags.join(',')}`);
      if (analysis.scene) mParts.push(`scene:${analysis.scene}`);
      if (analysis.mood) mParts.push(`mood:${analysis.mood}`);
      if (analysis.objects && analysis.objects.length > 0) mParts.push(`objects:${analysis.objects.join(',')}`);
    }
    return mParts.join(' | ');
  }).join('\n');

  parts.push(`\n媒体库素材：\n${mediaInfo}`);
  parts.push('\n请返回similar和contrast两组推荐结果JSON。');

  return parts.join('\n');
}

export function parseSceneMatchResponse(json: unknown): SceneMatchResponse {
  const empty: SceneMatchResponse = { similar: [], contrast: [] };
  if (!json || typeof json !== 'object') return empty;
  const obj = json as Record<string, unknown>;

  const parseGroup = (arr: unknown): SceneMatchResult[] => {
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(
        (item): item is SceneMatchResult =>
          item !== null &&
          typeof item === 'object' &&
          typeof (item as SceneMatchResult).mediaId === 'string' &&
          typeof (item as SceneMatchResult).score === 'number' &&
          typeof (item as SceneMatchResult).reason === 'string' &&
          (item as SceneMatchResult).score > 0
      )
      .map((item) => ({
        mediaId: item.mediaId.trim(),
        score: Math.min(1, Math.max(0, item.score)),
        reason: item.reason.trim()
      }))
      .sort((a, b) => b.score - a.score);
  };

  return {
    similar: parseGroup(obj.similar).slice(0, SCENE_MATCH_MAX_SIMILAR),
    contrast: parseGroup(obj.contrast).slice(0, SCENE_MATCH_MAX_CONTRAST)
  };
}

/**
 * Build drag parameters for adding a recommended media asset to the timeline.
 */
export function buildSceneMatchDragParams(
  asset: { id: string; name: string; type: string; path: string; duration: number; width: number; height: number }
): SceneMatchDragParams {
  return {
    mediaId: asset.id,
    name: asset.name,
    type: asset.type,
    path: asset.path,
    duration: asset.duration,
    width: asset.width,
    height: asset.height
  };
}

/**
 * Identify media items without aiAnalysis that are not in the result set (for fallback messaging).
 */
export function getUnanalyzedMediaIdsForSceneMatch(
  allMedia: Array<{ id: string; aiAnalysis?: unknown }>,
  resultIds: Set<string>
): string[] {
  return allMedia
    .filter((m) => !m.aiAnalysis && !resultIds.has(m.id))
    .map((m) => m.id);
}

export async function parseSceneMatchResponseSafe(
  json: unknown,
  t: TranslateFn = identityTranslator
): Promise<AiModuleResult<SceneMatchResponse>> {
  try {
    const data = parseSceneMatchResponse(json);
    return { data, error: null };
  } catch {
    return { data: { similar: [], contrast: [] }, error: t('aiModules.error.parseFailed') };
  }
}

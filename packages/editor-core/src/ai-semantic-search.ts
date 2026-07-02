import type { AiModuleResult, TranslateFn } from './ai-module-types';
import { identityTranslator } from './ai-module-types';

export const SEMANTIC_SEARCH_HISTORY_LIMIT = 10;
export const SEMANTIC_SEARCH_LARGE_LIBRARY_THRESHOLD = 200;
export const SEMANTIC_SEARCH_MAX_RESULTS = 20;

export interface SemanticSearchMediaItem {
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

export interface SemanticSearchResult {
  mediaId: string;
  score: number;
  reason: string;
}

export interface SemanticSearchResponse {
  results: SemanticSearchResult[];
}

export interface SemanticSearchHistoryEntry {
  query: string;
  timestamp: number;
  resultCount: number;
}

/**
 * Build the media payload for semantic search.
 * When media count > threshold, only include items that have aiAnalysis.
 * For items without aiAnalysis, use filename as fallback info.
 */
export function buildSemanticSearchMediaPayload(
  media: Array<{ id: string; name: string; type: string; aiAnalysis?: { tags?: string[]; scene?: string; mood?: string; objects?: string[] } }>,
  largeLibraryThreshold = SEMANTIC_SEARCH_LARGE_LIBRARY_THRESHOLD
): SemanticSearchMediaItem[] {
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

export function buildSemanticSearchSystemPrompt(): string {
  return '你是一个专业的视频素材语义搜索助手。用户会给你一个自然语言搜索描述，以及媒体库中素材的AI分析信息（标签、场景、情绪、物体）。请根据搜索描述和素材信息，返回最相关的素材列表。\n\n返回格式必须是JSON对象：{"results":[{"mediaId":"素材ID","score":0~1的相关度分数,"reason":"匹配原因简述"}]}\n\n要求：\n1. 按相关度score降序排列\n2. 最多返回20个结果\n3. score为0的不要返回\n4. reason用中文简述为什么该素材匹配搜索描述';
}

export function buildSemanticSearchUserPrompt(query: string, mediaItems: SemanticSearchMediaItem[]): string {
  const mediaInfo = mediaItems.map((m) => {
    const analysis = m.aiAnalysis;
    const parts = [`id:${m.mediaId}`, `name:${m.name}`, `type:${m.type}`];
    if (analysis) {
      if (analysis.tags && analysis.tags.length > 0) parts.push(`tags:${analysis.tags.join(',')}`);
      if (analysis.scene) parts.push(`scene:${analysis.scene}`);
      if (analysis.mood) parts.push(`mood:${analysis.mood}`);
      if (analysis.objects && analysis.objects.length > 0) parts.push(`objects:${analysis.objects.join(',')}`);
    }
    return parts.join(' | ');
  }).join('\n');
  return `搜索描述：${query}\n\n媒体库素材信息：\n${mediaInfo}\n\n请返回最相关的素材JSON结果。`;
}

export function parseSemanticSearchResponse(json: unknown): SemanticSearchResult[] {
  if (!json || typeof json !== 'object') {
    return [];
  }
  const obj = json as Partial<SemanticSearchResponse>;
  if (!Array.isArray(obj.results)) {
    return [];
  }
  return obj.results
    .filter(
      (item): item is SemanticSearchResult =>
        item !== null &&
        typeof item === 'object' &&
        typeof (item as SemanticSearchResult).mediaId === 'string' &&
        typeof (item as SemanticSearchResult).score === 'number' &&
        typeof (item as SemanticSearchResult).reason === 'string' &&
        (item as SemanticSearchResult).score > 0
    )
    .map((item) => ({
      mediaId: item.mediaId.trim(),
      score: Math.min(1, Math.max(0, item.score)),
      reason: item.reason.trim()
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, SEMANTIC_SEARCH_MAX_RESULTS);
}

/**
 * Identify media items that have no aiAnalysis (for "unanalyzed" grouping).
 */
export function getUnanalyzedMediaIds(
  allMedia: Array<{ id: string; aiAnalysis?: unknown }>,
  resultIds: Set<string>
): string[] {
  return allMedia
    .filter((m) => !m.aiAnalysis && !resultIds.has(m.id))
    .map((m) => m.id);
}

export function appendSemanticSearchHistory(
  history: readonly SemanticSearchHistoryEntry[],
  entry: SemanticSearchHistoryEntry,
  limit = SEMANTIC_SEARCH_HISTORY_LIMIT
): SemanticSearchHistoryEntry[] {
  const sanitized = sanitizeSemanticSearchHistoryEntry(entry);
  if (!sanitized) {
    return sanitizeSemanticSearchHistory(history, limit);
  }
  const deduplicated = sanitizeSemanticSearchHistory(history, Number.POSITIVE_INFINITY)
    .filter((item) => item.query.toLowerCase() !== sanitized.query.toLowerCase());
  return [sanitized, ...deduplicated].slice(0, Math.max(1, Math.floor(limit)));
}

export function sanitizeSemanticSearchHistory(
  input: unknown,
  limit = SEMANTIC_SEARCH_HISTORY_LIMIT
): SemanticSearchHistoryEntry[] {
  const values = Array.isArray(input) ? input : [];
  const entries = values.flatMap((value): SemanticSearchHistoryEntry[] => {
    const entry = sanitizeSemanticSearchHistoryEntry(value);
    return entry ? [entry] : [];
  });
  return entries.slice(0, Math.max(0, Math.floor(limit)));
}

function sanitizeSemanticSearchHistoryEntry(input: unknown): SemanticSearchHistoryEntry | undefined {
  if (!input || typeof input !== 'object') {
    return undefined;
  }
  const value = input as Partial<SemanticSearchHistoryEntry>;
  const query = typeof value.query === 'string' ? value.query.trim() : '';
  const timestamp = typeof value.timestamp === 'number' && Number.isFinite(value.timestamp) ? value.timestamp : Date.now();
  const resultCount = typeof value.resultCount === 'number' && Number.isFinite(value.resultCount) ? Math.max(0, Math.round(value.resultCount)) : 0;
  if (!query) {
    return undefined;
  }
  return { query, timestamp, resultCount };
}

/**
 * Check if any text provider is configured (for graying out the AI search button).
 * The semantic search only needs a text-capable provider, not vision.
 */
export function hasAvailableTextProvider(providers: Array<{ enabled: boolean; apiKey?: string; isBuiltIn: boolean; id: string }>): boolean {
  return providers.some((p) => {
    if (!p.enabled) return false;
    if (p.isBuiltIn && p.id === 'ollama') return true;
    return Boolean(p.apiKey && p.apiKey.trim().length > 0);
  });
}

export async function parseSemanticSearchResponseSafe(
  json: unknown,
  t: TranslateFn = identityTranslator
): Promise<AiModuleResult<SemanticSearchResult[]>> {
  try {
    const data = parseSemanticSearchResponse(json);
    return { data, error: null };
  } catch {
    return { data: [], error: t('aiModules.error.parseFailed') };
  }
}

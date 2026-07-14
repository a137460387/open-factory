import { createId } from './model';
import type { MediaCollection } from './model-types';

export interface AIMediaOrganizeSuggestion {
  name: string;
  mediaIds: string[];
  reason: string;
}

export interface AIMediaOrganizeResponse {
  collections: AIMediaOrganizeSuggestion[];
}

export function buildMediaTagPrompt(
  media: Array<{ id: string; aiAnalysis?: { tags?: string[]; scene?: string } }>,
): string {
  const analyzed = media.filter(
    (m) => m.aiAnalysis && ((m.aiAnalysis.tags && m.aiAnalysis.tags.length > 0) || m.aiAnalysis.scene),
  );
  if (analyzed.length === 0) return '';
  const lines = analyzed.map((m) => {
    const parts = [`ID: ${m.id}`];
    if (m.aiAnalysis!.tags && m.aiAnalysis!.tags.length > 0) parts.push(`tags: ${m.aiAnalysis!.tags.join(',')}`);
    if (m.aiAnalysis!.scene) parts.push(`scene: ${m.aiAnalysis!.scene}`);
    return parts.join(' | ');
  });
  return lines.join('\n');
}

export function parseAIMediaOrganizeResponse(json: unknown): AIMediaOrganizeResponse {
  if (!json || typeof json !== 'object') return { collections: [] };
  const input = json as Record<string, unknown>;
  if (!Array.isArray(input.collections)) return { collections: [] };
  const collections: AIMediaOrganizeSuggestion[] = [];
  for (const item of input.collections) {
    if (!item || typeof item !== 'object') continue;
    const entry = item as Record<string, unknown>;
    if (typeof entry.name !== 'string' || !entry.name.trim()) continue;
    if (!Array.isArray(entry.mediaIds)) continue;
    const mediaIds = (entry.mediaIds as unknown[]).filter(
      (id): id is string => typeof id === 'string' && id.trim().length > 0,
    );
    if (mediaIds.length === 0) continue;
    const reason = typeof entry.reason === 'string' ? entry.reason.trim() : '';
    collections.push({ name: entry.name.trim(), mediaIds, reason });
  }
  return { collections };
}

export function buildMediaCollectionsFromAI(
  suggestions: AIMediaOrganizeSuggestion[],
  existingCollections: MediaCollection[] = [],
): MediaCollection[] {
  const existingMediaIds = new Set(existingCollections.flatMap((c) => c.mediaIds));
  return suggestions
    .map((s) => ({
      id: createId('media-collection'),
      name: s.name,
      mediaIds: s.mediaIds.filter((id) => !existingMediaIds.has(id)),
      source: 'ai' as const,
      createdAt: new Date().toISOString(),
    }))
    .filter((c) => c.mediaIds.length > 0);
}

export function mergeCollectionsWithExisting(
  aiCollections: MediaCollection[],
  existingCollections: MediaCollection[],
): MediaCollection[] {
  const result = [...existingCollections];
  for (const aiCol of aiCollections) {
    const existingByName = result.find((c) => c.name === aiCol.name);
    if (existingByName) {
      const mergedIds = [...new Set([...existingByName.mediaIds, ...aiCol.mediaIds])];
      result[result.indexOf(existingByName)] = { ...existingByName, mediaIds: mergedIds };
    } else {
      result.push(aiCol);
    }
  }
  return result;
}

export function filterAlreadyCategorizedMedia(
  media: Array<{ id: string; aiAnalysis?: { tags?: string[]; scene?: string } }>,
  existingCollections: MediaCollection[],
): Array<{ id: string; aiAnalysis?: { tags?: string[]; scene?: string } }> {
  const categorizedIds = new Set(existingCollections.flatMap((c) => c.mediaIds));
  return media.filter(
    (m) =>
      !categorizedIds.has(m.id) &&
      m.aiAnalysis &&
      ((m.aiAnalysis.tags && m.aiAnalysis.tags.length > 0) || m.aiAnalysis.scene),
  );
}

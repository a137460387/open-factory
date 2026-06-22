import type { MediaAsset } from './model-types';
import { createId } from './model';

export const GROUPING_TIME_WINDOW_MS = 10 * 60 * 1000;
export const GROUPING_COLOR_SIMILARITY_THRESHOLD = 0.72;
export const GROUPING_FILENAME_SEQUENCE_MIN_MATCH = 3;
export const GROUPING_MIN_CLUSTER_SIZE = 2;

export type MediaGroupingReason = 'time-window' | 'filename-sequence' | 'color-similarity';

export interface MediaGroupingSuggestion {
  id: string;
  mediaIds: string[];
  reason: MediaGroupingReason;
  label: string;
  confidence: number;
  createdAt: string;
}

export interface MediaGroupingIgnorePreference {
  reason: MediaGroupingReason;
  ignoreCount: number;
  lastIgnoredAt: string;
}

export interface MediaGroupingSettings {
  enabled: boolean;
  ignorePreferences: MediaGroupingIgnorePreference[];
}

export const DEFAULT_MEDIA_GROUPING_SETTINGS: MediaGroupingSettings = {
  enabled: true,
  ignorePreferences: []
};

export function detectTimeWindowGroups(
  media: Pick<MediaAsset, 'id' | 'importedAt'>[],
  windowMs = GROUPING_TIME_WINDOW_MS
): MediaGroupingSuggestion[] {
  const sorted = [...media]
    .filter((m) => m.importedAt)
    .sort((a, b) => Date.parse(a.importedAt!) - Date.parse(b.importedAt!));

  if (sorted.length < GROUPING_MIN_CLUSTER_SIZE) return [];

  const groups: MediaGroupingSuggestion[] = [];
  let clusterStart = 0;

  for (let i = 1; i <= sorted.length; i++) {
    const currentTime = i < sorted.length ? Date.parse(sorted[i].importedAt!) : Number.MAX_SAFE_INTEGER;
    const clusterTime = Date.parse(sorted[clusterStart].importedAt!);
    if (currentTime - clusterTime > windowMs || i === sorted.length) {
      const cluster = sorted.slice(clusterStart, i);
      if (cluster.length >= GROUPING_MIN_CLUSTER_SIZE) {
        groups.push({
          id: createId('group-time'),
          mediaIds: cluster.map((m) => m.id),
          reason: 'time-window',
          label: `${cluster.length} files imported within ${Math.round((Date.parse(cluster[cluster.length - 1].importedAt!) - clusterTime) / 1000)}s`,
          confidence: Math.min(1, 0.6 + (cluster.length - GROUPING_MIN_CLUSTER_SIZE) * 0.1),
          createdAt: new Date().toISOString()
        });
      }
      clusterStart = i;
    }
  }

  return groups;
}

export function extractFilenameSequencePrefix(name: string): string {
  const match = /^(.*[-_ ])\d+$/.exec(name.replace(/\.[^.]+$/, ''));
  return match?.[1]?.trim().toLocaleLowerCase() ?? '';
}

export function detectFilenameSequenceGroups(
  media: Pick<MediaAsset, 'id' | 'name'>[]
): MediaGroupingSuggestion[] {
  const prefixMap = new Map<string, { id: string; name: string }[]>();
  for (const m of media) {
    const prefix = extractFilenameSequencePrefix(m.name);
    if (!prefix || prefix.length < 2) continue;
    const existing = prefixMap.get(prefix) ?? [];
    existing.push({ id: m.id, name: m.name });
    prefixMap.set(prefix, existing);
  }

  const groups: MediaGroupingSuggestion[] = [];
  for (const [prefix, items] of prefixMap) {
    if (items.length >= GROUPING_FILENAME_SEQUENCE_MIN_MATCH) {
      groups.push({
        id: createId('group-seq'),
        mediaIds: items.map((m) => m.id),
        reason: 'filename-sequence',
        label: `${items.length} files matching "${prefix}*" sequence`,
        confidence: Math.min(1, 0.7 + (items.length - GROUPING_FILENAME_SEQUENCE_MIN_MATCH) * 0.05),
        createdAt: new Date().toISOString()
      });
    }
  }

  return groups;
}

export function detectColorSimilarityGroups(
  media: Pick<MediaAsset, 'id' | 'thumbnail'>[],
  histograms: Record<string, readonly number[] | undefined>,
  threshold = GROUPING_COLOR_SIMILARITY_THRESHOLD
): MediaGroupingSuggestion[] {
  const items = media.filter((m) => {
    const h = histograms[m.id];
    return h && h.length > 0;
  });

  if (items.length < GROUPING_MIN_CLUSTER_SIZE) return [];

  const clusters: number[][] = [];
  const visited = new Set<string>();

  for (let i = 0; i < items.length; i++) {
    if (visited.has(items[i].id)) continue;
    const cluster = [i];
    visited.add(items[i].id);
    for (let j = i + 1; j < items.length; j++) {
      if (visited.has(items[j].id)) continue;
      const similarity = histogramSimilarity(histograms[items[i].id]!, histograms[items[j].id]!);
      if (similarity >= threshold) {
        cluster.push(j);
        visited.add(items[j].id);
      }
    }
    if (cluster.length >= GROUPING_MIN_CLUSTER_SIZE) {
      clusters.push(cluster);
    }
  }

  return clusters.map((indices) => ({
    id: createId('group-color'),
    mediaIds: indices.map((i) => items[i].id),
    reason: 'color-similarity' as MediaGroupingReason,
    label: `${indices.length} visually similar files`,
    confidence: 0.65,
    createdAt: new Date().toISOString()
  }));
}

export function mergeGroupingSuggestions(
  ...suggestions: MediaGroupingSuggestion[][]
): MediaGroupingSuggestion[] {
  const all = suggestions.flat();
  return deduplicateOverlappingGroups(all);
}

export function recordIgnorePreference(
  preferences: MediaGroupingIgnorePreference[],
  reason: MediaGroupingReason,
  now?: string
): MediaGroupingIgnorePreference[] {
  const existing = preferences.find((p) => p.reason === reason);
  if (existing) {
    return preferences.map((p) =>
      p.reason === reason
        ? { ...p, ignoreCount: p.ignoreCount + 1, lastIgnoredAt: now ?? new Date().toISOString() }
        : p
    );
  }
  return [...preferences, { reason, ignoreCount: 1, lastIgnoredAt: now ?? new Date().toISOString() }];
}

export function filterSuggestionsByPreferences(
  suggestions: MediaGroupingSuggestion[],
  preferences: MediaGroupingIgnorePreference[],
  maxIgnoreCount = 3
): MediaGroupingSuggestion[] {
  const suppressed = new Set(
    preferences.filter((p) => p.ignoreCount >= maxIgnoreCount).map((p) => p.reason)
  );
  return suggestions.filter((s) => !suppressed.has(s.reason));
}

export function normalizeMediaGroupingSettings(
  input: Partial<MediaGroupingSettings> | undefined
): MediaGroupingSettings {
  return {
    enabled: input?.enabled !== false,
    ignorePreferences: Array.isArray(input?.ignorePreferences)
      ? input!.ignorePreferences
          .filter((p) => p && typeof p.reason === 'string' && typeof p.ignoreCount === 'number')
          .map((p) => ({
            reason: p.reason as MediaGroupingReason,
            ignoreCount: Math.max(0, Math.round(p.ignoreCount)),
            lastIgnoredAt: typeof p.lastIgnoredAt === 'string' ? p.lastIgnoredAt : new Date().toISOString()
          }))
      : []
  };
}

function histogramSimilarity(a: readonly number[], b: readonly number[]): number {
  const length = Math.max(a.length, b.length);
  if (length === 0) return 0;
  const na = normalizeHisto(a);
  const nb = normalizeHisto(b);
  let sum = 0;
  for (let i = 0; i < length; i++) {
    sum += Math.abs((na[i] ?? 0) - (nb[i] ?? 0));
  }
  return 1 - Math.min(1, sum / 2);
}

function normalizeHisto(values: readonly number[]): number[] {
  const sum = values.reduce((t, v) => t + Math.max(0, v), 0);
  if (sum <= 0) return new Array(values.length).fill(0);
  return values.map((v) => Math.max(0, v) / sum);
}

function deduplicateOverlappingGroups(groups: MediaGroupingSuggestion[]): MediaGroupingSuggestion[] {
  const sorted = [...groups].sort((a, b) => b.confidence - a.confidence || b.mediaIds.length - a.mediaIds.length);
  const usedIds = new Set<string>();
  const result: MediaGroupingSuggestion[] = [];
  for (const group of sorted) {
    const unused = group.mediaIds.filter((id) => !usedIds.has(id));
    if (unused.length >= GROUPING_MIN_CLUSTER_SIZE) {
      result.push({ ...group, mediaIds: unused });
      for (const id of unused) usedIds.add(id);
    }
  }
  return result;
}

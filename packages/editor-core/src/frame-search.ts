export const FRAME_SEARCH_HISTORY_LIMIT = 10;

export type FrameSearchHistoryEntryType = 'timecode' | 'frame' | 'marker' | 'clip';

export interface FrameSearchHistoryEntry {
  type: FrameSearchHistoryEntryType;
  query: string;
  label: string;
  time: number;
  selectedClipIds?: string[];
  createdAt?: string;
}

const FRAME_SEARCH_HISTORY_TYPES = new Set<FrameSearchHistoryEntryType>(['timecode', 'frame', 'marker', 'clip']);

export function appendFrameSearchHistoryEntry(
  history: readonly FrameSearchHistoryEntry[],
  entry: FrameSearchHistoryEntry,
  limit = FRAME_SEARCH_HISTORY_LIMIT,
): FrameSearchHistoryEntry[] {
  const sanitizedEntry = sanitizeFrameSearchHistoryEntry(entry);
  if (!sanitizedEntry) {
    return sanitizeFrameSearchHistory(history, limit);
  }
  const dedupeKey = frameSearchHistoryDedupeKey(sanitizedEntry);
  return [
    sanitizedEntry,
    ...sanitizeFrameSearchHistory(history, Number.POSITIVE_INFINITY).filter(
      (item) => frameSearchHistoryDedupeKey(item) !== dedupeKey,
    ),
  ].slice(0, Math.max(1, Math.floor(limit)));
}

export function sanitizeFrameSearchHistory(
  input: unknown,
  limit = FRAME_SEARCH_HISTORY_LIMIT,
): FrameSearchHistoryEntry[] {
  const values = Array.isArray(input) ? input : [];
  const entries = values.flatMap((value): FrameSearchHistoryEntry[] => {
    const entry = sanitizeFrameSearchHistoryEntry(value);
    return entry ? [entry] : [];
  });
  return entries.slice(0, Math.max(0, Math.floor(limit)));
}

function sanitizeFrameSearchHistoryEntry(input: unknown): FrameSearchHistoryEntry | undefined {
  if (!input || typeof input !== 'object') {
    return undefined;
  }
  const value = input as Partial<FrameSearchHistoryEntry>;
  if (!FRAME_SEARCH_HISTORY_TYPES.has(value.type as FrameSearchHistoryEntryType)) {
    return undefined;
  }
  const query = typeof value.query === 'string' ? value.query.trim() : '';
  const label = typeof value.label === 'string' ? value.label.trim() : '';
  const time = typeof value.time === 'number' && Number.isFinite(value.time) ? Math.max(0, value.time) : Number.NaN;
  if (!query || !label || !Number.isFinite(time)) {
    return undefined;
  }
  const selectedClipIds = Array.isArray(value.selectedClipIds)
    ? Array.from(
        new Set(
          value.selectedClipIds
            .filter((clipId): clipId is string => typeof clipId === 'string' && clipId.trim().length > 0)
            .map((clipId) => clipId.trim()),
        ),
      )
    : undefined;
  const createdAt = typeof value.createdAt === 'string' && value.createdAt.trim() ? value.createdAt.trim() : undefined;
  return {
    type: value.type as FrameSearchHistoryEntryType,
    query,
    label,
    time,
    ...(selectedClipIds && selectedClipIds.length > 0 ? { selectedClipIds } : {}),
    ...(createdAt ? { createdAt } : {}),
  };
}

function frameSearchHistoryDedupeKey(entry: FrameSearchHistoryEntry): string {
  return [
    entry.type,
    entry.query.toLowerCase(),
    entry.label.toLowerCase(),
    entry.time.toFixed(6),
    (entry.selectedClipIds ?? []).join(','),
  ].join('|');
}


export const FAVORITES_MAX_RECENT = 30;
export const FAVORITES_FILE = 'favorites.json';

/** 收藏夹数据 */
export interface MediaFavoritesData {
  favoriteIds: string[];
  recentIds: string[];
  sharedPath?: string;
}

export type FavoritesStorageMode = 'project' | 'shared';

export interface MediaFavoritesOptions {
  mode?: FavoritesStorageMode;
  maxRecent?: number;
}

/**
 * 添加媒体到收藏夹。
 */
export function addFavorite(favorites: string[], mediaId: string): string[] {
  if (favorites.includes(mediaId)) return favorites;
  return [...favorites, mediaId];
}

/**
 * 从收藏夹移除。
 */
export function removeFavorite(favorites: string[], mediaId: string): string[] {
  return favorites.filter((id) => id !== mediaId);
}

/**
 * 切换收藏状态。
 */
export function toggleFavorite(favorites: string[], mediaId: string): string[] {
  return favorites.includes(mediaId) ? removeFavorite(favorites, mediaId) : addFavorite(favorites, mediaId);
}

/**
 * 是否已收藏。
 */
export function isFavorite(favorites: string[], mediaId: string): boolean {
  return favorites.includes(mediaId);
}

/**
 * LRU 追踪：记录媒体加入时间线，保留最近 N 条。
 * 新项移到最前，重复项移到最前，超出时淘汰尾部。
 */
export function trackRecentMedia(recentIds: string[], mediaId: string, maxItems = FAVORITES_MAX_RECENT): string[] {
  const filtered = recentIds.filter((id) => id !== mediaId);
  const result = [mediaId, ...filtered];
  return result.slice(0, Math.max(1, Math.floor(maxItems)));
}

/**
 * 获取最近使用列表。
 */
export function getRecentMediaIds(recentIds: string[], maxItems = FAVORITES_MAX_RECENT): string[] {
  return recentIds.slice(0, Math.max(0, Math.floor(maxItems)));
}

/**
 * 解析搜索框中的 filter: 前缀。
 * 返回 { filter, cleanQuery }。如果没有匹配，filter 为 undefined。
 */
export function parseFavoritesSearchFilter(query: string): { filter?: 'favorites' | 'recent'; cleanQuery: string } {
  const trimmed = query.trim();
  const match = trimmed.match(/^filter:\s*(favorites|recent)\b\s*(.*)/i);
  if (!match) return { cleanQuery: trimmed };
  const filter = match[1].toLowerCase() as 'favorites' | 'recent';
  return { filter, cleanQuery: match[2].trim() };
}

/**
 * 置顶排序：置顶项在前，其余保持原序。
 */
export function sortWithPinned<T extends { id: string }>(items: T[], pinnedIds: Set<string>): T[] {
  const pinned: T[] = [];
  const rest: T[] = [];
  for (const item of items) {
    if (pinnedIds.has(item.id)) pinned.push(item);
    else rest.push(item);
  }
  return [...pinned, ...rest];
}

/**
 * 获取存储路径：共享模式返回 sharedPath，否则返回 undefined。
 */
export function getFavoritesStoragePath(mode: FavoritesStorageMode, sharedPath?: string): string | undefined {
  if (mode === 'shared') return sharedPath ?? undefined;
  return undefined;
}

/**
 * 初始化默认收藏夹数据。
 */
export function createDefaultFavoritesData(): MediaFavoritesData {
  return { favoriteIds: [], recentIds: [] };
}

/**
 * 规范化收藏夹数据（兼容旧项目缺失字段）。
 */
export function normalizeFavoritesData(input: unknown): MediaFavoritesData {
  if (!input || typeof input !== 'object') return createDefaultFavoritesData();
  const data = input as Partial<MediaFavoritesData>;
  return {
    favoriteIds: Array.isArray(data.favoriteIds) ? data.favoriteIds.filter((id): id is string => typeof id === 'string') : [],
    recentIds: Array.isArray(data.recentIds) ? data.recentIds.filter((id): id is string => typeof id === 'string').slice(0, FAVORITES_MAX_RECENT) : [],
    sharedPath: typeof data.sharedPath === 'string' ? data.sharedPath : undefined,
  };
}

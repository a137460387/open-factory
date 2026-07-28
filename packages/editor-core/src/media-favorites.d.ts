export declare const FAVORITES_MAX_RECENT = 30;
export declare const FAVORITES_FILE = "favorites.json";
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
export declare function addFavorite(favorites: string[], mediaId: string): string[];
/**
 * 从收藏夹移除。
 */
export declare function removeFavorite(favorites: string[], mediaId: string): string[];
/**
 * 切换收藏状态。
 */
export declare function toggleFavorite(favorites: string[], mediaId: string): string[];
/**
 * 是否已收藏。
 */
export declare function isFavorite(favorites: string[], mediaId: string): boolean;
/**
 * LRU 追踪：记录媒体加入时间线，保留最近 N 条。
 * 新项移到最前，重复项移到最前，超出时淘汰尾部。
 */
export declare function trackRecentMedia(recentIds: string[], mediaId: string, maxItems?: number): string[];
/**
 * 获取最近使用列表。
 */
export declare function getRecentMediaIds(recentIds: string[], maxItems?: number): string[];
/**
 * 解析搜索框中的 filter: 前缀。
 * 返回 { filter, cleanQuery }。如果没有匹配，filter 为 undefined。
 */
export declare function parseFavoritesSearchFilter(query: string): {
    filter?: 'favorites' | 'recent';
    cleanQuery: string;
};
/**
 * 置顶排序：置顶项在前，其余保持原序。
 */
export declare function sortWithPinned<T extends {
    id: string;
}>(items: T[], pinnedIds: Set<string>): T[];
/**
 * 获取存储路径：共享模式返回 sharedPath，否则返回 undefined。
 */
export declare function getFavoritesStoragePath(mode: FavoritesStorageMode, sharedPath?: string): string | undefined;
/**
 * 初始化默认收藏夹数据。
 */
export declare function createDefaultFavoritesData(): MediaFavoritesData;
/**
 * 规范化收藏夹数据（兼容旧项目缺失字段）。
 */
export declare function normalizeFavoritesData(input: unknown): MediaFavoritesData;
//# sourceMappingURL=media-favorites.d.ts.map
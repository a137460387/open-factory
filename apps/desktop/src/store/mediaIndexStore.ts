import { create } from 'zustand';
import type { MediaSearchQuery, MediaSearchResult, TagWithCount } from '../lib/tauri-bridge';
import { searchMediaAssets, getAllTags } from '../lib/tauri-bridge';

/** 是否有任何活跃的筛选条件 */
export function hasActiveIndexFilters(query: MediaSearchQuery): boolean {
  return !!(
    (query.tags && query.tags.length > 0) ||
    (query.assetTypes && query.assetTypes.length > 0) ||
    query.minWidth !== undefined ||
    query.maxWidth !== undefined ||
    query.minHeight !== undefined ||
    query.maxHeight !== undefined ||
    query.minDurationMs !== undefined ||
    query.maxDurationMs !== undefined ||
    query.minRating !== undefined ||
    query.labelColor ||
    query.flag ||
    (query.text && query.text.trim().length > 0)
  );
}

export interface MediaIndexState {
  // 搜索状态
  searchQuery: MediaSearchQuery;
  searchResults: MediaSearchResult | null;
  isSearching: boolean;
  allTags: TagWithCount[];
  tagsLoading: boolean;

  // 搜索操作
  setSearchQuery: (query: Partial<MediaSearchQuery>) => void;
  executeSearch: () => Promise<void>;
  clearFilters: () => void;

  // 标签操作
  refreshTags: (projectPath: string) => Promise<void>;
  addTagFilter: (tag: string) => void;
  removeTagFilter: (tag: string) => void;

  // 类型过滤
  toggleAssetType: (type: string) => void;

  // 分辨率过滤
  setResolutionRange: (minWidth?: number, maxWidth?: number, minHeight?: number, maxHeight?: number) => void;

  // 时长过滤
  setDurationRange: (minMs?: number, maxMs?: number) => void;

  // 初始化
  setProjectPath: (path: string) => void;
}

const defaultQuery: MediaSearchQuery = {
  projectPath: '',
};

export const useMediaIndexStore = create<MediaIndexState>((set, get) => ({
  searchQuery: { ...defaultQuery },
  searchResults: null,
  isSearching: false,
  allTags: [],
  tagsLoading: false,

  setSearchQuery: (partial) => {
    const current = get().searchQuery;
    const next = { ...current, ...partial };
    set({ searchQuery: next });
    // 无筛选条件时清除结果（使用内存过滤）
    if (!hasActiveIndexFilters(next)) {
      set({ searchResults: null, isSearching: false });
      return;
    }
    // 自动触发搜索
    get().executeSearch();
  },

  executeSearch: async () => {
    const { searchQuery } = get();
    if (!searchQuery.projectPath) return;

    set({ isSearching: true });
    try {
      const results = await searchMediaAssets(searchQuery);
      set({ searchResults: results, isSearching: false });
    } catch (err) {
      console.error('媒体索引搜索失败:', err);
      set({ isSearching: false });
    }
  },

  clearFilters: () => {
    const { projectPath } = get().searchQuery;
    set({
      searchQuery: { projectPath: projectPath || '' },
      searchResults: null,
    });
  },

  refreshTags: async (projectPath: string) => {
    set({ tagsLoading: true });
    try {
      const tags = await getAllTags(projectPath);
      set({ allTags: tags, tagsLoading: false });
    } catch (err) {
      console.error('获取标签失败:', err);
      set({ tagsLoading: false });
    }
  },

  addTagFilter: (tag: string) => {
    const current = get().searchQuery;
    const existing = current.tags || [];
    if (existing.includes(tag)) return;
    get().setSearchQuery({ tags: [...existing, tag] });
  },

  removeTagFilter: (tag: string) => {
    const current = get().searchQuery;
    const existing = current.tags || [];
    get().setSearchQuery({ tags: existing.filter((t) => t !== tag) });
  },

  toggleAssetType: (type: string) => {
    const current = get().searchQuery;
    const existing = current.assetTypes || [];
    if (existing.includes(type)) {
      get().setSearchQuery({ assetTypes: existing.filter((t) => t !== type) });
    } else {
      get().setSearchQuery({ assetTypes: [...existing, type] });
    }
  },

  setResolutionRange: (minWidth, maxWidth, minHeight, maxHeight) => {
    get().setSearchQuery({ minWidth, maxWidth, minHeight, maxHeight });
  },

  setDurationRange: (minMs, maxMs) => {
    get().setSearchQuery({ minDurationMs: minMs, maxDurationMs: maxMs });
  },

  setProjectPath: (path: string) => {
    set({
      searchQuery: { projectPath: path },
      searchResults: null,
      allTags: [],
    });
  },
}));

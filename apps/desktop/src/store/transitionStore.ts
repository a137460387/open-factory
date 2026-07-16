/**
 * 转场面板状态管理 — 独立 Store，不污染 editorStore。
 */

import { create } from 'zustand';
import type { TransitionCategory } from '@open-factory/editor-core';

interface TransitionStoreState {
  /** 面板是否打开 */
  libraryOpen: boolean;
  /** 当前选中的分类筛选 */
  selectedCategory: 'all' | TransitionCategory;
  /** 搜索关键词 */
  searchQuery: string;
  /** 正在预览的转场类型 */
  previewingType: string | null;

  // actions
  setLibraryOpen: (open: boolean) => void;
  setSelectedCategory: (cat: 'all' | TransitionCategory) => void;
  setSearchQuery: (query: string) => void;
  setPreviewingType: (type: string | null) => void;
  toggleLibrary: () => void;
}

export const useTransitionStore = create<TransitionStoreState>((set) => ({
  libraryOpen: false,
  selectedCategory: 'all',
  searchQuery: '',
  previewingType: null,

  setLibraryOpen: (open) => set({ libraryOpen: open }),
  setSelectedCategory: (cat) => set({ selectedCategory: cat }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setPreviewingType: (type) => set({ previewingType: type }),
  toggleLibrary: () => set((s) => ({ libraryOpen: !s.libraryOpen })),
}));

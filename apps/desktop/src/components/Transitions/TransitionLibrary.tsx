/**
 * TransitionLibrary — 转场效果库面板。
 * 可视化浏览所有转场效果，支持搜索、分类筛选、收藏、拖拽到时间线。
 */

import React, { useCallback, useMemo, useState } from 'react';
import { Search, X, Sparkles, Layers, Box, Zap } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTransitionStore } from '../../store/transitionStore';
import { TransitionCard } from './TransitionCard';
import {
  TRANSITION_REGISTRY,
  getTransitionsByCategory,
  searchTransitions,
  type TransitionDefinition,
  type TransitionCategory,
} from '@open-factory/editor-core';
import {
  readTransitionFavorites,
  toggleTransitionFavorite,
} from '../../timeline/transition-favorites';

type CategoryFilter = 'all' | TransitionCategory;

const CATEGORY_OPTIONS: { value: CategoryFilter; label: string; icon: React.ReactNode }[] = [
  { value: 'all', label: '全部', icon: <Layers className="h-3.5 w-3.5" /> },
  { value: 'basic', label: '基础', icon: <Sparkles className="h-3.5 w-3.5" /> },
  { value: 'advanced', label: '进阶', icon: <Zap className="h-3.5 w-3.5" /> },
  { value: '3d', label: '3D', icon: <Box className="h-3.5 w-3.5" /> },
];

interface TransitionLibraryProps {
  /** 面板关闭回调 */
  onClose?: () => void;
  /** 选中转场回调 */
  onSelectTransition?: (type: string) => void;
  /** 转场拖拽到时间线回调 */
  onApplyToTimeline?: (type: string) => void;
}

export function TransitionLibrary({
  onClose,
  onSelectTransition,
  onApplyToTimeline,
}: TransitionLibraryProps) {
  const { selectedCategory, searchQuery, previewingType, setSelectedCategory, setSearchQuery, setPreviewingType } =
    useTransitionStore();

  const [favorites, setFavorites] = useState<string[]>(() =>
    readTransitionFavorites().map(String),
  );

  const toggleFav = useCallback((type: string) => {
    setFavorites((prev) => {
      const next = prev.includes(type) ? prev.filter((t) => t !== type) : [type, ...prev];
      // 同步到 localStorage
      toggleTransitionFavorite(type as any);
      return next;
    });
  }, []);

  const filtered = useMemo(() => {
    let items: TransitionDefinition[];
    if (searchQuery.trim()) {
      items = searchTransitions(searchQuery);
    } else if (selectedCategory === 'all') {
      items = [...TRANSITION_REGISTRY];
    } else {
      items = getTransitionsByCategory(selectedCategory);
    }

    // 收藏置顶
    return items.sort((a, b) => {
      const aFav = favorites.includes(a.type) ? -1 : 0;
      const bFav = favorites.includes(b.type) ? -1 : 0;
      return aFav - bFav;
    });
  }, [selectedCategory, searchQuery, favorites]);

  const handleSelect = useCallback(
    (type: string) => {
      onSelectTransition?.(type);
    },
    [onSelectTransition],
  );

  return (
    <div className="flex flex-col h-full bg-background border-l border-border">
      {/* 头部 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <h3 className="text-sm font-semibold">转场效果库</h3>
        {onClose && (
          <button onClick={onClose} className="p-1 rounded hover:bg-accent transition-colors">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* 搜索栏 */}
      <div className="px-3 py-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="搜索转场..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-7 pr-3 py-1.5 text-xs rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* 分类标签 */}
      <div className="flex gap-1 px-3 py-2 border-b border-border">
        {CATEGORY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setSelectedCategory(opt.value)}
            className={cn(
              'flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors',
              selectedCategory === opt.value
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-accent text-muted-foreground',
            )}
          >
            {opt.icon}
            {opt.label}
          </button>
        ))}
      </div>

      {/* 转场网格 */}
      <div className="flex-1 overflow-y-auto p-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-xs">
            <Search className="h-8 w-8 mb-2 opacity-30" />
            <p>未找到匹配的转场效果</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {filtered.map((def) => (
              <TransitionCard
                key={def.type}
                definition={def}
                isFavorite={favorites.includes(def.type)}
                isHovered={previewingType === def.type}
                onHover={setPreviewingType}
                onToggleFavorite={toggleFav}
                onSelect={handleSelect}
                onDragStart={(type) => onApplyToTimeline?.(type)}
              />
            ))}
          </div>
        )}
      </div>

      {/* 底部统计 */}
      <div className="px-3 py-1.5 border-t border-border text-[10px] text-muted-foreground">
        {filtered.length} / {TRANSITION_REGISTRY.length} 个转场效果
      </div>
    </div>
  );
}

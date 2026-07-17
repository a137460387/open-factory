import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  searchMarketEntries,
  type MarketPluginEntry,
  type MarketSearchOptions,
  type PluginCategory,
} from '@open-factory/editor-core';
import { PluginCard } from './PluginCard';
import type { PluginInstallState } from '../../plugins/plugin-market';

const CATEGORY_OPTIONS: Array<{ value: PluginCategory | 'all'; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'effect', label: '🎨 效果' },
  { value: 'export', label: '📤 导出' },
  { value: 'workflow', label: '⚙️ 工作流' },
  { value: 'ai-model', label: '🤖 AI 模型' },
];

const SORT_OPTIONS: Array<{ value: MarketSearchOptions['sortBy']; label: string }> = [
  { value: 'downloads', label: '最热门' },
  { value: 'rating', label: '评分最高' },
  { value: 'publishedAt', label: '最新发布' },
  { value: 'updatedAt', label: '最近更新' },
  { value: 'name', label: '名称' },
];

export interface PluginMarketPanelProps {
  /** All catalog entries. */
  entries: MarketPluginEntry[];
  /** Install states keyed by plugin ID. */
  installStates?: Record<string, PluginInstallState>;
  /** Loading state. */
  loading?: boolean;
  /** Error message. */
  error?: string;
  /** Called when user clicks install. */
  onInstall?: (entry: MarketPluginEntry) => void;
  /** Called when user clicks update. */
  onUpdate?: (entry: MarketPluginEntry) => void;
  /** Called when user clicks a plugin card for details. */
  onShowDetail?: (entry: MarketPluginEntry) => void;
  /** Called when user requests catalog refresh. */
  onRefresh?: () => void;
}

export function PluginMarketPanel({
  entries,
  installStates,
  loading,
  error,
  onInstall,
  onUpdate,
  onShowDetail,
  onRefresh,
}: PluginMarketPanelProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<PluginCategory | 'all'>('all');
  const [sortBy, setSortBy] = useState<MarketSearchOptions['sortBy']>('downloads');
  const parentRef = useRef<HTMLDivElement>(null);

  const searchOptions = useMemo<MarketSearchOptions>(
    () => ({
      query: query || undefined,
      category,
      sortBy,
      sortDirection: sortBy === 'name' ? 'asc' : 'desc',
    }),
    [query, category, sortBy],
  );

  const result = useMemo(() => searchMarketEntries(entries, searchOptions), [entries, searchOptions]);

  const virtualizer = useVirtualizer({
    count: result.entries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200,
    overscan: 5,
  });

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  }, []);

  const handleCategoryChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setCategory(e.target.value as PluginCategory | 'all');
  }, []);

  const handleSortChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSortBy(e.target.value as MarketSearchOptions['sortBy']);
  }, []);

  // Reset scroll on filter change
  useEffect(() => {
    parentRef.current?.scrollTo({ top: 0 });
  }, [query, category, sortBy]);

  return (
    <div className="flex h-full flex-col gap-3" data-testid="plugin-market-panel">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">插件市场</h2>
        {onRefresh && (
          <button
            className="rounded-md border border-border px-3 py-1 text-xs transition-colors hover:bg-muted"
            onClick={onRefresh}
            disabled={loading}
            data-testid="plugin-market-refresh"
          >
            {loading ? '刷新中…' : '刷新'}
          </button>
        )}
      </div>

      {/* Search and filters */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="搜索插件…"
          value={query}
          onChange={handleSearchChange}
          className="min-w-[200px] flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
          data-testid="plugin-market-search"
        />
        <select
          value={category}
          onChange={handleCategoryChange}
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          data-testid="plugin-market-category"
        >
          {CATEGORY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={handleSortChange}
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          data-testid="plugin-market-sort"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Category chips with counts */}
      {result.categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {result.categories.map(({ category: cat, count }) => (
            <button
              key={cat}
              className={`rounded-full px-2.5 py-0.5 text-xs transition-colors ${
                category === cat
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
              onClick={() => setCategory(category === cat ? 'all' : cat)}
            >
              {CATEGORY_OPTIONS.find((o) => o.value === cat)?.label ?? cat} ({count})
            </button>
          ))}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Results count */}
      <p className="text-xs text-muted-foreground">
        {loading ? '加载中…' : `共 ${result.total} 个插件`}
      </p>

      {/* Plugin grid with virtual scrolling */}
      {result.entries.length === 0 && !loading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          {query || category !== 'all' ? '没有找到匹配的插件' : '暂无可用插件'}
        </div>
      ) : (
        <div ref={parentRef} className="flex-1 overflow-auto" data-testid="plugin-market-scroll">
          <div
            className="relative w-full"
            style={{ height: `${virtualizer.getTotalSize()}px` }}
          >
            <div
              className="grid gap-3"
              style={{
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              }}
            >
              {virtualizer.getVirtualItems().map((virtualItem) => {
                const entry = result.entries[virtualItem.index];
                if (!entry) return null;
                return (
                  <div
                    key={entry.id}
                    data-index={virtualItem.index}
                    ref={virtualizer.measureElement}
                  >
                    <PluginCard
                      entry={entry}
                      installState={installStates?.[entry.id]}
                      onInstall={onInstall}
                      onUpdate={onUpdate}
                      onShowDetail={onShowDetail}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Popular tags */}
      {result.tags.length > 0 && (
        <div className="border-t border-border/40 pt-2">
          <p className="mb-1 text-xs font-medium text-muted-foreground">热门标签</p>
          <div className="flex flex-wrap gap-1">
            {result.tags.slice(0, 10).map(({ tag, count }) => (
              <button
                key={tag}
                className="rounded-full bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted"
                onClick={() => setQuery(tag)}
              >
                {tag} ({count})
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

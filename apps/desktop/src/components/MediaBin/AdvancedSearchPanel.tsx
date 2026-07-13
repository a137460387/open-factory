import { useCallback, useEffect, useRef, useState } from 'react';
import { Filter, Loader2, Tag, X } from 'lucide-react';
import { clsx } from 'clsx';
import { useMediaIndexStore } from '../../store/mediaIndexStore';
import type { TagWithCount } from '../../lib/tauri-bridge';

interface AdvancedSearchPanelProps {
  projectPath: string;
  className?: string;
}

const ASSET_TYPE_OPTIONS = [
  { value: 'video', label: '视频' },
  { value: 'audio', label: '音频' },
  { value: 'image', label: '图片' },
] as const;

const RESOLUTION_PRESETS: { label: string; minWidth?: number; maxWidth?: number }[] = [
  { label: '4K+', minWidth: 3840 },
  { label: '1080p+', minWidth: 1920 },
  { label: '720p+', minWidth: 1280 },
  { label: 'SD', maxWidth: 1279 },
];

const DURATION_PRESETS: { label: string; minMs?: number; maxMs?: number }[] = [
  { label: '短视频 (<10s)', maxMs: 10_000 },
  { label: '中等 (10s-10min)', minMs: 10_000, maxMs: 600_000 },
  { label: '长视频 (>10min)', minMs: 600_000 },
];

export function AdvancedSearchPanel({ projectPath, className }: AdvancedSearchPanelProps) {
  const {
    searchQuery,
    isSearching,
    searchResults,
    allTags,
    tagsLoading,
    setSearchQuery,
    clearFilters,
    refreshTags,
    addTagFilter,
    removeTagFilter,
    toggleAssetType,
    setResolutionRange,
    setDurationRange,
    setProjectPath,
  } = useMediaIndexStore();

  const [expanded, setExpanded] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // 初始化项目路径
  useEffect(() => {
    if (projectPath) {
      setProjectPath(projectPath);
      refreshTags(projectPath);
    }
  }, [projectPath, setProjectPath, refreshTags]);

  // 搜索输入防抖
  const handleTextChange = useCallback(
    (text: string) => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      searchTimeoutRef.current = setTimeout(() => {
        setSearchQuery({ text: text || undefined });
      }, 300);
    },
    [setSearchQuery],
  );

  // 检查是否有活跃的筛选条件
  const hasActiveFilters =
    (searchQuery.tags && searchQuery.tags.length > 0) ||
    (searchQuery.assetTypes && searchQuery.assetTypes.length > 0) ||
    searchQuery.minWidth !== undefined ||
    searchQuery.maxWidth !== undefined ||
    searchQuery.minDurationMs !== undefined ||
    searchQuery.maxDurationMs !== undefined ||
    searchQuery.text !== undefined;

  const activeFilterCount = [
    searchQuery.tags?.length || 0,
    searchQuery.assetTypes?.length || 0,
    searchQuery.minWidth !== undefined || searchQuery.maxWidth !== undefined ? 1 : 0,
    searchQuery.minDurationMs !== undefined || searchQuery.maxDurationMs !== undefined ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  return (
    <div className={clsx('rounded-lg border border-line bg-panel', className)}>
      {/* 搜索栏 */}
      <div className="flex items-center gap-2 px-3 py-2">
        <Filter size={14} className="shrink-0 text-[var(--color-text-muted)]" />
        <input
          type="text"
          className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-[var(--color-text-muted)]"
          placeholder="搜索媒体资产..."
          defaultValue={searchQuery.text || ''}
          onChange={(e) => handleTextChange(e.target.value)}
          data-testid="advanced-search-input"
        />
        {isSearching && <Loader2 size={14} className="animate-spin text-brand" />}
        {searchResults && (
          <span className="shrink-0 text-xs text-[var(--color-text-muted)]">
            {searchResults.total} 个结果
          </span>
        )}
        <button
          type="button"
          className={clsx(
            'shrink-0 rounded-md px-2 py-1 text-xs font-medium',
            expanded
              ? 'bg-brand text-white'
              : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-panel',
          )}
          onClick={() => setExpanded(!expanded)}
          data-testid="advanced-search-toggle"
        >
          高级筛选
          {activeFilterCount > 0 && (
            <span className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/20 text-[10px]">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* 已选条件 Chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-1 border-t border-line px-3 py-2">
          {searchQuery.tags?.map((tag) => (
            <FilterChip
              key={`tag-${tag}`}
              label={tag}
              icon={<Tag size={10} />}
              onRemove={() => removeTagFilter(tag)}
            />
          ))}
          {searchQuery.assetTypes?.map((type) => (
            <FilterChip
              key={`type-${type}`}
              label={ASSET_TYPE_OPTIONS.find((o) => o.value === type)?.label || type}
              onRemove={() => toggleAssetType(type)}
            />
          ))}
          {(searchQuery.minWidth !== undefined || searchQuery.maxWidth !== undefined) && (
            <FilterChip
              label={`${searchQuery.minWidth || 0} - ${searchQuery.maxWidth || '∞'}px`}
              onRemove={() => setResolutionRange()}
            />
          )}
          {(searchQuery.minDurationMs !== undefined || searchQuery.maxDurationMs !== undefined) && (
            <FilterChip
              label={`${formatDuration(searchQuery.minDurationMs)} - ${formatDuration(searchQuery.maxDurationMs)}`}
              onRemove={() => setDurationRange()}
            />
          )}
          <button
            type="button"
            className="text-xs text-red-400 hover:text-red-300"
            onClick={clearFilters}
            data-testid="clear-all-filters"
          >
            清除全部
          </button>
        </div>
      )}

      {/* 高级筛选面板 */}
      {expanded && (
        <div className="space-y-3 border-t border-line px-3 py-3">
          {/* 标签云 */}
          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-[var(--color-text-secondary)]">
              标签
            </label>
            {tagsLoading ? (
              <div className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                <Loader2 size={12} className="animate-spin" /> 加载标签中...
              </div>
            ) : allTags.length > 0 ? (
              <div className="flex flex-wrap gap-1" data-testid="tag-cloud">
                {allTags.map((tag) => (
                  <TagBadge
                    key={tag.id}
                    tag={tag}
                    active={searchQuery.tags?.includes(tag.name) || false}
                    onClick={() => {
                      if (searchQuery.tags?.includes(tag.name)) {
                        removeTagFilter(tag.name);
                      } else {
                        addTagFilter(tag.name);
                      }
                    }}
                  />
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--color-text-muted)]">暂无标签，导入媒体后自动生成</p>
            )}
          </div>

          {/* 文件类型 */}
          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-[var(--color-text-secondary)]">
              文件类型
            </label>
            <div className="flex gap-1" data-testid="asset-type-filter">
              {ASSET_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={clsx(
                    'rounded-md border px-2 py-1 text-xs font-medium',
                    searchQuery.assetTypes?.includes(opt.value)
                      ? 'border-brand bg-brand/10 text-brand'
                      : 'border-line bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-panel',
                  )}
                  onClick={() => toggleAssetType(opt.value)}
                  data-testid={`asset-type-${opt.value}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 分辨率 */}
          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-[var(--color-text-secondary)]">
              分辨率
            </label>
            <div className="flex flex-wrap gap-1" data-testid="resolution-filter">
              {RESOLUTION_PRESETS.map((preset) => {
                const isActive =
                  preset.minWidth !== undefined
                    ? searchQuery.minWidth === preset.minWidth
                    : searchQuery.maxWidth === preset.maxWidth;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    className={clsx(
                      'rounded-md border px-2 py-1 text-xs font-medium',
                      isActive
                        ? 'border-brand bg-brand/10 text-brand'
                        : 'border-line bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-panel',
                    )}
                    onClick={() => {
                      if (isActive) {
                        setResolutionRange();
                      } else {
                        setResolutionRange(preset.minWidth, preset.maxWidth);
                      }
                    }}
                    data-testid={`resolution-${preset.label}`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 时长 */}
          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-[var(--color-text-secondary)]">
              时长范围
            </label>
            <div className="flex flex-wrap gap-1" data-testid="duration-filter">
              {DURATION_PRESETS.map((preset) => {
                const isActive =
                  searchQuery.minDurationMs === preset.minMs &&
                  searchQuery.maxDurationMs === preset.maxMs;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    className={clsx(
                      'rounded-md border px-2 py-1 text-xs font-medium',
                      isActive
                        ? 'border-brand bg-brand/10 text-brand'
                        : 'border-line bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-panel',
                    )}
                    onClick={() => {
                      if (isActive) {
                        setDurationRange();
                      } else {
                        setDurationRange(preset.minMs, preset.maxMs);
                      }
                    }}
                    data-testid={`duration-${preset.label}`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** 筛选条件 Chip */
function FilterChip({
  label,
  icon,
  onRemove,
}: {
  label: string;
  icon?: React.ReactNode;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-medium text-brand">
      {icon}
      {label}
      <button
        type="button"
        className="ml-0.5 rounded-full p-0.5 hover:bg-brand/20"
        onClick={onRemove}
      >
        <X size={10} />
      </button>
    </span>
  );
}

/** 标签徽章 */
function TagBadge({
  tag,
  active,
  onClick,
}: {
  tag: TagWithCount;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors',
        active
          ? 'bg-brand text-white'
          : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-panel',
      )}
      onClick={onClick}
      data-testid={`tag-${tag.name}`}
    >
      <Tag size={10} />
      {tag.name}
      <span
        className={clsx(
          'inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px]',
          active ? 'bg-white/20' : 'bg-[var(--color-bg-secondary)]',
        )}
      >
        {tag.count}
      </span>
    </button>
  );
}

/** 格式化时长显示 */
function formatDuration(ms?: number): string {
  if (ms === undefined) return '∞';
  if (ms < 1000) return `${ms}ms`;
  const secs = ms / 1000;
  if (secs < 60) return `${Math.round(secs)}s`;
  const mins = Math.floor(secs / 60);
  const remainSecs = Math.round(secs % 60);
  if (mins < 60) return `${mins}:${remainSecs.toString().padStart(2, '0')}`;
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return `${hours}:${remainMins.toString().padStart(2, '0')}:${remainSecs.toString().padStart(2, '0')}`;
}

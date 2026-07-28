import {Search, Sparkles} from 'lucide-react';
import {CONTENT_SCENE_TYPES, type ContentSceneType, type MediaAsset, type MediaMetadata, type SmartAlbumId, type MediaMetadataFilter, collectSmartAlbums} from '@open-factory/editor-core';
import {clsx} from 'clsx';
import {zhCN} from '../../i18n/strings';
import {AISemanticSearchPanel} from './AISemanticSearchPanel';
import {AIMediaOrganizePanel} from './AIMediaOrganizePanel';
import {AdvancedSearchPanel} from './AdvancedSearchPanel';
import type {MediaCollection} from '@open-factory/editor-core';
import type {MediaLibraryViewSettings} from '../../media/mediaLibraryView';
import type {MediaBinView, QuickMediaFilter} from './useMediaBinState';
import {MediaLibraryViewToolbar} from './MediaBinViewToolbar';

export function MediaBinFilterBar({
  media,
  mediaMetadata,
  projectPath,
  search,
  onSearchChange,
  filter,
  onFilterChange,
  quickFilter,
  onQuickFilterChange,
  sceneFilter,
  onSceneFilterChange,
  smartAlbumId,
  onSmartAlbumIdChange,
  smartAlbums,
  mediaLibraryView,
  onViewChange,
  aiSearchMode,
  onAiSearchModeChange,
  organizePanelOpen,
  onOrganizePanelOpenChange,
  mediaCollections,
  onUpdateMediaCollections,
  favoriteIds,
  recentMediaIds,
}: {
  media: MediaAsset[];
  mediaMetadata: Record<string, MediaMetadata>;
  projectPath: string;
  search: string;
  onSearchChange(value: string): void;
  filter: MediaBinView;
  onFilterChange(value: MediaBinView): void;
  quickFilter: QuickMediaFilter;
  onQuickFilterChange(value: QuickMediaFilter): void;
  sceneFilter: ContentSceneType | 'all';
  onSceneFilterChange(value: ContentSceneType | 'all'): void;
  smartAlbumId: SmartAlbumId | 'none';
  onSmartAlbumIdChange(value: SmartAlbumId | 'none'): void;
  smartAlbums: ReturnType<typeof collectSmartAlbums>;
  mediaLibraryView: MediaLibraryViewSettings;
  onViewChange(patch: Partial<MediaLibraryViewSettings>): void;
  aiSearchMode: boolean;
  onAiSearchModeChange(value: boolean): void;
  organizePanelOpen: boolean;
  onOrganizePanelOpenChange(value: boolean): void;
  mediaCollections: MediaCollection[];
  onUpdateMediaCollections(collections: MediaCollection[]): void;
  favoriteIds: string[];
  recentMediaIds: string[];
}) {
  const t = zhCN.mediaBin;
  return (
    <div className="mb-3 space-y-1.5">
      <label className="relative block">
        <span className="sr-only">{t.searchPlaceholder}</span>
        <Search className="pointer-events-none absolute left-2 top-2.5 text-[var(--color-text-muted)]" size={15} />
        <input
          className={clsx(
            'w-full rounded-lg border bg-[var(--color-bg-elevated)] py-2 pl-8 pr-14 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]',
            aiSearchMode ? 'border-brand' : 'border-line',
          )}
          value={search}
          placeholder={aiSearchMode ? t.aiSemanticSearch.searchPlaceholder : t.searchPlaceholder}
          data-testid="media-search-input"
          onChange={(event) => onSearchChange(event.target.value)}
        />
        <button
          type="button"
          className={clsx(
            'absolute right-1 top-1 rounded-md px-1.5 py-1 text-xs font-semibold',
            aiSearchMode ? 'bg-brand text-white' : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] hover:bg-panel',
          )}
          onClick={() => onAiSearchModeChange(!aiSearchMode)}
          data-testid="ai-search-toggle"
          title={t.aiSemanticSearch.toggleLabel}
        >
          <Sparkles size={14} />
        </button>
      </label>
      <AdvancedSearchPanel projectPath={projectPath} className="mb-1" />
      {aiSearchMode && (
        <AISemanticSearchPanel
          media={media}
          onSelectMedia={() => { onAiSearchModeChange(false); onSearchChange(''); }}
        />
      )}
      {!aiSearchMode && (
        <>
          <div className="grid grid-cols-3 gap-1" data-testid="media-filter-bar">
            {(['all', 'selected', 'five-star'] as QuickMediaFilter[]).map((item) => (
              <button
                key={item}
                className={clsx(
                  'rounded-md border px-1.5 py-1 text-xs font-semibold',
                  quickFilter === item && (item !== 'all' || filter === 'all')
                    ? 'border-brand bg-[var(--color-bg-elevated)] text-brand'
                    : 'border-line bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-panel',
                )}
                type="button"
                data-testid={`media-filter-${item}`}
                onClick={() => {
                  if (item === 'all') onFilterChange('all');
                  else if (filter === 'tagged' || filter === 'titles' || filter === 'shared') onFilterChange('all');
                  onQuickFilterChange(item);
                  onSmartAlbumIdChange('none');
                }}
              >
                {t.filters[item]}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1" data-testid="media-type-filter-bar">
            {(['video', 'audio', 'image', 'tagged', 'titles', 'shared', 'effects'] as MediaBinView[]).map((item) => (
              <button
                key={item}
                className={clsx(
                  'rounded-md border px-1.5 py-1 text-xs font-semibold',
                  filter === item
                    ? 'border-brand bg-[var(--color-bg-elevated)] text-brand'
                    : 'border-line bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-panel',
                )}
                type="button"
                data-testid={`media-filter-${item}`}
                onClick={() => {
                  onFilterChange(item);
                  if (item === 'tagged' || item === 'titles' || item === 'shared' || item === 'effects') onQuickFilterChange('all');
                  onSmartAlbumIdChange('none');
                }}
              >
                {t.filters[item]}
              </button>
            ))}
          </div>
          <label className="block text-[11px] font-medium text-[var(--color-text-secondary)]">
            {zhCN.contentAnalysis.sceneFilter}
            <select
              className="mt-1 h-8 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 text-xs text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
              value={sceneFilter}
              data-testid="media-scene-filter-select"
              onChange={(event) => onSceneFilterChange(event.target.value as ContentSceneType | 'all')}
            >
              <option value="all">{zhCN.contentAnalysis.sceneFilterAll}</option>
              {CONTENT_SCENE_TYPES.map((sceneType) => (
                <option key={sceneType} value={sceneType}>{zhCN.contentAnalysis.sceneTypeLabels[sceneType]}</option>
              ))}
            </select>
          </label>
          {filter !== 'titles' && filter !== 'shared' && filter !== 'effects' ? (
            <SmartAlbumBar albums={smartAlbums} activeId={smartAlbumId} onSelect={onSmartAlbumIdChange} />
          ) : null}
          {media.length > 20 && !aiSearchMode && (
            <div className="flex items-center gap-2" data-testid="media-organize-section">
              {organizePanelOpen ? null : (
                <button
                  type="button"
                  className="flex w-full items-center justify-center gap-1.5 rounded-md border border-brand/30 bg-brand/5 px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand/10"
                  onClick={() => onOrganizePanelOpenChange(true)}
                  data-testid="media-organize-trigger"
                >
                  <Sparkles size={13} />
                  {zhCN.aiOrganize.button}
                </button>
              )}
              {organizePanelOpen && onUpdateMediaCollections && (
                <AIMediaOrganizePanel
                  media={media}
                  existingCollections={mediaCollections}
                  onCollectionsUpdated={(cols) => onUpdateMediaCollections(cols)}
                  onClose={() => onOrganizePanelOpenChange(false)}
                />
              )}
            </div>
          )}
          {filter !== 'titles' && filter !== 'shared' && filter !== 'effects' ? (
            <MediaLibraryViewToolbar settings={mediaLibraryView} onChange={onViewChange} />
          ) : null}
        </>
      )}
    </div>
  );
}

function SmartAlbumBar({
  albums,
  activeId,
  onSelect,
}: {
  albums: ReturnType<typeof collectSmartAlbums>;
  activeId: SmartAlbumId | 'none';
  onSelect(id: SmartAlbumId | 'none'): void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1" data-testid="smart-album-bar">
      <button
        className={clsx(
          'rounded-md border px-1.5 py-1 text-xs font-semibold',
          activeId === 'none'
            ? 'border-brand bg-[var(--color-bg-elevated)] text-brand'
            : 'border-line bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-panel',
        )}
        type="button"
        data-testid="smart-album-none"
        onClick={() => onSelect('none')}
      >
        {zhCN.mediaBin.smartAlbums.all}
      </button>
      {albums.map((album) => (
        <button
          key={album.id}
          className={clsx(
            'rounded-md border px-1.5 py-1 text-xs font-semibold',
            activeId === album.id
              ? 'border-brand bg-[var(--color-bg-elevated)] text-brand'
              : 'border-line bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-panel',
          )}
          type="button"
          data-testid={`smart-album-${album.id}`}
          onClick={() => onSelect(album.id)}
        >
          {zhCN.mediaBin.smartAlbums[album.id]} ({album.assetIds.length})
        </button>
      ))}
    </div>
  );
}

import {
  MAX_MEDIA_FOLDER_DEPTH,
  TITLE_TEMPLATE_IDS,
  collectSmartAlbums,
  filterMediaAssets,
  getMediaFolderDepth,
  shouldGenerateProxy,
  type MediaAsset,
  type MediaFlag,
  type MediaFolder,
  type MediaLabelColor,
  type MediaMetadata,
  type MediaMetadataFilter,
  type SmartAlbumId,
  type TitleTemplateId
} from '@open-factory/editor-core';
import { AlertCircle, BadgeCheck, ChevronDown, ChevronRight, FileAudio2, FileImage, FileText, FileVideo2, Flag, Folder, FolderPlus, Gauge, Import, Info, Link2, Loader2, Merge, Plus, Search, SlidersHorizontal, Star, Tag, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { clsx } from 'clsx';
import { zhCN } from '../../i18n/strings';
import { isTauriRuntime } from '../../lib/tauri';
import { TITLE_TEMPLATE_DRAG_MIME } from '../../lib/titleTemplates';
import { analyzeMedia, listenDragDrop, type MediaAnalysis } from '../../lib/tauri-bridge';
import { useMediaJobStore } from '../../media/media-job-store';
import { useProxySettingsStore } from '../../store/proxySettingsStore';

interface MediaBinProps {
  media: MediaAsset[];
  mediaFolders: MediaFolder[];
  mediaMetadata: Record<string, MediaMetadata>;
  onImport(): void;
  onImportPaths(paths: string[]): void;
  onBatchTranscode(paths: string[]): void;
  onScanDuplicates(): void;
  onAddToTimeline(assetId: string): void;
  onAddAdjustmentLayer(): void;
  onRelink(assetId: string): void;
  onRelinkAll(): void;
  onGenerateProxy(assetId: string): void;
  onConvertToCfr(assetId: string): void;
  onSetLabel(assetId: string, labelColor?: MediaLabelColor): void;
  onSetRating(assetId: string, rating: number): void;
  onSetFlag(assetId: string, flag?: MediaFlag): void;
  onAddTitleTemplate(templateId: TitleTemplateId): void;
  onCreateFolder(parentId?: string | null): void;
  onRenameFolder(folderId: string, name: string): void;
  onDeleteFolder(folderId: string): void;
  onSetFolderCollapsed(folderId: string, collapsed: boolean): void;
  onMoveMediaToFolder(assetIds: string[], folderId?: string | null): void;
}

type MediaBinView = 'all' | 'video' | 'audio' | 'image' | 'tagged' | 'titles';
type QuickMediaFilter = Extract<MediaMetadataFilter, 'all' | 'selected' | 'five-star'>;
const MEDIA_CARD_DRAG_MIME = 'application/x-open-factory-media-id';
type MediaInfoState = { asset: MediaAsset; loading: boolean; analysis?: MediaAnalysis; error?: string };

export function MediaBin({
  media,
  mediaFolders,
  mediaMetadata,
  onImport,
  onImportPaths,
  onBatchTranscode,
  onScanDuplicates,
  onAddToTimeline,
  onAddAdjustmentLayer,
  onRelink,
  onRelinkAll,
  onGenerateProxy,
  onConvertToCfr,
  onSetLabel,
  onSetRating,
  onSetFlag,
  onAddTitleTemplate,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onSetFolderCollapsed,
  onMoveMediaToFolder
}: MediaBinProps) {
  const t = zhCN.mediaBin;
  const [dragOver, setDragOver] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<MediaBinView>('all');
  const [quickFilter, setQuickFilter] = useState<QuickMediaFilter>('all');
  const [smartAlbumId, setSmartAlbumId] = useState<SmartAlbumId | 'none'>('none');
  const [mediaInfo, setMediaInfo] = useState<MediaInfoState>();
  const missingCount = media.filter((asset) => asset.missing).length;
  const smartAlbums = collectSmartAlbums(media, Date.now(), mediaMetadata);
  const smartAlbumIds = smartAlbumId === 'none' ? undefined : new Set(smartAlbums.find((album) => album.id === smartAlbumId)?.assetIds ?? []);
  const metadataFilter: MediaMetadataFilter = filter === 'tagged' ? 'tagged' : quickFilter;
  const visibleMedia =
    filter === 'titles'
      ? []
      : filterMediaAssets(media, {
          query: search,
          filter: filter === 'tagged' ? 'all' : filter,
          metadataFilter,
          metadata: mediaMetadata
        }).filter((asset) => !smartAlbumIds || smartAlbumIds.has(asset.id));
  const jobs = useMediaJobStore((state) => state.jobs);
  const runnerActive = useMediaJobStore((state) => state.runnerActive);
  const clearFinishedJobs = useMediaJobStore((state) => state.clearFinishedJobs);
  const runningJob = jobs.find((job) => job.status === 'running');
  const pendingCount = jobs.filter((job) => job.status === 'pending').length;
  const failedCount = jobs.filter((job) => job.status === 'error').length;

  const openMediaInfo = async (asset: MediaAsset) => {
    setMediaInfo({ asset, loading: true });
    try {
      const analysis = await analyzeMedia(asset.path);
      setMediaInfo({ asset, loading: false, analysis });
    } catch (error) {
      setMediaInfo({
        asset,
        loading: false,
        error: error instanceof Error ? error.message : t.mediaInfo.failedMessage
      });
    }
  };

  useEffect(() => {
    if (!isTauriRuntime()) {
      return undefined;
    }
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void listenDragDrop((payload) => {
        setDragOver(payload.type === 'over');
        if (payload.type === 'drop' && payload.paths?.length) {
          onImportPaths(payload.paths);
        }
      }).then((dispose) => {
        if (disposed) {
          dispose();
        } else {
          unlisten = dispose;
        }
      });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [onImportPaths]);

  return (
    <aside
      className={clsx('flex h-full min-h-0 flex-col bg-white', dragOver && 'ring-2 ring-inset ring-brand')}
      onDragOver={(event) => {
        event.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragOver(false);
        const paths = Array.from(event.dataTransfer.files)
          .map((file) => (file as File & { path?: string }).path)
          .filter((path): path is string => Boolean(path));
        if (paths.length > 0) {
          onImportPaths(paths);
        }
      }}
    >
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <div>
          <div className="text-sm font-semibold">{t.title}</div>
          <div className="text-xs text-slate-500">{t.itemCount(media.length)}</div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {missingCount > 0 ? (
            <button
              className="inline-flex h-9 items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-2 text-xs font-medium text-amber-900 hover:bg-amber-100"
              onClick={onRelinkAll}
              data-testid="relink-all-button"
            >
              <Link2 size={14} />
              {t.relinkFolder}
            </button>
          ) : null}
          <button
            className="inline-flex items-center gap-2 rounded-md border border-line bg-panel px-2 py-2 text-sm font-medium text-slate-700 hover:bg-white"
            onClick={onScanDuplicates}
            data-testid="scan-duplicate-media-button"
          >
            <Merge size={15} />
            {t.scanDuplicates}
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-md border border-line bg-panel px-2 py-2 text-sm font-medium text-slate-700 hover:bg-white"
            onClick={onAddAdjustmentLayer}
            data-testid="new-adjustment-layer-button"
          >
            <SlidersHorizontal size={15} />
            {t.newAdjustmentLayer}
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-md border border-line bg-panel px-2 py-2 text-sm font-medium text-slate-700 hover:bg-white"
            onClick={() => onCreateFolder(null)}
            data-testid="media-folder-create-button"
          >
            <FolderPlus size={15} />
            {t.newFolder}
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-[#176858]"
            onClick={onImport}
            data-testid="import-media-button"
          >
            <Import size={16} />
            {t.import}
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="mb-3 space-y-2">
          <label className="relative block">
            <span className="sr-only">{t.searchPlaceholder}</span>
            <Search className="pointer-events-none absolute left-2 top-2.5 text-slate-400" size={15} />
            <input
              className="w-full rounded-md border border-line bg-white py-2 pl-8 pr-2 text-sm text-ink"
              value={search}
              placeholder={t.searchPlaceholder}
              data-testid="media-search-input"
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <div className="grid grid-cols-3 gap-1" data-testid="media-filter-bar">
            {(['all', 'selected', 'five-star'] as QuickMediaFilter[]).map((item) => (
              <button
                key={item}
                className={clsx(
                  'rounded-md border px-1.5 py-1 text-xs font-semibold',
                  quickFilter === item && (item !== 'all' || filter === 'all') ? 'border-brand bg-white text-brand' : 'border-line bg-white text-slate-600 hover:bg-panel'
                )}
                type="button"
                data-testid={`media-filter-${item}`}
                onClick={() => {
                  if (item === 'all') {
                    setFilter('all');
                  } else if (filter === 'tagged' || filter === 'titles') {
                    setFilter('all');
                  }
                  setQuickFilter(item);
                  setSmartAlbumId('none');
                }}
              >
                {t.filters[item]}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-5 gap-1" data-testid="media-type-filter-bar">
            {(['video', 'audio', 'image', 'tagged', 'titles'] as MediaBinView[]).map((item) => (
              <button
                key={item}
                className={clsx(
                  'rounded-md border px-1.5 py-1 text-xs font-semibold',
                  filter === item ? 'border-brand bg-white text-brand' : 'border-line bg-white text-slate-600 hover:bg-panel'
                )}
                type="button"
                data-testid={`media-filter-${item}`}
                onClick={() => {
                  setFilter(item);
                  if (item === 'tagged' || item === 'titles') {
                    setQuickFilter('all');
                  }
                  setSmartAlbumId('none');
                }}
              >
                {t.filters[item]}
              </button>
            ))}
          </div>
          {filter !== 'titles' ? (
            <SmartAlbumBar albums={smartAlbums} activeId={smartAlbumId} onSelect={setSmartAlbumId} />
          ) : null}
        </div>
        {filter !== 'titles' && jobs.length > 0 ? (
          <div className="mb-3 rounded-md border border-line bg-panel p-2 text-xs" data-testid="media-job-queue">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="font-semibold text-slate-700">{t.mediaJobs}</div>
                <div className="truncate text-slate-500">
                  {runningJob ? `${t.jobType[runningJob.type]} · ${runningJob.assetName}` : runnerActive ? t.preparingQueue : zhCN.common.idle} · {t.pendingCount(pendingCount)}
                  {failedCount > 0 ? ` · ${t.failedCount(failedCount)}` : ''}
                </div>
              </div>
              <button className="rounded-md border border-line bg-white px-2 py-1 text-[11px] font-medium hover:bg-white/80" onClick={clearFinishedJobs}>
                {zhCN.common.clear}
              </button>
            </div>
          </div>
        ) : null}
        {filter === 'titles' ? (
          <TitleTemplateGrid onAddTitleTemplate={onAddTitleTemplate} />
        ) : media.length === 0 ? (
          <button
            className="flex h-full min-h-[220px] w-full flex-col items-center justify-center rounded-md border border-dashed border-slate-300 bg-panel p-6 text-center text-sm text-slate-600"
            onClick={onImport}
          >
            <Import className="mb-3 text-slate-500" size={30} />
            {t.emptyDrop}
          </button>
        ) : smartAlbumId !== 'none' ? (
          <MediaCardGrid
            media={visibleMedia}
            mediaMetadata={mediaMetadata}
            onAddToTimeline={onAddToTimeline}
            onRelink={onRelink}
            onGenerateProxy={onGenerateProxy}
            onConvertToCfr={onConvertToCfr}
            onSetLabel={onSetLabel}
            onSetRating={onSetRating}
            onSetFlag={onSetFlag}
            onBatchTranscode={onBatchTranscode}
            onShowInfo={(asset) => void openMediaInfo(asset)}
          />
        ) : (
          <div className="space-y-3">
            <MediaFolderTree
              folders={mediaFolders}
              media={visibleMedia}
              mediaMetadata={mediaMetadata}
              onCreateFolder={onCreateFolder}
              onRenameFolder={onRenameFolder}
              onDeleteFolder={onDeleteFolder}
              onSetFolderCollapsed={onSetFolderCollapsed}
              onMoveMediaToFolder={onMoveMediaToFolder}
              onAddToTimeline={onAddToTimeline}
              onRelink={onRelink}
              onGenerateProxy={onGenerateProxy}
              onConvertToCfr={onConvertToCfr}
              onSetLabel={onSetLabel}
              onSetRating={onSetRating}
              onSetFlag={onSetFlag}
              onBatchTranscode={onBatchTranscode}
              onShowInfo={(asset) => void openMediaInfo(asset)}
            />
            <RootMediaDropZone onMoveMediaToFolder={onMoveMediaToFolder} />
            <MediaCardGrid
              media={visibleMedia.filter((asset) => !asset.folderId)}
              mediaMetadata={mediaMetadata}
              onAddToTimeline={onAddToTimeline}
              onRelink={onRelink}
              onGenerateProxy={onGenerateProxy}
              onConvertToCfr={onConvertToCfr}
              onSetLabel={onSetLabel}
              onSetRating={onSetRating}
              onSetFlag={onSetFlag}
              onBatchTranscode={onBatchTranscode}
              onShowInfo={(asset) => void openMediaInfo(asset)}
            />
          </div>
        )}
      </div>
      {mediaInfo ? <MediaInfoDialog state={mediaInfo} onClose={() => setMediaInfo(undefined)} /> : null}
    </aside>
  );
}

function SmartAlbumBar({ albums, activeId, onSelect }: { albums: ReturnType<typeof collectSmartAlbums>; activeId: SmartAlbumId | 'none'; onSelect(id: SmartAlbumId | 'none'): void }) {
  return (
    <div className="grid grid-cols-2 gap-1" data-testid="smart-album-bar">
      <button
        className={clsx('rounded-md border px-1.5 py-1 text-xs font-semibold', activeId === 'none' ? 'border-brand bg-white text-brand' : 'border-line bg-white text-slate-600 hover:bg-panel')}
        type="button"
        data-testid="smart-album-none"
        onClick={() => onSelect('none')}
      >
        {zhCN.mediaBin.smartAlbums.all}
      </button>
      {albums.map((album) => (
        <button
          key={album.id}
          className={clsx('rounded-md border px-1.5 py-1 text-xs font-semibold', activeId === album.id ? 'border-brand bg-white text-brand' : 'border-line bg-white text-slate-600 hover:bg-panel')}
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

function MediaFolderTree(props: {
  folders: MediaFolder[];
  media: MediaAsset[];
  mediaMetadata: Record<string, MediaMetadata>;
  onCreateFolder(parentId?: string | null): void;
  onRenameFolder(folderId: string, name: string): void;
  onDeleteFolder(folderId: string): void;
  onSetFolderCollapsed(folderId: string, collapsed: boolean): void;
  onMoveMediaToFolder(assetIds: string[], folderId?: string | null): void;
  onAddToTimeline(assetId: string): void;
  onRelink(assetId: string): void;
  onGenerateProxy(assetId: string): void;
  onConvertToCfr(assetId: string): void;
  onSetLabel(assetId: string, labelColor?: MediaLabelColor): void;
  onSetRating(assetId: string, rating: number): void;
  onSetFlag(assetId: string, flag?: MediaFlag): void;
  onBatchTranscode(paths: string[]): void;
  onShowInfo(asset: MediaAsset): void;
}) {
  const roots = props.folders.filter((folder) => !folder.parentId);
  if (roots.length === 0) {
    return null;
  }
  return (
    <div className="space-y-2" data-testid="media-folder-tree">
      {roots.map((folder) => (
        <MediaFolderNode key={folder.id} folder={folder} depth={1} {...props} />
      ))}
    </div>
  );
}

function MediaFolderNode({
  folder,
  depth,
  folders,
  media,
  mediaMetadata,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onSetFolderCollapsed,
  onMoveMediaToFolder,
  onAddToTimeline,
  onRelink,
  onGenerateProxy,
  onConvertToCfr,
  onSetLabel,
  onSetRating,
  onSetFlag,
  onBatchTranscode,
  onShowInfo
}: {
  folder: MediaFolder;
  depth: number;
  folders: MediaFolder[];
  media: MediaAsset[];
  mediaMetadata: Record<string, MediaMetadata>;
  onCreateFolder(parentId?: string | null): void;
  onRenameFolder(folderId: string, name: string): void;
  onDeleteFolder(folderId: string): void;
  onSetFolderCollapsed(folderId: string, collapsed: boolean): void;
  onMoveMediaToFolder(assetIds: string[], folderId?: string | null): void;
  onAddToTimeline(assetId: string): void;
  onRelink(assetId: string): void;
  onGenerateProxy(assetId: string): void;
  onConvertToCfr(assetId: string): void;
  onSetLabel(assetId: string, labelColor?: MediaLabelColor): void;
  onSetRating(assetId: string, rating: number): void;
  onSetFlag(assetId: string, flag?: MediaFlag): void;
  onBatchTranscode(paths: string[]): void;
  onShowInfo(asset: MediaAsset): void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(folder.name);
  const children = folders.filter((item) => item.parentId === folder.id);
  const folderMedia = media.filter((asset) => asset.folderId === folder.id);
  const canNest = getMediaFolderDepth(folders, folder.id) < MAX_MEDIA_FOLDER_DEPTH;
  const commitRename = () => {
    setEditing(false);
    if (draftName.trim() && draftName.trim() !== folder.name) {
      onRenameFolder(folder.id, draftName);
    } else {
      setDraftName(folder.name);
    }
  };
  return (
    <div className="space-y-2" style={{ marginLeft: `${(depth - 1) * 12}px` }}>
      <div
        className="flex min-h-10 items-center gap-2 rounded-md border border-line bg-panel px-2 text-xs"
        data-testid={`media-folder-${folder.id}`}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const assetId = event.dataTransfer.getData(MEDIA_CARD_DRAG_MIME);
          if (assetId) {
            onMoveMediaToFolder([assetId], folder.id);
          }
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          onDeleteFolder(folder.id);
        }}
      >
        <button className="rounded p-1 hover:bg-white" type="button" data-testid={`media-folder-toggle-${folder.id}`} onClick={() => onSetFolderCollapsed(folder.id, !folder.collapsed)}>
          {folder.collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>
        <Folder size={15} className="text-brand" />
        {editing ? (
          <input
            className="min-w-0 flex-1 rounded border border-line px-1 py-0.5 text-xs"
            value={draftName}
            autoFocus
            data-testid={`media-folder-name-input-${folder.id}`}
            onChange={(event) => setDraftName(event.target.value)}
            onBlur={commitRename}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                commitRename();
              }
              if (event.key === 'Escape') {
                setDraftName(folder.name);
                setEditing(false);
              }
            }}
          />
        ) : (
          <button className="min-w-0 flex-1 truncate text-left font-semibold text-slate-700" type="button" data-testid={`media-folder-name-${folder.id}`} onDoubleClick={() => setEditing(true)}>
            {folder.name}
          </button>
        )}
        <span className="text-slate-500">{folderMedia.length}</span>
        <button className="rounded p-1 hover:bg-white disabled:opacity-40" type="button" title={zhCN.mediaBin.newSubfolder} data-testid={`media-folder-add-child-${folder.id}`} disabled={!canNest} onClick={() => onCreateFolder(folder.id)}>
          <FolderPlus size={13} />
        </button>
        <button className="rounded p-1 text-rose-600 hover:bg-white" type="button" title={zhCN.common.delete} data-testid={`media-folder-delete-${folder.id}`} onClick={() => onDeleteFolder(folder.id)}>
          <Trash2 size={13} />
        </button>
      </div>
      {!folder.collapsed ? (
        <div className="space-y-2">
          {children.map((child) => (
            <MediaFolderNode
              key={child.id}
              folder={child}
              depth={depth + 1}
              folders={folders}
              media={media}
              mediaMetadata={mediaMetadata}
              onCreateFolder={onCreateFolder}
              onRenameFolder={onRenameFolder}
              onDeleteFolder={onDeleteFolder}
              onSetFolderCollapsed={onSetFolderCollapsed}
              onMoveMediaToFolder={onMoveMediaToFolder}
              onAddToTimeline={onAddToTimeline}
              onRelink={onRelink}
              onGenerateProxy={onGenerateProxy}
              onConvertToCfr={onConvertToCfr}
              onSetLabel={onSetLabel}
              onSetRating={onSetRating}
              onSetFlag={onSetFlag}
              onBatchTranscode={onBatchTranscode}
              onShowInfo={onShowInfo}
            />
          ))}
          <MediaCardGrid
            media={folderMedia}
            mediaMetadata={mediaMetadata}
            onAddToTimeline={onAddToTimeline}
            onRelink={onRelink}
            onGenerateProxy={onGenerateProxy}
            onConvertToCfr={onConvertToCfr}
            onSetLabel={onSetLabel}
            onSetRating={onSetRating}
            onSetFlag={onSetFlag}
            onBatchTranscode={onBatchTranscode}
            onShowInfo={onShowInfo}
          />
        </div>
      ) : null}
    </div>
  );
}

function RootMediaDropZone({ onMoveMediaToFolder }: { onMoveMediaToFolder(assetIds: string[], folderId?: string | null): void }) {
  return (
    <div
      className="rounded-md border border-dashed border-line bg-white px-2 py-1.5 text-xs font-medium text-slate-500"
      data-testid="media-folder-root-dropzone"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const assetId = event.dataTransfer.getData(MEDIA_CARD_DRAG_MIME);
        if (assetId) {
          onMoveMediaToFolder([assetId], null);
        }
      }}
    >
      {zhCN.mediaBin.rootFolder}
    </div>
  );
}

function MediaCardGrid({
  media,
  mediaMetadata,
  onAddToTimeline,
  onRelink,
  onGenerateProxy,
  onConvertToCfr,
  onSetLabel,
  onSetRating,
  onSetFlag,
  onBatchTranscode,
  onShowInfo
}: {
  media: MediaAsset[];
  mediaMetadata: Record<string, MediaMetadata>;
  onAddToTimeline(assetId: string): void;
  onRelink(assetId: string): void;
  onGenerateProxy(assetId: string): void;
  onConvertToCfr(assetId: string): void;
  onSetLabel(assetId: string, labelColor?: MediaLabelColor): void;
  onSetRating(assetId: string, rating: number): void;
  onSetFlag(assetId: string, flag?: MediaFlag): void;
  onBatchTranscode(paths: string[]): void;
  onShowInfo(asset: MediaAsset): void;
}) {
  if (media.length === 0) {
    return null;
  }
  return (
    <div className="grid grid-cols-1 gap-3">
      {media.map((asset) => (
        <MediaCard
          key={asset.id}
          asset={asset}
          metadata={mediaMetadata[asset.id]}
          onAdd={() => onAddToTimeline(asset.id)}
          onRelink={() => onRelink(asset.id)}
          onGenerateProxy={() => onGenerateProxy(asset.id)}
          onConvertToCfr={() => onConvertToCfr(asset.id)}
          onSetLabel={(labelColor) => onSetLabel(asset.id, labelColor)}
          onSetRating={(rating) => onSetRating(asset.id, rating)}
          onSetFlag={(flag) => onSetFlag(asset.id, flag)}
          onBatchTranscode={() => onBatchTranscode([asset.path])}
          onShowInfo={() => onShowInfo(asset)}
        />
      ))}
    </div>
  );
}

function TitleTemplateGrid({ onAddTitleTemplate }: { onAddTitleTemplate(templateId: TitleTemplateId): void }) {
  return (
    <div className="grid grid-cols-1 gap-3" data-testid="title-template-grid">
      <div className="rounded-md border border-line bg-panel px-3 py-2 text-xs font-medium text-slate-600">
        {zhCN.mediaBin.titleTemplateCount(TITLE_TEMPLATE_IDS.length)}
      </div>
      {TITLE_TEMPLATE_IDS.map((templateId) => {
        const label = zhCN.titleTemplates[templateId];
        return (
          <div
            key={templateId}
            className="rounded-md border border-line bg-white p-3 shadow-sm"
            draggable
            data-testid={`title-template-card-${templateId}`}
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = 'copy';
              event.dataTransfer.setData(TITLE_TEMPLATE_DRAG_MIME, templateId);
            }}
          >
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line bg-panel text-brand">
                <FileText size={17} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-ink">{label.name}</div>
                <div className="truncate text-xs text-slate-500">{label.defaultText}</div>
              </div>
            </div>
            <button
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md border border-line bg-panel px-2 py-1.5 text-sm font-medium hover:bg-white"
              type="button"
              data-testid={`add-title-template-${templateId}`}
              onClick={() => onAddTitleTemplate(templateId)}
            >
              <Plus size={15} />
              {zhCN.mediaBin.addTitleTemplate}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function MediaInfoDialog({ state, onClose }: { state: MediaInfoState; onClose(): void }) {
  const t = zhCN.mediaBin.mediaInfo;
  const analysis = state.analysis;
  const firstVideo = analysis?.videoStreams[0];
  const firstAudio = analysis?.audioStreams[0];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-testid="media-info-dialog">
      <div className="flex max-h-[86vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-ink">{t.title}</h2>
            <div className="truncate text-xs text-slate-500">{state.asset.name}</div>
          </div>
          <button className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-panel" type="button" title={zhCN.common.close} aria-label={zhCN.common.close} data-testid="media-info-close-button" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {state.loading ? <div className="rounded-md border border-line bg-panel p-3 text-sm text-slate-600">{t.loading}</div> : null}
          {state.error ? <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{state.error}</div> : null}
          {analysis ? (
            <div className="space-y-4">
              <InfoSection title={t.basic}>
                <InfoRow label={t.format} value={analysis.format.formatLongName ?? analysis.format.formatName ?? zhCN.common.unavailable} testId="media-info-format" />
                <InfoRow label={t.duration} value={formatDuration(analysis.format.duration ?? state.asset.duration)} />
                <InfoRow label={t.fileSize} value={formatBytes(analysis.fileSize ?? analysis.format.size)} />
                <InfoRow label={t.createdTime} value={formatDateTime(analysis.createdTimeMs)} />
                <InfoRow label={t.bitRate} value={formatBitRate(analysis.format.bitRate)} />
              </InfoSection>
              <InfoSection title={t.video}>
                {firstVideo ? (
                  <>
                    <InfoRow label={t.codec} value={firstVideo.codecLongName ?? firstVideo.codecName ?? zhCN.common.unavailable} testId="media-info-codec" />
                    <InfoRow label={t.resolution} value={firstVideo.width && firstVideo.height ? `${firstVideo.width} x ${firstVideo.height}` : zhCN.common.unavailable} testId="media-info-resolution" />
                    <InfoRow label={t.frameRate} value={firstVideo.frameRate ? `${firstVideo.frameRate.toFixed(2)} fps` : zhCN.common.unavailable} />
                    <InfoRow label={t.bitRate} value={formatBitRate(firstVideo.bitRate)} />
                    <InfoRow label={t.colorSpace} value={[firstVideo.colorPrimaries, firstVideo.colorTransfer, firstVideo.colorSpace].filter(Boolean).join(' / ') || zhCN.common.unavailable} />
                    <InfoRow label={t.pixelFormat} value={firstVideo.pixelFormat ?? zhCN.common.unavailable} />
                    <InfoRow label={t.hdrMetadata} value={firstVideo.hdrMetadata.length > 0 ? firstVideo.hdrMetadata.join(', ') : zhCN.common.none} />
                  </>
                ) : (
                  <div className="text-sm text-slate-500">{t.noVideo}</div>
                )}
              </InfoSection>
              <InfoSection title={t.audio}>
                {firstAudio ? (
                  <>
                    <InfoRow label={t.codec} value={firstAudio.codecLongName ?? firstAudio.codecName ?? zhCN.common.unavailable} />
                    <InfoRow label={t.sampleRate} value={firstAudio.sampleRate ? `${firstAudio.sampleRate} Hz` : zhCN.common.unavailable} />
                    <InfoRow label={t.channels} value={firstAudio.channels ? `${firstAudio.channels}${firstAudio.channelLayout ? ` (${firstAudio.channelLayout})` : ''}` : zhCN.common.unavailable} />
                    <InfoRow label={t.bitRate} value={formatBitRate(firstAudio.bitRate)} />
                    <InfoRow label={t.loudness} value={firstAudio.integratedLufs !== undefined ? `${firstAudio.integratedLufs.toFixed(1)} LUFS` : (analysis.loudnessError ?? zhCN.common.unavailable)} testId="media-info-loudness" />
                  </>
                ) : (
                  <div className="text-sm text-slate-500">{t.noAudio}</div>
                )}
              </InfoSection>
              <InfoSection title={t.bitrateChart}>
                <BitrateChart points={analysis.bitratePoints} />
              </InfoSection>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function InfoSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-md border border-line bg-panel p-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-normal text-slate-600">{title}</h3>
      <div className="grid gap-1 text-sm">{children}</div>
    </section>
  );
}

function InfoRow({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-3">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="min-w-0 break-words text-sm text-ink" data-testid={testId}>{value}</div>
    </div>
  );
}

function BitrateChart({ points }: { points: MediaAnalysis['bitratePoints'] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }
    const width = canvas.width;
    const height = canvas.height;
    context.clearRect(0, 0, width, height);
    context.fillStyle = '#f8fafc';
    context.fillRect(0, 0, width, height);
    context.strokeStyle = '#cbd5e1';
    context.lineWidth = 1;
    for (let y = 24; y < height; y += 24) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }
    if (points.length === 0) {
      context.fillStyle = '#64748b';
      context.font = '12px sans-serif';
      context.fillText(zhCN.mediaBin.mediaInfo.noBitrateData, 12, 26);
      return;
    }
    const maxRate = Math.max(...points.map((point) => point.bitRate), 1);
    const maxTime = Math.max(...points.map((point) => point.time), 1);
    context.strokeStyle = '#0f766e';
    context.lineWidth = 2;
    context.beginPath();
    points.forEach((point, index) => {
      const x = (point.time / maxTime) * (width - 16) + 8;
      const y = height - 8 - (point.bitRate / maxRate) * (height - 16);
      if (index === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    });
    context.stroke();
  }, [points]);

  return <canvas ref={canvasRef} className="h-32 w-full rounded-md border border-line bg-white" width={640} height={128} data-testid="media-info-bitrate-chart" />;
}

const MEDIA_LABEL_COLORS: Array<{ key: MediaLabelColor; value: string }> = [
  { key: 'red', value: '#ef4444' },
  { key: 'orange', value: '#f97316' },
  { key: 'yellow', value: '#eab308' },
  { key: 'green', value: '#22c55e' },
  { key: 'blue', value: '#3b82f6' },
  { key: 'purple', value: '#a855f7' }
];

function MediaCard({
  asset,
  metadata,
  onAdd,
  onRelink,
  onGenerateProxy,
  onConvertToCfr,
  onSetLabel,
  onSetRating,
  onSetFlag,
  onBatchTranscode,
  onShowInfo
}: {
  asset: MediaAsset;
  metadata?: MediaMetadata;
  onAdd(): void;
  onRelink(): void;
  onGenerateProxy(): void;
  onConvertToCfr(): void;
  onSetLabel(labelColor?: MediaLabelColor): void;
  onSetRating(rating: number): void;
  onSetFlag(flag?: MediaFlag): void;
  onBatchTranscode(): void;
  onShowInfo(): void;
}) {
  const proxySettings = useProxySettingsStore((state) => state.settings);
  const proxyStatus = asset.proxyStatus ?? (asset.type === 'video' ? 'none' : undefined);
  const canGenerateProxy = asset.type === 'video' && (shouldGenerateProxy(asset, proxySettings) || proxyStatus === 'error');
  const [labelMenuOpen, setLabelMenuOpen] = useState(false);
  const labelColor = metadata?.labelColor;
  const rating = metadata?.rating ?? 0;
  const flag = metadata?.flag;
  return (
    <div
      className={clsx('relative overflow-hidden rounded-md border bg-white shadow-sm outline-none focus:ring-2 focus:ring-brand', asset.missing ? 'border-rose-300' : 'border-line')}
      data-testid={`media-card-${asset.id}`}
      data-missing={asset.missing ? 'true' : 'false'}
      data-folder-id={asset.folderId ?? 'root'}
      data-label-color={labelColor ?? 'none'}
      data-rating={rating}
      data-flag={flag ?? 'none'}
      tabIndex={0}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData(MEDIA_CARD_DRAG_MIME, asset.id);
      }}
      onKeyDown={(event) => {
        if (event.key.toLowerCase() === 'g') {
          event.preventDefault();
          onSetFlag('green');
        }
        if (event.key.toLowerCase() === 'x') {
          event.preventDefault();
          onSetFlag('red');
        }
        if (event.key.toLowerCase() === 'u') {
          event.preventDefault();
          onSetFlag(undefined);
        }
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        setLabelMenuOpen(true);
      }}
    >
      <div className="checkerboard relative aspect-video">
        {asset.thumbnail ? <img className="h-full w-full object-cover" src={asset.thumbnail} alt="" /> : <IconPreview type={asset.type} />}
        {asset.missing ? <span className="absolute left-2 top-2 rounded bg-rose-600 px-2 py-1 text-xs font-semibold text-white" data-testid={`missing-media-badge-${asset.id}`}>{zhCN.common.missing}</span> : null}
        {asset.variableFrameRate ? (
          <span
            className="absolute left-2 top-2 rounded bg-sky-700 px-2 py-1 text-xs font-semibold text-white shadow"
            title={zhCN.mediaBin.vfrTooltip}
            data-testid={`vfr-badge-${asset.id}`}
          >
            {zhCN.mediaBin.vfrBadge}
          </span>
        ) : null}
        {labelColor ? <span className="absolute right-2 top-2 h-4 w-4 rounded-full border border-white shadow" style={{ backgroundColor: labelColorToHex(labelColor) }} data-testid={`media-label-${asset.id}`} /> : null}
        {flag ? (
          <span
            className={clsx(
              'absolute left-2 bottom-2 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold text-white shadow',
              flag === 'green' ? 'bg-emerald-600' : 'bg-rose-600'
            )}
            data-testid={`media-flag-badge-${asset.id}`}
          >
            <Flag size={11} fill="currentColor" />
            {flag === 'green' ? zhCN.mediaBin.flagGreen : zhCN.mediaBin.flagRed}
          </span>
        ) : null}
      </div>
      {labelMenuOpen ? (
        <div className="absolute right-2 top-2 z-10 w-40 rounded-md border border-line bg-white p-2 text-xs shadow-soft" data-testid={`media-label-menu-${asset.id}`}>
          <button
            className="mb-2 inline-flex w-full items-center gap-2 rounded-md border border-line px-2 py-1.5 text-left font-medium text-slate-700 hover:bg-panel"
            type="button"
            data-testid={`media-info-${asset.id}`}
            onClick={() => {
              onShowInfo();
              setLabelMenuOpen(false);
            }}
          >
            <Info size={13} />
            {zhCN.mediaBin.mediaInfo.menuItem}
          </button>
          {asset.type === 'video' ? (
            <button
              className="mb-2 inline-flex w-full items-center gap-2 rounded-md border border-line px-2 py-1.5 text-left font-medium text-slate-700 hover:bg-panel"
              type="button"
              data-testid={`media-batch-transcode-${asset.id}`}
              onClick={() => {
                onBatchTranscode();
                setLabelMenuOpen(false);
              }}
            >
              <FileVideo2 size={13} />
              {zhCN.mediaBin.batchTranscode}
            </button>
          ) : null}
          <div className="mb-2 flex items-center gap-1 font-semibold text-slate-700">
            <Tag size={13} />
            {zhCN.mediaBin.label}
          </div>
          <div className="grid grid-cols-3 gap-1">
            {MEDIA_LABEL_COLORS.map((color) => (
              <button
                key={color.key}
                className="h-7 rounded border border-line"
                type="button"
                title={zhCN.mediaBin.labelColors[color.key]}
                style={{ backgroundColor: color.value }}
                data-testid={`media-label-color-${color.key}`}
                onClick={() => {
                  onSetLabel(color.key);
                  setLabelMenuOpen(false);
                }}
              />
            ))}
          </div>
          <button
            className="mt-2 w-full rounded-md border border-line px-2 py-1 text-left font-medium text-slate-600 hover:bg-panel"
            type="button"
            data-testid="media-label-clear"
            onClick={() => {
              onSetLabel(undefined);
              setLabelMenuOpen(false);
            }}
          >
            {zhCN.mediaBin.clearLabel}
          </button>
        </div>
      ) : null}
      <div className="p-2">
        <div className="truncate text-sm font-medium" title={asset.path}>
          {asset.name}
        </div>
        <div className="mt-1 flex items-center justify-between gap-2 text-xs text-slate-500">
          <span>{zhCN.mediaBin.assetType[asset.type]}</span>
          <span>{asset.type === 'audio' ? formatDuration(asset.duration) : `${asset.width || '-'}x${asset.height || '-'}`}</span>
        </div>
        {asset.type === 'video' ? (
          <ProxyStatus status={proxyStatus} error={asset.proxyError} canGenerate={canGenerateProxy} onGenerateProxy={onGenerateProxy} assetId={asset.id} />
        ) : null}
        {asset.variableFrameRate ? (
          <button
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-2 py-1.5 text-xs font-semibold text-sky-800 hover:bg-sky-100"
            type="button"
            data-testid={`convert-cfr-${asset.id}`}
            onClick={onConvertToCfr}
          >
            {zhCN.mediaBin.convertToCfr}
          </button>
        ) : null}
        {asset.relativePath ? <div className="mt-1 truncate text-[11px] text-slate-400">{asset.relativePath}</div> : null}
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex items-center" data-testid={`media-rating-${asset.id}`} aria-label={zhCN.mediaBin.rating}>
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                className={clsx('rounded p-0.5', value <= rating ? 'text-amber-400 hover:text-amber-500' : 'text-slate-300 hover:text-amber-300')}
                title={zhCN.mediaBin.ratingValue(value)}
                aria-label={zhCN.mediaBin.ratingValue(value)}
                data-testid={`media-rating-star-${asset.id}-${value}`}
                data-rating-value={value}
                onClick={(event) => {
                  event.stopPropagation();
                  onSetRating(rating === value ? 0 : value);
                }}
              >
                <Star size={14} fill={value <= rating ? 'currentColor' : 'none'} />
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1" aria-label={zhCN.mediaBin.flag}>
            <button
              type="button"
              className={clsx('rounded border px-1.5 py-0.5 text-[11px] font-semibold', flag === 'green' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-line text-slate-500 hover:bg-panel')}
              title={zhCN.mediaBin.flagGreenShortcut}
              data-testid={`media-flag-green-${asset.id}`}
              onClick={() => onSetFlag(flag === 'green' ? undefined : 'green')}
            >
              G
            </button>
            <button
              type="button"
              className={clsx('rounded border px-1.5 py-0.5 text-[11px] font-semibold', flag === 'red' ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-line text-slate-500 hover:bg-panel')}
              title={zhCN.mediaBin.flagRedShortcut}
              data-testid={`media-flag-red-${asset.id}`}
              onClick={() => onSetFlag(flag === 'red' ? undefined : 'red')}
            >
              X
            </button>
            {flag ? (
              <button
                type="button"
                className="rounded border border-line px-1.5 py-0.5 text-[11px] font-semibold text-slate-500 hover:bg-panel"
                title={zhCN.mediaBin.flagClearShortcut}
                data-testid={`media-flag-clear-${asset.id}`}
                onClick={() => onSetFlag(undefined)}
              >
                U
              </button>
            ) : null}
          </div>
        </div>
        <button
          className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md border border-line bg-panel px-2 py-1.5 text-sm font-medium hover:bg-white"
          onClick={onAdd}
          data-testid={`add-to-timeline-${asset.id}`}
        >
          <Plus size={15} />
          {zhCN.mediaBin.addToTimeline}
        </button>
        {asset.missing ? (
          <button
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100"
            onClick={onRelink}
            data-testid={`relink-media-${asset.id}`}
          >
            <Link2 size={15} />
            {zhCN.mediaBin.relink}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function labelColorToHex(color: MediaLabelColor): string {
  return MEDIA_LABEL_COLORS.find((item) => item.key === color)?.value ?? '#64748b';
}

function ProxyStatus({
  status,
  error,
  canGenerate,
  onGenerateProxy,
  assetId
}: {
  status: MediaAsset['proxyStatus'];
  error?: string;
  canGenerate: boolean;
  onGenerateProxy(): void;
  assetId: string;
}) {
  const icon = status === 'ready' ? <BadgeCheck size={13} /> : status === 'pending' ? <Loader2 className="animate-spin" size={13} /> : status === 'error' ? <AlertCircle size={13} /> : <Gauge size={13} />;
  const label = status === 'ready' ? zhCN.mediaBin.proxyStatus.ready : status === 'pending' ? zhCN.mediaBin.proxyStatus.pending : status === 'error' ? zhCN.mediaBin.proxyStatus.error : canGenerate ? zhCN.mediaBin.proxyStatus.recommended : zhCN.mediaBin.proxyStatus.notNeeded;
  const tone =
    status === 'ready'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : status === 'pending'
        ? 'border-sky-200 bg-sky-50 text-sky-700'
        : status === 'error'
          ? 'border-rose-200 bg-rose-50 text-rose-700'
          : 'border-slate-200 bg-slate-50 text-slate-600';
  return (
    <div className="mt-2 space-y-1">
      <div className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone}`} title={error} data-testid={`proxy-status-${assetId}`} data-proxy-status={status ?? 'none'}>
        {icon}
        <span className="truncate">{label}</span>
      </div>
      {canGenerate || status === 'pending' || status === 'ready' ? (
        <button
          className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-line bg-white px-2 py-1.5 text-xs font-medium hover:bg-panel disabled:opacity-50"
          onClick={onGenerateProxy}
          disabled={!canGenerate || status === 'pending'}
          data-testid={`generate-proxy-${assetId}`}
        >
          <Gauge size={14} />
          {zhCN.mediaBin.generateProxy}
        </button>
      ) : null}
    </div>
  );
}

function IconPreview({ type }: { type: MediaAsset['type'] }) {
  const Icon = type === 'video' ? FileVideo2 : type === 'audio' ? FileAudio2 : FileImage;
  return (
    <div className="flex h-full items-center justify-center text-slate-500">
      <Icon size={36} />
    </div>
  );
}

function formatBytes(bytes?: number): string {
  if (bytes === undefined || !Number.isFinite(bytes)) {
    return zhCN.common.unavailable;
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = Math.max(0, bytes);
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatBitRate(bitRate?: number): string {
  if (bitRate === undefined || !Number.isFinite(bitRate)) {
    return zhCN.common.unavailable;
  }
  if (bitRate >= 1_000_000) {
    return `${(bitRate / 1_000_000).toFixed(2)} Mbps`;
  }
  if (bitRate >= 1_000) {
    return `${(bitRate / 1_000).toFixed(1)} kbps`;
  }
  return `${Math.round(bitRate)} bps`;
}

function formatDateTime(timestamp?: number): string {
  if (timestamp === undefined || !Number.isFinite(timestamp)) {
    return zhCN.common.unavailable;
  }
  return new Date(timestamp).toLocaleString();
}

function formatDuration(duration: number): string {
  const minutes = Math.floor(duration / 60);
  const seconds = Math.floor(duration % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${seconds}`;
}

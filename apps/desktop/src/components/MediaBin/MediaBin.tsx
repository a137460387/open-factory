import {
  MAX_MEDIA_FOLDER_DEPTH,
  TITLE_TEMPLATE_IDS,
  collectFingerprintReferences,
  listFingerprintSourcePaths,
  type MediaAsset,
  type BatchEditableMediaMetadata,
  type ClipContentAnalysis,
  type MediaFlag,
  type MediaFolder,
  type MediaLabelColor,
  type MediaMetadata,
  type MediaRenamePreviewItem,
  type TitleTemplateId,
  type EffectPreset,
  type QualityAssessmentResult,
  type SmartAlbumId,
} from '@open-factory/editor-core';
import { parseFavoritesSearchFilter, type Subclip } from '@open-factory/editor-core';
import {
  AudioWaveform,
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderPlus,
  Import,
  Link2,
  Merge,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import {
  createContext,
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { BatchMetadataDialog, BatchRenameDialog } from './BatchDialogs';
import { MediaInfoDialog, formatBytes, formatDuration, type MediaInfoState } from './MediaInfoDialog';
import { SubclipDialog } from './SubclipDialog';
import {
  MediaCard,
  MediaCardExtrasCtx,
  formatFrameRateLabel,
  formatMediaColorProfile,
  formatMediaFormat,
  formatMediaResolution,
  IconPreview,
  type MediaCardExtras,
} from './MediaCard';
import { clsx } from 'clsx';
import { zhCN } from '../../i18n/strings';
import { TITLE_TEMPLATE_DRAG_MIME } from '../../lib/titleTemplates';
import { useMediaJobStore } from '../../media/media-job-store';
import { ensureMediaJobRunner } from '../../media/media-job-runner';
import { MediaAIAnalysisDialog } from './MediaAIAnalysisDialog';
import { MediaMetadataPanel } from './MediaMetadataPanel';
import type { MediaCollection } from '@open-factory/editor-core';
import type { VisualHighlightMarker } from '@open-factory/editor-core/visual-highlight-engine';
import type { SharedLibraryResource } from '../../shared-library/sharedLibrary';
import { useMediaBinState } from './useMediaBinState';
import { MediaBinFilterBar } from './MediaBinFilterBar';

const MEDIA_CARD_DRAG_MIME = 'application/x-open-factory-media-id';
const SUBCLIP_DRAG_MIME = 'application/x-open-factory-subclip';

/**
 * 网格数据按 scope 选择（方案 E 的"切数据不切组件"契约）：
 * - 智能相册 scope：网格直接展示全部可见素材（不按文件夹分流）；
 * - 普通 scope（'none'）：网格只展示未分类素材，已分类素材由 MediaFolderTree 渲染。
 * 与重构前两个三元分支各自的 media 表达式逐字等价。
 */
export function selectMediaGridScopeMedia(
  sortedVisibleMedia: MediaAsset[],
  smartAlbumId: SmartAlbumId | 'none',
): MediaAsset[] {
  return smartAlbumId === 'none' ? sortedVisibleMedia.filter((asset) => !asset.folderId) : sortedVisibleMedia;
}

// MediaCardExtras/MediaCardExtrasCtx 统一由 MediaCard.tsx 导出；
// c43c5d4c 拆分时此处曾复制出第二个 context 实例，导致 Provider 与
// MediaCard 的 useContext 不是同一对象，AI 分析/质量评估等菜单项失效。

interface MediaGridNavCtxValue {
  columnCount: number;
  mediaCount: number;
  scrollToMediaIndex(index: number): void;
  pendingFocusRef: { current: number | null };
}
const MediaGridNavCtx = createContext<MediaGridNavCtxValue | null>(null);

interface SubclipContextValue {
  subclips: Subclip[];
  onAddSubclip(subclip: Subclip): void;
  onUpdateSubclip(subclipId: string, patch: Partial<Subclip>): void;
  onDeleteSubclip(subclipId: string): void;
  onAddSubclipToTimeline(assetId: string, subclip: Subclip): void;
  onOpenSubclipDialog(assetId: string, editingSubclipId?: string): void;
  expandedSubclipAssetIds: Set<string>;
  onToggleSubclipExpanded(assetId: string): void;
}
const SubclipCtx = createContext<SubclipContextValue | null>(null);

interface MediaBinProps {
  media: MediaAsset[];
  mediaFolders: MediaFolder[];
  mediaMetadata: Record<string, MediaMetadata>;
  mediaContentAnalysis: Record<string, ClipContentAnalysis>;
  sharedLibraryResources?: SharedLibraryResource[];
  selectedClipId?: string;
  projectFrameRate: number;
  onImport(): void;
  onImportPaths(paths: string[]): void;
  onBatchTranscode(paths: string[]): void;
  onBatchGenerateCovers(): void;
  onGenerateThumbnails(assetIds: string[]): void;
  onExportGif(asset: MediaAsset): void;
  onAnalyzeSpectrum(asset: MediaAsset): void;
  onScanDuplicates(): void;
  onAddToTimeline(assetId: string): void;
  onAddVersion(assetId: string): void;
  onCompareVersions(assetId: string): void;
  onAddAdjustmentLayer(): void;
  onRelink(assetId: string): void;
  onRelinkAll(): void;
  onGenerateProxy(assetId: string): void;
  onConvertToCfr(assetId: string): void;
  onSetLabel(assetId: string, labelColor?: MediaLabelColor): void;
  onSetRating(assetId: string, rating: number): void;
  onSetFlag(assetId: string, flag?: MediaFlag): void;
  onBatchUpdateMetadata(assetIds: string[], metadata: BatchEditableMediaMetadata): void;
  onBatchRenameMedia(assetIds: string[], preview: MediaRenamePreviewItem[], renameFiles: boolean): Promise<void> | void;
  onAddTitleTemplate(templateId: TitleTemplateId): void;
  onCreateFolder(parentId?: string | null): void;
  onRenameFolder(folderId: string, name: string): void;
  onDeleteFolder(folderId: string): void;
  onSetFolderCollapsed(folderId: string, collapsed: boolean): void;
  onMoveMediaToFolder(assetIds: string[], folderId?: string | null): void;
  onApplyEffectPreset(preset: EffectPreset): void;
  favoriteIds?: string[];
  onToggleFavorite?(assetId: string): void;
  onRevealInTimeline?(assetId: string): void;
  pinnedIds?: Set<string>;
  onPinToSession?(assetId: string): void;
  recentMediaIds?: string[];
  subclips?: Subclip[];
  onAddSubclip?(subclip: Subclip): void;
  onUpdateSubclip?(subclipId: string, patch: Partial<Subclip>): void;
  onDeleteSubclip?(subclipId: string): void;
  onAddSubclipToTimeline?(assetId: string, subclip: Subclip): void;
  mediaCollections?: MediaCollection[];
  onUpdateMediaCollections?(collections: MediaCollection[]): void;
}

export function MediaBin({
  media,
  mediaFolders,
  mediaMetadata,
  mediaContentAnalysis,
  sharedLibraryResources = [],
  selectedClipId,
  projectFrameRate,
  onImport,
  onImportPaths,
  onBatchTranscode,
  onBatchGenerateCovers,
  onGenerateThumbnails,
  onExportGif,
  onAnalyzeSpectrum,
  onScanDuplicates,
  onAddToTimeline,
  onAddVersion,
  onCompareVersions,
  onAddAdjustmentLayer,
  onRelink,
  onRelinkAll,
  onGenerateProxy,
  onConvertToCfr,
  onSetLabel,
  onSetRating,
  onSetFlag,
  onBatchUpdateMetadata,
  onBatchRenameMedia,
  onAddTitleTemplate,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onSetFolderCollapsed,
  onMoveMediaToFolder,
  onApplyEffectPreset,
  favoriteIds = [],
  onToggleFavorite = () => {},
  onRevealInTimeline = () => {},
  pinnedIds,
  onPinToSession = () => {},
  recentMediaIds = [],
  subclips = [],
  onAddSubclip = () => {},
  onUpdateSubclip = () => {},
  onDeleteSubclip = () => {},
  onAddSubclipToTimeline = () => {},
  mediaCollections = [],
  onUpdateMediaCollections = () => {},
}: MediaBinProps) {
  const t = zhCN.mediaBin;
  const state = useMediaBinState({
    media,
    mediaFolders,
    mediaMetadata,
    mediaContentAnalysis,
    favoriteIds,
    recentMediaIds,
    pinnedIds,
    subclips,
    mediaCollections,
    onImportPaths,
    onAddSubclip,
    onUpdateSubclip,
    onDeleteSubclip,
    onAddSubclipToTimeline,
    onUpdateMediaCollections,
  });

  const extrasValue: MediaCardExtras = {
    favoriteIds: new Set(favoriteIds),
    onToggleFavorite,
    onRevealInTimeline,
    pinnedIds: state._effectivePinnedIds,
    onPinToSession,
    onAnalyzeAI: (assetId) => {
      const found = media.find((a) => a.id === assetId);
      if (found) state.setAiAnalysisAsset(found);
    },
    qualityResults: state.qualityResults,
    qualityErrors: state.qualityErrors,
    qualityLoading: state.qualityLoading,
    onQualityAssess: state.handleQualityAssess,
    onBatchQualityScan: state.handleBatchQualityScan,
  };

  return (
    <SubclipCtx.Provider
      value={{
        subclips,
        onAddSubclip,
        onUpdateSubclip,
        onDeleteSubclip,
        onAddSubclipToTimeline,
        onOpenSubclipDialog: state.handleOpenSubclipDialog,
        expandedSubclipAssetIds: state.expandedSubclipAssetIds,
        onToggleSubclipExpanded: state.handleToggleSubclipExpanded,
      }}
    >
      <MediaCardExtrasCtx.Provider value={extrasValue}>
        <aside
          className={clsx('flex h-full min-h-0 flex-col bg-panel', state.dragOver && 'ring-2 ring-inset ring-brand')}
          onDragOver={(event) => {
            event.preventDefault();
            state.setDragOver(true);
          }}
          onDragLeave={() => state.setDragOver(false)}
          onDrop={(event) => {
            event.preventDefault();
            state.setDragOver(false);
            const paths = Array.from(event.dataTransfer.files)
              .map((file) => (file as File & { path?: string }).path)
              .filter((path): path is string => Boolean(path));
            if (paths.length > 0) onImportPaths(paths);
          }}
        >
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <div>
              <div className="text-sm font-semibold">{t.title}</div>
              <div className="text-xs text-[var(--color-text-muted)]">{t.itemCount(media.length)}</div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {media.filter((a) => a.missing).length > 0 ? (
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
                className="inline-flex items-center gap-2 rounded-md border border-line bg-panel px-2 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]"
                onClick={onScanDuplicates}
                data-testid="scan-duplicate-media-button"
              >
                <Merge size={15} />
                {t.scanDuplicates}
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-md border border-line bg-panel px-2 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]"
                onClick={onBatchGenerateCovers}
                data-testid="batch-generate-covers-button"
              >
                <Import size={15} />
                {t.batchGenerateCovers}
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-md border border-line bg-panel px-2 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => onGenerateThumbnails(state.selectedVideoIds)}
                disabled={state.selectedVideoIds.length === 0}
                data-testid="batch-generate-thumbnails-button"
              >
                <Import size={15} />
                {t.batchGenerateThumbnails(state.selectedVideoIds.length)}
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-md border border-line bg-panel px-2 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]"
                onClick={() => {
                  const selected = media.filter((asset) => state.selectedMediaIds.has(asset.id));
                  useMediaJobStore.getState().enqueueWaveformJobsForMedia(selected);
                  void ensureMediaJobRunner();
                }}
                data-testid="batch-generate-waveforms-button"
              >
                <AudioWaveform size={15} />
                {t.batchGenerateWaveforms}
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-md border border-line bg-panel px-2 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]"
                onClick={onAddAdjustmentLayer}
                data-testid="new-adjustment-layer-button"
              >
                <SlidersHorizontal size={15} />
                {t.newAdjustmentLayer}
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-md border border-line bg-panel px-2 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]"
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
            <MediaBinFilterBar
              media={media}
              mediaMetadata={mediaMetadata}
              projectPath={state.projectPath || ''}
              search={state.search}
              onSearchChange={state.setSearch}
              filter={state.filter}
              onFilterChange={state.setFilter}
              quickFilter={state.quickFilter}
              onQuickFilterChange={state.setQuickFilter}
              sceneFilter={state.sceneFilter}
              onSceneFilterChange={state.setSceneFilter}
              smartAlbumId={state.smartAlbumId}
              onSmartAlbumIdChange={state.setSmartAlbumId}
              smartAlbums={state.smartAlbums}
              mediaLibraryView={state.mediaLibraryView}
              onViewChange={state.updateMediaLibraryView}
              aiSearchMode={state.aiSearchMode}
              onAiSearchModeChange={state.setAiSearchMode}
              organizePanelOpen={state.organizePanelOpen}
              onOrganizePanelOpenChange={state.setOrganizePanelOpen}
              mediaCollections={mediaCollections}
              onUpdateMediaCollections={onUpdateMediaCollections}
              favoriteIds={favoriteIds}
              recentMediaIds={recentMediaIds}
            />
            {state.filter !== 'titles' &&
            state.filter !== 'shared' &&
            state.filter !== 'effects' &&
            state.jobs.length > 0 ? (
              <div className="mb-3 rounded-md border border-line bg-panel p-2 text-xs" data-testid="media-job-queue">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-[var(--color-text-secondary)]">{t.mediaJobs}</div>
                    <div className="truncate text-[var(--color-text-muted)]">
                      {state.runningJob
                        ? `${t.jobType[state.runningJob.type]} · ${state.runningJob.assetName}`
                        : state.runnerActive
                          ? t.preparingQueue
                          : zhCN.common.idle}{' '}
                      · {t.pendingCount(state.pendingCount)}
                      {state.failedCount > 0 ? ` · ${t.failedCount(state.failedCount)}` : ''}
                    </div>
                  </div>
                  <button
                    className="rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1 text-[11px] font-medium hover:bg-[var(--color-bg-secondary)]"
                    onClick={state.clearFinishedJobs}
                  >
                    {zhCN.common.clear}
                  </button>
                </div>
              </div>
            ) : null}
            {state.filter === 'shared' ? (
              <SharedLibraryGrid resources={sharedLibraryResources} />
            ) : state.filter === 'titles' ? (
              <TitleTemplateGrid onAddTitleTemplate={onAddTitleTemplate} />
            ) : state.filter === 'effects' ? (
              <EffectPresetGrid
                presets={state.effectPresets}
                loading={state.effectPresetsLoading}
                error={state.effectPresetsError}
                selectedClipId={selectedClipId}
                onApply={onApplyEffectPreset}
                onRefresh={() => void state.refreshEffectPresetList()}
              />
            ) : media.length === 0 ? (
              <button
                className="flex h-full min-h-[220px] w-full flex-col items-center justify-center rounded-md border border-dashed border-slate-300 bg-panel p-6 text-center text-sm text-[var(--color-text-secondary)]"
                onClick={onImport}
              >
                <Import className="mb-3 text-[var(--color-text-muted)]" size={30} />
                {t.emptyDrop}
              </button>
            ) : state.mediaLibraryView.mode === 'list' ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <MediaLibraryListView
                  media={state.sortedVisibleMedia}
                  settings={state.mediaLibraryView}
                  selectedAssetId={state.detailsAssetId}
                  onSort={(sortKey) =>
                    state.updateMediaLibraryView({
                      sortKey,
                      sortDirection:
                        state.mediaLibraryView.sortKey === sortKey && state.mediaLibraryView.sortDirection === 'asc'
                          ? 'desc'
                          : 'asc',
                    })
                  }
                  onAddToTimeline={onAddToTimeline}
                  onExportGif={onExportGif}
                  onSelectAsset={(assetId) => state.setDetailsAssetId((prev) => (prev === assetId ? null : assetId))}
                />
                <div
                  className="mt-2 flex-shrink-0 overflow-hidden rounded-md border border-line bg-[var(--color-bg-elevated)]"
                  style={{ maxHeight: state.detailsAsset ? '260px' : '0px', transition: 'max-height 0.2s ease' }}
                >
                  <MediaMetadataPanel asset={state.detailsAsset} />
                </div>
              </div>
            ) : state.mediaLibraryView.mode === 'timeline' ? (
              <MediaLibraryTimelineView
                media={state.importedTimelineMedia}
                onAddToTimeline={onAddToTimeline}
                onExportGif={onExportGif}
              />
            ) : (
              /* 方案 E（media-rating:4 根因修复）：VirtualMediaCardGrid 在普通/智能相册
                 两种 scope 间常驻挂载，切换只变更 media 数据 prop。
                 根因：此前智能相册是独立三元分支，点击切换会在离散同步事件提交内
                 卸载旧网格并首次挂载新网格，@tanstack/react-virtual 挂载期测量后
                 派发的 rerender 在该场景下不会被提交，网格永久空白直到外部重渲染。
                 常驻挂载后切换不再触发"挂载期同步测量"，从根源避开触发条件。
                 文件夹树/根拖放区仍按 scope 挂载/卸载（非虚拟化组件，无此问题），
                 key 仅用于协调稳定性（保证网格同位置复用、不随兄弟节点增删而重挂载）。 */
              <div className="flex min-h-full flex-col gap-3">
                {state.smartAlbumId === 'none' ? (
                  <Fragment key="media-folder-chrome">
                    <MediaFolderTree
                      folders={mediaFolders}
                      media={state.sortedVisibleMedia}
                      mediaMetadata={mediaMetadata}
                      mediaContentAnalysis={mediaContentAnalysis}
                      gridSize={state.mediaLibraryView.gridSize}
                      projectFrameRate={projectFrameRate}
                      onCreateFolder={onCreateFolder}
                      onRenameFolder={onRenameFolder}
                      onDeleteFolder={onDeleteFolder}
                      onSetFolderCollapsed={onSetFolderCollapsed}
                      onMoveMediaToFolder={onMoveMediaToFolder}
                      onAddToTimeline={onAddToTimeline}
                      onAddVersion={onAddVersion}
                      onCompareVersions={onCompareVersions}
                      onRelink={onRelink}
                      onGenerateProxy={onGenerateProxy}
                      onConvertToCfr={onConvertToCfr}
                      onSetLabel={onSetLabel}
                      onSetRating={onSetRating}
                      onSetFlag={onSetFlag}
                      onBatchTranscode={onBatchTranscode}
                      onExportGif={onExportGif}
                      onAnalyzeSpectrum={onAnalyzeSpectrum}
                      onShowInfo={(asset) => void state.openMediaInfo(asset)}
                      onFindSources={state.findSourcePaths}
                      selectedMediaIds={state.selectedMediaIds}
                      onToggleSelected={state.toggleSelectedMedia}
                      onOpenBatchMetadata={state.openBatchMetadataEditor}
                      onOpenBatchRename={state.openBatchRenameEditor}
                      mediaHighlights={state.mediaHighlights}
                    />
                    <RootMediaDropZone onMoveMediaToFolder={onMoveMediaToFolder} />
                  </Fragment>
                ) : null}
                <VirtualMediaCardGrid
                  key="media-grid"
                  media={selectMediaGridScopeMedia(state.sortedVisibleMedia, state.smartAlbumId)}
                  viewScope={state.smartAlbumId}
                  gridSize={state.mediaLibraryView.gridSize}
                  mediaMetadata={mediaMetadata}
                  mediaContentAnalysis={mediaContentAnalysis}
                  projectFrameRate={projectFrameRate}
                  onAddToTimeline={onAddToTimeline}
                  onAddVersion={onAddVersion}
                  onCompareVersions={onCompareVersions}
                  onRelink={onRelink}
                  onGenerateProxy={onGenerateProxy}
                  onConvertToCfr={onConvertToCfr}
                  onSetLabel={onSetLabel}
                  onSetRating={onSetRating}
                  onSetFlag={onSetFlag}
                  onBatchTranscode={onBatchTranscode}
                  onExportGif={onExportGif}
                  onAnalyzeSpectrum={onAnalyzeSpectrum}
                  onShowInfo={(asset) => void state.openMediaInfo(asset)}
                  onFindSources={state.findSourcePaths}
                  selectedMediaIds={state.selectedMediaIds}
                  onToggleSelected={state.toggleSelectedMedia}
                  onOpenBatchMetadata={state.openBatchMetadataEditor}
                  onOpenBatchRename={state.openBatchRenameEditor}
                  mediaHighlights={state.mediaHighlights}
                />
              </div>
            )}
          </div>
          {state.aiAnalysisAsset ? (
            <MediaAIAnalysisDialog asset={state.aiAnalysisAsset} onClose={() => state.setAiAnalysisAsset(undefined)} />
          ) : null}
          {state.mediaInfo ? (
            <MediaInfoDialog state={state.mediaInfo} onClose={() => state.setMediaInfo(undefined)} />
          ) : null}
          {state.sourcePaths ? (
            <MediaSourcePathsDialog state={state.sourcePaths} onClose={() => state.setSourcePaths(undefined)} />
          ) : null}
          {state.batchMetadataAssets.length > 0 ? (
            <BatchMetadataDialog
              assets={state.batchMetadataAssets}
              onClose={() => state.setBatchMetadataAssetIds(undefined)}
              onSubmit={(metadata) => {
                onBatchUpdateMetadata(
                  state.batchMetadataAssets.map((asset) => asset.id),
                  metadata,
                );
                state.setBatchMetadataAssetIds(undefined);
              }}
            />
          ) : null}
          {state.batchRenameAssets.length > 0 ? (
            <BatchRenameDialog
              assets={state.batchRenameAssets}
              allAssets={media}
              onClose={() => state.setBatchRenameAssetIds(undefined)}
              onConfirm={(preview, renameFiles) => {
                void Promise.resolve(
                  onBatchRenameMedia(
                    state.batchRenameAssets.map((asset) => asset.id),
                    preview,
                    renameFiles,
                  ),
                ).finally(() => state.setBatchRenameAssetIds(undefined));
              }}
            />
          ) : null}
          {state.subclipDialogAssetId ? (
            <SubclipDialog
              asset={media.find((a) => a.id === state.subclipDialogAssetId)!}
              editingSubclip={
                state.editingSubclipId ? subclips.find((s) => s.id === state.editingSubclipId) : undefined
              }
              onAddSubclip={onAddSubclip}
              onUpdateSubclip={onUpdateSubclip}
              onClose={() => {
                state.setSubclipDialogAssetId(undefined);
                state.setEditingSubclipId(undefined);
              }}
            />
          ) : null}
        </aside>
      </MediaCardExtrasCtx.Provider>
    </SubclipCtx.Provider>
  );
}

// --- Sub-components ---

function SharedLibraryGrid({ resources }: { resources: SharedLibraryResource[] }) {
  if (resources.length === 0) {
    return (
      <div
        className="rounded-md border border-line bg-panel p-3 text-sm text-[var(--color-text-secondary)]"
        data-testid="shared-library-empty"
      >
        {zhCN.mediaBin.sharedEmpty}
      </div>
    );
  }
  return (
    <div className="space-y-2" data-testid="shared-library-resource-list">
      <div className="text-xs font-medium text-[var(--color-text-muted)]">
        {zhCN.mediaBin.sharedResourceCount(resources.length)}
      </div>
      <div className="grid gap-2">
        {resources.map((resource) => (
          <div
            key={resource.id}
            className="rounded-md border border-line bg-[var(--color-bg-elevated)] p-3 shadow-sm"
            data-testid="shared-library-resource-card"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-ink">{resource.name}</div>
                <div className="mt-1 text-xs text-[var(--color-text-muted)]">
                  {zhCN.mediaBin.sharedResourceTypes[resource.type]}
                </div>
              </div>
              <span className="shrink-0 rounded bg-panel px-1.5 py-0.5 text-[11px] font-semibold text-[var(--color-text-secondary)]">
                {zhCN.mediaBin.sharedVersion(resource.version)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EffectPresetGrid({
  presets,
  loading,
  error,
  selectedClipId,
  onApply,
  onRefresh,
}: {
  presets: EffectPreset[];
  loading: boolean;
  error?: string;
  selectedClipId?: string;
  onApply(preset: EffectPreset): void;
  onRefresh(): void;
}) {
  const t = zhCN.mediaBin.effectPresets;
  return (
    <div className="space-y-3" data-testid="effect-preset-library">
      <div className="flex items-center justify-between gap-3 rounded-md border border-line bg-panel p-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-ink">{t.title}</div>
          <div className="text-xs text-[var(--color-text-muted)]">{selectedClipId ? t.ready : t.selectClip}</div>
        </div>
        <button
          className="inline-flex items-center gap-1 rounded-md border border-line bg-[var(--color-bg-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-panel"
          type="button"
          data-testid="effect-presets-refresh-button"
          onClick={onRefresh}
        >
          <RotateCcw size={13} />
          {t.refresh}
        </button>
      </div>
      {loading ? (
        <div
          className="rounded-md border border-line bg-[var(--color-bg-elevated)] p-3 text-sm text-[var(--color-text-secondary)]"
          data-testid="effect-presets-loading"
        >
          {t.loading}
        </div>
      ) : null}
      {error ? (
        <div
          className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"
          data-testid="effect-presets-error"
        >
          {error}
        </div>
      ) : null}
      {!loading && presets.length === 0 ? (
        <div
          className="rounded-md border border-line bg-[var(--color-bg-elevated)] p-3 text-sm text-[var(--color-text-secondary)]"
          data-testid="effect-presets-empty"
        >
          {t.empty}
        </div>
      ) : null}
      <div className="grid gap-2" data-testid="effect-preset-list">
        {presets.map((preset) => (
          <div
            key={preset.id}
            className="rounded-md border border-line bg-[var(--color-bg-elevated)] p-3 shadow-sm"
            data-testid="effect-preset-card"
            data-preset-id={preset.id}
          >
            <div className="flex items-start gap-3">
              <div className="grid h-16 w-24 shrink-0 place-items-center overflow-hidden rounded border border-line bg-panel">
                {preset.thumbnail ? (
                  <img
                    className="h-full w-full object-cover"
                    src={preset.thumbnail}
                    alt=""
                    data-testid="effect-preset-thumbnail"
                    loading="lazy"
                  />
                ) : (
                  <SlidersHorizontal size={18} className="text-[var(--color-text-muted)]" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-ink">{preset.name}</div>
                <div className="truncate text-xs text-[var(--color-text-muted)]">{t.byAuthor(preset.author)}</div>
                <div className="mt-2 flex flex-wrap gap-1" data-testid="effect-preset-tags">
                  {preset.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded bg-panel px-2 py-0.5 text-[11px] font-medium text-[var(--color-text-secondary)]"
                    >
                      {(t.tagLabels as Record<string, string>)[tag] ?? tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <button
              className="mt-3 w-full rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={!selectedClipId}
              data-testid="effect-preset-apply-button"
              onClick={() => onApply(preset)}
            >
              {t.apply}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function MediaFolderTree(props: {
  folders: MediaFolder[];
  media: MediaAsset[];
  mediaMetadata: Record<string, MediaMetadata>;
  mediaContentAnalysis: Record<string, ClipContentAnalysis>;
  gridSize: any;
  projectFrameRate: number;
  onCreateFolder(parentId?: string | null): void;
  onRenameFolder(folderId: string, name: string): void;
  onDeleteFolder(folderId: string): void;
  onSetFolderCollapsed(folderId: string, collapsed: boolean): void;
  onMoveMediaToFolder(assetIds: string[], folderId?: string | null): void;
  onAddToTimeline(assetId: string): void;
  onAddVersion(assetId: string): void;
  onCompareVersions(assetId: string): void;
  onRelink(assetId: string): void;
  onGenerateProxy(assetId: string): void;
  onConvertToCfr(assetId: string): void;
  onSetLabel(assetId: string, labelColor?: MediaLabelColor): void;
  onSetRating(assetId: string, rating: number): void;
  onSetFlag(assetId: string, flag?: MediaFlag): void;
  onBatchTranscode(paths: string[]): void;
  onExportGif(asset: MediaAsset): void;
  onAnalyzeSpectrum(asset: MediaAsset): void;
  onShowInfo(asset: MediaAsset): void;
  onFindSources(asset: MediaAsset): void;
  selectedMediaIds: Set<string>;
  onToggleSelected(assetId: string): void;
  onOpenBatchMetadata(assetId: string): void;
  onOpenBatchRename(assetId: string): void;
  mediaHighlights?: Map<string, VisualHighlightMarker[]>;
}) {
  const roots = props.folders.filter((folder) => !folder.parentId);
  if (roots.length === 0) return null;
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
  mediaContentAnalysis,
  gridSize,
  projectFrameRate,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onSetFolderCollapsed,
  onMoveMediaToFolder,
  onAddToTimeline,
  onAddVersion,
  onCompareVersions,
  onRelink,
  onGenerateProxy,
  onConvertToCfr,
  onSetLabel,
  onSetRating,
  onSetFlag,
  onBatchTranscode,
  onExportGif,
  onAnalyzeSpectrum,
  onShowInfo,
  onFindSources,
  selectedMediaIds,
  onToggleSelected,
  onOpenBatchMetadata,
  onOpenBatchRename,
  mediaHighlights,
}: {
  folder: MediaFolder;
  depth: number;
  folders: MediaFolder[];
  media: MediaAsset[];
  mediaMetadata: Record<string, MediaMetadata>;
  mediaContentAnalysis: Record<string, ClipContentAnalysis>;
  gridSize: any;
  projectFrameRate: number;
  onCreateFolder(parentId?: string | null): void;
  onRenameFolder(folderId: string, name: string): void;
  onDeleteFolder(folderId: string): void;
  onSetFolderCollapsed(folderId: string, collapsed: boolean): void;
  onMoveMediaToFolder(assetIds: string[], folderId?: string | null): void;
  onAddToTimeline(assetId: string): void;
  onAddVersion(assetId: string): void;
  onCompareVersions(assetId: string): void;
  onRelink(assetId: string): void;
  onGenerateProxy(assetId: string): void;
  onConvertToCfr(assetId: string): void;
  onSetLabel(assetId: string, labelColor?: MediaLabelColor): void;
  onSetRating(assetId: string, rating: number): void;
  onSetFlag(assetId: string, flag?: MediaFlag): void;
  onBatchTranscode(paths: string[]): void;
  onExportGif(asset: MediaAsset): void;
  onAnalyzeSpectrum(asset: MediaAsset): void;
  onShowInfo(asset: MediaAsset): void;
  onFindSources(asset: MediaAsset): void;
  selectedMediaIds: Set<string>;
  onToggleSelected(assetId: string): void;
  onOpenBatchMetadata(assetId: string): void;
  onOpenBatchRename(assetId: string): void;
  mediaHighlights?: Map<string, VisualHighlightMarker[]>;
}) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(folder.name);
  const children = folders.filter((item) => item.parentId === folder.id);
  const folderMedia = media.filter((asset) => asset.folderId === folder.id);
  const canNest = getMediaFolderDepth(folders, folder.id) < MAX_MEDIA_FOLDER_DEPTH;
  const commitRename = () => {
    setEditing(false);
    if (draftName.trim() && draftName.trim() !== folder.name) onRenameFolder(folder.id, draftName);
    else setDraftName(folder.name);
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
          if (assetId) onMoveMediaToFolder([assetId], folder.id);
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          onDeleteFolder(folder.id);
        }}
      >
        <button
          className="rounded p-1 hover:bg-[var(--color-bg-secondary)]"
          type="button"
          data-testid={`media-folder-toggle-${folder.id}`}
          onClick={() => onSetFolderCollapsed(folder.id, !folder.collapsed)}
        >
          {folder.collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>
        <Folder size={15} className="text-brand" />
        {editing ? (
          <input
            className="min-w-0 flex-1 rounded-lg border border-line px-1 py-0.5 text-xs outline-none"
            value={draftName}
            autoFocus
            data-testid={`media-folder-name-input-${folder.id}`}
            onChange={(event) => setDraftName(event.target.value)}
            onBlur={commitRename}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitRename();
              if (event.key === 'Escape') {
                setDraftName(folder.name);
                setEditing(false);
              }
            }}
          />
        ) : (
          <button
            className="min-w-0 flex-1 truncate text-left font-semibold text-[var(--color-text-secondary)]"
            type="button"
            data-testid={`media-folder-name-${folder.id}`}
            onDoubleClick={() => setEditing(true)}
          >
            {folder.name}
          </button>
        )}
        <span className="text-[var(--color-text-muted)]">{folderMedia.length}</span>
        <button
          className="rounded p-1 hover:bg-[var(--color-bg-secondary)] disabled:opacity-40"
          type="button"
          title={zhCN.mediaBin.newSubfolder}
          data-testid={`media-folder-add-child-${folder.id}`}
          disabled={!canNest}
          onClick={() => onCreateFolder(folder.id)}
        >
          <FolderPlus size={13} />
        </button>
        <button
          className="rounded p-1 text-rose-600 hover:bg-[var(--color-bg-secondary)]"
          type="button"
          title={zhCN.common.delete}
          data-testid={`media-folder-delete-${folder.id}`}
          onClick={() => onDeleteFolder(folder.id)}
        >
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
              mediaContentAnalysis={mediaContentAnalysis}
              gridSize={gridSize}
              projectFrameRate={projectFrameRate}
              onCreateFolder={onCreateFolder}
              onRenameFolder={onRenameFolder}
              onDeleteFolder={onDeleteFolder}
              onSetFolderCollapsed={onSetFolderCollapsed}
              onMoveMediaToFolder={onMoveMediaToFolder}
              onAddToTimeline={onAddToTimeline}
              onAddVersion={onAddVersion}
              onCompareVersions={onCompareVersions}
              onRelink={onRelink}
              onGenerateProxy={onGenerateProxy}
              onConvertToCfr={onConvertToCfr}
              onSetLabel={onSetLabel}
              onSetRating={onSetRating}
              onSetFlag={onSetFlag}
              onBatchTranscode={onBatchTranscode}
              onExportGif={onExportGif}
              onAnalyzeSpectrum={onAnalyzeSpectrum}
              onShowInfo={onShowInfo}
              onFindSources={onFindSources}
              selectedMediaIds={selectedMediaIds}
              onToggleSelected={onToggleSelected}
              onOpenBatchMetadata={onOpenBatchMetadata}
              onOpenBatchRename={onOpenBatchRename}
              mediaHighlights={mediaHighlights}
            />
          ))}
          <MediaCardGrid
            media={folderMedia}
            mediaMetadata={mediaMetadata}
            mediaContentAnalysis={mediaContentAnalysis}
            gridSize={gridSize}
            projectFrameRate={projectFrameRate}
            onAddToTimeline={onAddToTimeline}
            onAddVersion={onAddVersion}
            onCompareVersions={onCompareVersions}
            onRelink={onRelink}
            onGenerateProxy={onGenerateProxy}
            onConvertToCfr={onConvertToCfr}
            onSetLabel={onSetLabel}
            onSetRating={onSetRating}
            onSetFlag={onSetFlag}
            onBatchTranscode={onBatchTranscode}
            onExportGif={onExportGif}
            onAnalyzeSpectrum={onAnalyzeSpectrum}
            onShowInfo={onShowInfo}
            onFindSources={onFindSources}
            selectedMediaIds={selectedMediaIds}
            onToggleSelected={onToggleSelected}
            onOpenBatchMetadata={onOpenBatchMetadata}
            onOpenBatchRename={onOpenBatchRename}
            folderId={folder.id}
            mediaHighlights={mediaHighlights}
          />
        </div>
      ) : null}
    </div>
  );
}

function RootMediaDropZone({
  onMoveMediaToFolder,
}: {
  onMoveMediaToFolder(assetIds: string[], folderId?: string | null): void;
}) {
  return (
    <div
      className="rounded-md border border-dashed border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-xs font-medium text-[var(--color-text-muted)]"
      data-testid="media-folder-root-dropzone"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const assetId = event.dataTransfer.getData(MEDIA_CARD_DRAG_MIME);
        if (assetId) onMoveMediaToFolder([assetId], null);
      }}
    >
      {zhCN.mediaBin.rootFolder}
    </div>
  );
}

function MediaLibraryListView({
  media,
  settings,
  selectedAssetId,
  onSort,
  onSelectAsset,
  onAddToTimeline,
  onExportGif,
}: {
  media: MediaAsset[];
  settings: any;
  selectedAssetId?: string | null;
  onSort(sortKey: any): void;
  onSelectAsset?(assetId: string): void;
  onAddToTimeline(assetId: string): void;
  onExportGif(asset: MediaAsset): void;
}) {
  if (media.length === 0) return null;
  const columns = [
    { key: 'name', label: zhCN.mediaBin.listColumns.name, sortable: true, testId: 'media-list-sort-name' },
    { key: 'format', label: zhCN.mediaBin.listColumns.format, sortable: false, testId: 'media-list-format-header' },
    {
      key: 'resolution',
      label: zhCN.mediaBin.listColumns.resolution,
      sortable: true,
      testId: 'media-list-sort-resolution',
    },
    { key: 'codec', label: zhCN.mediaBin.listColumns.codec, sortable: true, testId: 'media-list-sort-codec' },
    {
      key: 'frameRate',
      label: zhCN.mediaBin.listColumns.frameRate,
      sortable: true,
      testId: 'media-list-sort-frameRate',
    },
    { key: 'bitRate', label: zhCN.mediaBin.listColumns.bitRate, sortable: false, testId: 'media-list-bitrate-header' },
    {
      key: 'colorProfile',
      label: zhCN.mediaBin.listColumns.colorProfile,
      sortable: false,
      testId: 'media-list-color-profile-header',
    },
    { key: 'duration', label: zhCN.mediaBin.listColumns.duration, sortable: true, testId: 'media-list-sort-duration' },
    { key: 'size', label: zhCN.mediaBin.listColumns.fileSize, sortable: true, testId: 'media-list-sort-size' },
    {
      key: 'importedAt',
      label: zhCN.mediaBin.listColumns.importedAt,
      sortable: true,
      testId: 'media-list-sort-importedAt',
    },
  ];
  return (
    <div
      className="overflow-x-auto rounded-md border border-line bg-[var(--color-bg-elevated)]"
      data-testid="media-list-view"
    >
      <table className="min-w-[1100px] w-full border-collapse text-xs">
        <thead className="bg-panel text-left text-[11px] uppercase tracking-normal text-[var(--color-text-muted)]">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className="border-b border-line px-2 py-2 font-semibold">
                {column.sortable ? (
                  <button
                    className="inline-flex items-center gap-1 hover:text-brand"
                    type="button"
                    data-testid={column.testId}
                    onClick={() => onSort(column.key)}
                  >
                    {column.label}
                    {settings.sortKey === column.key ? (
                      <span>{settings.sortDirection === 'asc' ? '↑' : '↓'}</span>
                    ) : null}
                  </button>
                ) : (
                  <span data-testid={column.testId}>{column.label}</span>
                )}
              </th>
            ))}
            <th className="border-b border-line px-2 py-2 text-right font-semibold">
              {zhCN.mediaBin.listColumns.actions}
            </th>
          </tr>
        </thead>
        <tbody>
          {media.map((asset) => (
            <tr
              key={asset.id}
              className={`border-b border-line last:border-b-0 cursor-pointer ${selectedAssetId === asset.id ? 'bg-[var(--color-bg-selected)]' : 'hover:bg-[var(--color-bg-hover)]'}`}
              data-testid={`media-list-row-${asset.id}`}
              onClick={() => onSelectAsset?.(asset.id)}
            >
              <td className="max-w-[180px] px-2 py-2">
                <div className="truncate font-semibold text-ink" title={asset.path}>
                  {asset.name}
                </div>
              </td>
              <td className="px-2 py-2 text-[var(--color-text-secondary)]">{formatMediaFormat(asset)}</td>
              <td className="px-2 py-2 text-[var(--color-text-secondary)]">{formatMediaResolution(asset)}</td>
              <td className="px-2 py-2 text-[var(--color-text-secondary)]" data-testid={`media-list-codec-${asset.id}`}>
                {asset.videoCodec ?? asset.audioCodec ?? zhCN.common.unavailable}
              </td>
              <td
                className="px-2 py-2 tabular-nums text-[var(--color-text-secondary)]"
                data-testid={`media-list-frame-rate-${asset.id}`}
              >
                {asset.frameRate ? formatFrameRateLabel(asset.frameRate) : zhCN.common.unavailable}
              </td>
              <td className="px-2 py-2 tabular-nums text-[var(--color-text-secondary)]">{zhCN.common.unavailable}</td>
              <td
                className="px-2 py-2 text-[var(--color-text-secondary)]"
                data-testid={`media-list-color-profile-${asset.id}`}
              >
                {formatMediaColorProfile(asset)}
              </td>
              <td className="px-2 py-2 tabular-nums text-[var(--color-text-secondary)]">
                {formatDuration(asset.duration)}
              </td>
              <td
                className="px-2 py-2 tabular-nums text-[var(--color-text-secondary)]"
                data-testid={`media-list-size-${asset.id}`}
              >
                {formatBytes(asset.size)}
              </td>
              <td className="px-2 py-2 tabular-nums text-[var(--color-text-secondary)]">
                {formatImportedAt(asset.importedAt)}
              </td>
              <td className="px-2 py-2">
                <div className="flex justify-end gap-1">
                  {asset.type === 'video' ? (
                    <button
                      className="rounded border border-line px-2 py-1 font-medium text-[var(--color-text-secondary)] hover:bg-panel"
                      type="button"
                      data-testid={`media-list-export-gif-${asset.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onExportGif(asset);
                      }}
                    >
                      GIF
                    </button>
                  ) : null}
                  <button
                    className="rounded border border-line bg-panel px-2 py-1 font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]"
                    type="button"
                    data-testid={`media-list-add-${asset.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddToTimeline(asset.id);
                    }}
                  >
                    {zhCN.mediaBin.add}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MediaLibraryTimelineView({
  media,
  onAddToTimeline,
  onExportGif,
}: {
  media: MediaAsset[];
  onAddToTimeline(assetId: string): void;
  onExportGif(asset: MediaAsset): void;
}) {
  if (media.length === 0) return null;
  const maxDuration = Math.max(1, ...media.map((asset) => asset.duration || 0));
  return (
    <div
      className="overflow-x-auto rounded-md border border-line bg-[var(--color-bg-elevated)] p-3"
      data-testid="media-timeline-view"
    >
      <div className="flex min-w-max items-stretch gap-2">
        {media.map((asset) => {
          const width = Math.max(90, Math.min(240, 80 + (asset.duration / maxDuration) * 160));
          return (
            <div
              key={asset.id}
              className="flex-none overflow-hidden rounded-md border border-line bg-panel"
              style={{ width }}
              data-testid={`media-timeline-item-${asset.id}`}
            >
              <div className="checkerboard relative h-20">
                {asset.thumbnail ? (
                  <img className="h-full w-full object-cover" src={asset.thumbnail} alt="" loading="lazy" />
                ) : (
                  <IconPreview type={asset.type} />
                )}
                <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                  {formatDuration(asset.duration)}
                </span>
              </div>
              <div className="space-y-1 p-2">
                <div className="truncate text-xs font-semibold text-ink" title={asset.path}>
                  {asset.name}
                </div>
                <div className="truncate text-[11px] text-[var(--color-text-muted)]">
                  {formatImportedAt(asset.importedAt)}
                </div>
                <div className="flex gap-1">
                  {asset.type === 'video' ? (
                    <button
                      className="rounded border border-line bg-[var(--color-bg-elevated)] px-1.5 py-1 text-[11px] font-medium text-[var(--color-text-secondary)] hover:bg-panel"
                      type="button"
                      data-testid={`media-timeline-export-gif-${asset.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onExportGif(asset);
                      }}
                    >
                      GIF
                    </button>
                  ) : null}
                  <button
                    className="flex-1 rounded border border-line bg-[var(--color-bg-elevated)] px-1.5 py-1 text-[11px] font-medium text-[var(--color-text-secondary)] hover:bg-panel"
                    type="button"
                    data-testid={`media-timeline-add-${asset.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddToTimeline(asset.id);
                    }}
                  >
                    {zhCN.mediaBin.add}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const GRID_COLUMN_STYLES: Record<string, CSSProperties> = {
  small: { gridTemplateColumns: 'repeat(auto-fill, minmax(118px, 1fr))' },
  medium: { gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' },
  large: { gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' },
};
const GRID_MIN_COLUMN_WIDTHS: Record<string, number> = { small: 118, medium: 170, large: 240 };
const GRID_ROW_HEIGHTS: Record<string, number> = { small: 120, medium: 170, large: 240 };

function useColumnCount(parentRef: RefObject<HTMLDivElement | null>, gridSize: string): number {
  const [columns, setColumns] = useState(1);
  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      setColumns(width > 0 ? Math.max(1, Math.floor(width / (GRID_MIN_COLUMN_WIDTHS[gridSize] ?? 170))) : 1);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [gridSize, parentRef]);
  return columns;
}

function MediaCardGrid({
  media,
  gridSize,
  mediaMetadata,
  mediaContentAnalysis,
  projectFrameRate,
  onAddToTimeline,
  onAddVersion,
  onCompareVersions,
  onRelink,
  onGenerateProxy,
  onConvertToCfr,
  onSetLabel,
  onSetRating,
  onSetFlag,
  onBatchTranscode,
  onExportGif,
  onAnalyzeSpectrum,
  onShowInfo,
  onFindSources,
  selectedMediaIds,
  onToggleSelected,
  onOpenBatchMetadata,
  onOpenBatchRename,
  folderId,
  mediaHighlights,
}: {
  media: MediaAsset[];
  gridSize: string;
  mediaMetadata: Record<string, MediaMetadata>;
  mediaContentAnalysis: Record<string, ClipContentAnalysis>;
  projectFrameRate: number;
  onAddToTimeline(assetId: string): void;
  onAddVersion(assetId: string): void;
  onCompareVersions(assetId: string): void;
  onRelink(assetId: string): void;
  onGenerateProxy(assetId: string): void;
  onConvertToCfr(assetId: string): void;
  onSetLabel(assetId: string, labelColor?: MediaLabelColor): void;
  onSetRating(assetId: string, rating: number): void;
  onSetFlag(assetId: string, flag?: MediaFlag): void;
  onBatchTranscode(paths: string[]): void;
  onExportGif(asset: MediaAsset): void;
  onAnalyzeSpectrum(asset: MediaAsset): void;
  onShowInfo(asset: MediaAsset): void;
  onFindSources(asset: MediaAsset): void;
  selectedMediaIds: Set<string>;
  onToggleSelected(assetId: string): void;
  onOpenBatchMetadata(assetId: string): void;
  onOpenBatchRename(assetId: string): void;
  folderId: string;
  mediaHighlights?: Map<string, VisualHighlightMarker[]>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const columnCount = useColumnCount(containerRef as RefObject<HTMLDivElement | null>, gridSize);
  if (media.length === 0) return null;
  return (
    <div
      ref={containerRef}
      className="grid gap-2"
      style={GRID_COLUMN_STYLES[gridSize] ?? GRID_COLUMN_STYLES.medium}
      data-testid={`media-folder-grid-${folderId}`}
      data-grid-size={gridSize}
      data-media-card-grid="true"
    >
      {media.map((asset, index) => (
        <MediaCard
          key={asset.id}
          mediaIndex={index}
          asset={asset}
          metadata={mediaMetadata[asset.id]}
          contentAnalysis={mediaContentAnalysis[asset.id]}
          projectFrameRate={projectFrameRate}
          onAdd={() => onAddToTimeline(asset.id)}
          onAddVersion={() => onAddVersion(asset.id)}
          onCompareVersions={() => onCompareVersions(asset.id)}
          onRelink={() => onRelink(asset.id)}
          onGenerateProxy={() => onGenerateProxy(asset.id)}
          onConvertToCfr={() => onConvertToCfr(asset.id)}
          onSetLabel={(labelColor) => onSetLabel(asset.id, labelColor)}
          onSetRating={(rating) => onSetRating(asset.id, rating)}
          onSetFlag={(flag) => onSetFlag(asset.id, flag)}
          onBatchTranscode={() => onBatchTranscode([asset.path])}
          onExportGif={() => onExportGif(asset)}
          onAnalyzeSpectrum={() => onAnalyzeSpectrum(asset)}
          onShowInfo={() => onShowInfo(asset)}
          onFindSources={() => onFindSources(asset)}
          selected={selectedMediaIds.has(asset.id)}
          onToggleSelected={() => onToggleSelected(asset.id)}
          batchSelectionCount={selectedMediaIds.has(asset.id) ? selectedMediaIds.size : 1}
          onOpenBatchMetadata={() => onOpenBatchMetadata(asset.id)}
          onOpenBatchRename={() => onOpenBatchRename(asset.id)}
          highlights={mediaHighlights?.get(asset.id)}
        />
      ))}
    </div>
  );
}

function VirtualMediaCardGrid({
  media,
  viewScope,
  gridSize,
  mediaMetadata,
  mediaContentAnalysis,
  projectFrameRate,
  onAddToTimeline,
  onAddVersion,
  onCompareVersions,
  onRelink,
  onGenerateProxy,
  onConvertToCfr,
  onSetLabel,
  onSetRating,
  onSetFlag,
  onBatchTranscode,
  onExportGif,
  onAnalyzeSpectrum,
  onShowInfo,
  onFindSources,
  selectedMediaIds,
  onToggleSelected,
  onOpenBatchMetadata,
  onOpenBatchRename,
  mediaHighlights,
}: {
  media: MediaAsset[];
  viewScope: SmartAlbumId | 'none';
  gridSize: string;
  mediaMetadata: Record<string, MediaMetadata>;
  mediaContentAnalysis: Record<string, ClipContentAnalysis>;
  projectFrameRate: number;
  onAddToTimeline(assetId: string): void;
  onAddVersion(assetId: string): void;
  onCompareVersions(assetId: string): void;
  onRelink(assetId: string): void;
  onGenerateProxy(assetId: string): void;
  onConvertToCfr(assetId: string): void;
  onSetLabel(assetId: string, labelColor?: MediaLabelColor): void;
  onSetRating(assetId: string, rating: number): void;
  onSetFlag(assetId: string, flag?: MediaFlag): void;
  onBatchTranscode(paths: string[]): void;
  onExportGif(asset: MediaAsset): void;
  onAnalyzeSpectrum(asset: MediaAsset): void;
  onShowInfo(asset: MediaAsset): void;
  onFindSources(asset: MediaAsset): void;
  selectedMediaIds: Set<string>;
  onToggleSelected(assetId: string): void;
  onOpenBatchMetadata(assetId: string): void;
  onOpenBatchRename(assetId: string): void;
  mediaHighlights?: Map<string, VisualHighlightMarker[]>;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const columnCount = useColumnCount(parentRef as RefObject<HTMLDivElement | null>, gridSize);
  const rowCount = Math.ceil(media.length / columnCount);
  const rowHeight = GRID_ROW_HEIGHTS[gridSize] ?? 170;
  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight + 12,
    overscan: 3,
  });
  const prevMediaLenRef = useRef(media.length);
  const prevViewScopeRef = useRef(viewScope);
  useEffect(() => {
    // 网格常驻挂载后（方案 E），scope 切换不再经由卸载/重挂载自然归零滚动位置，
    // 改由数据变化（length）或 scope 变化显式重置到顶部，不依赖生命周期副作用。
    if (media.length !== prevMediaLenRef.current || viewScope !== prevViewScopeRef.current) {
      prevMediaLenRef.current = media.length;
      prevViewScopeRef.current = viewScope;
      virtualizer.scrollToIndex(0, { align: 'start' });
    }
  }, [media.length, viewScope, virtualizer]);
  if (media.length === 0) return null;
  const virtualItems = virtualizer.getVirtualItems();
  const paddingTop = virtualItems.length > 0 ? virtualItems[0]!.start : 0;
  const paddingBottom =
    virtualItems.length > 0 ? virtualizer.getTotalSize() - virtualItems[virtualItems.length - 1]!.end : 0;
  return (
    <div
      ref={parentRef}
      className="flex-1 min-h-[240px] overflow-auto"
      data-testid="media-grid-view"
      data-grid-size={gridSize}
      data-media-card-grid="true"
    >
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${columnCount}, 1fr)`, paddingTop, paddingBottom }}
      >
        {virtualItems.map((virtualRow) => {
          const rowStart = virtualRow.index * columnCount;
          const rowItems = media.slice(rowStart, rowStart + columnCount);
          return (
            <Fragment key={virtualRow.key}>
              {rowItems.map((asset, itemIndex) => (
                <MediaCard
                  key={asset.id}
                  mediaIndex={rowStart + itemIndex}
                  asset={asset}
                  metadata={mediaMetadata[asset.id]}
                  contentAnalysis={mediaContentAnalysis[asset.id]}
                  projectFrameRate={projectFrameRate}
                  onAdd={() => onAddToTimeline(asset.id)}
                  onAddVersion={() => onAddVersion(asset.id)}
                  onCompareVersions={() => onCompareVersions(asset.id)}
                  onRelink={() => onRelink(asset.id)}
                  onGenerateProxy={() => onGenerateProxy(asset.id)}
                  onConvertToCfr={() => onConvertToCfr(asset.id)}
                  onSetLabel={(labelColor) => onSetLabel(asset.id, labelColor)}
                  onSetRating={(rating) => onSetRating(asset.id, rating)}
                  onSetFlag={(flag) => onSetFlag(asset.id, flag)}
                  onBatchTranscode={() => onBatchTranscode([asset.path])}
                  onExportGif={() => onExportGif(asset)}
                  onAnalyzeSpectrum={() => onAnalyzeSpectrum(asset)}
                  onShowInfo={() => onShowInfo(asset)}
                  onFindSources={() => onFindSources(asset)}
                  selected={selectedMediaIds.has(asset.id)}
                  onToggleSelected={() => onToggleSelected(asset.id)}
                  batchSelectionCount={selectedMediaIds.has(asset.id) ? selectedMediaIds.size : 1}
                  onOpenBatchMetadata={() => onOpenBatchMetadata(asset.id)}
                  onOpenBatchRename={() => onOpenBatchRename(asset.id)}
                  highlights={mediaHighlights?.get(asset.id)}
                />
              ))}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

function TitleTemplateGrid({ onAddTitleTemplate }: { onAddTitleTemplate(templateId: TitleTemplateId): void }) {
  return (
    <div className="grid grid-cols-1 gap-3" data-testid="title-template-grid">
      <div className="rounded-md border border-line bg-panel px-3 py-2 text-xs font-medium text-[var(--color-text-secondary)]">
        {zhCN.mediaBin.titleTemplateCount(TITLE_TEMPLATE_IDS.length)}
      </div>
      {TITLE_TEMPLATE_IDS.map((templateId) => {
        const label = zhCN.titleTemplates[templateId];
        return (
          <div
            key={templateId}
            className="rounded-md border border-line bg-[var(--color-bg-elevated)] p-3 shadow-sm"
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
                <div className="truncate text-xs text-[var(--color-text-muted)]">{label.defaultText}</div>
              </div>
            </div>
            <button
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md border border-line bg-panel px-2 py-1.5 text-sm font-medium hover:bg-[var(--color-bg-secondary)]"
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

function MediaSourcePathsDialog({
  state,
  onClose,
}: {
  state: { asset: MediaAsset; paths: string[] };
  onClose(): void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      data-testid="media-source-paths-dialog"
    >
      <div className="w-full max-w-xl overflow-hidden rounded-lg bg-[var(--color-bg-elevated)] shadow-soft">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-ink">{zhCN.mediaBin.sourcePathsTitle}</h2>
            <div className="truncate text-xs text-[var(--color-text-muted)]">{state.asset.name}</div>
          </div>
          <button
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-text-muted)] hover:bg-panel"
            type="button"
            aria-label={zhCN.common.close}
            onClick={onClose}
          >
            <X size={17} />
          </button>
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-4 text-xs">
          {state.paths.length > 0 ? (
            <ul className="space-y-2">
              {state.paths.map((path) => (
                <li
                  key={path}
                  className="rounded-md border border-line bg-panel px-2 py-1.5 font-mono text-[var(--color-text-secondary)]"
                  data-testid="media-source-path"
                >
                  {path}
                </li>
              ))}
            </ul>
          ) : (
            <div
              className="rounded-md border border-line bg-panel p-3 text-[var(--color-text-secondary)]"
              data-testid="media-source-path-empty"
            >
              {zhCN.mediaBin.sourcePathsEmpty}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatImportedAt(importedAt?: string): string {
  if (!importedAt) return zhCN.common.unavailable;
  const timestamp = Date.parse(importedAt);
  if (!Number.isFinite(timestamp)) return zhCN.common.unavailable;
  return new Date(timestamp).toLocaleDateString();
}

function getMediaFolderDepth(folders: MediaFolder[], folderId: string): number {
  let depth = 0;
  let current = folders.find((f) => f.id === folderId);
  while (current?.parentId) {
    depth++;
    current = folders.find((f) => f.id === current!.parentId);
  }
  return depth;
}

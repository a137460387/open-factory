import {
  MAX_MEDIA_FOLDER_DEPTH,
  TITLE_TEMPLATE_IDS,
  CONTENT_SCENE_TYPES,
  collectSmartAlbums,
  collectFingerprintReferences,
  DEFAULT_MEDIA_RENAME_TEMPLATE,
  filterMediaAssets,
  getMediaFolderDepth,
  isFrameRateMismatch,
  listFingerprintSourcePaths,
  getMediaVersionLabel,
  shouldGenerateProxy,
  buildMediaRenamePreview,
  type MediaAsset,
  type BatchEditableMediaMetadata,
  type ClipContentAnalysis,
  type ContentSceneType,
  type MediaFlag,
  type MediaFolder,
  type MediaLabelColor,
  type MediaMetadata,
  type MediaMetadataFilter,
  type MediaRenamePreviewItem,
  type MediaRenameRules,
  type SmartAlbumId,
  type TitleTemplateId,
  type EffectPreset,
  mapScoreToGrade,
  buildQualityAssessmentSystemPrompt,
  buildQualityAssessmentUserPrompt,
  parseQualityAssessmentResponse,
  hasAvailableTextProvider,
  type QualityAssessmentResult,
} from '@open-factory/editor-core';
import {
  createSubclip,
  parseFavoritesSearchFilter,
  type Subclip,
  type TimelineLabelColor,
} from '@open-factory/editor-core';
import { formatTimeShort } from '@open-factory/editor-core/utils/time';
import {
  AlertCircle,
  BadgeCheck,
  ChevronDown,
  ChevronRight,
  FileAudio2,
  FileImage,
  FileText,
  FileVideo2,
  Flag,
  Folder,
  FolderPlus,
  GalleryHorizontal,
  Gauge,
  Grid2X2,
  Heart,
  ImageDown,
  Import,
  Info,
  Link2,
  List,
  Loader2,
  Merge,
  Plus,
  RotateCcw,
  Scissors,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  createContext,
  Fragment,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { computeMediaPreviewDelay, isMediaPreviewable } from './media-hover-preview';
import { clsx } from 'clsx';
import { zhCN } from '../../i18n/strings';
import { isTauriRuntime } from '../../lib/tauri';
import { TITLE_TEMPLATE_DRAG_MIME } from '../../lib/titleTemplates';
import {
  analyzeMedia,
  callAiApi,
  convertLocalFileSrc,
  listenDragDrop,
  readAiApiKey,
  type MediaAnalysis,
} from '../../lib/tauri-bridge';
import { useMediaJobStore } from '../../media/media-job-store';
import { useEditorStore } from '../../store/editorStore';
import { useMediaIndexStore, hasActiveIndexFilters } from '../../store/mediaIndexStore';
import {
  DEFAULT_MEDIA_LIBRARY_VIEW_SETTINGS,
  normalizeMediaLibraryViewSettings,
  sortMediaLibraryAssets,
  type MediaLibraryGridSize,
  type MediaLibrarySortKey,
  type MediaLibraryViewMode,
  type MediaLibraryViewSettings,
} from '../../media/mediaLibraryView';
import { readViewSettings, saveViewSettings } from '../../settings/appSettings';
import type { SharedLibraryResource } from '../../shared-library/sharedLibrary';
import { useProxySettingsStore } from '../../store/proxySettingsStore';
import { useAISettingsStore } from '../../store/aiSettingsStore';
import { loadLocalEffectPresets } from '../../effects/effect-preset-library';
import { getMediaKeyboardNavigationIndex } from './media-keyboard';
import { MediaAIAnalysisDialog } from './MediaAIAnalysisDialog';
import { AISemanticSearchPanel } from './AISemanticSearchPanel';
import { AIMediaOrganizePanel } from './AIMediaOrganizePanel';
import { AdvancedSearchPanel } from './AdvancedSearchPanel';
import { MediaMetadataPanel } from './MediaMetadataPanel';
import type { MediaCollection } from '@open-factory/editor-core';
import { MediaCard } from './MediaCard';
import { BatchMetadataDialog, BatchRenameDialog } from './BatchDialogs';
import { MediaFolderTree } from './MediaFolderTree';
import { MediaInfoDialog, MediaSourcePathsDialog, type MediaInfoState, type MediaSourcePathsState } from './MediaInfoDialog';
import { SubclipDialog } from './SubclipDialog';
import {
  MEDIA_CARD_DRAG_MIME,
  SUBCLIP_DRAG_MIME,
  MEDIA_LABEL_COLORS,
  MEDIA_LABEL_COLOR_STYLES,
  formatFrameRateLabel,
  formatMediaFormat,
  formatMediaResolution,
  formatMediaColorProfile,
  formatBytes,
  formatImportedAt,
} from './media-bin-utils';

export interface MediaCardExtras {
  favoriteIds: Set<string>;
  onToggleFavorite(assetId: string): void;
  onRevealInTimeline(assetId: string): void;
  pinnedIds: Set<string>;
  onPinToSession(assetId: string): void;
  onAnalyzeAI(assetId: string): void;
  qualityResults: Map<string, QualityAssessmentResult>;
  qualityErrors: Map<string, string>;
  qualityLoading: Set<string>;
  onQualityAssess(assetId: string): void;
  onBatchQualityScan(): void;
}
export const MediaCardExtrasCtx = createContext<MediaCardExtras | null>(null);

export interface MediaGridNavCtxValue {
  columnCount: number;
  mediaCount: number;
  scrollToMediaIndex(index: number): void;
  pendingFocusRef: { current: number | null };
}
export const MediaGridNavCtx = createContext<MediaGridNavCtxValue | null>(null);

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

type MediaBinView = 'all' | 'video' | 'audio' | 'image' | 'tagged' | 'titles' | 'shared' | 'effects';
type QuickMediaFilter = Extract<MediaMetadataFilter, 'all' | 'selected' | 'five-star'>;
export const MEDIA_CARD_DRAG_MIME = 'application/x-open-factory-media-id';
export const SUBCLIP_DRAG_MIME = 'application/x-open-factory-subclip';

export interface SubclipContextValue {
  subclips: Subclip[];
  onAddSubclip(subclip: Subclip): void;
  onUpdateSubclip(subclipId: string, patch: Partial<Subclip>): void;
  onDeleteSubclip(subclipId: string): void;
  onAddSubclipToTimeline(assetId: string, subclip: Subclip): void;
  onOpenSubclipDialog(assetId: string, editingSubclipId?: string): void;
  expandedSubclipAssetIds: Set<string>;
  onToggleSubclipExpanded(assetId: string): void;
}
export const SubclipCtx = createContext<SubclipContextValue | null>(null);

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
  const projectPath = useEditorStore((s) => s.projectPath);
  const searchResults = useMediaIndexStore((s) => s.searchResults);
  const searchQuery = useMediaIndexStore((s) => s.searchQuery);
  const indexFilterActive = hasActiveIndexFilters(searchQuery) && searchResults !== null;
  const indexResultIds = useMemo(
    () => (indexFilterActive ? new Set(searchResults!.assets.map((a) => a.id)) : null),
    [indexFilterActive, searchResults],
  );
  const [dragOver, setDragOver] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<MediaBinView>('all');
  const [quickFilter, setQuickFilter] = useState<QuickMediaFilter>('all');
  const [sceneFilter, setSceneFilter] = useState<ContentSceneType | 'all'>('all');
  const [smartAlbumId, setSmartAlbumId] = useState<SmartAlbumId | 'none'>('none');
  const [mediaLibraryView, setMediaLibraryView] = useState<MediaLibraryViewSettings>(
    DEFAULT_MEDIA_LIBRARY_VIEW_SETTINGS,
  );
  const [mediaInfo, setMediaInfo] = useState<MediaInfoState>();
  const [sourcePaths, setSourcePaths] = useState<MediaSourcePathsState>();
  const [effectPresets, setEffectPresets] = useState<EffectPreset[]>([]);
  const [effectPresetsLoading, setEffectPresetsLoading] = useState(false);
  const [effectPresetsError, setEffectPresetsError] = useState<string>();
  const [selectedMediaIds, setSelectedMediaIds] = useState<Set<string>>(() => new Set());
  const [batchMetadataAssetIds, setBatchMetadataAssetIds] = useState<string[]>();
  const [batchRenameAssetIds, setBatchRenameAssetIds] = useState<string[]>();
  const [detailsAssetId, setDetailsAssetId] = useState<string | null>(null);
  const detailsAsset = useMemo(
    () => (detailsAssetId ? (media.find((a) => a.id === detailsAssetId) ?? null) : null),
    [detailsAssetId, media],
  );
  const [subclipDialogAssetId, setSubclipDialogAssetId] = useState<string>();
  const [editingSubclipId, setEditingSubclipId] = useState<string>();
  const [expandedSubclipAssetIds, setExpandedSubclipAssetIds] = useState<Set<string>>(() => new Set());
  const [aiAnalysisAsset, setAiAnalysisAsset] = useState<MediaAsset>();
  const [qualityResults, setQualityResults] = useState<Map<string, QualityAssessmentResult>>(new Map());
  const [qualityErrors, setQualityErrors] = useState<Map<string, string>>(new Map());
  const [qualityLoading, setQualityLoading] = useState<Set<string>>(new Set());
  const [aiSearchMode, setAiSearchMode] = useState(false);
  const [organizePanelOpen, setOrganizePanelOpen] = useState(false);
  const handleOpenSubclipDialog = (assetId: string, editingId?: string) => {
    setSubclipDialogAssetId(assetId);
    setEditingSubclipId(editingId);
  };
  const handleToggleSubclipExpanded = (assetId: string) => {
    setExpandedSubclipAssetIds((prev) => {
      const next = new Set(prev);
      if (next.has(assetId)) next.delete(assetId);
      else next.add(assetId);
      return next;
    });
  };
  const missingCount = media.filter((asset) => asset.missing).length;
  const _effectivePinnedIds = pinnedIds ?? new Set<string>();
  const smartAlbums = collectSmartAlbums(media, Date.now(), mediaMetadata, {
    favoriteIds,
    recentUseIds: recentMediaIds,
  });
  const smartAlbumIds =
    smartAlbumId === 'none'
      ? undefined
      : new Set(smartAlbums.find((album) => album.id === smartAlbumId)?.assetIds ?? []);
  const metadataFilter: MediaMetadataFilter = filter === 'tagged' ? 'tagged' : quickFilter;
  const _parsedSearch = parseFavoritesSearchFilter(search);
  const _searchQuery = _parsedSearch.cleanQuery;
  const _searchFilterSet =
    _parsedSearch.filter === 'favorites'
      ? new Set(favoriteIds)
      : _parsedSearch.filter === 'recent'
        ? new Set(recentMediaIds)
        : undefined;
  const visibleMedia =
    filter === 'titles' || filter === 'shared' || filter === 'effects'
      ? []
      : filterMediaAssets(media, {
          query: _searchQuery,
          filter: filter === 'tagged' ? 'all' : filter,
          metadataFilter,
          metadata: mediaMetadata,
        })
          .filter((asset) => sceneFilter === 'all' || mediaContentAnalysis[asset.id]?.sceneTypes.includes(sceneFilter))
          .filter((asset) => !smartAlbumIds || smartAlbumIds.has(asset.id))
          .filter((asset) => !_searchFilterSet || _searchFilterSet.has(asset.id))
          .filter((asset) => !indexResultIds || indexResultIds.has(asset.id));
  const sortedVisibleMedia = useMemo(() => {
    const sorted = sortMediaLibraryAssets(visibleMedia, mediaLibraryView);
    if (_effectivePinnedIds.size === 0) return sorted;
    const pinned = sorted.filter((a) => _effectivePinnedIds.has(a.id));
    const rest = sorted.filter((a) => !_effectivePinnedIds.has(a.id));
    return [...pinned, ...rest];
  }, [visibleMedia, mediaLibraryView, _effectivePinnedIds]);
  const importedTimelineMedia = useMemo(
    () => sortMediaLibraryAssets(visibleMedia, { sortKey: 'importedAt', sortDirection: 'asc' }),
    [visibleMedia],
  );
  const jobs = useMediaJobStore((state) => state.jobs);
  const runnerActive = useMediaJobStore((state) => state.runnerActive);
  const clearFinishedJobs = useMediaJobStore((state) => state.clearFinishedJobs);
  const runningJob = jobs.find((job) => job.status === 'running');
  const pendingCount = jobs.filter((job) => job.status === 'pending').length;
  const failedCount = jobs.filter((job) => job.status === 'error').length;
  const selectedVideoIds = useMemo(
    () => media.filter((asset) => asset.type === 'video' && selectedMediaIds.has(asset.id)).map((asset) => asset.id),
    [media, selectedMediaIds],
  );
  const batchMetadataAssets = useMemo(
    () => getMediaAssetsByIdOrder(media, batchMetadataAssetIds),
    [media, batchMetadataAssetIds],
  );
  const batchRenameAssets = useMemo(
    () => getMediaAssetsByIdOrder(media, batchRenameAssetIds),
    [media, batchRenameAssetIds],
  );

  const toggleSelectedMedia = (assetId: string) => {
    setSelectedMediaIds((current) => {
      const next = new Set(current);
      if (next.has(assetId)) {
        next.delete(assetId);
      } else {
        next.add(assetId);
      }
      return next;
    });
  };

  const resolveBatchAssetIds = (assetId: string) => {
    if (!selectedMediaIds.has(assetId)) {
      return [assetId];
    }
    return media.filter((asset) => selectedMediaIds.has(asset.id)).map((asset) => asset.id);
  };

  const openBatchMetadataEditor = (assetId: string) => {
    const assetIds = resolveBatchAssetIds(assetId);
    if (assetIds.length > 1) {
      setBatchMetadataAssetIds(assetIds);
    }
  };

  const openBatchRenameEditor = (assetId: string) => {
    const assetIds = resolveBatchAssetIds(assetId);
    if (assetIds.length > 1) {
      setBatchRenameAssetIds(assetIds);
    }
  };

  const updateMediaLibraryView = (patch: Partial<MediaLibraryViewSettings>) => {
    setMediaLibraryView((current) => {
      const next = normalizeMediaLibraryViewSettings({ ...current, ...patch });
      void saveViewSettings({ mediaLibrary: next }).catch((error) => {
        console.warn('Unable to save media library view settings', error);
      });
      return next;
    });
  };

  const refreshEffectPresetList = async () => {
    setEffectPresetsLoading(true);
    setEffectPresetsError(undefined);
    try {
      setEffectPresets(await loadLocalEffectPresets());
    } catch (error) {
      setEffectPresets([]);
      setEffectPresetsError(error instanceof Error ? error.message : t.effectPresets.loadFailedMessage);
    } finally {
      setEffectPresetsLoading(false);
    }
  };

  const openMediaInfo = async (asset: MediaAsset) => {
    setMediaInfo({ asset, loading: true });
    try {
      const analysis = await analyzeMedia(asset.path);
      setMediaInfo({ asset, loading: false, analysis });
    } catch (error) {
      setMediaInfo({
        asset,
        loading: false,
        error: error instanceof Error ? error.message : t.mediaInfo.failedMessage,
      });
    }
  };

  const findSourcePaths = (asset: MediaAsset) => {
    const references = collectFingerprintReferences(media, mediaMetadata);
    const paths = listFingerprintSourcePaths(mediaMetadata[asset.id]?.fingerprint, references);
    setSourcePaths({ asset, paths });
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

  useEffect(() => {
    let canceled = false;
    void readViewSettings()
      .then((view) => {
        if (!canceled) {
          setMediaLibraryView(view.mediaLibrary);
        }
      })
      .catch((error) => {
        console.warn('Unable to load media library view settings', error);
      });
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    const validIds = new Set(media.map((asset) => asset.id));
    setSelectedMediaIds((current) => {
      const next = new Set(Array.from(current).filter((id) => validIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [media]);

  useEffect(() => {
    if (filter === 'effects') {
      void refreshEffectPresetList();
    }
  }, [filter]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        !(event.ctrlKey || event.metaKey) ||
        event.shiftKey ||
        event.altKey ||
        isEditableKeyboardTarget(event.target)
      ) {
        return;
      }
      const mode = event.key === '1' ? 'grid' : event.key === '2' ? 'list' : event.key === '3' ? 'timeline' : undefined;
      if (!mode) {
        return;
      }
      event.preventDefault();
      updateMediaLibraryView({ mode });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleQualityAssess = async (assetId: string) => {
    const asset = media.find((a) => a.id === assetId);
    if (!asset) return;
    const providers = useAISettingsStore.getState().providers;
    if (!hasAvailableTextProvider(providers)) return;
    setQualityLoading((prev) => new Set(prev).add(assetId));
    setQualityErrors((prev) => {
      const next = new Map(prev);
      next.delete(assetId);
      return next;
    });
    try {
      const selectedProvider = providers.find((p) => p.enabled && hasAvailableTextProvider([p])) ?? providers[0];
      const apiKey = await readAiApiKey(selectedProvider.id);
      const response = await callAiApi(
        {
          providerId: selectedProvider.id,
          baseUrl: selectedProvider.baseUrl,
          model: selectedProvider.defaultModel,
          messages: [
            { role: 'system', content: buildQualityAssessmentSystemPrompt() },
            {
              role: 'user',
              content: buildQualityAssessmentUserPrompt({
                name: asset.name,
                type: asset.type,
                width: asset.width,
                height: asset.height,
                duration: asset.duration,
                hasAudio: asset.hasAudio,
              }),
            },
          ],
          temperature: 0.3,
          timeoutSecs: 30,
        },
        apiKey,
      );
      const result = parseQualityAssessmentResponse(JSON.parse(response.content));
      setQualityResults((prev) => new Map(prev).set(assetId, result));
    } catch {
      setQualityErrors((prev) => new Map(prev).set(assetId, zhCN.mediaBin.aiQualityAssessment.failedMessage));
    } finally {
      setQualityLoading((prev) => {
        const next = new Set(prev);
        next.delete(assetId);
        return next;
      });
    }
  };

  const handleBatchQualityScan = () => {
    for (const asset of media) {
      if (!qualityResults.has(asset.id) && !qualityLoading.has(asset.id)) {
        handleQualityAssess(asset.id);
      }
    }
  };

  const _extrasValue: MediaCardExtras = {
    favoriteIds: new Set(favoriteIds),
    onToggleFavorite,
    onRevealInTimeline,
    pinnedIds: _effectivePinnedIds,
    onPinToSession,
    onAnalyzeAI: (assetId) => {
      const found = media.find((a) => a.id === assetId);
      if (found) setAiAnalysisAsset(found);
    },
    qualityResults,
    qualityErrors,
    qualityLoading,
    onQualityAssess: handleQualityAssess,
    onBatchQualityScan: handleBatchQualityScan,
  };

  return (
    <SubclipCtx.Provider
      value={{
        subclips,
        onAddSubclip,
        onUpdateSubclip,
        onDeleteSubclip,
        onAddSubclipToTimeline,
        onOpenSubclipDialog: handleOpenSubclipDialog,
        expandedSubclipAssetIds,
        onToggleSubclipExpanded: handleToggleSubclipExpanded,
      }}
    >
      <MediaCardExtrasCtx.Provider value={_extrasValue}>
        <aside
          className={clsx('flex h-full min-h-0 flex-col bg-panel', dragOver && 'ring-2 ring-inset ring-brand')}
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
              <div className="text-xs text-[var(--color-text-muted)]">{t.itemCount(media.length)}</div>
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
                <ImageDown size={15} />
                {t.batchGenerateCovers}
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-md border border-line bg-panel px-2 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => onGenerateThumbnails(selectedVideoIds)}
                disabled={selectedVideoIds.length === 0}
                data-testid="batch-generate-thumbnails-button"
              >
                <ImageDown size={15} />
                {t.batchGenerateThumbnails(selectedVideoIds.length)}
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
            <div className="mb-3 space-y-1.5">
              <label className="relative block">
                <span className="sr-only">{t.searchPlaceholder}</span>
                <Search
                  className="pointer-events-none absolute left-2 top-2.5 text-[var(--color-text-muted)]"
                  size={15}
                />
                <input
                  className={clsx(
                    'w-full rounded-lg border bg-[var(--color-bg-elevated)] py-2 pl-8 pr-14 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]',
                    aiSearchMode ? 'border-brand' : 'border-line',
                  )}
                  value={search}
                  placeholder={aiSearchMode ? t.aiSemanticSearch.searchPlaceholder : t.searchPlaceholder}
                  data-testid="media-search-input"
                  onChange={(event) => setSearch(event.target.value)}
                />
                <button
                  type="button"
                  className={clsx(
                    'absolute right-1 top-1 rounded-md px-1.5 py-1 text-xs font-semibold',
                    aiSearchMode
                      ? 'bg-brand text-white'
                      : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] hover:bg-panel',
                  )}
                  onClick={() => setAiSearchMode(!aiSearchMode)}
                  data-testid="ai-search-toggle"
                  title={t.aiSemanticSearch.toggleLabel}
                >
                  <Sparkles size={14} />
                </button>
              </label>
              <AdvancedSearchPanel projectPath={projectPath || ''} className="mb-1" />
              {aiSearchMode && (
                <AISemanticSearchPanel
                  media={media}
                  onSelectMedia={(id) => {
                    setAiSearchMode(false);
                    setSearch('');
                  }}
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
                          if (item === 'all') {
                            setFilter('all');
                          } else if (filter === 'tagged' || filter === 'titles' || filter === 'shared') {
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
                  <div className="grid grid-cols-7 gap-1" data-testid="media-type-filter-bar">
                    {(['video', 'audio', 'image', 'tagged', 'titles', 'shared', 'effects'] as MediaBinView[]).map(
                      (item) => (
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
                            setFilter(item);
                            if (item === 'tagged' || item === 'titles' || item === 'shared' || item === 'effects') {
                              setQuickFilter('all');
                            }
                            setSmartAlbumId('none');
                          }}
                        >
                          {t.filters[item]}
                        </button>
                      ),
                    )}
                  </div>
                  <label className="block text-[11px] font-medium text-[var(--color-text-secondary)]">
                    {zhCN.contentAnalysis.sceneFilter}
                    <select
                      className="mt-1 h-8 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 text-xs text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
                      value={sceneFilter}
                      data-testid="media-scene-filter-select"
                      onChange={(event) => setSceneFilter(event.target.value as ContentSceneType | 'all')}
                    >
                      <option value="all">{zhCN.contentAnalysis.sceneFilterAll}</option>
                      {CONTENT_SCENE_TYPES.map((sceneType) => (
                        <option key={sceneType} value={sceneType}>
                          {zhCN.contentAnalysis.sceneTypeLabels[sceneType]}
                        </option>
                      ))}
                    </select>
                  </label>
                  {filter !== 'titles' && filter !== 'shared' && filter !== 'effects' ? (
                    <SmartAlbumBar albums={smartAlbums} activeId={smartAlbumId} onSelect={setSmartAlbumId} />
                  ) : null}
                  {media.length > 20 && !aiSearchMode && (
                    <div className="flex items-center gap-2" data-testid="media-organize-section">
                      {organizePanelOpen ? null : (
                        <button
                          type="button"
                          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-brand/30 bg-brand/5 px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand/10"
                          onClick={() => setOrganizePanelOpen(true)}
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
                          onClose={() => setOrganizePanelOpen(false)}
                        />
                      )}
                    </div>
                  )}
                  {filter !== 'titles' && filter !== 'shared' && filter !== 'effects' ? (
                    <MediaLibraryViewToolbar settings={mediaLibraryView} onChange={updateMediaLibraryView} />
                  ) : null}
                </>
              )}
            </div>
            {filter !== 'titles' && filter !== 'shared' && filter !== 'effects' && jobs.length > 0 ? (
              <div className="mb-3 rounded-md border border-line bg-panel p-2 text-xs" data-testid="media-job-queue">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-[var(--color-text-secondary)]">{t.mediaJobs}</div>
                    <div className="truncate text-[var(--color-text-muted)]">
                      {runningJob
                        ? `${t.jobType[runningJob.type]} · ${runningJob.assetName}`
                        : runnerActive
                          ? t.preparingQueue
                          : zhCN.common.idle}{' '}
                      · {t.pendingCount(pendingCount)}
                      {failedCount > 0 ? ` · ${t.failedCount(failedCount)}` : ''}
                    </div>
                  </div>
                  <button
                    className="rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1 text-[11px] font-medium hover:bg-[var(--color-bg-secondary)]"
                    onClick={clearFinishedJobs}
                  >
                    {zhCN.common.clear}
                  </button>
                </div>
              </div>
            ) : null}
            {filter === 'shared' ? (
              <SharedLibraryGrid resources={sharedLibraryResources} />
            ) : filter === 'titles' ? (
              <TitleTemplateGrid onAddTitleTemplate={onAddTitleTemplate} />
            ) : filter === 'effects' ? (
              <EffectPresetGrid
                presets={effectPresets}
                loading={effectPresetsLoading}
                error={effectPresetsError}
                selectedClipId={selectedClipId}
                onApply={onApplyEffectPreset}
                onRefresh={() => void refreshEffectPresetList()}
              />
            ) : media.length === 0 ? (
              <button
                className="flex h-full min-h-[220px] w-full flex-col items-center justify-center rounded-md border border-dashed border-slate-300 bg-panel p-6 text-center text-sm text-[var(--color-text-secondary)]"
                onClick={onImport}
              >
                <Import className="mb-3 text-[var(--color-text-muted)]" size={30} />
                {t.emptyDrop}
              </button>
            ) : mediaLibraryView.mode === 'list' ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <MediaLibraryListView
                  media={sortedVisibleMedia}
                  settings={mediaLibraryView}
                  selectedAssetId={detailsAssetId}
                  onSort={(sortKey) =>
                    updateMediaLibraryView({
                      sortKey,
                      sortDirection:
                        mediaLibraryView.sortKey === sortKey && mediaLibraryView.sortDirection === 'asc'
                          ? 'desc'
                          : 'asc',
                    })
                  }
                  onAddToTimeline={onAddToTimeline}
                  onExportGif={onExportGif}
                  onSelectAsset={(assetId) => setDetailsAssetId((prev) => (prev === assetId ? null : assetId))}
                />
                <div
                  className="mt-2 flex-shrink-0 overflow-hidden rounded-md border border-line bg-[var(--color-bg-elevated)]"
                  style={{ maxHeight: detailsAsset ? '260px' : '0px', transition: 'max-height 0.2s ease' }}
                >
                  <MediaMetadataPanel asset={detailsAsset} />
                </div>
              </div>
            ) : mediaLibraryView.mode === 'timeline' ? (
              <MediaLibraryTimelineView
                media={importedTimelineMedia}
                onAddToTimeline={onAddToTimeline}
                onExportGif={onExportGif}
              />
            ) : smartAlbumId !== 'none' ? (
              <div className="flex min-h-full flex-col">
                <VirtualMediaCardGrid
                  media={sortedVisibleMedia}
                  gridSize={mediaLibraryView.gridSize}
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
                  onShowInfo={(asset) => void openMediaInfo(asset)}
                  onFindSources={findSourcePaths}
                  selectedMediaIds={selectedMediaIds}
                  onToggleSelected={toggleSelectedMedia}
                  onOpenBatchMetadata={openBatchMetadataEditor}
                  onOpenBatchRename={openBatchRenameEditor}
                />
              </div>
            ) : (
              <div className="flex min-h-full flex-col gap-3">
                <MediaFolderTree
                  folders={mediaFolders}
                  media={sortedVisibleMedia}
                  mediaMetadata={mediaMetadata}
                  mediaContentAnalysis={mediaContentAnalysis}
                  gridSize={mediaLibraryView.gridSize}
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
                  onShowInfo={(asset) => void openMediaInfo(asset)}
                  onFindSources={findSourcePaths}
                  selectedMediaIds={selectedMediaIds}
                  onToggleSelected={toggleSelectedMedia}
                  onOpenBatchMetadata={openBatchMetadataEditor}
                  onOpenBatchRename={openBatchRenameEditor}
                />
                <RootMediaDropZone onMoveMediaToFolder={onMoveMediaToFolder} />
                <VirtualMediaCardGrid
                  media={sortedVisibleMedia.filter((asset) => !asset.folderId)}
                  gridSize={mediaLibraryView.gridSize}
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
                  onShowInfo={(asset) => void openMediaInfo(asset)}
                  onFindSources={findSourcePaths}
                  selectedMediaIds={selectedMediaIds}
                  onToggleSelected={toggleSelectedMedia}
                  onOpenBatchMetadata={openBatchMetadataEditor}
                  onOpenBatchRename={openBatchRenameEditor}
                />
              </div>
            )}
          </div>
          {aiAnalysisAsset ? (
            <MediaAIAnalysisDialog asset={aiAnalysisAsset} onClose={() => setAiAnalysisAsset(undefined)} />
          ) : null}
          {mediaInfo ? <MediaInfoDialog state={mediaInfo} onClose={() => setMediaInfo(undefined)} /> : null}
          {sourcePaths ? (
            <MediaSourcePathsDialog state={sourcePaths} onClose={() => setSourcePaths(undefined)} />
          ) : null}
          {batchMetadataAssets.length > 0 ? (
            <BatchMetadataDialog
              assets={batchMetadataAssets}
              onClose={() => setBatchMetadataAssetIds(undefined)}
              onSubmit={(metadata) => {
                onBatchUpdateMetadata(
                  batchMetadataAssets.map((asset) => asset.id),
                  metadata,
                );
                setBatchMetadataAssetIds(undefined);
              }}
            />
          ) : null}
          {batchRenameAssets.length > 0 ? (
            <BatchRenameDialog
              assets={batchRenameAssets}
              allAssets={media}
              onClose={() => setBatchRenameAssetIds(undefined)}
              onConfirm={(preview, renameFiles) => {
                void Promise.resolve(
                  onBatchRenameMedia(
                    batchRenameAssets.map((asset) => asset.id),
                    preview,
                    renameFiles,
                  ),
                ).finally(() => setBatchRenameAssetIds(undefined));
              }}
            />
          ) : null}
          {subclipDialogAssetId ? (
            <SubclipDialog
              asset={media.find((a) => a.id === subclipDialogAssetId)!}
              editingSubclip={editingSubclipId ? subclips.find((s) => s.id === editingSubclipId) : undefined}
              onAddSubclip={onAddSubclip}
              onUpdateSubclip={onUpdateSubclip}
              onClose={() => {
                setSubclipDialogAssetId(undefined);
                setEditingSubclipId(undefined);
              }}
            />
          ) : null}
        </aside>
      </MediaCardExtrasCtx.Provider>
    </SubclipCtx.Provider>
  );
}

function getMediaAssetsByIdOrder(media: MediaAsset[], assetIds: string[] | undefined): MediaAsset[] {
  if (!assetIds?.length) {
    return [];
  }
  const byId = new Map(media.map((asset) => [asset.id, asset]));
  return assetIds.map((assetId) => byId.get(assetId)).filter((asset): asset is MediaAsset => Boolean(asset));
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

function MediaLibraryViewToolbar({
  settings,
  onChange,
}: {
  settings: MediaLibraryViewSettings;
  onChange(patch: Partial<MediaLibraryViewSettings>): void;
}) {
  const viewModes: Array<{ mode: MediaLibraryViewMode; icon: ReactNode; label: string; testId: string }> = [
    { mode: 'grid', icon: <Grid2X2 size={14} />, label: zhCN.mediaBin.viewModes.grid, testId: 'media-view-grid' },
    { mode: 'list', icon: <List size={14} />, label: zhCN.mediaBin.viewModes.list, testId: 'media-view-list' },
    {
      mode: 'timeline',
      icon: <GalleryHorizontal size={14} />,
      label: zhCN.mediaBin.viewModes.timeline,
      testId: 'media-view-timeline',
    },
  ];
  return (
    <div className="space-y-2 rounded-md border border-line bg-panel p-2" data-testid="media-view-toolbar">
      <div className="grid grid-cols-3 gap-1" role="group" aria-label={zhCN.mediaBin.viewMode}>
        {viewModes.map((item) => (
          <button
            key={item.mode}
            className={clsx(
              'inline-flex items-center justify-center gap-1 rounded-md border px-1.5 py-1 text-xs font-semibold',
              settings.mode === item.mode
                ? 'border-brand bg-[var(--color-bg-elevated)] text-brand'
                : 'border-line bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]',
            )}
            type="button"
            title={item.label}
            aria-label={item.label}
            aria-pressed={settings.mode === item.mode}
            data-testid={item.testId}
            onClick={() => onChange({ mode: item.mode })}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-[11px] font-medium text-[var(--color-text-secondary)]">
          {zhCN.mediaBin.sortBy}
          <select
            className="mt-1 h-8 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 text-xs text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
            value={settings.sortKey}
            data-testid="media-sort-key-select"
            onChange={(event) => onChange({ sortKey: event.target.value as MediaLibrarySortKey })}
          >
            {(['importedAt', 'name', 'duration', 'size', 'frameRate', 'codec'] as MediaLibrarySortKey[]).map((key) => (
              <option key={key} value={key}>
                {zhCN.mediaBin.sortKeys[key]}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-[1fr_auto] gap-1">
          <label className="block text-[11px] font-medium text-[var(--color-text-secondary)]">
            {zhCN.mediaBin.gridSize}
            <select
              className="mt-1 h-8 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 text-xs text-ink disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
              value={settings.gridSize}
              disabled={settings.mode !== 'grid'}
              data-testid="media-grid-size-select"
              onChange={(event) => onChange({ gridSize: event.target.value as MediaLibraryGridSize })}
            >
              {(['small', 'medium', 'large'] as MediaLibraryGridSize[]).map((size) => (
                <option key={size} value={size}>
                  {zhCN.mediaBin.gridSizes[size]}
                </option>
              ))}
            </select>
          </label>
          <button
            className="mt-5 h-8 rounded border border-line bg-[var(--color-bg-elevated)] px-2 text-xs font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]"
            type="button"
            data-testid="media-sort-direction-button"
            onClick={() => onChange({ sortDirection: settings.sortDirection === 'asc' ? 'desc' : 'asc' })}
          >
            {settings.sortDirection === 'asc' ? zhCN.mediaBin.sortAscending : zhCN.mediaBin.sortDescending}
          </button>
        </div>
      </div>
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
        if (assetId) {
          onMoveMediaToFolder([assetId], null);
        }
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
  settings: MediaLibraryViewSettings;
  selectedAssetId?: string | null;
  onSort(sortKey: MediaLibrarySortKey): void;
  onSelectAsset?(assetId: string): void;
  onAddToTimeline(assetId: string): void;
  onExportGif(asset: MediaAsset): void;
}) {
  if (media.length === 0) {
    return null;
  }
  const columns: Array<{
    key: MediaLibrarySortKey | 'format' | 'resolution' | 'colorProfile' | 'bitRate';
    label: string;
    sortable: boolean;
    testId: string;
  }> = [
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
                    onClick={() => onSort(column.key as MediaLibrarySortKey)}
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
                {formatTimeShort(asset.duration)}
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
  if (media.length === 0) {
    return null;
  }
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
                  {formatTimeShort(asset.duration)}
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

const GRID_COLUMN_STYLES: Record<MediaLibraryGridSize, CSSProperties> = {
  small: { gridTemplateColumns: 'repeat(auto-fill, minmax(118px, 1fr))' },
  medium: { gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' },
  large: { gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' },
};

const GRID_MIN_COLUMN_WIDTHS: Record<MediaLibraryGridSize, number> = {
  small: 118,
  medium: 170,
  large: 240,
};

const GRID_ROW_HEIGHTS: Record<MediaLibraryGridSize, number> = {
  small: 120,
  medium: 170,
  large: 240,
};

function useColumnCount(parentRef: RefObject<HTMLDivElement | null>, gridSize: MediaLibraryGridSize): number {
  const [columns, setColumns] = useState(1);
  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      setColumns(width > 0 ? Math.max(1, Math.floor(width / GRID_MIN_COLUMN_WIDTHS[gridSize])) : 1);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [gridSize, parentRef]);
  return columns;
}

function estimateCardRowHeight(gridSize: MediaLibraryGridSize): number {
  return GRID_ROW_HEIGHTS[gridSize];
}

export function MediaCardGrid({
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
}: {
  media: MediaAsset[];
  gridSize: MediaLibraryGridSize;
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
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const columnCount = useColumnCount(containerRef as RefObject<HTMLDivElement | null>, gridSize);
  const pendingFocusRef = useRef<number | null>(null);

  if (media.length === 0) {
    return null;
  }
  return (
    <MediaGridNavCtx.Provider
      value={{
        columnCount,
        mediaCount: media.length,
        scrollToMediaIndex: (idx) => {
          const el = document.querySelector<HTMLElement>(`[data-media-index="${idx}"]`);
          el?.scrollIntoView({ block: 'nearest' });
        },
        pendingFocusRef,
      }}
    >
      <div
        ref={containerRef}
        className="grid gap-2"
        style={GRID_COLUMN_STYLES[gridSize]}
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
          />
        ))}
      </div>
    </MediaGridNavCtx.Provider>
  );
}

function VirtualMediaCardGrid({
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
}: {
  media: MediaAsset[];
  gridSize: MediaLibraryGridSize;
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
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const columnCount = useColumnCount(parentRef as RefObject<HTMLDivElement | null>, gridSize);
  const rowCount = Math.ceil(media.length / columnCount);
  const rowHeight = estimateCardRowHeight(gridSize);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight + 12,
    overscan: 3,
  });

  const prevMediaLenRef = useRef(media.length);
  useEffect(() => {
    if (media.length !== prevMediaLenRef.current) {
      prevMediaLenRef.current = media.length;
      virtualizer.scrollToIndex(0, { align: 'start' });
    }
  }, [media.length, virtualizer]);

  const pendingFocusRef = useRef<number | null>(null);

  if (media.length === 0) {
    return null;
  }

  const virtualItems = virtualizer.getVirtualItems();
  const paddingTop = virtualItems.length > 0 ? virtualItems[0]!.start : 0;
  const paddingBottom =
    virtualItems.length > 0 ? virtualizer.getTotalSize() - virtualItems[virtualItems.length - 1]!.end : 0;

  return (
    <MediaGridNavCtx.Provider
      value={{
        columnCount,
        mediaCount: media.length,
        scrollToMediaIndex: (idx) => {
          const rowIdx = Math.floor(idx / columnCount);
          virtualizer.scrollToIndex(rowIdx, { align: 'auto' });
        },
        pendingFocusRef,
      }}
    >
      <div
        ref={parentRef}
        className="flex-1 min-h-0 overflow-auto"
        data-testid="media-grid-view"
        data-grid-size={gridSize}
        data-media-card-grid="true"
      >
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: 'repeat(' + columnCount + ', 1fr)', paddingTop, paddingBottom }}
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
                  />
                ))}
              </Fragment>
            );
          })}
        </div>
      </div>
    </MediaGridNavCtx.Provider>
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

function focusMediaCardByKeyboard(event: ReactKeyboardEvent<HTMLElement>, nav: MediaGridNavCtxValue): void {
  const ref = nav.pendingFocusRef;
  const domIndex = Number(event.currentTarget.getAttribute('data-media-index'));
  const currentIndex = ref.current ?? domIndex;
  if (!Number.isFinite(currentIndex)) return;
  const nextIndex = getMediaKeyboardNavigationIndex({
    currentIndex,
    itemCount: nav.mediaCount,
    columnCount: nav.columnCount,
    key: event.key,
  });
  if (nextIndex === undefined) return;
  ref.current = nextIndex;
  nav.scrollToMediaIndex(nextIndex);
  const grid = event.currentTarget.closest('[data-media-card-grid="true"]');
  function focusWhenReady(attempts: number): void {
    if (ref.current !== nextIndex) return;
    const target = grid?.querySelector<HTMLElement>(`[data-media-index="${nextIndex}"]`);
    if (target) {
      target.focus();
      if (ref.current === nextIndex) ref.current = null;
    } else if (attempts < 10) {
      requestAnimationFrame(() => focusWhenReady(attempts + 1));
    } else {
      ref.current = null;
    }
  }
  requestAnimationFrame(() => focusWhenReady(0));
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

function formatImportedAt(importedAt?: string): string {
  if (!importedAt) {
    return zhCN.common.unavailable;
  }
  const timestamp = Date.parse(importedAt);
  if (!Number.isFinite(timestamp)) {
    return zhCN.common.unavailable;
  }
  return new Date(timestamp).toLocaleDateString();
}

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) {
    return false;
  }
  const tag = element.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || element.isContentEditable;
}

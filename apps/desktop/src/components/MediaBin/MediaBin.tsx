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

interface MediaCardExtras {
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
const MediaCardExtrasCtx = createContext<MediaCardExtras | null>(null);

interface MediaGridNavCtxValue {
  columnCount: number;
  mediaCount: number;
  scrollToMediaIndex(index: number): void;
  pendingFocusRef: { current: number | null };
}
const MediaGridNavCtx = createContext<MediaGridNavCtxValue | null>(null);

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
const MEDIA_CARD_DRAG_MIME = 'application/x-open-factory-media-id';
const SUBCLIP_DRAG_MIME = 'application/x-open-factory-subclip';

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
type MediaInfoState = { asset: MediaAsset; loading: boolean; analysis?: MediaAnalysis; error?: string };
type MediaSourcePathsState = { asset: MediaAsset; paths: string[] };

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

function BatchMetadataDialog({
  assets,
  onClose,
  onSubmit,
}: {
  assets: MediaAsset[];
  onClose(): void;
  onSubmit(metadata: BatchEditableMediaMetadata): void;
}) {
  const t = zhCN.mediaBin.batchMetadataDialog;
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [description, setDescription] = useState('');
  const [copyright, setCopyright] = useState('');
  const [date, setDate] = useState('');
  const metadata = buildBatchMetadataPatch({ title, author, description, copyright, date });
  const canSubmit = Object.keys(metadata).length > 0;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="batch-metadata-title"
      data-testid="batch-metadata-dialog"
    >
      <form
        className="w-full max-w-lg rounded-md border border-line bg-[var(--color-bg-elevated)] p-4 shadow-soft"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit) {
            onSubmit(metadata);
          }
        }}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-ink" id="batch-metadata-title">
              {t.title}
            </h2>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">{t.summary(assets.length)}</p>
          </div>
          <button
            className="rounded p-1 text-[var(--color-text-muted)] hover:bg-panel"
            type="button"
            aria-label={zhCN.common.close}
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>
        <div className="grid gap-3">
          <BatchTextField
            label={t.fields.title}
            value={title}
            onChange={setTitle}
            testId="batch-metadata-title-input"
          />
          <BatchTextField
            label={t.fields.author}
            value={author}
            onChange={setAuthor}
            testId="batch-metadata-author-input"
          />
          <label className="grid gap-1 text-xs font-semibold text-[var(--color-text-secondary)]">
            {t.fields.description}
            <textarea
              className="min-h-20 rounded-lg border border-line px-2 py-1.5 text-sm font-normal text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
              value={description}
              data-testid="batch-metadata-description-input"
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <BatchTextField
              label={t.fields.copyright}
              value={copyright}
              onChange={setCopyright}
              testId="batch-metadata-copyright-input"
            />
            <BatchTextField label={t.fields.date} value={date} onChange={setDate} testId="batch-metadata-date-input" />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            className="rounded-md border border-line px-3 py-1.5 text-sm font-semibold text-[var(--color-text-secondary)] hover:bg-panel"
            type="button"
            onClick={onClose}
          >
            {zhCN.common.cancel}
          </button>
          <button
            className="rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
            type="submit"
            disabled={!canSubmit}
            data-testid="batch-metadata-confirm-button"
          >
            {t.apply}
          </button>
        </div>
      </form>
    </div>
  );
}

function BatchRenameDialog({
  assets,
  allAssets,
  onClose,
  onConfirm,
}: {
  assets: MediaAsset[];
  allAssets: MediaAsset[];
  onClose(): void;
  onConfirm(preview: MediaRenamePreviewItem[], renameFiles: boolean): void;
}) {
  const t = zhCN.mediaBin.batchRenameDialog;
  const [template, setTemplate] = useState(DEFAULT_MEDIA_RENAME_TEMPLATE);
  const [sequencePrefix, setSequencePrefix] = useState(false);
  const [datePrefix, setDatePrefix] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [caseTransform, setCaseTransform] = useState<MediaRenameRules['caseTransform']>('none');
  const [removeSpecialCharacters, setRemoveSpecialCharacters] = useState(false);
  const [startIndex, setStartIndex] = useState(1);
  const [date, setDate] = useState(formatBatchRenameDate(new Date()));
  const [renameFiles, setRenameFiles] = useState(false);
  const templateRef = useRef<HTMLInputElement>(null);
  const rules = useMemo<MediaRenameRules>(
    () => ({
      template,
      sequencePrefix,
      datePrefix,
      find: findText.trim() || undefined,
      replace: replaceText,
      caseTransform,
      removeSpecialCharacters,
      startIndex,
      date,
    }),
    [
      caseTransform,
      date,
      datePrefix,
      findText,
      removeSpecialCharacters,
      replaceText,
      sequencePrefix,
      startIndex,
      template,
    ],
  );
  const preview = useMemo(() => buildMediaRenamePreview(assets, allAssets, rules), [assets, allAssets, rules]);
  const hasChanges = preview.some((item) => item.changed);
  const insertTemplateToken = (token: string) => {
    const input = templateRef.current;
    const start = input?.selectionStart ?? template.length;
    const end = input?.selectionEnd ?? template.length;
    const next = `${template.slice(0, start)}${token}${template.slice(end)}`;
    setTemplate(next);
    requestAnimationFrame(() => {
      templateRef.current?.focus();
      templateRef.current?.setSelectionRange(start + token.length, start + token.length);
    });
  };
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="batch-rename-title"
      data-testid="batch-rename-dialog"
    >
      <form
        className="grid max-h-[88vh] w-full max-w-3xl grid-rows-[auto_minmax(0,1fr)_auto] rounded-md border border-line bg-[var(--color-bg-elevated)] shadow-soft"
        onSubmit={(event) => {
          event.preventDefault();
          if (hasChanges) {
            onConfirm(preview, renameFiles);
          }
        }}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line p-4">
          <div>
            <h2 className="text-base font-semibold text-ink" id="batch-rename-title">
              {t.title}
            </h2>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">{t.summary(assets.length)}</p>
          </div>
          <button
            className="rounded p-1 text-[var(--color-text-muted)] hover:bg-panel"
            type="button"
            aria-label={zhCN.common.close}
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto p-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.9fr)]">
            <div className="space-y-3">
              <label className="grid gap-1 text-xs font-semibold text-[var(--color-text-secondary)]">
                {t.template}
                <input
                  ref={templateRef}
                  className="rounded-lg border border-line px-2 py-1.5 text-sm font-normal text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
                  value={template}
                  list="media-rename-template-variables"
                  data-testid="batch-rename-template-input"
                  onChange={(event) => setTemplate(event.target.value)}
                />
              </label>
              <datalist id="media-rename-template-variables">
                {t.variableTokens.map((token) => (
                  <option key={token} value={token} />
                ))}
              </datalist>
              <div className="flex flex-wrap gap-1" aria-label={t.variableHint}>
                {t.variableTokens.map((token) => (
                  <button
                    key={token}
                    className="rounded border border-line bg-panel px-2 py-1 text-[11px] font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]"
                    type="button"
                    onClick={() => insertTemplateToken(token)}
                  >
                    {token}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-xs font-semibold text-[var(--color-text-secondary)]">
                  {t.startIndex}
                  <input
                    className="rounded-lg border border-line px-2 py-1.5 text-sm font-normal text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
                    type="number"
                    min={1}
                    value={startIndex}
                    onChange={(event) => setStartIndex(Math.max(1, Number(event.target.value) || 1))}
                  />
                </label>
                <BatchTextField label={t.date} value={date} onChange={setDate} testId="batch-rename-date-input" />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <BatchTextField
                  label={t.find}
                  value={findText}
                  onChange={setFindText}
                  testId="batch-rename-find-input"
                />
                <BatchTextField
                  label={t.replace}
                  value={replaceText}
                  onChange={setReplaceText}
                  testId="batch-rename-replace-input"
                />
              </div>
              <label className="grid gap-1 text-xs font-semibold text-[var(--color-text-secondary)]">
                {t.caseTransform}
                <select
                  className="rounded-lg border border-line px-2 py-1.5 text-sm font-normal text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
                  value={caseTransform}
                  onChange={(event) => setCaseTransform(event.target.value as MediaRenameRules['caseTransform'])}
                >
                  <option value="none">{t.caseOptions.none}</option>
                  <option value="lower">{t.caseOptions.lower}</option>
                  <option value="upper">{t.caseOptions.upper}</option>
                  <option value="title">{t.caseOptions.title}</option>
                </select>
              </label>
              <div className="grid gap-2 text-xs font-semibold text-[var(--color-text-secondary)]">
                <label className="inline-flex items-center gap-2">
                  <input
                    className="h-4 w-4 accent-brand"
                    type="checkbox"
                    checked={sequencePrefix}
                    onChange={(event) => setSequencePrefix(event.target.checked)}
                  />
                  {t.sequencePrefix}
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    className="h-4 w-4 accent-brand"
                    type="checkbox"
                    checked={datePrefix}
                    onChange={(event) => setDatePrefix(event.target.checked)}
                  />
                  {t.datePrefix}
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    className="h-4 w-4 accent-brand"
                    type="checkbox"
                    checked={removeSpecialCharacters}
                    onChange={(event) => setRemoveSpecialCharacters(event.target.checked)}
                  />
                  {t.removeSpecialCharacters}
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    className="h-4 w-4 accent-brand"
                    type="checkbox"
                    checked={renameFiles}
                    data-testid="batch-rename-files-checkbox"
                    onChange={(event) => setRenameFiles(event.target.checked)}
                  />
                  {t.renameFiles}
                </label>
              </div>
            </div>
            <div className="min-h-0 rounded-md border border-line bg-panel">
              <div className="border-b border-line px-3 py-2 text-xs font-semibold text-[var(--color-text-secondary)]">
                {t.preview}
              </div>
              <div className="max-h-[420px] overflow-y-auto p-2">
                {preview.map((item) => (
                  <div
                    key={item.assetId}
                    className="mb-2 rounded-md border border-line bg-[var(--color-bg-elevated)] p-2 text-xs last:mb-0"
                    data-testid="batch-rename-preview-row"
                    data-next-name={item.nextName}
                  >
                    <div className="truncate text-[var(--color-text-muted)]" title={item.originalName}>
                      {item.originalName}
                    </div>
                    <div className="mt-1 truncate font-semibold text-ink" title={item.nextName}>
                      {item.nextName}
                    </div>
                    {item.conflictSuffix ? (
                      <div className="mt-1 text-[11px] text-amber-700">{t.conflictSuffix(item.conflictSuffix)}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-line p-4">
          <button
            className="rounded-md border border-line px-3 py-1.5 text-sm font-semibold text-[var(--color-text-secondary)] hover:bg-panel"
            type="button"
            onClick={onClose}
          >
            {zhCN.common.cancel}
          </button>
          <button
            className="rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
            type="submit"
            disabled={!hasChanges}
            data-testid="batch-rename-confirm-button"
          >
            {t.confirm}
          </button>
        </div>
      </form>
    </div>
  );
}

function BatchTextField({
  label,
  value,
  onChange,
  testId,
}: {
  label: string;
  value: string;
  onChange(value: string): void;
  testId: string;
}) {
  return (
    <label className="grid gap-1 text-xs font-semibold text-[var(--color-text-secondary)]">
      {label}
      <input
        className="rounded-lg border border-line px-2 py-1.5 text-sm font-normal text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
        value={value}
        data-testid={testId}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function buildBatchMetadataPatch(fields: Record<keyof BatchEditableMediaMetadata, string>): BatchEditableMediaMetadata {
  const metadata: BatchEditableMediaMetadata = {};
  if (fields.title.trim()) {
    metadata.title = fields.title.trim();
  }
  if (fields.author.trim()) {
    metadata.author = fields.author.trim();
  }
  if (fields.description.trim()) {
    metadata.description = fields.description.trim();
  }
  if (fields.copyright.trim()) {
    metadata.copyright = fields.copyright.trim();
  }
  if (fields.date.trim()) {
    metadata.date = fields.date.trim();
  }
  return metadata;
}

function getMediaAssetsByIdOrder(media: MediaAsset[], assetIds: string[] | undefined): MediaAsset[] {
  if (!assetIds?.length) {
    return [];
  }
  const byId = new Map(media.map((asset) => [asset.id, asset]));
  return assetIds.map((assetId) => byId.get(assetId)).filter((asset): asset is MediaAsset => Boolean(asset));
}

function formatBatchRenameDate(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
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

function MediaFolderTree(props: {
  folders: MediaFolder[];
  media: MediaAsset[];
  mediaMetadata: Record<string, MediaMetadata>;
  mediaContentAnalysis: Record<string, ClipContentAnalysis>;
  gridSize: MediaLibraryGridSize;
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
}: {
  folder: MediaFolder;
  depth: number;
  folders: MediaFolder[];
  media: MediaAsset[];
  mediaMetadata: Record<string, MediaMetadata>;
  mediaContentAnalysis: Record<string, ClipContentAnalysis>;
  gridSize: MediaLibraryGridSize;
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
            className="min-w-0 flex-1 rounded-lg border border-line px-1 py-0.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
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

function MediaSourcePathsDialog({ state, onClose }: { state: MediaSourcePathsState; onClose(): void }) {
  const paths = state.paths;
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
          {paths.length > 0 ? (
            <ul className="space-y-2">
              {paths.map((path) => (
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

function MediaInfoDialog({ state, onClose }: { state: MediaInfoState; onClose(): void }) {
  const t = zhCN.mediaBin.mediaInfo;
  const analysis = state.analysis;
  const firstVideo = analysis?.videoStreams[0];
  const firstAudio = analysis?.audioStreams[0];
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      data-testid="media-info-dialog"
    >
      <div className="flex max-h-[86vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-[var(--color-bg-elevated)] shadow-soft">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-ink">{t.title}</h2>
            <div className="truncate text-xs text-[var(--color-text-muted)]">{state.asset.name}</div>
          </div>
          <button
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-text-muted)] hover:bg-panel"
            type="button"
            title={zhCN.common.close}
            aria-label={zhCN.common.close}
            data-testid="media-info-close-button"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {state.loading ? (
            <div className="rounded-md border border-line bg-panel p-3 text-sm text-[var(--color-text-secondary)]">
              {t.loading}
            </div>
          ) : null}
          {state.error ? (
            <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{state.error}</div>
          ) : null}
          {analysis ? (
            <div className="space-y-4">
              <InfoSection title={t.basic}>
                <InfoRow
                  label={t.format}
                  value={analysis.format.formatLongName ?? analysis.format.formatName ?? zhCN.common.unavailable}
                  testId="media-info-format"
                />
                <InfoRow label={t.duration} value={formatTimeShort(analysis.format.duration ?? state.asset.duration)} />
                <InfoRow label={t.fileSize} value={formatBytes(analysis.fileSize ?? analysis.format.size)} />
                <InfoRow label={t.createdTime} value={formatDateTime(analysis.createdTimeMs)} />
                <InfoRow label={t.bitRate} value={formatBitRate(analysis.format.bitRate)} />
              </InfoSection>
              <InfoSection title={t.video}>
                {firstVideo ? (
                  <>
                    <InfoRow
                      label={t.codec}
                      value={firstVideo.codecLongName ?? firstVideo.codecName ?? zhCN.common.unavailable}
                      testId="media-info-codec"
                    />
                    <InfoRow
                      label={t.resolution}
                      value={
                        firstVideo.width && firstVideo.height
                          ? `${firstVideo.width} x ${firstVideo.height}`
                          : zhCN.common.unavailable
                      }
                      testId="media-info-resolution"
                    />
                    <InfoRow
                      label={t.frameRate}
                      value={firstVideo.frameRate ? `${firstVideo.frameRate.toFixed(2)} fps` : zhCN.common.unavailable}
                    />
                    <InfoRow label={t.bitRate} value={formatBitRate(firstVideo.bitRate)} />
                    <InfoRow
                      label={t.colorSpace}
                      value={
                        [firstVideo.colorPrimaries, firstVideo.colorTransfer, firstVideo.colorSpace]
                          .filter(Boolean)
                          .join(' / ') || zhCN.common.unavailable
                      }
                    />
                    <InfoRow label={t.pixelFormat} value={firstVideo.pixelFormat ?? zhCN.common.unavailable} />
                    <InfoRow
                      label={t.hdrMetadata}
                      value={firstVideo.hdrMetadata.length > 0 ? firstVideo.hdrMetadata.join(', ') : zhCN.common.none}
                    />
                  </>
                ) : (
                  <div className="text-sm text-[var(--color-text-muted)]">{t.noVideo}</div>
                )}
              </InfoSection>
              <InfoSection title={t.audio}>
                {firstAudio ? (
                  <>
                    <InfoRow
                      label={t.codec}
                      value={firstAudio.codecLongName ?? firstAudio.codecName ?? zhCN.common.unavailable}
                    />
                    <InfoRow
                      label={t.sampleRate}
                      value={firstAudio.sampleRate ? `${firstAudio.sampleRate} Hz` : zhCN.common.unavailable}
                    />
                    <InfoRow
                      label={t.channels}
                      value={
                        firstAudio.channels
                          ? `${firstAudio.channels}${firstAudio.channelLayout ? ` (${firstAudio.channelLayout})` : ''}`
                          : zhCN.common.unavailable
                      }
                    />
                    <InfoRow label={t.bitRate} value={formatBitRate(firstAudio.bitRate)} />
                    <InfoRow
                      label={t.loudness}
                      value={
                        firstAudio.integratedLufs !== undefined
                          ? `${firstAudio.integratedLufs.toFixed(1)} LUFS`
                          : (analysis.loudnessError ?? zhCN.common.unavailable)
                      }
                      testId="media-info-loudness"
                    />
                  </>
                ) : (
                  <div className="text-sm text-[var(--color-text-muted)]">{t.noAudio}</div>
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
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-normal text-[var(--color-text-secondary)]">
        {title}
      </h3>
      <div className="grid gap-1 text-sm">{children}</div>
    </section>
  );
}

function InfoRow({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-3">
      <div className="text-xs font-medium text-[var(--color-text-muted)]">{label}</div>
      <div className="min-w-0 break-words text-sm text-ink" data-testid={testId}>
        {value}
      </div>
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

  return (
    <canvas
      ref={canvasRef}
      className="h-32 w-full rounded-md border border-line bg-[var(--color-bg-elevated)]"
      width={640}
      height={128}
      data-testid="media-info-bitrate-chart"
    />
  );
}

const MEDIA_LABEL_COLORS: Array<{ key: MediaLabelColor; value: string }> = [
  { key: 'red', value: '#ef4444' },
  { key: 'orange', value: '#f97316' },
  { key: 'yellow', value: '#eab308' },
  { key: 'green', value: '#22c55e' },
  { key: 'blue', value: '#3b82f6' },
  { key: 'purple', value: '#a855f7' },
];
const MEDIA_LABEL_COLOR_STYLES: Record<string, CSSProperties> = Object.fromEntries(
  MEDIA_LABEL_COLORS.map((c) => [c.key, { backgroundColor: c.value }]),
);

function MediaCard({
  asset,
  metadata,
  contentAnalysis,
  projectFrameRate,
  onAdd,
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
  selected,
  onToggleSelected,
  batchSelectionCount,
  onOpenBatchMetadata,
  onOpenBatchRename,
  mediaIndex,
}: {
  asset: MediaAsset;
  metadata?: MediaMetadata;
  contentAnalysis?: ClipContentAnalysis;
  projectFrameRate: number;
  onAdd(): void;
  onAddVersion(): void;
  onCompareVersions(): void;
  onRelink(): void;
  onGenerateProxy(): void;
  onConvertToCfr(): void;
  onSetLabel(labelColor?: MediaLabelColor): void;
  onSetRating(rating: number): void;
  onSetFlag(flag?: MediaFlag): void;
  onBatchTranscode(): void;
  onExportGif(): void;
  onAnalyzeSpectrum(): void;
  onShowInfo(): void;
  onFindSources(): void;
  selected: boolean;
  onToggleSelected(): void;
  batchSelectionCount: number;
  onOpenBatchMetadata(): void;
  onOpenBatchRename(): void;
  mediaIndex: number;
}) {
  const proxySettings = useProxySettingsStore((state) => state.settings);
  const proxyStatus = asset.proxyStatus ?? (asset.type === 'video' ? 'none' : undefined);
  const canGenerateProxy =
    asset.type === 'video' && (shouldGenerateProxy(asset, proxySettings) || proxyStatus === 'error');
  const frameRateMismatch = asset.type === 'video' && isFrameRateMismatch(asset.frameRate, projectFrameRate);
  const canConvertFrameRate = asset.type === 'video' && (asset.variableFrameRate || frameRateMismatch);
  const [labelMenuOpen, setLabelMenuOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [hoverPreviewActive, setHoverPreviewActive] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const labelColor = metadata?.labelColor;
  const rating = metadata?.rating ?? 0;
  const flag = metadata?.flag;
  const extras = useContext(MediaCardExtrasCtx);
  const sc = useContext(SubclipCtx);
  const mediaVersions = metadata?.versions ?? [];
  const versionCount = 1 + mediaVersions.length;
  return (
    <div
      className={clsx(
        'relative overflow-hidden rounded-lg border bg-[var(--color-bg-elevated)] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]',
        asset.missing ? 'border-rose-300' : 'border-line',
      )}
      data-testid={`media-card-${asset.id}`}
      data-media-card="true"
      data-media-index={mediaIndex}
      data-missing={asset.missing ? 'true' : 'false'}
      data-folder-id={asset.folderId ?? 'root'}
      data-label-color={labelColor ?? 'none'}
      data-rating={rating}
      data-flag={flag ?? 'none'}
      role="group"
      aria-label={`${asset.name} ${zhCN.mediaBin.assetType[asset.type]}`}
      tabIndex={0}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData(MEDIA_CARD_DRAG_MIME, asset.id);
      }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) {
          return;
        }
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
          event.preventDefault();
          const nav = useContext(MediaGridNavCtx);
          if (nav) focusMediaCardByKeyboard(event, nav);
          return;
        }
        if (event.key === 'Enter') {
          event.preventDefault();
          onAdd();
          return;
        }
        if (event.key === ' ' || event.code === 'Space') {
          event.preventDefault();
          if (isMediaPreviewable(asset.type) && !asset.missing) {
            setHoverPreviewActive(true);
            setTimeout(() => setHoverPreviewActive(false), 3000);
          } else {
            onShowInfo();
          }
          return;
        }
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
      onMouseEnter={() => {
        if (!isMediaPreviewable(asset.type)) return;
        const { schedule, cancel } = computeMediaPreviewDelay();
        cancel(hoverTimerRef.current);
        hoverTimerRef.current = schedule(() => setHoverPreviewActive(true));
      }}
      onMouseLeave={() => {
        if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = undefined;
        setHoverPreviewActive(false);
      }}
    >
      <div className="checkerboard relative aspect-video">
        <label
          className="absolute left-2 top-2 z-10 inline-flex h-6 w-6 items-center justify-center rounded border border-white/80 bg-white/90 shadow"
          title={zhCN.mediaBin.selectForThumbnail}
          aria-label={zhCN.mediaBin.selectForThumbnail}
          data-testid={`media-select-${asset.id}`}
          onClick={(event) => event.stopPropagation()}
        >
          <input className="h-4 w-4 accent-brand" type="checkbox" checked={selected} onChange={onToggleSelected} />
        </label>
        {asset.thumbnail ? (
          <img className="h-full w-full object-cover" src={asset.thumbnail} alt="" loading="lazy" />
        ) : (
          <IconPreview type={asset.type} />
        )}
        {hoverPreviewActive && isMediaPreviewable(asset.type) && !asset.missing ? (
          <video
            className="absolute inset-0 h-full w-full object-cover"
            src={convertLocalFileSrc(asset.path)}
            muted
            autoPlay
            loop
            playsInline
            preload="metadata"
            data-testid={`media-hover-preview-${asset.id}`}
          />
        ) : null}
        {asset.missing ? (
          <span
            className="absolute left-2 top-10 rounded bg-rose-600 px-2 py-1 text-xs font-semibold text-white"
            data-testid={`missing-media-badge-${asset.id}`}
          >
            {zhCN.common.missing}
          </span>
        ) : null}
        {asset.variableFrameRate ? (
          <span
            className="absolute left-2 top-10 rounded bg-sky-700 px-2 py-1 text-xs font-semibold text-white shadow"
            title={zhCN.mediaBin.vfrTooltip}
            data-testid={`vfr-badge-${asset.id}`}
          >
            {zhCN.mediaBin.vfrBadge}
          </span>
        ) : null}
        {asset.type === 'video' && asset.frameRate ? (
          <span
            className={clsx(
              'absolute bottom-2 right-2 rounded px-2 py-0.5 text-[11px] font-semibold shadow',
              frameRateMismatch ? 'bg-orange-500 text-white' : 'bg-black/70 text-white',
            )}
            title={zhCN.mediaBin.frameRateTooltip(formatPreciseFrameRate(asset.frameRate))}
            data-testid={`media-frame-rate-${asset.id}`}
            data-frame-rate={asset.frameRate}
            data-frame-rate-mismatch={frameRateMismatch ? 'true' : 'false'}
          >
            {formatFrameRateLabel(asset.frameRate)}
          </span>
        ) : null}
        {versionCount > 1 ? (
          <button
            className="absolute right-2 top-2 rounded bg-brand px-2 py-0.5 text-[11px] font-semibold text-white shadow"
            type="button"
            title={zhCN.mediaBin.versionBadgeTitle(versionCount)}
            data-testid={`media-version-badge-${asset.id}`}
            onClick={(event) => {
              event.stopPropagation();
              setVersionsOpen((open) => !open);
            }}
          >
            {zhCN.mediaBin.versionBadge(versionCount)}
          </button>
        ) : null}
        {labelColor ? (
          <span
            className={clsx(
              'absolute right-2 h-4 w-4 rounded-full border border-white shadow',
              versionCount > 1 ? 'top-8' : 'top-2',
            )}
            style={{ backgroundColor: labelColorToHex(labelColor) }}
            data-testid={`media-label-${asset.id}`}
          />
        ) : null}
        {extras?.favoriteIds.has(asset.id) ? (
          <span
            className="absolute right-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-white/90 shadow"
            data-testid={`media-favorite-badge-${asset.id}`}
          >
            <Heart size={12} className="text-rose-500" fill="currentColor" />
          </span>
        ) : null}
        {extras?.qualityLoading.has(asset.id) ? (
          <span
            className="absolute left-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-white/90 shadow"
            data-testid={`quality-badge-loading-${asset.id}`}
          >
            <Loader2 size={12} className="animate-spin text-[var(--color-text-muted)]" />
          </span>
        ) : null}
        {extras?.qualityResults.has(asset.id)
          ? (() => {
              const g = mapScoreToGrade(extras.qualityResults.get(asset.id)!.overallScore);
              return (
                <span
                  className={clsx(
                    'absolute left-2 top-2 z-10 flex items-center justify-center rounded-full bg-white/90 px-1.5 py-0.5 text-[10px] font-bold shadow',
                    g === 'green' ? 'text-emerald-600' : g === 'yellow' ? 'text-amber-500' : 'text-rose-600',
                  )}
                  title={
                    zhCN.mediaBin.aiQualityAssessment.scoreBadge +
                    ': ' +
                    extras.qualityResults.get(asset.id)!.overallScore
                  }
                  data-testid={`quality-badge-${asset.id}`}
                >
                  {extras.qualityResults.get(asset.id)!.overallScore}
                </span>
              );
            })()
          : null}
        {flag ? (
          <span
            className={clsx(
              'absolute left-2 bottom-2 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold text-white shadow',
              flag === 'green' ? 'bg-emerald-600' : 'bg-rose-600',
            )}
            data-testid={`media-flag-badge-${asset.id}`}
          >
            <Flag size={11} fill="currentColor" />
            {flag === 'green' ? zhCN.mediaBin.flagGreen : zhCN.mediaBin.flagRed}
          </span>
        ) : null}
      </div>
      {labelMenuOpen ? (
        <div
          className="absolute right-2 top-2 z-10 w-48 rounded-md border border-line bg-[var(--color-bg-elevated)] p-2 text-xs shadow-soft"
          data-testid={`media-label-menu-${asset.id}`}
        >
          {batchSelectionCount > 1 ? (
            <>
              <button
                className="mb-2 inline-flex w-full items-center gap-2 rounded-md border border-line px-2 py-1.5 text-left font-medium text-[var(--color-text-secondary)] hover:bg-panel"
                type="button"
                data-testid="batch-edit-metadata-menu-item"
                onClick={() => {
                  onOpenBatchMetadata();
                  setLabelMenuOpen(false);
                }}
              >
                <Tag size={13} />
                {zhCN.mediaBin.batchEditMetadata}
              </button>
              <button
                className="mb-2 inline-flex w-full items-center gap-2 rounded-md border border-line px-2 py-1.5 text-left font-medium text-[var(--color-text-secondary)] hover:bg-panel"
                type="button"
                data-testid="batch-rename-media-menu-item"
                onClick={() => {
                  onOpenBatchRename();
                  setLabelMenuOpen(false);
                }}
              >
                <List size={13} />
                {zhCN.mediaBin.batchRename}
              </button>
            </>
          ) : null}
          {extras ? (
            <button
              className="mb-2 inline-flex w-full items-center gap-2 rounded-md border border-line px-2 py-1.5 text-left font-medium text-[var(--color-text-secondary)] hover:bg-panel"
              type="button"
              data-testid="batch-quality-scan"
              onClick={() => {
                extras.onBatchQualityScan();
                setLabelMenuOpen(false);
              }}
            >
              <Gauge size={13} />
              {zhCN.mediaBin.aiQualityAssessment.batchScan}
            </button>
          ) : null}
          <button
            className="mb-2 inline-flex w-full items-center gap-2 rounded-md border border-line px-2 py-1.5 text-left font-medium text-[var(--color-text-secondary)] hover:bg-panel"
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
          {sc && (asset.type === 'video' || asset.type === 'audio') ? (
            <button
              className="mb-2 inline-flex w-full items-center gap-2 rounded-md border border-line px-2 py-1.5 text-left font-medium text-[var(--color-text-secondary)] hover:bg-panel"
              type="button"
              data-testid={`media-new-subclip-${asset.id}`}
              onClick={() => {
                sc.onOpenSubclipDialog(asset.id);
                setLabelMenuOpen(false);
              }}
            >
              <Scissors size={13} />
              {zhCN.subclip.newSubclip}
            </button>
          ) : null}
          <button
            className="mb-2 inline-flex w-full items-center gap-2 rounded-md border border-line px-2 py-1.5 text-left font-medium text-[var(--color-text-secondary)] hover:bg-panel"
            type="button"
            data-testid={`media-add-version-${asset.id}`}
            onClick={() => {
              onAddVersion();
              setLabelMenuOpen(false);
            }}
          >
            <Plus size={13} />
            {zhCN.mediaBin.addVersion}
          </button>
          <button
            className="mb-2 inline-flex w-full items-center gap-2 rounded-md border border-line px-2 py-1.5 text-left font-medium text-[var(--color-text-secondary)] hover:bg-panel"
            type="button"
            data-testid={`media-find-source-${asset.id}`}
            onClick={() => {
              onFindSources();
              setLabelMenuOpen(false);
            }}
          >
            <Search size={13} />
            {zhCN.mediaBin.findSourceFiles}
          </button>
          <button
            className="mb-2 inline-flex w-full items-center gap-2 rounded-md border border-line px-2 py-1.5 text-left font-medium text-[var(--color-text-secondary)] hover:bg-panel disabled:opacity-40"
            type="button"
            disabled={versionCount < 2}
            data-testid={`media-compare-versions-${asset.id}`}
            onClick={() => {
              onCompareVersions();
              setLabelMenuOpen(false);
            }}
          >
            <GalleryHorizontal size={13} />
            {zhCN.mediaBin.compareVersions}
          </button>
          {asset.type === 'video' ? (
            <>
              <button
                className="mb-2 inline-flex w-full items-center gap-2 rounded-md border border-line px-2 py-1.5 text-left font-medium text-[var(--color-text-secondary)] hover:bg-panel"
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
              <button
                className="mb-2 inline-flex w-full items-center gap-2 rounded-md border border-line px-2 py-1.5 text-left font-medium text-[var(--color-text-secondary)] hover:bg-panel"
                type="button"
                data-testid={`media-export-gif-${asset.id}`}
                onClick={() => {
                  onExportGif();
                  setLabelMenuOpen(false);
                }}
              >
                <ImageDown size={13} />
                {zhCN.mediaBin.exportGif}
              </button>
            </>
          ) : null}
          {asset.type === 'video' || asset.type === 'audio' ? (
            <button
              className="mb-2 inline-flex w-full items-center gap-2 rounded-md border border-line px-2 py-1.5 text-left font-medium text-[var(--color-text-secondary)] hover:bg-panel"
              type="button"
              data-testid={`media-spectrum-analysis-${asset.id}`}
              onClick={() => {
                onAnalyzeSpectrum();
                setLabelMenuOpen(false);
              }}
            >
              <Gauge size={13} />
              {zhCN.mediaBin.spectrumAnalysis}
            </button>
          ) : null}
          {extras ? (
            <button
              className="mb-2 inline-flex w-full items-center gap-2 rounded-md border border-line px-2 py-1.5 text-left font-medium text-[var(--color-text-secondary)] hover:bg-panel"
              type="button"
              data-testid={`media-reveal-in-timeline-${asset.id}`}
              onClick={() => {
                extras.onRevealInTimeline(asset.id);
                setLabelMenuOpen(false);
              }}
            >
              <Search size={13} />
              {zhCN.matchFrame.revealInTimeline}
            </button>
          ) : null}
          {extras ? (
            <button
              className="mb-2 inline-flex w-full items-center gap-2 rounded-md border border-line px-2 py-1.5 text-left font-medium text-[var(--color-text-secondary)] hover:bg-panel"
              type="button"
              data-testid={`media-toggle-favorite-${asset.id}`}
              onClick={() => {
                extras.onToggleFavorite(asset.id);
                setLabelMenuOpen(false);
              }}
            >
              <Heart
                size={13}
                className={extras.favoriteIds.has(asset.id) ? 'text-rose-500' : ''}
                fill={extras.favoriteIds.has(asset.id) ? 'currentColor' : 'none'}
              />
              {extras.favoriteIds.has(asset.id)
                ? zhCN.mediaFavorites.removeFromFavorites
                : zhCN.mediaFavorites.addToFavorites}
            </button>
          ) : null}
          {extras ? (
            <button
              className="mb-2 inline-flex w-full items-center gap-2 rounded-md border border-line px-2 py-1.5 text-left font-medium text-[var(--color-text-secondary)] hover:bg-panel"
              type="button"
              data-testid={`media-pin-to-session-${asset.id}`}
              onClick={() => {
                extras.onPinToSession(asset.id);
                setLabelMenuOpen(false);
              }}
            >
              <Star
                size={13}
                className={extras.pinnedIds.has(asset.id) ? 'text-amber-500' : ''}
                fill={extras.pinnedIds.has(asset.id) ? 'currentColor' : 'none'}
              />
              {zhCN.mediaFavorites.pinToSession}
            </button>
          ) : null}
          {(asset.type === 'video' || asset.type === 'image') && extras ? (
            <button
              className="mb-2 inline-flex w-full items-center gap-2 rounded-md border border-line px-2 py-1.5 text-left font-medium text-[var(--color-text-secondary)] hover:bg-panel"
              type="button"
              data-testid={`media-ai-analyze-${asset.id}`}
              onClick={() => {
                extras.onAnalyzeAI(asset.id);
                setLabelMenuOpen(false);
              }}
            >
              <Sparkles size={13} />
              {zhCN.inspector.aiContentAnalysis.title}
            </button>
          ) : null}
          {extras ? (
            <button
              className="mb-2 inline-flex w-full items-center gap-2 rounded-md border border-line px-2 py-1.5 text-left font-medium text-[var(--color-text-secondary)] hover:bg-panel"
              type="button"
              disabled={extras.qualityLoading.has(asset.id)}
              data-testid={`media-quality-assess-${asset.id}`}
              onClick={() => {
                extras.onQualityAssess(asset.id);
                setLabelMenuOpen(false);
              }}
            >
              <Gauge size={13} />
              {extras.qualityLoading.has(asset.id)
                ? zhCN.mediaBin.aiQualityAssessment.assessing
                : zhCN.mediaBin.aiQualityAssessment.assess}
            </button>
          ) : null}
          <div className="mb-2 flex items-center gap-1 font-semibold text-[var(--color-text-secondary)]">
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
                style={MEDIA_LABEL_COLOR_STYLES[color.key]}
                data-testid={`media-label-color-${color.key}`}
                onClick={() => {
                  onSetLabel(color.key);
                  setLabelMenuOpen(false);
                }}
              />
            ))}
          </div>
          <button
            className="mt-2 w-full rounded-md border border-line px-2 py-1 text-left font-medium text-[var(--color-text-secondary)] hover:bg-panel"
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
        <div className="truncate text-sm font-medium" title={asset.path} data-testid={`media-name-${asset.id}`}>
          {asset.name}
        </div>
        <div className="mt-1 flex items-center justify-between gap-2 text-xs text-[var(--color-text-muted)]">
          <span>{zhCN.mediaBin.assetType[asset.type]}</span>
          <span>
            {asset.type === 'audio' ? formatTimeShort(asset.duration) : `${asset.width || '-'}x${asset.height || '-'}`}
          </span>
        </div>
        <div
          className="mt-1 truncate text-[11px] text-[var(--color-text-muted)]"
          data-testid={`media-color-profile-${asset.id}`}
        >
          {formatMediaColorProfile(asset)}
        </div>
        {contentAnalysis ? <MediaSceneTagList assetId={asset.id} analysis={contentAnalysis} /> : null}
        {asset.aiAnalysis?.tags && asset.aiAnalysis.tags.length > 0 ? (
          <div className="mt-1 flex flex-wrap gap-1" data-testid={`ai-tags-${asset.id}`}>
            {asset.aiAnalysis.tags.slice(0, 5).map((tag, i) => (
              <span
                key={i}
                className="inline-block rounded-full bg-[var(--color-accent)]/15 px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-accent)]"
              >
                {tag}
              </span>
            ))}
            {asset.aiAnalysis.scene ? (
              <span className="inline-block text-[10px] text-[var(--color-text-muted)]" title={asset.aiAnalysis.scene}>
                {asset.aiAnalysis.scene}
              </span>
            ) : null}
          </div>
        ) : null}
        {asset.type === 'video' ? (
          <ProxyStatus
            status={proxyStatus}
            error={asset.proxyError}
            canGenerate={canGenerateProxy}
            onGenerateProxy={onGenerateProxy}
            assetId={asset.id}
          />
        ) : null}
        {canConvertFrameRate ? (
          <button
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md border border-orange-200 bg-orange-50 px-2 py-1.5 text-xs font-semibold text-orange-800 hover:bg-orange-100"
            type="button"
            data-testid={`convert-cfr-${asset.id}`}
            onClick={onConvertToCfr}
          >
            {frameRateMismatch
              ? zhCN.mediaBin.convertFrameRateToProject(formatFrameRateLabel(projectFrameRate))
              : zhCN.mediaBin.convertToCfr}
          </button>
        ) : null}
        {asset.relativePath ? (
          <div className="mt-1 truncate text-[11px] text-[var(--color-text-muted)]">{asset.relativePath}</div>
        ) : null}
        {versionsOpen && versionCount > 1 ? (
          <div
            className="mt-2 space-y-1 rounded-md border border-line bg-panel p-2 text-[11px]"
            data-testid={`media-version-list-${asset.id}`}
          >
            <div
              className="flex items-center justify-between gap-2 rounded bg-[var(--color-bg-elevated)] px-2 py-1"
              data-testid={`media-version-row-${asset.id}-${asset.id}`}
            >
              <span className="font-semibold text-[var(--color-text-secondary)]">{getMediaVersionLabel(0)}</span>
              <span className="min-w-0 flex-1 truncate text-[var(--color-text-muted)]">{asset.name}</span>
              <span className="text-[var(--color-text-muted)]">{zhCN.mediaBin.versionOriginal}</span>
            </div>
            {mediaVersions.map((version, index) => (
              <div
                key={version.id}
                className="flex items-center justify-between gap-2 rounded bg-[var(--color-bg-elevated)] px-2 py-1"
                data-testid={`media-version-row-${asset.id}-${version.id}`}
              >
                <span className="font-semibold text-[var(--color-text-secondary)]">
                  {version.label || getMediaVersionLabel(index + 1)}
                </span>
                <span className="min-w-0 flex-1 truncate text-[var(--color-text-muted)]" title={version.path}>
                  {version.name}
                </span>
                <span className="text-[var(--color-text-muted)]">{formatTimeShort(version.duration ?? 0)}</span>
              </div>
            ))}
          </div>
        ) : null}
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex items-center" data-testid={`media-rating-${asset.id}`} aria-label={zhCN.mediaBin.rating}>
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                className={clsx(
                  'rounded p-0.5',
                  value <= rating ? 'text-amber-400 hover:text-amber-500' : 'text-slate-300 hover:text-amber-300',
                )}
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
              className={clsx(
                'rounded border px-1.5 py-0.5 text-[11px] font-semibold',
                flag === 'green'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                  : 'border-line text-[var(--color-text-muted)] hover:bg-panel',
              )}
              title={zhCN.mediaBin.flagGreenShortcut}
              data-testid={`media-flag-green-${asset.id}`}
              onClick={() => onSetFlag(flag === 'green' ? undefined : 'green')}
            >
              G
            </button>
            <button
              type="button"
              className={clsx(
                'rounded border px-1.5 py-0.5 text-[11px] font-semibold',
                flag === 'red'
                  ? 'border-rose-300 bg-rose-50 text-rose-700'
                  : 'border-line text-[var(--color-text-muted)] hover:bg-panel',
              )}
              title={zhCN.mediaBin.flagRedShortcut}
              data-testid={`media-flag-red-${asset.id}`}
              onClick={() => onSetFlag(flag === 'red' ? undefined : 'red')}
            >
              X
            </button>
            {flag ? (
              <button
                type="button"
                className="rounded border border-line px-1.5 py-0.5 text-[11px] font-semibold text-[var(--color-text-muted)] hover:bg-panel"
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
          className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md border border-line bg-panel px-2 py-1.5 text-sm font-medium hover:bg-[var(--color-bg-secondary)]"
          type="button"
          onClick={onAdd}
          data-testid={`add-to-timeline-${asset.id}`}
        >
          <Plus size={15} />
          {zhCN.mediaBin.addToTimeline}
        </button>
        {asset.missing ? (
          <button
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100"
            type="button"
            onClick={onRelink}
            data-testid={`relink-media-${asset.id}`}
          >
            <Link2 size={15} />
            {zhCN.mediaBin.relink}
          </button>
        ) : null}
        {sc && sc.subclips.filter((s) => s.sourceMediaId === asset.id).length > 0 ? (
          <div className="mt-2">
            <button
              className="inline-flex w-full items-center gap-1 rounded border border-line bg-panel px-2 py-1 text-[11px] font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]"
              type="button"
              data-testid={`toggle-subclips-${asset.id}`}
              onClick={(e) => {
                e.stopPropagation();
                sc.onToggleSubclipExpanded(asset.id);
              }}
            >
              {sc.expandedSubclipAssetIds.has(asset.id) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <Scissors size={11} />
              {zhCN.subclip.subclipCount(sc.subclips.filter((s) => s.sourceMediaId === asset.id).length)}
            </button>
            {sc.expandedSubclipAssetIds.has(asset.id) ? (
              <div className="mt-1 space-y-1" data-testid={`subclip-list-${asset.id}`}>
                {sc.subclips
                  .filter((s) => s.sourceMediaId === asset.id)
                  .map((sub) => (
                    <div
                      key={sub.id}
                      className="rounded border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-[11px] shadow-sm"
                      draggable
                      data-testid={`subclip-card-${sub.id}`}
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = 'copy';
                        event.dataTransfer.setData(
                          SUBCLIP_DRAG_MIME,
                          JSON.stringify({ assetId: asset.id, subclip: sub }),
                        );
                      }}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate font-semibold text-[var(--color-text-secondary)]" title={sub.name}>
                          {sub.name}
                        </span>
                        <span className="shrink-0 text-[var(--color-text-muted)]">
                          {formatTimeShort(sub.inPoint)} \u2013 {formatTimeShort(sub.outPoint)}
                        </span>
                      </div>
                      {sub.color ? (
                        <span
                          className="mt-0.5 inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: sub.color }}
                        />
                      ) : null}
                      <div className="mt-1 flex items-center gap-1">
                        <button
                          className="rounded border border-line px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-text-secondary)] hover:bg-panel"
                          type="button"
                          data-testid={`add-subclip-to-timeline-${sub.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            sc.onAddSubclipToTimeline(asset.id, sub);
                          }}
                        >
                          {zhCN.subclip.addToTimeline}
                        </button>
                        <button
                          className="rounded border border-line px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-text-secondary)] hover:bg-panel"
                          type="button"
                          data-testid={`edit-subclip-${sub.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            sc.onOpenSubclipDialog(asset.id, sub.id);
                          }}
                        >
                          {zhCN.subclip.editSubclip}
                        </button>
                        <button
                          className="rounded border border-line px-1.5 py-0.5 text-[10px] font-medium text-rose-600 hover:bg-panel"
                          type="button"
                          data-testid={`delete-subclip-${sub.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            sc.onDeleteSubclip(sub.id);
                          }}
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

const TIMELINE_COLORS: Array<{ key: TimelineLabelColor; value: string }> = [
  { key: 'red', value: '#ef4444' },
  { key: 'orange', value: '#f97316' },
  { key: 'amber', value: '#f59e0b' },
  { key: 'yellow', value: '#eab308' },
  { key: 'lime', value: '#84cc16' },
  { key: 'green', value: '#22c55e' },
  { key: 'teal', value: '#14b8a6' },
  { key: 'cyan', value: '#06b6d4' },
  { key: 'blue', value: '#3b82f6' },
  { key: 'indigo', value: '#6366f1' },
  { key: 'purple', value: '#a855f7' },
  { key: 'pink', value: '#ec4899' },
];
const TIMELINE_COLOR_STYLES: Record<string, CSSProperties> = Object.fromEntries(
  TIMELINE_COLORS.map((c) => [c.key, { backgroundColor: c.value }]),
);

function SubclipDialog({
  asset,
  editingSubclip,
  onAddSubclip,
  onUpdateSubclip,
  onClose,
}: {
  asset: MediaAsset;
  editingSubclip?: Subclip;
  onAddSubclip(subclip: Subclip): void;
  onUpdateSubclip(subclipId: string, patch: Partial<Subclip>): void;
  onClose(): void;
}) {
  const t = zhCN.subclip;
  const isEdit = !!editingSubclip;
  const [name, setName] = useState(editingSubclip?.name ?? asset.name);
  const [inPoint, setInPoint] = useState(editingSubclip?.inPoint ?? 0);
  const [outPoint, setOutPoint] = useState(editingSubclip?.outPoint ?? asset.duration);
  const [color, setColor] = useState<TimelineLabelColor | null>(editingSubclip?.color ?? null);
  const [description, setDescription] = useState(editingSubclip?.description ?? '');
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const validIn = Math.max(0, inPoint);
    const validOut = Math.max(validIn + 0.01, outPoint);
    if (isEdit && editingSubclip) {
      onUpdateSubclip(editingSubclip.id, {
        name: name.trim() || asset.name,
        inPoint: validIn,
        outPoint: Math.min(validOut, asset.duration),
        color,
        description: description.trim() || undefined,
      });
    } else {
      onAddSubclip(
        createSubclip({
          name: name.trim() || asset.name,
          sourceMediaId: asset.id,
          inPoint: validIn,
          outPoint: Math.min(validOut, asset.duration),
          color,
          description: description.trim() || undefined,
        }),
      );
    }
    onClose();
  };
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      data-testid="subclip-dialog"
    >
      <form
        className="grid max-h-[80vh] w-full max-w-md grid-rows-[auto_minmax(0,1fr)_auto] rounded-md border border-line bg-[var(--color-bg-elevated)] shadow-soft"
        onSubmit={handleSubmit}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">{isEdit ? t.editSubclip : t.newSubclip}</h2>
          <button
            className="rounded p-1 hover:bg-panel"
            type="button"
            onClick={onClose}
            data-testid="subclip-dialog-close"
          >
            <X size={16} />
          </button>
        </div>
        <div className="space-y-3 overflow-y-auto px-4 py-3">
          <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
            {t.name}
            <input
              className="mt-1 w-full rounded-lg border border-line px-2 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              data-testid="subclip-dialog-name"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
              {t.inPoint}
              <input
                className="mt-1 w-full rounded-lg border border-line px-2 py-1.5 text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
                type="number"
                min={0}
                max={asset.duration}
                step={0.01}
                value={inPoint}
                onChange={(e) => setInPoint(Number(e.target.value))}
                data-testid="subclip-dialog-in"
              />
            </label>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
              {t.outPoint}
              <input
                className="mt-1 w-full rounded-lg border border-line px-2 py-1.5 text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
                type="number"
                min={0}
                max={asset.duration}
                step={0.01}
                value={outPoint}
                onChange={(e) => setOutPoint(Number(e.target.value))}
                data-testid="subclip-dialog-out"
              />
            </label>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-[var(--color-text-secondary)]">{t.color}</div>
            <div className="flex flex-wrap gap-1.5" data-testid="subclip-dialog-colors">
              <button
                type="button"
                className={`h-5 w-5 rounded-full border-2 ${color === null ? 'border-ink' : 'border-transparent'} bg-slate-300`}
                onClick={() => setColor(null)}
                data-testid="subclip-color-none"
              />
              {TIMELINE_COLORS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`h-5 w-5 rounded-full border-2 ${color === item.key ? 'border-ink' : 'border-transparent'}`}
                  style={TIMELINE_COLOR_STYLES[item.key]}
                  onClick={() => setColor(item.key)}
                  data-testid={`subclip-color-${item.key}`}
                />
              ))}
            </div>
          </div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
            {t.description}
            <textarea
              className="mt-1 w-full rounded-lg border border-line px-2 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              data-testid="subclip-dialog-description"
            />
          </label>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-line px-4 py-3">
          <button
            className="rounded border border-line px-3 py-1.5 text-xs font-medium hover:bg-panel"
            type="button"
            onClick={onClose}
          >
            {zhCN.common.cancel}
          </button>
          <button
            className="rounded bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
            type="submit"
            data-testid="subclip-dialog-save"
          >
            {t.save}
          </button>
        </div>
      </form>
    </div>
  );
}

function labelColorToHex(color: MediaLabelColor): string {
  return MEDIA_LABEL_COLORS.find((item) => item.key === color)?.value ?? '#64748b';
}

function MediaSceneTagList({ assetId, analysis }: { assetId: string; analysis: ClipContentAnalysis }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1" data-testid={`media-scene-tags-${assetId}`}>
      {analysis.sceneTypes.slice(0, 3).map((sceneType) => (
        <span
          key={sceneType}
          className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800"
          data-testid={`media-scene-tag-${sceneType}-${assetId}`}
        >
          {zhCN.contentAnalysis.sceneTypeLabels[sceneType]}
        </span>
      ))}
    </div>
  );
}

function formatFrameRateLabel(frameRate: number): string {
  const rounded = Math.round(frameRate * 100) / 100;
  return `${Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}fps`;
}

function formatMediaFormat(asset: MediaAsset): string {
  const extension = asset.name.includes('.') ? asset.name.split('.').pop()?.toUpperCase() : undefined;
  return extension ? `${zhCN.mediaBin.assetType[asset.type]} / ${extension}` : zhCN.mediaBin.assetType[asset.type];
}

function formatMediaResolution(asset: MediaAsset): string {
  if (asset.type === 'audio') {
    return zhCN.common.unavailable;
  }
  return asset.width && asset.height ? `${asset.width} x ${asset.height}` : zhCN.common.unavailable;
}

function formatMediaColorProfile(asset: MediaAsset): string {
  return asset.colorProfile?.label ?? zhCN.common.unavailable;
}

function formatPreciseFrameRate(frameRate: number): string {
  return `${(Math.round(frameRate * 1000) / 1000).toFixed(3)} fps`;
}

function ProxyStatus({
  status,
  error,
  canGenerate,
  onGenerateProxy,
  assetId,
}: {
  status: MediaAsset['proxyStatus'];
  error?: string;
  canGenerate: boolean;
  onGenerateProxy(): void;
  assetId: string;
}) {
  const icon =
    status === 'ready' ? (
      <BadgeCheck size={13} />
    ) : status === 'pending' ? (
      <Loader2 className="animate-spin" size={13} />
    ) : status === 'error' ? (
      <AlertCircle size={13} />
    ) : (
      <Gauge size={13} />
    );
  const label =
    status === 'ready'
      ? zhCN.mediaBin.proxyStatus.ready
      : status === 'pending'
        ? zhCN.mediaBin.proxyStatus.pending
        : status === 'error'
          ? zhCN.mediaBin.proxyStatus.error
          : canGenerate
            ? zhCN.mediaBin.proxyStatus.recommended
            : zhCN.mediaBin.proxyStatus.notNeeded;
  const tone =
    status === 'ready'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : status === 'pending'
        ? 'border-sky-200 bg-sky-50 text-sky-700'
        : status === 'error'
          ? 'border-rose-200 bg-rose-50 text-rose-700'
          : 'border-line bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]';
  return (
    <div className="mt-2 space-y-1">
      <div
        className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone}`}
        title={error}
        data-testid={`proxy-status-${assetId}`}
        data-proxy-status={status ?? 'none'}
      >
        {icon}
        <span className="truncate">{label}</span>
      </div>
      {canGenerate || status === 'pending' || status === 'ready' ? (
        <button
          className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-xs font-medium hover:bg-panel disabled:opacity-50"
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
    <div className="flex h-full items-center justify-center text-[var(--color-text-muted)]">
      <Icon size={36} />
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

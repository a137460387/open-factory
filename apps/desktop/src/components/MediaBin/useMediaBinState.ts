import { logger } from '@open-factory/editor-core/utils';
import {
  collectSmartAlbums,
  collectFingerprintReferences,
  filterMediaAssets,
  listFingerprintSourcePaths,
  parseFavoritesSearchFilter,
  type MediaAsset,
  type ContentSceneType,
  type MediaMetadata,
  type MediaMetadataFilter,
  type SmartAlbumId,
  type EffectPreset,
  hasAvailableTextProvider,
  buildQualityAssessmentSystemPrompt,
  buildQualityAssessmentUserPrompt,
  parseQualityAssessmentResponse,
  type QualityAssessmentResult,
} from '@open-factory/editor-core';
import { useMemo, useState, useEffect } from 'react';
import type { MediaInfoState } from './MediaInfoDialog';
import { isTauriRuntime } from '../../lib/tauri';
import { analyzeMedia, callAiApi, listenDragDrop, readAiApiKey } from '../../lib/tauri-bridge';
import { useMediaJobStore } from '../../media/media-job-store';
import { useEditorStore } from '../../store/editorStore';
import { useMediaIndexStore, hasActiveIndexFilters } from '../../store/mediaIndexStore';
import {
  DEFAULT_MEDIA_LIBRARY_VIEW_SETTINGS,
  normalizeMediaLibraryViewSettings,
  sortMediaLibraryAssets,
  type MediaLibraryViewSettings,
} from '../../media/mediaLibraryView';
import { readViewSettings, saveViewSettings } from '../../settings/appSettings';
import { useAISettingsStore } from '../../store/aiSettingsStore';
import { loadLocalEffectPresets } from '../../effects/effect-preset-library';
import type { MediaCollection, ClipContentAnalysis, MediaFolder } from '@open-factory/editor-core';
import type { Subclip } from '@open-factory/editor-core';
import type { VisualHighlightMarker } from '@open-factory/editor-core/visual-highlight-engine';
import { zhCN } from '../../i18n/strings';

export type MediaBinView = 'all' | 'video' | 'audio' | 'image' | 'tagged' | 'titles' | 'shared' | 'effects';
export type QuickMediaFilter = Extract<MediaMetadataFilter, 'all' | 'selected' | 'five-star'>;

export function useMediaBinState(props: {
  media: MediaAsset[];
  mediaFolders: MediaFolder[];
  mediaMetadata: Record<string, MediaMetadata>;
  mediaContentAnalysis: Record<string, ClipContentAnalysis>;
  favoriteIds: string[];
  recentMediaIds: string[];
  pinnedIds?: Set<string>;
  subclips: Subclip[];
  mediaCollections: MediaCollection[];
  onImportPaths(paths: string[]): void;
  onAddSubclip(subclip: Subclip): void;
  onUpdateSubclip(subclipId: string, patch: Partial<Subclip>): void;
  onDeleteSubclip(subclipId: string): void;
  onAddSubclipToTimeline(assetId: string, subclip: Subclip): void;
  onUpdateMediaCollections(collections: MediaCollection[]): void;
}) {
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
  const [sourcePaths, setSourcePaths] = useState<{ asset: MediaAsset; paths: string[] }>();
  const [effectPresets, setEffectPresets] = useState<EffectPreset[]>([]);
  const [effectPresetsLoading, setEffectPresetsLoading] = useState(false);
  const [effectPresetsError, setEffectPresetsError] = useState<string>();
  const [selectedMediaIds, setSelectedMediaIds] = useState<Set<string>>(() => new Set());
  const [batchMetadataAssetIds, setBatchMetadataAssetIds] = useState<string[]>();
  const [batchRenameAssetIds, setBatchRenameAssetIds] = useState<string[]>();
  const [detailsAssetId, setDetailsAssetId] = useState<string | null>(null);
  const [subclipDialogAssetId, setSubclipDialogAssetId] = useState<string>();
  const [editingSubclipId, setEditingSubclipId] = useState<string>();
  const [expandedSubclipAssetIds, setExpandedSubclipAssetIds] = useState<Set<string>>(() => new Set());
  const [aiAnalysisAsset, setAiAnalysisAsset] = useState<MediaAsset>();
  const [qualityResults, setQualityResults] = useState<Map<string, QualityAssessmentResult>>(new Map());
  const [qualityErrors, setQualityErrors] = useState<Map<string, string>>(new Map());
  const [qualityLoading, setQualityLoading] = useState<Set<string>>(new Set());
  const [aiSearchMode, setAiSearchMode] = useState(false);
  const [organizePanelOpen, setOrganizePanelOpen] = useState(false);

  const _effectivePinnedIds = props.pinnedIds ?? new Set<string>();
  const detailsAsset = useMemo(
    () => (detailsAssetId ? (props.media.find((a) => a.id === detailsAssetId) ?? null) : null),
    [detailsAssetId, props.media],
  );

  const smartAlbums = collectSmartAlbums(props.media, Date.now(), props.mediaMetadata, {
    favoriteIds: props.favoriteIds,
    recentUseIds: props.recentMediaIds,
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
      ? new Set(props.favoriteIds)
      : _parsedSearch.filter === 'recent'
        ? new Set(props.recentMediaIds)
        : undefined;

  const visibleMedia =
    filter === 'titles' || filter === 'shared' || filter === 'effects'
      ? []
      : filterMediaAssets(props.media, {
          query: _searchQuery,
          filter: filter === 'tagged' ? 'all' : filter,
          metadataFilter,
          metadata: props.mediaMetadata,
        })
          .filter(
            (asset) => sceneFilter === 'all' || props.mediaContentAnalysis[asset.id]?.sceneTypes.includes(sceneFilter),
          )
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

  const mediaHighlights = useMemo(() => {
    const map = new Map<string, VisualHighlightMarker[]>();
    for (const asset of props.media) {
      const analysis = props.mediaContentAnalysis[asset.id];
      if (!analysis) continue;
      const markers: VisualHighlightMarker[] = [];
      for (const seg of analysis.segments) {
        if (seg.motion > 0.6) {
          markers.push({
            time: seg.start,
            frameIndex: 0,
            score: seg.motion,
            type: 'motion-peak',
            duration: seg.end - seg.start,
          });
        }
      }
      for (const pt of analysis.emotionCurve) {
        if (pt.value > 0.7) {
          markers.push({ time: pt.time, frameIndex: 0, score: pt.value, type: 'combined', duration: 1 });
        }
      }
      if (markers.length > 0) {
        markers.sort((a, b) => a.time - b.time);
        map.set(asset.id, markers);
      }
    }
    return map;
  }, [props.media, props.mediaContentAnalysis]);

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
    () =>
      props.media.filter((asset) => asset.type === 'video' && selectedMediaIds.has(asset.id)).map((asset) => asset.id),
    [props.media, selectedMediaIds],
  );
  const batchMetadataAssets = useMemo(
    () => getMediaAssetsByIdOrder(props.media, batchMetadataAssetIds),
    [props.media, batchMetadataAssetIds],
  );
  const batchRenameAssets = useMemo(
    () => getMediaAssetsByIdOrder(props.media, batchRenameAssetIds),
    [props.media, batchRenameAssetIds],
  );

  const toggleSelectedMedia = (assetId: string) => {
    setSelectedMediaIds((current) => {
      const next = new Set(current);
      if (next.has(assetId)) next.delete(assetId);
      else next.add(assetId);
      return next;
    });
  };

  const resolveBatchAssetIds = (assetId: string) => {
    if (!selectedMediaIds.has(assetId)) return [assetId];
    return props.media.filter((asset) => selectedMediaIds.has(asset.id)).map((asset) => asset.id);
  };

  const openBatchMetadataEditor = (assetId: string) => {
    const assetIds = resolveBatchAssetIds(assetId);
    if (assetIds.length > 1) setBatchMetadataAssetIds(assetIds);
  };

  const openBatchRenameEditor = (assetId: string) => {
    const assetIds = resolveBatchAssetIds(assetId);
    if (assetIds.length > 1) setBatchRenameAssetIds(assetIds);
  };

  const updateMediaLibraryView = (patch: Partial<MediaLibraryViewSettings>) => {
    setMediaLibraryView((current) => {
      const next = normalizeMediaLibraryViewSettings({ ...current, ...patch });
      void saveViewSettings({ mediaLibrary: next }).catch((error) => {
        logger.warn('[MediaBin] Unable to save view settings', error);
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
    const references = collectFingerprintReferences(props.media, props.mediaMetadata);
    const paths = listFingerprintSourcePaths(props.mediaMetadata[asset.id]?.fingerprint, references);
    setSourcePaths({ asset, paths });
  };

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

  const handleQualityAssess = async (assetId: string) => {
    const asset = props.media.find((a) => a.id === assetId);
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
    for (const asset of props.media) {
      if (!qualityResults.has(asset.id) && !qualityLoading.has(asset.id)) {
        handleQualityAssess(asset.id);
      }
    }
  };

  // Effects
  useEffect(() => {
    if (!isTauriRuntime()) return undefined;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void listenDragDrop((payload) => {
      setDragOver(payload.type === 'over');
      if (payload.type === 'drop' && payload.paths?.length) props.onImportPaths(payload.paths);
    }).then((dispose) => {
      if (disposed) dispose();
      else unlisten = dispose;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [props.onImportPaths]);

  useEffect(() => {
    let canceled = false;
    void readViewSettings()
      .then((view) => {
        if (!canceled) setMediaLibraryView(view.mediaLibrary);
      })
      .catch((error) => {
        logger.warn('[MediaBin] Unable to load view settings', error);
      });
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    const validIds = new Set(props.media.map((asset) => asset.id));
    setSelectedMediaIds((current) => {
      const next = new Set(Array.from(current).filter((id) => validIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [props.media]);

  useEffect(() => {
    if (filter === 'effects') void refreshEffectPresetList();
  }, [filter]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.altKey || isEditableKeyboardTarget(event.target))
        return;
      const mode = event.key === '1' ? 'grid' : event.key === '2' ? 'list' : event.key === '3' ? 'timeline' : undefined;
      if (!mode) return;
      event.preventDefault();
      updateMediaLibraryView({ mode });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return {
    // State
    dragOver,
    setDragOver,
    search,
    setSearch,
    filter,
    setFilter,
    quickFilter,
    setQuickFilter,
    sceneFilter,
    setSceneFilter,
    smartAlbumId,
    setSmartAlbumId,
    mediaLibraryView,
    updateMediaLibraryView,
    mediaInfo,
    setMediaInfo,
    sourcePaths,
    setSourcePaths,
    effectPresets,
    effectPresetsLoading,
    effectPresetsError,
    selectedMediaIds,
    setSelectedMediaIds,
    batchMetadataAssetIds,
    setBatchMetadataAssetIds,
    batchRenameAssetIds,
    setBatchRenameAssetIds,
    detailsAssetId,
    setDetailsAssetId,
    detailsAsset,
    subclipDialogAssetId,
    setSubclipDialogAssetId,
    editingSubclipId,
    setEditingSubclipId,
    expandedSubclipAssetIds,
    aiAnalysisAsset,
    setAiAnalysisAsset,
    qualityResults,
    qualityErrors,
    qualityLoading,
    aiSearchMode,
    setAiSearchMode,
    organizePanelOpen,
    setOrganizePanelOpen,
    // Computed
    projectPath,
    _effectivePinnedIds,
    smartAlbums,
    visibleMedia,
    sortedVisibleMedia,
    mediaHighlights,
    importedTimelineMedia,
    jobs,
    runnerActive,
    clearFinishedJobs,
    runningJob,
    pendingCount,
    failedCount,
    selectedVideoIds,
    batchMetadataAssets,
    batchRenameAssets,
    // Handlers
    toggleSelectedMedia,
    openBatchMetadataEditor,
    openBatchRenameEditor,
    openMediaInfo,
    findSourcePaths,
    handleOpenSubclipDialog,
    handleToggleSubclipExpanded,
    handleQualityAssess,
    handleBatchQualityScan,
    refreshEffectPresetList,
  };
}

function getMediaAssetsByIdOrder(media: MediaAsset[], assetIds: string[] | undefined): MediaAsset[] {
  if (!assetIds?.length) return [];
  const byId = new Map(media.map((asset) => [asset.id, asset]));
  return assetIds.map((assetId) => byId.get(assetId)).filter((asset): asset is MediaAsset => Boolean(asset));
}

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;
  const tag = element.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || element.isContentEditable;
}

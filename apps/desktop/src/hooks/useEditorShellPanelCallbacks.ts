import { useCallback, useMemo } from 'react';
import type { MediaAsset, MediaLabelColor, MediaFlag, Subclip, MediaMetadata } from '@open-factory/editor-core';
import { useEditorStore } from '../store/editorStore';
import { useEditorUIStore } from '../store/editorUIStore';
import { useEditorFeatureStore } from '../store/editorFeatureStore';
import type { AutoAudioSyncApplyMode, EffectPreset, TitleTemplateId, MediaRenamePreviewItem } from '@open-factory/editor-core';

interface PanelCallbacksDeps {
  importMedia: () => Promise<void>;
  importDropped: (paths: string[]) => Promise<void>;
  openBatchTranscode: (paths?: string[]) => void;
  batchGenerateCovers: () => Promise<void>;
  setThumbnailGeneratorAssetIds: (ids: string[]) => void;
  setGifExportAsset: (asset: MediaAsset | undefined) => void;
  setSpectrumAsset: (asset: MediaAsset | undefined) => void;
  scanDuplicateMedia: () => Promise<void>;
  addAssetToTimeline: (assetId: string) => void;
  addVersionForMedia: (assetId: string) => Promise<void>;
  openMediaVersionCompare: (assetId: string) => void;
  addAdjustmentLayer: () => void;
  relinkMedia: (assetId: string) => Promise<void>;
  relinkAllMissing: () => Promise<void>;
  generateProxyForMedia: (assetId: string) => Promise<void>;
  convertVfrMediaToCfr: (assetId: string) => void;
  setMediaMetadata: (assetId: string, metadata: Partial<MediaMetadata>) => void;
  batchUpdateMediaMetadata: (assetIds: string[], metadata: Partial<MediaMetadata>) => void;
  batchRenameMedia: (assetIds: string[], preview: MediaRenamePreviewItem[], renameFiles: boolean) => Promise<void>;
  addTitleTemplate: (templateId: TitleTemplateId) => void;
  createMediaFolder: (parentId?: string | null) => void;
  renameMediaFolder: (folderId: string, name: string) => void;
  deleteMediaFolder: (folderId: string) => void;
  setMediaFolderCollapsed: (folderId: string, collapsed: boolean) => void;
  moveMediaToFolder: (assetIds: string[], folderId?: string | null) => void;
  applyEffectPresetToSelectedClip: (preset: EffectPreset) => void;
  handleToggleFavorite: (assetId: string) => void;
  handleRevealFromMediaBin: (assetId: string) => void;
  handlePinToSession: (assetId: string) => void;
  handleAddSubclip: (subclip: Subclip) => void;
  handleUpdateSubclip: (assetId: string, subclip: Partial<Subclip>) => void;
  handleDeleteSubclip: (subclipId: string) => void;
  handleAddSubclipToTimeline: (assetId: string, subclip: Subclip) => void;
  projectMediaMetadata: Record<string, MediaMetadata>;
}

/**
 * 从 EditorShell 中提取的面板回调。
 * 将左侧面板和浮动对话框的回调集中管理。
 */
export function useEditorShellPanelCallbacks(deps: PanelCallbacksDeps) {
  const {
    importMedia,
    importDropped,
    openBatchTranscode,
    batchGenerateCovers,
    setThumbnailGeneratorAssetIds,
    setGifExportAsset,
    setSpectrumAsset,
    scanDuplicateMedia,
    addAssetToTimeline,
    addVersionForMedia,
    openMediaVersionCompare,
    addAdjustmentLayer,
    relinkMedia,
    relinkAllMissing,
    generateProxyForMedia,
    convertVfrMediaToCfr,
    setMediaMetadata,
    batchUpdateMediaMetadata,
    batchRenameMedia,
    addTitleTemplate,
    createMediaFolder,
    renameMediaFolder,
    deleteMediaFolder,
    setMediaFolderCollapsed,
    moveMediaToFolder,
    applyEffectPresetToSelectedClip,
    handleToggleFavorite,
    handleRevealFromMediaBin,
    handlePinToSession,
    handleAddSubclip,
    handleUpdateSubclip,
    handleDeleteSubclip,
    handleAddSubclipToTimeline,
    projectMediaMetadata,
  } = deps;

  const leftPanelCallbacks = useMemo(
    () => ({
      onImport: () => void importMedia(),
      onImportPaths: (paths: string[]) => void importDropped(paths),
      onBatchTranscode: (paths: string[]) => openBatchTranscode(paths),
      onBatchGenerateCovers: () => void batchGenerateCovers(),
      onGenerateThumbnails: (assetIds: string[]) => setThumbnailGeneratorAssetIds(assetIds),
      onExportGif: (asset: MediaAsset) => setGifExportAsset(asset),
      onAnalyzeSpectrum: (asset: MediaAsset) => setSpectrumAsset(asset),
      onScanDuplicates: () => void scanDuplicateMedia(),
      onAddToTimeline: (assetId: string) => void addAssetToTimeline(assetId),
      onAddVersion: (assetId: string) => void addVersionForMedia(assetId),
      onCompareVersions: openMediaVersionCompare,
      onAddAdjustmentLayer: addAdjustmentLayer,
      onRelink: (assetId: string) => void relinkMedia(assetId),
      onRelinkAll: () => void relinkAllMissing(),
      onGenerateProxy: (assetId: string) => void generateProxyForMedia(assetId),
      onConvertToCfr: convertVfrMediaToCfr,
      onSetLabel: (assetId: string, labelColor?: MediaLabelColor) =>
        setMediaMetadata(assetId, { ...projectMediaMetadata[assetId], labelColor }),
      onSetRating: (assetId: string, rating: number) =>
        setMediaMetadata(assetId, { ...projectMediaMetadata[assetId], rating }),
      onSetFlag: (assetId: string, flag?: MediaFlag) =>
        setMediaMetadata(assetId, { ...projectMediaMetadata[assetId], flag }),
      onBatchUpdateMetadata: (assetIds: string[], metadata: Partial<MediaMetadata>) => batchUpdateMediaMetadata(assetIds, metadata),
      onBatchRenameMedia: (assetIds: string[], preview: MediaRenamePreviewItem[], renameFiles: boolean) => batchRenameMedia(assetIds, preview, renameFiles),
      onAddTitleTemplate: addTitleTemplate,
      onCreateFolder: (parentId?: string | null) => createMediaFolder(parentId),
      onRenameFolder: renameMediaFolder,
      onDeleteFolder: deleteMediaFolder,
      onSetFolderCollapsed: setMediaFolderCollapsed,
      onMoveMediaToFolder: (assetIds: string[], folderId?: string | null) => moveMediaToFolder(assetIds, folderId),
      onApplyEffectPreset: applyEffectPresetToSelectedClip,
      onToggleFavorite: handleToggleFavorite,
      onRevealInTimeline: handleRevealFromMediaBin,
      onPinToSession: handlePinToSession,
      onAddSubclip: (subclip: Subclip) => handleAddSubclip(subclip),
      onUpdateSubclip: (subclipId: string, patch: Partial<Subclip>) => handleUpdateSubclip(subclipId, patch),
      onDeleteSubclip: handleDeleteSubclip,
      onAddSubclipToTimeline: handleAddSubclipToTimeline,
    }),
    [
      importMedia,
      importDropped,
      openBatchTranscode,
      batchGenerateCovers,
      setThumbnailGeneratorAssetIds,
      setGifExportAsset,
      setSpectrumAsset,
      scanDuplicateMedia,
      addAssetToTimeline,
      addVersionForMedia,
      openMediaVersionCompare,
      addAdjustmentLayer,
      relinkMedia,
      relinkAllMissing,
      generateProxyForMedia,
      convertVfrMediaToCfr,
      setMediaMetadata,
      batchUpdateMediaMetadata,
      batchRenameMedia,
      addTitleTemplate,
      createMediaFolder,
      renameMediaFolder,
      deleteMediaFolder,
      setMediaFolderCollapsed,
      moveMediaToFolder,
      applyEffectPresetToSelectedClip,
      handleToggleFavorite,
      handleRevealFromMediaBin,
      handlePinToSession,
      handleAddSubclip,
      handleUpdateSubclip,
      handleDeleteSubclip,
      handleAddSubclipToTimeline,
      projectMediaMetadata,
    ],
  );

  return {
    leftPanelCallbacks,
  };
}

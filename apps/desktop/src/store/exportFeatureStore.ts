/**
 * Export feature state — selector hooks for editorFeatureStore.
 *
 * Extracted from editorFeatureStore (H5). This module does NOT create its own
 * zustand store. Instead it re-exports `useEditorFeatureStore` and provides
 * domain-specific selector hooks for export-related features (batch transcode,
 * template export, GIF, thumbnail, mock history, format converter).
 */

import { useEditorFeatureStore } from './editorFeatureStore';

// Re-export the combined store for consumers that need the full hook
export { useEditorFeatureStore as useExportFeatureStore };

// --- Batch transcode selectors ---
export const useBatchTranscodeInitialPaths = () => useEditorFeatureStore((s) => s.batchTranscodeInitialPaths);
export const useSetBatchTranscodeInitialPaths = () => useEditorFeatureStore((s) => s.setBatchTranscodeInitialPaths);

// --- Template export selectors ---
export const useTemplateExportPreset = () => useEditorFeatureStore((s) => s.templateExportPreset);
export const useSetTemplateExportPreset = () => useEditorFeatureStore((s) => s.setTemplateExportPreset);

// --- GIF export selectors ---
export const useGifExportAsset = () => useEditorFeatureStore((s) => s.gifExportAsset);
export const useSetGifExportAsset = () => useEditorFeatureStore((s) => s.setGifExportAsset);

// --- Thumbnail generation selectors ---
export const useThumbnailGeneratorAssetIds = () => useEditorFeatureStore((s) => s.thumbnailGeneratorAssetIds);
export const useSetThumbnailGeneratorAssetIds = () => useEditorFeatureStore((s) => s.setThumbnailGeneratorAssetIds);

// --- Mock export history selectors ---
export const useMockExportHistory = () => useEditorFeatureStore((s) => s.mockExportHistory);
export const useSetMockExportHistory = () => useEditorFeatureStore((s) => s.setMockExportHistory);

// --- Format converter selectors ---
export const useFormatConverterMockFiles = () => useEditorFeatureStore((s) => s.formatConverterMockFiles);
export const useSetFormatConverterMockFiles = () => useEditorFeatureStore((s) => s.setFormatConverterMockFiles);

// Re-export types
export type { EditorFeatureState } from './editorFeatureStore';

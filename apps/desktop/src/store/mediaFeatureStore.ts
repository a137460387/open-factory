/**
 * Media feature state — selector hooks for editorFeatureStore.
 *
 * Extracted from editorFeatureStore (H5). This module does NOT create its own
 * zustand store. Instead it re-exports `useEditorFeatureStore` and provides
 * domain-specific selector hooks for media-related features (color analysis,
 * project/media health, duplicate detection, media organizer, recording,
 * media version compare, spectrum analysis).
 */

import { useEditorFeatureStore } from './editorFeatureStore';

// Re-export the combined store for consumers that need the full hook
export { useEditorFeatureStore as useMediaFeatureStore };

// --- Color analysis selectors ---
export const useColorAnalysisBusy = () => useEditorFeatureStore((s) => s.colorAnalysisBusy);
export const useColorAnalysisResults = () => useEditorFeatureStore((s) => s.colorAnalysisResults);
export const useColorAnalysisJumps = () => useEditorFeatureStore((s) => s.colorAnalysisJumps);
export const useColorHeatmapPoints = () => useEditorFeatureStore((s) => s.colorHeatmapPoints);
export const useColorAnalysisSamples = () => useEditorFeatureStore((s) => s.colorAnalysisSamples);
export const useSetColorAnalysisBusy = () => useEditorFeatureStore((s) => s.setColorAnalysisBusy);
export const useSetColorAnalysisResults = () => useEditorFeatureStore((s) => s.setColorAnalysisResults);
export const useSetColorAnalysisJumps = () => useEditorFeatureStore((s) => s.setColorAnalysisJumps);
export const useSetColorHeatmapPoints = () => useEditorFeatureStore((s) => s.setColorHeatmapPoints);
export const useSetColorAnalysisSamples = () => useEditorFeatureStore((s) => s.setColorAnalysisSamples);

// --- Project & media health selectors ---
export const useProjectHealthReport = () => useEditorFeatureStore((s) => s.projectHealthReport);
export const useProjectHealthRepairReport = () => useEditorFeatureStore((s) => s.projectHealthRepairReport);
export const useProjectHealthScanning = () => useEditorFeatureStore((s) => s.projectHealthScanning);
export const useMediaHealthDashboard = () => useEditorFeatureStore((s) => s.mediaHealthDashboard);
export const useMediaHealthScanning = () => useEditorFeatureStore((s) => s.mediaHealthScanning);
export const useMediaHealthAutoShowEnabled = () => useEditorFeatureStore((s) => s.mediaHealthAutoShowEnabled);
export const useSetProjectHealthReport = () => useEditorFeatureStore((s) => s.setProjectHealthReport);
export const useSetProjectHealthRepairReport = () => useEditorFeatureStore((s) => s.setProjectHealthRepairReport);
export const useSetProjectHealthScanning = () => useEditorFeatureStore((s) => s.setProjectHealthScanning);
export const useSetMediaHealthDashboard = () => useEditorFeatureStore((s) => s.setMediaHealthDashboard);
export const useSetMediaHealthScanning = () => useEditorFeatureStore((s) => s.setMediaHealthScanning);
export const useSetMediaHealthAutoShowEnabled = () => useEditorFeatureStore((s) => s.setMediaHealthAutoShowEnabled);

// --- Duplicate & organizer selectors ---
export const useDuplicateMediaGroups = () => useEditorFeatureStore((s) => s.duplicateMediaGroups);
export const useMediaOrganizerGroups = () => useEditorFeatureStore((s) => s.mediaOrganizerGroups);
export const useMediaOrganizerCleanup = () => useEditorFeatureStore((s) => s.mediaOrganizerCleanup);
export const useMediaOrganizerScanning = () => useEditorFeatureStore((s) => s.mediaOrganizerScanning);
export const useSetDuplicateMediaGroups = () => useEditorFeatureStore((s) => s.setDuplicateMediaGroups);
export const useSetMediaOrganizerGroups = () => useEditorFeatureStore((s) => s.setMediaOrganizerGroups);
export const useSetMediaOrganizerCleanup = () => useEditorFeatureStore((s) => s.setMediaOrganizerCleanup);
export const useSetMediaOrganizerScanning = () => useEditorFeatureStore((s) => s.setMediaOrganizerScanning);

// --- Recording selectors ---
export const useRecordingTask = () => useEditorFeatureStore((s) => s.recordingTask);
export const useRecordingElapsedSeconds = () => useEditorFeatureStore((s) => s.recordingElapsedSeconds);
export const useSetRecordingTask = () => useEditorFeatureStore((s) => s.setRecordingTask);
export const useSetRecordingElapsedSeconds = () => useEditorFeatureStore((s) => s.setRecordingElapsedSeconds);

// --- Media version compare selectors ---
export const useMediaVersionCompare = () => useEditorFeatureStore((s) => s.mediaVersionCompare);
export const useSetMediaVersionCompare = () => useEditorFeatureStore((s) => s.setMediaVersionCompare);

// --- Spectrum analysis selectors ---
export const useSpectrumAsset = () => useEditorFeatureStore((s) => s.spectrumAsset);
export const useSetSpectrumAsset = () => useEditorFeatureStore((s) => s.setSpectrumAsset);

// Re-export types
export type { EditorFeatureState } from './editorFeatureStore';

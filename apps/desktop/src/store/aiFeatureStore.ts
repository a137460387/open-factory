/**
 * AI feature state — selector hooks for editorFeatureStore.
 *
 * Extracted from editorFeatureStore (H5). This module does NOT create its own
 * zustand store. Instead it re-exports `useEditorFeatureStore` and provides
 * domain-specific selector hooks for AI-related features (profiler, speaker
 * diarization, content analysis, audio separation, demucs, auto audio sync).
 */

import { useEditorFeatureStore } from './editorFeatureStore';

// Re-export the combined store for consumers that need the full hook
export { useEditorFeatureStore as useAIFeatureStore };

// --- Profiler selectors ---
export const useProfilerRecording = () => useEditorFeatureStore((s) => s.profilerRecording);
export const useProfilerElapsedMs = () => useEditorFeatureStore((s) => s.profilerElapsedMs);
export const useProfilerReport = () => useEditorFeatureStore((s) => s.profilerReport);
export const useSetProfilerRecording = () => useEditorFeatureStore((s) => s.setProfilerRecording);
export const useSetProfilerElapsedMs = () => useEditorFeatureStore((s) => s.setProfilerElapsedMs);
export const useSetProfilerReport = () => useEditorFeatureStore((s) => s.setProfilerReport);

// --- Speaker diarization selectors ---
export const useSpeakerDiarizationRunning = () => useEditorFeatureStore((s) => s.speakerDiarizationRunning);
export const useSpeakerDiarizationResult = () => useEditorFeatureStore((s) => s.speakerDiarizationResult);
export const useSetSpeakerDiarizationRunning = () => useEditorFeatureStore((s) => s.setSpeakerDiarizationRunning);
export const useSetSpeakerDiarizationResult = () => useEditorFeatureStore((s) => s.setSpeakerDiarizationResult);

// --- Content analysis selectors ---
export const useContentAnalysisRunningClipId = () => useEditorFeatureStore((s) => s.contentAnalysisRunningClipId);
export const useSetContentAnalysisRunningClipId = () => useEditorFeatureStore((s) => s.setContentAnalysisRunningClipId);

// --- Audio separation selectors ---
export const useAudioSeparationClipId = () => useEditorFeatureStore((s) => s.audioSeparationClipId);
export const useAudioSeparationProgress = () => useEditorFeatureStore((s) => s.audioSeparationProgress);
export const useSetAudioSeparationClipId = () => useEditorFeatureStore((s) => s.setAudioSeparationClipId);
export const useSetAudioSeparationProgress = () => useEditorFeatureStore((s) => s.setAudioSeparationProgress);

// --- Demucs selectors ---
export const useDemucsAvailability = () => useEditorFeatureStore((s) => s.demucsAvailability);
export const useSetDemucsAvailability = () => useEditorFeatureStore((s) => s.setDemucsAvailability);

// --- Auto audio sync selectors ---
export const useAutoAudioSyncRunning = () => useEditorFeatureStore((s) => s.autoAudioSyncRunning);
export const useAutoAudioSyncPrimaryClipId = () => useEditorFeatureStore((s) => s.autoAudioSyncPrimaryClipId);
export const useAutoAudioSyncMode = () => useEditorFeatureStore((s) => s.autoAudioSyncMode);
export const useAutoAudioSyncResults = () => useEditorFeatureStore((s) => s.autoAudioSyncResults);
export const useSetAutoAudioSyncRunning = () => useEditorFeatureStore((s) => s.setAutoAudioSyncRunning);
export const useSetAutoAudioSyncPrimaryClipId = () => useEditorFeatureStore((s) => s.setAutoAudioSyncPrimaryClipId);
export const useSetAutoAudioSyncMode = () => useEditorFeatureStore((s) => s.setAutoAudioSyncMode);
export const useSetAutoAudioSyncResults = () => useEditorFeatureStore((s) => s.setAutoAudioSyncResults);

// Re-export types
export type { EditorFeatureState } from './editorFeatureStore';

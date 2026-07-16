/**
 * Timeline feature state — selector hooks for editorFeatureStore.
 *
 * Extracted from editorFeatureStore (H5). This module does NOT create its own
 * zustand store. Instead it re-exports `useEditorFeatureStore` and provides
 * domain-specific selector hooks for timeline-enhanced features (macro
 * recording, operation recording/replay, template mode, keyframe dialog,
 * macro history, project lifecycle).
 */

import { useEditorFeatureStore } from './editorFeatureStore';

// Re-export the combined store for consumers that need the full hook
export { useEditorFeatureStore as useTimelineFeatureStore };

// --- Macro recording selectors ---
export const useMacroRecordingActive = () => useEditorFeatureStore((s) => s.macroRecordingActive);
export const useMacroRecordingStepCount = () => useEditorFeatureStore((s) => s.macroRecordingStepCount);
export const useSetMacroRecordingActive = () => useEditorFeatureStore((s) => s.setMacroRecordingActive);
export const useSetMacroRecordingStepCount = () => useEditorFeatureStore((s) => s.setMacroRecordingStepCount);

// --- Operation recording / replay selectors ---
export const useOperationRecording = () => useEditorFeatureStore((s) => s.operationRecording);
export const useOperationRecordingActive = () => useEditorFeatureStore((s) => s.operationRecordingActive);
export const useOperationRecordingStep = () => useEditorFeatureStore((s) => s.operationRecordingStep);
export const useOperationReplaySpeed = () => useEditorFeatureStore((s) => s.operationReplaySpeed);
export const useOperationReplayRunning = () => useEditorFeatureStore((s) => s.operationReplayRunning);
export const useSetOperationRecording = () => useEditorFeatureStore((s) => s.setOperationRecording);
export const useSetOperationRecordingActive = () => useEditorFeatureStore((s) => s.setOperationRecordingActive);
export const useSetOperationRecordingStep = () => useEditorFeatureStore((s) => s.setOperationRecordingStep);
export const useSetOperationReplaySpeed = () => useEditorFeatureStore((s) => s.setOperationReplaySpeed);
export const useSetOperationReplayRunning = () => useEditorFeatureStore((s) => s.setOperationReplayRunning);

// --- Template mode selectors ---
export const useTimelineTemplateMode = () => useEditorFeatureStore((s) => s.timelineTemplateMode);
export const useSetTimelineTemplateMode = () => useEditorFeatureStore((s) => s.setTimelineTemplateMode);

// --- Paste keyframe dialog selectors ---
export const usePasteKeyframeDialogGroups = () => useEditorFeatureStore((s) => s.pasteKeyframeDialogGroups);
export const useSetPasteKeyframeDialogGroups = () => useEditorFeatureStore((s) => s.setPasteKeyframeDialogGroups);

// --- Macro history selectors ---
export const useMacroHistory = () => useEditorFeatureStore((s) => s.macroHistory);
export const useSetMacroHistory = () => useEditorFeatureStore((s) => s.setMacroHistory);

// --- Mock subtitle clips selectors ---
export const useMockSubtitleClips = () => useEditorFeatureStore((s) => s.mockSubtitleClips);
export const useSetMockSubtitleClips = () => useEditorFeatureStore((s) => s.setMockSubtitleClips);

// --- Project lifecycle selectors ---
export const useProjectPasswordRequest = () => useEditorFeatureStore((s) => s.projectPasswordRequest);
export const useRecoveryCandidate = () => useEditorFeatureStore((s) => s.recoveryCandidate);
export const useArchiveProgress = () => useEditorFeatureStore((s) => s.archiveProgress);
export const useSetProjectPasswordRequest = () => useEditorFeatureStore((s) => s.setProjectPasswordRequest);
export const useSetRecoveryCandidate = () => useEditorFeatureStore((s) => s.setRecoveryCandidate);
export const useSetArchiveProgress = () => useEditorFeatureStore((s) => s.setArchiveProgress);

// Re-export types
export type { EditorFeatureState } from './editorFeatureStore';

// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

// ── Mock Zustand stores ────────────────────────────────────────

const mockEditorState = {
  project: { name: 'test', media: [], timeline: { tracks: [] } },
  selectedClipId: null,
  selectedClipIds: [],
  selectedKeyframe: null,
  selectedKeyframes: [],
  isPlaying: false,
  inPoint: undefined,
  outPoint: undefined,
  dirty: false,
  projectPath: null,
  setProject: vi.fn(),
  setMedia: vi.fn(),
  addMedia: vi.fn(),
  setSelectedKeyframes: vi.fn(),
  setMediaMetadata: vi.fn(),
  setDirty: vi.fn(),
  setProjectPath: vi.fn(),
  setSelectedClipId: vi.fn(),
  setSelectedClipIds: vi.fn(),
  clearSelectedClipIds: vi.fn(),
  setPlayheadTime: vi.fn(),
  setIsPlaying: vi.fn(),
  setPlaybackRate: vi.fn(),
  setInPoint: vi.fn(),
  setOutPoint: vi.fn(),
};

const mockUIState = {
  professionalNleExportOpen: false, mediaPrecheckOpen: false, syncCompareOpen: false,
  collaborationNotesOpen: false, complexityScoreOpen: false, autoAudioSyncOpen: false,
  aiChatEditorOpen: false, aiRoughCutOpen: false, beatSyncOpen: false,
  contextualTranslationOpen: false, directorModeOpen: false, duplicateMediaOpen: false,
  highlightReelOpen: false, historyPanelOpen: false, mediaOrganizerOpen: false,
  musicMatchOpen: false, narrationOpen: false, pasteKeyframeDialogOpen: false,
  previewWindowOpen: false, projectDocumentationOpen: false, projectEncryptionSaveOpen: false,
  projectHealthOpen: false, projectTemplateOpen: false, releaseWorkflowOpen: false,
  reviewMode: false, shortcutCheatsheetOpen: false, smartCreationOpen: false,
  smartRoughCutOpen: false, snapshotCompareOpen: false, snapshotHistoryOpen: false,
  snapshotNameOpen: false, storyboardOpen: false, timelineCompareOpen: false,
  timelineSearchOpen: false, videoSummaryOpen: false, videoGenerationOpen: false,
  mediaHealthDashboardOpen: false,
  setBatchTranscodeOpen: vi.fn(), setBatchWatermarkOpen: vi.fn(),
  setBatchProjectProcessingOpen: vi.fn(), setLutEditorOpen: vi.fn(),
  setColorNodeEditorOpen: vi.fn(), setColorAnalysisOpen: vi.fn(),
  setProfessionalNleExportOpen: vi.fn(), setMediaPrecheckOpen: vi.fn(),
  setVideoStitchWizardOpen: vi.fn(), setSmartMontageOpen: vi.fn(),
  setSyncCompareOpen: vi.fn(), setSceneReorderOpen: vi.fn(),
  setStyleTransferOpen: vi.fn(), setCollaborationNotesOpen: vi.fn(),
  setCollaborationPanelOpen: vi.fn(), setColorGradingWorkspaceOpen: vi.fn(),
  setOperationRecordingOpen: vi.fn(), setComplexityScoreOpen: vi.fn(),
  setSmartRecommendationsOpen: vi.fn(), setContentAnalysisOpen: vi.fn(),
  setProfilerOpen: vi.fn(), setRhythmAnalysisOpen: vi.fn(),
  setAutoAudioSyncOpen: vi.fn(), setErrorKnowledgeOpen: vi.fn(),
  setSequenceCompareOpen: vi.fn(), setSubtitleSyncOpen: vi.fn(),
  setProxyVerifyOpen: vi.fn(), setFormatConverterOpen: vi.fn(),
  setEmotionAnalysisOpen: vi.fn(), setExportHistoryClassifierOpen: vi.fn(),
  setMacroHistoryOpen: vi.fn(), setAiChatEditorOpen: vi.fn(),
  setAiRoughCutOpen: vi.fn(), setBeatSyncOpen: vi.fn(),
  setContextualTranslationOpen: vi.fn(), setDirectorModeOpen: vi.fn(),
  setDuplicateMediaOpen: vi.fn(), setHighlightReelOpen: vi.fn(),
  setHistoryPanelOpen: vi.fn(), setMediaOrganizerOpen: vi.fn(),
  setMusicMatchOpen: vi.fn(), setNarrationOpen: vi.fn(),
  setPasteKeyframeDialogOpen: vi.fn(), setPreviewWindowOpen: vi.fn(),
  setProjectDocumentationOpen: vi.fn(), setProjectEncryptionSaveOpen: vi.fn(),
  setProjectHealthOpen: vi.fn(), setProjectTemplateOpen: vi.fn(),
  setReleaseWorkflowOpen: vi.fn(), setReviewMode: vi.fn(),
  setShortcutCheatsheetOpen: vi.fn(), setSmartCreationOpen: vi.fn(),
  setSmartRoughCutOpen: vi.fn(), setSnapshotCompareOpen: vi.fn(),
  setSnapshotHistoryOpen: vi.fn(), setSnapshotNameOpen: vi.fn(),
  setStoryboardOpen: vi.fn(), setTimelineCompareOpen: vi.fn(),
  setTimelineSearchOpen: vi.fn(), setVideoSummaryOpen: vi.fn(),
  setVideoGenerationOpen: vi.fn(), setSettingsOpen: vi.fn(),
  setAssistEditingOpen: vi.fn(), setContentGenerationOpen: vi.fn(),
  setQualityAssessmentOpen: vi.fn(), setMediaHealthDashboardOpen: vi.fn(),
  layoutSettings: {}, setLayoutSettings: vi.fn(),
  viewportSize: { width: 1920, height: 1080 }, setViewportSize: vi.fn(),
  languageVersion: 1, persistLayoutPatch: vi.fn(), persistPanelVisibilityPatch: vi.fn(),
};

const mockSettingsState = {
  lastBackupAt: null, setLastBackupAt: vi.fn(),
  pipLayoutPosition: null, setPiPLayoutPosition: vi.fn(),
  customSplitLayouts: [], setCustomSplitLayouts: vi.fn(),
  beatSensitivity: 0.5, setBeatSensitivity: vi.fn(),
  beatSyncSpeedEnabled: false, setBeatSyncSpeedEnabled: vi.fn(),
  beatSyncManualBpm: null, setBeatSyncManualBpm: vi.fn(),
  sceneDetectionRequestId: null, setSceneDetectionRequestId: vi.fn(),
  collaborationIdentity: { name: 'User', color: '#ff0000' }, setCollaborationIdentity: vi.fn(),
  tutorialProgress: { tutorialStep: 0 }, setTutorialProgress: vi.fn(),
  tutorialCelebrationVisible: false, setTutorialCelebrationVisible: vi.fn(),
  tutorialSignals: {}, setTutorialSignals: vi.fn(),
  safeFrameGuides: false, setSafeFrameGuides: vi.fn(),
  thumbnailTrackVisible: true, setThumbnailTrackVisible: vi.fn(),
  timelineMinimapVisible: true, setTimelineMinimapVisible: vi.fn(),
  timelineHeatmap: { enabled: false }, setTimelineHeatmap: vi.fn(),
  previewPerformance: { qualityMode: 'auto' }, setPreviewPerformance: vi.fn(),
  previewWindowResolutionScale: 1, setPreviewWindowResolutionScale: vi.fn(),
  timelineGridSettings: {}, setTimelineGridSettings: vi.fn(),
  timelineInteractionSettings: {}, setTimelineInteractionSettings: vi.fn(),
  shortcutBindings: {}, setShortcutBindings: vi.fn(),
  macros: [], setMacros: vi.fn(),
  sharedLibraryResources: [], setSharedLibraryResources: vi.fn(),
  autosaveIntervalSeconds: 60, setAutosaveIntervalSeconds: vi.fn(),
};

const mockFeatureState = {
  batchTranscodeInitialPaths: [], setBatchTranscodeInitialPaths: vi.fn(),
  thumbnailGeneratorAssetIds: [], setThumbnailGeneratorAssetIds: vi.fn(),
  colorAnalysisBusy: false, setColorAnalysisBusy: vi.fn(),
  colorAnalysisResults: null, setColorAnalysisResults: vi.fn(),
  colorAnalysisJumps: null, setColorAnalysisJumps: vi.fn(),
  colorHeatmapPoints: [], setColorHeatmapPoints: vi.fn(),
  colorAnalysisSamples: null, setColorAnalysisSamples: vi.fn(),
  setGifExportAsset: vi.fn(), setSpectrumAsset: vi.fn(),
  mediaVersionCompare: null, setMediaVersionCompare: vi.fn(),
  setFormatConverterMockFiles: vi.fn(), setMockSubtitleClips: vi.fn(),
  setMockExportHistory: vi.fn(),
  demucsAvailability: false, setDemucsAvailability: vi.fn(),
  audioSeparationClipId: null, setAudioSeparationClipId: vi.fn(),
  audioSeparationProgress: 0, setAudioSeparationProgress: vi.fn(),
  speakerDiarizationRunning: false, setSpeakerDiarizationRunning: vi.fn(),
  speakerDiarizationResult: null, setSpeakerDiarizationResult: vi.fn(),
  autoAudioSyncRunning: false, setAutoAudioSyncRunning: vi.fn(),
  autoAudioSyncPrimaryClipId: null, setAutoAudioSyncPrimaryClipId: vi.fn(),
  autoAudioSyncMode: 'waveform', setAutoAudioSyncMode: vi.fn(),
  autoAudioSyncResults: null, setAutoAudioSyncResults: vi.fn(),
  recordingTask: null, setRecordingTask: vi.fn(),
  recordingElapsedSeconds: 0, setRecordingElapsedSeconds: vi.fn(),
  operationRecording: null, operationRecordingActive: false,
  operationRecordingStep: 0, operationReplaySpeed: 1, operationReplayRunning: false,
  profilerRecording: false, profilerElapsedMs: 0, profilerReport: null,
  projectHealthReport: null, projectHealthScanning: false,
  projectHealthRepairReport: null, mediaHealthScanning: false,
  mediaHealthDashboard: null, mediaHealthAutoShowEnabled: false,
  setMediaHealthAutoShowEnabled: vi.fn(), setMediaHealthDashboard: vi.fn(),
  setMediaHealthScanning: vi.fn(),
  contentAnalysisRunningClipId: null, setContentAnalysisRunningClipId: vi.fn(),
  duplicateMediaGroups: [], setDuplicateMediaGroups: vi.fn(),
  macroRecordingActive: false, macroRecordingStepCount: 0,
  mediaOrganizerGroups: [], setMediaOrganizerGroups: vi.fn(),
  mediaOrganizerCleanup: null, setMediaOrganizerCleanup: vi.fn(),
  mediaOrganizerScanning: false, setMediaOrganizerScanning: vi.fn(),
  pasteKeyframeDialogGroups: [], setPasteKeyframeDialogGroups: vi.fn(),
  projectPasswordRequest: null, setProjectPasswordRequest: vi.fn(),
  recoveryCandidate: null, setRecoveryCandidate: vi.fn(),
  archiveProgress: null, setArchiveProgress: vi.fn(),
  setProjectHealthReport: vi.fn(), setProjectHealthScanning: vi.fn(),
  setProjectHealthRepairReport: vi.fn(),
  timelineTemplateMode: false, setTimelineTemplateMode: vi.fn(),
  templateExportPreset: null, setTemplateExportPreset: vi.fn(),
};

// ── Mock stores as Zustand selector hooks ──────────────────────

vi.mock('../../store/editorStore', () => ({
  useEditorStore: (selector: any) => selector(mockEditorState),
}));

vi.mock('../../store/dialogStore', () => ({
  useDialogStore: (selector: any) => selector(mockUIState),
}));

vi.mock('../../store/editorSettingsStore', () => ({
  useEditorSettingsStore: (selector: any) => selector(mockSettingsState),
}));

vi.mock('../../store/mediaFeatureStore', () => ({
  useMediaFeatureStore: (selector: any) => selector(mockFeatureState),
}));

vi.mock('../../store/collaborationStore', () => ({
  useCollaborationStore: (selector: any) => selector({ enabled: false }),
}));

vi.mock('../../store/proxySettingsStore', () => ({
  useProxySettingsStore: (selector: any) => selector({ settings: {} }),
}));

vi.mock('../../store/demucsSettingsStore', () => ({
  useDemucsSettingsStore: (selector: any) => selector({ executablePath: null }),
}));

vi.mock('../../store/recordingSettingsStore', () => ({
  useRecordingSettingsStore: (selector: any) => selector({ settings: {} }),
}));

// ── Import under test ─────────────────────────────────────────

import { useEditorShellStoreSubscriptions } from '../../hooks/useEditorShellStoreSubscriptions';

// ── Tests ─────────────────────────────────────────────────────

describe('useEditorShellStoreSubscriptions', () => {
  it('returns editor store values', () => {
    const { result } = renderHook(() => useEditorShellStoreSubscriptions());
    expect(result.current.project).toBeDefined();
    expect(result.current.selectedClipIds).toEqual([]);
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.dirty).toBe(false);
  });

  it('returns editor store setters as functions', () => {
    const { result } = renderHook(() => useEditorShellStoreSubscriptions());
    expect(typeof result.current.setProject).toBe('function');
    expect(typeof result.current.setSelectedClipId).toBe('function');
    expect(typeof result.current.setPlayheadTime).toBe('function');
  });

  it('returns dialog state booleans', () => {
    const { result } = renderHook(() => useEditorShellStoreSubscriptions());
    expect(typeof result.current.professionalNleExportOpen).toBe('boolean');
    expect(typeof result.current.autoAudioSyncOpen).toBe('boolean');
    expect(typeof result.current.previewWindowOpen).toBe('boolean');
  });

  it('returns ui setter functions', () => {
    const { result } = renderHook(() => useEditorShellStoreSubscriptions());
    expect(typeof result.current.setBatchTranscodeOpen).toBe('function');
    expect(typeof result.current.setSettingsOpen).toBe('function');
    expect(typeof result.current.setVideoGenerationOpen).toBe('function');
  });

  it('returns settings values', () => {
    const { result } = renderHook(() => useEditorShellStoreSubscriptions());
    expect(result.current.beatSensitivity).toBe(0.5);
    expect(result.current.autosaveIntervalSeconds).toBe(60);
    expect(result.current.shortcutBindings).toEqual({});
  });

  it('returns feature store values', () => {
    const { result } = renderHook(() => useEditorShellStoreSubscriptions());
    expect(result.current.demucsAvailability).toBe(false);
    expect(result.current.profilerRecording).toBe(false);
    expect(result.current.contentAnalysisRunningClipId).toBeNull();
  });

  it('returns other store values', () => {
    const { result } = renderHook(() => useEditorShellStoreSubscriptions());
    expect(result.current.collaborationEnabled).toBe(false);
    expect(result.current.proxySettings).toEqual({});
    expect(result.current.demucsExecutablePath).toBeNull();
  });
});

// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

// ── Mock all sub-hooks ────────────────────────────────────────

vi.mock('../useEditorShellProfiler', () => ({
  useEditorShellProfiler: vi.fn(() => ({
    handleProfilerFrame: vi.fn(),
    startProfilerRecording: vi.fn(),
    stopProfilerRecording: vi.fn(),
    exportProfilerReportJson: vi.fn(),
  })),
}));

vi.mock('../useEditorShellViewSettingsCallbacks', () => ({
  useEditorShellViewSettingsCallbacks: vi.fn(() => ({
    saveCurrentWorkspaceLayout: vi.fn(),
    toggleSafeFrameGuides: vi.fn(),
    toggleThumbnailTrackVisible: vi.fn(),
    toggleTimelineMinimapVisible: vi.fn(),
    updateTimelineHeatmap: vi.fn(),
    updatePreviewPerformance: vi.fn(),
    updateTimelineInteractionSettings: vi.fn(),
    persistPreviewWindowState: vi.fn(),
    openDetachedPreview: vi.fn(),
    reembedPreviewWindow: vi.fn(),
    updateTimelineGridSettings: vi.fn(),
    toggleTimelineGridSnap: vi.fn(),
    changeTimelineGridUnit: vi.fn(),
    runAutomationForMedia: vi.fn(),
    beginTimelineResize: vi.fn(),
  })),
}));

vi.mock('../useEditorShellProjectCallbacks', () => ({
  useEditorShellProjectCallbacks: vi.fn(() => ({
    requestProjectPassword: vi.fn(),
    saveProject: vi.fn(),
    saveEncryptedProject: vi.fn(),
    startTutorial: vi.fn(),
    skipTutorial: vi.fn(),
    closeTutorialCelebration: vi.fn(),
    confirmProjectEncryptionSave: vi.fn(),
    archiveCurrentProject: vi.fn(),
    executeNewProject: vi.fn(),
    newProject: vi.fn(),
    createProjectFromTemplate: vi.fn(),
    createProjectFromTimelineTemplate: vi.fn(),
    openProject: vi.fn(),
    saveNamedSnapshot: vi.fn(),
    restoreSnapshotProject: vi.fn(),
    applySnapshotDiffSelection: vi.fn(),
  })),
}));

vi.mock('../useEditorShellMediaCallbacks', () => ({
  useEditorShellMediaCallbacks: vi.fn(() => ({
    refreshSharedLibraryResources: vi.fn(),
    persistMediaFingerprints: vi.fn(),
    applyImportedMediaColorConversionChoice: vi.fn(),
    queueFrameRateConversionForImportedMedia: vi.fn(),
    importMedia: vi.fn(),
    addVersionForMedia: vi.fn(),
    openBatchTranscode: vi.fn(),
    batchGenerateCovers: vi.fn(),
    createMediaFolder: vi.fn(),
    renameMediaFolder: vi.fn(),
    deleteMediaFolder: vi.fn(),
    setMediaFolderCollapsed: vi.fn(),
    moveMediaToFolder: vi.fn(),
    batchUpdateMediaMetadata: vi.fn(),
    batchRenameMedia: vi.fn(),
    relinkMedia: vi.fn(),
    relinkAllMissing: vi.fn(),
    scanDuplicateMedia: vi.fn(),
    mergeDuplicateMediaGroups: vi.fn(),
    refreshMediaOrganizer: vi.fn(),
    openMediaOrganizer: vi.fn(),
    confirmMediaOrganizerDuplicateGroups: vi.fn(),
    removeMediaOrganizerReferences: vi.fn(),
    archiveUnusedMedia: vi.fn(),
    renameUnusedMedia: vi.fn(),
    conformMedia: vi.fn(),
    handleAddSubclip: vi.fn(),
    handleUpdateSubclip: vi.fn(),
    handleDeleteSubclip: vi.fn(),
    jumpToMediaAsset: vi.fn(),
    updateProjectReleaseVersion: vi.fn(),
  })),
}));

vi.mock('../useEditorShellMiscCallbacks', () => ({
  useEditorShellMiscCallbacks: vi.fn(() => ({
    createMediaReport: vi.fn(),
    createClipReport: vi.fn(),
    openMediaVersionCompare: vi.fn(),
    openSyncCompare: vi.fn(),
    clearCache: vi.fn(),
    handleToggleFavorite: vi.fn(),
    handlePinToSession: vi.fn(),
    handleRevealFromMediaBin: vi.fn(),
  })),
}));

vi.mock('../useEditorShellPlaybackCallbacks', () => ({
  useEditorShellPlaybackCallbacks: vi.fn(() => ({
    undo: vi.fn(),
    switchToPreviousHistoryBranch: vi.fn(),
    redo: vi.fn(),
    togglePlayback: vi.fn(),
    reversePlayback: vi.fn(),
    pausePlayback: vi.fn(),
    forwardPlayback: vi.fn(),
    stepFrame: vi.fn(),
    addAnnotationAtPlayhead: vi.fn(),
    addReviewAnnotationAtPlayhead: vi.fn(),
    createReviewReport: vi.fn(),
    addBookmarkAtPlayhead: vi.fn(),
    jumpTimelineNavigationPoint: vi.fn(),
    exportBookmarks: vi.fn(),
    importBookmarks: vi.fn(),
    setSingleExportRange: vi.fn(),
    appendExportRange: vi.fn(),
    markInPoint: vi.fn(),
    markOutPoint: vi.fn(),
    markMultiRangeInPoint: vi.fn(),
    markMultiRangeOutPoint: vi.fn(),
  })),
}));

vi.mock('../useEditorShellTimelineCallbacks', () => ({
  useEditorShellTimelineCallbacks: vi.fn(() => ({
    addAssetToTimeline: vi.fn(),
    handleAddSubclipToTimeline: vi.fn(),
    addAdjustmentLayer: vi.fn(),
    applyEffectPresetToSelectedClip: vi.fn(),
    addMotionGraphic: vi.fn(),
    openColorNodeEditor: vi.fn(),
    runTimelineColorAnalysis: vi.fn(),
    alignTimelineColorToReference: vi.fn(),
    openColorAnalysis: vi.fn(),
    addTitleTemplate: vi.fn(),
    splitSelected: vi.fn(),
    seekSpectrumTime: vi.fn(),
    setSpectrumSelectionRange: vi.fn(),
    splitSpectrumAtTime: vi.fn(),
    createMulticamSequence: vi.fn(),
    applyPiPLayout: vi.fn(),
    applySplitLayout: vi.fn(),
    saveCustomSplitLayout: vi.fn(),
    importEdlTimeline: vi.fn(),
    importFcpXmlTimeline: vi.fn(),
    deleteSelected: vi.fn(),
    rippleDeleteSelected: vi.fn(),
    selectAllTimelineItems: vi.fn(),
    matchFrameToSource: vi.fn(),
    revealMediaInTimeline: vi.fn(),
    navigateToNextInstance: vi.fn(),
    renderInOutRegion: vi.fn(),
    navigatePrevGap: vi.fn(),
    navigateNextGap: vi.fn(),
  })),
}));

vi.mock('../useEditorShellInlineCallbacks', () => ({
  useEditorShellInlineCallbacks: vi.fn(() => ({
    importVideosForStitchWizard: vi.fn(),
    generateVideoStitchTimeline: vi.fn(),
    generateSmartMontage: vi.fn(),
    importSubtitles: vi.fn(),
    importDataSubtitles: vi.fn(),
    restoreRecovery: vi.fn(),
    discardRecovery: vi.fn(),
    importDropped: vi.fn(),
    importSubtitlePaths: vi.fn(),
    importSubtitleDataPaths: vi.fn(),
    shortcutHandlers: {},
  })),
}));

vi.mock('../useEditorShellContentAnalysisCallbacks', () => ({
  useContentAnalysisCallbacks: vi.fn(() => ({
    runSingleContentAnalysis: vi.fn(),
    analyzeContentClip: vi.fn(),
    analyzePreferredContentTargets: vi.fn(),
    exportContentAnalysis: vi.fn(),
  })),
}));

vi.mock('../useEditorShellCallbacks', () => ({
  useProjectHealthCallbacks: vi.fn(() => ({
    refreshProjectHealth: vi.fn(),
    openProjectHealth: vi.fn(),
    refreshMediaHealthDashboard: vi.fn(),
    openMediaHealthDashboard: vi.fn(),
    setMediaHealthAutoShow: vi.fn(),
    openMediaHealthRelinkPanel: vi.fn(),
    relinkMissingFromHealth: vi.fn(),
    removeOrphanFromHealth: vi.fn(),
    mergeDuplicateFromHealth: vi.fn(),
    queueProxyFromHealth: vi.fn(),
    autoRepairProjectHealth: vi.fn(),
    repairFromMediaHealthDashboard: vi.fn(),
  })),
  useAudioAnalysisCallbacks: vi.fn(() => ({
    separateSelectedAudio: vi.fn(),
    runSpeakerDiarization: vi.fn(),
    applySpeakerDiarization: vi.fn(),
    openAutoAudioSync: vi.fn(),
    runAutoAudioSync: vi.fn(),
    applyAutoAudioSync: vi.fn(),
    cancelAudioSeparation: vi.fn(),
  })),
  useBeatSyncCallbacks: vi.fn(() => ({
    detectSelectedBeats: vi.fn(),
    snapSelectedToBeats: vi.fn(),
    splitSelectedToBeats: vi.fn(),
    applyManualBeatBpm: vi.fn(),
  })),
  useRecordingCallbacks: vi.fn(() => ({
    startEditorRecording: vi.fn(),
    stopEditorRecording: vi.fn(),
  })),
}));

vi.mock('../useEditorShellProxyCallbacks', () => ({
  useProxyCallbacks: vi.fn(() => ({
    generateProxyForMedia: vi.fn(),
    deleteProxiesForMedia: vi.fn(),
    regenerateProxiesForMedia: vi.fn(),
    migrateProxiesToDirectory: vi.fn(),
    convertVfrMediaToCfr: vi.fn(),
  })),
}));

vi.mock('../useEditorShellOperationRecording', () => ({
  useEditorShellOperationRecording: vi.fn(() => ({
    recordMacroHistory: vi.fn(),
    startMacroRecording: vi.fn(),
    stopMacroRecording: vi.fn(),
    executeMacro: vi.fn(),
    startOperationRecording: vi.fn(),
    stopOperationRecording: vi.fn(),
    saveOperationRecording: vi.fn(),
    loadOperationRecording: vi.fn(),
    pauseOperationReplay: vi.fn(),
    replayOperationRecording: vi.fn(),
    jumpOperationRecording: vi.fn(),
    exportOperationRecordingSlides: vi.fn(),
  })),
}));

vi.mock('../useEditorShellPanelCallbacks', () => ({
  useEditorShellPanelCallbacks: vi.fn(() => ({
    leftPanelCallbacks: {},
  })),
}));

vi.mock('../useEditorShellFloatingDialogsCallbacks', () => ({
  useEditorShellFloatingDialogsCallbacks: vi.fn(() => ({
    floatingDialogsCallbacks: {},
  })),
}));

// ── Import under test ─────────────────────────────────────────

import { useEditorShellOrchestrator } from '../useEditorShellOrchestrator';

// ── Tests ─────────────────────────────────────────────────────

describe('useEditorShellOrchestrator', () => {
  const mockStore = {
    layoutSettings: {},
    setLayoutSettings: vi.fn(),
    colorAnalysisBusy: false,
    colorAnalysisResults: null,
    colorAnalysisSamples: null,
    pipLayoutPosition: null,
    customSplitLayouts: [],
    setCustomSplitLayouts: vi.fn(),
    projectPath: null,
    addMedia: vi.fn(),
    setSelectedClipId: vi.fn(),
    setSelectedClipIds: vi.fn(),
    setPlayheadTime: vi.fn(),
    setVideoStitchWizardOpen: vi.fn(),
    setTemplateExportPreset: vi.fn(),
    setTutorialSignals: vi.fn(),
    project: { settings: { fps: 30 }, beatMarkers: [], media: [], mediaMetadata: {}, timeline: { tracks: [] } },
    selectedClipIds: [],
    setProject: vi.fn(),
    setDirty: vi.fn(),
    setRecoveryCandidate: vi.fn(),
    clearSelectedClipIds: vi.fn(),
    setContentAnalysisRunningClipId: vi.fn(),
    projectHealthReport: null,
    demucsAvailability: false,
    demucsExecutablePath: null,
    audioSeparationClipId: null,
    speakerDiarizationResult: null,
    autoAudioSyncResults: null,
    autoAudioSyncMode: 'waveform' as const,
    recordingTask: null,
    recordingSettings: null,
    beatSyncSpeedEnabled: false,
    beatSyncManualBpm: null,
    beatSensitivity: 0.5,
    proxySettings: null,
    setThumbnailGeneratorAssetIds: vi.fn(),
    setGifExportAsset: vi.fn(),
    setSpectrumAsset: vi.fn(),
    setMediaMetadata: vi.fn(),
    profilerRecording: false,
    profilerElapsedMs: 0,
    profilerReport: null,
    operationRecording: null,
    operationRecordingActive: false,
    operationReplayRunning: false,
    operationRecordingStep: 0,
    operationReplaySpeed: 1,
    colorAnalysisJumps: null,
    templateExportPreset: null,
    recoveryCandidate: null,
    archiveProgress: null,
  };

  const mockDerived = {
    canApplySplitLayout: false,
    selectedPiPClips: [],
    selectedSplitLayoutClips: [],
    visualTimelineClipRefs: {},
    selectedClip: null,
    selectedClipMedia: null,
    speakerDiarizationTarget: null,
    autoAudioSyncTargets: [],
    resolvedAutoAudioSyncPrimaryClipId: null,
    beatSyncBeatTimes: [],
    contentAnalysisTargets: [],
    syncCompareClipRefs: [],
    detectedBeatBpm: null,
    canDetectBeats: false,
    canSnapToBeats: false,
  };

  const mockExportQueue = {
    setExportDialogOpen: vi.fn(),
    exportCurrentFrame: vi.fn(),
    exportDialogOpen: false,
    timelineExportDialogOpen: false,
    setTimelineExportDialogOpen: vi.fn(),
    lastExportPath: null,
    setLastExportPath: vi.fn(),
    exportQueueRecovery: null,
    sharePackageProgress: null,
    restoreExportQueueRecovery: vi.fn(),
    discardExportQueueRecovery: vi.fn(),
  };

  const mockStateSetters = {
    setCommandPaletteOpen: vi.fn(),
    setGestureTutorialOpen: vi.fn(),
    setRoughCutCompareOpen: vi.fn(),
  };

  it('returns all expected callback groups without throwing', () => {
    const { result } = renderHook(() =>
      useEditorShellOrchestrator(mockStore as any, mockDerived as any, mockExportQueue as any, mockStateSetters),
    );

    expect(result.current).toBeDefined();

    // Profiler
    expect(typeof result.current.handleProfilerFrame).toBe('function');
    expect(typeof result.current.startProfilerRecording).toBe('function');

    // View settings
    expect(typeof result.current.saveCurrentWorkspaceLayout).toBe('function');
    expect(typeof result.current.toggleSafeFrameGuides).toBe('function');

    // Project
    expect(typeof result.current.requestProjectPassword).toBe('function');
    expect(typeof result.current.saveProject).toBe('function');
    expect(typeof result.current.newProject).toBe('function');
    expect(typeof result.current.openProject).toBe('function');

    // Media
    expect(typeof result.current.importMedia).toBe('function');
    expect(typeof result.current.relinkAllMissing).toBe('function');
    expect(typeof result.current.scanDuplicateMedia).toBe('function');

    // Playback
    expect(typeof result.current.undo).toBe('function');
    expect(typeof result.current.redo).toBe('function');
    expect(typeof result.current.togglePlayback).toBe('function');
    expect(typeof result.current.pausePlayback).toBe('function');

    // Timeline
    expect(typeof result.current.addAssetToTimeline).toBe('function');
    expect(typeof result.current.deleteSelected).toBe('function');
    expect(typeof result.current.splitSelected).toBe('function');
    expect(typeof result.current.selectAllTimelineItems).toBe('function');

    // Inline
    expect(typeof result.current.importSubtitles).toBe('function');
    expect(typeof result.current.restoreRecovery).toBe('function');
    expect(typeof result.current.inlineShortcutHandlers).toBeDefined();

    // Content analysis
    expect(typeof result.current.runSingleContentAnalysis).toBe('function');
    expect(typeof result.current.analyzeContentClip).toBe('function');

    // Health
    expect(typeof result.current.refreshProjectHealth).toBe('function');
    expect(typeof result.current.autoRepairProjectHealth).toBe('function');

    // Audio
    expect(typeof result.current.separateSelectedAudio).toBe('function');
    expect(typeof result.current.runSpeakerDiarization).toBe('function');

    // Beat sync
    expect(typeof result.current.detectSelectedBeats).toBe('function');
    expect(typeof result.current.snapSelectedToBeats).toBe('function');

    // Proxy
    expect(typeof result.current.generateProxyForMedia).toBe('function');
    expect(typeof result.current.deleteProxiesForMedia).toBe('function');

    // Operation recording
    expect(typeof result.current.startMacroRecording).toBe('function');
    expect(typeof result.current.stopMacroRecording).toBe('function');

    // Composed callbacks
    expect(result.current.leftPanelCallbacks).toBeDefined();
    expect(result.current.floatingDialogsCallbacks).toBeDefined();
  });

  it('returns unique callback references (no accidental sharing)', () => {
    const { result } = renderHook(() =>
      useEditorShellOrchestrator(mockStore as any, mockDerived as any, mockExportQueue as any, mockStateSetters),
    );

    // Verify undo and redo are different functions
    expect(result.current.undo).not.toBe(result.current.redo);
    expect(result.current.togglePlayback).not.toBe(result.current.pausePlayback);
    expect(result.current.deleteSelected).not.toBe(result.current.rippleDeleteSelected);
  });
});

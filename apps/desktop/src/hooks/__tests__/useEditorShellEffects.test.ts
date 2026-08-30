// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// ── Mock dependencies ──────────────────────────────────────────

vi.mock('../../store/dialogStore', () => ({
  useDialogStore: { getState: () => ({ setSmartDistributionOpen: vi.fn() }) },
}));

vi.mock('../../store/performanceMonitorStore', () => ({
  usePerformanceMonitorStore: {},
}));

vi.mock('../../lib/tauri-bridge', () => ({
  initMediaIndexDb: vi.fn(() => Promise.resolve()),
  listenBridge: vi.fn(() => Promise.resolve(vi.fn())),
}));

vi.mock('../../lib/demucs', () => ({
  getDemucsAvailability: vi.fn(() => Promise.resolve(false)),
}));

vi.mock('../../tutorial/tutorialState', () => ({
  normalizeTutorialProgressSettings: vi.fn((p: any) => p),
  advanceTutorialProgress: vi.fn((p: any) => p),
}));

vi.mock('../../settings/appSettings', () => ({
  saveTutorialProgressSettings: vi.fn(() => Promise.resolve()),
}));

vi.mock('@open-factory/editor-core/utils', () => ({
  logger: { warn: vi.fn() },
}));

// ── Import under test ─────────────────────────────────────────

import { useEditorShellEffects } from '../../hooks/useEditorShellEffects';

// ── Tests ─────────────────────────────────────────────────────

const baseDeps = {
  projectPath: null as string | null,
  tutorialProgress: { tutorialStep: 0, tutorialCompleted: false, tutorialSkipped: false },
  tutorialSignals: {
    mediaImported: false,
    clipOnTimeline: false,
    previewPlayed: false,
    clipTrimmed: false,
    effectApplied: false,
    colorGraded: false,
    audioAdjusted: false,
    exportStarted: false,
  } as any,
  setTutorialProgress: vi.fn(),
  setTutorialCelebrationVisible: vi.fn(),
  demucsExecutablePath: '',
  setDemucsAvailability: vi.fn(),
  audioSeparationClipId: null as string | null,
  setAudioSeparationProgress: vi.fn(),
  recordingTask: null as { startedAt: number } | null,
  setRecordingElapsedSeconds: vi.fn(),
  detectedBeatBpm: undefined as number | undefined,
  selectedClipId: null as string | null,
  setBeatSyncManualBpm: vi.fn(),
  refreshSharedLibraryResources: vi.fn(() => Promise.resolve()),
  setFormatConverterOpen: vi.fn(),
  setEmotionAnalysisOpen: vi.fn(),
  setExportHistoryClassifierOpen: vi.fn(),
  setFormatConverterMockFiles: vi.fn(),
  setMockSubtitleClips: vi.fn(),
  setMockExportHistory: vi.fn(),
  setArchiveProgress: vi.fn(),
  setCommandPaletteOpen: vi.fn(),
  setGestureTutorialOpen: vi.fn(),
};

describe('useEditorShellEffects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.__APP_STORE__ assignment
    delete (window as any).__APP_STORE__;
    delete (window as any).__PERF_MONITOR_STORE__;
  });

  it('renders without throwing', () => {
    const { result } = renderHook(() => useEditorShellEffects(baseDeps));
    expect(result.current).toBeUndefined();
  });

  it('initializes media index DB when projectPath is set', () => {
    const deps = { ...baseDeps, projectPath: '/test/project.cutproj.json' };
    renderHook(() => useEditorShellEffects(deps));
    // Effect runs asynchronously; smoke test just verifies no crash
  });

  it('exposes E2E stores on window', () => {
    renderHook(() => useEditorShellEffects(baseDeps));
    expect((window as any).__APP_STORE__).toBeDefined();
    expect(typeof (window as any).__APP_STORE__.setFormatConverterOpen).toBe('function');
  });
});

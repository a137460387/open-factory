// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

// ── Mock dependencies ──────────────────────────────────────────

vi.mock('../../store/editorStore', () => ({
  useEditorStore: { getState: () => ({ project: { media: [], timeline: { tracks: [] } } }) },
}));

vi.mock('../../store/commandManager', () => ({
  commandManager: { execute: vi.fn() },
  projectAccessor: {},
  timelineAccessor: { getTimeline: () => ({ tracks: [] }), setTimeline: vi.fn() },
}));

vi.mock('../../store/dialogStore', () => ({
  useDialogStore: { getState: () => ({}) },
}));

vi.mock('../../lib/media', () => ({
  pickMediaPaths: vi.fn(() => []),
  probeMediaPaths: vi.fn(() => Promise.resolve([])),
}));

vi.mock('../../media/media-index-integration', () => ({
  indexAndTagImportedMedia: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../lib/subtitles', () => ({
  buildSubtitleTrackFromDataCues: vi.fn(),
  buildSubtitleTrackFromSrt: vi.fn(),
  collectSubtitleSpeakersFromTrack: vi.fn(() => []),
  isSubtitlePath: vi.fn(() => false),
  parseSubtitleDataFile: vi.fn(() => []),
  pickSubtitleDataPaths: vi.fn(() => []),
  pickSubtitlePaths: vi.fn(() => []),
  readSubtitleText: vi.fn(() => Promise.resolve('')),
}));

vi.mock('../../lib/toast', () => ({ showToast: vi.fn() }));
vi.mock('../../lib/tauri-bridge', () => ({ bridgeConfirm: vi.fn() }));
vi.mock('../../lib/projectFiles', () => ({
  readProjectFile: vi.fn(),
  discardAutosaveRecovery: vi.fn(),
  isEncryptedProjectPath: vi.fn(() => false),
}));
vi.mock('../../lib/timeline-clip-helpers', () => ({
  getSubtitleDataImportTargetTrackId: vi.fn(() => null),
}));

// ── Import under test ─────────────────────────────────────────

import { useEditorShellInlineCallbacks } from '../../hooks/useEditorShellInlineCallbacks';

// ── Tests ─────────────────────────────────────────────────────

const baseDeps = {
  addMedia: vi.fn(),
  setSelectedClipId: vi.fn(),
  setSelectedClipIds: vi.fn(),
  setPlayheadTime: vi.fn(),
  setVideoStitchWizardOpen: vi.fn(),
  setExportDialogOpen: vi.fn(),
  setTemplateExportPreset: vi.fn(),
  persistMediaFingerprints: vi.fn(),
  queueFrameRateConversionForImportedMedia: vi.fn(),
  runAutomationForMedia: vi.fn(),
  setTutorialSignals: vi.fn(),
  projectPath: null as string | null,
  project: { media: [], timeline: { tracks: [] } } as any,
  selectedClipIds: [] as string[],
  requestProjectPassword: vi.fn(),
  setProject: vi.fn(),
  setDirty: vi.fn(),
  setRecoveryCandidate: vi.fn(),
  applyImportedMediaColorConversionChoice: vi.fn(),
  togglePlayback: vi.fn(),
  reversePlayback: vi.fn(),
  pausePlayback: vi.fn(),
  forwardPlayback: vi.fn(),
  stepFrame: vi.fn(),
  markInPoint: vi.fn(),
  markOutPoint: vi.fn(),
  markMultiRangeInPoint: vi.fn(),
  markMultiRangeOutPoint: vi.fn(),
  deleteSelected: vi.fn(),
  rippleDeleteSelected: vi.fn(),
  splitSelected: vi.fn(),
  selectAllTimelineItems: vi.fn(),
  clearSelectedClipIds: vi.fn(),
  addAnnotationAtPlayhead: vi.fn(),
  addBookmarkAtPlayhead: vi.fn(),
  toggleTimelineGridSnap: vi.fn(),
  jumpTimelineNavigationPoint: vi.fn(),
  undo: vi.fn(),
  switchToPreviousHistoryBranch: vi.fn(),
  redo: vi.fn(),
  saveProject: vi.fn(),
  exportCurrentFrame: vi.fn(),
  matchFrameToSource: vi.fn(),
  revealMediaInTimeline: vi.fn(),
  navigateToNextInstance: vi.fn(),
  navigatePrevGap: vi.fn(),
  navigateNextGap: vi.fn(),
  renderInOutRegion: vi.fn(),
  closeGapAtPlayhead: vi.fn(),
};

describe('useEditorShellInlineCallbacks', () => {
  it('returns expected callback functions', () => {
    const { result } = renderHook(() => useEditorShellInlineCallbacks(baseDeps));
    expect(typeof result.current.importVideosForStitchWizard).toBe('function');
    expect(typeof result.current.generateVideoStitchTimeline).toBe('function');
    expect(typeof result.current.generateSmartMontage).toBe('function');
    expect(typeof result.current.importSubtitles).toBe('function');
    expect(typeof result.current.importDataSubtitles).toBe('function');
    expect(typeof result.current.restoreRecovery).toBe('function');
    expect(typeof result.current.discardRecovery).toBe('function');
    expect(typeof result.current.importDropped).toBe('function');
    expect(typeof result.current.shortcutHandlers).toBeDefined();
  });
});

// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ── Mock stores (paths relative to __tests__/ dir) ─────────────

let mockFeatureState: Record<string, any>;
let mockUIState: Record<string, any>;
let mockEditorState: Record<string, any>;

vi.mock('../../store/editorStore', () => ({
  useEditorStore: { getState: () => mockEditorState },
  selectClipById: vi.fn(),
  findMulticamClipInProject: vi.fn(),
}));

vi.mock('../../store/commandManager', () => ({
  commandManager: { execute: vi.fn() },
  projectAccessor: {},
  timelineAccessor: { getTimeline: () => ({ tracks: [] }), setTimeline: vi.fn() },
}));

vi.mock('../../store/editorFeatureStore', () => ({
  useEditorFeatureStore: { getState: () => mockFeatureState },
}));

vi.mock('../../store/editorUIStore', () => ({
  useEditorUIStore: { getState: () => mockUIState },
}));

vi.mock('../../store/editorSettingsStore', () => ({
  useEditorSettingsStore: { getState: () => ({}) },
}));

vi.mock('../../store/proxySettingsStore', () => ({
  useProxySettingsStore: { getState: () => ({ settings: {} }) },
}));

vi.mock('../../store/recordingSettingsStore', () => ({
  useRecordingSettingsStore: { getState: () => ({}) },
}));

vi.mock('../../media/media-job-store', () => ({
  useMediaJobStore: { getState: () => ({}) },
}));

vi.mock('../../media/media-job-runner', () => ({
  ensureMediaJobRunner: vi.fn(),
}));

vi.mock('../../lib/toast', () => ({ showToast: vi.fn() }));
vi.mock('../../lib/tauri-bridge', () => ({
  bridgeConfirm: vi.fn(), cancelDemucs: vi.fn(), detectBeats: vi.fn(),
  startRecording: vi.fn(), stopRecording: vi.fn(),
}));
vi.mock('../../lib/projectHealth', () => ({
  scanProjectHealth: vi.fn(() => Promise.resolve({ issues: [] })),
  buildProjectHealthAutoRepairInput: vi.fn(),
}));
vi.mock('../../lib/mediaHealthDashboard', () => ({
  scanMediaHealthDashboard: vi.fn(() => Promise.resolve({ dashboard: {}, report: { issues: [] } })),
  writeMediaHealthAutoShowEnabled: vi.fn(),
}));
vi.mock('../../lib/demucs', () => ({ separateAudioForClip: vi.fn() }));
vi.mock('../../lib/speakerDiarization', () => ({ analyzeSpeakerDiarizationForClip: vi.fn() }));
vi.mock('../../lib/autoAudioSync', () => ({ analyzeAutoAudioSyncTargets: vi.fn() }));
vi.mock('../../lib/content-analysis-helpers', () => ({ collectSpeakerDiarizationDialogueIntervals: vi.fn(() => []) }));
vi.mock('../../media/relink', () => ({ relinkSingleMedia: vi.fn() }));
vi.mock('../../lib/media', () => ({ probeMediaPaths: vi.fn() }));

// ── Import under test ─────────────────────────────────────────

import { useProjectHealthCallbacks } from '../../hooks/useEditorShellCallbacks';

// ── Tests ─────────────────────────────────────────────────────

describe('useProjectHealthCallbacks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFeatureState = {
      setProjectHealthScanning: vi.fn(),
      setProjectHealthReport: vi.fn(),
      setProjectHealthRepairReport: vi.fn(),
      setMediaHealthScanning: vi.fn(),
      setMediaHealthDashboard: vi.fn(),
      setMediaHealthAutoShowEnabled: vi.fn(),
    };
    mockUIState = {
      setProjectHealthOpen: vi.fn(),
      setMediaHealthDashboardOpen: vi.fn(),
    };
    mockEditorState = {
      project: { media: [], timeline: { tracks: [] } },
      setMedia: vi.fn(),
    };
  });

  it('returns expected callback functions', () => {
    const { result } = renderHook(() =>
      useProjectHealthCallbacks({ projectHealthReport: undefined }),
    );

    expect(typeof result.current.refreshProjectHealth).toBe('function');
    expect(typeof result.current.openProjectHealth).toBe('function');
    expect(typeof result.current.setMediaHealthAutoShow).toBe('function');
    expect(typeof result.current.autoRepairProjectHealth).toBe('function');
  });

  it('setMediaHealthAutoShow calls store setter', () => {
    const { result } = renderHook(() =>
      useProjectHealthCallbacks({ projectHealthReport: undefined }),
    );

    act(() => {
      result.current.setMediaHealthAutoShow(true);
    });

    expect(mockFeatureState.setMediaHealthAutoShowEnabled).toHaveBeenCalledWith(true);
  });

  it('openProjectHealth triggers UI state', () => {
    const { result } = renderHook(() =>
      useProjectHealthCallbacks({ projectHealthReport: undefined }),
    );

    act(() => {
      result.current.openProjectHealth();
    });

    expect(mockUIState.setProjectHealthOpen).toHaveBeenCalledWith(true);
  });
});

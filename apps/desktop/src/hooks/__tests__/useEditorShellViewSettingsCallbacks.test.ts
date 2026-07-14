// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// ── Mock 外部依赖 ────────────────────────────────────────────

const mockSetSafeFrameGuides = vi.fn();
const mockSetThumbnailTrackVisible = vi.fn();
const mockSetTimelineMinimapVisible = vi.fn();
const mockSetTimelineHeatmap = vi.fn();
const mockSetPreviewPerformance = vi.fn();
const mockSetTimelineInteractionSettings = vi.fn();
const mockSetPreviewWindowResolutionScale = vi.fn();
const mockSetTimelineGridSettings = vi.fn();
const mockSetPreviewWindowOpen = vi.fn();

let mockEditorSettingsState: Record<string, any>;
let mockEditorUIState: Record<string, any>;
let mockEditorState: Record<string, any>;
let mockMediaJobState: Record<string, any>;
let mockProxySettingsState: Record<string, any>;

vi.mock('../../store/editorSettingsStore', () => ({
  useEditorSettingsStore: {
    getState: () => mockEditorSettingsState,
  },
}));

vi.mock('../../store/editorUIStore', () => ({
  useEditorUIStore: {
    getState: () => mockEditorUIState,
  },
}));

vi.mock('../../store/editorStore', () => ({
  useEditorStore: {
    getState: () => mockEditorState,
  },
}));

vi.mock('../../store/proxySettingsStore', () => ({
  useProxySettingsStore: {
    getState: () => mockProxySettingsState,
  },
}));

vi.mock('../../media/media-job-store', () => ({
  useMediaJobStore: {
    getState: () => mockMediaJobState,
  },
}));

vi.mock('../../media/media-job-runner', () => ({
  ensureMediaJobRunner: vi.fn(),
}));

vi.mock('../../lib/toast', () => ({
  showToast: vi.fn(),
}));

vi.mock('../../lib/tauri-bridge', () => ({
  emitBridge: vi.fn(),
  closePreviewWindow: vi.fn(),
  openPreviewWindow: vi.fn(),
  sendNotification: vi.fn(),
}));

vi.mock('../../lib/ui-helpers', () => ({
  readViewportSize: vi.fn(() => ({ width: 1920, height: 1080 })),
  moveAutomationMediaToGroup: vi.fn(),
}));

vi.mock('../../lib/previewWindowSync', () => ({
  createPreviewWindowPlaybackState: vi.fn(() => ({})),
}));

vi.mock('../../settings/appSettings', () => ({
  normalizeTimelineHeatmapViewSettings: vi.fn((settings: any) => settings),
  saveLayoutSettings: vi.fn(() => Promise.resolve()),
  saveTimelineGridSettings: vi.fn((settings: any) => Promise.resolve(settings)),
  saveTimelineInteractionSettings: vi.fn((settings: any) => Promise.resolve(settings)),
  saveViewSettings: vi.fn(() => Promise.resolve({})),
  savePreviewWindowSettings: vi.fn(() => Promise.resolve()),
  savePreviewPerformanceSettings: vi.fn((settings: any) => Promise.resolve(settings)),
  readPreviewWindowSettings: vi.fn(() => Promise.resolve({})),
}));

vi.mock('../../layout/layoutSettings', () => ({
  clampTimelineHeight: vi.fn((h: number) => Math.max(120, Math.min(600, h))),
  createCustomWorkspaceLayout: vi.fn((name: string) => ({
    id: `custom-${name}`,
    name,
    shortcutSlot: undefined,
  })),
}));

vi.mock('../../automation/automation-rules', () => ({
  runConfiguredAutomationForMedia: vi.fn(() => Promise.resolve()),
}));

// ── 导入被测 Hook ────────────────────────────────────────────

import { useEditorShellViewSettingsCallbacks } from '../useEditorShellViewSettingsCallbacks';

// ── 测试 ─────────────────────────────────────────────────────

describe('useEditorShellViewSettingsCallbacks', () => {
  let mockSetLayoutSettings: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSetLayoutSettings = vi.fn((updater: any) => {
      if (typeof updater === 'function') {
        return updater({ customWorkspaceLayouts: [] });
      }
      return updater;
    });

    mockEditorSettingsState = {
      setSafeFrameGuides: mockSetSafeFrameGuides,
      setThumbnailTrackVisible: mockSetThumbnailTrackVisible,
      setTimelineMinimapVisible: mockSetTimelineMinimapVisible,
      setTimelineHeatmap: mockSetTimelineHeatmap,
      setPreviewPerformance: mockSetPreviewPerformance,
      setTimelineInteractionSettings: mockSetTimelineInteractionSettings,
      setPreviewWindowResolutionScale: mockSetPreviewWindowResolutionScale,
      setTimelineGridSettings: mockSetTimelineGridSettings,
      previewPerformance: {},
    };

    mockEditorUIState = {
      setPreviewWindowOpen: mockSetPreviewWindowOpen,
    };

    mockEditorState = {
      project: { name: 'TestProject', media: [] },
      playheadTime: 0,
      isPlaying: false,
      setMediaMetadata: vi.fn(),
    };

    mockMediaJobState = {
      enqueueProxyJobsForMedia: vi.fn(),
    };

    mockProxySettingsState = {
      settings: {},
    };
  });

  // --- toggleSafeFrameGuides ---
  it('toggleSafeFrameGuides 切换安全框显示状态', () => {
    const { result } = renderHook(() =>
      useEditorShellViewSettingsCallbacks({
        layoutSettings: { customWorkspaceLayouts: [], timelineHeightPx: 300 } as any,
        setLayoutSettings: mockSetLayoutSettings,
      }),
    );

    result.current.toggleSafeFrameGuides();

    expect(mockSetSafeFrameGuides).toHaveBeenCalledTimes(1);
    // setSafeFrameGuides 接收一个 updater 函数
    const updater = mockSetSafeFrameGuides.mock.calls[0][0];
    expect(updater(false)).toBe(true);
    expect(updater(true)).toBe(false);
  });

  // --- toggleThumbnailTrackVisible ---
  it('toggleThumbnailTrackVisible 切换缩略图轨道显示状态', () => {
    const { result } = renderHook(() =>
      useEditorShellViewSettingsCallbacks({
        layoutSettings: { customWorkspaceLayouts: [], timelineHeightPx: 300 } as any,
        setLayoutSettings: mockSetLayoutSettings,
      }),
    );

    result.current.toggleThumbnailTrackVisible();

    expect(mockSetThumbnailTrackVisible).toHaveBeenCalledTimes(1);
    const updater = mockSetThumbnailTrackVisible.mock.calls[0][0];
    expect(updater(false)).toBe(true);
    expect(updater(true)).toBe(false);
  });

  // --- toggleTimelineMinimapVisible ---
  it('toggleTimelineMinimapVisible 切换小地图显示状态', () => {
    const { result } = renderHook(() =>
      useEditorShellViewSettingsCallbacks({
        layoutSettings: { customWorkspaceLayouts: [], timelineHeightPx: 300 } as any,
        setLayoutSettings: mockSetLayoutSettings,
      }),
    );

    result.current.toggleTimelineMinimapVisible();

    expect(mockSetTimelineMinimapVisible).toHaveBeenCalledTimes(1);
    const updater = mockSetTimelineMinimapVisible.mock.calls[0][0];
    expect(updater(false)).toBe(true);
    expect(updater(true)).toBe(false);
  });

  // --- updateTimelineGridSettings ---
  it('updateTimelineGridSettings 乐观更新网格设置并持久化', () => {
    const { result } = renderHook(() =>
      useEditorShellViewSettingsCallbacks({
        layoutSettings: { customWorkspaceLayouts: [], timelineHeightPx: 300 } as any,
        setLayoutSettings: mockSetLayoutSettings,
      }),
    );

    result.current.updateTimelineGridSettings({ unit: 'second' });

    expect(mockSetTimelineGridSettings).toHaveBeenCalledTimes(1);
    // 验证乐观更新使用了 updater 函数
    const updater = mockSetTimelineGridSettings.mock.calls[0][0];
    const result2 = updater({ unit: 'frames', enabled: true });
    expect(result2).toEqual({ unit: 'second', enabled: true });
  });

  // --- toggleTimelineGridSnap ---
  it('toggleTimelineGridSnap 切换网格吸附', () => {
    const { result } = renderHook(() =>
      useEditorShellViewSettingsCallbacks({
        layoutSettings: { customWorkspaceLayouts: [], timelineHeightPx: 300 } as any,
        setLayoutSettings: mockSetLayoutSettings,
      }),
    );

    result.current.toggleTimelineGridSnap();

    expect(mockSetTimelineGridSettings).toHaveBeenCalledTimes(1);
    const updater = mockSetTimelineGridSettings.mock.calls[0][0];
    expect(updater({ enabled: true, unit: 'frames' })).toEqual({ enabled: false, unit: 'frames' });
    expect(updater({ enabled: false, unit: 'frames' })).toEqual({ enabled: true, unit: 'frames' });
  });

  // --- changeTimelineGridUnit ---
  it('changeTimelineGridUnit 调用 updateTimelineGridSettings 更新单位', () => {
    const { result } = renderHook(() =>
      useEditorShellViewSettingsCallbacks({
        layoutSettings: { customWorkspaceLayouts: [], timelineHeightPx: 300 } as any,
        setLayoutSettings: mockSetLayoutSettings,
      }),
    );

    result.current.changeTimelineGridUnit('second');

    expect(mockSetTimelineGridSettings).toHaveBeenCalledTimes(1);
    const updater = mockSetTimelineGridSettings.mock.calls[0][0];
    const gridResult = updater({ unit: 'frames', enabled: false });
    expect(gridResult.unit).toBe('second');
  });

  // --- persistPreviewWindowState ---
  it('persistPreviewWindowState 在有 bounds 时持久化窗口状态', () => {
    const { result } = renderHook(() =>
      useEditorShellViewSettingsCallbacks({
        layoutSettings: { customWorkspaceLayouts: [], timelineHeightPx: 300 } as any,
        setLayoutSettings: mockSetLayoutSettings,
      }),
    );

    result.current.persistPreviewWindowState({
      open: true,
      bounds: { x: 10, y: 20, width: 800, height: 600 },
      alwaysOnTop: true,
      resolutionScale: 1.5,
    } as any);

    expect(mockSetPreviewWindowResolutionScale).toHaveBeenCalledWith(1.5);
  });

  it('persistPreviewWindowState 在无 bounds 时不执行操作', () => {
    const { result } = renderHook(() =>
      useEditorShellViewSettingsCallbacks({
        layoutSettings: { customWorkspaceLayouts: [], timelineHeightPx: 300 } as any,
        setLayoutSettings: mockSetLayoutSettings,
      }),
    );

    result.current.persistPreviewWindowState({
      open: true,
      bounds: undefined,
      alwaysOnTop: true,
      resolutionScale: 1.0,
    } as any);

    expect(mockSetPreviewWindowResolutionScale).not.toHaveBeenCalled();
  });

  // --- updateTimelineHeatmap ---
  it('updateTimelineHeatmap 乐观更新热力图设置', () => {
    const { result } = renderHook(() =>
      useEditorShellViewSettingsCallbacks({
        layoutSettings: { customWorkspaceLayouts: [], timelineHeightPx: 300 } as any,
        setLayoutSettings: mockSetLayoutSettings,
      }),
    );

    result.current.updateTimelineHeatmap({ opacity: 0.8 });

    expect(mockSetTimelineHeatmap).toHaveBeenCalledTimes(1);
    const updater = mockSetTimelineHeatmap.mock.calls[0][0];
    const heatmapResult = updater({ opacity: 0.5, colorScheme: 'warm' });
    expect(heatmapResult).toEqual({ opacity: 0.8, colorScheme: 'warm' });
  });

  // --- updatePreviewPerformance ---
  it('updatePreviewPerformance 乐观更新预览性能设置', () => {
    const { result } = renderHook(() =>
      useEditorShellViewSettingsCallbacks({
        layoutSettings: { customWorkspaceLayouts: [], timelineHeightPx: 300 } as any,
        setLayoutSettings: mockSetLayoutSettings,
      }),
    );

    result.current.updatePreviewPerformance({ qualityMode: 'half' });

    expect(mockSetPreviewPerformance).toHaveBeenCalledTimes(1);
    const updater = mockSetPreviewPerformance.mock.calls[0][0];
    const perfResult = updater({ qualityMode: 'full', skipFrames: 1 });
    expect(perfResult).toEqual({ qualityMode: 'half', skipFrames: 1 });
  });

  // --- updateTimelineInteractionSettings ---
  it('updateTimelineInteractionSettings 乐观更新交互设置', () => {
    const { result } = renderHook(() =>
      useEditorShellViewSettingsCallbacks({
        layoutSettings: { customWorkspaceLayouts: [], timelineHeightPx: 300 } as any,
        setLayoutSettings: mockSetLayoutSettings,
      }),
    );

    result.current.updateTimelineInteractionSettings({ reduceMotion: true });

    expect(mockSetTimelineInteractionSettings).toHaveBeenCalledTimes(1);
    const updater = mockSetTimelineInteractionSettings.mock.calls[0][0];
    const interactionResult = updater({ reduceMotion: false, audioScrubEnabled: true });
    expect(interactionResult).toEqual({ reduceMotion: true, audioScrubEnabled: true });
  });
});

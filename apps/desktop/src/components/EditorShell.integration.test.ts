// @vitest-environment jsdom
/**
 * EditorShell integration tests.
 * Tests the store→hook→derived-state chain without rendering the full component.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEditorStore } from '../store/editorStore';
import { useEditorUIStore } from '../store/editorUIStore';
import { usePerformanceMonitorStore } from '../store/performanceMonitorStore';

// Mock tauri-bridge to avoid IPC calls
vi.mock('../lib/tauri-bridge', () => ({
  analyzeWaveform: vi.fn().mockResolvedValue(null),
  readAiApiKey: vi.fn().mockResolvedValue(null),
  writeAiApiKey: vi.fn().mockResolvedValue(undefined),
  checkOllamaReachable: vi.fn().mockResolvedValue(false),
  listOllamaModels: vi.fn().mockResolvedValue({ models: [] }),
  testAiConnection: vi.fn().mockResolvedValue(true),
  searchMediaAssets: vi.fn().mockResolvedValue({ assets: [], total: 0, page: 1, pageSize: 50 }),
  getAllTags: vi.fn().mockResolvedValue([]),
}));

vi.mock('../settings/appSettings', () => ({
  saveLocalAiModelsSettings: vi.fn().mockResolvedValue(undefined),
  saveLayoutSettings: vi.fn(),
  readViewportSize: vi.fn().mockReturnValue({ width: 1920, height: 1080 }),
}));

vi.mock('../lib/projectFiles', () => ({
  DEFAULT_AUTOSAVE_INTERVAL_SECONDS: 30,
  writeAutosaveProjectSafely: vi.fn().mockResolvedValue(undefined),
}));

describe('EditorShell integration: store subscriptions', () => {
  beforeEach(() => {
    // Reset stores
    useEditorStore.setState({
      project: { name: 'test', timelines: [] } as never,
      selectedClipId: undefined,
      selectedClipIds: [],
      isPlaying: false,
      dirty: false,
      projectPath: undefined,
      playheadTime: 0,
      inPoint: undefined,
      outPoint: undefined,
    });
  });

  it('editorStore selector 订阅精确字段', () => {
    const { result } = renderHook(() => {
      const selectedClipId = useEditorStore((s) => s.selectedClipId);
      const isPlaying = useEditorStore((s) => s.isPlaying);
      const dirty = useEditorStore((s) => s.dirty);
      return { selectedClipId, isPlaying, dirty };
    });

    expect(result.current.selectedClipId).toBeUndefined();
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.dirty).toBe(false);

    act(() => {
      useEditorStore.setState({ selectedClipId: 'clip-1', dirty: true });
    });

    expect(result.current.selectedClipId).toBe('clip-1');
    expect(result.current.dirty).toBe(true);
    expect(result.current.isPlaying).toBe(false);
  });

  it('editorUIStore dialog setter 更新正确', () => {
    const { result } = renderHook(() => useEditorUIStore((s) => s.setBatchTranscodeOpen));

    act(() => {
      result.current(true);
    });

    expect(useEditorUIStore.getState().batchTranscodeOpen).toBe(true);
  });

  it('performanceMonitorStore alert 联动', () => {
    const { result } = renderHook(() => ({
      alerts: usePerformanceMonitorStore((s) => s.alerts),
      setPanelOpen: usePerformanceMonitorStore((s) => s.setPanelOpen),
    }));

    expect(result.current.alerts).toHaveLength(0);

    // Simulate alert injection
    act(() => {
      usePerformanceMonitorStore.setState({
        alerts: [
          { id: 'test-alert', type: 'memory', severity: 'warning', message: 'Test', suggestion: 'Fix it', action: 'clear-undo-history', triggeredAt: new Date().toISOString(), currentValue: 80, thresholdValue: 70 },
        ],
      });
    });

    expect(result.current.alerts).toHaveLength(1);
    expect(result.current.alerts[0].message).toBe('Test');
  });
});

describe('EditorShell integration: store action chains', () => {
  it('setSelectedClipId → selectedClipId 更新', () => {
    const { result } = renderHook(() => ({
      selectedClipId: useEditorStore((s) => s.selectedClipId),
      setSelectedClipId: useEditorStore((s) => s.setSelectedClipId),
    }));

    act(() => {
      result.current.setSelectedClipId('clip-42');
    });

    expect(result.current.selectedClipId).toBe('clip-42');
  });

  it('setIsPlaying → isPlaying 切换', () => {
    const { result } = renderHook(() => ({
      isPlaying: useEditorStore((s) => s.isPlaying),
      setIsPlaying: useEditorStore((s) => s.setIsPlaying),
    }));

    act(() => {
      result.current.setIsPlaying(true);
    });

    expect(result.current.isPlaying).toBe(true);

    act(() => {
      result.current.setIsPlaying(false);
    });

    expect(result.current.isPlaying).toBe(false);
  });

  it('多字段同时更新保持一致性', () => {
    const { result } = renderHook(() => ({
      selectedClipIds: useEditorStore((s) => s.selectedClipIds),
      setSelectedClipIds: useEditorStore((s) => s.setSelectedClipIds),
      clearSelectedClipIds: useEditorStore((s) => s.clearSelectedClipIds),
    }));

    act(() => {
      result.current.setSelectedClipIds(['a', 'b', 'c']);
    });

    expect(result.current.selectedClipIds).toEqual(['a', 'b', 'c']);

    act(() => {
      result.current.clearSelectedClipIds();
    });

    expect(result.current.selectedClipIds).toEqual([]);
  });
});

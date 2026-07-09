// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// ── Mock 外部依赖 ────────────────────────────────────────────

const mockSetSelectedClipIds = vi.fn();
const mockSetSelectedClipId = vi.fn();
const mockSetMediaVersionCompare = vi.fn();
const mockSetSyncCompareOpen = vi.fn();
const mockSetPlayheadTime = vi.fn();
const mockSetFavoriteIds = vi.fn();
const mockSetPinnedIds = vi.fn();

let mockEditorState: Record<string, any>;
let mockEditorFeatureState: Record<string, any>;
let mockEditorUIState: Record<string, any>;
let mockEditorMiscState: Record<string, any>;

vi.mock('../../store/editorStore', () => ({
  useEditorStore: Object.assign(
    (selector: any) => {
      if (typeof selector === 'function') return selector(mockEditorState);
      return undefined;
    },
    {
      getState: () => mockEditorState,
    }
  ),
}));

vi.mock('../../store/editorFeatureStore', () => ({
  useEditorFeatureStore: Object.assign(
    (selector: any) => {
      if (typeof selector === 'function') return selector(mockEditorFeatureState);
      return undefined;
    },
    {
      getState: () => mockEditorFeatureState,
    }
  ),
}));

vi.mock('../../store/editorUIStore', () => ({
  useEditorUIStore: Object.assign(
    (selector: any) => {
      if (typeof selector === 'function') return selector(mockEditorUIState);
      return undefined;
    },
    {
      getState: () => mockEditorUIState,
    }
  ),
}));

vi.mock('../../store/editorMiscStore', () => ({
  useEditorMiscStore: {
    getState: () => mockEditorMiscState,
  },
}));

vi.mock('../../cache/cache-service', () => ({
  clearMediaCache: vi.fn(),
}));

vi.mock('../../lib/toast', () => ({
  showToast: vi.fn(),
}));

vi.mock('../../lib/mediaReport', () => ({
  saveOfflineMediaReport: vi.fn(),
  saveClipReport: vi.fn(),
}));

vi.mock('@open-factory/editor-core', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    buildMediaVersionCompareRequest: vi.fn(),
    findSyncCompareClipRefs: vi.fn(() => []),
    revealInTimeline: vi.fn(),
  };
});

// ── 导入被测 Hook 和辅助 ─────────────────────────────────────

import { useEditorShellMiscCallbacks } from '../useEditorShellMiscCallbacks';
import { clearMediaCache } from '../../cache/cache-service';
import { saveOfflineMediaReport, saveClipReport } from '../../lib/mediaReport';
import { showToast } from '../../lib/toast';
import { buildMediaVersionCompareRequest, findSyncCompareClipRefs, revealInTimeline } from '@open-factory/editor-core';

// ── 测试 ─────────────────────────────────────────────────────

describe('useEditorShellMiscCallbacks', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockEditorState = {
      project: {
        name: 'TestProject',
        timeline: { tracks: [{ id: 'track-1', clips: [] }] },
        sequences: [],
        media: [],
      },
      selectedClipIds: [],
      playheadTime: 0,
      setSelectedClipIds: mockSetSelectedClipIds,
      setSelectedClipId: mockSetSelectedClipId,
      setPlayheadTime: mockSetPlayheadTime,
    };

    mockEditorFeatureState = {
      setMediaVersionCompare: mockSetMediaVersionCompare,
    };

    mockEditorUIState = {
      setSyncCompareOpen: mockSetSyncCompareOpen,
    };

    mockEditorMiscState = {
      setFavoriteIds: mockSetFavoriteIds,
      setPinnedIds: mockSetPinnedIds,
    };
  });

  it('导出所有预期的函数', () => {
    const { result } = renderHook(() => useEditorShellMiscCallbacks());

    expect(result.current.createMediaReport).toBeDefined();
    expect(result.current.createClipReport).toBeDefined();
    expect(result.current.openMediaVersionCompare).toBeDefined();
    expect(result.current.openSyncCompare).toBeDefined();
    expect(result.current.clearCache).toBeDefined();
    expect(result.current.handleToggleFavorite).toBeDefined();
    expect(result.current.handlePinToSession).toBeDefined();
    expect(result.current.handleRevealFromMediaBin).toBeDefined();
  });

  // --- clearCache ---
  it('clearCache 成功时显示成功提示', async () => {
    vi.mocked(clearMediaCache).mockResolvedValue(undefined as any);

    const { result } = renderHook(() => useEditorShellMiscCallbacks());
    await result.current.clearCache();

    expect(clearMediaCache).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }));
  });

  it('clearCache 失败时显示错误提示', async () => {
    vi.mocked(clearMediaCache).mockRejectedValue(new Error('清理失败'));

    const { result } = renderHook(() => useEditorShellMiscCallbacks());
    await result.current.clearCache();

    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ kind: 'error' }));
  });

  // --- createMediaReport ---
  it('createMediaReport 成功时显示成功提示', async () => {
    vi.mocked(saveOfflineMediaReport).mockResolvedValue('/output/report.html');

    const { result } = renderHook(() => useEditorShellMiscCallbacks());
    await result.current.createMediaReport();

    expect(saveOfflineMediaReport).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }));
  });

  it('createMediaReport 失败时显示错误提示', async () => {
    vi.mocked(saveOfflineMediaReport).mockRejectedValue(new Error('生成失败'));

    const { result } = renderHook(() => useEditorShellMiscCallbacks());
    await result.current.createMediaReport();

    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ kind: 'error' }));
  });

  // --- createClipReport ---
  it('createClipReport 成功时显示成功提示', async () => {
    vi.mocked(saveClipReport).mockResolvedValue('/output/clip-report.html');

    const { result } = renderHook(() => useEditorShellMiscCallbacks());
    await result.current.createClipReport();

    expect(saveClipReport).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }));
  });

  it('createClipReport 失败时显示错误提示', async () => {
    vi.mocked(saveClipReport).mockRejectedValue(new Error('生成失败'));

    const { result } = renderHook(() => useEditorShellMiscCallbacks());
    await result.current.createClipReport();

    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ kind: 'error' }));
  });

  // --- openMediaVersionCompare ---
  it('openMediaVersionCompare 请求成功时设置版本对比状态', () => {
    const mockRequest = { assetId: 'media-1', versions: [] };
    vi.mocked(buildMediaVersionCompareRequest).mockReturnValue(mockRequest as any);

    const { result } = renderHook(() => useEditorShellMiscCallbacks());
    result.current.openMediaVersionCompare('media-1');

    expect(buildMediaVersionCompareRequest).toHaveBeenCalled();
    expect(mockSetMediaVersionCompare).toHaveBeenCalledWith(mockRequest);
  });

  it('openMediaVersionCompare 无法构建请求时显示警告', () => {
    vi.mocked(buildMediaVersionCompareRequest).mockReturnValue(undefined);

    const { result } = renderHook(() => useEditorShellMiscCallbacks());
    result.current.openMediaVersionCompare('media-1');

    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ kind: 'warning' }));
    expect(mockSetMediaVersionCompare).not.toHaveBeenCalled();
  });

  // --- openSyncCompare ---
  it('openSyncCompare 恰好有 2 个 clip 时打开同步对比', () => {
    const refs = [
      { clip: { id: 'clip-1', start: 1.0 } },
      { clip: { id: 'clip-2', start: 2.0 } },
    ];
    vi.mocked(findSyncCompareClipRefs).mockReturnValue(refs as any);

    const { result } = renderHook(() => useEditorShellMiscCallbacks());
    result.current.openSyncCompare();

    expect(mockSetPlayheadTime).toHaveBeenCalledWith(1.0); // Math.min(1.0, 2.0)
    expect(mockSetSyncCompareOpen).toHaveBeenCalledWith(true);
  });

  it('openSyncCompare 不是恰好 2 个 clip 时显示警告', () => {
    vi.mocked(findSyncCompareClipRefs).mockReturnValue([] as any);

    const { result } = renderHook(() => useEditorShellMiscCallbacks());
    result.current.openSyncCompare();

    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ kind: 'warning' }));
    expect(mockSetSyncCompareOpen).not.toHaveBeenCalled();
  });

  it('openSyncCompare 只有 1 个 clip 时显示警告', () => {
    vi.mocked(findSyncCompareClipRefs).mockReturnValue([{ clip: { id: 'clip-1' } }] as any);

    const { result } = renderHook(() => useEditorShellMiscCallbacks());
    result.current.openSyncCompare();

    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ kind: 'warning' }));
  });

  // --- handleToggleFavorite ---
  it('handleToggleFavorite 添加未收藏的资产', () => {
    mockSetFavoriteIds.mockImplementation((updater: any) => {
      const result = updater(['other-id']);
      expect(result).toContain('media-1');
      expect(result).toContain('other-id');
    });

    const { result } = renderHook(() => useEditorShellMiscCallbacks());
    result.current.handleToggleFavorite('media-1');

    expect(mockSetFavoriteIds).toHaveBeenCalled();
  });

  it('handleToggleFavorite 移除已收藏的资产', () => {
    mockSetFavoriteIds.mockImplementation((updater: any) => {
      const result = updater(['media-1', 'other-id']);
      expect(result).not.toContain('media-1');
      expect(result).toContain('other-id');
    });

    const { result } = renderHook(() => useEditorShellMiscCallbacks());
    result.current.handleToggleFavorite('media-1');

    expect(mockSetFavoriteIds).toHaveBeenCalled();
  });

  // --- handlePinToSession ---
  it('handlePinToSession 添加未固定的资产', () => {
    mockSetPinnedIds.mockImplementation((updater: any) => {
      const prev = new Set<string>(['other-id']);
      const result = updater(prev);
      expect(result.has('media-1')).toBe(true);
      expect(result.has('other-id')).toBe(true);
    });

    const { result } = renderHook(() => useEditorShellMiscCallbacks());
    result.current.handlePinToSession('media-1');

    expect(mockSetPinnedIds).toHaveBeenCalled();
  });

  it('handlePinToSession 移除已固定的资产', () => {
    mockSetPinnedIds.mockImplementation((updater: any) => {
      const prev = new Set<string>(['media-1', 'other-id']);
      const result = updater(prev);
      expect(result.has('media-1')).toBe(false);
      expect(result.has('other-id')).toBe(true);
    });

    const { result } = renderHook(() => useEditorShellMiscCallbacks());
    result.current.handlePinToSession('media-1');

    expect(mockSetPinnedIds).toHaveBeenCalled();
  });

  // --- handleRevealFromMediaBin ---
  it('handleRevealFromMediaBin 找到实例时选中 clip 并显示提示', () => {
    vi.mocked(revealInTimeline).mockReturnValue({
      instances: [{ clipId: 'clip-1' }, { clipId: 'clip-2' }],
    } as any);

    const { result } = renderHook(() => useEditorShellMiscCallbacks());
    result.current.handleRevealFromMediaBin('media-1');

    expect(mockSetSelectedClipIds).toHaveBeenCalledWith(['clip-1', 'clip-2']);
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ kind: 'info' }));
  });

  it('handleRevealFromMediaBin 未找到实例时显示警告', () => {
    vi.mocked(revealInTimeline).mockReturnValue({ instances: [] } as any);

    const { result } = renderHook(() => useEditorShellMiscCallbacks());
    result.current.handleRevealFromMediaBin('media-1');

    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ kind: 'warning' }));
    expect(mockSetSelectedClipIds).not.toHaveBeenCalled();
  });
});

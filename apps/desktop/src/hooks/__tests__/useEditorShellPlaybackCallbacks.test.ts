// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// ── Mock 外部依赖 ────────────────────────────────────────────

const mockSetIsPlaying = vi.fn();
const mockSetPlaybackRate = vi.fn();
const mockSetPlayheadTime = vi.fn();
const mockSetInPoint = vi.fn();
const mockSetOutPoint = vi.fn();
const mockCommandUndo = vi.fn();
const mockCommandRedo = vi.fn();
const mockCommandExecute = vi.fn();
const mockCommandSwitchToPreviousBranch = vi.fn();

let mockPlaybackState: Record<string, any>;

vi.mock('../../store/editorStore', () => ({
  useEditorStore: {
    getState: () => mockPlaybackState,
  },
}));

vi.mock('../../store/commandManager', () => ({
  commandManager: {
    undo: (...args: any[]) => mockCommandUndo(...args),
    redo: (...args: any[]) => mockCommandRedo(...args),
    execute: (...args: any[]) => mockCommandExecute(...args),
    switchToPreviousBranch: (...args: any[]) => mockCommandSwitchToPreviousBranch(...args),
  },
  projectAccessor: {
    getProject: () => mockPlaybackState?.project,
    setProject: vi.fn(),
  },
}));

vi.mock('../../lib/tauri-bridge', () => ({
  openFileDialog: vi.fn(),
  readFile: vi.fn(),
  saveFileDialog: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock('../../lib/toast', () => ({
  showToast: vi.fn(),
}));

vi.mock('../../review/reviewReport', () => ({
  saveReviewReport: vi.fn(),
}));

vi.mock('@open-factory/editor-core', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    getTimelineDuration: vi.fn((timeline: any) => {
      if (!timeline?.tracks?.length) return 0;
      return 10;
    }),
    buildTimelineNavigationPoints: vi.fn(() => []),
    findTimelineNavigationPoint: vi.fn(),
    createExportRange: vi.fn((input: any) => ({ ...input })),
    createId: vi.fn((prefix: string) => `${prefix}-mock-id`),
    normalizeExportRanges: vi.fn((ranges: any) => ranges ?? []),
    mergeImportedTimelineBookmarks: vi.fn(),
    parseTimelineBookmarksJson: vi.fn(),
    serializeTimelineBookmarks: vi.fn(() => '[]'),
    AddProjectAnnotationCommand: vi.fn(),
    AddReviewAnnotationCommand: vi.fn(),
    AddProjectBookmarkCommand: vi.fn(),
    UpdateProjectBookmarksCommand: vi.fn(),
    UpdateProjectExportRangesCommand: vi.fn(),
    DEFAULT_PROJECT_ANNOTATION_COLOR: '#ff0000',
    DEFAULT_REVIEW_ANNOTATION_COLOR: '#00ff00',
  };
});

// ── 导入被测 Hook ────────────────────────────────────────────

import { useEditorShellPlaybackCallbacks } from '../useEditorShellPlaybackCallbacks';

// ── 测试 ─────────────────────────────────────────────────────

describe('useEditorShellPlaybackCallbacks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPlaybackState = {
      project: {
        name: 'Test',
        settings: { fps: 30 },
        timeline: { tracks: [{ id: 'track-1', clips: [] }], markers: [] },
        annotations: [],
        bookmarks: [],
        exportRanges: [],
      },
      isPlaying: false,
      playheadTime: 0,
      inPoint: undefined,
      outPoint: undefined,
      setIsPlaying: mockSetIsPlaying,
      setPlaybackRate: mockSetPlaybackRate,
      setPlayheadTime: mockSetPlayheadTime,
      setInPoint: mockSetInPoint,
      setOutPoint: mockSetOutPoint,
    };
  });

  // --- togglePlayback ---
  it('togglePlayback 在停止状态时启动正向播放', () => {
    mockPlaybackState.isPlaying = false;

    const { result } = renderHook(() => useEditorShellPlaybackCallbacks());
    result.current.togglePlayback();

    expect(mockSetPlaybackRate).toHaveBeenCalledWith(1);
    expect(mockSetIsPlaying).toHaveBeenCalledWith(true);
  });

  it('togglePlayback 在播放状态时停止播放', () => {
    mockPlaybackState.isPlaying = true;

    const { result } = renderHook(() => useEditorShellPlaybackCallbacks());
    result.current.togglePlayback();

    expect(mockSetIsPlaying).toHaveBeenCalledWith(false);
  });

  it('togglePlayback 在时间线为空时不执行任何操作', () => {
    mockPlaybackState.project.timeline = { tracks: [], markers: [] };

    const { result } = renderHook(() => useEditorShellPlaybackCallbacks());
    result.current.togglePlayback();

    expect(mockSetIsPlaying).not.toHaveBeenCalled();
    expect(mockSetPlaybackRate).not.toHaveBeenCalled();
  });

  // --- stepFrame ---
  it('stepFrame(1) 前进一帧并暂停播放', () => {
    mockPlaybackState.playheadTime = 1.0;
    mockPlaybackState.project.settings.fps = 30;

    const { result } = renderHook(() => useEditorShellPlaybackCallbacks());
    result.current.stepFrame(1);

    expect(mockSetIsPlaying).toHaveBeenCalledWith(false);
    expect(mockSetPlaybackRate).toHaveBeenCalledWith(1);
    // 1.0 + 1/30 ≈ 1.0333...
    expect(mockSetPlayheadTime).toHaveBeenCalledWith(expect.closeTo(1 + 1 / 30, 6));
  });

  it('stepFrame(-1) 后退一帧', () => {
    mockPlaybackState.playheadTime = 2.0;
    mockPlaybackState.project.settings.fps = 24;

    const { result } = renderHook(() => useEditorShellPlaybackCallbacks());
    result.current.stepFrame(-1);

    expect(mockSetPlayheadTime).toHaveBeenCalledWith(expect.closeTo(2 - 1 / 24, 6));
  });

  it('stepFrame 在 fps 缺失时使用默认 30fps', () => {
    mockPlaybackState.playheadTime = 0;
    mockPlaybackState.project.settings.fps = undefined;

    const { result } = renderHook(() => useEditorShellPlaybackCallbacks());
    result.current.stepFrame(1);

    expect(mockSetPlayheadTime).toHaveBeenCalledWith(expect.closeTo(1 / 30, 6));
  });

  // --- undo / redo ---
  it('undo 调用 commandManager.undo', () => {
    const { result } = renderHook(() => useEditorShellPlaybackCallbacks());
    result.current.undo();

    expect(mockCommandUndo).toHaveBeenCalledTimes(1);
  });

  it('redo 调用 commandManager.redo', () => {
    const { result } = renderHook(() => useEditorShellPlaybackCallbacks());
    result.current.redo();

    expect(mockCommandRedo).toHaveBeenCalledTimes(1);
  });

  // --- pausePlayback ---
  it('pausePlayback 停止播放', () => {
    const { result } = renderHook(() => useEditorShellPlaybackCallbacks());
    result.current.pausePlayback();

    expect(mockSetIsPlaying).toHaveBeenCalledWith(false);
  });

  // --- markInPoint ---
  it('markInPoint 设置入点并当 outPoint 存在时创建单范围', () => {
    mockPlaybackState.playheadTime = 5.0;
    mockPlaybackState.outPoint = 10.0;

    const { result } = renderHook(() => useEditorShellPlaybackCallbacks());
    result.current.markInPoint();

    expect(mockSetInPoint).toHaveBeenCalledWith(5.0);
    // setSingleExportRange 应被调用（通过 UpdateProjectExportRangesCommand）
    expect(mockCommandExecute).toHaveBeenCalled();
  });

  it('markInPoint 仅设置入点，当 outPoint 未定义时不创建范围', () => {
    mockPlaybackState.playheadTime = 3.0;
    mockPlaybackState.outPoint = undefined;

    const { result } = renderHook(() => useEditorShellPlaybackCallbacks());
    result.current.markInPoint();

    expect(mockSetInPoint).toHaveBeenCalledWith(3.0);
    expect(mockCommandExecute).not.toHaveBeenCalled();
  });
});

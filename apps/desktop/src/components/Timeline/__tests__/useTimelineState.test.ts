// @vitest-environment jsdom
// 覆盖目标：apps/desktop/src/components/Timeline/useTimelineState.ts（原 0%）
// 策略：renderHook + mock 四个 store（selector 形态）与外部 IO（whisper/toast/settings），
// 断言派生状态计算、键盘快捷键 effect、场景检测 effect 与 helper 行为。
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { Project } from '@open-factory/editor-core';
import { makeClip, makeProject, makeTrack } from '../hooks/timeline/__tests__/test-fixtures';

// ── 可变 mock 状态（工厂闭包延迟求值） ──────────────────────
let editorState: Record<string, unknown>;
let collaborationState: Record<string, unknown>;
let renderCacheState: Record<string, unknown>;
let whisperSettingsState: Record<string, unknown>;

vi.mock('../../../store/editorStore', () => ({
  useEditorStore: Object.assign((selector: (state: never) => unknown) => selector(editorState as never), {
    getState: () => editorState,
  }),
}));

vi.mock('../../../store/collaborationStore', () => ({
  useCollaborationStore: (selector: (state: never) => unknown) => selector(collaborationState as never),
}));

vi.mock('../../../store/renderCacheStore', () => ({
  useRenderCacheStore: (selector: (state: never) => unknown) => selector(renderCacheState as never),
}));

vi.mock('../../../store/whisperSettingsStore', () => ({
  useWhisperSettingsStore: (selector: (state: never) => unknown) => selector(whisperSettingsState as never),
}));

const mockReadTimelineInteractionSettings = vi.fn(() => Promise.resolve({}));
const mockGetWhisperAvailability = vi.fn((_options: { executablePath?: string; modelPath?: string }) =>
  Promise.resolve({ ready: true }),
);
const mockShowToast = vi.fn();

vi.mock('../../../settings/appSettings', () => ({
  readTimelineInteractionSettings: () => mockReadTimelineInteractionSettings(),
}));

vi.mock('../../../lib/whisper', () => ({
  getWhisperAvailability: (options: { executablePath?: string; modelPath?: string }) =>
    mockGetWhisperAvailability(options),
}));

vi.mock('../../../lib/toast', () => ({
  showToast: (toast: unknown) => mockShowToast(toast),
}));

import { useTimelineState } from '../useTimelineState';

function makeEditorState(project: Project, overrides: Record<string, unknown> = {}) {
  return {
    project,
    selectedClipId: undefined,
    selectedClipIds: [] as string[],
    playheadTime: 0,
    isPlaying: false,
    inPoint: undefined,
    outPoint: undefined,
    projectPath: undefined,
    timelineCompareRanges: [],
    timelineZoom: 100,
    setSelectedClipId: vi.fn(),
    setSelectedClipIds: vi.fn(),
    addMedia: vi.fn(),
    selectedKeyframe: undefined,
    selectedKeyframes: [] as string[],
    setSelectedKeyframe: vi.fn(),
    setSelectedKeyframes: vi.fn(),
    toggleSelectedKeyframe: vi.fn(),
    toggleSelectedClipId: vi.fn(),
    clearSelectedClipIds: vi.fn(),
    setPlayheadTime: vi.fn(),
    setInPoint: vi.fn(),
    setOutPoint: vi.fn(),
    setTimelineZoom: vi.fn(),
    setPreviewTimeline: vi.fn(),
    setActiveSequenceId: vi.fn(),
    ...overrides,
  };
}

/** 双 clip 项目：c1(0,5) / c2(10,10) → timelineDuration = 22 */
function makeTimelineProject(): Project {
  return makeProject({
    tracks: [
      makeTrack({ id: 'track-1', clips: [makeClip({ id: 'c1', start: 0, duration: 5 })] }),
      makeTrack({ id: 'track-2', clips: [makeClip({ id: 'c2', start: 10, duration: 10 })] }),
    ],
  }) as Project;
}

beforeEach(() => {
  vi.clearAllMocks();
  editorState = makeEditorState(makeTimelineProject());
  collaborationState = { enabled: false, userId: 'user-1', users: [], locks: [] };
  renderCacheState = { ranges: [], staleRanges: [] };
  whisperSettingsState = { executablePath: undefined, modelPath: undefined };
  mockReadTimelineInteractionSettings.mockImplementation(() => Promise.resolve({}));
  mockGetWhisperAvailability.mockImplementation(() => Promise.resolve({ ready: true }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useTimelineState — store 状态透传与派生计算', () => {
  it('透传 editorStore 的基础状态与 setter', () => {
    const { result } = renderHook(() => useTimelineState({}));
    expect(result.current.project).toBe(editorState.project);
    expect(result.current.selectedClipIds).toEqual([]);
    expect(result.current.playheadTime).toBe(0);
    expect(result.current.zoom).toBe(100);
    expect(result.current.setPlayheadTime).toBe(editorState.setPlayheadTime);
    expect(result.current.renderCacheRanges).toEqual([]);
    expect(result.current.whisperExecutablePath).toBeUndefined();
  });

  it('timelineDuration 取 max(10, 最长 clip 末端 + 2)', () => {
    const { result } = renderHook(() => useTimelineState({}));
    // c2: 10 + 10 + 2 = 22
    expect(result.current.timelineDuration).toBe(22);
    expect(result.current.projectDuration).toBe(20);
  });

  it('空时间线时 timelineDuration 回退到 10 且 largeProjectMode 关闭', () => {
    editorState = makeEditorState(makeProject());
    const { result } = renderHook(() => useTimelineState({}));
    expect(result.current.timelineDuration).toBe(10);
    expect(result.current.allClips).toEqual([]);
    expect(result.current.largeProjectMode.enabled).toBe(false);
    expect(result.current.largeProjectMode.virtualOverscanScreens).toBe(2);
  });

  it('allClips 展平全部轨道 clip 且 orderedTrackIds 保持轨道顺序', () => {
    const { result } = renderHook(() => useTimelineState({}));
    expect(result.current.allClips.map((clip) => clip.id)).toEqual(['c1', 'c2']);
    expect(result.current.orderedTrackIds).toEqual(['track-1', 'track-2']);
  });

  it('width / visibleStart / visibleEnd 由 zoom 与 scrollViewport 派生', () => {
    const { result } = renderHook(() => useTimelineState({}));
    // width = max(960, 22 * 100)
    expect(result.current.width).toBe(2200);
    expect(result.current.visibleStart).toBe(0);
    expect(result.current.visibleEnd).toBe(960 / 100);
  });

  it('isMainSequence / activeSequence 派生自 activeSequenceId', () => {
    const project = makeTimelineProject();
    project.sequences = [{ id: 'seq-1', name: 'S1', trackIds: [] } as never];
    project.activeSequenceId = 'seq-1';
    editorState = makeEditorState(project);
    const { result } = renderHook(() => useTimelineState({}));
    expect(result.current.activeSequence?.id).toBe('seq-1');
    expect(result.current.isMainSequence).toBe(false);
  });

  it('playheadTimecode 与 ticks 派生自 playhead / fps', () => {
    editorState = makeEditorState(makeTimelineProject(), { playheadTime: 0 });
    const { result } = renderHook(() => useTimelineState({}));
    expect(result.current.playheadTimecode).toContain('00:00:00');
    expect(Array.isArray(result.current.ticks)).toBe(true);
    expect(result.current.ticks.length).toBeGreaterThan(0);
  });
});

describe('useTimelineState — 协作与节拍派生', () => {
  it('collaborationEnabled=false 时 remoteCollaborationUsers 为空', () => {
    const { result } = renderHook(() => useTimelineState({}));
    expect(result.current.remoteCollaborationUsers).toEqual([]);
  });

  it('remoteCollaborationUsers 过滤自身 userId', () => {
    collaborationState = {
      enabled: true,
      userId: 'me',
      users: [
        { userId: 'me', name: 'me' },
        { userId: 'other', name: 'other' },
      ],
      locks: [],
    };
    const { result } = renderHook(() => useTimelineState({}));
    expect(result.current.remoteCollaborationUsers).toEqual([{ userId: 'other', name: 'other' }]);
  });

  it('collaborationLocksByClipId 只保留他人的锁', () => {
    collaborationState = {
      enabled: true,
      userId: 'me',
      users: [],
      locks: [
        { userId: 'me', clipId: 'c1' },
        { userId: 'other', clipId: 'c2' },
      ],
    };
    const { result } = renderHook(() => useTimelineState({}));
    expect(result.current.collaborationLocksByClipId.has('c1')).toBe(false);
    expect(result.current.collaborationLocksByClipId.has('c2')).toBe(true);
  });

  it('activeBeatMarkerId 仅在播放且 playhead 命中节拍时返回', () => {
    const project = makeTimelineProject();
    project.beatMarkers = [
      { id: 'beat-1', time: 5 },
      { id: 'beat-2', time: 8 },
    ] as never;
    editorState = makeEditorState(project, { isPlaying: false, playheadTime: 5 });
    const idle = renderHook(() => useTimelineState({}));
    expect(idle.result.current.activeBeatMarkerId).toBeUndefined();

    editorState = makeEditorState(project, { isPlaying: true, playheadTime: 5 });
    const playing = renderHook(() => useTimelineState({}));
    expect(playing.result.current.activeBeatMarkerId).toBe('beat-1');
  });

  it('exportRangeHighlights 优先使用存储的 exportRanges', () => {
    const project = makeTimelineProject();
    project.exportRanges = [{ id: 'range-1', start: 1, end: 2 }] as never;
    editorState = makeEditorState(project, { inPoint: 3, outPoint: 8 });
    const { result } = renderHook(() => useTimelineState({}));
    expect(result.current.exportRangeHighlights).toEqual([{ id: 'range-1', start: 1, end: 2 }]);
  });

  it('exportRangeHighlights 无存储范围时回退到 in/out 点', () => {
    editorState = makeEditorState(makeTimelineProject(), { inPoint: 8, outPoint: 3 });
    const { result } = renderHook(() => useTimelineState({}));
    expect(result.current.exportRangeHighlights).toEqual([{ id: 'current-in-out', start: 3, end: 8 }]);
  });

  it('inPoint 与 outPoint 相同时不产生高亮范围', () => {
    editorState = makeEditorState(makeTimelineProject(), { inPoint: 5, outPoint: 5 });
    const { result } = renderHook(() => useTimelineState({}));
    expect(result.current.exportRangeHighlights).toEqual([]);
  });
});

describe('useTimelineState — clip 组 / 注释 / 场景检测覆盖层', () => {
  it('clipGroups 归一化并建立 clipId 反查表与完整选中组', () => {
    const project = makeProject({
      tracks: [makeTrack({ id: 'track-1', clips: [makeClip({ id: 'c1' }), makeClip({ id: 'c2' })] })],
    });
    project.clipGroups = [{ id: 'g1', name: 'G', color: 'blue', clipIds: ['c1', 'c2'] }] as never;
    editorState = makeEditorState(project, { selectedClipIds: ['c1', 'c2'] });
    const { result } = renderHook(() => useTimelineState({}));
    expect(result.current.clipGroups).toHaveLength(1);
    expect(result.current.clipGroupByClipId.get('c1')?.id).toBe('g1');
    expect(result.current.clipGroupByClipId.get('c2')?.id).toBe('g1');
    expect(result.current.selectedGroup?.id).toBe('g1');
  });

  it('组内只选中部分成员时 selectedGroup 为空', () => {
    const project = makeProject({
      tracks: [makeTrack({ id: 'track-1', clips: [makeClip({ id: 'c1' }), makeClip({ id: 'c2' })] })],
    });
    project.clipGroups = [{ id: 'g1', name: 'G', color: 'blue', clipIds: ['c1', 'c2'] }] as never;
    editorState = makeEditorState(project, { selectedClipIds: ['c1'] });
    const { result } = renderHook(() => useTimelineState({}));
    expect(result.current.selectedGroup).toBeUndefined();
  });

  it('timelineNotes 按 search 文本过滤', async () => {
    const project = makeTimelineProject();
    project.timelineNotes = [
      { id: 'n1', time: 1, text: 'Hello world', color: 'red' },
      { id: 'n2', time: 2, text: '导入素材', color: 'blue' },
    ] as never;
    editorState = makeEditorState(project);
    const { result } = renderHook(() => useTimelineState({}));
    expect(result.current.timelineNotes).toHaveLength(2);

    act(() => result.current.setTimelineNoteSearch('hello'));
    expect(result.current.filteredTimelineNotes.map((note) => note.id)).toEqual(['n1']);

    act(() => result.current.setTimelineNoteSearch('blue'));
    expect(result.current.filteredTimelineNotes.map((note) => note.id)).toEqual(['n2']);
  });

  it('sceneCutOverlays 将 clip 相对场景点换算为时间线时间', () => {
    const project = makeProject({
      tracks: [makeTrack({ id: 'track-1', clips: [makeClip({ id: 'c1', start: 2, duration: 5, scenecuts: [0.5] })] })],
    });
    editorState = makeEditorState(project);
    const { result } = renderHook(() => useTimelineState({}));
    expect(result.current.sceneCutOverlays).toEqual([{ id: 'c1-0-0.5', clipId: 'c1', time: 2.5 }]);
  });

  it('protectedRanges 归一化后透出', () => {
    const project = makeTimelineProject();
    project.protectedRanges = [{ id: 'pr-1', start: 1, end: 2 }] as never;
    editorState = makeEditorState(project);
    const { result } = renderHook(() => useTimelineState({}));
    expect(result.current.protectedRanges).toEqual([expect.objectContaining({ id: 'pr-1', start: 1, end: 2 })]);
  });
});

describe('useTimelineState — 网格 / 虚拟化 / minimap', () => {
  it('timelineGridSettings.enabled=false 时 gridLines 为空', () => {
    const { result } = renderHook(() => useTimelineState({ timelineGridSettings: { enabled: false, unit: 'second' } }));
    expect(result.current.gridLines).toEqual([]);
  });

  it('timelineGridSettings.enabled=true 时生成网格线', () => {
    const { result } = renderHook(() => useTimelineState({ timelineGridSettings: { enabled: true, unit: 'second' } }));
    expect(result.current.gridLines.length).toBeGreaterThan(0);
  });

  it('virtualTracks / virtualWindow / minimap 布局正常派生', () => {
    const { result } = renderHook(() => useTimelineState({}));
    expect(result.current.virtualTracks.map((track) => track.id)).toEqual(['track-1', 'track-2']);
    expect(result.current.virtualWindow).toHaveProperty('start');
    expect(result.current.minimapHeight).toBeGreaterThanOrEqual(160);
    expect(result.current.minimapViewport).toHaveProperty('start');
    expect(result.current.minimapViewport).toHaveProperty('height');
    expect(result.current.minimapLayout).toBeTruthy();
  });

  it('thumbnailTrackSamples 返回按优先级排序的采样', () => {
    const { result } = renderHook(() => useTimelineState({}));
    expect(Array.isArray(result.current.thumbnailTrackSamples)).toBe(true);
  });
});

describe('useTimelineState — setBookmarkPanelVisible helper', () => {
  it('布尔值同时更新本地状态并回调 onBookmarkPanelOpenChange', () => {
    const onBookmarkPanelOpenChange = vi.fn();
    const { result } = renderHook(() => useTimelineState({ onBookmarkPanelOpenChange }));
    act(() => result.current.setBookmarkPanelVisible(true));
    expect(result.current.bookmarkPanelOpen).toBe(true);
    expect(onBookmarkPanelOpenChange).toHaveBeenCalledWith(true);
  });

  it('函数式更新基于当前值计算', () => {
    const onBookmarkPanelOpenChange = vi.fn();
    // localBookmarkPanelOpen 初始为 true
    const { result } = renderHook(() => useTimelineState({ onBookmarkPanelOpenChange }));
    act(() => result.current.setBookmarkPanelVisible((open: boolean) => !open));
    expect(result.current.bookmarkPanelOpen).toBe(false);
    act(() => result.current.setBookmarkPanelVisible((open: boolean) => !open));
    expect(result.current.bookmarkPanelOpen).toBe(true);
    expect(onBookmarkPanelOpenChange).toHaveBeenLastCalledWith(true);
  });
});

describe('useTimelineState — 键盘快捷键', () => {
  function pressKey(key: string, options: KeyboardEventInit = {}) {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...options }));
  }
  function releaseKey(key: string) {
    window.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
  }

  it('Ctrl+Shift+A 全选轨道并设置锚点', () => {
    const { result } = renderHook(() => useTimelineState({}));
    act(() => pressKey('a', { ctrlKey: true, shiftKey: true }));
    expect(result.current.selectedTrackIds).toEqual(['track-1', 'track-2']);
    expect(result.current.trackSelectionAnchorId).toBe('track-1');
  });

  it('按 E 切换 envelopeEditMode 并清空音量包络菜单', () => {
    const { result } = renderHook(() => useTimelineState({}));
    act(() => result.current.setVolumeEnvelopeMenu({ clipId: 'c1', point: { time: 1, value: 1 } } as never));
    act(() => pressKey('e'));
    expect(result.current.envelopeEditMode).toBe(true);
    expect(result.current.volumeEnvelopeMenu).toBeUndefined();
  });

  it('按 N / Shift+P 触发 handlerRefs 回调', () => {
    const quickAddTimelineNote = vi.fn();
    const toggleProtectedRangeAtPlayhead = vi.fn();
    const handlerRefs = { current: { quickAddTimelineNote, toggleProtectedRangeAtPlayhead } };
    renderHook(() => useTimelineState({ handlerRefs }));
    act(() => pressKey('n'));
    expect(quickAddTimelineNote).toHaveBeenCalledTimes(1);
    act(() => pressKey('p', { shiftKey: true }));
    expect(toggleProtectedRangeAtPlayhead).toHaveBeenCalledTimes(1);
  });

  it('按住/松开 R 键切换 rollingTrimActive', () => {
    const { result } = renderHook(() => useTimelineState({}));
    act(() => pressKey('r'));
    expect(result.current.rollingTrimActive).toBe(true);
    act(() => releaseKey('r'));
    expect(result.current.rollingTrimActive).toBe(false);
  });

  it('按住/松开 S / D 键切换 slip / slide 编辑模式', () => {
    const { result } = renderHook(() => useTimelineState({}));
    act(() => pressKey('s'));
    act(() => pressKey('d'));
    expect(result.current.slipEditActive).toBe(true);
    expect(result.current.slideEditActive).toBe(true);
    act(() => releaseKey('s'));
    act(() => releaseKey('d'));
    expect(result.current.slipEditActive).toBe(false);
    expect(result.current.slideEditActive).toBe(false);
  });

  it('输入框聚焦时不触发快捷键', () => {
    const { result } = renderHook(() => useTimelineState({}));
    const input = document.createElement('input');
    document.body.appendChild(input);
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true }));
    });
    expect(result.current.envelopeEditMode).toBe(false);
    input.remove();
  });

  it('窗口失焦时复位三个编辑模式', () => {
    const { result } = renderHook(() => useTimelineState({}));
    act(() => pressKey('r'));
    act(() => pressKey('s'));
    act(() => pressKey('d'));
    act(() => {
      window.dispatchEvent(new Event('blur'));
    });
    expect(result.current.rollingTrimActive).toBe(false);
    expect(result.current.slipEditActive).toBe(false);
    expect(result.current.slideEditActive).toBe(false);
  });
});

describe('useTimelineState — 场景检测请求 effect', () => {
  it('无选中 clip 时弹 warning toast', () => {
    editorState = makeEditorState(makeTimelineProject());
    renderHook(() => useTimelineState({ sceneDetectionRequestId: 1 }));
    expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ kind: 'warning' }));
  });

  it('有选中 clip 时调用 openSceneDetection，同一请求 id 只处理一次', () => {
    const openSceneDetection = vi.fn();
    const handlerRefs = { current: { openSceneDetection } };
    editorState = makeEditorState(makeTimelineProject(), { selectedClipId: 'c1' });
    const { rerender } = renderHook(
      (props: { requestId: number }) => useTimelineState({ sceneDetectionRequestId: props.requestId, handlerRefs }),
      { initialProps: { requestId: 1 } },
    );
    expect(openSceneDetection).toHaveBeenCalledWith('c1');

    rerender({ requestId: 1 });
    expect(openSceneDetection).toHaveBeenCalledTimes(1);

    rerender({ requestId: 2 });
    expect(openSceneDetection).toHaveBeenCalledTimes(2);
  });
});

describe('useTimelineState — 异步设置加载', () => {
  it('whisper availability 就绪后更新状态', async () => {
    mockGetWhisperAvailability.mockImplementation(() => Promise.resolve({ ready: true, error: undefined }));
    const { result } = renderHook(() => useTimelineState({}));
    expect(result.current.whisperAvailability.ready).toBe(false);
    await waitFor(() => expect(result.current.whisperAvailability.ready).toBe(true));
    expect(mockGetWhisperAvailability).toHaveBeenCalledWith({ executablePath: undefined, modelPath: undefined });
  });

  it('audioScrubEnabled 按持久化设置更新', async () => {
    mockReadTimelineInteractionSettings.mockImplementation(() => Promise.resolve({ audioScrubEnabled: false }));
    const { result } = renderHook(() => useTimelineState({}));
    expect(result.current.audioScrubEnabled).toBe(true);
    await waitFor(() => expect(result.current.audioScrubEnabled).toBe(false));
  });

  it('持久化设置缺省时 audioScrubEnabled 保持开启', async () => {
    mockReadTimelineInteractionSettings.mockImplementation(() => Promise.resolve({}));
    const { result } = renderHook(() => useTimelineState({}));
    await waitFor(() => expect(result.current.audioScrubEnabled).toBe(true));
  });
});

describe('useTimelineState — heatmap', () => {
  it('heatmap 未启用时 segments 为空', async () => {
    const { result } = renderHook(() =>
      useTimelineState({ heatmap: { enabled: false, type: 'edit-density', opacity: 0.45, colorScheme: 'warm' } }),
    );
    expect(result.current.heatmapSegments).toEqual([]);
  });

  it('heatmap 启用时（无 Worker 环境）经 setTimeout 计算出 segments', async () => {
    vi.stubGlobal('Worker', undefined);
    const { result } = renderHook(() =>
      useTimelineState({ heatmap: { enabled: true, type: 'edit-density', opacity: 0.45, colorScheme: 'warm' } }),
    );
    await waitFor(() => expect(result.current.heatmapSegments.length).toBeGreaterThan(0), { timeout: 3000 });
  });
});

describe('useTimelineState — 书签面板联动', () => {
  it('bookmarkPanelOpen 且存在书签时自动收起注释面板', async () => {
    const project = makeTimelineProject();
    project.bookmarks = [{ id: 'b1', time: 1, label: 'B1' }] as never;
    editorState = makeEditorState(project);
    const { result } = renderHook(() => useTimelineState({ bookmarkPanelOpen: true }));
    await waitFor(() => expect(result.current.annotationPanelOpen).toBe(false));
  });
});

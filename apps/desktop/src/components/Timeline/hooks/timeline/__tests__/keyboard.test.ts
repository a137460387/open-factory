// @vitest-environment jsdom
// 覆盖目标：apps/desktop/src/components/Timeline/hooks/timeline/keyboard.ts（原 0% → ≥75%）
// 策略：工厂直调 createKeyboardHandlers(params, helpers)，断言键盘映射触发的
// 移动/裁剪/拆分/组操作/缩放命令与快捷键守卫。
import {describe, expect, it, vi, beforeEach, afterEach} from 'vitest';
import type {Clip} from '@open-factory/editor-core';
import {
  MoveClipCommand,
  MoveClipsCommand,
  TrimClipCommand,
} from '@open-factory/editor-core';

const {executeMock, showToastMock} = vi.hoisted(() => ({
  executeMock: vi.fn(),
  showToastMock: vi.fn(),
}));

vi.mock('../../../../../store/commandManager', () => ({
  commandManager: {execute: (command: unknown) => executeMock(command)},
  projectAccessor: {getProject: vi.fn(), setProject: vi.fn()},
  timelineAccessor: {getTimeline: vi.fn(), setTimeline: vi.fn()},
  setEditorStoreGetter: vi.fn(),
  addOnExecuteListener: vi.fn(),
}));

vi.mock('../../../../../lib/toast', () => ({
  showToast: (toast: unknown) => showToastMock(toast),
}));

import {createKeyboardHandlers} from '../keyboard';
import {makeClip, makeParams, makeProject, makeTrack} from './test-fixtures';

function setup(
  overrides: Parameters<typeof makeParams>[0] = {},
  helperOverrides: Record<string, unknown> = {},
  clips: Clip[] = [makeClip({id: 'clip-a', start: 5, duration: 5})],
) {
  const project = overrides.project ?? makeProject({tracks: [makeTrack({clips})]});
  const params = makeParams({...overrides, project, allClips: clips});
  const splitSelected = vi.fn();
  const createGroupFromSelection = vi.fn();
  const ungroupSelected = vi.fn();
  const applyZoom = vi.fn();
  const warnProtectedRangeBlocked = vi.fn();
  const handlers = createKeyboardHandlers(params, {
    findClipById: (clipId) => clips.find((clip) => clip.id === clipId),
    canApplyProtectedMove: () => true,
    warnProtectedRangeBlocked,
    applyZoom,
    splitSelected,
    createGroupFromSelection,
    ungroupSelected,
    minFrameDuration: () => 1 / 30,
    ...helperOverrides,
  });
  return {params, handlers, splitSelected, createGroupFromSelection, ungroupSelected, applyZoom, warnProtectedRangeBlocked};
}

function makeKeyEvent(overrides: Record<string, unknown> = {}) {
  return {
    key: 'ArrowRight',
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    target: null,
    defaultPrevented: false,
    preventDefault: vi.fn(),
    ...overrides,
  } as never;
}

beforeEach(() => {
  executeMock.mockReset();
  showToastMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createKeyboardHandlers — onKeyDown 守卫', () => {
  it('defaultPrevented 事件直接返回', () => {
    const {params, handlers} = setup();
    handlers.onKeyDown(makeKeyEvent({defaultPrevented: true}));
    expect(params.setPlayheadTime).not.toHaveBeenCalled();
  });

  it('输入框聚焦时不响应', () => {
    const {handlers, splitSelected} = setup({selectedClipId: 'clip-a'});
    handlers.onKeyDown(makeKeyEvent({key: 't', target: document.createElement('input')}));
    expect(splitSelected).not.toHaveBeenCalled();
  });

  it('Escape 清空选择', () => {
    const {params, handlers} = setup({selectedClipId: 'clip-a', selectedClipIds: ['clip-a']});
    handlers.onKeyDown(makeKeyEvent({key: 'Escape'}));
    expect(params.setters.setSelectedClipId).toHaveBeenCalledWith(undefined);
    expect(params.setters.setSelectedClipIds).toHaveBeenCalledWith([]);
  });
});

describe('createKeyboardHandlers — onKeyDown 命令映射', () => {
  it('ArrowRight 单选时移动 clip 一帧', () => {
    const {params, handlers} = setup({selectedClipIds: ['clip-a']});
    handlers.onKeyDown(makeKeyEvent({key: 'ArrowRight'}));
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(MoveClipCommand);
    expect(params.setters.setSelectedClipId).toHaveBeenCalledWith('clip-a');
  });

  it('ArrowLeft 多选时批量移动', () => {
    const clips = [makeClip({id: 'clip-a', start: 5, duration: 5}), makeClip({id: 'clip-b', start: 20, duration: 5})];
    const {params, handlers} = setup({selectedClipIds: ['clip-a', 'clip-b']}, {}, clips);
    handlers.onKeyDown(makeKeyEvent({key: 'ArrowLeft'}));
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(MoveClipsCommand);
    expect(params.setters.setSelectedClipIds).toHaveBeenCalledWith(['clip-a', 'clip-b']);
  });

  it('无选中时方向键不执行命令', () => {
    const {handlers} = setup();
    handlers.onKeyDown(makeKeyEvent({key: 'ArrowRight'}));
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('[ 键向左裁剪一帧', () => {
    const {params, handlers} = setup({selectedClipId: 'clip-a'});
    handlers.onKeyDown(makeKeyEvent({key: '['}));
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(TrimClipCommand);
    expect(params.setters.setSelectedClipId).toHaveBeenCalledWith('clip-a');
  });

  it('] 键向右裁剪一帧', () => {
    const {handlers} = setup({selectedClipId: 'clip-a'});
    handlers.onKeyDown(makeKeyEvent({key: ']'}));
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(TrimClipCommand);
  });

  it('无选中 clip 时裁剪直接返回', () => {
    const {handlers} = setup();
    handlers.onKeyDown(makeKeyEvent({key: '['}));
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('T 键拆分选中 clip', () => {
    const {handlers, splitSelected} = setup({selectedClipId: 'clip-a'});
    handlers.onKeyDown(makeKeyEvent({key: 't'}));
    expect(splitSelected).toHaveBeenCalledTimes(1);
  });

  it('Ctrl+G 创建组', () => {
    const {handlers, createGroupFromSelection} = setup();
    handlers.onKeyDown(makeKeyEvent({key: 'g', ctrlKey: true}));
    expect(createGroupFromSelection).toHaveBeenCalledTimes(1);
  });

  it('Ctrl+Shift+G 解除组', () => {
    const {handlers, ungroupSelected} = setup();
    handlers.onKeyDown(makeKeyEvent({key: 'G', ctrlKey: true, shiftKey: true}));
    expect(ungroupSelected).toHaveBeenCalledTimes(1);
  });

  it('Shift+Home 回到开头并适配缩放', () => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    const {params, handlers} = setup();
    params.scrollRef = {current: {clientWidth: 1000, scrollLeft: 500} as unknown as HTMLDivElement};
    handlers.onKeyDown(makeKeyEvent({key: 'Home', shiftKey: true}));
    expect(params.setPlayheadTime).toHaveBeenCalledWith(0);
    expect(params.setTimelineZoom).toHaveBeenCalled();
  });

  it('= 键放大', () => {
    const {handlers, applyZoom} = setup();
    handlers.onKeyDown(makeKeyEvent({key: '='}));
    expect(applyZoom).toHaveBeenCalledWith(expect.any(Number), expect.any(Number));
  });

  it('- 键缩小', () => {
    const {handlers, applyZoom} = setup();
    handlers.onKeyDown(makeKeyEvent({key: '-'}));
    expect(applyZoom).toHaveBeenCalledWith(expect.any(Number), expect.any(Number));
  });
});

describe('createKeyboardHandlers — moveSelectedClipsByKeyboardFrame', () => {
  it('命令抛错时 toast 警告', () => {
    executeMock.mockImplementation(() => {
      throw new Error('move rejected');
    });
    const {handlers} = setup({selectedClipIds: ['clip-a']});
    handlers.moveSelectedClipsByKeyboardFrame(1);
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({kind: 'warning'}));
  });

  it('保护范围阻断时警告并返回', () => {
    const warnProtectedRangeBlocked = vi.fn();
    const clip = makeClip({id: 'clip-a', start: 5, duration: 5});
    const params = makeParams({
      project: makeProject({tracks: [makeTrack({clips: [clip]})]}),
      allClips: [clip],
      selectedClipIds: ['clip-a'],
    });
    const handlers = createKeyboardHandlers(params, {
      findClipById: () => clip,
      canApplyProtectedMove: () => false,
      warnProtectedRangeBlocked,
      applyZoom: vi.fn(),
      splitSelected: vi.fn(),
      createGroupFromSelection: vi.fn(),
      ungroupSelected: vi.fn(),
      minFrameDuration: () => 1 / 30,
    });
    handlers.moveSelectedClipsByKeyboardFrame(1);
    expect(warnProtectedRangeBlocked).toHaveBeenCalled();
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('方向为 -1 时左移一帧', () => {
    const {handlers} = setup({selectedClipIds: ['clip-a']});
    handlers.moveSelectedClipsByKeyboardFrame(-1);
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(MoveClipCommand);
  });
});

describe('createKeyboardHandlers — trimSelectedClipByKeyboardFrame', () => {
  it('无选中时不执行', () => {
    const {handlers} = setup();
    handlers.trimSelectedClipByKeyboardFrame('in');
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('命令抛错时 toast 警告', () => {
    executeMock.mockImplementation(() => {
      throw new Error('trim rejected');
    });
    const {handlers} = setup({selectedClipId: 'clip-a'});
    handlers.trimSelectedClipByKeyboardFrame('in');
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({kind: 'warning'}));
  });
});

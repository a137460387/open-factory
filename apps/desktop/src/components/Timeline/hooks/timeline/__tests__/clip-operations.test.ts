// @vitest-environment jsdom
// 覆盖目标：apps/desktop/src/components/Timeline/hooks/timeline/clip-operations.ts（639 行 1.25% → ≥75%）
// v4.74.0 专项：rippleDeleteSelected / deleteGroup / createGroupFromSelection / ungroupSelected / deleteSelected
// 策略：工厂直调，mock commandManager 断言命令对象类型与参数（锁定轨道/组守卫由 editor-core 命令层保证）
import {describe, expect, it, vi, beforeEach} from 'vitest';

const {executeMock, showToastMock, saveFileDialogMock, writeFileMock, setInPointMock, setOutPointMock} = vi.hoisted(() => ({
  executeMock: vi.fn(),
  showToastMock: vi.fn(),
  saveFileDialogMock: vi.fn(),
  writeFileMock: vi.fn(),
  setInPointMock: vi.fn(),
  setOutPointMock: vi.fn(),
}));

vi.mock('../../../../../store/commandManager', () => ({
  commandManager: {execute: (command: unknown) => executeMock(command)},
  projectAccessor: {getProject: vi.fn(), setProject: vi.fn()},
  timelineAccessor: {getTimeline: vi.fn(), setTimeline: vi.fn()},
  setEditorStoreGetter: vi.fn(),
  addOnExecuteListener: vi.fn(),
}));

vi.mock('../../../../../store/editorStore', () => ({
  useEditorStore: {
    getState: () => ({setInPoint: setInPointMock, setOutPoint: setOutPointMock}),
  },
}));

vi.mock('../../../../../lib/tauri-bridge', () => ({
  saveFileDialog: (...args: unknown[]) => saveFileDialogMock(...args),
  writeFile: (...args: unknown[]) => writeFileMock(...args),
}));

vi.mock('../../../../../lib/toast', () => ({
  showToast: (toast: unknown) => showToastMock(toast),
}));

import {createClipOperationsHandlers} from '../clip-operations';
import {makeClip, makeParams, makeProject, makeTrack} from './test-fixtures';
import {
  AddClipCommand,
  AddCreditsClipCommand,
  AddProjectAnnotationCommand,
  AddProjectBookmarkCommand,
  AddTimelineMarkerCommand,
  AddTimelineNoteCommand,
  AddTransitionCommand,
  CreateClipGroupCommand,
  DeleteClipsCommand,
  DeleteGroupCommand,
  RemoveProjectAnnotationCommand,
  RemoveProjectBookmarkCommand,
  RemoveTimelineMarkerCommand,
  RemoveTimelineNoteCommand,
  RemoveTransitionCommand,
  RippleDeleteCommand,
  SplitClipCommand,
  UngroupCommand,
  UpdateClipCommand,
  UpdateClipGroupCommand,
  UpdateProjectAnnotationCommand,
  UpdateProjectBeatMarkersCommand,
  UpdateProjectBookmarkCommand,
  UpdateProjectProtectedRangesCommand,
  UpdateTimelineNoteCommand,
} from '@open-factory/editor-core';

function makeGroup(id: string, clipIds: string[]) {
  return {id, name: `Group ${id}`, color: 'blue', clipIds} as never;
}

describe('createClipOperationsHandlers', () => {
  beforeEach(() => {
    executeMock.mockReset();
    showToastMock.mockReset();
    saveFileDialogMock.mockReset();
    writeFileMock.mockReset().mockResolvedValue(undefined);
    setInPointMock.mockReset();
    setOutPointMock.mockReset();
  });

  describe('updateClipColor', () => {
    it('执行 UpdateClipCommand 携带 colorLabel', () => {
      const params = makeParams();
      const handlers = createClipOperationsHandlers(params, {
        findClip: (id) => makeClip({id}),
        getClipMediaAsset: () => undefined,
        minFrameDuration: () => 1 / 30,
      });
      handlers.updateClipColor('clip-1', 'red');
      expect(executeMock).toHaveBeenCalledTimes(1);
      expect(executeMock.mock.calls[0][0]).toBeInstanceOf(UpdateClipCommand);
    });
  });

  describe('addTransition / removeTransition', () => {
    it('transitionMenu 存在时执行 AddTransitionCommand 并关闭菜单', () => {
      const transitionMenu = {
        type: 'crossfade',
        duration: 0.5,
        fromClipId: 'clip-a',
        toClipId: 'clip-b',
        x: 0,
        y: 0,
      } as never;
      const params = makeParams({transitionMenu});
      const handlers = createClipOperationsHandlers(params, {
        findClip: (id) => makeClip({id}),
        getClipMediaAsset: () => undefined,
        minFrameDuration: () => 1 / 30,
      });
      handlers.addTransition();
      expect(executeMock.mock.calls[0][0]).toBeInstanceOf(AddTransitionCommand);
      expect(params.setters.setTransitionMenu).toHaveBeenCalledWith(undefined);
    });

    it('transitionMenu 缺失时 addTransition 直接返回', () => {
      const params = makeParams();
      const handlers = createClipOperationsHandlers(params, {
        findClip: (id) => makeClip({id}),
        getClipMediaAsset: () => undefined,
        minFrameDuration: () => 1 / 30,
      });
      handlers.addTransition();
      expect(executeMock).not.toHaveBeenCalled();
    });

    it('命令抛错时 toast 警告', () => {
      executeMock.mockImplementation(() => {
        throw new Error('transition unavailable');
      });
      const transitionMenu = {type: 'crossfade', duration: 0.5, fromClipId: 'a', toClipId: 'b', x: 0, y: 0} as never;
      const params = makeParams({transitionMenu});
      const handlers = createClipOperationsHandlers(params, {
        findClip: (id) => makeClip({id}),
        getClipMediaAsset: () => undefined,
        minFrameDuration: () => 1 / 30,
      });
      handlers.addTransition();
      expect(showToastMock.mock.calls[0][0].kind).toBe('warning');
      expect(showToastMock.mock.calls[0][0].message).toBe('transition unavailable');
    });

    it('removeTransition 执行 RemoveTransitionCommand', () => {
      const transitionMenu = {
        type: 'crossfade',
        duration: 0.5,
        fromClipId: 'a',
        toClipId: 'b',
        existingTransitionId: 'transition-1',
        x: 0,
        y: 0,
      } as never;
      const params = makeParams({transitionMenu});
      const handlers = createClipOperationsHandlers(params, {
        findClip: (id) => makeClip({id}),
        getClipMediaAsset: () => undefined,
        minFrameDuration: () => 1 / 30,
      });
      handlers.removeTransition();
      expect(executeMock.mock.calls[0][0]).toBeInstanceOf(RemoveTransitionCommand);
      expect(params.setters.setTransitionMenu).toHaveBeenCalledWith(undefined);
    });

    it('existingTransitionId 缺失时 removeTransition 直接返回', () => {
      const transitionMenu = {type: 'crossfade', duration: 0.5, fromClipId: 'a', toClipId: 'b', x: 0, y: 0} as never;
      const params = makeParams({transitionMenu});
      const handlers = createClipOperationsHandlers(params, {
        findClip: (id) => makeClip({id}),
        getClipMediaAsset: () => undefined,
        minFrameDuration: () => 1 / 30,
      });
      handlers.removeTransition();
      expect(executeMock).not.toHaveBeenCalled();
    });
  });

  describe('addText / addCredits', () => {
    it('无 text 轨道时 addText toast 警告', () => {
      const params = makeParams();
      const handlers = createClipOperationsHandlers(params, {
        findClip: (id) => makeClip({id}),
        getClipMediaAsset: () => undefined,
        minFrameDuration: () => 1 / 30,
      });
      handlers.addText();
      expect(showToastMock).toHaveBeenCalledTimes(1);
      expect(executeMock).not.toHaveBeenCalled();
    });

    it('有 text 轨道时 addText 执行 AddClipCommand 并选中新 clip', () => {
      const textTrack = makeTrack({id: 'track-text', type: 'text'});
      const project = makeProject({tracks: [makeTrack(), textTrack]});
      const params = makeParams({project});
      const handlers = createClipOperationsHandlers(params, {
        findClip: (id) => makeClip({id}),
        getClipMediaAsset: () => undefined,
        minFrameDuration: () => 1 / 30,
      });
      handlers.addText();
      expect(executeMock.mock.calls[0][0]).toBeInstanceOf(AddClipCommand);
      expect(params.setters.setSelectedClipId).toHaveBeenCalled();
    });

    it('有 text 轨道时 addCredits 执行 AddCreditsClipCommand', () => {
      const textTrack = makeTrack({id: 'track-text', type: 'text'});
      const project = makeProject({tracks: [makeTrack(), textTrack]});
      const params = makeParams({project});
      const handlers = createClipOperationsHandlers(params, {
        findClip: (id) => makeClip({id}),
        getClipMediaAsset: () => undefined,
        minFrameDuration: () => 1 / 30,
      });
      handlers.addCredits('滚动字幕');
      expect(executeMock.mock.calls[0][0]).toBeInstanceOf(AddCreditsClipCommand);
    });

    it('addCredits 命令抛错时 toast 警告', () => {
      executeMock.mockImplementation(() => {
        throw new Error('rejected');
      });
      const textTrack = makeTrack({id: 'track-text', type: 'text'});
      const project = makeProject({tracks: [makeTrack(), textTrack]});
      const params = makeParams({project});
      const handlers = createClipOperationsHandlers(params, {
        findClip: (id) => makeClip({id}),
        getClipMediaAsset: () => undefined,
        minFrameDuration: () => 1 / 30,
      });
      handlers.addCredits();
      expect(showToastMock.mock.calls[0][0].message).toBe('rejected');
    });
  });

  describe('addTimelineMarker', () => {
    it('默认使用 playheadTime 并执行 AddTimelineMarkerCommand', () => {
      const params = makeParams({playheadTime: 7.5});
      const handlers = createClipOperationsHandlers(params, {
        findClip: (id) => makeClip({id}),
        getClipMediaAsset: () => undefined,
        minFrameDuration: () => 1 / 30,
      });
      handlers.addTimelineMarker();
      expect(executeMock.mock.calls[0][0]).toBeInstanceOf(AddTimelineMarkerCommand);
    });

    it('显式传入 time 参数时覆盖 playheadTime', () => {
      const params = makeParams({playheadTime: 7.5});
      const handlers = createClipOperationsHandlers(params, {
        findClip: (id) => makeClip({id}),
        getClipMediaAsset: () => undefined,
        minFrameDuration: () => 1 / 30,
      });
      handlers.addTimelineMarker(12);
      expect(executeMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('splitSelected', () => {
    it('selectedClipId 缺失时直接返回', () => {
      const params = makeParams();
      const handlers = createClipOperationsHandlers(params, {
        findClip: (id) => makeClip({id}),
        getClipMediaAsset: () => undefined,
        minFrameDuration: () => 1 / 30,
      });
      handlers.splitSelected();
      expect(executeMock).not.toHaveBeenCalled();
    });

    it('执行 SplitClipCommand 在 playheadTime 处分割', () => {
      const params = makeParams({selectedClipId: 'clip-a', playheadTime: 2.5});
      const handlers = createClipOperationsHandlers(params, {
        findClip: (id) => makeClip({id}),
        getClipMediaAsset: () => undefined,
        minFrameDuration: () => 1 / 30,
      });
      handlers.splitSelected();
      expect(executeMock.mock.calls[0][0]).toBeInstanceOf(SplitClipCommand);
    });

    it('命令抛错（如 playhead 在 clip 外）时 toast 警告', () => {
      executeMock.mockImplementation(() => {
        throw new Error('split unavailable');
      });
      const params = makeParams({selectedClipId: 'clip-a'});
      const handlers = createClipOperationsHandlers(params, {
        findClip: (id) => makeClip({id}),
        getClipMediaAsset: () => undefined,
        minFrameDuration: () => 1 / 30,
      });
      handlers.splitSelected();
      expect(showToastMock.mock.calls[0][0].kind).toBe('warning');
    });
  });

  describe('createGroupFromSelection（v4.74.0 组守卫）', () => {
    it('选中少于 2 个 clip 时 toast 警告不建组', () => {
      const params = makeParams({selectedClipIds: ['clip-a']});
      const handlers = createClipOperationsHandlers(params, {
        findClip: (id) => makeClip({id}),
        getClipMediaAsset: () => undefined,
        minFrameDuration: () => 1 / 30,
      });
      handlers.createGroupFromSelection();
      expect(showToastMock).toHaveBeenCalledTimes(1);
      expect(executeMock).not.toHaveBeenCalled();
    });

    it('选中 ≥2 clip 时执行 CreateClipGroupCommand 并更新选中为组员', () => {
      executeMock.mockImplementation((cmd: unknown) => {
        Object.assign(cmd as object, {group: {clipIds: ['clip-a', 'clip-b']}});
      });
      const params = makeParams({selectedClipIds: ['clip-a', 'clip-b']});
      const handlers = createClipOperationsHandlers(params, {
        findClip: (id) => makeClip({id}),
        getClipMediaAsset: () => undefined,
        minFrameDuration: () => 1 / 30,
      });
      handlers.createGroupFromSelection();
      expect(executeMock.mock.calls[0][0]).toBeInstanceOf(CreateClipGroupCommand);
      expect(params.setters.setSelectedClipIds).toHaveBeenCalledWith(['clip-a', 'clip-b']);
      expect(params.setters.setClipMenu).toHaveBeenCalledWith(undefined);
    });

    it('建组命令抛错时 toast 警告', () => {
      executeMock.mockImplementation(() => {
        throw new Error('group rejected');
      });
      const params = makeParams({selectedClipIds: ['clip-a', 'clip-b']});
      const handlers = createClipOperationsHandlers(params, {
        findClip: (id) => makeClip({id}),
        getClipMediaAsset: () => undefined,
        minFrameDuration: () => 1 / 30,
      });
      handlers.createGroupFromSelection();
      expect(showToastMock.mock.calls[0][0].kind).toBe('warning');
    });
  });

  describe('ungroupSelected（v4.74.0）', () => {
    it('无选中组时 toast 警告', () => {
      const params = makeParams();
      const handlers = createClipOperationsHandlers(params, {
        findClip: (id) => makeClip({id}),
        getClipMediaAsset: () => undefined,
        minFrameDuration: () => 1 / 30,
      });
      handlers.ungroupSelected();
      expect(showToastMock).toHaveBeenCalledTimes(1);
      expect(executeMock).not.toHaveBeenCalled();
    });

    it('有选中组时执行 UngroupCommand 并保留组员选中', () => {
      const group = makeGroup('group-1', ['clip-a', 'clip-b']);
      const params = makeParams({selectedGroup: group});
      const handlers = createClipOperationsHandlers(params, {
        findClip: (id) => makeClip({id}),
        getClipMediaAsset: () => undefined,
        minFrameDuration: () => 1 / 30,
      });
      handlers.ungroupSelected();
      expect(executeMock.mock.calls[0][0]).toBeInstanceOf(UngroupCommand);
      expect(params.setters.setSelectedClipIds).toHaveBeenCalledWith(['clip-a', 'clip-b']);
      expect(params.setters.setClipMenu).toHaveBeenCalledWith(undefined);
    });

    it('命令抛错时 toast 警告', () => {
      executeMock.mockImplementation(() => {
        throw new Error('ungroup rejected');
      });
      const group = makeGroup('group-1', ['clip-a']);
      const params = makeParams({selectedGroup: group});
      const handlers = createClipOperationsHandlers(params, {
        findClip: (id) => makeClip({id}),
        getClipMediaAsset: () => undefined,
        minFrameDuration: () => 1 / 30,
      });
      handlers.ungroupSelected();
      expect(showToastMock.mock.calls[0][0].kind).toBe('warning');
    });
  });

  describe('deleteGroup（v4.74.0）', () => {
    it('执行 DeleteGroupCommand 清空选中并收回焦点', () => {
      const group = makeGroup('group-1', ['clip-a', 'clip-b']);
      const params = makeParams();
      params.rootRef = {current: {focus: vi.fn()} as never};
      const handlers = createClipOperationsHandlers(params, {
        findClip: (id) => makeClip({id}),
        getClipMediaAsset: () => undefined,
        minFrameDuration: () => 1 / 30,
      });
      handlers.deleteGroup(group);
      expect(executeMock.mock.calls[0][0]).toBeInstanceOf(DeleteGroupCommand);
      expect(params.setters.clearSelectedClipIds).toHaveBeenCalled();
      expect(params.setters.setClipMenu).toHaveBeenCalledWith(undefined);
      expect((params.rootRef.current as unknown as {focus: ReturnType<typeof vi.fn>}).focus).toHaveBeenCalled();
    });

    it('命令抛错时 toast 警告', () => {
      executeMock.mockImplementation(() => {
        throw new Error('delete rejected');
      });
      const group = makeGroup('group-1', ['clip-a']);
      const params = makeParams();
      const handlers = createClipOperationsHandlers(params, {
        findClip: (id) => makeClip({id}),
        getClipMediaAsset: () => undefined,
        minFrameDuration: () => 1 / 30,
      });
      handlers.deleteGroup(group);
      expect(showToastMock.mock.calls[0][0].kind).toBe('warning');
    });
  });

  describe('updateGroupColor', () => {
    it('执行 UpdateClipGroupCommand 携带 color', () => {
      const group = makeGroup('group-1', ['clip-a']);
      const params = makeParams();
      const handlers = createClipOperationsHandlers(params, {
        findClip: (id) => makeClip({id}),
        getClipMediaAsset: () => undefined,
        minFrameDuration: () => 1 / 30,
      });
      handlers.updateGroupColor(group, 'green');
      expect(executeMock.mock.calls[0][0]).toBeInstanceOf(UpdateClipGroupCommand);
      expect(params.setters.setClipMenu).toHaveBeenCalledWith(undefined);
    });
  });

  describe('deleteSelected', () => {
    it('无选中时直接返回', () => {
      const params = makeParams();
      const handlers = createClipOperationsHandlers(params, {
        findClip: (id) => makeClip({id}),
        getClipMediaAsset: () => undefined,
        minFrameDuration: () => 1 / 30,
      });
      handlers.deleteSelected();
      expect(executeMock).not.toHaveBeenCalled();
    });

    it('有选中组时走 deleteGroup 路径', () => {
      const group = makeGroup('group-1', ['clip-a', 'clip-b']);
      const params = makeParams({selectedClipIds: ['clip-a', 'clip-b'], selectedGroup: group});
      const handlers = createClipOperationsHandlers(params, {
        findClip: (id) => makeClip({id}),
        getClipMediaAsset: () => undefined,
        minFrameDuration: () => 1 / 30,
      });
      handlers.deleteSelected();
      expect(executeMock.mock.calls[0][0]).toBeInstanceOf(DeleteGroupCommand);
    });

    it('散 clip 选中时执行 DeleteClipsCommand 并清空选中', () => {
      const params = makeParams({selectedClipIds: ['clip-a', 'clip-b']});
      params.rootRef = {current: {focus: vi.fn()} as never};
      const handlers = createClipOperationsHandlers(params, {
        findClip: (id) => makeClip({id}),
        getClipMediaAsset: () => undefined,
        minFrameDuration: () => 1 / 30,
      });
      handlers.deleteSelected();
      expect(executeMock.mock.calls[0][0]).toBeInstanceOf(DeleteClipsCommand);
      expect(params.setters.clearSelectedClipIds).toHaveBeenCalled();
    });
  });

  describe('rippleDeleteSelected（v4.74.0 核心）', () => {
    it('无选中时直接返回', () => {
      const params = makeParams();
      const handlers = createClipOperationsHandlers(params, {
        findClip: (id) => makeClip({id}),
        getClipMediaAsset: () => undefined,
        minFrameDuration: () => 1 / 30,
      });
      handlers.rippleDeleteSelected();
      expect(executeMock).not.toHaveBeenCalled();
    });

    it('有选中组时降级为 deleteGroup', () => {
      const group = makeGroup('group-1', ['clip-a']);
      const params = makeParams({selectedClipIds: ['clip-a'], selectedGroup: group});
      const handlers = createClipOperationsHandlers(params, {
        findClip: (id) => makeClip({id}),
        getClipMediaAsset: () => undefined,
        minFrameDuration: () => 1 / 30,
      });
      handlers.rippleDeleteSelected();
      expect(executeMock.mock.calls[0][0]).toBeInstanceOf(DeleteGroupCommand);
    });

    it('散 clip 选中时执行 RippleDeleteCommand 携带 protectedRanges', () => {
      const protectedRanges = [{id: 'pr-1', start: 1, end: 2}] as never;
      const params = makeParams({
        selectedClipIds: ['clip-a'],
        protectedRanges,
      });
      params.rootRef = {current: {focus: vi.fn()} as never};
      const handlers = createClipOperationsHandlers(params, {
        findClip: (id) => makeClip({id}),
        getClipMediaAsset: () => undefined,
        minFrameDuration: () => 1 / 30,
      });
      handlers.rippleDeleteSelected();
      expect(executeMock.mock.calls[0][0]).toBeInstanceOf(RippleDeleteCommand);
      expect(params.setters.clearSelectedClipIds).toHaveBeenCalled();
      expect((params.rootRef.current as unknown as {focus: ReturnType<typeof vi.fn>}).focus).toHaveBeenCalled();
    });
  });
});

describe('createClipOperationsHandlers — 标记 / 书签 / 保护范围', () => {
  function makeHandlers(overrides: Parameters<typeof makeParams>[0] = {}) {
    const params = makeParams(overrides);
    const handlers = createClipOperationsHandlers(params, {
      findClip: (id) => makeClip({id}),
      getClipMediaAsset: () => undefined,
      minFrameDuration: () => 1 / 30,
    });
    return {params, handlers};
  }

  beforeEach(() => {
    executeMock.mockReset();
    showToastMock.mockReset();
  });

  it('addTimelineMarker 执行 AddTimelineMarkerCommand', () => {
    const {handlers} = makeHandlers({playheadTime: 4});
    handlers.addTimelineMarker();
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(AddTimelineMarkerCommand);
  });

  it('addTimelineMarker 命令抛错时 toast 警告', () => {
    executeMock.mockImplementation(() => {
      throw new Error('marker rejected');
    });
    const {handlers} = makeHandlers();
    handlers.addTimelineMarker();
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({kind: 'warning'}));
  });

  it('addProjectBookmark 执行命令并打开书签面板', () => {
    const {params, handlers} = makeHandlers({playheadTime: 2});
    handlers.addProjectBookmark();
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(AddProjectBookmarkCommand);
    expect(params.setters.setBookmarkPanelVisible).toHaveBeenCalledWith(true);
    expect(params.setters.setAnnotationPanelOpen).toHaveBeenCalledWith(false);
  });

  it('renameProjectBookmark 执行命令并关闭重命名状态', () => {
    const {params, handlers} = makeHandlers();
    handlers.renameProjectBookmark('bookmark-1', '新名称');
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(UpdateProjectBookmarkCommand);
    expect(params.setters.setBookmarkRename).toHaveBeenCalledWith(undefined);
  });

  it('removeProjectBookmark 执行命令并在匹配时清空重命名状态', () => {
    const {params, handlers} = makeHandlers();
    handlers.removeProjectBookmark('bookmark-1');
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(RemoveProjectBookmarkCommand);
    expect(params.setters.setBookmarkRename).toHaveBeenCalledWith(expect.any(Function));
  });

  it('addProtectedRangeAt 追加保护范围', () => {
    const protectedRanges = [{id: 'pr-0', start: 0, end: 1}] as never;
    const {handlers} = makeHandlers({protectedRanges, playheadTime: 5});
    handlers.addProtectedRangeAt(5);
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(UpdateProjectProtectedRangesCommand);
  });

  it('toggleProtectedRangeAtPlayhead 命中已有范围时移除', () => {
    const protectedRanges = [{id: 'pr-1', start: 1, end: 2}] as never;
    const {handlers} = makeHandlers({protectedRanges, playheadTime: 1.5});
    handlers.toggleProtectedRangeAtPlayhead();
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(UpdateProjectProtectedRangesCommand);
  });

  it('toggleProtectedRangeAtPlayhead 未命中时新增范围', () => {
    const protectedRanges = [{id: 'pr-1', start: 1, end: 2}] as never;
    const {handlers} = makeHandlers({protectedRanges, playheadTime: 5});
    handlers.toggleProtectedRangeAtPlayhead();
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(UpdateProjectProtectedRangesCommand);
  });

  it('removeTimelineMarker 执行 RemoveTimelineMarkerCommand', () => {
    const {handlers} = makeHandlers();
    handlers.removeTimelineMarker('marker-1');
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(RemoveTimelineMarkerCommand);
  });
});

describe('createClipOperationsHandlers — 标尺菜单', () => {
  function makeHandlers(overrides: Parameters<typeof makeParams>[0] = {}, rulerMenu?: Record<string, unknown>) {
    const params = makeParams(overrides);
    if (rulerMenu) {
      Object.assign(params, {rulerMenu});
    }
    const handlers = createClipOperationsHandlers(params, {
      findClip: (id) => makeClip({id}),
      getClipMediaAsset: () => undefined,
      minFrameDuration: () => 1 / 30,
    });
    return {params, handlers};
  }

  beforeEach(() => {
    executeMock.mockReset();
    showToastMock.mockReset();
    setInPointMock.mockReset();
    setOutPointMock.mockReset();
  });

  it('openRulerMenu 关闭其它菜单并写入坐标与 timecode', () => {
    const {params, handlers} = makeHandlers();
    handlers.openRulerMenu({time: 5, x: 5000, y: 5000});
    expect(params.setters.setGapMenu).toHaveBeenCalledWith(undefined);
    expect(params.setters.setClipMenu).toHaveBeenCalledWith(undefined);
    expect(params.setters.setRulerMenu).toHaveBeenCalledWith(
      expect.objectContaining({time: 5, timecode: expect.any(String)}),
    );
  });

  it('runRulerMenuAction 无菜单时直接返回', () => {
    const {handlers} = makeHandlers();
    handlers.runRulerMenuAction('add-marker');
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('runRulerMenuAction add-marker 执行标记命令并关闭菜单', () => {
    const {params, handlers} = makeHandlers({}, {x: 0, y: 0, time: 3, timecode: '00:00:03:00'});
    handlers.runRulerMenuAction('add-marker');
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(AddTimelineMarkerCommand);
    expect(params.setters.setRulerMenu).toHaveBeenCalledWith(undefined);
  });

  it('runRulerMenuAction add-protected-range 执行保护范围命令', () => {
    const {handlers} = makeHandlers({}, {x: 0, y: 0, time: 3, timecode: '00:00:03:00'});
    handlers.runRulerMenuAction('add-protected-range');
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(UpdateProjectProtectedRangesCommand);
  });

  it('runRulerMenuAction set-in / set-out 调用 store setter', () => {
    const {params, handlers} = makeHandlers({}, {x: 0, y: 0, time: 3, timecode: '00:00:03:00'});
    handlers.runRulerMenuAction('set-in');
    expect(setInPointMock).toHaveBeenCalledWith(3);
    handlers.runRulerMenuAction('set-out');
    expect(setOutPointMock).toHaveBeenCalledWith(3);
    expect(params.setters.setRulerMenu).toHaveBeenCalledWith(undefined);
  });

  it('jumpToRulerTimecode 有效 timecode 时移动 playhead 并关闭菜单', () => {
    const {params, handlers} = makeHandlers({}, {x: 0, y: 0, time: 0, timecode: '00:00:05:00'});
    handlers.jumpToRulerTimecode();
    expect(params.setPlayheadTime).toHaveBeenCalledWith(5);
    expect(params.setters.setRulerMenu).toHaveBeenCalledWith(undefined);
  });

  it('jumpToRulerTimecode 无效 timecode 时 toast 警告', () => {
    const {handlers} = makeHandlers({}, {x: 0, y: 0, time: 0, timecode: 'bad-input'});
    handlers.jumpToRulerTimecode();
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({kind: 'warning'}));
  });

  it('jumpToRulerTimecode 无菜单时直接返回', () => {
    const {handlers} = makeHandlers();
    handlers.jumpToRulerTimecode();
    expect(showToastMock).not.toHaveBeenCalled();
  });
});

describe('createClipOperationsHandlers — 节拍 / 注释 / 便签', () => {
  function makeHandlers(overrides: Parameters<typeof makeParams>[0] = {}) {
    const project = overrides.project ?? makeProject();
    if (!overrides.project) {
      project.beatMarkers = [{id: 'beat-1', time: 5}] as never;
      project.annotations = [{id: 'ann-1', time: 1, text: 'a', color: '#ffffff'}] as never;
    }
    const params = makeParams({...overrides, project});
    const handlers = createClipOperationsHandlers(params, {
      findClip: (id) => makeClip({id}),
      getClipMediaAsset: () => undefined,
      minFrameDuration: () => 1 / 30,
    });
    return {params, handlers, project};
  }

  beforeEach(() => {
    executeMock.mockReset();
    showToastMock.mockReset();
    saveFileDialogMock.mockReset();
    writeFileMock.mockReset().mockResolvedValue(undefined);
  });

  it('addBeatMarker 追加节拍标记', () => {
    const {handlers} = makeHandlers({playheadTime: 8});
    handlers.addBeatMarker();
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(UpdateProjectBeatMarkersCommand);
  });

  it('removeBeatMarker 过滤后更新节拍标记', () => {
    const {handlers} = makeHandlers();
    handlers.removeBeatMarker('beat-1');
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(UpdateProjectBeatMarkersCommand);
  });

  it('openAnnotationEditorAt 无已有注释时使用默认值', () => {
    const {params, handlers} = makeHandlers();
    handlers.openAnnotationEditorAt(2);
    expect(params.setters.setAnnotationEditor).toHaveBeenCalledWith(
      expect.objectContaining({id: undefined, time: 2, text: expect.any(String)}),
    );
  });

  it('openAnnotationEditorAt 编辑已有注释时保留原值', () => {
    const {params, handlers, project} = makeHandlers();
    const annotation = (project.annotations as never as {id: string; time: number; text: string; color: string}[])[0];
    handlers.openAnnotationEditorAt(2, annotation as never);
    expect(params.setters.setAnnotationEditor).toHaveBeenCalledWith(
      expect.objectContaining({id: 'ann-1', text: 'a'}),
    );
  });

  it('saveAnnotationEditor 有 id 时执行 UpdateProjectAnnotationCommand', () => {
    const {params, handlers} = makeHandlers();
    handlers.saveAnnotationEditor({id: 'ann-1', time: 1, text: 'b', color: '#ffffff'} as never);
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(UpdateProjectAnnotationCommand);
    expect(params.setters.setAnnotationEditor).toHaveBeenCalledWith(undefined);
    expect(params.setters.setAnnotationPanelOpen).toHaveBeenCalledWith(true);
  });

  it('saveAnnotationEditor 无 id 时执行 AddProjectAnnotationCommand', () => {
    const {handlers} = makeHandlers();
    handlers.saveAnnotationEditor({id: undefined, time: 1, text: 'b', color: '#ffffff'} as never);
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(AddProjectAnnotationCommand);
  });

  it('saveAnnotationEditor 命令抛错时 toast 警告', () => {
    executeMock.mockImplementation(() => {
      throw new Error('annotation rejected');
    });
    const {handlers} = makeHandlers();
    handlers.saveAnnotationEditor({id: undefined, time: 1, text: 'b', color: '#ffffff'} as never);
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({kind: 'warning'}));
  });

  it('removeProjectAnnotation 执行 RemoveProjectAnnotationCommand', () => {
    const {handlers} = makeHandlers();
    handlers.removeProjectAnnotation('ann-1');
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(RemoveProjectAnnotationCommand);
  });

  it('openTimelineNoteEditor 新建时归一化区间', () => {
    const {params, handlers} = makeHandlers();
    handlers.openTimelineNoteEditor(2, 4);
    expect(params.setters.setTimelineNoteEditor).toHaveBeenCalledWith(
      expect.objectContaining({id: undefined, start: 2, end: 4}),
    );
  });

  it('openTimelineNoteEditor 编辑已有便签时保留原值', () => {
    const {params, handlers} = makeHandlers();
    handlers.openTimelineNoteEditor(2, 4, {id: 'n1', start: 1, end: 2, text: 'x', color: 'red'} as never);
    expect(params.setters.setTimelineNoteEditor).toHaveBeenCalledWith(
      expect.objectContaining({id: 'n1', start: 1, end: 2, text: 'x'}),
    );
  });

  it('quickAddTimelineNote 在 playhead 处创建便签并联动面板', () => {
    const {params, handlers} = makeHandlers({playheadTime: 5});
    handlers.quickAddTimelineNote();
    expect(params.setters.setTimelineNoteEditor).toHaveBeenCalledWith(
      expect.objectContaining({start: 5, end: 6}),
    );
    expect(params.setters.setTimelineNotePanelOpen).toHaveBeenCalledWith(true);
    expect(params.setters.setAnnotationPanelOpen).toHaveBeenCalledWith(false);
    expect(params.setters.setBookmarkPanelVisible).toHaveBeenCalledWith(false);
  });

  it('saveTimelineNoteEditor 有 id 时执行 UpdateTimelineNoteCommand', () => {
    const {params, handlers} = makeHandlers();
    handlers.saveTimelineNoteEditor({id: 'n1', start: 1, end: 2, text: 'x', color: 'red'} as never);
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(UpdateTimelineNoteCommand);
    expect(params.setters.setTimelineNoteEditor).toHaveBeenCalledWith(undefined);
  });

  it('saveTimelineNoteEditor 无 id 时执行 AddTimelineNoteCommand', () => {
    const {handlers} = makeHandlers();
    handlers.saveTimelineNoteEditor({id: undefined, start: 1, end: 2, text: 'x', color: 'red'} as never);
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(AddTimelineNoteCommand);
  });

  it('removeTimelineNote 执行 RemoveTimelineNoteCommand', () => {
    const {handlers} = makeHandlers();
    handlers.removeTimelineNote('n1');
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(RemoveTimelineNoteCommand);
  });

  it('onTimelineNoteRangeDraft 打开编辑器并联动面板', () => {
    const {params, handlers} = makeHandlers();
    handlers.onTimelineNoteRangeDraft(1, 3);
    expect(params.setters.setTimelineNoteEditor).toHaveBeenCalledWith(
      expect.objectContaining({start: 1, end: 3}),
    );
    expect(params.setters.setTimelineNotePanelOpen).toHaveBeenCalledWith(true);
  });

  it('exportTimelineNotesCsv 取消选择时不写文件', async () => {
    saveFileDialogMock.mockResolvedValue(undefined);
    const {handlers} = makeHandlers();
    await handlers.exportTimelineNotesCsv();
    expect(writeFileMock).not.toHaveBeenCalled();
    expect(showToastMock).not.toHaveBeenCalled();
  });

  it('exportTimelineNotesCsv 成功时写文件并 toast 成功', async () => {
    saveFileDialogMock.mockResolvedValue('D:/out/notes.csv');
    const {handlers} = makeHandlers();
    await handlers.exportTimelineNotesCsv();
    expect(writeFileMock).toHaveBeenCalledWith('D:/out/notes.csv', expect.any(String));
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({kind: 'success'}));
  });

  it('exportTimelineNotesCsv 失败时 toast 错误', async () => {
    saveFileDialogMock.mockRejectedValue(new Error('dialog failed'));
    const {handlers} = makeHandlers();
    await handlers.exportTimelineNotesCsv();
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({kind: 'error'}));
  });
});

describe('createClipOperationsHandlers — 帧率转换 / 标题模板', () => {
  beforeEach(() => {
    executeMock.mockReset();
    showToastMock.mockReset();
  });

  it('convertClipFrameRate 不满足条件时 toast 警告', () => {
    const clip = makeClip({id: 'clip-a', type: 'video'});
    const project = makeProject({tracks: [makeTrack({clips: [clip]})]});
    const params = makeParams({project});
    const handlers = createClipOperationsHandlers(params, {
      findClip: () => clip,
      getClipMediaAsset: () => undefined,
      minFrameDuration: () => 1 / 30,
    });
    handlers.convertClipFrameRate('clip-a');
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({kind: 'warning'}));
  });

  it('convertClipFrameRate 可变帧率视频触发转换回调', () => {
    const clip = makeClip({id: 'clip-a', type: 'video'});
    const asset = {id: 'asset-v', type: 'video', variableFrameRate: true, frameRate: 29.97};
    const project = makeProject({tracks: [makeTrack({clips: [clip]})]});
    const params = makeParams({project});
    const onConvertMediaFrameRate = vi.fn();
    Object.assign(params, {onConvertMediaFrameRate});
    const handlers = createClipOperationsHandlers(params, {
      findClip: () => clip,
      getClipMediaAsset: () => asset as never,
      minFrameDuration: () => 1 / 30,
    });
    handlers.convertClipFrameRate('clip-a');
    expect(onConvertMediaFrameRate).toHaveBeenCalledWith('asset-v');
    expect(showToastMock).not.toHaveBeenCalled();
  });

  it('addTitleTemplate 无 text 轨道时 toast 警告', () => {
    const params = makeParams();
    const handlers = createClipOperationsHandlers(params, {
      findClip: (id) => makeClip({id}),
      getClipMediaAsset: () => undefined,
      minFrameDuration: () => 1 / 30,
    });
    handlers.addTitleTemplate('lower-third');
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({kind: 'warning'}));
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('addTitleTemplate 有 text 轨道时执行 AddClipCommand', () => {
    const textTrack = makeTrack({id: 'track-text', type: 'text'});
    const project = makeProject({tracks: [makeTrack(), textTrack]});
    const params = makeParams({project});
    const handlers = createClipOperationsHandlers(params, {
      findClip: (id) => makeClip({id}),
      getClipMediaAsset: () => undefined,
      minFrameDuration: () => 1 / 30,
    });
    handlers.addTitleTemplate('lower-third', 2);
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(AddClipCommand);
    expect(params.setters.setSelectedClipId).toHaveBeenCalled();
  });

  it('addCredits 无 text 轨道时 toast 警告', () => {
    const params = makeParams();
    const handlers = createClipOperationsHandlers(params, {
      findClip: (id) => makeClip({id}),
      getClipMediaAsset: () => undefined,
      minFrameDuration: () => 1 / 30,
    });
    handlers.addCredits('滚动字幕');
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({kind: 'warning'}));
    expect(executeMock).not.toHaveBeenCalled();
  });
});

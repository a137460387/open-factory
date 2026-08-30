// @vitest-environment jsdom
// 覆盖目标：apps/desktop/src/components/Timeline/hooks/timeline/track-management.ts（原 0% → ≥80%）
// 策略：工厂直调 createTrackManagementHandlers(params)，mock commandManager 断言
// 轨道增删/批量 patch/重排/表头选择命令对象与状态联动。
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AddTrackCommand, BatchUpdateTrackCommand, UpdateTrackCommand } from '@open-factory/editor-core';

const { executeMock, showToastMock } = vi.hoisted(() => ({
  executeMock: vi.fn(),
  showToastMock: vi.fn(),
}));

vi.mock('../../../../../store/commandManager', () => ({
  commandManager: { execute: (command: unknown) => executeMock(command) },
  projectAccessor: { getProject: vi.fn(), setProject: vi.fn() },
  timelineAccessor: { getTimeline: vi.fn(), setTimeline: vi.fn() },
  setEditorStoreGetter: vi.fn(),
  addOnExecuteListener: vi.fn(),
}));

vi.mock('../../../../../lib/toast', () => ({
  showToast: (toast: unknown) => showToastMock(toast),
}));

import { createTrackManagementHandlers } from '../track-management';
import { makeClip, makeParams, makeProject, makeTrack } from './test-fixtures';

function setup(overrides: Record<string, unknown> = {}) {
  const { selectedTrackIds, trackSelectionAnchorId, ...rest } = overrides;
  const params = makeParams(rest as Parameters<typeof makeParams>[0]);
  if (selectedTrackIds !== undefined) {
    Object.assign(params, { selectedTrackIds });
  }
  if (trackSelectionAnchorId !== undefined) {
    Object.assign(params, { trackSelectionAnchorId });
  }
  const handlers = createTrackManagementHandlers(params);
  return { params, handlers };
}

beforeEach(() => {
  executeMock.mockReset();
  showToastMock.mockReset();
});

describe('createTrackManagementHandlers — addTrack / updateTrack', () => {
  it('addTrack 执行 AddTrackCommand', () => {
    const { handlers } = setup();
    handlers.addTrack('video');
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(AddTrackCommand);
  });

  it('updateTrack 执行 UpdateTrackCommand 携带 patch', () => {
    const { handlers } = setup();
    handlers.updateTrack('track-1', { locked: true });
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(UpdateTrackCommand);
  });
});

describe('createTrackManagementHandlers — selectTrackHeader', () => {
  it('普通点击选中单轨并设为锚点', () => {
    const { params, handlers } = setup({ selectedTrackIds: [] });
    handlers.selectTrackHeader('track-2', { shiftKey: false } as never);
    expect(params.setSelectedTrackIds).toHaveBeenCalledWith(['track-2']);
    expect(params.setTrackSelectionAnchorId).toHaveBeenCalledWith('track-2');
    expect(params.setTrackBatchMenu).toHaveBeenCalledWith(undefined);
  });

  it('shift 点击基于锚点扩展范围选择', () => {
    const clipA = makeClip({ id: 'clip-a' });
    const project = makeProject({
      tracks: [
        makeTrack({ id: 'track-1', clips: [clipA] }),
        makeTrack({ id: 'track-2' }),
        makeTrack({ id: 'track-3' }),
      ],
    });
    const { params, handlers } = setup({
      project,
      selectedTrackIds: ['track-1'],
      trackSelectionAnchorId: 'track-1',
    });
    handlers.selectTrackHeader('track-3', { shiftKey: true } as never);
    expect(params.setSelectedTrackIds).toHaveBeenCalledWith(['track-1', 'track-2', 'track-3']);
    expect(params.setTrackSelectionAnchorId).toHaveBeenCalledWith('track-1');
  });

  it('shift 点击锚点失效时退化为单选', () => {
    const { params, handlers } = setup({ selectedTrackIds: ['track-1'] });
    handlers.selectTrackHeader('track-2', { shiftKey: true } as never);
    expect(params.setSelectedTrackIds).toHaveBeenCalledWith(['track-2']);
  });
});

describe('createTrackManagementHandlers — openTrackBatchMenu', () => {
  it('未选中轨道时先选中再打开菜单', () => {
    const { params, handlers } = setup({ selectedTrackIds: [] });
    handlers.openTrackBatchMenu('track-1', 100, 100);
    expect(params.setSelectedTrackIds).toHaveBeenCalledWith(['track-1']);
    expect(params.setTrackSelectionAnchorId).toHaveBeenCalledWith('track-1');
    expect(params.setTrackBatchMenu).toHaveBeenCalledWith(
      expect.objectContaining({ trackId: 'track-1', x: 100, y: 100 }),
    );
  });

  it('已选中轨道时不改选择直接打开菜单并关闭其它菜单', () => {
    const { params, handlers } = setup({ selectedTrackIds: ['track-1'] });
    handlers.openTrackBatchMenu('track-1', 100, 100);
    expect(params.setSelectedTrackIds).not.toHaveBeenCalled();
    expect(params.setGapMenu).toHaveBeenCalledWith(undefined);
    expect(params.setClipMenu).toHaveBeenCalledWith(undefined);
  });

  it('菜单坐标夹在视口内', () => {
    const { params, handlers } = setup({ selectedTrackIds: ['track-1'] });
    handlers.openTrackBatchMenu('track-1', 10000, 10000);
    const menu = (params.setTrackBatchMenu as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(menu.x).toBeLessThanOrEqual(window.innerWidth);
    expect(menu.y).toBeLessThanOrEqual(window.innerHeight);
  });
});

describe('createTrackManagementHandlers — 批量 patch', () => {
  it('selectedTracksForBatch 返回选中轨道', () => {
    const clipA = makeClip({ id: 'clip-a' });
    const project = makeProject({
      tracks: [makeTrack({ id: 'track-1', clips: [clipA] }), makeTrack({ id: 'track-2' })],
    });
    const { handlers } = setup({ project, selectedTrackIds: ['track-2'] });
    expect(handlers.selectedTracksForBatch().map((track) => track.id)).toEqual(['track-2']);
  });

  it('applyBatchTrackPatch 无选中轨道时直接返回', () => {
    const { params, handlers } = setup({ selectedTrackIds: [] });
    handlers.applyBatchTrackPatch(() => ({ muted: true }));
    expect(executeMock).not.toHaveBeenCalled();
    expect(params.setTrackBatchMenu).not.toHaveBeenCalled();
  });

  it('applyBatchTrackPatch 执行 BatchUpdateTrackCommand 并关闭菜单', () => {
    const clipA = makeClip({ id: 'clip-a' });
    const project = makeProject({
      tracks: [makeTrack({ id: 'track-1', clips: [clipA] }), makeTrack({ id: 'track-2' })],
    });
    const { params, handlers } = setup({ project, selectedTrackIds: ['track-1', 'track-2'] });
    handlers.applyBatchTrackPatch(() => ({ muted: true }));
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(BatchUpdateTrackCommand);
    expect(params.setTrackBatchMenu).toHaveBeenCalledWith(undefined);
  });

  it('applyBatchTrackPatch 命令抛错时 toast 警告', () => {
    executeMock.mockImplementation(() => {
      throw new Error('track rejected');
    });
    const clipA = makeClip({ id: 'clip-a' });
    const project = makeProject({ tracks: [makeTrack({ id: 'track-1', clips: [clipA] })] });
    const { handlers } = setup({ project, selectedTrackIds: ['track-1'] });
    handlers.applyBatchTrackPatch(() => ({ muted: true }));
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({ kind: 'warning' }));
  });
});

describe('createTrackManagementHandlers — deleteSelectedEmptyTracks', () => {
  it('无选中轨道时直接返回', () => {
    const { handlers } = setup({ selectedTrackIds: [] });
    handlers.deleteSelectedEmptyTracks();
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('执行批量删除空轨道并过滤选中列表', () => {
    const clipA = makeClip({ id: 'clip-a' });
    const project = makeProject({
      tracks: [makeTrack({ id: 'track-1', clips: [clipA] }), makeTrack({ id: 'track-2', clips: [] })],
    });
    const { params, handlers } = setup({ project, selectedTrackIds: ['track-1', 'track-2'] });
    handlers.deleteSelectedEmptyTracks();
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(BatchUpdateTrackCommand);
    expect(params.setSelectedTrackIds).toHaveBeenCalledWith(expect.any(Function));
    expect(params.setTrackBatchMenu).toHaveBeenCalledWith(undefined);
  });

  it('命令抛错时 toast 警告', () => {
    executeMock.mockImplementation(() => {
      throw new Error('delete rejected');
    });
    const clipA = makeClip({ id: 'clip-a' });
    const project = makeProject({ tracks: [makeTrack({ id: 'track-1', clips: [clipA] })] });
    const { handlers } = setup({ project, selectedTrackIds: ['track-1'] });
    handlers.deleteSelectedEmptyTracks();
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({ kind: 'warning' }));
  });
});

describe('createTrackManagementHandlers — reorderTracks', () => {
  it('顺序未变化时直接返回', () => {
    const clipA = makeClip({ id: 'clip-a' });
    const project = makeProject({
      tracks: [makeTrack({ id: 'track-1', clips: [clipA] }), makeTrack({ id: 'track-2' })],
    });
    const { params, handlers } = setup({ project, selectedTrackIds: ['track-1'] });
    handlers.reorderTracks('track-1', 'track-2');
    expect(executeMock).not.toHaveBeenCalled();
    expect(params.setTrackBatchMenu).not.toHaveBeenCalled();
  });

  it('重排执行 BatchUpdateTrackCommand 并更新选中', () => {
    const clipA = makeClip({ id: 'clip-a' });
    const project = makeProject({
      tracks: [
        makeTrack({ id: 'track-1', clips: [clipA] }),
        makeTrack({ id: 'track-2' }),
        makeTrack({ id: 'track-3' }),
      ],
    });
    const { params, handlers } = setup({ project, selectedTrackIds: ['track-1'] });
    handlers.reorderTracks('track-1', 'track-3');
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(BatchUpdateTrackCommand);
    expect(params.setSelectedTrackIds).toHaveBeenCalledWith(['track-1']);
    expect(params.setTrackSelectionAnchorId).toHaveBeenCalledWith('track-1');
    expect(params.setTrackBatchMenu).toHaveBeenCalledWith(undefined);
  });

  it('拖动未选中轨道时选中切换单轨', () => {
    const clipA = makeClip({ id: 'clip-a' });
    const project = makeProject({
      tracks: [makeTrack({ id: 'track-1', clips: [clipA] }), makeTrack({ id: 'track-2' })],
    });
    const { params, handlers } = setup({ project, selectedTrackIds: ['track-1'] });
    handlers.reorderTracks('track-2', 'track-1');
    expect(params.setSelectedTrackIds).toHaveBeenCalledWith(['track-2']);
  });

  it('命令抛错时 toast 警告', () => {
    executeMock.mockImplementation(() => {
      throw new Error('reorder rejected');
    });
    const clipA = makeClip({ id: 'clip-a' });
    const project = makeProject({
      tracks: [
        makeTrack({ id: 'track-1', clips: [clipA] }),
        makeTrack({ id: 'track-2' }),
        makeTrack({ id: 'track-3' }),
      ],
    });
    const { handlers } = setup({ project, selectedTrackIds: ['track-1'] });
    handlers.reorderTracks('track-1', 'track-3');
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({ kind: 'warning' }));
  });
});

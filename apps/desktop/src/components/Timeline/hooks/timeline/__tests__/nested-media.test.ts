// @vitest-environment jsdom
// 覆盖目标：apps/desktop/src/components/Timeline/hooks/timeline/nested-media.ts（原 0% → ≥75%）
// 策略：工厂直调 createNestedMediaHandlers(params, helpers)，mock openFileDialog/
// probeMediaPath/useEditorStore.getState，断言嵌套序列打包/替换媒体/版本切换命令。
import {describe, expect, it, vi, beforeEach} from 'vitest';
import type {Clip} from '@open-factory/editor-core';
import {
  PackNestedSequenceCommand,
  ReplaceMediaCommand,
  SwitchMediaVersionCommand,
} from '@open-factory/editor-core';

const {
  executeMock,
  showToastMock,
  openFileDialogMock,
  probeMediaPathMock,
  editorStoreState,
} = vi.hoisted(() => ({
  executeMock: vi.fn(),
  showToastMock: vi.fn(),
  openFileDialogMock: vi.fn(),
  probeMediaPathMock: vi.fn(),
  editorStoreState: {project: {sequences: [] as Array<{id: string}>, timeline: {tracks: []}}},
}));

vi.mock('../../../../../store/commandManager', () => ({
  commandManager: {execute: (command: unknown) => executeMock(command)},
  projectAccessor: {getProject: vi.fn(), setProject: vi.fn()},
  timelineAccessor: {getTimeline: vi.fn(), setTimeline: vi.fn()},
  setEditorStoreGetter: vi.fn(),
  addOnExecuteListener: vi.fn(),
}));

vi.mock('../../../../../store/editorStore', () => ({
  useEditorStore: {getState: () => editorStoreState},
}));

vi.mock('../../../../../lib/tauri-bridge', () => ({
  openFileDialog: (...args: unknown[]) => openFileDialogMock(...args),
}));

vi.mock('../../../../../lib/media', () => ({
  probeMediaPath: (...args: unknown[]) => probeMediaPathMock(...args),
}));

vi.mock('../../../../../lib/toast', () => ({
  showToast: (toast: unknown) => showToastMock(toast),
}));

import {createNestedMediaHandlers} from '../nested-media';
import {makeAsset, makeClip, makeParams, makeProject, makeTrack} from './test-fixtures';

function setup(
  overrides: Parameters<typeof makeParams>[0] & {replaceMediaDialog?: unknown} = {},
  clips: Clip[] = [makeClip({id: 'clip-a', type: 'video'})],
) {
  const {replaceMediaDialog, ...rest} = overrides;
  const project = rest.project ?? makeProject({tracks: [makeTrack({clips})]});
  const params = makeParams({...rest, project});
  if (replaceMediaDialog !== undefined) {
    Object.assign(params, {replaceMediaDialog});
  }
  const handlers = createNestedMediaHandlers(params, {
    findClip: (clipId) => clips.find((clip) => clip.id === clipId) ?? makeClip({id: clipId}),
    getClipMediaAsset: () => undefined,
  });
  return {params, handlers};
}

beforeEach(() => {
  executeMock.mockReset();
  showToastMock.mockReset();
  openFileDialogMock.mockReset().mockResolvedValue([]);
  probeMediaPathMock.mockReset().mockResolvedValue(makeAsset({id: 'asset-new'}));
  editorStoreState.project = {sequences: [], timeline: {tracks: []}};
});

describe('createNestedMediaHandlers — openNestedSequence', () => {
  it('非嵌套序列 clip 直接返回', () => {
    const {params, handlers} = setup();
    handlers.openNestedSequence(makeClip({id: 'clip-a', type: 'video'}));
    expect(params.setActiveSequenceId).not.toHaveBeenCalled();
  });

  it('嵌套序列 clip 切换活动序列', () => {
    const {params, handlers} = setup();
    editorStoreState.project = {sequences: [{id: 'seq-1'}], timeline: {tracks: []}};
    handlers.openNestedSequence({id: 'clip-n', type: 'nested-sequence', sequenceId: 'seq-1'} as never);
    expect(params.setActiveSequenceId).toHaveBeenCalledWith('seq-1');
    expect(showToastMock).not.toHaveBeenCalled();
  });
});

describe('createNestedMediaHandlers — packClipMenuSelection', () => {
  it('选中含目标 clip 时打包整个选中集', () => {
    const {params, handlers} = setup({selectedClipIds: ['clip-a', 'clip-b']});
    handlers.packClipMenuSelection('clip-a');
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(PackNestedSequenceCommand);
    expect(params.setters.setClipMenu).toHaveBeenCalledWith(undefined);
  });

  it('目标不在选中集时仅打包目标', () => {
    const {handlers} = setup({selectedClipIds: ['clip-z']});
    handlers.packClipMenuSelection('clip-a');
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(PackNestedSequenceCommand);
  });

  it('命令抛错时 toast 错误', () => {
    executeMock.mockImplementation(() => {
      throw new Error('pack rejected');
    });
    const {handlers} = setup({selectedClipIds: ['clip-a']});
    handlers.packClipMenuSelection('clip-a');
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({kind: 'error'}));
  });
});

describe('createNestedMediaHandlers — openReplaceMedia', () => {
  it('取消文件选择时不打开对话框', async () => {
    openFileDialogMock.mockResolvedValue([]);
    const {params, handlers} = setup();
    await handlers.openReplaceMedia('clip-a');
    expect(params.setReplaceMediaDialog).not.toHaveBeenCalled();
    expect(params.setters.setSelectedClipId).toHaveBeenCalledWith('clip-a');
  });

  it('选择文件后打开替换对话框并写入警告', async () => {
    const media = makeAsset({id: 'asset-new', type: 'video'});
    openFileDialogMock.mockResolvedValue(['D:/media/new.mp4']);
    probeMediaPathMock.mockResolvedValue(media);
    const {params, handlers} = setup();
    await handlers.openReplaceMedia('clip-a');
    expect(params.addMedia).toHaveBeenCalledWith([media]);
    expect(params.setReplaceMediaDialog).toHaveBeenCalledWith(
      expect.objectContaining({clipId: 'clip-a', media, durationMode: 'trim-to-original'}),
    );
  });

  it('打开对话框失败时 toast 错误', async () => {
    openFileDialogMock.mockRejectedValue(new Error('dialog failed'));
    const {handlers} = setup();
    await handlers.openReplaceMedia('clip-a');
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({kind: 'error'}));
  });
});

describe('createNestedMediaHandlers — confirmReplaceMedia', () => {
  it('无对话框时直接返回', () => {
    const {handlers} = setup();
    handlers.confirmReplaceMedia();
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('执行 ReplaceMediaCommand 并 toast 成功', () => {
    const media = makeAsset({id: 'asset-new', type: 'video'});
    const {params, handlers} = setup({
      replaceMediaDialog: {clipId: 'clip-a', media, durationMode: 'trim-to-original', warnings: []} as never,
    });
    handlers.confirmReplaceMedia();
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(ReplaceMediaCommand);
    expect(params.setters.setSelectedClipId).toHaveBeenCalledWith('clip-a');
    expect(params.setReplaceMediaDialog).toHaveBeenCalledWith(undefined);
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({kind: 'success'}));
  });

  it('命令抛错时 toast 错误', () => {
    executeMock.mockImplementation(() => {
      throw new Error('replace rejected');
    });
    const media = makeAsset({id: 'asset-new', type: 'video'});
    const {handlers} = setup({
      replaceMediaDialog: {clipId: 'clip-a', media, durationMode: 'trim-to-original', warnings: []} as never,
    });
    handlers.confirmReplaceMedia();
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({kind: 'error'}));
  });
});

describe('createNestedMediaHandlers — getClipMediaVersionEntries', () => {
  it('clip 无 mediaId 时返回空', () => {
    const {handlers} = setup();
    expect(handlers.getClipMediaVersionEntries(makeClip({id: 'clip-a', type: 'video'}))).toEqual([]);
  });

  it('clip 为 undefined 时返回空', () => {
    const {handlers} = setup();
    expect(handlers.getClipMediaVersionEntries(undefined)).toEqual([]);
  });
});

describe('createNestedMediaHandlers — switchClipMediaVersion', () => {
  it('目标 media 不存在时 toast 错误', () => {
    const {handlers} = setup();
    handlers.switchClipMediaVersion('clip-a', 'asset-missing');
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({kind: 'error'}));
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('执行 SwitchMediaVersionCommand 并 toast 成功', () => {
    const media = makeAsset({id: 'asset-v2', type: 'video'});
    const project = makeProject({media: [media]});
    const {params, handlers} = setup({project});
    handlers.switchClipMediaVersion('clip-a', 'asset-v2');
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(SwitchMediaVersionCommand);
    expect(params.setters.setSelectedClipId).toHaveBeenCalledWith('clip-a');
    expect(params.setters.setClipMenu).toHaveBeenCalledWith(undefined);
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({kind: 'success'}));
  });

  it('命令抛错时 toast 错误', () => {
    executeMock.mockImplementation(() => {
      throw new Error('switch rejected');
    });
    const media = makeAsset({id: 'asset-v2', type: 'video'});
    const project = makeProject({media: [media]});
    const {handlers} = setup({project});
    handlers.switchClipMediaVersion('clip-a', 'asset-v2');
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({kind: 'error'}));
  });
});

// @vitest-environment jsdom
// 覆盖目标：apps/desktop/src/components/Timeline/hooks/timeline/volume-envelope.ts（原 0% → ≥75%）
// 策略：工厂直调 createVolumeEnvelopeHandlers(params, helpers)，mock commandManager
// 断言音量包络点增删改/淡入淡出/重置的命令对象。
import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  AddKeyframeCommand,
  BatchUpdateKeyframeCommand,
  RemoveKeyframeCommand,
  UpdateKeyframeCommand,
} from '@open-factory/editor-core';

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

import { createVolumeEnvelopeHandlers } from '../volume-envelope';
import { makeClip, makeParams } from './test-fixtures';

function setup(volumeEnvelopeMenu?: Record<string, unknown>) {
  const params = makeParams();
  if (volumeEnvelopeMenu !== undefined) {
    Object.assign(params, { volumeEnvelopeMenu });
  }
  const handlers = createVolumeEnvelopeHandlers(params, {
    findClip: (clipId) => makeClip({ id: clipId, duration: 10 }),
  });
  return { params, handlers };
}

beforeEach(() => {
  executeMock.mockReset();
  showToastMock.mockReset();
});

describe('createVolumeEnvelopeHandlers — addVolumeEnvelopePoint', () => {
  it('执行 AddKeyframeCommand 并选中关键帧', () => {
    const { params, handlers } = setup();
    handlers.addVolumeEnvelopePoint({ clipId: 'clip-a', time: 2, value: 0.8 });
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(AddKeyframeCommand);
    expect(params.setters.setSelectedClipId).toHaveBeenCalledWith('clip-a');
    expect(params.setSelectedKeyframe).toHaveBeenCalledWith(
      expect.objectContaining({ clipId: 'clip-a', property: 'volume' }),
    );
  });

  it('命令抛错时 toast 警告', () => {
    executeMock.mockImplementation(() => {
      throw new Error('keyframe rejected');
    });
    const { handlers } = setup();
    handlers.addVolumeEnvelopePoint({ clipId: 'clip-a', time: 2, value: 0.8 });
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({ kind: 'warning' }));
  });
});

describe('createVolumeEnvelopeHandlers — updateVolumeEnvelopePoint', () => {
  it('执行 UpdateKeyframeCommand 并选中', () => {
    const { params, handlers } = setup();
    handlers.updateVolumeEnvelopePoint({ clipId: 'clip-a', time: 3, value: 0.5, keyframeId: 'kf-1' });
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(UpdateKeyframeCommand);
    expect(params.setters.setSelectedClipId).toHaveBeenCalledWith('clip-a');
    expect(params.setSelectedKeyframe).toHaveBeenCalledWith(expect.objectContaining({ keyframeId: 'kf-1' }));
  });

  it('命令抛错时 toast 警告', () => {
    executeMock.mockImplementation(() => {
      throw new Error('update rejected');
    });
    const { handlers } = setup();
    handlers.updateVolumeEnvelopePoint({ clipId: 'clip-a', time: 3, value: 0.5, keyframeId: 'kf-1' });
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({ kind: 'warning' }));
  });
});

describe('createVolumeEnvelopeHandlers — removeVolumeEnvelopePoint', () => {
  it('执行 RemoveKeyframeCommand 并清空关键帧选择', () => {
    const { params, handlers } = setup();
    handlers.removeVolumeEnvelopePoint({ clipId: 'clip-a', keyframeId: 'kf-1' });
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(RemoveKeyframeCommand);
    expect(params.setSelectedKeyframes).toHaveBeenCalledWith([]);
    expect(params.setters.setSelectedClipId).toHaveBeenCalledWith('clip-a');
  });

  it('命令抛错时 toast 警告', () => {
    executeMock.mockImplementation(() => {
      throw new Error('remove rejected');
    });
    const { handlers } = setup();
    handlers.removeVolumeEnvelopePoint({ clipId: 'clip-a', keyframeId: 'kf-1' });
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({ kind: 'warning' }));
  });
});

describe('createVolumeEnvelopeHandlers — openVolumeEnvelopeMenu', () => {
  it('关闭其它菜单并写入坐标夹持的菜单状态', () => {
    const { params, handlers } = setup();
    handlers.openVolumeEnvelopeMenu({ clipId: 'clip-a', x: 10000, y: 10000 });
    expect(params.setters.setTransitionMenu).toHaveBeenCalledWith(undefined);
    expect(params.setters.setClipMenu).toHaveBeenCalledWith(undefined);
    expect(params.setters.setGapMenu).toHaveBeenCalledWith(undefined);
    expect(params.setters.setRulerMenu).toHaveBeenCalledWith(undefined);
    expect(params.setters.setSelectedClipId).toHaveBeenCalledWith('clip-a');
    const menu = (params.setters.setVolumeEnvelopeMenu as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(menu.x).toBeLessThanOrEqual(window.innerWidth);
    expect(menu.y).toBeLessThanOrEqual(window.innerHeight);
  });
});

describe('createVolumeEnvelopeHandlers — applyVolumeEnvelopeFade', () => {
  it('无菜单时直接返回', () => {
    const { handlers } = setup();
    handlers.applyVolumeEnvelopeFade('in');
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('执行 BatchUpdateKeyframeCommand 写入淡入关键帧', () => {
    const { params, handlers } = setup({ clipId: 'clip-a', time: 0 });
    handlers.applyVolumeEnvelopeFade('in');
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(BatchUpdateKeyframeCommand);
    expect(params.setSelectedKeyframes).toHaveBeenCalledWith(expect.any(Array));
    expect(params.setters.setVolumeEnvelopeMenu).toHaveBeenCalledWith(undefined);
  });

  it('命令抛错时 toast 警告', () => {
    executeMock.mockImplementation(() => {
      throw new Error('fade rejected');
    });
    const { handlers } = setup({ clipId: 'clip-a', time: 0 });
    handlers.applyVolumeEnvelopeFade('out');
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({ kind: 'warning' }));
  });
});

describe('createVolumeEnvelopeHandlers — resetVolumeEnvelope', () => {
  it('无菜单时直接返回', () => {
    const { handlers } = setup();
    handlers.resetVolumeEnvelope();
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('执行 BatchUpdateKeyframeCommand 清空关键帧', () => {
    const { params, handlers } = setup({ clipId: 'clip-a', time: 0 });
    handlers.resetVolumeEnvelope();
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(BatchUpdateKeyframeCommand);
    expect(params.setSelectedKeyframes).toHaveBeenCalledWith([]);
    expect(params.setters.setSelectedClipId).toHaveBeenCalledWith('clip-a');
    expect(params.setters.setVolumeEnvelopeMenu).toHaveBeenCalledWith(undefined);
  });

  it('命令抛错时 toast 警告', () => {
    executeMock.mockImplementation(() => {
      throw new Error('reset rejected');
    });
    const { handlers } = setup({ clipId: 'clip-a', time: 0 });
    handlers.resetVolumeEnvelope();
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({ kind: 'warning' }));
  });
});

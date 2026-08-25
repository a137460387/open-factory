// @vitest-environment jsdom
// 覆盖目标：apps/desktop/src/components/Timeline/hooks/timeline/drag-handlers.ts（原 0% → ≥70%）
// 策略：工厂直调，构造 DragState fixture 直调 onPointerMove/onPointerUp/onDragStart，
// mock commandManager 断言命令对象，不模拟真实 DOM 事件序列。
import {describe, expect, it, vi, beforeEach} from 'vitest';
import type {Clip} from '@open-factory/editor-core';
import {
  BatchKeyframeEditCommand,
  MoveClipCommand,
  MoveClipsCommand,
  RollingTrimCommand,
  SlipClipCommand,
  SlideClipCommand,
  TrimClipCommand,
  UpdateKeyframeCommand,
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

import {createDragHandlers} from '../drag-handlers';
import type {DragState} from '../../../TimelineParts';
import {makeClip, makeParams, makeProject, makeTrack} from './test-fixtures';

function makeDrag(overrides: Partial<DragState> = {}): DragState {
  return {
    mode: 'move',
    startX: 0,
    clip: makeClip({id: 'clip-a', start: 5, duration: 5}),
    previewStart: 5,
    ...overrides,
  } as DragState;
}

function makeHelpers(clips: Clip[], overrides: Record<string, unknown> = {}) {
  return {
    findClipById: (clipId: string) => clips.find((clip) => clip.id === clipId),
    findClip: (clipId: string) => clips.find((clip) => clip.id === clipId) ?? makeClip({id: clipId}),
    getKeyframeTime: () => 1,
    buildKeyframeStartTimes: () => ({}),
    snapKeyframeTime: (_clip: Clip, localTime: number) => localTime,
    snapClipStart: (time: number) => time,
    buildMovedPreviewTimeline: (starts: Record<string, number>) => ({tracks: [], markers: [], starts}),
    buildTrimPreview: (clip: Clip) => clip,
    minFrameDuration: () => 1 / 30,
    canApplyProtectedMove: () => true,
    warnProtectedRangeBlocked: vi.fn(),
    ...overrides,
  };
}

function setup(
  drag?: DragState,
  clips: Clip[] = [makeClip({id: 'clip-a', start: 5, duration: 5})],
  helperOverrides: Record<string, unknown> = {},
  extraParams: Record<string, unknown> = {},
) {
  const project = makeProject({tracks: [makeTrack({clips})]});
  const params = makeParams({project, allClips: clips});
  if (drag !== undefined) {
    Object.assign(params, {drag});
  }
  Object.assign(params, extraParams);
  const handlers = createDragHandlers(params, makeHelpers(clips, helperOverrides));
  return {params, handlers};
}

beforeEach(() => {
  executeMock.mockReset();
  showToastMock.mockReset();
});

describe('createDragHandlers — onPointerMove', () => {
  it('框选进行时更新选框矩形', () => {
    const {params, handlers} = setup(undefined, undefined, {}, {selectionStart: {x: 10, y: 10}});
    handlers.onPointerMove({clientX: 30, clientY: 40} as never);
    expect(params.setSelectionRect).toHaveBeenCalledWith(
      expect.objectContaining({left: 10, top: 10, right: 30, bottom: 40}),
    );
  });

  it('无 drag 状态时直接返回', () => {
    const {params, handlers} = setup();
    handlers.onPointerMove({clientX: 30} as never);
    expect(params.setDrag).not.toHaveBeenCalled();
  });

  it('playhead 拖拽更新 playhead 并吸附', () => {
    const {params, handlers} = setup(makeDrag({mode: 'playhead', clip: undefined, previewStart: 5}));
    handlers.onPointerMove({clientX: 100} as never);
    expect(params.setPlayheadTime).toHaveBeenCalledWith(6);
  });

  it('playhead 拖拽不小于 0', () => {
    const {params, handlers} = setup(makeDrag({mode: 'playhead', clip: undefined, previewStart: 0}));
    handlers.onPointerMove({clientX: -500} as never);
    expect(params.setPlayheadTime).toHaveBeenCalledWith(0);
  });

  it('move 模式更新预览位置与预览时间线', () => {
    const {params, handlers} = setup(makeDrag({startX: 0, previewStart: 5}));
    handlers.onPointerMove({clientX: 100} as never);
    expect(params.setDrag).toHaveBeenCalledWith(expect.objectContaining({previewStart: 6}));
    expect(params.setPreviewTimeline).toHaveBeenCalled();
  });

  it('move 多选时保持组内偏移', () => {
    const clips = [makeClip({id: 'clip-a', start: 5, duration: 5}), makeClip({id: 'clip-b', start: 20, duration: 5})];
    const drag = makeDrag({startX: 0, clip: clips[0]});
    (drag as {startByClipId?: Record<string, number>}).startByClipId = {'clip-a': 5, 'clip-b': 20};
    const {params, handlers} = setup(drag, clips);
    handlers.onPointerMove({clientX: 100} as never);
    const next = (params.setDrag as ReturnType<typeof vi.fn>).mock.calls[0][0] as DragState;
    expect(next.previewStartsByClipId).toEqual({'clip-a': 6, 'clip-b': 21});
  });

  it('rolling-trim 模式记录滚动增量', () => {
    const {params, handlers} = setup(makeDrag({mode: 'rolling-trim', startX: 0}));
    handlers.onPointerMove({clientX: 150} as never);
    expect(params.setDrag).toHaveBeenCalledWith(expect.objectContaining({previewRollingDelta: 1.5}));
  });

  it('slip 模式更新 trim 预览', () => {
    const {params, handlers} = setup(makeDrag({mode: 'slip', startX: 0}));
    handlers.onPointerMove({clientX: 100} as never);
    expect(params.setDrag).toHaveBeenCalledWith(expect.objectContaining({previewSlipDelta: 1}));
    expect(params.setPreviewTimeline).toHaveBeenCalled();
  });

  it('slide 模式构建编辑预览', () => {
    // clipA 带 trimEnd 提供可扩展的源时长，slide 才有可用媒体
    const clipA = makeClip({id: 'clip-a', start: 0, duration: 5, trimEnd: 3});
    const clipB = makeClip({id: 'clip-b', start: 5, duration: 5});
    const clipC = makeClip({id: 'clip-c', start: 10, duration: 5});
    const {params, handlers} = setup(makeDrag({mode: 'slide', startX: 0, clip: clipB}), [clipA, clipB, clipC]);
    handlers.onPointerMove({clientX: 100} as never);
    expect(params.setDrag).toHaveBeenCalledWith(expect.objectContaining({previewSlideDelta: 1}));
  });

  it('slide 模式构建失败时清空预览', () => {
    const clip = makeClip({id: 'clip-a', start: 5, duration: 5});
    const params = makeParams({project: makeProject({tracks: [makeTrack({clips: [clip]})]})});
    Object.assign(params, {drag: makeDrag({mode: 'slide', startX: 0})});
    const handlers = createDragHandlers(params, makeHelpers([clip]));
    // buildSlideClipEdit 需要 rightClip；无右邻 clip 时抛错走 catch
    handlers.onPointerMove({clientX: 100} as never);
    expect(params.setDrag).toHaveBeenCalledWith(expect.objectContaining({previewSlideDelta: 0}));
  });

  it('trim-left 模式更新裁剪预览', () => {
    const {params, handlers} = setup(makeDrag({mode: 'trim-left', startX: 0}));
    handlers.onPointerMove({clientX: 100} as never);
    expect(params.setDrag).toHaveBeenCalledWith(expect.objectContaining({previewStart: expect.any(Number)}));
  });

  it('trim-right 模式更新时长预览', () => {
    const {params, handlers} = setup(makeDrag({mode: 'trim-right', startX: 0}));
    handlers.onPointerMove({clientX: 100} as never);
    expect(params.setDrag).toHaveBeenCalledWith(expect.objectContaining({previewDuration: expect.any(Number)}));
  });

  it('keyframe 模式更新关键帧预览时间', () => {
    const {params, handlers} = setup(
      makeDrag({
        mode: 'keyframe',
        startX: 0,
        previewStart: 1,
        keyframeProperty: 'volume',
        keyframeId: 'kf-1',
        keyframeStartTimes: {},
      }),
    );
    handlers.onPointerMove({clientX: 100} as never);
    expect(params.setDrag).toHaveBeenCalledWith(
      expect.objectContaining({previewKeyframeTime: 2, previewKeyframeDelta: 1}),
    );
  });

  it('keyframe 仅选择模式不更新预览', () => {
    const {params, handlers} = setup(makeDrag({mode: 'keyframe', keyframeSelectionOnly: true}));
    handlers.onPointerMove({clientX: 100} as never);
    expect(params.setDrag).not.toHaveBeenCalled();
  });
});

describe('createDragHandlers — onPointerUp', () => {
  it('框选结束时选中相交 clip 并清空框选状态', () => {
    const {params, handlers} = setup(
      undefined,
      undefined,
      {},
      {
        selectionStart: {x: 0, y: 0},
        selectionRect: {left: 0, top: 0, right: 100, bottom: 100},
      },
    );
    handlers.onPointerUp();
    expect(params.setSelectedClipIds).toHaveBeenCalledWith([]);
    expect(params.setSelectionStart).toHaveBeenCalledWith(undefined);
    expect(params.setSelectionRect).toHaveBeenCalledWith(undefined);
  });

  it('无 drag 时直接返回', () => {
    setup();
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('playhead 拖拽结束不执行命令', () => {
    const {handlers} = setup(makeDrag({mode: 'playhead', clip: undefined}));
    handlers.onPointerUp();
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('move 多选结束执行 MoveClipsCommand', () => {
    const drag = makeDrag();
    (drag as {previewStartsByClipId?: Record<string, number>}).previewStartsByClipId = {'clip-a': 6, 'clip-b': 21};
    const {handlers} = setup(
      drag,
      [makeClip({id: 'clip-a', start: 5, duration: 5}), makeClip({id: 'clip-b', start: 20, duration: 5})],
    );
    handlers.onPointerUp();
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(MoveClipsCommand);
  });

  it('move 单选结束执行 MoveClipCommand', () => {
    const {handlers} = setup(makeDrag({previewStart: 6}));
    handlers.onPointerUp();
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(MoveClipCommand);
  });

  it('move 单选产生重叠时 toast 警告不执行命令', () => {
    const clipA = makeClip({id: 'clip-a', start: 5, duration: 5});
    const clipB = makeClip({id: 'clip-b', start: 8, duration: 5});
    const {handlers} = setup(makeDrag({previewStart: 6}), [clipA, clipB]);
    handlers.onPointerUp();
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({kind: 'warning'}));
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('move 被保护范围阻断时警告并返回', () => {
    const clip = makeClip({id: 'clip-a', start: 5, duration: 5});
    const params = makeParams({project: makeProject({tracks: [makeTrack({clips: [clip]})]})});
    Object.assign(params, {drag: makeDrag({previewStart: 6})});
    const warnProtectedRangeBlocked = vi.fn();
    const handlers = createDragHandlers(
      params,
      makeHelpers([clip], {canApplyProtectedMove: () => false, warnProtectedRangeBlocked}),
    );
    handlers.onPointerUp();
    expect(warnProtectedRangeBlocked).toHaveBeenCalled();
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('rolling-trim 结束执行 RollingTrimCommand', () => {
    const rightClip = makeClip({id: 'clip-b', start: 10, duration: 5});
    const {handlers} = setup(
      makeDrag({mode: 'rolling-trim', previewRollingDelta: 0.5, rightClip}),
      [makeClip({id: 'clip-a', start: 5, duration: 5}), rightClip],
    );
    handlers.onPointerUp();
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(RollingTrimCommand);
  });

  it('rolling-trim 零增量不执行命令', () => {
    const rightClip = makeClip({id: 'clip-b', start: 10, duration: 5});
    const {handlers} = setup(makeDrag({mode: 'rolling-trim', previewRollingDelta: 0, rightClip}));
    handlers.onPointerUp();
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('slip 结束 trim 变化时执行 SlipClipCommand', () => {
    const {handlers} = setup(makeDrag({mode: 'slip', previewTrimStart: 1, previewTrimEnd: 0, previewSlipDelta: 1}));
    handlers.onPointerUp();
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(SlipClipCommand);
  });

  it('slip 结束 trim 未变化时不执行命令', () => {
    const {handlers} = setup(makeDrag({mode: 'slip', previewTrimStart: 0, previewTrimEnd: 0}));
    handlers.onPointerUp();
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('slide 结束非零增量执行 SlideClipCommand', () => {
    const {handlers} = setup(makeDrag({mode: 'slide', previewSlideDelta: 1}));
    handlers.onPointerUp();
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(SlideClipCommand);
  });

  it('slide 结束零增量不执行命令', () => {
    const {handlers} = setup(makeDrag({mode: 'slide', previewSlideDelta: 0}));
    handlers.onPointerUp();
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('trim 结束执行 TrimClipCommand', () => {
    const {handlers} = setup(makeDrag({mode: 'trim-right', previewTrimStart: 0, previewTrimEnd: 1}));
    handlers.onPointerUp();
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(TrimClipCommand);
  });

  it('keyframe 单选结束执行 UpdateKeyframeCommand', () => {
    const {handlers} = setup(
      makeDrag({
        mode: 'keyframe',
        keyframeProperty: 'volume',
        keyframeId: 'kf-1',
        previewKeyframeDelta: 1,
        previewKeyframeTime: 2,
        previewStart: 1,
      }),
    );
    handlers.onPointerUp();
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(UpdateKeyframeCommand);
  });

  it('keyframe 多选结束执行 BatchKeyframeEditCommand', () => {
    const {handlers} = setup(
      makeDrag({
        mode: 'keyframe',
        keyframeProperty: 'volume',
        keyframeId: 'kf-1',
        keyframes: [
          {clipId: 'clip-a', property: 'volume', keyframeId: 'kf-1'},
          {clipId: 'clip-a', property: 'volume', keyframeId: 'kf-2'},
        ],
        previewKeyframeDelta: 1,
        previewKeyframeTime: 2,
        previewStart: 1,
      }),
    );
    handlers.onPointerUp();
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(BatchKeyframeEditCommand);
  });

  it('keyframe 零增量不执行命令', () => {
    const {handlers} = setup(
      makeDrag({mode: 'keyframe', keyframeProperty: 'volume', keyframeId: 'kf-1', previewKeyframeDelta: 0, previewStart: 1}),
    );
    handlers.onPointerUp();
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('命令执行抛错时 toast 警告', () => {
    executeMock.mockImplementation(() => {
      throw new Error('timeline rejected');
    });
    const {handlers} = setup(makeDrag({mode: 'trim-right', previewTrimStart: 0, previewTrimEnd: 1}));
    handlers.onPointerUp();
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({kind: 'warning'}));
  });
});

describe('createDragHandlers — onDragStart', () => {
  it('keyframe 仅选择模式直接记录 drag', () => {
    const {params, handlers} = setup();
    handlers.onDragStart(makeDrag({mode: 'keyframe', keyframeSelectionOnly: true}));
    expect(params.setDrag).toHaveBeenCalledWith(expect.objectContaining({keyframeSelectionOnly: true}));
  });

  it('keyframe 模式构建关键帧组', () => {
    const {params, handlers} = setup();
    handlers.onDragStart(makeDrag({mode: 'keyframe', keyframeProperty: 'volume', keyframeId: 'kf-1'}));
    expect(params.setDrag).toHaveBeenCalledWith(
      expect.objectContaining({
        keyframes: [{clipId: 'clip-a', property: 'volume', keyframeId: 'kf-1'}],
        keyframeStartTimes: {},
      }),
    );
  });

  it('非 move 模式直接记录 drag', () => {
    const {params, handlers} = setup();
    handlers.onDragStart(makeDrag({mode: 'trim-right'}));
    expect(params.setDrag).toHaveBeenCalledWith(expect.objectContaining({mode: 'trim-right'}));
  });

  it('move 单选记录起始位置映射', () => {
    const {params, handlers} = setup();
    handlers.onDragStart(makeDrag({mode: 'move'}));
    expect(params.setDrag).toHaveBeenCalledWith(
      expect.objectContaining({
        clipIds: ['clip-a'],
        startByClipId: {'clip-a': 5},
        previewStartsByClipId: {'clip-a': 5},
      }),
    );
  });

  it('move 多选记录全部 clip 起始位置', () => {
    const clipA = makeClip({id: 'clip-a', start: 5, duration: 5});
    const clipB = makeClip({id: 'clip-b', start: 20, duration: 5});
    const {params, handlers} = setup(undefined, [clipA, clipB]);
    handlers.onDragStart(makeDrag({mode: 'move', clip: clipA, clipIds: ['clip-a', 'clip-b']}));
    expect(params.setDrag).toHaveBeenCalledWith(
      expect.objectContaining({
        clipIds: ['clip-a', 'clip-b'],
        startByClipId: {'clip-a': 5, 'clip-b': 20},
      }),
    );
  });
});

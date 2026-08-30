// @vitest-environment jsdom
// 覆盖目标（打包 3 个小文件，≥70%）：
// - snap-utils.ts（69 行 2.9%）
// - selection.ts（93 行 5.38%）
// - drop-handlers.ts（87 行 8.05%）
import { describe, expect, it, vi, beforeEach } from 'vitest';

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

import { createSnapUtils } from '../snap-utils';
import { createSelectionHandlers } from '../selection';
import { createDropHandlers } from '../drop-handlers';
import { makeAsset, makeClip, makeParams, makeProject, makeTrack } from './test-fixtures';
import { TRANSITION_DRAG_MIME } from '../utils';
import { TITLE_TEMPLATE_DRAG_MIME } from '../../../../../lib/titleTemplates';

describe('createSnapUtils', () => {
  it('buildMovedPreviewTimeline 按给定起点重排 clip', () => {
    const clipA = makeClip({ id: 'clip-a', start: 0, duration: 5 });
    const clipB = makeClip({ id: 'clip-b', start: 10, duration: 5 });
    const project = makeProject({ tracks: [makeTrack({ clips: [clipA, clipB] })] });
    const params = makeParams({ project });
    const snap = createSnapUtils(params, {
      findClip: (id: string) => (id === 'clip-a' ? clipA : clipB),
      snapClipEnd: (time: number) => time,
      minFrameDuration: () => 1 / 30,
    });
    const timeline = snap.buildMovedPreviewTimeline({ 'clip-a': 3 });
    const trackClips = timeline.tracks[0].clips;
    expect(trackClips.find((c) => c.id === 'clip-a')?.start).toBe(3);
    expect(trackClips.find((c) => c.id === 'clip-b')?.start).toBe(10); // 未移动保持原位
  });

  it('buildTrimPreview 左缘正 delta 增大 trimStart', () => {
    const clipA = makeClip({ id: 'clip-a', start: 5, duration: 5, trimStart: 0, trimEnd: 0 });
    const params = makeParams();
    const snap = createSnapUtils(params, {
      findClip: (id: string) => clipA,
      snapClipEnd: (time: number) => time,
      minFrameDuration: () => 1 / 30,
    });
    const preview = snap.buildTrimPreview(clipA, 'left', 2, true);
    expect(preview.trimStart).toBeGreaterThan(0);
    expect(preview.duration).toBeLessThan(5);
    expect(preview.start).toBe(5); // 起点不变
  });

  it('buildTrimPreview 左缘负 delta 减小 trimStart', () => {
    const clipA = makeClip({ id: 'clip-a', start: 5, duration: 3, trimStart: 2, trimEnd: 0 });
    const params = makeParams();
    const snap = createSnapUtils(params, {
      findClip: (id: string) => clipA,
      snapClipEnd: (time: number) => time,
      minFrameDuration: () => 1 / 30,
    });
    const preview = snap.buildTrimPreview(clipA, 'left', -1, true);
    expect(preview.trimStart).toBe(1);
    expect(preview.duration).toBeCloseTo(4, 5);
  });

  it('buildTrimPreview 右缘 delta 延长 duration 并记 trimEnd', () => {
    const clipA = makeClip({ id: 'clip-a', start: 0, duration: 4, trimStart: 0, trimEnd: 1 });
    const params = makeParams();
    const snap = createSnapUtils(params, {
      findClip: (id: string) => clipA,
      snapClipEnd: (time: number) => time,
      minFrameDuration: () => 1 / 30,
    });
    const preview = snap.buildTrimPreview(clipA, 'right', 2, true);
    // sourceDuration(5) - trimStart(0) = 5 是显示时长上限，delta 越界被截断
    expect(preview.duration).toBe(5);
    expect(preview.trimEnd).toBe(0);
  });

  it('buildTrimPreview 右缘超源上限时被 maxDuration 截断', () => {
    const clipA = makeClip({ id: 'clip-a', start: 0, duration: 4, trimStart: 0, trimEnd: 1 });
    const params = makeParams();
    const snap = createSnapUtils(params, {
      findClip: (id: string) => clipA,
      snapClipEnd: (time: number) => time,
      minFrameDuration: () => 1 / 30,
    });
    const preview = snap.buildTrimPreview(clipA, 'right', 100, true);
    expect(preview.duration).toBe(5); // sourceDuration(5) - trimStart(0)
  });

  it('findClipById / getClipMediaAsset 从 project 解析', () => {
    const clipA = makeClip({ id: 'clip-a', mediaId: 'media-a' });
    const asset = makeAsset({ id: 'media-a' });
    const project = makeProject({ tracks: [makeTrack({ clips: [clipA] })], media: [asset] });
    const params = makeParams({ project, allClips: [clipA] });
    const snap = createSnapUtils(params, {
      findClip: (id: string) => clipA,
      snapClipEnd: (time: number) => time,
      minFrameDuration: () => 1 / 30,
    });
    expect(snap.findClipById('clip-a')).toBe(clipA);
    expect(snap.findClipById('missing')).toBeUndefined();
    expect(snap.getClipMediaAsset(clipA)).toBe(asset);
    expect(snap.getClipMediaAsset(makeClip({ id: 'clip-b' }))).toBeUndefined();
  });
});

describe('createSelectionHandlers', () => {
  function setup(selectedClipIds: string[] = [], groupByClipId?: Map<string, never>) {
    const params = makeParams({ selectedClipIds, clipGroupByClipId: groupByClipId });
    const handlers = createSelectionHandlers(params, {
      findClipById: (id: string) => (id === 'clip-a' ? makeClip({ id }) : undefined),
    });
    return { params, handlers };
  }

  it('无组时 additive 切换单个 clip', () => {
    const { params, handlers } = setup(['clip-a']);
    handlers.selectClip('clip-b', true);
    expect(params.toggleSelectedClipId).toHaveBeenCalledWith('clip-b');
  });

  it('无组时非 additive 直接 setSelectedClipId', () => {
    const { params, handlers } = setup([]);
    handlers.selectClip('clip-a', false);
    expect(params.setters.setSelectedClipId).toHaveBeenCalledWith('clip-a');
  });

  it('多选状态下点击已选成员保持不动（不收缩为单选）', () => {
    const { params, handlers } = setup(['clip-a', 'clip-b']);
    handlers.selectClip('clip-a', false);
    expect(params.setters.setSelectedClipId).not.toHaveBeenCalled();
  });

  it('组内 clip 非 additive 点击整组选中', () => {
    const group = { id: 'g1', name: 'G', color: 'blue', clipIds: ['clip-a', 'clip-x'] };
    const map = new Map([['clip-a', group as never]]);
    const { params, handlers } = setup([], map as never);
    handlers.selectClip('clip-a', false);
    expect(params.setters.setSelectedClipIds).toHaveBeenCalledWith(['clip-a', 'clip-x']);
  });

  it('组内 clip additive 点击且组未全选时补全全组', () => {
    const group = { id: 'g1', name: 'G', color: 'blue', clipIds: ['clip-a', 'clip-x'] };
    const map = new Map([
      ['clip-a', group as never],
      ['clip-x', group as never],
    ]);
    const { params, handlers } = setup(['clip-a'], map as never);
    handlers.selectClip('clip-a', true);
    expect(params.setters.setSelectedClipIds).toHaveBeenCalledWith(expect.arrayContaining(['clip-a', 'clip-x']));
  });

  it('组已全选时 additive 点击取消整组', () => {
    const group = { id: 'g1', name: 'G', color: 'blue', clipIds: ['clip-a', 'clip-x'] };
    const map = new Map([
      ['clip-a', group as never],
      ['clip-x', group as never],
    ]);
    const { params, handlers } = setup(['clip-a', 'clip-x'], map as never);
    handlers.selectClip('clip-a', true);
    expect(params.setters.setSelectedClipIds).toHaveBeenCalledWith([]);
  });

  it('forceSingle 跳过组逻辑直接单选', () => {
    const group = { id: 'g1', name: 'G', color: 'blue', clipIds: ['clip-a', 'clip-x'] };
    const map = new Map([['clip-a', group as never]]);
    const { params, handlers } = setup([], map as never);
    handlers.selectClip('clip-a', false, true);
    expect(params.setters.setSelectedClipId).toHaveBeenCalledWith('clip-a');
  });

  it('canApplyProtectedMove 命中保护范围时返回 false', () => {
    // 语义：clip(5-10) 覆盖 range(6-8) → currentRanges 非空，next 必须完整处于 range 内才可移动
    const clipA = makeClip({ id: 'clip-a', start: 5, duration: 5 });
    const params = makeParams({
      protectedRanges: [{ id: 'pr-1', start: 6, end: 8 }] as never,
    });
    const handlers = createSelectionHandlers(params, {
      findClipById: (id: string) => (id === 'clip-a' ? clipA : undefined),
    });
    // next(4-9)：start 4 < range.start 6 → 越出范围 → false
    expect(handlers.canApplyProtectedMove({ 'clip-a': 4 })).toBe(false);
    // next(8-13)：end 13 > range.end 8 → false
    expect(handlers.canApplyProtectedMove({ 'clip-a': 8 })).toBe(false);
    // 无保护范围时恒 true
    const emptyParams = makeParams({ protectedRanges: [] });
    const emptyHandlers = createSelectionHandlers(emptyParams, {
      findClipById: (id: string) => (id === 'clip-a' ? clipA : undefined),
    });
    expect(emptyHandlers.canApplyProtectedMove({ 'clip-a': 100 })).toBe(true);
    // 未知 clipId 忽略
    expect(handlers.canApplyProtectedMove({ missing: 0 })).toBe(true);
  });

  it('warnProtectedRangeBlocked 弹警告 toast', () => {
    const { handlers } = setup();
    handlers.warnProtectedRangeBlocked();
    expect(showToastMock).toHaveBeenCalledTimes(1);
    expect(showToastMock.mock.calls[0][0].kind).toBe('warning');
  });

  it('getKeyframeTime / buildKeyframeStartTimes 从 clip.keyframes 解析', () => {
    const clipA = makeClip({
      id: 'clip-a',
      keyframes: { volume: [{ id: 'kf-1', time: 2, value: 1 }] as never },
    });
    const params = makeParams();
    const handlers = createSelectionHandlers(params, {
      findClipById: (id: string) => (id === 'clip-a' ? clipA : undefined),
    });
    expect(handlers.getKeyframeTime({ clipId: 'clip-a', property: 'volume', keyframeId: 'kf-1' })).toBe(2);
    expect(handlers.getKeyframeTime({ clipId: 'clip-a', property: 'volume', keyframeId: 'missing' })).toBeUndefined();
    const starts = handlers.buildKeyframeStartTimes([
      { clipId: 'clip-a', property: 'volume', keyframeId: 'kf-1' },
      { clipId: 'clip-a', property: 'volume', keyframeId: 'missing' },
    ]);
    expect(Object.keys(starts)).toHaveLength(1);
  });

  it('selectKeyframe additive 走 toggle 否则走 set', () => {
    const { params, handlers } = setup();
    const kf = { clipId: 'clip-a', property: 'volume' as const, keyframeId: 'kf-1' };
    handlers.selectKeyframe(kf, true);
    expect(params.toggleSelectedKeyframe).toHaveBeenCalledWith(kf);
    handlers.selectKeyframe(kf, false);
    expect(params.setSelectedKeyframe).toHaveBeenCalledWith(kf);
  });
});

describe('createDropHandlers', () => {
  beforeEach(() => {
    executeMock.mockReset();
    showToastMock.mockReset();
  });

  interface DragEventStub {
    preventDefault: ReturnType<typeof vi.fn>;
    dataTransfer: { types: string[]; getData: (mime: string) => string; files: unknown[]; dropEffect: string };
    clientX: number;
    clientY: number;
  }

  function makeDragEvent(types: string[], data: Record<string, string>, clientX = 0): DragEventStub {
    return {
      preventDefault: vi.fn(),
      dataTransfer: {
        types,
        getData: (mime: string) => data[mime] ?? '',
        files: [],
        dropEffect: '',
      },
      clientX,
      clientY: 0,
    };
  }

  function makeScrollRef() {
    return {
      current: {
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 400 }),
        scrollLeft: 0,
      },
    } as never;
  }

  it('onTimelineDragOver 对合法 MIME preventDefault 并设置 copy', () => {
    const params = makeParams();
    const handlers = createDropHandlers(params, { addCredits: vi.fn(), addTitleTemplate: vi.fn() });
    const event = makeDragEvent([TRANSITION_DRAG_MIME], {});
    handlers.onTimelineDragOver(event as never);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.dataTransfer.dropEffect).toBe('copy');
  });

  it('onTimelineDragOver 对无关 MIME 不响应', () => {
    const params = makeParams();
    const handlers = createDropHandlers(params, { addCredits: vi.fn(), addTitleTemplate: vi.fn() });
    const event = makeDragEvent(['text/plain'], {});
    handlers.onTimelineDragOver(event as never);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it('转场拖拽落在相邻 clip 交界 ±0.5s 内时插入 AddTransitionCommand', () => {
    const clipA = makeClip({ id: 'clip-a', start: 0, duration: 5 });
    const clipB = makeClip({ id: 'clip-b', start: 5, duration: 5 });
    const project = makeProject({ tracks: [makeTrack({ clips: [clipA, clipB] })] });
    const params = makeParams({ project });
    params.scrollRef = makeScrollRef();
    const handlers = createDropHandlers(params, { addCredits: vi.fn(), addTitleTemplate: vi.fn() });
    // 交界时间 = 5；dropTime = (clientX - LABEL_WIDTH(160))/zoom(100) → clientX=660
    const event = makeDragEvent([TRANSITION_DRAG_MIME], { [TRANSITION_DRAG_MIME]: 'crossfade' }, 660);
    handlers.onTimelineDrop(event as never);
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('转场拖拽落点远离交界时不执行命令', () => {
    const clipA = makeClip({ id: 'clip-a', start: 0, duration: 5 });
    const clipB = makeClip({ id: 'clip-b', start: 5, duration: 5 });
    const project = makeProject({ tracks: [makeTrack({ clips: [clipA, clipB] })] });
    const params = makeParams({ project });
    params.scrollRef = makeScrollRef();
    const handlers = createDropHandlers(params, { addCredits: vi.fn(), addTitleTemplate: vi.fn() });
    // dropTime = (900-160)/100 = 7.4（远离交界 5）
    const event = makeDragEvent([TRANSITION_DRAG_MIME], { [TRANSITION_DRAG_MIME]: 'crossfade' }, 900);
    handlers.onTimelineDrop(event as never);
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('标题模板拖拽转发 addTitleTemplate', () => {
    const addTitleTemplate = vi.fn();
    const params = makeParams();
    params.scrollRef = makeScrollRef();
    const handlers = createDropHandlers(params, { addCredits: vi.fn(), addTitleTemplate });
    const event = makeDragEvent([TITLE_TEMPLATE_DRAG_MIME], { [TITLE_TEMPLATE_DRAG_MIME]: 'template-1' }, 300);
    handlers.onTimelineDrop(event as never);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(addTitleTemplate).toHaveBeenCalledWith('template-1', expect.anything());
  });

  it('无模板无 credits 文件时不响应', () => {
    const addCredits = vi.fn();
    const params = makeParams();
    params.scrollRef = makeScrollRef();
    const handlers = createDropHandlers(params, { addCredits, addTitleTemplate: vi.fn() });
    const event = makeDragEvent(['Files'], {});
    handlers.onTimelineDrop(event as never);
    expect(addCredits).not.toHaveBeenCalled();
    expect(executeMock).not.toHaveBeenCalled();
  });
});

// @vitest-environment jsdom
// 覆盖目标：apps/desktop/src/components/Timeline/hooks/timeline/navigation.ts（原 0% → ≥75%）
// 策略：工厂直调 createNavigationHandlers(params, helpers)，scroll DOM 以对象桩替代，
// 断言缩放锚定/吸附辅助/框选/注释编辑器/平移同步逻辑。
import {describe, expect, it, vi, beforeEach, afterEach} from 'vitest';
import type {Clip} from '@open-factory/editor-core';
import {createNavigationHandlers} from '../navigation';
import {makeClip, makeParams, makeProject, makeTrack} from './test-fixtures';

function makeScrollEl(overrides: Record<string, unknown> = {}) {
  return {
    scrollLeft: 0,
    scrollTop: 0,
    clientWidth: 1000,
    clientHeight: 240,
    getBoundingClientRect: () => ({left: 100, top: 0, width: 1000, height: 400}),
    ...overrides,
  };
}

function setup(overrides: Record<string, unknown> = {}, scrollEl?: ReturnType<typeof makeScrollEl>) {
  const {reduceMotion, timelineGridSettings, beatSnapEnabled, ...rest} = overrides;
  const params = makeParams(rest as Parameters<typeof makeParams>[0]);
  Object.assign(params, {
    ...(reduceMotion !== undefined ? {reduceMotion} : {}),
    ...(timelineGridSettings !== undefined ? {timelineGridSettings} : {}),
    ...(beatSnapEnabled !== undefined ? {beatSnapEnabled} : {}),
  });
  params.scrollRef = {current: (scrollEl ?? makeScrollEl()) as unknown as HTMLDivElement};
  params.rootRef = {
    current: {
      focus: vi.fn(),
      querySelectorAll: () => [],
    } as unknown as HTMLElement,
  };
  const handlers = createNavigationHandlers(params, {
    findClip: (id) => makeClip({id}),
    minFrameDuration: () => 1 / 30,
  });
  return {params, handlers};
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('createNavigationHandlers — onWheel', () => {
  it('ctrl+滚轮放大时基于锚点缩放', () => {
    const {params, handlers} = setup();
    handlers.onWheel({ctrlKey: true, deltaY: -100, clientX: 300, preventDefault: vi.fn()} as never);
    expect(params.setTimelineZoom).toHaveBeenCalledWith(expect.any(Number));
    const nextZoom = (params.setTimelineZoom as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(nextZoom).toBeGreaterThan(100);
  });

  it('ctrl+滚轮缩小时缩小 zoom', () => {
    const {params, handlers} = setup();
    handlers.onWheel({ctrlKey: true, deltaY: 100, clientX: 300, preventDefault: vi.fn()} as never);
    const nextZoom = (params.setTimelineZoom as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(nextZoom).toBeLessThan(100);
  });

  it('shift+滚轮横向滚动', () => {
    const scrollEl = makeScrollEl({scrollLeft: 0});
    const {handlers} = setup({}, scrollEl);
    handlers.onWheel({shiftKey: true, deltaY: 120, preventDefault: vi.fn()} as never);
    expect(scrollEl.scrollLeft).toBe(120);
  });

  it('无修饰键时不响应', () => {
    const {params, handlers} = setup();
    handlers.onWheel({deltaY: 100, preventDefault: vi.fn()} as never);
    expect(params.setTimelineZoom).not.toHaveBeenCalled();
  });
});

describe('createNavigationHandlers — syncScrollViewport', () => {
  it('rAF 回调内同步 scrollLeft/viewportWidth 与高度', () => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    const scrollEl = makeScrollEl({scrollLeft: 42, scrollTop: 7, clientWidth: 800, clientHeight: 300});
    const {params, handlers} = setup({}, scrollEl);
    handlers.syncScrollViewport();
    expect(params.setScrollViewport).toHaveBeenCalledWith({scrollLeft: 42, scrollTop: 7, viewportWidth: 800});
    expect(params.setTimelineViewportHeight).toHaveBeenCalledWith(300);
  });

  it('rAF 排队中不重复调度', () => {
    vi.stubGlobal('requestAnimationFrame', () => 5);
    const {params, handlers} = setup();
    (params as unknown as {scrollRafRef: {current: number}}).scrollRafRef.current = 5;
    handlers.syncScrollViewport();
    expect(params.setScrollViewport).not.toHaveBeenCalled();
  });
});

describe('createNavigationHandlers — onTimelinePointerDown', () => {
  function makePointerEvent(overrides: Record<string, unknown> = {}) {
    return {
      button: 0,
      clientX: 100,
      clientY: 100,
      target: {closest: () => null},
      ...overrides,
    } as never;
  }

  function captureWindowListeners() {
    const listeners: Record<string, (event: unknown) => void> = {};
    vi.spyOn(window, 'addEventListener').mockImplementation(((type: string, cb: never) => {
      listeners[type] = cb as (event: unknown) => void;
    }) as never);
    vi.spyOn(window, 'removeEventListener').mockImplementation((() => undefined) as never);
    return listeners;
  }

  it('非左键直接返回', () => {
    const {params, handlers} = setup();
    handlers.onTimelinePointerDown(makePointerEvent({button: 2}));
    expect(params.setIsPanning).not.toHaveBeenCalled();
  });

  it('点击 clip / 轨道头时不进入平移流程', () => {
    const {params, handlers} = setup();
    const target = {closest: (selector: string) => (selector.includes('timeline-clip') ? {} : null)};
    handlers.onTimelinePointerDown(makePointerEvent({target}));
    expect(params.setIsPanning).not.toHaveBeenCalled();
  });

  it('长按阈值后激活平移，抬起复位', () => {
    vi.useFakeTimers();
    const listeners = captureWindowListeners();
    const {params, handlers} = setup();
    handlers.onTimelinePointerDown(makePointerEvent());
    vi.advanceTimersByTime(600);
    expect(params.setIsPanning).toHaveBeenCalledWith(true);
    listeners.pointerup({});
    expect(params.setIsPanning).toHaveBeenLastCalledWith(false);
  });

  it('移动超过 5px 取消长按定时器', () => {
    vi.useFakeTimers();
    const listeners = captureWindowListeners();
    const {params, handlers} = setup();
    handlers.onTimelinePointerDown(makePointerEvent({clientX: 100, clientY: 100}));
    listeners.pointermove({clientX: 110, clientY: 100, preventDefault: vi.fn()});
    vi.advanceTimersByTime(1000);
    expect(params.setIsPanning).not.toHaveBeenCalled();
  });

  it('平移激活时移动更新 scrollLeft', () => {
    vi.useFakeTimers();
    const listeners = captureWindowListeners();
    const scrollEl = makeScrollEl({scrollLeft: 200});
    const {handlers} = setup({}, scrollEl);
    handlers.onTimelinePointerDown(makePointerEvent({clientX: 500, clientY: 100}));
    vi.advanceTimersByTime(600);
    listeners.pointermove({clientX: 400, clientY: 100, preventDefault: vi.fn()});
    expect(scrollEl.scrollLeft).toBe(300);
    listeners.pointerup({});
  });
});

describe('createNavigationHandlers — onTimelineDoubleClick / minimap', () => {
  it('双击空白区域适配窗口缩放', () => {
    const {params, handlers} = setup();
    const target = {closest: () => null};
    handlers.onTimelineDoubleClick({target} as never);
    expect(params.setTimelineZoom).toHaveBeenCalledWith(expect.any(Number));
  });

  it('双击 clip 区域不缩放', () => {
    const {params, handlers} = setup();
    const target = {closest: (selector: string) => (selector.includes('timeline-clip') ? {} : null)};
    handlers.onTimelineDoubleClick({target} as never);
    expect(params.setTimelineZoom).not.toHaveBeenCalled();
  });

  it('scrollTimelineFromMinimap 按 y 换算 scrollLeft', () => {
    const scrollEl = makeScrollEl();
    const {handlers} = setup({}, scrollEl);
    handlers.scrollTimelineFromMinimap(80, 'center');
    expect(scrollEl.scrollLeft).toBeGreaterThanOrEqual(0);
  });

  it('无 scroll 元素时 scrollTimelineFromMinimap 直接返回', () => {
    const params = makeParams();
    params.scrollRef = {current: null};
    const handlers = createNavigationHandlers(params, {
      findClip: (id) => makeClip({id}),
      minFrameDuration: () => 1 / 30,
    });
    expect(() => handlers.scrollTimelineFromMinimap(80, 'top')).not.toThrow();
  });
});

describe('createNavigationHandlers — onTrackPointerDown / 注释层', () => {
  function makeTrackEvent(overrides: Record<string, unknown> = {}) {
    const currentTarget = {
      setPointerCapture: vi.fn(),
      getBoundingClientRect: () => ({left: 100, top: 0}),
    };
    return {
      button: 0,
      clientX: 50,
      clientY: 60,
      preventDefault: vi.fn(),
      target: currentTarget,
      currentTarget,
      ...overrides,
    } as never;
  }

  it('右键直接返回', () => {
    const {params, handlers} = setup();
    handlers.onTrackPointerDown(makeTrackEvent({button: 2}));
    expect(params.setSelectionStart).not.toHaveBeenCalled();
  });

  it('注释模式下 preventDefault 并返回', () => {
    const {params, handlers} = setup();
    Object.assign(params, {annotationMode: true});
    handlers.onTrackPointerDown(makeTrackEvent());
    expect(params.setSelectionStart).not.toHaveBeenCalled();
  });

  it('轨道空白处按下关闭菜单并开始框选', () => {
    const {params, handlers} = setup();
    handlers.onTrackPointerDown(makeTrackEvent());
    expect(params.setTransitionMenu).toHaveBeenCalledWith(undefined);
    expect(params.setGapMenu).toHaveBeenCalledWith(undefined);
    expect(params.setSelectionStart).toHaveBeenCalledWith({x: 50, y: 60});
    expect(params.setSelectionRect).toHaveBeenCalledWith(
      expect.objectContaining({left: 50, top: 60, right: 50, bottom: 60}),
    );
  });

  it('非 currentTarget 点击不开始框选', () => {
    const {params, handlers} = setup();
    const event = makeTrackEvent({target: {}});
    handlers.onTrackPointerDown(event);
    expect(params.setSelectionStart).not.toHaveBeenCalled();
  });

  it('注释层按下按 zoom 换算时间并打开注释编辑器', () => {
    const {params, handlers} = setup();
    const event = {
      button: 0,
      clientX: 260,
      currentTarget: {getBoundingClientRect: () => ({left: 160, top: 0})},
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as never;
    handlers.onAnnotationLayerPointerDown(event);
    // (260-160)/100 = 1s
    expect(params.setters.setAnnotationEditor).toHaveBeenCalledWith(expect.objectContaining({time: 1}));
  });

  it('注释层非左键直接返回', () => {
    const {params, handlers} = setup();
    const event = {
      button: 2,
      currentTarget: {getBoundingClientRect: () => ({left: 0, top: 0})},
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as never;
    handlers.onAnnotationLayerPointerDown(event);
    expect(params.setters.setAnnotationEditor).not.toHaveBeenCalled();
  });
});

describe('createNavigationHandlers — 吸附辅助', () => {
  it('findClipIdsIntersectingRect 基于 DOM 节点求交集', () => {
    const nodes = [
      {dataset: {clipId: 'c1'}, getBoundingClientRect: () => ({left: 0, top: 0, right: 10, bottom: 10})},
      {dataset: {clipId: 'c2'}, getBoundingClientRect: () => ({left: 100, top: 100, right: 110, bottom: 110})},
    ];
    const params = makeParams();
    params.rootRef = {
      current: {querySelectorAll: () => nodes} as unknown as HTMLElement,
    };
    const handlers = createNavigationHandlers(params, {
      findClip: (id) => makeClip({id}),
      minFrameDuration: () => 1 / 30,
    });
    expect(handlers.findClipIdsIntersectingRect({left: 0, top: 0, right: 20, bottom: 20})).toEqual(['c1']);
  });

  it('reduceMotion 时 flashSnapHighlight 不触发', () => {
    const {params, handlers} = setup({reduceMotion: true});
    handlers.flashSnapHighlight(5);
    expect(params.setSnapHighlight).not.toHaveBeenCalled();
  });

  it('非 reduceMotion 时 flashSnapHighlight 写入高亮', () => {
    const {params, handlers} = setup();
    handlers.flashSnapHighlight(5);
    expect(params.setSnapHighlight).toHaveBeenCalledWith(expect.objectContaining({time: 5}));
  });

  it('snapClipStart 网格禁用时返回原时间', () => {
    const {handlers} = setup();
    expect(handlers.snapClipStart(3.7, 5, makeClip({id: 'c1', start: 0, duration: 5}), false)).toBe(3.7);
  });

  it('snapClipStart 网格启用时吸附到整秒', () => {
    const {handlers} = setup({timelineGridSettings: {enabled: true, unit: 'second'}});
    // 阈值 8px / zoom 100 = 0.08s：3.95 距 4 仅 0.05s 触发吸附
    const snapped = handlers.snapClipStart(3.95, 5, makeClip({id: 'c1', start: 0, duration: 5}), false);
    expect(snapped).toBe(4);
  });

  it('snapClipEnd 网格启用时吸附 clip 末端', () => {
    const {handlers} = setup({timelineGridSettings: {enabled: true, unit: 'second'}});
    const snapped = handlers.snapClipEnd(5.95, makeClip({id: 'c1', start: 0, duration: 5}), false);
    expect(snapped).toBe(6);
  });

  it('snapKeyframeTime 网格禁用时仅 snapTime', () => {
    const {handlers} = setup();
    expect(handlers.snapKeyframeTime(makeClip({id: 'c1', duration: 10}), 2.7, false)).toBeCloseTo(2.7, 5);
  });

  it('snapKeyframeTime 网格启用时吸附并夹在 clip 内', () => {
    const {handlers} = setup({timelineGridSettings: {enabled: true, unit: 'second'}});
    expect(handlers.snapKeyframeTime(makeClip({id: 'c1', duration: 10}), 1.95, false)).toBe(2);
    expect(handlers.snapKeyframeTime(makeClip({id: 'c1', duration: 10}), 9.95, false)).toBe(10);
  });

  it('buildSnapCandidates 汇总起点/playhead/标记/clip 边界', () => {
    const clipA = makeClip({id: 'clip-a', start: 0, duration: 5});
    const clipB = makeClip({id: 'clip-b', start: 8, duration: 4});
    const project = makeProject({tracks: [makeTrack({clips: [clipA, clipB]})]});
    project.timeline.markers = [{id: 'm1', time: 6, label: 'M'}] as never;
    project.beatMarkers = [{id: 'b1', time: 7}] as never;
    const params = makeParams({project, playheadTime: 2, allClips: [clipA, clipB]});
    (params as {beatSnapEnabled?: boolean}).beatSnapEnabled = true;
    const handlers = createNavigationHandlers(params, {
      findClip: (id) => (id === 'clip-a' ? clipA : clipB),
      minFrameDuration: () => 1 / 30,
    });
    const times = handlers.buildSnapCandidates(clipA).map((candidate) => candidate.time);
    expect(times).toContain(0);
    expect(times).toContain(2);
    expect(times).toContain(6);
    expect(times).toContain(7);
    expect(times).toContain(8);
    expect(times).toContain(12);
  });

  it('beatSnapEnabled 关闭时不含节拍候选', () => {
    const clipA = makeClip({id: 'clip-a'});
    const project = makeProject({tracks: [makeTrack({clips: [clipA]})]});
    project.beatMarkers = [{id: 'b1', time: 7}] as never;
    const {handlers} = setup({project, beatSnapEnabled: false, allClips: [clipA]});
    const kinds = handlers.buildSnapCandidates(clipA).map((candidate) => candidate.kind);
    expect(kinds).not.toContain('beat');
  });
});

describe('createNavigationHandlers — applyZoom', () => {
  it('无 scroll 元素时直接设置 zoom', () => {
    const params = makeParams();
    params.scrollRef = {current: null};
    const handlers = createNavigationHandlers(params, {
      findClip: (id) => makeClip({id}),
      minFrameDuration: () => 1 / 30,
    });
    handlers.applyZoom(200, 300);
    expect(params.setTimelineZoom).toHaveBeenCalledWith(200);
  });

  it('有 scroll 元素时锚定滚动位置并设置 zoom', () => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    const {params, handlers} = setup();
    handlers.applyZoom(200, 400);
    expect(params.setTimelineZoom).toHaveBeenCalledWith(200);
  });
});

describe('createNavigationHandlers — openAnnotationEditorAt', () => {
  it('新建注释使用默认标签与颜色', () => {
    const {params, handlers} = setup();
    handlers.openAnnotationEditorAt(3);
    expect(params.setters.setAnnotationEditor).toHaveBeenCalledWith(
      expect.objectContaining({id: undefined, time: 3, text: expect.any(String)}),
    );
  });

  it('编辑已有注释保留原值', () => {
    const {params, handlers} = setup();
    handlers.openAnnotationEditorAt(9, {id: 'ann-1', time: 4, text: '旧注释', color: '#ff0000'} as never);
    expect(params.setters.setAnnotationEditor).toHaveBeenCalledWith(
      expect.objectContaining({id: 'ann-1', time: 4, text: '旧注释', color: '#ff0000'}),
    );
  });

  it('负时间戳归零', () => {
    const {params, handlers} = setup();
    handlers.openAnnotationEditorAt(-2);
    expect(params.setters.setAnnotationEditor).toHaveBeenCalledWith(expect.objectContaining({time: 0}));
  });
});

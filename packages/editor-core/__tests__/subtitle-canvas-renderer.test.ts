import { describe, it, expect, vi } from 'vitest';
import type { SubtitleClip, SubtitleStyle } from '../src/model';
import { DEFAULT_SUBTITLE_STYLE } from '../src/model/defaults';
import {
  resolveSubtitleStyle,
  buildFontString,
  calculateSubtitleY,
  findActiveClips,
  measureSubtitleText,
  renderSubtitleCue,
  renderSubtitleClip,
  renderSubtitleBatch,
  clearSubtitleArea,
  prerenderSubtitleToCanvas,
  createBatchContext,
  renderSubtitleWithBatchContext,
  type SubtitleRenderConfig,
} from '../src/subtitles/canvas-renderer';
import { makeSubtitleClip } from './test-utils';

// ---------------------------------------------------------------------------
// Mock Canvas API
// ---------------------------------------------------------------------------

function createMockCtx(): CanvasRenderingContext2D {
  const ctx = {
    font: '',
    textAlign: 'left' as CanvasTextAlign,
    textBaseline: 'alphabetic' as TextBaseline,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    lineJoin: 'miter' as CanvasLineJoin,
    globalAlpha: 1,
    shadowColor: 'transparent',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    save: vi.fn(),
    restore: vi.fn(),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    measureText: vi.fn((text: string) => ({
      width: text.length * 10,
      actualBoundingBoxAscent: 12,
      actualBoundingBoxDescent: 4,
    })),
  };
  return ctx as unknown as CanvasRenderingContext2D;
}

// ---------------------------------------------------------------------------
// Tests: Style Resolution
// ---------------------------------------------------------------------------

describe('resolveSubtitleStyle', () => {
  it('应该返回默认样式当输入为 undefined', () => {
    const style = resolveSubtitleStyle(undefined);
    expect(style.fontSize).toBe(DEFAULT_SUBTITLE_STYLE.fontSize);
    expect(style.color).toBe(DEFAULT_SUBTITLE_STYLE.color);
    expect(style.backgroundColor).toBe(DEFAULT_SUBTITLE_STYLE.backgroundColor);
  });

  it('应该合并部分样式与默认值', () => {
    const style = resolveSubtitleStyle({ color: '#ff0000', fontSize: 48 });
    expect(style.color).toBe('#ff0000');
    expect(style.fontSize).toBe(48);
    expect(style.backgroundColor).toBe(DEFAULT_SUBTITLE_STYLE.backgroundColor);
  });

  it('应该限制 fontSize 在合法范围内', () => {
    expect(resolveSubtitleStyle({ fontSize: 5 }).fontSize).toBe(8);
    expect(resolveSubtitleStyle({ fontSize: 300 }).fontSize).toBe(200);
    expect(resolveSubtitleStyle({ fontSize: 42 }).fontSize).toBe(42);
  });

  it('应该限制 backgroundOpacity 在 0-1 范围', () => {
    expect(resolveSubtitleStyle({ backgroundOpacity: -0.5 }).backgroundOpacity).toBe(0);
    expect(resolveSubtitleStyle({ backgroundOpacity: 1.5 }).backgroundOpacity).toBe(1);
  });

  it('应该限制 outlineWidth 在合法范围', () => {
    expect(resolveSubtitleStyle({ outlineWidth: -1 }).outlineWidth).toBe(0);
    expect(resolveSubtitleStyle({ outlineWidth: 20 }).outlineWidth).toBe(12);
  });

  it('应该限制 yOffset 在合法范围', () => {
    expect(resolveSubtitleStyle({ yOffset: -10 }).yOffset).toBe(0);
    expect(resolveSubtitleStyle({ yOffset: 5000 }).yOffset).toBe(1000);
    expect(resolveSubtitleStyle({ yOffset: 100 }).yOffset).toBe(100);
  });

  it('应该限制 shadowOffset 在合法范围', () => {
    expect(resolveSubtitleStyle({ shadowOffset: -5 }).shadowOffset).toBe(0);
    expect(resolveSubtitleStyle({ shadowOffset: 50 }).shadowOffset).toBe(24);
    expect(resolveSubtitleStyle({ shadowOffset: 4 }).shadowOffset).toBe(4);
  });

  it('应该限制 fontSize 上下边界精确值', () => {
    expect(resolveSubtitleStyle({ fontSize: 8 }).fontSize).toBe(8);
    expect(resolveSubtitleStyle({ fontSize: 200 }).fontSize).toBe(200);
  });

  it('应该限制 outlineWidth 上下边界精确值', () => {
    expect(resolveSubtitleStyle({ outlineWidth: 0 }).outlineWidth).toBe(0);
    expect(resolveSubtitleStyle({ outlineWidth: 12 }).outlineWidth).toBe(12);
  });
});

// ---------------------------------------------------------------------------
// Tests: Font String
// ---------------------------------------------------------------------------

describe('buildFontString', () => {
  it('应该构建基本字体字符串', () => {
    const style = resolveSubtitleStyle({});
    const font = buildFontString(style);
    expect(font).toContain('400'); // normal weight
    expect(font).toContain('px');
    expect(font).not.toContain('italic');
  });

  it('应该包含粗体标记', () => {
    const style = resolveSubtitleStyle({ bold: true });
    const font = buildFontString(style);
    expect(font).toContain('700');
  });

  it('应该包含斜体标记', () => {
    const style = resolveSubtitleStyle({ italic: true });
    const font = buildFontString(style);
    expect(font).toContain('italic');
  });

  it('应该支持缩放', () => {
    const style = resolveSubtitleStyle({ fontSize: 40 });
    const font = buildFontString(style, 2);
    expect(font).toContain('80px');
  });

  it('应该处理小于1的缩放系数', () => {
    const style = resolveSubtitleStyle({ fontSize: 40 });
    const font = buildFontString(style, 0.1);
    // Math.max(1, Math.round(40 * 0.1)) = Math.max(1, 4) = 4
    expect(font).toContain('4px');
  });

  it('应该确保最小字号为1px', () => {
    const style = resolveSubtitleStyle({ fontSize: 8 });
    const font = buildFontString(style, 0.01);
    // Math.max(1, Math.round(8 * 0.01)) = Math.max(1, 0) = 1
    expect(font).toContain('1px');
  });

  it('应该同时包含粗体和斜体', () => {
    const style = resolveSubtitleStyle({ bold: true, italic: true });
    const font = buildFontString(style);
    expect(font).toContain('italic');
    expect(font).toContain('700');
  });

  it('应该包含自定义字体族', () => {
    const style = resolveSubtitleStyle({ fontFamily: 'Arial' });
    const font = buildFontString(style);
    expect(font).toContain('Arial');
  });
});

// ---------------------------------------------------------------------------
// Tests: Y Position
// ---------------------------------------------------------------------------

describe('calculateSubtitleY', () => {
  it('应该计算底部字幕位置', () => {
    const style = resolveSubtitleStyle({ fontSize: 40, yOffset: 80 });
    const y = calculateSubtitleY(720, style);
    // 720 - 80 - 40/2 = 620
    expect(y).toBe(620);
  });

  it('应该支持缩放', () => {
    const style = resolveSubtitleStyle({ fontSize: 40, yOffset: 80 });
    const y = calculateSubtitleY(720, style, 0.5);
    // 720 - 80*0.5 - 40*0.5/2 = 720 - 40 - 10 = 670
    expect(y).toBe(670);
  });

  it('应该使用默认缩放系数 1', () => {
    const style = resolveSubtitleStyle({ fontSize: 48, yOffset: 60 });
    const y = calculateSubtitleY(1080, style);
    // 1080 - 60 - 48/2 = 1080 - 60 - 24 = 996
    expect(y).toBe(996);
  });

  it('应该处理零偏移量', () => {
    const style = resolveSubtitleStyle({ fontSize: 32, yOffset: 0 });
    const y = calculateSubtitleY(720, style);
    // 720 - 0 - 32/2 = 704
    expect(y).toBe(704);
  });

  it('应该处理大缩放系数', () => {
    const style = resolveSubtitleStyle({ fontSize: 24, yOffset: 40 });
    const y = calculateSubtitleY(2160, style, 4);
    // 2160 - 40*4 - 24*4/2 = 2160 - 160 - 48 = 1952
    expect(y).toBe(1952);
  });
});

// ---------------------------------------------------------------------------
// Tests: Find Active Clips
// ---------------------------------------------------------------------------

describe('findActiveClips', () => {
  const clips: SubtitleClip[] = [
    makeSubtitleClip({ id: 'c1', text: 'Hello', start: 0, duration: 2 }),
    makeSubtitleClip({ id: 'c2', text: 'World', start: 3, duration: 2 }),
    makeSubtitleClip({ id: 'c3', text: 'Test', start: 5, duration: 2 }),
    makeSubtitleClip({ id: 'c4', text: '', start: 0, duration: 10 }),
  ];

  it('应该找到当前时间的活跃字幕', () => {
    const active = findActiveClips(clips, 1);
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe('c1');
  });

  it('应该在时间边界处找到字幕', () => {
    const active = findActiveClips(clips, 0);
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe('c1');
  });

  it('应该在结束时间点找到字幕', () => {
    const active = findActiveClips(clips, 2);
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe('c1');
  });

  it('应该忽略空文本的字幕', () => {
    const active = findActiveClips(clips, 0.5);
    // c1 和 c4 都在 0.5s 处活跃，但 c4 文本为空
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe('c1');
  });

  it('应该限制返回数量', () => {
    const active = findActiveClips(clips, 0.5, 0);
    expect(active).toHaveLength(0);
  });

  it('应该在没有活跃字幕时返回空数组', () => {
    const active = findActiveClips(clips, 10);
    expect(active).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: Render Subtitle Cue
// ---------------------------------------------------------------------------

describe('renderSubtitleCue', () => {
  it('应该调用 fillText 渲染文本', () => {
    const ctx = createMockCtx();
    const style = resolveSubtitleStyle({ color: '#ffffff' });
    renderSubtitleCue(ctx, 'Hello World', style, 1280, 720);
    expect(ctx.fillText).toHaveBeenCalledWith('Hello World', 640, expect.any(Number));
  });

  it('应该跳过空文本', () => {
    const ctx = createMockCtx();
    const style = resolveSubtitleStyle({});
    renderSubtitleCue(ctx, '', style, 1280, 720);
    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it('应该跳过只有空格的文本', () => {
    const ctx = createMockCtx();
    const style = resolveSubtitleStyle({});
    renderSubtitleCue(ctx, '   ', style, 1280, 720);
    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it('应该绘制描边', () => {
    const ctx = createMockCtx();
    const style = resolveSubtitleStyle({ outlineWidth: 2, outlineColor: '#000000' });
    renderSubtitleCue(ctx, 'Test', style, 1280, 720);
    expect(ctx.strokeText).toHaveBeenCalled();
  });

  it('应该在禁用描边时不绘制', () => {
    const ctx = createMockCtx();
    const style = resolveSubtitleStyle({ outlineWidth: 2 });
    renderSubtitleCue(ctx, 'Test', style, 1280, 720, { enableOutline: false });
    expect(ctx.strokeText).not.toHaveBeenCalled();
  });

  it('应该绘制背景', () => {
    const ctx = createMockCtx();
    const style = resolveSubtitleStyle({ backgroundOpacity: 0.5 });
    renderSubtitleCue(ctx, 'Test', style, 1280, 720);
    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it('应该在背景透明时不绘制', () => {
    const ctx = createMockCtx();
    const style = resolveSubtitleStyle({ backgroundOpacity: 0 });
    renderSubtitleCue(ctx, 'Test', style, 1280, 720, { enableBackground: false });
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });

  it('应该绘制阴影', () => {
    const ctx = createMockCtx();
    // 使用 save/restore 来捕获阴影设置
    const shadowValues: Array<{ x: number; y: number }> = [];
    const originalFillText = ctx.fillText;
    (ctx as any).fillText = vi.fn((...args: any[]) => {
      shadowValues.push({ x: ctx.shadowOffsetX, y: ctx.shadowOffsetY });
    });
    const style = resolveSubtitleStyle({ shadowOffset: 3 });
    renderSubtitleCue(ctx, 'Test', style, 1280, 720);
    // 阴影绘制时应该设置 shadowOffset，绘制后可能被重置
    expect(shadowValues.length).toBeGreaterThan(0);
    expect(shadowValues[0].x).toBe(3);
  });

  it('应该在禁用阴影时不设置阴影属性', () => {
    const ctx = createMockCtx();
    renderSubtitleCue(ctx, 'Test', resolveSubtitleStyle({ shadowOffset: 5 }), 1280, 720, { enableShadow: false });
    // 阴影被禁用时，shadowOffsetX 应保持默认值 0
    expect(ctx.shadowOffsetX).toBe(0);
    expect(ctx.shadowBlur).toBe(0);
  });

  it('应该在 shadowOffset 为 0 时不绘制阴影', () => {
    const ctx = createMockCtx();
    const style = resolveSubtitleStyle({ shadowOffset: 0 });
    renderSubtitleCue(ctx, 'Test', style, 1280, 720);
    // shadowOffset 为 0 时不应触发阴影分支
    expect(ctx.shadowColor).toBe('transparent');
  });

  it('应该在 outlineWidth 为 0 时不绘制描边', () => {
    const ctx = createMockCtx();
    const style = resolveSubtitleStyle({ outlineWidth: 0 });
    renderSubtitleCue(ctx, 'Test', style, 1280, 720);
    expect(ctx.strokeText).not.toHaveBeenCalled();
  });

  it('应该正确设置文本对齐方式', () => {
    const ctx = createMockCtx();
    const style = resolveSubtitleStyle({});
    renderSubtitleCue(ctx, 'Test', style, 1280, 720);
    expect(ctx.textAlign).toBe('center');
    expect(ctx.textBaseline).toBe('middle');
  });

  it('应该调用 save 和 restore', () => {
    const ctx = createMockCtx();
    const style = resolveSubtitleStyle({});
    renderSubtitleCue(ctx, 'Test', style, 1280, 720);
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });

  it('应该在所有 config 选项未定义时使用默认值', () => {
    const ctx = createMockCtx();
    const style = resolveSubtitleStyle({ outlineWidth: 2, shadowOffset: 3, backgroundOpacity: 0.5 });
    renderSubtitleCue(ctx, 'Test', style, 1280, 720);
    // 默认启用所有效果
    expect(ctx.strokeText).toHaveBeenCalled();
    expect(ctx.fillRect).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests: Render Subtitle Clip
// ---------------------------------------------------------------------------

describe('renderSubtitleClip', () => {
  it('应该在时间范围内渲染', () => {
    const ctx = createMockCtx();
    const clip = makeSubtitleClip({ text: 'Hello', start: 1, duration: 2 });
    const rendered = renderSubtitleClip(ctx, clip, 2, 1280, 720);
    expect(rendered).toBe(true);
    expect(ctx.fillText).toHaveBeenCalled();
  });

  it('应该在时间范围外跳过', () => {
    const ctx = createMockCtx();
    const clip = makeSubtitleClip({ text: 'Hello', start: 1, duration: 2 });
    const rendered = renderSubtitleClip(ctx, clip, 5, 1280, 720);
    expect(rendered).toBe(false);
    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it('应该跳过空文本的片段', () => {
    const ctx = createMockCtx();
    const clip = makeSubtitleClip({ text: '', start: 0, duration: 2 });
    const rendered = renderSubtitleClip(ctx, clip, 1, 1280, 720);
    expect(rendered).toBe(false);
  });

  it('应该在精确开始时间渲染', () => {
    const ctx = createMockCtx();
    const clip = makeSubtitleClip({ text: 'Hello', start: 1, duration: 2 });
    const rendered = renderSubtitleClip(ctx, clip, 1, 1280, 720);
    expect(rendered).toBe(true);
  });

  it('应该在精确结束时间渲染', () => {
    const ctx = createMockCtx();
    const clip = makeSubtitleClip({ text: 'Hello', start: 1, duration: 2 });
    const rendered = renderSubtitleClip(ctx, clip, 3, 1280, 720);
    expect(rendered).toBe(true);
  });

  it('应该跳过只有空格的文本', () => {
    const ctx = createMockCtx();
    const clip = makeSubtitleClip({ text: '   ', start: 0, duration: 2 });
    const rendered = renderSubtitleClip(ctx, clip, 1, 1280, 720);
    expect(rendered).toBe(false);
  });

  it('应该传递 config 给 renderSubtitleCue', () => {
    const ctx = createMockCtx();
    const clip = makeSubtitleClip({ text: 'Hello', start: 0, duration: 2, style: { outlineWidth: 2 } });
    renderSubtitleClip(ctx, clip, 1, 1280, 720, { enableOutline: false });
    expect(ctx.strokeText).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests: Render Subtitle Batch
// ---------------------------------------------------------------------------

describe('renderSubtitleBatch', () => {
  it('应该渲染所有活跃字幕', () => {
    const ctx = createMockCtx();
    const clips: SubtitleClip[] = [
      makeSubtitleClip({ text: 'A', start: 0, duration: 2 }),
      makeSubtitleClip({ text: 'B', start: 0, duration: 3 }),
    ];
    const stats = renderSubtitleBatch(ctx, clips, 1, 1280, 720);
    expect(stats.renderedCues).toBe(2);
    expect(stats.renderTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('应该限制最大渲染数量', () => {
    const ctx = createMockCtx();
    const clips: SubtitleClip[] = Array.from({ length: 20 }, (_, i) =>
      makeSubtitleClip({ text: `Sub ${i}`, start: 0, duration: 10 }),
    );
    const stats = renderSubtitleBatch(ctx, clips, 5, 1280, 720, { maxCues: 3 });
    expect(stats.renderedCues).toBe(3);
  });

  it('应该返回渲染统计', () => {
    const ctx = createMockCtx();
    const clips: SubtitleClip[] = [
      makeSubtitleClip({ text: 'Test', start: 0, duration: 1 }),
    ];
    const stats = renderSubtitleBatch(ctx, clips, 0.5, 1280, 720);
    expect(stats).toHaveProperty('renderedCues');
    expect(stats).toHaveProperty('renderTimeMs');
    expect(stats).toHaveProperty('isPerformant');
  });

  it('应该处理空字幕数组', () => {
    const ctx = createMockCtx();
    const stats = renderSubtitleBatch(ctx, [], 0, 1280, 720);
    expect(stats.renderedCues).toBe(0);
    expect(stats.renderTimeMs).toBeGreaterThanOrEqual(0);
    expect(stats.isPerformant).toBe(true);
  });

  it('应该在没有活跃字幕时返回零渲染数', () => {
    const ctx = createMockCtx();
    const clips: SubtitleClip[] = [
      makeSubtitleClip({ text: 'A', start: 0, duration: 1 }),
      makeSubtitleClip({ text: 'B', start: 5, duration: 1 }),
    ];
    const stats = renderSubtitleBatch(ctx, clips, 3, 1280, 720);
    expect(stats.renderedCues).toBe(0);
  });

  it('应该使用默认 maxCues 限制', () => {
    const ctx = createMockCtx();
    const clips: SubtitleClip[] = Array.from({ length: 20 }, (_, i) =>
      makeSubtitleClip({ text: `Sub ${i}`, start: 0, duration: 10 }),
    );
    // 默认 maxCues = 10
    const stats = renderSubtitleBatch(ctx, clips, 5, 1280, 720);
    expect(stats.renderedCues).toBeLessThanOrEqual(10);
  });

  it('应该标记渲染时间为性能达标', () => {
    const ctx = createMockCtx();
    const clips: SubtitleClip[] = [
      makeSubtitleClip({ text: 'Test', start: 0, duration: 1 }),
    ];
    const stats = renderSubtitleBatch(ctx, clips, 0.5, 1280, 720);
    // mock 渲染应该非常快，应该达标
    expect(stats.isPerformant).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: Clear Subtitle Area
// ---------------------------------------------------------------------------

describe('clearSubtitleArea', () => {
  it('应该清除 Canvas 底部区域', () => {
    const ctx = createMockCtx();
    clearSubtitleArea(ctx, 1280, 720);
    expect(ctx.clearRect).toHaveBeenCalled();
  });

  it('应该使用默认参数计算清除区域', () => {
    const ctx = createMockCtx();
    clearSubtitleArea(ctx, 1280, 720);
    // 默认 maxFontSize=120, maxYOffset=200
    // clearHeight = 120 * 3 + 200 = 560
    // clearTop = max(0, 720 - 560) = 160
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 160, 1280, 720 - 160);
  });

  it('应该支持自定义 maxFontSize 和 maxYOffset', () => {
    const ctx = createMockCtx();
    clearSubtitleArea(ctx, 1920, 1080, 60, 100);
    // clearHeight = 60 * 3 + 100 = 280
    // clearTop = max(0, 1080 - 280) = 800
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 800, 1920, 1080 - 800);
  });

  it('应该在清除区域超过 Canvas 高度时从顶部开始', () => {
    const ctx = createMockCtx();
    clearSubtitleArea(ctx, 1280, 100, 120, 200);
    // clearHeight = 120 * 3 + 200 = 560
    // clearTop = max(0, 100 - 560) = 0
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 1280, 100);
  });
});

// ---------------------------------------------------------------------------
// Tests: Prerender
// ---------------------------------------------------------------------------

describe('prerenderSubtitleToCanvas', () => {
  it('应该返回 Canvas 元素', () => {
    // mock document.createElement for Node environment
    const mockCanvas = { width: 0, height: 0, getContext: vi.fn(() => createMockCtx()) };
    const origDocument = (globalThis as any).document;
    (globalThis as any).document = { createElement: vi.fn(() => mockCanvas) };
    try {
      const clip = makeSubtitleClip({ text: 'Preview', start: 0, duration: 2 });
      const canvas = prerenderSubtitleToCanvas(clip, 320, 180);
      expect(canvas).toBeDefined();
      expect(canvas).toHaveProperty('width');
      expect(canvas).toHaveProperty('height');
    } finally {
      (globalThis as any).document = origDocument;
    }
  });

  it('应该处理空文本的字幕', () => {
    const mockCanvas = { width: 0, height: 0, getContext: vi.fn(() => createMockCtx()) };
    const origDocument = (globalThis as any).document;
    (globalThis as any).document = { createElement: vi.fn(() => mockCanvas) };
    try {
      const clip = makeSubtitleClip({ text: '', start: 0, duration: 2 });
      const canvas = prerenderSubtitleToCanvas(clip, 320, 180);
      expect(canvas).toBeDefined();
    } finally {
      (globalThis as any).document = origDocument;
    }
  });

  it('应该处理只有空格的文本', () => {
    const mockCanvas = { width: 0, height: 0, getContext: vi.fn(() => createMockCtx()) };
    const origDocument = (globalThis as any).document;
    (globalThis as any).document = { createElement: vi.fn(() => mockCanvas) };
    try {
      const clip = makeSubtitleClip({ text: '   ', start: 0, duration: 2 });
      const canvas = prerenderSubtitleToCanvas(clip, 320, 180);
      expect(canvas).toBeDefined();
    } finally {
      (globalThis as any).document = origDocument;
    }
  });
});

// ---------------------------------------------------------------------------
// Tests: Measure Text
// ---------------------------------------------------------------------------

describe('measureSubtitleText', () => {
  it('应该返回文本尺寸', () => {
    const ctx = createMockCtx();
    const style = resolveSubtitleStyle({ fontSize: 48 });
    const size = measureSubtitleText(ctx, 'Hello', style);
    expect(size.width).toBeGreaterThan(0);
    expect(size.height).toBeCloseTo(48 * 1.4);
  });

  it('应该调用 save 和 restore', () => {
    const ctx = createMockCtx();
    const style = resolveSubtitleStyle({});
    measureSubtitleText(ctx, 'Test', style);
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });

  it('应该设置正确的字体', () => {
    const ctx = createMockCtx();
    const style = resolveSubtitleStyle({ fontSize: 32, bold: true });
    measureSubtitleText(ctx, 'Test', style);
    expect(ctx.font).toContain('700');
    expect(ctx.font).toContain('32px');
  });

  it('应该根据 fontSize 计算高度', () => {
    const ctx = createMockCtx();
    const style = resolveSubtitleStyle({ fontSize: 20 });
    const size = measureSubtitleText(ctx, 'A', style);
    expect(size.height).toBeCloseTo(20 * 1.4);
  });

  it('应该返回 measureText 的宽度', () => {
    const ctx = createMockCtx();
    const style = resolveSubtitleStyle({});
    const size = measureSubtitleText(ctx, 'Hello', style);
    // mock measureText 返回 text.length * 10
    expect(size.width).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// Tests: Create Batch Context
// ---------------------------------------------------------------------------

describe('createBatchContext', () => {
  function withMockDocument(fn: () => void) {
    const mockCanvas = { width: 0, height: 0, getContext: vi.fn(() => createMockCtx()) };
    const origDocument = (globalThis as any).document;
    (globalThis as any).document = { createElement: vi.fn(() => mockCanvas) };
    try {
      fn();
    } finally {
      (globalThis as any).document = origDocument;
    }
  }

  it('应该返回包含必要属性的上下文对象', () => {
    withMockDocument(() => {
      const batchCtx = createBatchContext();
      expect(batchCtx).toHaveProperty('offscreenCanvas');
      expect(batchCtx).toHaveProperty('offscreenCtx');
      expect(batchCtx).toHaveProperty('fontCache');
      expect(batchCtx).toHaveProperty('lastCueIds');
    });
  });

  it('应该初始化空的字体缓存', () => {
    withMockDocument(() => {
      const batchCtx = createBatchContext();
      expect(batchCtx.fontCache).toBeInstanceOf(Map);
      expect(batchCtx.fontCache.size).toBe(0);
    });
  });

  it('应该初始化空的 lastCueIds 集合', () => {
    withMockDocument(() => {
      const batchCtx = createBatchContext();
      expect(batchCtx.lastCueIds).toBeInstanceOf(Set);
      expect(batchCtx.lastCueIds.size).toBe(0);
    });
  });

  it('应该创建 canvas 元素（jsdom 无 OffscreenCanvas）', () => {
    withMockDocument(() => {
      const batchCtx = createBatchContext();
      expect(batchCtx.offscreenCanvas).toBeDefined();
      expect(batchCtx.offscreenCtx).toBeDefined();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests: Render Subtitle With Batch Context
// ---------------------------------------------------------------------------

describe('renderSubtitleWithBatchContext', () => {
  function createMockBatchCtx() {
    const mockCanvas = { width: 0, height: 0, getContext: vi.fn(() => createMockCtx()) };
    const origDocument = (globalThis as any).document;
    (globalThis as any).document = { createElement: vi.fn(() => mockCanvas) };
    try {
      return createBatchContext();
    } finally {
      (globalThis as any).document = origDocument;
    }
  }

  it('应该在首次调用时渲染字幕', () => {
    const ctx = createMockCtx();
    const batchCtx = createMockBatchCtx();
    const clips: SubtitleClip[] = [
      makeSubtitleClip({ id: 'c1', text: 'Hello', start: 0, duration: 2 }),
    ];
    const stats = renderSubtitleWithBatchContext(ctx, batchCtx, clips, 1, 1280, 720);
    expect(stats.renderedCues).toBe(1);
    expect(ctx.fillText).toHaveBeenCalled();
  });

  it('应该在字幕未变化时跳过渲染（脏检查优化）', () => {
    const ctx = createMockCtx();
    const batchCtx = createMockBatchCtx();
    const clips: SubtitleClip[] = [
      makeSubtitleClip({ id: 'c1', text: 'Hello', start: 0, duration: 5 }),
    ];

    // 第一次调用 - 应该渲染
    renderSubtitleWithBatchContext(ctx, batchCtx, clips, 1, 1280, 720);
    const firstCallCount = (ctx.fillText as any).mock.calls.length;
    expect(firstCallCount).toBeGreaterThan(0);

    // 第二次调用 - 同样的字幕和时间，应该跳过渲染
    const stats = renderSubtitleWithBatchContext(ctx, batchCtx, clips, 1.5, 1280, 720);
    expect(stats.renderedCues).toBe(1);
    expect(stats.isPerformant).toBe(true);
    // fillText 不应该被再次调用
    expect((ctx.fillText as any).mock.calls.length).toBe(firstCallCount);
  });

  it('应该在字幕集合变化时重新渲染', () => {
    const ctx = createMockCtx();
    const batchCtx = createMockBatchCtx();
    const clips1: SubtitleClip[] = [
      makeSubtitleClip({ id: 'c1', text: 'Hello', start: 0, duration: 2 }),
    ];
    const clips2: SubtitleClip[] = [
      makeSubtitleClip({ id: 'c2', text: 'World', start: 0, duration: 2 }),
    ];

    // 第一次渲染 c1
    renderSubtitleWithBatchContext(ctx, batchCtx, clips1, 1, 1280, 720);
    const afterFirst = (ctx.fillText as any).mock.calls.length;

    // 第二次渲染 c2 - 字幕ID变化，应该重新渲染
    renderSubtitleWithBatchContext(ctx, batchCtx, clips2, 1, 1280, 720);
    expect((ctx.fillText as any).mock.calls.length).toBeGreaterThan(afterFirst);
  });

  it('应该在活跃字幕数量变化时重新渲染', () => {
    const ctx = createMockCtx();
    const batchCtx = createMockBatchCtx();
    const clips: SubtitleClip[] = [
      makeSubtitleClip({ id: 'c1', text: 'Hello', start: 0, duration: 5 }),
      makeSubtitleClip({ id: 'c2', text: 'World', start: 2, duration: 5 }),
    ];

    // 只有 c1 活跃
    renderSubtitleWithBatchContext(ctx, batchCtx, clips, 1, 1280, 720);
    const afterFirst = (ctx.fillText as any).mock.calls.length;

    // c1 和 c2 都活跃 - 字幕集合变化
    renderSubtitleWithBatchContext(ctx, batchCtx, clips, 3, 1280, 720);
    expect((ctx.fillText as any).mock.calls.length).toBeGreaterThan(afterFirst);
  });

  it('应该处理空字幕数组', () => {
    const ctx = createMockCtx();
    const batchCtx = createMockBatchCtx();
    const stats = renderSubtitleWithBatchContext(ctx, batchCtx, [], 0, 1280, 720);
    expect(stats.renderedCues).toBe(0);
    expect(stats.isPerformant).toBe(true);
  });

  it('应该在连续空帧时跳过渲染', () => {
    const ctx = createMockCtx();
    const batchCtx = createMockBatchCtx();

    // 第一帧 - 无字幕
    renderSubtitleWithBatchContext(ctx, batchCtx, [], 0, 1280, 720);
    const afterFirst = (ctx.fillText as any).mock.calls.length;

    // 第二帧 - 仍然无字幕，应该跳过
    const stats = renderSubtitleWithBatchContext(ctx, batchCtx, [], 0.5, 1280, 720);
    expect(stats.renderedCues).toBe(0);
    expect((ctx.fillText as any).mock.calls.length).toBe(afterFirst);
  });

  it('应该使用自定义 maxCues 配置', () => {
    const ctx = createMockCtx();
    const batchCtx = createMockBatchCtx();
    const clips: SubtitleClip[] = Array.from({ length: 10 }, (_, i) =>
      makeSubtitleClip({ id: `c${i}`, text: `Sub ${i}`, start: 0, duration: 10 }),
    );
    const stats = renderSubtitleWithBatchContext(ctx, batchCtx, clips, 5, 1280, 720, { maxCues: 2 });
    expect(stats.renderedCues).toBeLessThanOrEqual(2);
  });

  it('应该返回正确的统计信息', () => {
    const ctx = createMockCtx();
    const batchCtx = createMockBatchCtx();
    const clips: SubtitleClip[] = [
      makeSubtitleClip({ id: 'c1', text: 'Test', start: 0, duration: 2 }),
    ];
    const stats = renderSubtitleWithBatchContext(ctx, batchCtx, clips, 1, 1280, 720);
    expect(stats).toHaveProperty('renderedCues');
    expect(stats).toHaveProperty('renderTimeMs');
    expect(stats).toHaveProperty('isPerformant');
    expect(stats.renderTimeMs).toBeGreaterThanOrEqual(0);
  });
});

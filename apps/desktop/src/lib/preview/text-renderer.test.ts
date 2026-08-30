// @vitest-environment jsdom
// 源文件：apps/desktop/src/lib/preview/text-renderer.ts
// 覆盖目标：drawText2d（普通/富文本/弧形/路径/字幕布局/数据字幕/背景）+ drawCreditsRoll2d +
//          drawCreditsRollWebGl + drawMissing2d/WebGl + drawTextWebGl
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Clip } from '@open-factory/editor-core';
import { DEFAULT_COLOR_CORRECTION, DEFAULT_SUBTITLE_STYLE, DEFAULT_TRANSFORM } from '@open-factory/editor-core';

vi.mock('./transform-2d', () => ({
  drawTransformedSource2d: vi.fn(),
}));

vi.mock('./debug', () => ({
  recordPreviewDraw: vi.fn(),
}));

import {
  drawCreditsRoll2d,
  drawCreditsRollWebGl,
  drawMissing2d,
  drawMissingWebGl,
  drawText2d,
  drawTextWebGl,
} from './text-renderer';
import { drawTransformedSource2d } from './transform-2d';
import { recordPreviewDraw } from './debug';

const drawTransformedSource2dMock = vi.mocked(drawTransformedSource2d);
const recordPreviewDrawMock = vi.mocked(recordPreviewDraw);

type TextClip = Extract<Clip, { type: 'text' }>;
type SubtitleClip = Extract<Clip, { type: 'subtitle' }>;
type CreditsClip = Extract<Clip, { type: 'credits' }>;

function makeTextClip(overrides: Partial<TextClip> = {}): TextClip {
  return {
    id: 'clip-text-1',
    type: 'text',
    trackId: 'track-1',
    name: 'text-clip',
    start: 0,
    duration: 5,
    trimStart: 0,
    trimEnd: 0,
    transform: DEFAULT_TRANSFORM,
    text: '标题文本',
    style: { ...DEFAULT_SUBTITLE_STYLE, backgroundOpacity: 0 },
    colorCorrection: DEFAULT_COLOR_CORRECTION,
    ...overrides,
  } as unknown as TextClip;
}

function makeSubtitleClip(overrides: Partial<SubtitleClip> = {}): SubtitleClip {
  return {
    id: 'clip-sub-1',
    type: 'subtitle',
    trackId: 'track-1',
    name: 'subtitle-clip',
    start: 1,
    duration: 5,
    trimStart: 0,
    trimEnd: 0,
    transform: DEFAULT_TRANSFORM,
    text: '',
    style: DEFAULT_SUBTITLE_STYLE,
    subtitleMode: 'burn-in',
    colorCorrection: DEFAULT_COLOR_CORRECTION,
    ...overrides,
  } as unknown as SubtitleClip;
}

const CREDITS_STYLE = {
  fontSize: 32,
  color: '#ffffff',
  backgroundColor: '#000000',
  backgroundOpacity: 0,
  fontFamily: 'Inter, Arial, sans-serif',
  bold: false,
  italic: false,
  lineSpacing: 8,
  horizontalMargin: 80,
};

function makeCreditsClip(overrides: Partial<CreditsClip> = {}): CreditsClip {
  return {
    id: 'clip-credits-1',
    type: 'credits',
    trackId: 'track-1',
    name: 'credits-clip',
    start: 0,
    duration: 8,
    trimStart: 0,
    trimEnd: 0,
    transform: DEFAULT_TRANSFORM,
    text: '',
    rows: [
      { role: '导演', name: '张三' },
      { role: '', name: '鸣谢' },
      { role: '摄影', name: '' },
    ],
    rollSpeed: 40,
    style: CREDITS_STYLE,
    colorCorrection: DEFAULT_COLOR_CORRECTION,
    ...overrides,
  } as unknown as CreditsClip;
}

interface TextContextCall {
  method: string;
  args: unknown[];
}

function createTextContext() {
  const calls: TextContextCall[] = [];
  const record =
    (method: string) =>
    (...args: unknown[]) => {
      calls.push({ method, args });
    };
  const context = {
    filter: 'none',
    globalAlpha: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
    fillStyle: '',
    lineWidth: 0,
    save: record('save'),
    restore: record('restore'),
    translate: record('translate'),
    rotate: record('rotate'),
    scale: record('scale'),
    fillText: record('fillText'),
    fillRect: record('fillRect'),
    measureText: (text: string) => {
      calls.push({ method: 'measureText', args: [text] });
      return { width: text.length * 12 };
    },
  };
  return { context: context as unknown as CanvasRenderingContext2D, calls };
}

const canvas = { width: 400, height: 300 } as HTMLCanvasElement;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('drawText2d', () => {
  it('普通文本：组装字体并对齐居中绘制', () => {
    const { context, calls } = createTextContext();
    const clip = makeTextClip({
      text: '你好',
      style: { ...DEFAULT_SUBTITLE_STYLE, backgroundOpacity: 0, bold: true, italic: true, fontSize: 36 },
    });

    drawText2d(context, canvas, clip);

    expect(calls.find((call) => call.method === 'fillText')?.args).toEqual(['你好', 0, 0]);
    expect(context.font).toContain('italic');
    expect(context.font).toContain('700');
    expect(context.font).toContain('36px');
    expect(context.textAlign).toBe('center');
    expect(context.textBaseline).toBe('middle');
    expect(recordPreviewDrawMock).toHaveBeenCalledWith('text', 'text', '你好');
  });

  it('bypassProcessing 时 filter 为 none', () => {
    const bypassed = createTextContext();
    drawText2d(bypassed.context, canvas, makeTextClip(), true);
    expect(bypassed.context.filter).toBe('none');

    const processed = createTextContext();
    drawText2d(processed.context, canvas, makeTextClip(), false);
    expect(processed.calls.some((call) => call.method === 'fillText')).toBe(true);
    expect(processed.context.filter).toBe('none');
  });

  it('字幕无文本时直接返回不绘制', () => {
    const { context, calls } = createTextContext();

    drawText2d(context, canvas, makeSubtitleClip({ text: '' }));

    expect(calls.filter((call) => call.method === 'fillText')).toHaveLength(0);
    expect(recordPreviewDrawMock).not.toHaveBeenCalled();
  });

  it('字幕布局覆盖位移到底部安全区', () => {
    const { context, calls } = createTextContext();
    const clip = makeSubtitleClip({ text: '底部字幕' });
    // DEFAULT_SUBTITLE_STYLE: fontSize 42, yOffset 72
    drawText2d(context, canvas, clip);

    const translate = calls.find((call) => call.method === 'translate');
    expect(translate?.args[0]).toBe(200);
    // 实际行为：subtitle 的 yOffset 定位与画布中心叠加（记录为观察项：y 双重偏移疑似缺陷）
    expect(translate?.args[1]).toBeCloseTo(150 + (150 - 72 - 21), 5);
    expect(recordPreviewDrawMock).toHaveBeenCalledWith('subtitle', 'text', '底部字幕');
  });

  it('数据字幕按时间命中行并展开模板', () => {
    const { context, calls } = createTextContext();
    const clip = makeSubtitleClip({
      start: 1,
      dataSubtitle: {
        sourceType: 'csv',
        template: '{row.text}',
        rows: [{ time: 2, text: '数据行', values: {} }],
      },
    });

    drawText2d(context, canvas, clip, false, 1);

    expect(calls.find((call) => call.method === 'fillText')?.args[0]).toBe('数据行');
  });

  it('背景不透明度大于 0 时先绘制背景矩形', () => {
    const { context, calls } = createTextContext();
    const clip = makeTextClip({ style: { ...DEFAULT_SUBTITLE_STYLE, backgroundOpacity: 0.5 } });

    drawText2d(context, canvas, clip);

    const fillRect = calls.find((call) => call.method === 'fillRect');
    expect(fillRect).toBeDefined();
    // 背景矩形宽度 >= fontSize（measureText 宽度 + 双侧内边距）
    expect(fillRect?.args[2] as number).toBeGreaterThanOrEqual(42);
  });

  it('弧形文本逐字符绘制', () => {
    const { context, calls } = createTextContext();
    const clip = makeTextClip({
      text: 'ABC',
      arcText: { enabled: true, radius: 120, startAngle: -90, clockwise: true, rotateCharacters: true },
    });

    drawText2d(context, canvas, clip);

    expect(calls.filter((call) => call.method === 'fillText').map((call) => call.args[0])).toEqual(['A', 'B', 'C']);
  });

  it('路径文本沿路径逐字符绘制', () => {
    const { context, calls } = createTextContext();
    const clip = makeTextClip({
      text: 'XY',
      pathText: {
        enabled: true,
        path: [
          { x: 0, y: 0 },
          { x: 300, y: 0 },
        ],
        startOffset: 0,
        letterSpacing: 0,
        rotateCharacters: true,
      },
    });

    drawText2d(context, canvas, clip);

    expect(calls.filter((call) => call.method === 'fillText').map((call) => call.args[0])).toEqual(['X', 'Y']);
  });

  it('富文本按段落 run 分段绘制并支持下划线', () => {
    const { context, calls } = createTextContext();
    const clip = makeTextClip({
      text: '混合样式',
      richText: {
        paragraphs: [
          {
            runs: [{ text: '普通' }, { text: '强调', bold: true, underline: true }],
          },
        ],
      },
    });

    drawText2d(context, canvas, clip);

    const fills = calls.filter((call) => call.method === 'fillText').map((call) => call.args[0]);
    expect(fills).toContain('普通');
    expect(fills).toContain('强调');
    // 下划线 run 触发 fillRect
    expect(calls.some((call) => call.method === 'fillRect')).toBe(true);
    expect(recordPreviewDrawMock).toHaveBeenCalledWith('text', 'text', '普通强调');
  });
});

describe('drawCreditsRoll2d', () => {
  it('按行滚动绘制：双列与单列居中', () => {
    const { context, calls } = createTextContext();
    const clip = makeCreditsClip();

    // localTime 0：startY = 300/2 = 150，行高 = 32 + 8 = 40
    drawCreditsRoll2d(context, canvas, clip, false, 0);

    const fills = calls.filter((call) => call.method === 'fillText');
    // 第一行 role+name 双列
    expect(fills[0]?.args[0]).toBe('导演');
    expect(fills[1]?.args[0]).toBe('张三');
    // 第二行仅 name 居中
    expect(fills[2]?.args[0]).toBe('鸣谢');
    // 第三行 y=230 超出窗口下界（150+40）被裁剪
    expect(fills).toHaveLength(3);
    expect(context.textAlign).toBe('center');
  });

  it('滚动推进 startY 随 localTime 增大而上移', () => {
    const first = createTextContext();
    const second = createTextContext();
    const clip = makeCreditsClip({ rows: [{ role: 'A', name: 'B' }] });

    drawCreditsRoll2d(first.context, canvas, clip, false, 0);
    drawCreditsRoll2d(second.context, canvas, clip, false, 1);

    // fillText(role, -gap, y)：y 为第 3 参
    const yFirst = first.calls.find((call) => call.method === 'fillText')?.args[2];
    const ySecond = second.calls.find((call) => call.method === 'fillText')?.args[2];
    expect(ySecond as number).toBeLessThan(yFirst as number);
  });

  it('行超出画布窗口时被裁剪不绘制', () => {
    const { context, calls } = createTextContext();
    const clip = makeCreditsClip({ rows: [{ role: '远', name: '行' }] });

    // rollSpeed 40、localTime 20 → startY = 150 - 800 = -650，超出 -150-40 下界
    drawCreditsRoll2d(context, canvas, clip, false, 20);

    expect(calls.filter((call) => call.method === 'fillText')).toHaveLength(0);
  });

  it('背景不透明度大于 0 时铺满全画布背景', () => {
    const { context, calls } = createTextContext();
    const clip = makeCreditsClip({ style: { ...CREDITS_STYLE, backgroundOpacity: 0.4 } });

    drawCreditsRoll2d(context, canvas, clip, false, 0);

    expect(calls.find((call) => call.method === 'fillRect')?.args).toEqual([0, 0, 400, 300]);
  });
});

describe('drawCreditsRollWebGl', () => {
  it('经离屏 canvas 绘制后交给合成器', () => {
    const offscreen = createTextContext();
    const spy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(offscreen.context as unknown as CanvasRenderingContext2D);
    const compositor = { drawSourceWithColorNodeGraph: vi.fn() };

    drawCreditsRollWebGl(compositor as never, makeCreditsClip(), 400, 300, false, 0);

    expect(compositor.drawSourceWithColorNodeGraph).toHaveBeenCalledTimes(1);
    const args = compositor.drawSourceWithColorNodeGraph.mock.calls[0];
    expect(args?.[1]).toBe(400);
    expect(args?.[2]).toBe(300);
    spy.mockRestore();
  });

  it('离屏 canvas 无 2d 上下文时直接返回', () => {
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const compositor = { drawSourceWithColorNodeGraph: vi.fn() };

    drawCreditsRollWebGl(compositor as never, makeCreditsClip(), 400, 300, false, 0);

    expect(compositor.drawSourceWithColorNodeGraph).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('drawMissing2d', () => {
  it('生成缺失提示画布并经 transform-2d 绘制', () => {
    const offscreen = createTextContext();
    const spy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(offscreen.context as unknown as CanvasRenderingContext2D);

    drawMissing2d(createTextContext().context, canvas, 'lost.mp4', 'video');

    expect(drawTransformedSource2dMock).toHaveBeenCalledTimes(1);
    const args = drawTransformedSource2dMock.mock.calls[0];
    expect(args?.[3]).toEqual({ width: 340, height: 68 });
    expect(recordPreviewDrawMock).toHaveBeenCalledWith('video', 'missing');
    spy.mockRestore();
  });

  it('离屏画布无 2d 上下文时不绘制', () => {
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

    drawMissing2d(createTextContext().context, canvas, 'lost.mp4', 'image');

    expect(drawTransformedSource2dMock).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('drawMissingWebGl', () => {
  it('委托合成器 drawMissing 并记录', () => {
    const compositor = { drawMissing: vi.fn() };

    drawMissingWebGl(compositor as never, 'lost.mp4', 'video');

    expect(compositor.drawMissing).toHaveBeenCalledWith('lost.mp4');
    expect(recordPreviewDrawMock).toHaveBeenCalledWith('video', 'missing');
  });
});

describe('drawTextWebGl', () => {
  it('普通文本委托合成器 drawText 并透传样式', () => {
    const compositor = { drawText: vi.fn() };
    const clip = makeTextClip({ text: 'GL 文本' });

    drawTextWebGl(compositor as never, clip, true, 'aces', 0);

    expect(compositor.drawText).toHaveBeenCalledWith(
      'GL 文本',
      clip.transform,
      clip.style,
      clip.colorCorrection,
      clip.effects,
      clip.colorNodeGraph,
      { bypassProcessing: true, colorPipeline: 'aces' },
    );
    expect(recordPreviewDrawMock).toHaveBeenCalledWith('text', 'text', 'GL 文本');
  });

  it('字幕无文本时直接返回', () => {
    const compositor = { drawText: vi.fn() };

    drawTextWebGl(compositor as never, makeSubtitleClip({ text: '' }), false, undefined, 0);

    expect(compositor.drawText).not.toHaveBeenCalled();
  });

  it('富文本以纯文本提交给合成器', () => {
    const compositor = { drawText: vi.fn() };
    const clip = makeTextClip({
      text: '富文本',
      richText: { paragraphs: [{ runs: [{ text: '富文本' }] }] },
    });

    drawTextWebGl(compositor as never, clip, false, undefined, 0);

    expect(compositor.drawText.mock.calls[0]?.[0]).toBe('富文本');
  });
});

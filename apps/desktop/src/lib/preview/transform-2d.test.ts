// @vitest-environment jsdom
// 源文件：apps/desktop/src/lib/preview/transform-2d.ts
// 覆盖目标：drawTransformedSource2d 全路径（变换矩阵传播 + buildCanvasFilter 滤镜字符串 + 状态恢复）
import { describe, expect, it } from 'vitest';
import { DEFAULT_COLOR_CORRECTION, type Transform } from '@open-factory/editor-core';
import { drawTransformedSource2d } from './transform-2d';

interface RecordedCall {
  method: string;
  args: unknown[];
}

function createMockContext(initialFilter = 'none') {
  const calls: RecordedCall[] = [];
  const record =
    (method: string) =>
    (...args: unknown[]) => {
      calls.push({ method, args });
    };
  const context = {
    filter: initialFilter,
    globalAlpha: 1,
    save: record('save'),
    restore: record('restore'),
    translate: record('translate'),
    rotate: record('rotate'),
    scale: record('scale'),
    drawImage: record('drawImage'),
  };
  return { context: context as unknown as CanvasRenderingContext2D, calls };
}

/** 包装 context 捕获 drawImage 执行时刻的 filter 字符串（filter 写在 wrapper 自身） */
function withFilterCapture(base: CanvasRenderingContext2D, observed: string[]): CanvasRenderingContext2D {
  const wrapper = {
    ...base,
    drawImage: (...args: unknown[]) => {
      observed.push(wrapper.filter);
      void args;
    },
  };
  return wrapper as unknown as CanvasRenderingContext2D;
}

const transform: Transform = { x: 10, y: -6, scale: 1, scaleX: 2, scaleY: 0.5, rotation: 90, opacity: 0.7 };

describe('drawTransformedSource2d', () => {
  it('按默认色彩校正生成中性 filter 并传播变换矩阵', () => {
    const { context, calls } = createMockContext();
    const canvas = { width: 400, height: 300 } as HTMLCanvasElement;

    drawTransformedSource2d(context, canvas, {} as CanvasImageSource, { width: 120, height: 80 }, transform);

    expect(calls.map((call) => call.method)).toEqual(['save', 'translate', 'rotate', 'scale', 'drawImage', 'restore']);
    // save/restore 为 mock，不重置属性：globalAlpha 保持 transform.opacity
    expect(context.globalAlpha).toBe(0.7);
    expect(calls.find((call) => call.method === 'translate')?.args).toEqual([210, 144]);
    expect(calls.find((call) => call.method === 'rotate')?.args[0]).toBeCloseTo(Math.PI / 2, 6);
    expect(calls.find((call) => call.method === 'scale')?.args).toEqual([2, 0.5]);
    expect(calls.find((call) => call.method === 'drawImage')?.args).toEqual([{}, -60, -40, 120, 80]);
  });

  it('亮度负值钳制为 0 并在结束后恢复原 filter', () => {
    const { context } = createMockContext('blur(2px)');
    const canvas = { width: 100, height: 100 } as HTMLCanvasElement;
    const observedFilters: string[] = [];

    drawTransformedSource2d(
      withFilterCapture(context, observedFilters),
      canvas,
      {} as CanvasImageSource,
      { width: 10, height: 10 },
      transform,
      { ...DEFAULT_COLOR_CORRECTION, brightness: -1.5, contrast: 2, saturation: 1.2, hue: 45 },
    );

    expect(observedFilters).toEqual(['brightness(0) contrast(2) saturate(1.2) hue-rotate(45deg)']);
    expect(context.filter).toBe('blur(2px)');
  });

  it('自定义色彩校正生成对应 filter 串', () => {
    const { context } = createMockContext();
    const canvas = { width: 100, height: 100 } as HTMLCanvasElement;
    const observedFilters: string[] = [];

    drawTransformedSource2d(
      withFilterCapture(context, observedFilters),
      canvas,
      {} as CanvasImageSource,
      { width: 10, height: 10 },
      transform,
      { ...DEFAULT_COLOR_CORRECTION, brightness: 0.25, contrast: 1.5, saturation: 0.8, hue: 90 },
    );

    expect(observedFilters).toEqual(['brightness(1.25) contrast(1.5) saturate(0.8) hue-rotate(90deg)']);
  });

  it('未提供色彩校正时使用默认中性串', () => {
    const { context } = createMockContext();
    const canvas = { width: 100, height: 100 } as HTMLCanvasElement;
    const observedFilters: string[] = [];

    drawTransformedSource2d(
      withFilterCapture(context, observedFilters),
      canvas,
      {} as CanvasImageSource,
      { width: 10, height: 10 },
      transform,
    );

    expect(observedFilters).toEqual(['brightness(1) contrast(1) saturate(1) hue-rotate(0deg)']);
  });

  it('transform 缺少 scaleX/scaleY 时回退到默认值 1', () => {
    const { context, calls } = createMockContext();
    const canvas = { width: 200, height: 200 } as HTMLCanvasElement;

    drawTransformedSource2d(context, canvas, {} as CanvasImageSource, { width: 10, height: 10 }, {
      x: 0,
      y: 0,
      rotation: 0,
      opacity: 1,
    } as unknown as Transform);

    expect(calls.find((call) => call.method === 'scale')?.args).toEqual([1, 1]);
  });
});

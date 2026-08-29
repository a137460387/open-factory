// @vitest-environment jsdom
// 源文件：apps/desktop/src/lib/preview/debug.ts
// 覆盖目标：recordPreviewMode / recordPreviewDraw / recordPreviewError / recordPreviewReadback /
//          recordPreviewGpuMetrics / recordAudioMix 全记录函数 + shouldRecordPreviewDebug 开关 + isNonBackgroundPixel 判定
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PreviewGpuDebugMetrics } from './debug';
import {
  recordAudioMix,
  recordPreviewDraw,
  recordPreviewError,
  recordPreviewGpuMetrics,
  recordPreviewMode,
  recordPreviewReadback,
} from './debug';

// window.__OPEN_FACTORY_PREVIEW_DEBUG__ 等全局类型声明见 src/vite-env.d.ts

beforeEach(() => {
  vi.stubEnv('VITE_E2E', 'true');
  window.__OPEN_FACTORY_PREVIEW_DEBUG__ = undefined;
  window.__OPEN_FACTORY_AUDIO_MIX_DEBUG__ = undefined;
  window.__OPEN_FACTORY_NATIVE_PREVIEW_SMOKE_ACTIVE__ = undefined;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('preview debug 记录函数', () => {
  it('非 E2E 且无冒烟标记时不记录任何状态', () => {
    vi.stubEnv('VITE_E2E', 'false');

    recordPreviewMode('2d');
    recordPreviewDraw('video', 'video');
    recordPreviewError('boom');
    recordPreviewReadback([255, 255, 255, 255]);

    expect(window.__OPEN_FACTORY_PREVIEW_DEBUG__).toBeUndefined();
  });

  it('原生预览冒烟标记同样启用记录', () => {
    vi.stubEnv('VITE_E2E', 'false');
    window.__OPEN_FACTORY_NATIVE_PREVIEW_SMOKE_ACTIVE__ = true;

    recordPreviewMode('webgl');

    expect(window.__OPEN_FACTORY_PREVIEW_DEBUG__).toMatchObject({ mode: 'webgl', renderCount: 1 });
  });

  it('recordPreviewMode 累加 renderCount 并保留既有字段', () => {
    window.__OPEN_FACTORY_PREVIEW_DEBUG__ = { renderCount: 3, drawCount: 7 };

    recordPreviewMode('2d');

    expect(window.__OPEN_FACTORY_PREVIEW_DEBUG__).toMatchObject({ mode: '2d', renderCount: 4, drawCount: 7 });
  });

  it('recordPreviewDraw 追加 clip 类型与来源并更新 lastText', () => {
    recordPreviewDraw('video', 'video');
    recordPreviewDraw('text', 'text', '标题');

    const state = window.__OPEN_FACTORY_PREVIEW_DEBUG__;
    expect(state).toMatchObject({ drawCount: 2, drawnClipTypes: ['video', 'text'], sourceKinds: ['video', 'text'] });
    expect((state as { lastText?: string }).lastText).toBe('标题');
  });

  it('recordPreviewDraw 无 text 时保留上次 lastText 并裁剪至最近 20 条', () => {
    for (let index = 0; index < 22; index += 1) {
      recordPreviewDraw(`clip-${index}`, 'video');
    }

    const state = window.__OPEN_FACTORY_PREVIEW_DEBUG__ as { drawnClipTypes: string[]; lastText?: string };
    expect(state.drawnClipTypes).toHaveLength(20);
    expect(state.drawnClipTypes[0]).toBe('clip-2');
    expect(state.drawnClipTypes.at(-1)).toBe('clip-21');
    expect(state.lastText).toBeUndefined();
  });

  it('recordPreviewError 追加错误并裁剪至最近 10 条', () => {
    for (let index = 0; index < 12; index += 1) {
      recordPreviewError(`error-${index}`);
    }

    const state = window.__OPEN_FACTORY_PREVIEW_DEBUG__ as { errors: string[] };
    expect(state.errors).toHaveLength(10);
    expect(state.errors[0]).toBe('error-2');
    expect(state.errors.at(-1)).toBe('error-11');
  });

  it('recordPreviewReadback 判定非背景像素（亮前景）', () => {
    recordPreviewReadback([255, 255, 255, 255]);

    expect(window.__OPEN_FACTORY_PREVIEW_DEBUG__).toMatchObject({
      readback: { pixel: [255, 255, 255, 255], hasNonBackgroundPixels: true, error: undefined },
    });
  });

  it('recordPreviewReadback 判定背景像素与透明像素为背景', () => {
    recordPreviewReadback([20, 24, 32, 255]);
    const background = window.__OPEN_FACTORY_PREVIEW_DEBUG__ as { readback: { hasNonBackgroundPixels: boolean } };
    expect(background.readback.hasNonBackgroundPixels).toBe(false);

    recordPreviewReadback([255, 255, 255, 0]);
    const transparent = window.__OPEN_FACTORY_PREVIEW_DEBUG__ as { readback: { hasNonBackgroundPixels: boolean } };
    expect(transparent.readback.hasNonBackgroundPixels).toBe(false);
  });

  it('recordPreviewReadback 记录错误信息与空像素', () => {
    recordPreviewReadback(undefined, 'readback failed');

    expect(window.__OPEN_FACTORY_PREVIEW_DEBUG__).toMatchObject({
      readback: { pixel: undefined, hasNonBackgroundPixels: false, error: 'readback failed' },
    });
  });

  it('recordPreviewGpuMetrics 保留两位小数并透传指标', () => {
    const metrics: PreviewGpuDebugMetrics = {
      gpuFrameMs: 3.4567,
      textureBytes: 1024,
      textureCount: 2,
      drawCalls: 8,
      instancedDrawCalls: 1,
      offscreenWorkerSupported: true,
      offscreenWorkerActive: false,
      timerQuerySupported: false,
      fallbackReason: 'timer-query-unavailable',
    };

    recordPreviewGpuMetrics(metrics);

    expect(window.__OPEN_FACTORY_PREVIEW_DEBUG__).toMatchObject({
      gpu: {
        gpuFrameMs: 3.46,
        textureBytes: 1024,
        textureCount: 2,
        drawCalls: 8,
        instancedDrawCalls: 1,
        offscreenWorkerSupported: true,
        offscreenWorkerActive: false,
        timerQuerySupported: false,
        fallbackReason: 'timer-query-unavailable',
      },
    });
  });

  it('recordAudioMix 追加类型与增益（保留三位小数，裁剪至最近 20 条）', () => {
    for (let index = 0; index < 21; index += 1) {
      recordAudioMix('audio', 0.123456);
    }
    recordAudioMix('video', 1);

    const state = window.__OPEN_FACTORY_AUDIO_MIX_DEBUG__;
    expect(state?.clipTypes).toHaveLength(20);
    expect(state?.clipTypes[0]).toBe('audio');
    expect(state?.clipTypes.at(-1)).toBe('video');
    expect(state?.gainValues[0]).toBe(0.123);
    expect(state?.gainValues.at(-1)).toBe(1);
  });
});

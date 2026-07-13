export type PreviewSourceKind = 'video' | 'image' | 'thumbnail' | 'text' | 'subtitle' | 'missing' | 'hw-decode';

export interface PreviewGpuDebugMetrics {
  gpuFrameMs: number;
  textureBytes: number;
  textureCount: number;
  drawCalls: number;
  instancedDrawCalls: number;
  offscreenWorkerSupported: boolean;
  offscreenWorkerActive: boolean;
  timerQuerySupported: boolean;
  fallbackReason?: string;
}

export function recordPreviewMode(mode: 'webgl' | '2d'): void {
  if (!shouldRecordPreviewDebug()) {
    return;
  }
  window.__OPEN_FACTORY_PREVIEW_DEBUG__ = {
    ...window.__OPEN_FACTORY_PREVIEW_DEBUG__,
    mode,
    renderCount: (window.__OPEN_FACTORY_PREVIEW_DEBUG__?.renderCount ?? 0) + 1
  };
}

export function recordPreviewDraw(clipType: string, sourceKind: PreviewSourceKind, text?: string): void {
  if (!shouldRecordPreviewDebug()) {
    return;
  }
  const current = window.__OPEN_FACTORY_PREVIEW_DEBUG__ ?? { renderCount: 0 };
  window.__OPEN_FACTORY_PREVIEW_DEBUG__ = {
    ...current,
    drawCount: (current.drawCount ?? 0) + 1,
    drawnClipTypes: [...(current.drawnClipTypes ?? []), clipType].slice(-20),
    sourceKinds: [...(current.sourceKinds ?? []), sourceKind].slice(-20),
    lastText: text ?? current.lastText
  };
}

export function recordPreviewError(message: string): void {
  if (!shouldRecordPreviewDebug()) {
    return;
  }
  const current = window.__OPEN_FACTORY_PREVIEW_DEBUG__ ?? { renderCount: 0 };
  window.__OPEN_FACTORY_PREVIEW_DEBUG__ = {
    ...current,
    errors: [...(current.errors ?? []), message].slice(-10)
  };
}

export function recordPreviewReadback(pixel: number[] | undefined, error?: string): void {
  if (!shouldRecordPreviewDebug()) {
    return;
  }
  const current = window.__OPEN_FACTORY_PREVIEW_DEBUG__ ?? { renderCount: 0 };
  window.__OPEN_FACTORY_PREVIEW_DEBUG__ = {
    ...current,
    readback: {
      pixel,
      hasNonBackgroundPixels: pixel ? isNonBackgroundPixel(pixel) : false,
      error
    }
  };
}

export function recordPreviewGpuMetrics(metrics: PreviewGpuDebugMetrics): void {
  if (!shouldRecordPreviewDebug()) {
    return;
  }
  const current = window.__OPEN_FACTORY_PREVIEW_DEBUG__ ?? { renderCount: 0 };
  window.__OPEN_FACTORY_PREVIEW_DEBUG__ = {
    ...current,
    gpu: {
      gpuFrameMs: Number(metrics.gpuFrameMs.toFixed(2)),
      textureBytes: metrics.textureBytes,
      textureCount: metrics.textureCount,
      drawCalls: metrics.drawCalls,
      instancedDrawCalls: metrics.instancedDrawCalls,
      offscreenWorkerSupported: metrics.offscreenWorkerSupported,
      offscreenWorkerActive: metrics.offscreenWorkerActive,
      timerQuerySupported: metrics.timerQuerySupported,
      fallbackReason: metrics.fallbackReason
    }
  };
}

export function recordAudioMix(clipType: string, gainValue: number): void {
  if (!shouldRecordPreviewDebug()) {
    return;
  }
  const current = window.__OPEN_FACTORY_AUDIO_MIX_DEBUG__ ?? { clipTypes: [], gainValues: [] };
  window.__OPEN_FACTORY_AUDIO_MIX_DEBUG__ = {
    clipTypes: [...current.clipTypes, clipType].slice(-20),
    gainValues: [...current.gainValues, Number(gainValue.toFixed(3))].slice(-20)
  };
}

function shouldRecordPreviewDebug(): boolean {
  return import.meta.env.VITE_E2E === 'true' || window.__OPEN_FACTORY_NATIVE_PREVIEW_SMOKE_ACTIVE__ === true;
}

function isNonBackgroundPixel(pixel: number[]): boolean {
  const background = [20, 24, 32];
  const delta = Math.abs(pixel[0] - background[0]) + Math.abs(pixel[1] - background[1]) + Math.abs(pixel[2] - background[2]);
  const brightness = pixel[0] + pixel[1] + pixel[2];
  return pixel[3] > 0 && delta > 70 && brightness > 120;
}

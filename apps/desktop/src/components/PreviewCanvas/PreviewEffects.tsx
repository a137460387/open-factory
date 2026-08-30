import { Gauge } from 'lucide-react';
import type { GpuPreviewMetrics } from '../../lib/preview/gpu-acceleration';
import {
  getPreviewAdaptiveQualityStatus,
  type PreviewPerformanceSettings,
} from '../../lib/preview/preview-performance';
import { getAdaptiveQualityIndicatorClass } from './utils';
import { zhCN } from '../../i18n/strings';
export interface PreviewEffectsProps {
  adaptiveIndicatorStatus: ReturnType<typeof getPreviewAdaptiveQualityStatus>;
  adaptiveIndicatorTitle: string;
  lowQualityPreview: boolean;
  audioOnlyPreview: boolean;
  showGpuMetricsPanel: boolean;
  gpuPreviewMetrics: GpuPreviewMetrics;
  gpuTextureMemoryLabel: string;
  effectivePreviewPerformance: PreviewPerformanceSettings;
  adaptivePreviewState: { averageFps: number };
  previewPerformance: PreviewPerformanceSettings;
}

export function PreviewEffects(props: PreviewEffectsProps) {
  const {
    adaptiveIndicatorStatus,
    adaptiveIndicatorTitle,
    lowQualityPreview,
    audioOnlyPreview,
    showGpuMetricsPanel,
    gpuPreviewMetrics,
    gpuTextureMemoryLabel,
    effectivePreviewPerformance,
    adaptivePreviewState,
    previewPerformance,
  } = props;
  const t = zhCN.preview;

  return (
    <>
      <div
        className={`absolute right-3 top-3 z-30 h-3 w-3 rounded-full border border-white/70 shadow ${getAdaptiveQualityIndicatorClass(adaptiveIndicatorStatus)}`}
        title={adaptiveIndicatorTitle}
        data-testid="preview-adaptive-quality-indicator"
        data-status={adaptiveIndicatorStatus}
        data-quality={effectivePreviewPerformance.qualityMode}
        data-fps={adaptivePreviewState.averageFps.toFixed(1)}
        data-adaptive={previewPerformance.adaptiveEnabled === false ? 'false' : 'true'}
      />
      {lowQualityPreview ? (
        <div
          className="pointer-events-none absolute left-3 top-3 z-20 rounded bg-black/60 px-2 py-1 text-xs font-medium text-white"
          data-testid="preview-simplified-effects-hint"
        >
          {audioOnlyPreview ? t.audioOnlyPreview : t.simplifiedEffects}
        </div>
      ) : null}
      {showGpuMetricsPanel ? (
        <div
          className="pointer-events-none absolute bottom-3 right-3 z-30 grid min-w-[196px] gap-1 rounded-md border border-white/15 bg-black/70 px-3 py-2 text-[11px] text-white shadow-soft backdrop-blur"
          data-testid="preview-gpu-metrics-panel"
          data-offscreen-supported={gpuPreviewMetrics.offscreenWorkerSupported ? 'true' : 'false'}
          data-offscreen-active={gpuPreviewMetrics.offscreenWorkerActive ? 'true' : 'false'}
          data-draw-calls={gpuPreviewMetrics.drawCalls}
        >
          <div className="flex items-center gap-2 text-xs font-semibold">
            <Gauge size={14} />
            <span>{t.gpuMetricsTitle}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-white/60">{t.gpuFrameTime}</span>
            <span className="font-mono tabular-nums">{gpuPreviewMetrics.gpuFrameMs.toFixed(1)} ms</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-white/60">{t.gpuTexturePool}</span>
            <span className="font-mono tabular-nums">{gpuTextureMemoryLabel}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-white/60">{t.gpuDrawCalls}</span>
            <span className="font-mono tabular-nums">
              {gpuPreviewMetrics.instancedDrawCalls}/{gpuPreviewMetrics.drawCalls}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-white/60">{t.gpuOffscreenWorker}</span>
            <span className="font-mono tabular-nums">
              {gpuPreviewMetrics.offscreenWorkerSupported ? t.gpuOffscreenReady : t.gpuOffscreenFallback}
            </span>
          </div>
        </div>
      ) : null}
    </>
  );
}

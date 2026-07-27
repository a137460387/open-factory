import {useEffect, useMemo, useRef, useState} from 'react';
import {logger} from '@open-factory/editor-core/utils';
import type {Timeline} from '@open-factory/editor-core';
import {buildTimelineRenderFrameKey, buildTimelineRenderFrameRequests, estimateRenderPassBreakdown, getTimelineRenderInvalidationRanges, getTimelinePlaybackDuration} from '@open-factory/editor-core';
import type {Project} from '@open-factory/editor-core';
import {drawAudioOnlyPreview, countActivePreviewEffects, hasActiveCustomShader, waitForIdleFrame} from '../utils';
import {zhCN} from '../../../i18n/strings';
import {drawPreviewDifferenceFrame} from '../../../lib/preview/compare';
import {PreviewRenderer, type PreviewFrameReadback} from '../../../lib/preview/renderer';
import {DEFAULT_PREVIEW_ADAPTIVE_QUALITY_STATE, appendPreviewFpsSample, calculatePreviewRenderSize, calculatePreviewFpsAverage, getDisabledPreviewEffectTypes, isPreviewAudioOnly, isPreviewLowQuality, resolveAdaptivePreviewPerformance, resolveEffectivePreviewPerformance, shouldRenderPreviewFrame, type PreviewFpsSample, type PreviewPerformanceSettings} from '../../../lib/preview/preview-performance';
import {DEFAULT_GPU_PREVIEW_METRICS, GPU_TEXTURE_POOL_MAX_BYTES, buildGpuPrefetchFrameRequests, detectGpuPreviewCapabilities, formatTextureMemoryMiB, type GpuPreviewMetrics} from '../../../lib/preview/gpu-acceleration';
import {getTimelineRenderCacheController} from '../../../lib/preview/render-cache-controller';
import {showToast} from '../../../lib/toast';
import {useAudioMeterStore} from '../../../store/audioMeterStore';

export interface CanvasRendererParams {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  originalCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  differenceCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  project: Project;
  previewTimeline: Timeline | undefined;
  playheadTime: number;
  isPlaying: boolean;
  playbackRate: number;
  compareEnabled: boolean;
  compareShowsDifference: boolean;
  snapshotCompareProject: Project | undefined;
  scopesOpen: boolean;
  previewPerformance: PreviewPerformanceSettings;
  onProfilerFrame?: (sample: import('@open-factory/editor-core').ProfilerFrameSample) => void;
}

export function useCanvasRenderer(params: CanvasRendererParams) {
  const {
    canvasRef,
    originalCanvasRef,
    differenceCanvasRef,
    project,
    previewTimeline,
    playheadTime,
    isPlaying,
    playbackRate,
    compareEnabled,
    compareShowsDifference,
    snapshotCompareProject,
    scopesOpen,
    previewPerformance,
    onProfilerFrame,
  } = params;

  const t = zhCN.preview;
  const rendererRef = useRef(new PreviewRenderer());
  const originalRendererRef = useRef(new PreviewRenderer());
  const previousTimelineRef = useRef<Timeline | undefined>(undefined);
  const scopeFrameCounterRef = useRef(0);
  const profilerFrameIndexRef = useRef(0);

  const fps = project.settings.fps || 30;
  const prerenderCenter = Math.round(playheadTime * 2) / 2;

  const [scopeFrame, setScopeFrame] = useState<PreviewFrameReadback | undefined>(undefined);
  const [adaptivePreviewState, setAdaptivePreviewState] = useState(DEFAULT_PREVIEW_ADAPTIVE_QUALITY_STATE);
  const [gpuCapabilities, setGpuCapabilities] = useState(() => detectGpuPreviewCapabilities());
  const [gpuPreviewMetrics, setGpuPreviewMetrics] = useState<GpuPreviewMetrics>(DEFAULT_GPU_PREVIEW_METRICS);

  const effectivePreviewPerformance = useMemo<PreviewPerformanceSettings>(
    () => resolveEffectivePreviewPerformance(previewPerformance, adaptivePreviewState),
    [adaptivePreviewState, previewPerformance],
  );
  const previewRenderSize = useMemo(
    () => calculatePreviewRenderSize(1280, 720, effectivePreviewPerformance.qualityMode),
    [effectivePreviewPerformance.qualityMode],
  );
  const previewDisabledEffectTypes = useMemo(
    () => getDisabledPreviewEffectTypes(effectivePreviewPerformance),
    [effectivePreviewPerformance],
  );
  const audioOnlyPreview = isPreviewAudioOnly(effectivePreviewPerformance.qualityMode);
  const lowQualityPreview = isPreviewLowQuality(effectivePreviewPerformance);
  const previewCanvasSizeLabel = t.canvasSize(previewRenderSize.width, previewRenderSize.height);
  const gpuTextureMemoryLabel = t.gpuTextureMemory(
    formatTextureMemoryMiB(gpuPreviewMetrics.textureBytes),
    formatTextureMemoryMiB(GPU_TEXTURE_POOL_MAX_BYTES),
  );

  const resolveGpuMetrics = (metrics?: GpuPreviewMetrics): GpuPreviewMetrics => ({
    ...DEFAULT_GPU_PREVIEW_METRICS,
    ...metrics,
    offscreenWorkerSupported: gpuCapabilities.offscreenCanvasWorkerSupported,
    offscreenWorkerActive: false,
    timerQuerySupported: metrics?.timerQuerySupported ?? gpuCapabilities.timerQuerySupported,
    fallbackReason: metrics?.fallbackReason ?? gpuCapabilities.fallbackReason,
  });

  const emitProfilerFrame = (
    metrics: GpuPreviewMetrics | undefined,
    elapsedMs: number,
    timeline: Timeline,
    cached = false,
  ) => {
    if (!onProfilerFrame) {
      return;
    }
    const safeMetrics = resolveGpuMetrics(metrics);
    const totalMs = Math.max(safeMetrics.gpuFrameMs, Number.isFinite(elapsedMs) ? elapsedMs : 0);
    const effectCount = countActivePreviewEffects(timeline, playheadTime);
    const render = estimateRenderPassBreakdown({
      totalMs,
      drawCalls: safeMetrics.drawCalls,
      effectCount,
      overlayActive: scopesOpen || compareEnabled,
    });
    const customShaderActive = hasActiveCustomShader(timeline, playheadTime);
    const reason = customShaderActive
      ? `custom-shader耗时${render.effectsMs.toFixed(1)}ms`
      : cached
        ? `render-cache耗时${render.compositeMs.toFixed(1)}ms`
        : `WebGL pass耗时${render.totalMs.toFixed(1)}ms`;
    profilerFrameIndexRef.current += 1;
    onProfilerFrame({
      frameIndex: profilerFrameIndexRef.current,
      timestampMs: performance.now(),
      playheadTime,
      render,
      drawCalls: safeMetrics.drawCalls,
      textureBytes: safeMetrics.textureBytes,
      reason,
    });
  };

  // GPU capabilities detection
  useEffect(() => {
    const capabilities = detectGpuPreviewCapabilities(canvasRef.current ?? undefined);
    setGpuCapabilities(capabilities);
    setGpuPreviewMetrics((current) => ({
      ...current,
      offscreenWorkerSupported: capabilities.offscreenCanvasWorkerSupported,
      timerQuerySupported: capabilities.timerQuerySupported,
      fallbackReason: capabilities.fallbackReason,
    }));
  }, []);

  // Adaptive quality measurement
  useEffect(() => {
    if (previewPerformance.adaptiveEnabled === false) {
      return undefined;
    }
    setAdaptivePreviewState(DEFAULT_PREVIEW_ADAPTIVE_QUALITY_STATE);
    let frame = 0;
    let lastSampleAt = performance.now();
    let samples: PreviewFpsSample[] = [];
    let animationFrame = 0;
    const tick = (now: number) => {
      frame += 1;
      const elapsedMs = now - lastSampleAt;
      if (elapsedMs >= 1000) {
        const overrideFps =
          typeof window.__OPEN_FACTORY_PREVIEW_FPS_OVERRIDE__ === 'number'
            ? window.__OPEN_FACTORY_PREVIEW_FPS_OVERRIDE__
            : undefined;
        const measuredFps = overrideFps ?? (frame * 1000) / elapsedMs;
        samples = appendPreviewFpsSample(samples, { timestampMs: now, fps: measuredFps });
        const averageFps = calculatePreviewFpsAverage(samples);
        setAdaptivePreviewState((current) =>
          resolveAdaptivePreviewPerformance({
            averageFps,
            current,
            elapsedMs,
            adaptiveEnabled: previewPerformance.adaptiveEnabled !== false,
          }),
        );
        frame = 0;
        lastSampleAt = now;
      }
      animationFrame = requestAnimationFrame(tick);
    };
    animationFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrame);
  }, [previewPerformance.adaptiveEnabled]);

  // Main render effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const originalCanvas = originalCanvasRef.current;
    const differenceCanvas = differenceCanvasRef.current;
    const timeline = previewTimeline ?? project.timeline;
    const shouldCaptureScopes = scopesOpen && (!isPlaying || scopeFrameCounterRef.current % 4 === 0);
    const shouldCaptureDifference = compareShowsDifference && Boolean(differenceCanvas);
    const frame = Math.max(0, Math.round(playheadTime * fps));
    const shouldRenderVideoFrame =
      !audioOnlyPreview && shouldRenderPreviewFrame(isPlaying, frame, effectivePreviewPerformance.skipFrames);
    const canUseRenderCache = shouldRenderVideoFrame && !previewTimeline && !shouldCaptureScopes && !compareEnabled;
    const frameTime = frame / fps;
    const frameKey = buildTimelineRenderFrameKey({
      timeline,
      media: project.media,
      sequences: project.sequences,
      activeSequenceId: project.activeSequenceId,
      frame,
      fps,
      width: canvas.width,
      height: canvas.height,
      colorPipeline: project.settings.colorPipeline,
    });
    let canceled = false;
    scopeFrameCounterRef.current += 1;
    if (audioOnlyPreview) {
      drawAudioOnlyPreview(canvas, t.audioOnlyPreview);
      if (originalCanvas) {
        drawAudioOnlyPreview(originalCanvas, t.audioOnlyPreview);
      }
      if (differenceCanvas) {
        drawAudioOnlyPreview(differenceCanvas, t.audioOnlyPreview);
      }
    } else if (shouldRenderVideoFrame) {
      void (async () => {
        try {
          if (canUseRenderCache) {
            const cached = await getTimelineRenderCacheController().getFrame(frameKey);
            if (cached) {
              try {
                if (!canceled) {
                  const cachedStartedAt = performance.now();
                  rendererRef.current.drawCachedFrame(canvas, cached);
                  const metrics = resolveGpuMetrics(rendererRef.current.getGpuMetrics());
                  setGpuPreviewMetrics(metrics);
                  emitProfilerFrame(metrics, performance.now() - cachedStartedAt, timeline, true);
                }
              } finally {
                cached.close();
              }
              return;
            }
          }
          const renderStartedAt = performance.now();
          const result = await rendererRef.current.render(canvas, timeline, project.media, playheadTime, {
            captureFrame: shouldCaptureScopes || shouldCaptureDifference,
            disabledEffectTypes: previewDisabledEffectTypes,
            sequences: project.sequences,
            colorPipeline: project.settings.colorPipeline,
          });
          if (canceled) {
            return;
          }
          const metrics = resolveGpuMetrics(result.gpuMetrics);
          setGpuPreviewMetrics(metrics);
          emitProfilerFrame(metrics, performance.now() - renderStartedAt, timeline);
          if (result.frame && shouldCaptureScopes) {
            setScopeFrame(result.frame);
          }
          if (compareEnabled && originalCanvas) {
            const compareProject = snapshotCompareProject ?? project;
            const compareTimeline = snapshotCompareProject?.timeline ?? timeline;
            const originalResult = await originalRendererRef.current.render(
              originalCanvas,
              compareTimeline,
              compareProject.media,
              playheadTime,
              {
                bypassProcessing: !snapshotCompareProject,
                captureFrame: shouldCaptureDifference,
                disabledEffectTypes: previewDisabledEffectTypes,
                sequences: compareProject.sequences,
                colorPipeline: compareProject.settings.colorPipeline,
              },
            );
            if (canceled) {
              return;
            }
            if (shouldCaptureDifference && result.frame && originalResult.frame && differenceCanvas) {
              drawPreviewDifferenceFrame(differenceCanvas, result.frame, originalResult.frame);
            }
          }
          if (canUseRenderCache) {
            const bitmap = await createImageBitmap(canvas);
            getTimelineRenderCacheController().putFrame({
              key: frameKey,
              bitmap,
              time: frameTime,
              duration: 1 / fps,
              bytes: canvas.width * canvas.height * 4,
              playheadTime,
            });
          }
        } catch (error) {
          showToast({
            kind: 'error',
            title: t.renderFailedTitle,
            message: error instanceof Error ? error.message : t.renderFailedMessage,
          });
        }
      })();
    }
    rendererRef.current.syncAudio(
      timeline,
      project.media,
      playheadTime,
      isPlaying && playbackRate > 0,
      project.masterVolume,
      project.mixerState,
    );
    const levels = rendererRef.current.getAudioLevels();
    useAudioMeterStore.getState().setLevels(levels.trackLevels, levels.masterLevel, levels.trackFrequencyBands, levels.trackAnalysisFrames);
    return () => {
      canceled = true;
    };
  }, [
    fps, isPlaying, playbackRate, playheadTime, compareEnabled, compareShowsDifference, previewTimeline,
    project.activeSequenceId, project.masterVolume, project.media, project.sequences,
    project.settings.colorPipeline, project.timeline, onProfilerFrame, scopesOpen,
    snapshotCompareProject, audioOnlyPreview, previewDisabledEffectTypes,
    effectivePreviewPerformance.skipFrames, t,
  ]);

  // Timeline cache invalidation
  useEffect(() => {
    const previous = previousTimelineRef.current;
    if (previous && previous !== project.timeline) {
      getTimelineRenderCacheController().invalidateRanges(
        getTimelineRenderInvalidationRanges(previous, project.timeline),
      );
    }
    previousTimelineRef.current = project.timeline;
  }, [project.timeline]);

  // GPU texture preload
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || audioOnlyPreview) {
      return undefined;
    }
    let canceled = false;
    const media = project.media.filter((asset) => !asset.missing && (asset.type === 'video' || asset.type === 'image'));
    void (async () => {
      for (const asset of media) {
        if (canceled) break;
        await rendererRef.current.preloadMediaTexture(canvas, asset);
        await waitForIdleFrame();
      }
      if (!canceled) {
        setGpuPreviewMetrics(resolveGpuMetrics(rendererRef.current.getGpuMetrics()));
      }
    })().catch((error) => {
      logger.error('PreviewCanvas', error);
    });
    return () => { canceled = true; };
  }, [audioOnlyPreview, project.media, previewRenderSize.height, previewRenderSize.width]);

  // Prerender cache
  useEffect(() => {
    if (previewTimeline) return undefined;
    let canceled = false;
    const timer = window.setTimeout(() => {
      const duration = getTimelinePlaybackDuration(project.timeline);
      const canvas = document.createElement('canvas');
      canvas.width = 1280;
      canvas.height = 720;
      const renderer = new PreviewRenderer();
      const requestInput = {
        timeline: project.timeline,
        media: project.media,
        sequences: project.sequences,
        activeSequenceId: project.activeSequenceId,
        colorPipeline: project.settings.colorPipeline,
        playheadTime: prerenderCenter,
        duration, fps,
        width: canvas.width,
        height: canvas.height,
      };
      const requests = isPlaying
        ? buildGpuPrefetchFrameRequests(requestInput)
        : buildTimelineRenderFrameRequests(requestInput);
      void (async () => {
        for (const request of requests) {
          if (canceled) break;
          const cached = await getTimelineRenderCacheController().getFrame(request.key);
          if (cached) { cached.close(); continue; }
          await renderer.render(canvas, project.timeline, project.media, request.time, {
            sequences: project.sequences,
            colorPipeline: project.settings.colorPipeline,
          });
          if (canceled) break;
          const bitmap = await createImageBitmap(canvas);
          getTimelineRenderCacheController().putFrame({
            key: request.key, bitmap, time: request.time,
            duration: 1 / fps, bytes: canvas.width * canvas.height * 4,
            playheadTime: prerenderCenter,
          });
          await waitForIdleFrame();
        }
      })().catch((error) => { logger.error('PreviewCanvas', error); });
    }, 80);
    return () => { canceled = true; window.clearTimeout(timer); };
  }, [fps, isPlaying, prerenderCenter, previewTimeline, project.activeSequenceId, project.media, project.sequences, project.settings.colorPipeline, project.timeline]);

  // Render cache retain
  useEffect(() => {
    getTimelineRenderCacheController().retainAround(playheadTime);
  }, [playheadTime]);

  // Playback loop
  useEffect(() => {
    if (!isPlaying) {
      rendererRef.current.pauseAllAudio();
      useAudioMeterStore.getState().resetLevels();
      return undefined;
    }
    let frame = 0;
    let last = performance.now();
    const duration = getTimelinePlaybackDuration(project.timeline);
    const tick = (now: number) => {
      const delta = (now - last) / 1000;
      last = now;
      const next = useEditorStore.getState().playheadTime + delta * playbackRate;
      if (playbackRate < 0 && next <= 0) {
        useEditorStore.getState().setPlayheadTime(0);
        useEditorStore.getState().setIsPlaying(false);
        return;
      }
      if (duration > 0 && next >= duration) {
        useEditorStore.getState().setPlayheadTime(duration);
        useEditorStore.getState().setIsPlaying(false);
        return;
      }
      useEditorStore.getState().setPlayheadTime(next);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isPlaying, playbackRate, project.timeline]);

  return {
    rendererRef,
    scopeFrame,
    adaptivePreviewState,
    gpuCapabilities,
    gpuPreviewMetrics,
    effectivePreviewPerformance,
    previewRenderSize,
    previewDisabledEffectTypes,
    audioOnlyPreview,
    lowQualityPreview,
    previewCanvasSizeLabel,
    gpuTextureMemoryLabel,
    setGpuPreviewMetrics,
  };
}

import {useEditorStore} from '../../../store/editorStore';

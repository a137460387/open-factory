import type {
  Clip,
  Effect,
  EffectType,
  MediaAsset,
  MixerState,
  ProjectColorPipeline,
  Sequence,
  Timeline,
} from '@open-factory/editor-core';
import {
  DEFAULT_COLOR_CORRECTION,
  DEFAULT_TRANSFORM,
  normalizeColorCorrection,
  getEffectNumberParam,
  getTimelinePlaybackDuration,
} from '@open-factory/editor-core';
import { PreviewAudioRenderer } from './audio-renderer';
import { drawAudioSpectrumToCanvas } from './audio-spectrum-renderer';
import { recordPreviewError, recordPreviewGpuMetrics, recordPreviewMode, recordPreviewReadback } from './debug';
import type { GpuPreviewMetrics } from './gpu-acceleration';
import { HardwareDecodeManager } from './hw-decode-manager';
import { drawImage2d, drawImage2dBypass, drawImageWebGl } from './image-renderer';
import { createVideoElement, loadImage, loadThumbnail, seekVideo } from './media-elements';
import {
  drawCreditsRoll2d,
  drawCreditsRollWebGl,
  drawMissing2d,
  drawMissingWebGl,
  drawText2d,
  drawTextWebGl,
} from './text-renderer';
import { getTransitionAwareClipInstances, withCanvasKeyframedPosition } from './transition-clip-helpers';
import { drawVideo2d, drawVideoWebGl } from './video-renderer';
import { drawTransformedSource2d } from './transform-2d';
import { WebGlPreviewCompositor } from './webgl-compositor';

export interface PreviewRenderOptions {
  captureFrame?: boolean;
  bypassProcessing?: boolean;
  disabledEffectTypes?: EffectType[];
  colorPipeline?: ProjectColorPipeline;
  sequences?: Sequence[];
  depth?: number;
}

export interface PreviewFrameReadback {
  width: number;
  height: number;
  data: Uint8Array | Uint8ClampedArray;
  origin: 'top-left' | 'bottom-left';
}

export interface PreviewRenderResult {
  frame?: PreviewFrameReadback;
  gpuMetrics?: GpuPreviewMetrics;
}

export class PreviewRenderer {
  private videos = new Map<string, HTMLVideoElement>();
  private webgl?: WebGlPreviewCompositor | null;
  private renderToken = 0;
  private readonly audioRenderer = new PreviewAudioRenderer();
  private hwDecodeManager: HardwareDecodeManager | null = null;
  private hwDecodeEnabled = false;

  async render(
    canvas: HTMLCanvasElement,
    timeline: Timeline,
    media: MediaAsset[],
    playheadTime: number,
    options: PreviewRenderOptions = {},
  ): Promise<PreviewRenderResult> {
    const token = ++this.renderToken;
    const mediaById = new Map(media.map((asset) => [asset.id, asset]));
    const sequenceById = new Map((options.sequences ?? []).map((sequence) => [sequence.id, sequence]));
    const depth = options.depth ?? 0;
    const bypassProcessing = options.bypassProcessing === true;
    const disabledEffectTypes = options.disabledEffectTypes ?? [];
    const colorPipeline = options.colorPipeline;
    const visibleClips = getTransitionAwareClipInstances(timeline, playheadTime);
    const webgl = this.getWebGl(canvas);

    if (webgl) {
      recordPreviewMode('webgl');
      webgl.begin(canvas.width, canvas.height);
      for (const { clip, playheadTime: clipPlayheadTime } of visibleClips) {
        if (token !== this.renderToken) {
          return {};
        }
        await this.drawClipWebGl(
          webgl,
          clip,
          mediaById,
          sequenceById,
          media,
          clipPlayheadTime,
          canvas.width,
          canvas.height,
          depth,
          bypassProcessing,
          disabledEffectTypes,
          colorPipeline,
        );
      }
      if (!bypassProcessing) {
        this.drawAudioSpectrumWebGl(webgl, timeline, playheadTime, canvas.width, canvas.height);
      }
      webgl.finish();
      const gpuMetrics = webgl.getMetrics();
      recordPreviewGpuMetrics(gpuMetrics);
      recordPreviewReadback(webgl.readCenterPixel());
      return { frame: options.captureFrame ? readWebGlFrameSafely(webgl) : undefined, gpuMetrics };
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return {};
    }
    recordPreviewMode('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#141820';
    context.fillRect(0, 0, canvas.width, canvas.height);

    for (const { clip, playheadTime: clipPlayheadTime } of visibleClips) {
      if (token !== this.renderToken) {
        return {};
      }
      await this.drawClip2d(
        context,
        canvas,
        clip,
        mediaById,
        sequenceById,
        media,
        clipPlayheadTime,
        depth,
        bypassProcessing,
        disabledEffectTypes,
      );
    }
    if (!bypassProcessing) {
      this.drawAudioSpectrum2d(context, timeline, playheadTime, canvas.width, canvas.height);
    }
    try {
      recordPreviewReadback(
        Array.from(context.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data),
      );
    } catch (error) {
      recordPreviewReadback(undefined, error instanceof Error ? error.message : String(error));
    }
    return { frame: options.captureFrame ? read2dFrameSafely(context, canvas) : undefined };
  }

  syncAudio(
    timeline: Timeline,
    media: MediaAsset[],
    playheadTime: number,
    isPlaying: boolean,
    masterVolume = 1,
    mixerState?: MixerState,
  ): void {
    this.audioRenderer.syncAudio(timeline, media, playheadTime, isPlaying, masterVolume, mixerState);
  }

  getAudioLevels(nowMs = performance.now()) {
    return this.audioRenderer.getLevels(nowMs);
  }

  drawCachedFrame(canvas: HTMLCanvasElement, bitmap: ImageBitmap): void {
    const webgl = this.getWebGl(canvas);
    if (webgl) {
      recordPreviewMode('webgl');
      webgl.begin(canvas.width, canvas.height);
      webgl.drawSource(bitmap, bitmap.width, bitmap.height, DEFAULT_TRANSFORM);
      webgl.finish();
      recordPreviewGpuMetrics(webgl.getMetrics());
      return;
    }
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }
    recordPreviewMode('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#141820';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  }

  pauseAllAudio(): void {
    this.audioRenderer.pauseAllAudio();
  }

  /**
   * 启用硬件加速解码
   */
  async enableHardwareDecode(options: { path: string; preferredBackend?: string }): Promise<boolean> {
    try {
      if (!this.hwDecodeManager) {
        this.hwDecodeManager = new HardwareDecodeManager();
      }
      const hasHw = await this.hwDecodeManager.hasHardwareAcceleration();
      if (!hasHw) {
        return false;
      }
      await this.hwDecodeManager.initialize({
        path: options.path,
        preferredBackend: options.preferredBackend as never,
      });
      this.hwDecodeEnabled = true;
      return true;
    } catch (error) {
      recordPreviewError(error instanceof Error ? error.message : 'Failed to enable hardware decode.');
      this.hwDecodeEnabled = false;
      return false;
    }
  }

  /**
   * 禁用硬件加速解码
   */
  async disableHardwareDecode(): Promise<void> {
    this.hwDecodeEnabled = false;
    if (this.hwDecodeManager) {
      await this.hwDecodeManager.release();
    }
  }

  /**
   * 获取当前硬件解码管理器
   */
  getHardwareDecodeManager(): HardwareDecodeManager | null {
    return this.hwDecodeManager;
  }

  /**
   * 检查硬件解码是否启用
   */
  isHardwareDecodeEnabled(): boolean {
    return this.hwDecodeEnabled && this.hwDecodeManager?.isInitialized() === true;
  }

  async preloadMediaTexture(canvas: HTMLCanvasElement, asset: MediaAsset): Promise<boolean> {
    if (asset.missing || (asset.type !== 'video' && asset.type !== 'image')) {
      return false;
    }
    const webgl = this.getWebGl(canvas);
    if (!webgl) {
      return false;
    }
    const width = asset.width || 1280;
    const height = asset.height || 720;
    try {
      if (asset.type === 'image') {
        const image = await loadImage(asset);
        return webgl.preloadSourceTexture(image, width, height, asset.path);
      }
      const video = this.getVideo(asset);
      await seekVideo(video, 0);
      return webgl.preloadSourceTexture(video, width, height, asset.path);
    } catch (error) {
      recordPreviewError(error instanceof Error ? error.message : 'GPU texture preload failed.');
      const fallback = await loadThumbnail(asset);
      return fallback ? webgl.preloadSourceTexture(fallback, width, height, `${asset.path}:thumbnail`) : false;
    }
  }

  getGpuMetrics(): GpuPreviewMetrics | undefined {
    return this.webgl?.getMetrics() ?? undefined;
  }

  getDuration(timeline: Timeline): number {
    return getTimelinePlaybackDuration(timeline);
  }

  private async drawClipWebGl(
    compositor: WebGlPreviewCompositor,
    clip: Clip,
    mediaById: Map<string, MediaAsset>,
    sequenceById: Map<string, Sequence>,
    media: MediaAsset[],
    playheadTime: number,
    canvasWidth: number,
    canvasHeight: number,
    depth: number,
    bypassProcessing: boolean,
    disabledEffectTypes: EffectType[],
    colorPipeline?: ProjectColorPipeline,
  ): Promise<void> {
    const renderClip = withCanvasKeyframedPosition(clip, canvasWidth, canvasHeight);
    if (renderClip.type === 'adjustment') {
      if (!bypassProcessing) {
        if (renderClip.colorNodeGraph) {
          compositor.applyColorNodeGraph(renderClip.colorNodeGraph, renderClip.colorCorrection, renderClip.effects, {
            disabledEffectTypes,
            colorPipeline,
          });
        } else {
          compositor.applyAdjustmentLayer(renderClip.colorCorrection, renderClip.effects, {
            disabledEffectTypes,
            colorPipeline,
          });
        }
      }
      return;
    }
    if (renderClip.type === 'nested-sequence') {
      const nested = await this.renderNestedCanvas(
        renderClip,
        sequenceById,
        media,
        playheadTime,
        canvasWidth,
        canvasHeight,
        depth,
        bypassProcessing,
        disabledEffectTypes,
        colorPipeline,
      );
      if (!nested) {
        drawMissingWebGl(compositor, renderClip.name, renderClip.type);
        return;
      }
      compositor.drawSourceWithColorNodeGraph(
        nested,
        canvasWidth,
        canvasHeight,
        renderClip.transform,
        renderClip.colorNodeGraph,
        renderClip.colorCorrection,
        renderClip.effects,
        renderClip.chromaKey,
        renderClip.masks,
        {
          bypassProcessing,
          disabledEffectTypes,
          colorPipeline,
          blendMode: renderClip.blendMode,
        },
      );
      return;
    }
    if (renderClip.type === 'video') {
      const asset = mediaById.get(renderClip.mediaId);
      if (!asset || asset.missing) {
        drawMissingWebGl(compositor, renderClip.name, renderClip.type);
        return;
      }
      await drawVideoWebGl(
        compositor,
        renderClip,
        asset,
        this.getVideo(asset),
        playheadTime,
        seekVideo,
        loadThumbnail,
        bypassProcessing,
        disabledEffectTypes,
        colorPipeline,
        this.hwDecodeEnabled ? this.hwDecodeManager : null,
      );
      return;
    }

    if (renderClip.type === 'image') {
      const asset = mediaById.get(renderClip.mediaId);
      if (!asset || asset.missing) {
        drawMissingWebGl(compositor, renderClip.name, renderClip.type);
        return;
      }
      drawImageWebGl(
        compositor,
        renderClip,
        asset,
        await loadImage(asset),
        bypassProcessing,
        disabledEffectTypes,
        colorPipeline,
      );
      return;
    }

    if (renderClip.type === 'credits') {
      drawCreditsRollWebGl(
        compositor,
        renderClip,
        canvasWidth,
        canvasHeight,
        bypassProcessing,
        Math.max(0, playheadTime - renderClip.start),
        colorPipeline,
      );
      return;
    }

    if (renderClip.type === 'text' || renderClip.type === 'subtitle') {
      drawTextWebGl(
        compositor,
        renderClip,
        bypassProcessing,
        colorPipeline,
        Math.max(0, playheadTime - renderClip.start),
      );
    }
  }

  private async drawClip2d(
    context: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    clip: Clip,
    mediaById: Map<string, MediaAsset>,
    sequenceById: Map<string, Sequence>,
    media: MediaAsset[],
    playheadTime: number,
    depth: number,
    bypassProcessing: boolean,
    disabledEffectTypes: EffectType[],
  ): Promise<void> {
    const renderClip = withCanvasKeyframedPosition(clip, canvas.width, canvas.height);
    if (renderClip.type === 'adjustment') {
      if (!bypassProcessing) {
        applyAdjustmentLayer2d(context, canvas, renderClip.colorCorrection, renderClip.effects);
      }
      return;
    }
    if (renderClip.type === 'nested-sequence') {
      const nested = await this.renderNestedCanvas(
        renderClip,
        sequenceById,
        media,
        playheadTime,
        canvas.width,
        canvas.height,
        depth,
        bypassProcessing,
        disabledEffectTypes,
      );
      if (!nested) {
        drawMissing2d(context, canvas, renderClip.name, renderClip.type);
        return;
      }
      drawTransformedSource2d(
        context,
        canvas,
        nested,
        { width: canvas.width, height: canvas.height },
        renderClip.transform,
        bypassProcessing ? undefined : renderClip.colorCorrection,
      );
      return;
    }
    if (renderClip.type === 'video') {
      const asset = mediaById.get(renderClip.mediaId);
      if (!asset || asset.missing) {
        drawMissing2d(context, canvas, renderClip.name, renderClip.type);
        return;
      }
      await drawVideo2d(
        context,
        canvas,
        renderClip,
        asset,
        this.getVideo(asset),
        playheadTime,
        seekVideo,
        loadThumbnail,
        bypassProcessing,
        disabledEffectTypes,
        this.hwDecodeEnabled ? this.hwDecodeManager : null,
      );
      return;
    }

    if (renderClip.type === 'image') {
      const asset = mediaById.get(renderClip.mediaId);
      if (!asset || asset.missing) {
        drawMissing2d(context, canvas, renderClip.name, renderClip.type);
        return;
      }
      if (bypassProcessing) {
        drawImage2dBypass(context, canvas, renderClip, asset, await loadImage(asset));
      } else {
        drawImage2d(context, canvas, renderClip, asset, await loadImage(asset));
      }
      return;
    }

    if (renderClip.type === 'credits') {
      drawCreditsRoll2d(context, canvas, renderClip, bypassProcessing, Math.max(0, playheadTime - renderClip.start));
      return;
    }

    if (renderClip.type === 'text' || renderClip.type === 'subtitle') {
      drawText2d(context, canvas, renderClip, bypassProcessing, Math.max(0, playheadTime - renderClip.start));
    }
  }

  private async renderNestedCanvas(
    clip: Extract<Clip, { type: 'nested-sequence' }>,
    sequenceById: Map<string, Sequence>,
    media: MediaAsset[],
    playheadTime: number,
    width: number,
    height: number,
    depth: number,
    bypassProcessing: boolean,
    disabledEffectTypes: EffectType[],
    colorPipeline?: ProjectColorPipeline,
  ): Promise<HTMLCanvasElement | undefined> {
    if (depth >= 3) {
      return undefined;
    }
    const sequence = sequenceById.get(clip.sequenceId);
    if (!sequence) {
      return undefined;
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const localTime = Math.max(0, playheadTime - clip.start + clip.trimStart);
    await new PreviewRenderer().render(canvas, sequence.timeline, media, localTime, {
      sequences: Array.from(sequenceById.values()),
      depth: depth + 1,
      bypassProcessing,
      disabledEffectTypes,
      colorPipeline,
    });
    return canvas;
  }

  private getVideo(asset: MediaAsset): HTMLVideoElement {
    const existing = this.videos.get(asset.id);
    if (existing) {
      return existing;
    }
    const video = createVideoElement(asset);
    this.videos.set(asset.id, video);
    return video;
  }

  private getWebGl(canvas: HTMLCanvasElement): WebGlPreviewCompositor | null {
    if (this.webgl !== undefined) {
      return this.webgl;
    }
    try {
      this.webgl = new WebGlPreviewCompositor(canvas);
    } catch (error) {
      recordPreviewError(error instanceof Error ? error.message : String(error));
      this.webgl = null;
    }
    return this.webgl;
  }

  private drawAudioSpectrumWebGl(
    compositor: WebGlPreviewCompositor,
    timeline: Timeline,
    playheadTime: number,
    width: number,
    height: number,
  ): void {
    const overlay = drawAudioSpectrumToCanvas(timeline, playheadTime, width, height, (kind) =>
      this.audioRenderer.readAnalysisFrame(kind),
    );
    if (!overlay) {
      return;
    }
    compositor.drawSource(overlay, width, height, DEFAULT_TRANSFORM, undefined, undefined, undefined, undefined, {
      bypassProcessing: true,
    });
  }

  private drawAudioSpectrum2d(
    context: CanvasRenderingContext2D,
    timeline: Timeline,
    playheadTime: number,
    width: number,
    height: number,
  ): void {
    const overlay = drawAudioSpectrumToCanvas(timeline, playheadTime, width, height, (kind) =>
      this.audioRenderer.readAnalysisFrame(kind),
    );
    if (!overlay) {
      return;
    }
    context.drawImage(overlay, 0, 0, width, height);
  }
}

function readWebGlFrameSafely(webgl: WebGlPreviewCompositor): PreviewFrameReadback | undefined {
  try {
    const frame = webgl.readFramePixels();
    return frame.data.length > 0 ? { ...frame, origin: 'bottom-left' } : undefined;
  } catch {
    return undefined;
  }
}

function read2dFrameSafely(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
): PreviewFrameReadback | undefined {
  try {
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    return image.data.length > 0
      ? { width: canvas.width, height: canvas.height, data: image.data, origin: 'top-left' }
      : undefined;
  } catch {
    return undefined;
  }
}

function applyAdjustmentLayer2d(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  colorCorrection: Clip['colorCorrection'],
  effects: Effect[] | undefined,
): void {
  const snapshot = document.createElement('canvas');
  snapshot.width = canvas.width;
  snapshot.height = canvas.height;
  const snapshotContext = snapshot.getContext('2d');
  if (!snapshotContext) {
    return;
  }
  snapshotContext.drawImage(canvas, 0, 0);
  const previousFilter = context.filter;
  context.save();
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.filter = buildAdjustmentCanvasFilter(colorCorrection, effects);
  context.drawImage(snapshot, 0, 0);
  context.filter = previousFilter;
  context.restore();
}

function buildAdjustmentCanvasFilter(colorCorrection: Clip['colorCorrection'], effects: Effect[] | undefined): string {
  const correction = normalizeColorCorrection(colorCorrection ?? DEFAULT_COLOR_CORRECTION);
  const filters = [
    `brightness(${Math.max(0, 1 + correction.brightness)})`,
    `contrast(${correction.contrast})`,
    `saturate(${correction.saturation})`,
    `hue-rotate(${correction.hue}deg)`,
  ];
  for (const effect of effects ?? []) {
    if (!effect.enabled) {
      continue;
    }
    if (effect.type === 'blur') {
      filters.push(`blur(${getEffectNumberParam(effect.params, 'radius', 8)}px)`);
    }
  }
  return filters.join(' ');
}

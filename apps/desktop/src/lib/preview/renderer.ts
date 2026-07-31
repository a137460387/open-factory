import type {
  Clip,
  EffectType,
  MediaAsset,
  MixerState,
  ProjectColorPipeline,
  Sequence,
  Timeline,
} from '@open-factory/editor-core';
import {
  DEFAULT_TRANSFORM,
  getTimelinePlaybackDuration,
} from '@open-factory/editor-core';
import { PreviewAudioRenderer } from './audio-renderer';
import { drawAudioSpectrumToCanvas } from './audio-spectrum-renderer';
import {
  drawClip2d,
  drawClipWebGl,
  readWebGlFrameSafely,
  read2dFrameSafely,
} from './clip-renderer';
import { recordPreviewError, recordPreviewGpuMetrics, recordPreviewMode, recordPreviewReadback } from './debug';
import type { GpuPreviewMetrics } from './gpu-acceleration';
import { HardwareDecodeManager } from './hw-decode-manager';
import { createVideoElement, loadImage, loadThumbnail, seekVideo } from './media-elements';
import { getTransitionAwareClipInstances } from './transition-clip-helpers';
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
        await drawClipWebGl(
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
          this.hwDecodeEnabled,
          this.hwDecodeManager,
          (asset) => this.getVideo(asset),
          this,
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
      await drawClip2d(
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
        this.hwDecodeEnabled,
        this.hwDecodeManager,
        (asset) => this.getVideo(asset),
        this,
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

  async disableHardwareDecode(): Promise<void> {
    this.hwDecodeEnabled = false;
    if (this.hwDecodeManager) {
      await this.hwDecodeManager.release();
    }
  }

  getHardwareDecodeManager(): HardwareDecodeManager | null {
    return this.hwDecodeManager;
  }

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

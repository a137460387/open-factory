import type { Clip, MediaAsset, Sequence, Timeline, Transition } from '@open-factory/editor-core';
import { applyClipKeyframes, getClipPlaybackStart, getRenderableTracks, getTimelinePlaybackDuration, getTransitionPlaybackWindow } from '@open-factory/editor-core';
import { DEFAULT_TRANSFORM } from '@open-factory/editor-core';
import { PreviewAudioRenderer } from './audio-renderer';
import { recordPreviewError, recordPreviewMode, recordPreviewReadback } from './debug';
import { drawImage2d, drawImageWebGl } from './image-renderer';
import { createVideoElement, loadImage, loadThumbnail, seekVideo } from './media-elements';
import { drawMissing2d, drawMissingWebGl, drawText2d, drawTextWebGl } from './text-renderer';
import { drawVideo2d, drawVideoWebGl } from './video-renderer';
import { drawTransformedSource2d } from './transform-2d';
import { WebGlPreviewCompositor } from './webgl-compositor';

export interface PreviewRenderOptions {
  captureFrame?: boolean;
  sequences?: Sequence[];
  depth?: number;
}

export interface PreviewFrameReadback {
  width: number;
  height: number;
  data: Uint8Array | Uint8ClampedArray;
}

export interface PreviewRenderResult {
  frame?: PreviewFrameReadback;
}

export class PreviewRenderer {
  private videos = new Map<string, HTMLVideoElement>();
  private webgl?: WebGlPreviewCompositor | null;
  private renderToken = 0;
  private readonly audioRenderer = new PreviewAudioRenderer();

  async render(
    canvas: HTMLCanvasElement,
    timeline: Timeline,
    media: MediaAsset[],
    playheadTime: number,
    options: PreviewRenderOptions = {}
  ): Promise<PreviewRenderResult> {
    const token = ++this.renderToken;
    const mediaById = new Map(media.map((asset) => [asset.id, asset]));
    const sequenceById = new Map((options.sequences ?? []).map((sequence) => [sequence.id, sequence]));
    const depth = options.depth ?? 0;
    const visibleClips = getTransitionAwareClipInstances(timeline, playheadTime);
    const webgl = this.getWebGl(canvas);

    if (webgl) {
      recordPreviewMode('webgl');
      webgl.begin(canvas.width, canvas.height);
      for (const { clip, playheadTime: clipPlayheadTime } of visibleClips) {
        if (token !== this.renderToken) {
          return {};
        }
        await this.drawClipWebGl(webgl, clip, mediaById, sequenceById, media, clipPlayheadTime, canvas.width, canvas.height, depth);
      }
      webgl.finish();
      recordPreviewReadback(webgl.readCenterPixel());
      return { frame: options.captureFrame ? readWebGlFrameSafely(webgl) : undefined };
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
      await this.drawClip2d(context, canvas, clip, mediaById, sequenceById, media, clipPlayheadTime, depth);
    }
    try {
      recordPreviewReadback(Array.from(context.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data));
    } catch (error) {
      recordPreviewReadback(undefined, error instanceof Error ? error.message : String(error));
    }
    return { frame: options.captureFrame ? read2dFrameSafely(context, canvas) : undefined };
  }

  syncAudio(timeline: Timeline, media: MediaAsset[], playheadTime: number, isPlaying: boolean, masterVolume = 1): void {
    this.audioRenderer.syncAudio(timeline, media, playheadTime, isPlaying, masterVolume);
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
    depth: number
  ): Promise<void> {
    const renderClip = withCanvasKeyframedPosition(clip, canvasWidth, canvasHeight);
    if (renderClip.type === 'nested-sequence') {
      const nested = await this.renderNestedCanvas(renderClip, sequenceById, media, playheadTime, canvasWidth, canvasHeight, depth);
      if (!nested) {
        drawMissingWebGl(compositor, renderClip.name, renderClip.type);
        return;
      }
      compositor.drawSource(nested, canvasWidth, canvasHeight, renderClip.transform, renderClip.colorCorrection, renderClip.effects, renderClip.chromaKey, renderClip.masks);
      return;
    }
    if (renderClip.type === 'video') {
      const asset = mediaById.get(renderClip.mediaId);
      if (!asset || asset.missing) {
        drawMissingWebGl(compositor, renderClip.name, renderClip.type);
        return;
      }
      await drawVideoWebGl(compositor, renderClip, asset, this.getVideo(asset), playheadTime, seekVideo, loadThumbnail);
      return;
    }

    if (renderClip.type === 'image') {
      const asset = mediaById.get(renderClip.mediaId);
      if (!asset || asset.missing) {
        drawMissingWebGl(compositor, renderClip.name, renderClip.type);
        return;
      }
      drawImageWebGl(compositor, renderClip, asset, await loadImage(asset));
      return;
    }

    if (renderClip.type === 'text' || renderClip.type === 'subtitle') {
      drawTextWebGl(compositor, renderClip);
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
    depth: number
  ): Promise<void> {
    const renderClip = withCanvasKeyframedPosition(clip, canvas.width, canvas.height);
    if (renderClip.type === 'nested-sequence') {
      const nested = await this.renderNestedCanvas(renderClip, sequenceById, media, playheadTime, canvas.width, canvas.height, depth);
      if (!nested) {
        drawMissing2d(context, canvas, renderClip.name, renderClip.type);
        return;
      }
      drawTransformedSource2d(context, canvas, nested, { width: canvas.width, height: canvas.height }, renderClip.transform, renderClip.colorCorrection);
      return;
    }
    if (renderClip.type === 'video') {
      const asset = mediaById.get(renderClip.mediaId);
      if (!asset || asset.missing) {
        drawMissing2d(context, canvas, renderClip.name, renderClip.type);
        return;
      }
      await drawVideo2d(context, canvas, renderClip, asset, this.getVideo(asset), playheadTime, seekVideo, loadThumbnail);
      return;
    }

    if (renderClip.type === 'image') {
      const asset = mediaById.get(renderClip.mediaId);
      if (!asset || asset.missing) {
        drawMissing2d(context, canvas, renderClip.name, renderClip.type);
        return;
      }
      drawImage2d(context, canvas, renderClip, asset, await loadImage(asset));
      return;
    }

    if (renderClip.type === 'text' || renderClip.type === 'subtitle') {
      drawText2d(context, canvas, renderClip);
    }
  }

  private async renderNestedCanvas(
    clip: Extract<Clip, { type: 'nested-sequence' }>,
    sequenceById: Map<string, Sequence>,
    media: MediaAsset[],
    playheadTime: number,
    width: number,
    height: number,
    depth: number
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
    await new PreviewRenderer().render(canvas, sequence.timeline, media, localTime, { sequences: Array.from(sequenceById.values()), depth: depth + 1 });
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
}

function readWebGlFrameSafely(webgl: WebGlPreviewCompositor): PreviewFrameReadback | undefined {
  try {
    const frame = webgl.readFramePixels();
    return frame.data.length > 0 ? frame : undefined;
  } catch {
    return undefined;
  }
}

function read2dFrameSafely(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement): PreviewFrameReadback | undefined {
  try {
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    return image.data.length > 0 ? { width: canvas.width, height: canvas.height, data: image.data } : undefined;
  } catch {
    return undefined;
  }
}

interface ClipRenderInstance {
  clip: Clip;
  playheadTime: number;
  trackIndex: number;
  start: number;
}

function getTransitionAwareClipInstances(timeline: Timeline, playheadTime: number): ClipRenderInstance[] {
  const windows = (timeline.transitions ?? [])
    .map((transition) => ({ transition, window: getTransitionPlaybackWindow(timeline, transition) }))
    .filter((item): item is { transition: Transition; window: NonNullable<ReturnType<typeof getTransitionPlaybackWindow>> } => Boolean(item.window));

  return getRenderableTracks(timeline)
    .flatMap((track, trackIndex) =>
      track.clips.map((clip) => {
        const playbackStart = getClipPlaybackStart(timeline, clip.id) ?? clip.start;
        return {
          clip,
          playbackStart,
          playbackEnd: playbackStart + clip.duration,
          trackIndex
        };
      })
    )
    .filter((item) => playheadTime >= item.playbackStart && playheadTime < item.playbackEnd)
    .map((item) => {
      const localTime = playheadTime - item.playbackStart;
      const animatedClip = applyClipKeyframes(item.clip, localTime);
      const opacity = getTransitionOpacity(windows, item.clip.id, playheadTime);
      const clip = opacity >= 0.999 ? animatedClip : withOpacity(animatedClip, opacity);
      return {
        clip,
        playheadTime: item.clip.start + localTime,
        trackIndex: item.trackIndex,
        start: item.playbackStart
      };
    })
    .filter((item) => item.clip.transform.opacity > 0.001)
    .sort((left, right) => left.trackIndex - right.trackIndex || left.start - right.start || left.clip.id.localeCompare(right.clip.id));
}

function getTransitionOpacity(
  windows: Array<{ transition: Transition; window: NonNullable<ReturnType<typeof getTransitionPlaybackWindow>> }>,
  clipId: string,
  playheadTime: number
): number {
  const active = windows.find(
    ({ window }) => playheadTime >= window.start && playheadTime < window.end && (window.fromClip.id === clipId || window.toClip.id === clipId)
  );
  if (!active) {
    return 1;
  }
  const progress = Math.min(1, Math.max(0, (playheadTime - active.window.start) / active.window.duration));
  if (active.transition.type === 'fade-black') {
    if (clipId === active.window.fromClip.id) {
      return progress < 0.5 ? 1 - progress * 2 : 0;
    }
    return progress > 0.5 ? (progress - 0.5) * 2 : 0;
  }
  return clipId === active.window.fromClip.id ? 1 - progress : progress;
}

function withOpacity<TClip extends Clip>(clip: TClip, opacity: number): TClip {
  return {
    ...clip,
    transform: {
      ...clip.transform,
      opacity: clip.transform.opacity * Math.max(0, Math.min(1, opacity))
    }
  };
}

function withCanvasKeyframedPosition<TClip extends Clip>(clip: TClip, canvasWidth: number, canvasHeight: number): TClip {
  if (!clip.keyframes?.x && !clip.keyframes?.y) {
    return clip;
  }
  return {
    ...clip,
    transform: {
      ...clip.transform,
      x: clip.keyframes?.x ? clip.transform.x * (canvasWidth / 2) : clip.transform.x,
      y: clip.keyframes?.y ? clip.transform.y * (canvasHeight / 2) : clip.transform.y
    }
  } as TClip;
}

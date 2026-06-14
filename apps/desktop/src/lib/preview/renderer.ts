import type { AudioSpectrumParams, Clip, Effect, MediaAsset, Sequence, Timeline, Transition } from '@open-factory/editor-core';
import {
  DEFAULT_COLOR_CORRECTION,
  DEFAULT_TRANSFORM,
  applyClipKeyframes,
  getActiveClipsAtTime,
  getClipPlaybackStart,
  getEffectNumberParam,
  getRenderableTracks,
  getTimelinePlaybackDuration,
  getTransitionPlaybackWindow,
  normalizeAudioSpectrumParams,
  normalizeColorCorrection
} from '@open-factory/editor-core';
import { PreviewAudioRenderer } from './audio-renderer';
import { recordPreviewError, recordPreviewMode, recordPreviewReadback } from './debug';
import { drawImage2d, drawImage2dBypass, drawImageWebGl } from './image-renderer';
import { createVideoElement, loadImage, loadThumbnail, seekVideo } from './media-elements';
import { drawMissing2d, drawMissingWebGl, drawText2d, drawTextWebGl } from './text-renderer';
import { drawVideo2d, drawVideoWebGl } from './video-renderer';
import { drawTransformedSource2d } from './transform-2d';
import { WebGlPreviewCompositor } from './webgl-compositor';

export interface PreviewRenderOptions {
  captureFrame?: boolean;
  bypassProcessing?: boolean;
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
    const bypassProcessing = options.bypassProcessing === true;
    const visibleClips = getTransitionAwareClipInstances(timeline, playheadTime);
    const webgl = this.getWebGl(canvas);

    if (webgl) {
      recordPreviewMode('webgl');
      webgl.begin(canvas.width, canvas.height);
      for (const { clip, playheadTime: clipPlayheadTime } of visibleClips) {
        if (token !== this.renderToken) {
          return {};
        }
        await this.drawClipWebGl(webgl, clip, mediaById, sequenceById, media, clipPlayheadTime, canvas.width, canvas.height, depth, bypassProcessing);
      }
      if (!bypassProcessing) {
        this.drawAudioSpectrumWebGl(webgl, timeline, playheadTime, canvas.width, canvas.height);
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
      await this.drawClip2d(context, canvas, clip, mediaById, sequenceById, media, clipPlayheadTime, depth, bypassProcessing);
    }
    if (!bypassProcessing) {
      this.drawAudioSpectrum2d(context, timeline, playheadTime, canvas.width, canvas.height);
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
    depth: number,
    bypassProcessing: boolean
  ): Promise<void> {
    const renderClip = withCanvasKeyframedPosition(clip, canvasWidth, canvasHeight);
    if (renderClip.type === 'adjustment') {
      if (!bypassProcessing) {
        compositor.applyAdjustmentLayer(renderClip.colorCorrection, renderClip.effects);
      }
      return;
    }
    if (renderClip.type === 'nested-sequence') {
      const nested = await this.renderNestedCanvas(renderClip, sequenceById, media, playheadTime, canvasWidth, canvasHeight, depth, bypassProcessing);
      if (!nested) {
        drawMissingWebGl(compositor, renderClip.name, renderClip.type);
        return;
      }
      compositor.drawSource(nested, canvasWidth, canvasHeight, renderClip.transform, renderClip.colorCorrection, renderClip.effects, renderClip.chromaKey, renderClip.masks, {
        bypassProcessing
      });
      return;
    }
    if (renderClip.type === 'video') {
      const asset = mediaById.get(renderClip.mediaId);
      if (!asset || asset.missing) {
        drawMissingWebGl(compositor, renderClip.name, renderClip.type);
        return;
      }
      await drawVideoWebGl(compositor, renderClip, asset, this.getVideo(asset), playheadTime, seekVideo, loadThumbnail, bypassProcessing);
      return;
    }

    if (renderClip.type === 'image') {
      const asset = mediaById.get(renderClip.mediaId);
      if (!asset || asset.missing) {
        drawMissingWebGl(compositor, renderClip.name, renderClip.type);
        return;
      }
      drawImageWebGl(compositor, renderClip, asset, await loadImage(asset), bypassProcessing);
      return;
    }

    if (renderClip.type === 'text' || renderClip.type === 'subtitle') {
      drawTextWebGl(compositor, renderClip, bypassProcessing);
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
    bypassProcessing: boolean
  ): Promise<void> {
    const renderClip = withCanvasKeyframedPosition(clip, canvas.width, canvas.height);
    if (renderClip.type === 'adjustment') {
      if (!bypassProcessing) {
        applyAdjustmentLayer2d(context, canvas, renderClip.colorCorrection, renderClip.effects);
      }
      return;
    }
    if (renderClip.type === 'nested-sequence') {
      const nested = await this.renderNestedCanvas(renderClip, sequenceById, media, playheadTime, canvas.width, canvas.height, depth, bypassProcessing);
      if (!nested) {
        drawMissing2d(context, canvas, renderClip.name, renderClip.type);
        return;
      }
      drawTransformedSource2d(context, canvas, nested, { width: canvas.width, height: canvas.height }, renderClip.transform, bypassProcessing ? undefined : renderClip.colorCorrection);
      return;
    }
    if (renderClip.type === 'video') {
      const asset = mediaById.get(renderClip.mediaId);
      if (!asset || asset.missing) {
        drawMissing2d(context, canvas, renderClip.name, renderClip.type);
        return;
      }
      await drawVideo2d(context, canvas, renderClip, asset, this.getVideo(asset), playheadTime, seekVideo, loadThumbnail, bypassProcessing);
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
    bypassProcessing: boolean
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
      bypassProcessing
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

  private drawAudioSpectrumWebGl(compositor: WebGlPreviewCompositor, timeline: Timeline, playheadTime: number, width: number, height: number): void {
    const overlay = drawAudioSpectrumToCanvas(timeline, playheadTime, width, height, (kind) => this.audioRenderer.readAnalysisFrame(kind));
    if (!overlay) {
      return;
    }
    compositor.drawSource(overlay, width, height, DEFAULT_TRANSFORM, undefined, undefined, undefined, undefined, { bypassProcessing: true });
  }

  private drawAudioSpectrum2d(context: CanvasRenderingContext2D, timeline: Timeline, playheadTime: number, width: number, height: number): void {
    const overlay = drawAudioSpectrumToCanvas(timeline, playheadTime, width, height, (kind) => this.audioRenderer.readAnalysisFrame(kind));
    if (!overlay) {
      return;
    }
    context.drawImage(overlay, 0, 0, width, height);
  }
}

function drawAudioSpectrumToCanvas(
  timeline: Timeline,
  playheadTime: number,
  width: number,
  height: number,
  readAnalysisFrame: (kind: 'frequency' | 'waveform') => Uint8Array | undefined
): HTMLCanvasElement | undefined {
  const activeParams = getActiveAudioSpectrumParams(timeline, playheadTime);
  if (activeParams.length === 0) {
    return undefined;
  }
  const overlay = document.createElement('canvas');
  overlay.width = width;
  overlay.height = height;
  const context = overlay.getContext('2d');
  if (!context) {
    return undefined;
  }
  let drew = false;
  for (const params of activeParams) {
    const data = readAnalysisFrame(params.style === 'waveform' ? 'waveform' : 'frequency');
    if (!data) {
      continue;
    }
    drawAudioSpectrumOverlay(context, width, height, params, data);
    drew = true;
  }
  return drew ? overlay : undefined;
}

function getActiveAudioSpectrumParams(timeline: Timeline, playheadTime: number): AudioSpectrumParams[] {
  return getActiveClipsAtTime(timeline, playheadTime).flatMap((clip) =>
    (clip.effects ?? []).flatMap((effect) => {
      if (!effect.enabled || effect.type !== 'audio-spectrum') {
        return [];
      }
      const params = normalizeAudioSpectrumParams(effect.params);
      return params.height > 0 ? [params] : [];
    })
  );
}

function drawAudioSpectrumOverlay(context: CanvasRenderingContext2D, width: number, height: number, params: AudioSpectrumParams, data: Uint8Array): void {
  const overlayHeight = Math.max(2, Math.round(height * (params.height / 100)));
  const y = params.position === 'top' ? 0 : height - overlayHeight;
  const paint = context.createLinearGradient(0, y, 0, y + overlayHeight);
  paint.addColorStop(0, params.colorStart);
  paint.addColorStop(1, params.colorEnd);
  context.save();
  context.globalAlpha = 0.9;
  context.strokeStyle = paint;
  context.fillStyle = paint;
  context.lineWidth = 2;
  if (params.style === 'waveform') {
    drawWaveformSpectrum(context, width, overlayHeight, y, params.sensitivity, data, params.mirror);
  } else if (params.style === 'circular') {
    drawCircleSpectrum(context, width, overlayHeight, y, params.sensitivity, data);
  } else {
    drawBarSpectrum(context, width, overlayHeight, y, params.sensitivity, data, params.mirror);
  }
  context.restore();
}

function drawBarSpectrum(context: CanvasRenderingContext2D, width: number, height: number, y: number, sensitivity: number, data: Uint8Array, mirror: boolean): void {
  const bars = Math.min(96, Math.max(16, Math.floor(width / 12)));
  const barWidth = width / bars;
  const centerY = y + height / 2;
  for (let index = 0; index < bars; index += 1) {
    const sample = data[Math.min(data.length - 1, Math.floor((index / bars) * data.length))] ?? 0;
    const level = Math.min(1, (sample / 255) * sensitivity);
    const barHeight = Math.max(1, level * (mirror ? height / 2 : height));
    const x = index * barWidth + 1;
    const drawWidth = Math.max(1, barWidth - 2);
    if (mirror) {
      context.fillRect(x, centerY - barHeight, drawWidth, barHeight * 2);
    } else {
      context.fillRect(x, y + height - barHeight, drawWidth, barHeight);
    }
  }
}

function drawWaveformSpectrum(context: CanvasRenderingContext2D, width: number, height: number, y: number, sensitivity: number, data: Uint8Array, mirror: boolean): void {
  const centerY = y + height / 2;
  for (const direction of mirror ? [1, -1] : [1]) {
    context.beginPath();
    for (let index = 0; index < data.length; index += 1) {
      const x = (index / Math.max(1, data.length - 1)) * width;
      const normalized = ((data[index] ?? 128) - 128) / 128;
      const nextY = centerY + normalized * direction * sensitivity * (height / 2);
      if (index === 0) {
        context.moveTo(x, nextY);
      } else {
        context.lineTo(x, nextY);
      }
    }
    context.stroke();
  }
}

function drawCircleSpectrum(context: CanvasRenderingContext2D, width: number, height: number, y: number, sensitivity: number, data: Uint8Array): void {
  const centerX = width / 2;
  const centerY = y + height / 2;
  const radius = Math.max(8, height * 0.28);
  const bars = 96;
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.stroke();
  for (let index = 0; index < bars; index += 1) {
    const angle = (index / bars) * Math.PI * 2 - Math.PI / 2;
    const sample = data[Math.min(data.length - 1, Math.floor((index / bars) * data.length))] ?? 0;
    const level = Math.min(1, (sample / 255) * sensitivity);
    const inner = radius;
    const outer = radius + level * height * 0.32;
    context.beginPath();
    context.moveTo(centerX + Math.cos(angle) * inner, centerY + Math.sin(angle) * inner);
    context.lineTo(centerX + Math.cos(angle) * outer, centerY + Math.sin(angle) * outer);
    context.stroke();
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

function read2dFrameSafely(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement): PreviewFrameReadback | undefined {
  try {
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    return image.data.length > 0 ? { width: canvas.width, height: canvas.height, data: image.data, origin: 'top-left' } : undefined;
  } catch {
    return undefined;
  }
}

function applyAdjustmentLayer2d(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  colorCorrection: Clip['colorCorrection'],
  effects: Effect[] | undefined
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
    `hue-rotate(${correction.hue}deg)`
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

import { calculateSpeedCurveSourceDuration, getClipSpeed, type Clip, type EffectType, type MediaAsset, type ProjectColorPipeline } from '@open-factory/editor-core';
import { recordPreviewDraw, recordPreviewError } from './debug';
import { drawTransformedSource2d } from './transform-2d';
import type { WebGlPreviewCompositor } from './webgl-compositor';

type VideoClip = Extract<Clip, { type: 'video' }>;

export async function drawVideo2d(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  clip: VideoClip,
  asset: MediaAsset,
  video: HTMLVideoElement,
  playheadTime: number,
  seekVideo: (video: HTMLVideoElement, time: number) => Promise<void>,
  loadThumbnail: (asset: MediaAsset) => Promise<HTMLImageElement | undefined>,
  bypassProcessing = false,
  disabledEffectTypes: EffectType[] = []
): Promise<void> {
  const sourceTime = getPreviewSourceTime(clip, playheadTime);
  try {
    await seekVideo(video, sourceTime);
    drawVideoSource2d(context, canvas, video, asset, clip, bypassProcessing);
    recordPreviewDraw('video', 'video');
  } catch (error) {
    recordPreviewError(error instanceof Error ? error.message : 'Video preview failed.');
    const fallback = await loadThumbnail(asset);
    if (fallback) {
      drawVideoSource2d(context, canvas, fallback, asset, clip, bypassProcessing);
      recordPreviewDraw('video', 'thumbnail');
    }
  }
}

export async function drawVideoWebGl(
  compositor: WebGlPreviewCompositor,
  clip: VideoClip,
  asset: MediaAsset,
  video: HTMLVideoElement,
  playheadTime: number,
  seekVideo: (video: HTMLVideoElement, time: number) => Promise<void>,
  loadThumbnail: (asset: MediaAsset) => Promise<HTMLImageElement | undefined>,
  bypassProcessing = false,
  disabledEffectTypes: EffectType[] = [],
  colorPipeline?: ProjectColorPipeline
): Promise<void> {
  const sourceTime = getPreviewSourceTime(clip, playheadTime);
  try {
    await seekVideo(video, sourceTime);
    if (clip.projection === 'equirectangular' && clip.panorama) {
      const drawn = compositor.drawPanoramaSource(video, asset.width || 1280, asset.height || 720, clip.transform, clip.panorama, { bypassProcessing, blendMode: clip.blendMode, textureCacheKey: asset.path });
      if (drawn) {
        recordPreviewDraw('video', 'video');
        return;
      }
    }
    compositor.drawSourceWithColorNodeGraph(video, asset.width || 1280, asset.height || 720, clip.transform, clip.colorNodeGraph, clip.colorCorrection, clip.effects, clip.chromaKey, clip.masks, {
      bypassProcessing,
      disabledEffectTypes,
      colorPipeline,
      blendMode: clip.blendMode,
      textureCacheKey: asset.path
    });
    recordPreviewDraw('video', 'video');
  } catch (error) {
    recordPreviewError(error instanceof Error ? error.message : 'WebGL video preview failed.');
    const fallback = await loadThumbnail(asset);
    if (fallback) {
      if (clip.projection === 'equirectangular' && clip.panorama) {
        const drawn = compositor.drawPanoramaSource(fallback, asset.width || 1280, asset.height || 720, clip.transform, clip.panorama, { bypassProcessing, blendMode: clip.blendMode, textureCacheKey: `${asset.path}:thumbnail` });
        if (drawn) {
          recordPreviewDraw('video', 'thumbnail');
          return;
        }
      }
      compositor.drawSourceWithColorNodeGraph(fallback, asset.width || 1280, asset.height || 720, clip.transform, clip.colorNodeGraph, clip.colorCorrection, clip.effects, clip.chromaKey, clip.masks, {
        bypassProcessing,
        disabledEffectTypes,
        colorPipeline,
        blendMode: clip.blendMode,
        textureCacheKey: `${asset.path}:thumbnail`
      });
      recordPreviewDraw('video', 'thumbnail');
    }
  }
}

function getPreviewSourceTime(clip: VideoClip, playheadTime: number): number {
  const localTime = Math.max(0, playheadTime - clip.start);
  return Math.max(0, calculateSpeedCurveSourceDuration(localTime, clip.keyframes, getClipSpeed(clip)) + clip.trimStart);
}

function drawVideoSource2d(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  source: CanvasImageSource,
  asset: MediaAsset,
  clip: VideoClip,
  bypassProcessing: boolean
): void {
  drawTransformedSource2d(
    context,
    canvas,
    source,
    { width: asset.width || canvas.width, height: asset.height || canvas.height },
    clip.transform,
    bypassProcessing ? undefined : clip.colorCorrection
  );
}

import { calculateSpeedCurveSourceDuration, getClipSpeed, type Clip, type MediaAsset } from '@open-factory/editor-core';
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
  loadThumbnail: (asset: MediaAsset) => Promise<HTMLImageElement | undefined>
): Promise<void> {
  const sourceTime = getPreviewSourceTime(clip, playheadTime);
  try {
    await seekVideo(video, sourceTime);
    drawVideoSource2d(context, canvas, video, asset, clip);
    recordPreviewDraw('video', 'video');
  } catch (error) {
    recordPreviewError(error instanceof Error ? error.message : 'Video preview failed.');
    const fallback = await loadThumbnail(asset);
    if (fallback) {
      drawVideoSource2d(context, canvas, fallback, asset, clip);
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
  loadThumbnail: (asset: MediaAsset) => Promise<HTMLImageElement | undefined>
): Promise<void> {
  const sourceTime = getPreviewSourceTime(clip, playheadTime);
  try {
    await seekVideo(video, sourceTime);
    compositor.drawSource(video, asset.width || 1280, asset.height || 720, clip.transform, clip.colorCorrection, clip.effects, clip.chromaKey, clip.masks);
    recordPreviewDraw('video', 'video');
  } catch (error) {
    recordPreviewError(error instanceof Error ? error.message : 'WebGL video preview failed.');
    const fallback = await loadThumbnail(asset);
    if (fallback) {
      compositor.drawSource(fallback, asset.width || 1280, asset.height || 720, clip.transform, clip.colorCorrection, clip.effects, clip.chromaKey, clip.masks);
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
  clip: VideoClip
): void {
  drawTransformedSource2d(context, canvas, source, { width: asset.width || canvas.width, height: asset.height || canvas.height }, clip.transform, clip.colorCorrection);
}

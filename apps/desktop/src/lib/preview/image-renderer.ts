import type { Clip, MediaAsset } from '@open-factory/editor-core';
import { recordPreviewDraw } from './debug';
import { drawTransformedSource2d } from './transform-2d';
import type { WebGlPreviewCompositor } from './webgl-compositor';

type ImageClip = Extract<Clip, { type: 'image' }>;

export function drawImage2d(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement, clip: ImageClip, asset: MediaAsset, img: HTMLImageElement): void {
  drawTransformedSource2d(context, canvas, img, { width: asset.width || canvas.width, height: asset.height || canvas.height }, clip.transform, clip.colorCorrection);
  recordPreviewDraw('image', 'image');
}

export function drawImage2dBypass(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement, clip: ImageClip, asset: MediaAsset, img: HTMLImageElement): void {
  drawTransformedSource2d(context, canvas, img, { width: asset.width || canvas.width, height: asset.height || canvas.height }, clip.transform);
  recordPreviewDraw('image', 'image');
}

export function drawImageWebGl(compositor: WebGlPreviewCompositor, clip: ImageClip, asset: MediaAsset, img: HTMLImageElement, bypassProcessing = false): void {
  compositor.drawSource(img, asset.width || 1280, asset.height || 720, clip.transform, clip.colorCorrection, clip.effects, clip.chromaKey, clip.masks, {
    bypassProcessing
  });
  recordPreviewDraw('image', 'image');
}

import type {
  Clip,
  Effect,
  EffectType,
  MediaAsset,
  ProjectColorPipeline,
  Sequence,
} from '@open-factory/editor-core';
import {
  DEFAULT_COLOR_CORRECTION,
  normalizeColorCorrection,
  getEffectNumberParam,
} from '@open-factory/editor-core';
import type { HardwareDecodeManager } from './hw-decode-manager';
import { drawImage2d, drawImage2dBypass, drawImageWebGl } from './image-renderer';
import { loadImage, loadThumbnail, seekVideo } from './media-elements';
import {
  drawCreditsRoll2d,
  drawCreditsRollWebGl,
  drawMissing2d,
  drawMissingWebGl,
  drawText2d,
  drawTextWebGl,
} from './text-renderer';
import { withCanvasKeyframedPosition } from './transition-clip-helpers';
import { drawVideo2d, drawVideoWebGl } from './video-renderer';
import { drawTransformedSource2d } from './transform-2d';
import type { WebGlPreviewCompositor } from './webgl-compositor';
import type { PreviewRenderer } from './renderer';

export async function drawClipWebGl(
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
  hwDecodeEnabled: boolean,
  hwDecodeManager: HardwareDecodeManager | null,
  getVideo: (asset: MediaAsset) => HTMLVideoElement,
  renderer: PreviewRenderer,
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
    const nested = await renderNestedCanvas(
      renderClip,
      sequenceById,
      media,
      playheadTime,
      canvasWidth,
      canvasHeight,
      depth,
      bypassProcessing,
      disabledEffectTypes,
      renderer,
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
      getVideo(asset),
      playheadTime,
      seekVideo,
      loadThumbnail,
      bypassProcessing,
      disabledEffectTypes,
      colorPipeline,
      hwDecodeEnabled ? hwDecodeManager : null,
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

export async function drawClip2d(
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
  hwDecodeEnabled: boolean,
  hwDecodeManager: HardwareDecodeManager | null,
  getVideo: (asset: MediaAsset) => HTMLVideoElement,
  renderer: PreviewRenderer,
): Promise<void> {
  const renderClip = withCanvasKeyframedPosition(clip, canvas.width, canvas.height);
  if (renderClip.type === 'adjustment') {
    if (!bypassProcessing) {
      applyAdjustmentLayer2d(context, canvas, renderClip.colorCorrection, renderClip.effects);
    }
    return;
  }
  if (renderClip.type === 'nested-sequence') {
    const nested = await renderNestedCanvas(
      renderClip,
      sequenceById,
      media,
      playheadTime,
      canvas.width,
      canvas.height,
      depth,
      bypassProcessing,
      disabledEffectTypes,
      renderer,
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
      getVideo(asset),
      playheadTime,
      seekVideo,
      loadThumbnail,
      bypassProcessing,
      disabledEffectTypes,
      hwDecodeEnabled ? hwDecodeManager : null,
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

export async function renderNestedCanvas(
  clip: Extract<Clip, { type: 'nested-sequence' }>,
  sequenceById: Map<string, Sequence>,
  media: MediaAsset[],
  playheadTime: number,
  width: number,
  height: number,
  depth: number,
  bypassProcessing: boolean,
  disabledEffectTypes: EffectType[],
  renderer: PreviewRenderer,
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
  await renderer.render(canvas, sequence.timeline, media, localTime, {
    sequences: Array.from(sequenceById.values()),
    depth: depth + 1,
    bypassProcessing,
    disabledEffectTypes,
    colorPipeline,
  });
  return canvas;
}

export function readWebGlFrameSafely(webgl: WebGlPreviewCompositor) {
  try {
    const frame = webgl.readFramePixels();
    return frame.data.length > 0 ? { ...frame, origin: 'bottom-left' as const } : undefined;
  } catch {
    return undefined;
  }
}

export function read2dFrameSafely(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
) {
  try {
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    return image.data.length > 0
      ? { width: canvas.width, height: canvas.height, data: image.data, origin: 'top-left' as const }
      : undefined;
  } catch {
    return undefined;
  }
}

export function applyAdjustmentLayer2d(
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

export function buildAdjustmentCanvasFilter(colorCorrection: Clip['colorCorrection'], effects: Effect[] | undefined): string {
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

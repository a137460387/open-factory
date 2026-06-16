import { DEFAULT_TRANSFORM, layoutTextAlongPath, normalizeTextPath, resolveDataSubtitleText, resolvePathTextStartOffset, type Clip, type ProjectColorPipeline } from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import { recordPreviewDraw } from './debug';
import { drawTransformedSource2d } from './transform-2d';
import type { WebGlPreviewCompositor } from './webgl-compositor';

type TextClip = Extract<Clip, { type: 'text' }> | Extract<Clip, { type: 'subtitle' }>;
type CreditsClip = Extract<Clip, { type: 'credits' }>;

export function drawText2d(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement, clip: TextClip, bypassProcessing = false, localTime = 0): void {
  if (clip.type === 'text' && normalizeTextPath(clip.pathText).enabled) {
    drawPathText2d(context, canvas, clip, bypassProcessing, localTime);
    return;
  }
  const text = resolveTextContent(clip, localTime);
  if (clip.type === 'subtitle' && !text) {
    return;
  }
  const previousFilter = context.filter;
  const transform = resolveTextTransform(canvas.height, clip);
  context.save();
  const correction = clip.colorCorrection;
  context.filter = bypassProcessing
    ? 'none'
    : `brightness(${Math.max(0, 1 + correction.brightness)}) contrast(${correction.contrast}) saturate(${correction.saturation}) hue-rotate(${correction.hue}deg)`;
  context.globalAlpha = transform.opacity;
  context.translate(canvas.width / 2 + transform.x, canvas.height / 2 + transform.y);
  context.rotate((transform.rotation * Math.PI) / 180);
  context.scale(transform.scale, transform.scale);
  context.font = `${clip.style.italic ? 'italic ' : ''}${clip.style.bold ? '700 ' : '400 '}${clip.style.fontSize}px ${clip.style.fontFamily}`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  drawTextBackground(context, text, clip.style.fontSize, clip.style.backgroundColor, clip.style.backgroundOpacity, transform.opacity);
  context.globalAlpha = transform.opacity;
  context.fillStyle = clip.style.color;
  context.fillText(text, 0, 0);
  context.filter = previousFilter;
  context.restore();
  recordPreviewDraw(clip.type, 'text', text);
}

export function drawTextWebGl(compositor: WebGlPreviewCompositor, clip: TextClip, bypassProcessing = false, colorPipeline?: ProjectColorPipeline, localTime = 0): void {
  const text = resolveTextContent(clip, localTime);
  if (clip.type === 'subtitle' && !text) {
    return;
  }
  compositor.drawText(text, clip.transform, clip.style, clip.colorCorrection, clip.effects, { bypassProcessing, colorPipeline });
  recordPreviewDraw(clip.type, 'text', text);
}

export function drawCreditsRoll2d(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement, clip: CreditsClip, bypassProcessing = false, localTime = 0): void {
  const previousFilter = context.filter;
  const transform = clip.transform;
  const correction = clip.colorCorrection;
  const scaleX = transform.scaleX ?? transform.scale;
  const scaleY = transform.scaleY ?? transform.scale;
  const fontSize = Math.max(1, clip.style.fontSize);
  const lineHeight = Math.max(1, fontSize + clip.style.lineSpacing);
  const startY = canvas.height / 2 - Math.max(0, localTime) * clip.rollSpeed;
  const gap = Math.max(24, clip.style.horizontalMargin * 0.25);

  context.save();
  context.filter = bypassProcessing
    ? 'none'
    : `brightness(${Math.max(0, 1 + correction.brightness)}) contrast(${correction.contrast}) saturate(${correction.saturation}) hue-rotate(${correction.hue}deg)`;
  if (clip.style.backgroundOpacity > 0) {
    context.globalAlpha = Math.min(1, Math.max(0, clip.style.backgroundOpacity)) * Math.min(1, Math.max(0, transform.opacity));
    context.fillStyle = clip.style.backgroundColor;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  context.globalAlpha = transform.opacity;
  context.translate(canvas.width / 2 + transform.x, canvas.height / 2 + transform.y);
  context.rotate((transform.rotation * Math.PI) / 180);
  context.scale(scaleX, scaleY);
  context.font = `${clip.style.italic ? 'italic ' : ''}${clip.style.bold ? '700 ' : '400 '}${fontSize}px ${clip.style.fontFamily}`;
  context.textBaseline = 'top';
  context.fillStyle = clip.style.color;

  clip.rows.forEach((row, index) => {
    const y = startY + index * lineHeight;
    if (y < -canvas.height / 2 - lineHeight || y > canvas.height / 2 + lineHeight) {
      return;
    }
    if (row.role && row.name) {
      context.textAlign = 'right';
      context.fillText(row.role, -gap, y);
      context.textAlign = 'left';
      context.fillText(row.name, gap, y);
      return;
    }
    context.textAlign = 'center';
    context.fillText(row.role || row.name, 0, y);
  });

  context.filter = previousFilter;
  context.restore();
  recordPreviewDraw(clip.type, 'text');
}

export function drawCreditsRollWebGl(
  compositor: WebGlPreviewCompositor,
  clip: CreditsClip,
  width: number,
  height: number,
  bypassProcessing = false,
  localTime = 0,
  colorPipeline?: ProjectColorPipeline
): void {
  const layer = document.createElement('canvas');
  layer.width = width;
  layer.height = height;
  const context = layer.getContext('2d');
  if (!context) {
    return;
  }
  drawCreditsRoll2d(context, layer, clip, bypassProcessing, localTime);
  compositor.drawSource(layer, width, height, DEFAULT_TRANSFORM, undefined, undefined, undefined, undefined, { bypassProcessing: true, colorPipeline });
}

export function drawMissing2d(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement, name: string, clipType: Clip['type']): void {
  const missing = document.createElement('canvas');
  missing.width = 680;
  missing.height = 136;
  const missingContext = missing.getContext('2d');
  if (!missingContext) {
    return;
  }
  missingContext.fillStyle = 'rgba(255, 255, 255, 0.82)';
  missingContext.fillRect(0, 0, missing.width, missing.height);
  missingContext.fillStyle = '#9f1239';
  missingContext.textAlign = 'center';
  missingContext.textBaseline = 'middle';
  missingContext.font = '600 36px Inter, Arial, sans-serif';
  missingContext.fillText(zhCN.preview.missingMedia(name), missing.width / 2, missing.height / 2);
  drawTransformedSource2d(context, canvas, missing, { width: 340, height: 68 }, { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 });
  recordPreviewDraw(clipType, 'missing');
}

export function drawMissingWebGl(compositor: WebGlPreviewCompositor, name: string, clipType: Clip['type']): void {
  compositor.drawMissing(name);
  recordPreviewDraw(clipType, 'missing');
}

function drawTextBackground(
  context: CanvasRenderingContext2D,
  text: string,
  fontSize: number,
  backgroundColor: string,
  backgroundOpacity: number,
  transformOpacity: number
): void {
  if (backgroundOpacity <= 0) {
    return;
  }
  const metrics = context.measureText(text);
  const padding = Math.max(6, fontSize * 0.25);
  const width = Math.max(fontSize, metrics.width) + padding * 2;
  const height = fontSize * 1.35 + padding;
  context.globalAlpha = Math.min(1, Math.max(0, backgroundOpacity)) * Math.min(1, Math.max(0, transformOpacity));
  context.fillStyle = backgroundColor;
  context.fillRect(-width / 2, -height / 2, width, height);
}

function drawPathText2d(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement, clip: Extract<Clip, { type: 'text' }>, bypassProcessing: boolean, localTime: number): void {
  const previousFilter = context.filter;
  const transform = clip.transform;
  const correction = clip.colorCorrection;
  const pathText = normalizeTextPath(clip.pathText);
  const scale = Math.max(0.01, clip.transform.scaleX ?? clip.transform.scale);
  const fontSize = Math.max(1, clip.style.fontSize * scale);
  context.save();
  context.filter = bypassProcessing
    ? 'none'
    : `brightness(${Math.max(0, 1 + correction.brightness)}) contrast(${correction.contrast}) saturate(${correction.saturation}) hue-rotate(${correction.hue}deg)`;
  context.globalAlpha = transform.opacity;
  context.font = `${clip.style.italic ? 'italic ' : ''}${clip.style.bold ? '700 ' : '400 '}${fontSize}px ${clip.style.fontFamily}`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  const chars = layoutTextAlongPath({
    text: clip.text,
    path: pathText.path,
    width: canvas.width,
    height: canvas.height,
    fontSize,
    startOffset: resolvePathTextStartOffset(pathText, clip.keyframes, localTime),
    letterSpacing: pathText.letterSpacing,
    rotateCharacters: pathText.rotateCharacters,
    offsetX: clip.transform.x,
    offsetY: clip.transform.y,
    measureCharacter: (char) => context.measureText(char).width
  });
  for (const item of chars) {
    context.save();
    context.translate(item.x, item.y);
    if (pathText.rotateCharacters) {
      context.rotate((item.angle * Math.PI) / 180);
    }
    drawTextBackground(context, item.char, fontSize, clip.style.backgroundColor, clip.style.backgroundOpacity, transform.opacity);
    context.globalAlpha = transform.opacity;
    context.fillStyle = clip.style.color;
    context.fillText(item.char, 0, 0);
    context.restore();
  }
  context.filter = previousFilter;
  context.restore();
  recordPreviewDraw(clip.type, 'text');
}

function resolveTextTransform(canvasHeight: number, clip: TextClip): TextClip['transform'] {
  if (clip.type !== 'subtitle') {
    return clip.transform;
  }
  return {
    ...clip.transform,
    x: 0,
    y: canvasHeight / 2 - clip.style.yOffset - clip.style.fontSize / 2
  };
}

function resolveTextContent(clip: TextClip, localTime: number): string {
  if (clip.type !== 'subtitle') {
    return clip.text;
  }
  return clip.dataSubtitle ? resolveDataSubtitleText(clip.dataSubtitle, clip.start + Math.max(0, localTime)) : clip.text;
}

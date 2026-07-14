import {
  DEFAULT_TRANSFORM,
  buildArcTextLayout,
  buildRichTextDrawSegments,
  calculateTextAutoLayout,
  layoutTextAlongPath,
  normalizeTextArc,
  normalizeTextLayout,
  normalizeTextPath,
  resolveDataSubtitleText,
  resolvePathTextStartOffset,
  richTextToPlainText,
  type Clip,
  type ProjectColorPipeline,
} from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import { recordPreviewDraw } from './debug';
import { drawTransformedSource2d } from './transform-2d';
import type { WebGlPreviewCompositor } from './webgl-compositor';

type TextClip = Extract<Clip, { type: 'text' }> | Extract<Clip, { type: 'subtitle' }>;
type CreditsClip = Extract<Clip, { type: 'credits' }>;

export function drawText2d(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  clip: TextClip,
  bypassProcessing = false,
  localTime = 0,
): void {
  if (clip.type === 'text' && normalizeTextArc(clip.arcText).enabled) {
    drawArcText2d(context, canvas, clip, bypassProcessing);
    return;
  }
  if (clip.type === 'text' && normalizeTextPath(clip.pathText).enabled) {
    drawPathText2d(context, canvas, clip, bypassProcessing, localTime);
    return;
  }
  if (clip.type === 'text' && shouldDrawRichTextPreview(clip)) {
    drawRichText2d(context, canvas, clip, bypassProcessing);
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
  drawTextBackground(
    context,
    text,
    clip.style.fontSize,
    clip.style.backgroundColor,
    clip.style.backgroundOpacity,
    transform.opacity,
  );
  context.globalAlpha = transform.opacity;
  context.fillStyle = clip.style.color;
  context.fillText(text, 0, 0);
  context.filter = previousFilter;
  context.restore();
  recordPreviewDraw(clip.type, 'text', text);
}

export function drawTextWebGl(
  compositor: WebGlPreviewCompositor,
  clip: TextClip,
  bypassProcessing = false,
  colorPipeline?: ProjectColorPipeline,
  localTime = 0,
): void {
  const text =
    clip.type === 'text' ? richTextToPlainText(clip.richText, clip.text) : resolveTextContent(clip, localTime);
  if (clip.type === 'subtitle' && !text) {
    return;
  }
  compositor.drawText(text, clip.transform, clip.style, clip.colorCorrection, clip.effects, clip.colorNodeGraph, {
    bypassProcessing,
    colorPipeline,
  });
  recordPreviewDraw(clip.type, 'text', text);
}

export function drawCreditsRoll2d(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  clip: CreditsClip,
  bypassProcessing = false,
  localTime = 0,
): void {
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
    context.globalAlpha =
      Math.min(1, Math.max(0, clip.style.backgroundOpacity)) * Math.min(1, Math.max(0, transform.opacity));
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
  colorPipeline?: ProjectColorPipeline,
): void {
  const layer = document.createElement('canvas');
  layer.width = width;
  layer.height = height;
  const context = layer.getContext('2d');
  if (!context) {
    return;
  }
  drawCreditsRoll2d(context, layer, clip, bypassProcessing || Boolean(clip.colorNodeGraph), localTime);
  compositor.drawSourceWithColorNodeGraph(
    layer,
    width,
    height,
    DEFAULT_TRANSFORM,
    clip.colorNodeGraph,
    undefined,
    undefined,
    undefined,
    undefined,
    { colorPipeline },
  );
}

export function drawMissing2d(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  name: string,
  clipType: Clip['type'],
): void {
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
  drawTransformedSource2d(
    context,
    canvas,
    missing,
    { width: 340, height: 68 },
    { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
  );
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
  transformOpacity: number,
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

function drawRichText2d(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  clip: Extract<Clip, { type: 'text' }>,
  bypassProcessing: boolean,
): void {
  const previousFilter = context.filter;
  const transform = clip.transform;
  const correction = clip.colorCorrection;
  const layout = calculateTextAutoLayout({
    richText: clip.richText,
    plainText: clip.text,
    baseStyle: clip.style,
    layout: clip.textLayout,
  });
  const segments = buildRichTextDrawSegments({
    richText: clip.richText,
    plainText: clip.text,
    baseStyle: clip.style,
    layout: normalizeTextLayout(clip.textLayout),
  });
  context.save();
  context.filter = bypassProcessing
    ? 'none'
    : `brightness(${Math.max(0, 1 + correction.brightness)}) contrast(${correction.contrast}) saturate(${correction.saturation}) hue-rotate(${correction.hue}deg)`;
  context.globalAlpha = transform.opacity;
  context.translate(canvas.width / 2 + transform.x, canvas.height / 2 + transform.y);
  context.rotate((transform.rotation * Math.PI) / 180);
  context.scale(transform.scale, transform.scale);
  context.textAlign = 'left';
  context.textBaseline = 'top';
  for (const segment of segments) {
    const fontSize = Math.max(1, segment.style.fontSize * layout.scale);
    context.font = `${segment.style.italic ? 'italic ' : ''}${segment.style.bold ? '700 ' : '400 '}${fontSize}px ${clip.style.fontFamily}`;
    context.fillStyle = segment.style.color;
    context.globalAlpha = transform.opacity;
    const x = segment.xOffset - layout.width / 2;
    const y = segment.yOffset - layout.height / 2;
    drawTextRunBackground(
      context,
      segment.text,
      x,
      y,
      fontSize,
      clip.style.backgroundColor,
      clip.style.backgroundOpacity,
      transform.opacity,
    );
    context.globalAlpha = transform.opacity;
    context.fillText(segment.text, x, y);
    if (segment.style.underline) {
      const width = context.measureText(segment.text).width;
      context.fillRect(x, y + fontSize * 1.08, width, Math.max(1, fontSize * 0.06));
    }
  }
  context.filter = previousFilter;
  context.restore();
  recordPreviewDraw(clip.type, 'text', richTextToPlainText(clip.richText, clip.text));
}

function drawArcText2d(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  clip: Extract<Clip, { type: 'text' }>,
  bypassProcessing: boolean,
): void {
  const previousFilter = context.filter;
  const transform = clip.transform;
  const correction = clip.colorCorrection;
  const arcText = normalizeTextArc(clip.arcText);
  const pathText = normalizeTextPath(clip.pathText);
  const scale = Math.max(0.01, clip.transform.scaleX ?? clip.transform.scale);
  const fontSize = Math.max(1, clip.style.fontSize * scale);
  const chars = buildArcTextLayout({
    text: richTextToPlainText(clip.richText, clip.text),
    arc: arcText,
    fontSize,
    letterSpacing: pathText.letterSpacing,
    centerX: canvas.width / 2 + transform.x,
    centerY: canvas.height / 2 + transform.y,
  });
  context.save();
  context.filter = bypassProcessing
    ? 'none'
    : `brightness(${Math.max(0, 1 + correction.brightness)}) contrast(${correction.contrast}) saturate(${correction.saturation}) hue-rotate(${correction.hue}deg)`;
  context.globalAlpha = transform.opacity;
  context.font = `${clip.style.italic ? 'italic ' : ''}${clip.style.bold ? '700 ' : '400 '}${fontSize}px ${clip.style.fontFamily}`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = clip.style.color;
  for (const item of chars) {
    context.save();
    context.translate(item.x, item.y);
    if (arcText.rotateCharacters) {
      context.rotate((item.rotation * Math.PI) / 180);
    }
    drawTextBackground(
      context,
      item.char,
      fontSize,
      clip.style.backgroundColor,
      clip.style.backgroundOpacity,
      transform.opacity,
    );
    context.globalAlpha = transform.opacity;
    context.fillStyle = clip.style.color;
    context.fillText(item.char, 0, 0);
    context.restore();
  }
  context.filter = previousFilter;
  context.restore();
  recordPreviewDraw(clip.type, 'text');
}

function drawTextRunBackground(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fontSize: number,
  backgroundColor: string,
  backgroundOpacity: number,
  transformOpacity: number,
): void {
  if (backgroundOpacity <= 0) {
    return;
  }
  const metrics = context.measureText(text);
  const padding = Math.max(6, fontSize * 0.25);
  context.globalAlpha = Math.min(1, Math.max(0, backgroundOpacity)) * Math.min(1, Math.max(0, transformOpacity));
  context.fillStyle = backgroundColor;
  context.fillRect(
    x - padding,
    y - padding / 2,
    Math.max(fontSize, metrics.width) + padding * 2,
    fontSize * 1.35 + padding,
  );
}

function shouldDrawRichTextPreview(clip: Extract<Clip, { type: 'text' }>): boolean {
  const richText = clip.richText;
  const layout = normalizeTextLayout(clip.textLayout);
  const defaultLayout = normalizeTextLayout(undefined);
  return Boolean(
    richText &&
    (richText.paragraphs.length > 1 ||
      richText.paragraphs.some(
        (paragraph) =>
          paragraph.runs.length > 1 ||
          paragraph.runs.some(
            (run) =>
              run.bold !== undefined ||
              run.italic !== undefined ||
              run.underline !== undefined ||
              run.color !== undefined ||
              run.fontSize !== undefined,
          ),
      ) ||
      layout.fitMode !== defaultLayout.fitMode ||
      layout.boxWidth !== defaultLayout.boxWidth ||
      layout.boxHeight !== defaultLayout.boxHeight ||
      layout.paragraphSpacing !== defaultLayout.paragraphSpacing ||
      layout.firstLineIndent !== defaultLayout.firstLineIndent),
  );
}

function drawPathText2d(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  clip: Extract<Clip, { type: 'text' }>,
  bypassProcessing: boolean,
  localTime: number,
): void {
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
    measureCharacter: (char) => context.measureText(char).width,
  });
  for (const item of chars) {
    context.save();
    context.translate(item.x, item.y);
    if (pathText.rotateCharacters) {
      context.rotate((item.angle * Math.PI) / 180);
    }
    drawTextBackground(
      context,
      item.char,
      fontSize,
      clip.style.backgroundColor,
      clip.style.backgroundOpacity,
      transform.opacity,
    );
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
    y: canvasHeight / 2 - clip.style.yOffset - clip.style.fontSize / 2,
  };
}

function resolveTextContent(clip: TextClip, localTime: number): string {
  if (clip.type !== 'subtitle') {
    return clip.text;
  }
  return clip.dataSubtitle
    ? resolveDataSubtitleText(clip.dataSubtitle, clip.start + Math.max(0, localTime))
    : clip.text;
}

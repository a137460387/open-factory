import {
  MAX_CHROMA_KEY_COLORS,
  normalizeChromaKey,
  type ChromaKeyColor,
  type Clip,
  type ClipPatch,
} from '@open-factory/editor-core';

const MIN_PREVIEW_ZOOM = 0.25;
const MAX_PREVIEW_ZOOM = 4;

export interface PreviewPixelCoordinateInput {
  canvasWidth: number;
  canvasHeight: number;
  boundsWidth: number;
  boundsHeight: number;
  offsetX: number;
  offsetY: number;
}

export interface PreviewPixelCoordinates {
  x: number;
  y: number;
  webglY: number;
  normalizedX: number;
  normalizedY: number;
}

export interface HslColor {
  h: number;
  s: number;
  l: number;
}

export function clampPreviewZoom(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.min(MAX_PREVIEW_ZOOM, Math.max(MIN_PREVIEW_ZOOM, value));
}

export function getWheelPreviewZoom(currentZoom: number, deltaY: number): number {
  return clampPreviewZoom(currentZoom * (deltaY < 0 ? 1.1 : 1 / 1.1));
}

export function calculatePreviewPixelCoordinates(input: PreviewPixelCoordinateInput): PreviewPixelCoordinates {
  const x = Math.min(
    input.canvasWidth - 1,
    Math.max(0, Math.floor((input.offsetX / Math.max(1, input.boundsWidth)) * input.canvasWidth)),
  );
  const y = Math.min(
    input.canvasHeight - 1,
    Math.max(0, Math.floor((input.offsetY / Math.max(1, input.boundsHeight)) * input.canvasHeight)),
  );
  return {
    x,
    y,
    webglY: input.canvasHeight - 1 - y,
    normalizedX: input.canvasWidth <= 1 ? 0 : x / (input.canvasWidth - 1),
    normalizedY: input.canvasHeight <= 1 ? 0 : y / (input.canvasHeight - 1),
  };
}

export function rgbToHex(color: ChromaKeyColor): string {
  return `#${color
    .map((channel) =>
      Math.round(Math.min(255, Math.max(0, channel)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

export function rgbToHsl([rInput, gInput, bInput]: ChromaKeyColor): HslColor {
  const r = rInput / 255;
  const g = gInput / 255;
  const b = bInput / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) {
    return { h: 0, s: 0, l: Math.round(l * 100) };
  }
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return {
    h: Math.round(h * 60),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export function buildChromaKeySamplePatch(clip: Pick<Clip, 'chromaKey'>, color: ChromaKeyColor): ClipPatch {
  const chromaKey = normalizeChromaKey(clip.chromaKey);
  const colors =
    chromaKey.colors.length >= MAX_CHROMA_KEY_COLORS
      ? [...chromaKey.colors.slice(0, MAX_CHROMA_KEY_COLORS - 1), color]
      : [...chromaKey.colors, color];
  return {
    chromaKey: { ...chromaKey, enabled: true, color: colors[0], colors },
  };
}

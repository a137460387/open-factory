import type { PreviewFrameReadback } from './renderer';

export type PreviewCompareMode = 'left-right' | 'top-bottom' | 'difference';

export interface PreviewCompareBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PreviewComparePointer {
  clientX: number;
  clientY: number;
}

export interface PreviewCompareStyle {
  clipPath?: string;
  left?: string;
  top?: string;
  width?: string;
  height?: string;
  transform?: string;
}

export function clampPreviewCompareSplitRatio(value: number): number {
  if (!Number.isFinite(value)) {
    return 0.5;
  }
  return Math.min(0.9, Math.max(0.1, value));
}

export function calculatePreviewCompareSplitRatio(mode: PreviewCompareMode, pointer: PreviewComparePointer, bounds: PreviewCompareBounds): number {
  if (mode === 'top-bottom') {
    return clampPreviewCompareSplitRatio((pointer.clientY - bounds.top) / Math.max(1, bounds.height));
  }
  return clampPreviewCompareSplitRatio((pointer.clientX - bounds.left) / Math.max(1, bounds.width));
}

export function buildPreviewCompareOverlayStyle(mode: PreviewCompareMode, splitRatio: number): PreviewCompareStyle {
  const ratio = clampPreviewCompareSplitRatio(splitRatio);
  if (mode === 'top-bottom') {
    return { clipPath: `inset(${formatPercent(ratio)} 0 0 0)` };
  }
  if (mode === 'difference') {
    return { clipPath: 'inset(0 0 0 0)' };
  }
  return { clipPath: `inset(0 0 0 ${formatPercent(ratio)})` };
}

export function buildPreviewCompareDividerStyle(mode: PreviewCompareMode, splitRatio: number): PreviewCompareStyle {
  const ratio = formatPercent(clampPreviewCompareSplitRatio(splitRatio));
  if (mode === 'top-bottom') {
    return {
      top: ratio,
      left: '0',
      width: '100%',
      height: '2px',
      transform: 'translateY(-1px)'
    };
  }
  return {
    left: ratio,
    top: '0',
    width: '2px',
    height: '100%',
    transform: 'translateX(-1px)'
  };
}

export function drawPreviewDifferenceFrame(canvas: HTMLCanvasElement, processed: PreviewFrameReadback, original: PreviewFrameReadback): void {
  const width = Math.min(processed.width, original.width);
  const height = Math.min(processed.height, original.height);
  const context = canvas.getContext('2d');
  if (!context || width <= 0 || height <= 0) {
    return;
  }
  if (canvas.width !== width) {
    canvas.width = width;
  }
  if (canvas.height !== height) {
    canvas.height = height;
  }
  const image = context.createImageData(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const processedOffset = getFrameOffset(processed, x, y);
      const originalOffset = getFrameOffset(original, x, y);
      const outputOffset = (y * width + x) * 4;
      image.data[outputOffset] = Math.min(255, Math.abs(processed.data[processedOffset] - original.data[originalOffset]) * 2);
      image.data[outputOffset + 1] = Math.min(255, Math.abs(processed.data[processedOffset + 1] - original.data[originalOffset + 1]) * 2);
      image.data[outputOffset + 2] = Math.min(255, Math.abs(processed.data[processedOffset + 2] - original.data[originalOffset + 2]) * 2);
      image.data[outputOffset + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
}

function getFrameOffset(frame: PreviewFrameReadback, x: number, y: number): number {
  const sourceY = frame.origin === 'bottom-left' ? frame.height - 1 - y : y;
  return (sourceY * frame.width + x) * 4;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 1000) / 10}%`;
}

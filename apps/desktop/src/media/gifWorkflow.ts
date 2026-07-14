import { fileNameFromPath } from '../lib/tauri';
import type { GifDitherAlgorithm } from '../lib/tauri-bridge';

export interface GifWorkflowSettings {
  frameRate: number;
  scaleWidth: number;
  startTime: number;
  duration: number;
  loopCount: number;
  dither: GifDitherAlgorithm;
}

export interface GifSizeEstimateInput {
  sourceWidth?: number;
  sourceHeight?: number;
  scaleWidth: number;
  frameRate: number;
  duration: number;
}

export const DEFAULT_GIF_WORKFLOW_SETTINGS: GifWorkflowSettings = {
  frameRate: 12,
  scaleWidth: 480,
  startTime: 0,
  duration: 3,
  loopCount: 0,
  dither: 'floyd_steinberg',
};

const GIF_COMPRESSION_FACTOR = 0.14;

export function normalizeGifWorkflowSettings(
  value: Partial<GifWorkflowSettings>,
  sourceDuration?: number,
): GifWorkflowSettings {
  const maxDuration =
    Number.isFinite(sourceDuration) && sourceDuration !== undefined && sourceDuration > 0
      ? sourceDuration
      : Number.POSITIVE_INFINITY;
  const startTime = clampNumber(value.startTime, 0, Math.max(0, maxDuration), DEFAULT_GIF_WORKFLOW_SETTINGS.startTime);
  const remainingDuration = Number.isFinite(maxDuration)
    ? Math.max(0.1, maxDuration - startTime)
    : Number.POSITIVE_INFINITY;
  return {
    frameRate: Math.round(clampNumber(value.frameRate, 1, 30, DEFAULT_GIF_WORKFLOW_SETTINGS.frameRate)),
    scaleWidth: Math.round(clampNumber(value.scaleWidth, 16, 4096, DEFAULT_GIF_WORKFLOW_SETTINGS.scaleWidth)),
    startTime,
    duration: clampNumber(
      value.duration,
      0.1,
      remainingDuration,
      Math.min(DEFAULT_GIF_WORKFLOW_SETTINGS.duration, remainingDuration),
    ),
    loopCount: Math.round(clampNumber(value.loopCount, 0, 100, DEFAULT_GIF_WORKFLOW_SETTINGS.loopCount)),
    dither:
      value.dither === 'bayer' || value.dither === 'floyd_steinberg'
        ? value.dither
        : DEFAULT_GIF_WORKFLOW_SETTINGS.dither,
  };
}

export function buildDefaultGifOutputPath(sourcePath: string): string {
  const normalized = sourcePath.replace(/\\/g, '/');
  const slash = normalized.lastIndexOf('/');
  const dir = slash >= 0 ? normalized.slice(0, slash + 1) : '';
  const fileName = fileNameFromPath(sourcePath);
  const baseName = fileName.replace(/\.[^.]+$/, '') || 'animation';
  return `${dir}${baseName}_animated.gif`;
}

export function estimateGifFileSizeBytes(input: GifSizeEstimateInput): number {
  const sourceWidth = Math.max(1, input.sourceWidth ?? input.scaleWidth);
  const sourceHeight = Math.max(1, input.sourceHeight ?? Math.round((input.scaleWidth * 9) / 16));
  const scale = Math.min(1, Math.max(16, input.scaleWidth) / sourceWidth);
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const frames = Math.max(
    1,
    Math.ceil(
      clampNumber(input.frameRate, 1, 30, DEFAULT_GIF_WORKFLOW_SETTINGS.frameRate) * Math.max(0.1, input.duration),
    ),
  );
  return Math.max(1024, Math.round(width * height * frames * 3 * GIF_COMPRESSION_FACTOR));
}

export function formatGifFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, numeric));
}

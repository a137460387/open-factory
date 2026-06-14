import { clamp, round } from './time';
import type { EffectParams, EffectParamValue } from './effects';

export type MotionBlurSampleCount = 4 | 8 | 16 | 32;

export interface MotionBlurParams extends EffectParams {
  intensity: number;
  angle: number;
  samples: MotionBlurSampleCount;
  jitter: number;
}

export interface MotionBlurSampleOffset {
  x: number;
  y: number;
}

export interface MotionBlurConvolutionKernel {
  size: number;
  matrix: number[];
  sum: number;
}

export const MOTION_BLUR_SAMPLE_COUNTS: MotionBlurSampleCount[] = [4, 8, 16, 32];
export const DEFAULT_MOTION_BLUR_PARAMS: MotionBlurParams = { intensity: 0, angle: 0, samples: 8, jitter: 0 };

export function normalizeMotionBlurParams(params: EffectParams | undefined): MotionBlurParams {
  return {
    intensity: normalizeNumber(params?.intensity, DEFAULT_MOTION_BLUR_PARAMS.intensity, 0, 1),
    angle: normalizeAngle(params?.angle, DEFAULT_MOTION_BLUR_PARAMS.angle),
    samples: normalizeMotionBlurSampleCount(params?.samples, DEFAULT_MOTION_BLUR_PARAMS.samples),
    jitter: normalizeNumber(params?.jitter, DEFAULT_MOTION_BLUR_PARAMS.jitter, 0, 1)
  };
}

export function calculateMotionBlurSampleOffsets(params: Partial<MotionBlurParams>, radiusPixels = 24): MotionBlurSampleOffset[] {
  const normalized = normalizeMotionBlurParams(params as EffectParams);
  const span = Math.max(0, radiusPixels) * normalized.intensity;
  if (span <= 0) {
    return [{ x: 0, y: 0 }];
  }
  const radians = (normalized.angle * Math.PI) / 180;
  const dx = Math.cos(radians) * span;
  const dy = Math.sin(radians) * span;
  return Array.from({ length: normalized.samples }, (_, index) => {
    const offset = index / (normalized.samples - 1) - 0.5;
    return {
      x: round(dx * offset, 4),
      y: round(dy * offset, 4)
    };
  });
}

export function buildMotionBlurConvolutionKernel(params: Partial<MotionBlurParams>, maxSize = 7): MotionBlurConvolutionKernel {
  const normalized = normalizeMotionBlurParams(params as EffectParams);
  const size = normalizeKernelSize(maxSize);
  const center = Math.floor(size / 2);
  const matrix = Array.from({ length: size * size }, () => 0);
  if (normalized.intensity <= 0) {
    matrix[center * size + center] = 1;
    return { size, matrix, sum: 1 };
  }

  const offsets = calculateMotionBlurSampleOffsets(normalized, center);
  const blurWeight = normalized.intensity / offsets.length;
  const baseWeight = 1 - normalized.intensity;
  matrix[center * size + center] += baseWeight;
  for (const offset of offsets) {
    const x = clamp(center + quantizeKernelOffset(offset.x), 0, size - 1);
    const y = clamp(center + quantizeKernelOffset(offset.y), 0, size - 1);
    matrix[y * size + x] += blurWeight;
  }
  const rounded = matrix.map((value) => round(value, 6));
  return { size, matrix: rounded, sum: round(rounded.reduce((total, value) => total + value, 0), 6) };
}

export function buildMotionBlurConvolutionFilter(params: Partial<MotionBlurParams>): string | undefined {
  const normalized = normalizeMotionBlurParams(params as EffectParams);
  if (normalized.intensity <= 0) {
    return undefined;
  }
  const kernel = buildMotionBlurConvolutionKernel(normalized, 3);
  const coefficients = kernel.matrix.map((value) => Math.max(0, Math.round(value * 1000)));
  const coefficientSum = Math.max(1, coefficients.reduce((total, value) => total + value, 0));
  const matrix = formatKernelMatrix(coefficients);
  const alpha = formatKernelMatrix(buildIdentityKernel(kernel.size));
  const filters = [
    `convolution=0m='${matrix}':1m='${matrix}':2m='${matrix}':3m='${alpha}':0rdiv=${coefficientSum}:1rdiv=${coefficientSum}:2rdiv=${coefficientSum}:3rdiv=1`
  ];
  if (normalized.jitter > 0) {
    const inset = Math.max(2, Math.round(normalized.jitter * 12));
    const amplitude = formatFfmpegNumber(Math.max(0.5, normalized.jitter * inset));
    filters.push(
      `crop=w='iw-${inset * 2}':h='ih-${inset * 2}':x='${inset}+sin(n*12.9898)*${amplitude}':y='${inset}+cos(n*78.233)*${amplitude}',scale=iw+${inset * 2}:ih+${inset * 2}`
    );
  }
  return filters.join(',');
}

export function buildMotionBlurExportFilter(params: Partial<MotionBlurParams>, fps = 30): string | undefined {
  const normalized = normalizeMotionBlurParams(params as EffectParams);
  if (normalized.intensity <= 0) {
    return undefined;
  }
  const safeFps = Math.max(1, Math.round(Number.isFinite(fps) ? fps : 30));
  const interpolationMultiplier = normalized.samples >= 32 ? 4 : normalized.samples >= 16 ? 3 : 2;
  const interpolationFps = Math.max(safeFps + 1, safeFps * interpolationMultiplier);
  const filters = [`minterpolate=fps=${interpolationFps}:mi_mode=blend`, `tblend=all_mode=average:all_opacity=${formatFfmpegNumber(normalized.intensity)}`];
  if (normalized.jitter > 0) {
    const inset = Math.max(2, Math.round(normalized.jitter * 12));
    const amplitude = formatFfmpegNumber(Math.max(0.5, normalized.jitter * inset));
    filters.push(
      `crop=w='iw-${inset * 2}':h='ih-${inset * 2}':x='${inset}+sin(n*12.9898)*${amplitude}':y='${inset}+cos(n*78.233)*${amplitude}',scale=iw+${inset * 2}:ih+${inset * 2}`
    );
  }
  return filters.join(',');
}

export function buildMotionBlurPreviewVector(params: Partial<MotionBlurParams>, maxPixels = 24): { x: number; y: number; samples: number; jitter: number } {
  const normalized = normalizeMotionBlurParams(params as EffectParams);
  const radians = (normalized.angle * Math.PI) / 180;
  const span = Math.max(0, maxPixels) * normalized.intensity;
  return {
    x: round(Math.cos(radians) * span, 4),
    y: round(Math.sin(radians) * span, 4),
    samples: normalized.intensity <= 0 ? 0 : normalized.samples,
    jitter: round(normalized.jitter * 8, 4)
  };
}

function normalizeNumber(value: EffectParamValue | undefined, fallback: number, min: number, max: number): number {
  return round(clamp(typeof value === 'number' && Number.isFinite(value) ? value : fallback, min, max));
}

function normalizeAngle(value: EffectParamValue | undefined, fallback: number): number {
  const raw = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return round(((raw % 360) + 360) % 360);
}

function normalizeMotionBlurSampleCount(value: EffectParamValue | undefined, fallback: MotionBlurSampleCount): MotionBlurSampleCount {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : Number(value);
  const nearest = MOTION_BLUR_SAMPLE_COUNTS.reduce((best, candidate) => (Math.abs(candidate - numeric) < Math.abs(best - numeric) ? candidate : best), fallback);
  return MOTION_BLUR_SAMPLE_COUNTS.includes(nearest) ? nearest : fallback;
}

function normalizeKernelSize(value: number): number {
  const rounded = Math.max(3, Math.min(15, Math.round(value)));
  return rounded % 2 === 0 ? rounded - 1 : rounded;
}

function quantizeKernelOffset(value: number): number {
  if (Math.abs(value) < 0.000001) {
    return 0;
  }
  return value < 0 ? Math.floor(value) : Math.ceil(value);
}

function buildIdentityKernel(size: number): number[] {
  const matrix = Array.from({ length: size * size }, () => 0);
  const center = Math.floor(size / 2);
  matrix[center * size + center] = 1;
  return matrix;
}

function formatKernelMatrix(matrix: number[]): string {
  return matrix.map(formatFfmpegNumber).join(' ');
}

function formatFfmpegNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return '0';
  }
  const rounded = round(value, 6);
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/0+$/, '').replace(/\.$/, '');
}

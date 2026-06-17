import { round } from './time';
import type { TargetAspectRatio } from './reframe';

export const THUMBNAIL_SAMPLE_COUNT = 20;
export const THUMBNAIL_TOP_CANDIDATE_COUNT = 5;

export type ThumbnailPlatformPreset = 'youtube' | 'bilibili' | 'douyin';

export interface ThumbnailPlatformSize {
  width: number;
  height: number;
  label: string;
  aspectRatio: Exclude<TargetAspectRatio, 'source'>;
}

export const THUMBNAIL_PLATFORM_SIZES: Record<ThumbnailPlatformPreset, ThumbnailPlatformSize> = {
  youtube: { width: 1280, height: 720, label: 'YouTube 1280x720', aspectRatio: '16:9' },
  bilibili: { width: 1920, height: 1080, label: 'B站 1920x1080', aspectRatio: '16:9' },
  douyin: { width: 1080, height: 1920, label: '抖音 1080x1920', aspectRatio: '9:16' }
};

export interface ThumbnailExportSettings {
  width: number;
  height: number;
  format: 'jpg';
  outputMode: 'video';
  audioCodec: 'aac';
  scaleMode: 'none' | 'fit';
  targetAspectRatio: TargetAspectRatio;
}

export interface ThumbnailFrameSample {
  timestamp: number;
  width: number;
  height: number;
  data: ArrayLike<number>;
  faceDetected?: boolean;
}

export interface ThumbnailScoreBreakdown {
  face: number;
  clarity: number;
  color: number;
  motion: number;
  total: number;
}

export interface ThumbnailCandidate extends ThumbnailFrameSample {
  score: ThumbnailScoreBreakdown;
}

export function buildThumbnailSampleTimestamps(duration: number, count = THUMBNAIL_SAMPLE_COUNT): number[] {
  const safeDuration = Number.isFinite(duration) ? Math.max(0, duration) : 0;
  const safeCount = Math.max(1, Math.round(Number.isFinite(count) ? count : THUMBNAIL_SAMPLE_COUNT));
  if (safeDuration <= 0) {
    return Array.from({ length: safeCount }, () => 0);
  }
  const step = safeDuration / (safeCount + 1);
  return Array.from({ length: safeCount }, (_item, index) => round(Math.min(safeDuration, step * (index + 1))));
}

export function normalizeThumbnailPlatformPreset(value: unknown): ThumbnailPlatformPreset {
  return value === 'bilibili' || value === 'douyin' ? value : 'youtube';
}

export function getThumbnailPlatformSize(value: unknown): ThumbnailPlatformSize {
  return THUMBNAIL_PLATFORM_SIZES[normalizeThumbnailPlatformPreset(value)];
}

export function buildThumbnailExportSettings(value: unknown, crop = true): ThumbnailExportSettings {
  const size = getThumbnailPlatformSize(value);
  return {
    width: size.width,
    height: size.height,
    format: 'jpg',
    outputMode: 'video',
    audioCodec: 'aac',
    scaleMode: crop ? 'none' : 'fit',
    targetAspectRatio: crop ? size.aspectRatio : 'source'
  };
}

export function rankThumbnailCandidates(candidates: readonly ThumbnailCandidate[], limit = THUMBNAIL_TOP_CANDIDATE_COUNT): ThumbnailCandidate[] {
  return [...candidates]
    .sort((left, right) => right.score.total - left.score.total || right.score.face - left.score.face || right.score.clarity - left.score.clarity || left.timestamp - right.timestamp)
    .slice(0, Math.max(1, Math.round(limit)));
}

export function scoreThumbnailFrame(sample: ThumbnailFrameSample, neighbors: { previous?: ThumbnailFrameSample; next?: ThumbnailFrameSample } = {}): ThumbnailScoreBreakdown {
  const face = sample.faceDetected ? 40 : 0;
  const clarity = clampScore(laplacianVarianceScore(sample), 25);
  const color = clampScore(colorRichnessScore(sample), 20);
  const motion = clampScore(lowMotionScore(sample, neighbors.previous, neighbors.next), 15);
  return {
    face,
    clarity,
    color,
    motion,
    total: round(face + clarity + color + motion)
  };
}

export function buildThumbnailOutputFileStem(name: string): string {
  const base = name
    .trim()
    .replace(/\.[^.\\/]+$/, '')
    .replace(/[^a-zA-Z0-9._\u4e00-\u9fa5-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'thumb';
}

export function buildThumbnailOutputFileName(name: string): string {
  return `${buildThumbnailOutputFileStem(name)}_thumb.jpg`;
}

export function buildThumbnailOutputPath(directory: string, sourceName: string): string {
  const normalizedDir = directory.trim().replace(/\\/g, '/').replace(/\/+$/g, '');
  const fileName = buildThumbnailOutputFileName(sourceName);
  return normalizedDir ? `${normalizedDir}/${fileName}` : fileName;
}

function clampScore(value: number, max: number): number {
  return round(Math.min(max, Math.max(0, Number.isFinite(value) ? value : 0)));
}

function laplacianVarianceScore(sample: ThumbnailFrameSample): number {
  const gray = toGrayscale(sample);
  if (gray.length === 0) {
    return 0;
  }
  const width = sample.width;
  const height = sample.height;
  const values: number[] = [];
  for (let y = 1; y + 1 < height; y += 1) {
    for (let x = 1; x + 1 < width; x += 1) {
      const center = gray[y * width + x] ?? 0;
      const laplacian = 4 * center - (gray[y * width + (x - 1)] ?? 0) - (gray[y * width + (x + 1)] ?? 0) - (gray[(y - 1) * width + x] ?? 0) - (gray[(y + 1) * width + x] ?? 0);
      values.push(laplacian);
    }
  }
  if (values.length === 0) {
    return 0;
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return (variance / (variance + 120)) * 25;
}

function colorRichnessScore(sample: ThumbnailFrameSample): number {
  const data = sample.data;
  let count = 0;
  let spread = 0;
  for (let index = 0; index + 2 < data.length; index += 4) {
    const r = clampByte(data[index]);
    const g = clampByte(data[index + 1]);
    const b = clampByte(data[index + 2]);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const saturation = max <= 0 ? 0 : (max - min) / max;
    spread += saturation;
    count += 1;
  }
  if (count === 0) {
    return 0;
  }
  const average = spread / count;
  return Math.min(20, average * 20);
}

function lowMotionScore(sample: ThumbnailFrameSample, previous?: ThumbnailFrameSample, next?: ThumbnailFrameSample): number {
  const currentGray = toGrayscale(sample);
  const source = previous ? toGrayscale(previous) : next ? toGrayscale(next) : undefined;
  if (!source || source.length === 0 || currentGray.length === 0) {
    return 15;
  }
  const length = Math.min(source.length, currentGray.length);
  let diff = 0;
  for (let index = 0; index < length; index += 1) {
    diff += Math.abs(currentGray[index] - source[index]);
  }
  const averageDiff = diff / length;
  return Math.max(0, 15 * (1 - averageDiff / 0.18));
}

function toGrayscale(sample: ThumbnailFrameSample): Float32Array {
  const { width, height, data } = sample;
  const output = new Float32Array(Math.max(0, width * height));
  if (width <= 0 || height <= 0) {
    return output;
  }
  for (let index = 0, offset = 0; index + 2 < data.length && offset < output.length; index += 4, offset += 1) {
    const r = clampByte(data[index]);
    const g = clampByte(data[index + 1]);
    const b = clampByte(data[index + 2]);
    output[offset] = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  }
  return output;
}

function clampByte(value: number): number {
  return Math.min(255, Math.max(0, Number.isFinite(value) ? value : 0));
}

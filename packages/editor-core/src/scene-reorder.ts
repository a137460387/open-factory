import type { Timeline } from './model';
import { buildStoryboardReorderStarts, getStoryboardCards } from './storyboard';

export type SceneReorderStrategy =
  'brightness-asc' | 'brightness-desc' | 'color-similar' | 'motion-rhythm' | 'duration-balance';

export interface SceneFrameSample {
  pixels: Array<readonly [number, number, number]>;
  motionFromPrevious?: number;
  weight?: number;
}

export interface SceneClipFeatureInput {
  clipId: string;
  duration: number;
  frames: SceneFrameSample[];
}

export interface SceneClipFeatures {
  clipId: string;
  histogram: number[];
  brightness: number;
  motion: number;
  duration: number;
  analyzed: boolean;
}

const CHANNEL_BINS = 4;
const HISTOGRAM_LENGTH = CHANNEL_BINS * 3;
const EPSILON = 0.000001;

export function extractSceneClipFeatures(input: SceneClipFeatureInput): SceneClipFeatures {
  const histogram = Array.from({ length: HISTOGRAM_LENGTH }, () => 0);
  let weightedBrightness = 0;
  let totalWeight = 0;
  let motionTotal = 0;
  let motionWeight = 0;
  let previousBrightness: number | undefined;
  let pixelCount = 0;

  for (const frame of input.frames) {
    const pixels = frame.pixels.filter(isRgbPixel);
    if (pixels.length === 0) {
      continue;
    }
    const weight = normalizePositive(frame.weight, 1);
    let frameBrightness = 0;

    for (const pixel of pixels) {
      const [red, green, blue] = pixel.map(clampByte) as [number, number, number];
      histogram[colorBin(red)] += weight;
      histogram[CHANNEL_BINS + colorBin(green)] += weight;
      histogram[CHANNEL_BINS * 2 + colorBin(blue)] += weight;
      frameBrightness += luminance(red, green, blue);
      pixelCount += 1;
    }

    frameBrightness /= pixels.length;
    weightedBrightness += frameBrightness * weight;
    totalWeight += weight;

    if (Number.isFinite(frame.motionFromPrevious)) {
      motionTotal += clamp01(Number(frame.motionFromPrevious)) * weight;
      motionWeight += weight;
    } else if (previousBrightness !== undefined) {
      motionTotal += Math.abs(frameBrightness - previousBrightness) * weight;
      motionWeight += weight;
    }
    previousBrightness = frameBrightness;
  }

  const histogramTotal = histogram.reduce((sum, value) => sum + value, 0);
  const normalizedHistogram = histogramTotal > EPSILON ? histogram.map((value) => value / histogramTotal) : histogram;

  return {
    clipId: input.clipId,
    histogram: normalizedHistogram,
    brightness: totalWeight > EPSILON ? clamp01(weightedBrightness / totalWeight) : 0,
    motion: motionWeight > EPSILON ? clamp01(motionTotal / motionWeight) : 0,
    duration: Math.max(0, input.duration),
    analyzed: pixelCount > 0,
  };
}

export function createFallbackSceneClipFeatures(input: {
  clipId: string;
  duration: number;
  brightness?: number;
  motion?: number;
  color?: readonly [number, number, number];
}): SceneClipFeatures {
  const color = input.color ?? [128, 128, 128];
  const histogram = Array.from({ length: HISTOGRAM_LENGTH }, () => 0);
  histogram[colorBin(clampByte(color[0]))] += 1 / 3;
  histogram[CHANNEL_BINS + colorBin(clampByte(color[1]))] += 1 / 3;
  histogram[CHANNEL_BINS * 2 + colorBin(clampByte(color[2]))] += 1 / 3;
  return {
    clipId: input.clipId,
    histogram,
    brightness: clamp01(input.brightness ?? luminance(clampByte(color[0]), clampByte(color[1]), clampByte(color[2]))),
    motion: clamp01(input.motion ?? 0),
    duration: Math.max(0, input.duration),
    analyzed: false,
  };
}

export function orderSceneClipFeatures(
  features: SceneClipFeatures[],
  strategy: SceneReorderStrategy,
): SceneClipFeatures[] {
  const stable = features.map((feature, index) => ({ feature, index }));
  if (strategy === 'brightness-asc' || strategy === 'brightness-desc') {
    const direction = strategy === 'brightness-asc' ? 1 : -1;
    return stable
      .sort(
        (left, right) =>
          direction * (left.feature.brightness - right.feature.brightness) ||
          left.index - right.index ||
          left.feature.clipId.localeCompare(right.feature.clipId),
      )
      .map((item) => item.feature);
  }
  if (strategy === 'color-similar') {
    return orderByGreedyColorSimilarity(features);
  }
  if (strategy === 'motion-rhythm') {
    return orderByMotionRhythm(features);
  }
  return orderByDurationBalance(features);
}

export function buildSceneReorderClipIds(
  currentIds: string[],
  selectedIds: string[],
  orderedSelectedIds: string[],
): string[] {
  const selected = new Set(selectedIds);
  const ordered = orderedSelectedIds.filter((id) => selected.has(id));
  const orderedSet = new Set(ordered);
  if (ordered.length !== selected.size) {
    return [...currentIds];
  }
  let cursor = 0;
  return currentIds.map((id) => {
    if (!selected.has(id)) {
      return id;
    }
    const next = ordered[cursor++] ?? id;
    return orderedSet.has(next) ? next : id;
  });
}

export function buildSceneReorderStarts(
  timeline: Timeline,
  selectedClipIds: string[],
  orderedSelectedClipIds: string[],
): Record<string, number> {
  const currentIds = getStoryboardCards(timeline).map((card) => card.clip.id);
  const nextIds = buildSceneReorderClipIds(currentIds, selectedClipIds, orderedSelectedClipIds);
  return buildStoryboardReorderStarts(timeline, nextIds);
}

export function sceneHistogramDistance(left: SceneClipFeatures, right: SceneClipFeatures): number {
  const length = Math.max(left.histogram.length, right.histogram.length);
  let sum = 0;
  for (let index = 0; index < length; index += 1) {
    sum += Math.abs((left.histogram[index] ?? 0) - (right.histogram[index] ?? 0));
  }
  return sum;
}

function orderByGreedyColorSimilarity(features: SceneClipFeatures[]): SceneClipFeatures[] {
  const [first, ...rest] = features;
  if (!first) {
    return [];
  }
  const ordered = [first];
  const remaining = [...rest];
  while (remaining.length > 0) {
    const current = ordered[ordered.length - 1];
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < remaining.length; index += 1) {
      const candidate = remaining[index];
      const distance = sceneHistogramDistance(current, candidate);
      if (
        distance < bestDistance - EPSILON ||
        (Math.abs(distance - bestDistance) <= EPSILON &&
          candidate.clipId.localeCompare(remaining[bestIndex].clipId) < 0)
      ) {
        bestDistance = distance;
        bestIndex = index;
      }
    }
    ordered.push(remaining.splice(bestIndex, 1)[0]);
  }
  return ordered;
}

function orderByMotionRhythm(features: SceneClipFeatures[]): SceneClipFeatures[] {
  const sorted = [...features].sort(
    (left, right) => left.motion - right.motion || left.clipId.localeCompare(right.clipId),
  );
  const positions: number[] = [];
  let left = 0;
  let right = sorted.length - 1;
  while (left <= right) {
    if (left === right) {
      positions.push(left);
    } else {
      positions.push(left, right);
    }
    left += 1;
    right -= 1;
  }
  const output: SceneClipFeatures[] = [];
  sorted.forEach((feature, index) => {
    output[positions[index]] = feature;
  });
  return output;
}

function orderByDurationBalance(features: SceneClipFeatures[]): SceneClipFeatures[] {
  const sorted = [...features].sort(
    (left, right) => right.duration - left.duration || left.clipId.localeCompare(right.clipId),
  );
  const output: SceneClipFeatures[] = [];
  let longIndex = 0;
  let shortIndex = sorted.length - 1;
  while (longIndex <= shortIndex) {
    output.push(sorted[longIndex]);
    if (longIndex !== shortIndex) {
      output.push(sorted[shortIndex]);
    }
    longIndex += 1;
    shortIndex -= 1;
  }
  return output;
}

function luminance(red: number, green: number, blue: number): number {
  return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
}

function colorBin(value: number): number {
  return Math.min(CHANNEL_BINS - 1, Math.floor((clampByte(value) / 256) * CHANNEL_BINS));
}

function clampByte(value: number): number {
  return Math.min(255, Math.max(0, Math.round(Number.isFinite(value) ? value : 0)));
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

function normalizePositive(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

function isRgbPixel(pixel: readonly [number, number, number]): boolean {
  return Array.isArray(pixel) && pixel.length >= 3;
}

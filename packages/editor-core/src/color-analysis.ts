import { buildColorMatchCurves, type ColorMatchFrameSample } from './color-match';
import type { ColorCorrection } from './model';
import { clamp, round } from './time';

export type ColorTintBias = 'warm' | 'cool' | 'neutral';

export interface RgbMean {
  r: number;
  g: number;
  b: number;
}

export interface ColorAnalysisMetrics {
  averageBrightness: number;
  colorTemperatureKelvin: number;
  averageSaturation: number;
  contrast: number;
  cbMean: number;
  crMean: number;
  tintBias: ColorTintBias;
  meanRgb: RgbMean;
}

export interface TimelineColorAnalysisResult {
  clipId: string;
  trackId?: string;
  mediaId?: string;
  name?: string;
  start: number;
  duration: number;
  metrics: ColorAnalysisMetrics;
}

export interface TimelineColorHeatmapPoint {
  clipId: string;
  start: number;
  end: number;
  height: number;
  color: string;
  brightness: number;
  colorTemperatureKelvin: number;
}

export interface SceneColorDifference {
  fromClipId: string;
  toClipId: string;
  time: number;
  score: number;
  temperatureDelta: number;
  brightnessDelta: number;
  saturationDelta: number;
  contrastDelta: number;
  tintDelta: number;
}

export interface SceneColorDifferenceThresholds {
  score?: number;
  temperatureKelvin?: number;
  brightness?: number;
  saturation?: number;
  contrast?: number;
  tint?: number;
}

export interface ColorAnalysisClipSample {
  clipId: string;
  sample: ColorMatchFrameSample;
}

export interface ColorAlignmentUpdate {
  clipId: string;
  colorCorrection: Partial<ColorCorrection>;
}

const DEFAULT_SCENE_DIFFERENCE_THRESHOLDS: Required<SceneColorDifferenceThresholds> = {
  score: 0.35,
  temperatureKelvin: 1800,
  brightness: 48,
  saturation: 0.22,
  contrast: 24,
  tint: 28,
};

export function analyzeColorFrameSample(sample: ColorMatchFrameSample): ColorAnalysisMetrics {
  let pixelCount = 0;
  let brightnessSum = 0;
  let brightnessSqSum = 0;
  let saturationSum = 0;
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let cbSum = 0;
  let crSum = 0;
  for (let index = 0; index + 2 < sample.data.length; index += 4) {
    const alpha = sample.data[index + 3] ?? 255;
    if (alpha <= 0) {
      continue;
    }
    const r = clampByte(sample.data[index]);
    const g = clampByte(sample.data[index + 1]);
    const b = clampByte(sample.data[index + 2]);
    const brightness = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const saturation = calculateHsvSaturation(r, g, b);
    const chroma = calculateChromaMeans(r, g, b);
    rSum += r;
    gSum += g;
    bSum += b;
    brightnessSum += brightness;
    brightnessSqSum += brightness * brightness;
    saturationSum += saturation;
    cbSum += chroma.cb;
    crSum += chroma.cr;
    pixelCount += 1;
  }
  if (pixelCount === 0) {
    throw new Error('Color analysis requires at least one visible pixel.');
  }
  const meanRgb = {
    r: round(rSum / pixelCount),
    g: round(gSum / pixelCount),
    b: round(bSum / pixelCount),
  };
  const averageBrightness = round(brightnessSum / pixelCount);
  const contrast = round(Math.sqrt(Math.max(0, brightnessSqSum / pixelCount - averageBrightness * averageBrightness)));
  const cbMean = round(cbSum / pixelCount);
  const crMean = round(crSum / pixelCount);
  return {
    averageBrightness,
    colorTemperatureKelvin: estimateColorTemperatureKelvin(meanRgb),
    averageSaturation: round(saturationSum / pixelCount),
    contrast,
    cbMean,
    crMean,
    tintBias: classifyTintBias(cbMean, crMean),
    meanRgb,
  };
}

export function estimateColorTemperatureKelvin(meanRgb: RgbMean): number {
  const linear = {
    r: srgbToLinear(clampByte(meanRgb.r) / 255),
    g: srgbToLinear(clampByte(meanRgb.g) / 255),
    b: srgbToLinear(clampByte(meanRgb.b) / 255),
  };
  const x = linear.r * 0.4124564 + linear.g * 0.3575761 + linear.b * 0.1804375;
  const yLum = linear.r * 0.2126729 + linear.g * 0.7151522 + linear.b * 0.072175;
  const z = linear.r * 0.0193339 + linear.g * 0.119192 + linear.b * 0.9503041;
  const sum = x + yLum + z;
  if (sum <= 0) {
    return 6500;
  }
  const chromaX = x / sum;
  const chromaY = yLum / sum;
  const n = (chromaX - 0.332) / (0.1858 - chromaY || 0.000001);
  let kelvin = -449 * n ** 3 + 3525 * n ** 2 - 6823.3 * n + 5520.33;
  const r = clampByte(meanRgb.r);
  const g = clampByte(meanRgb.g);
  const b = clampByte(meanRgb.b);
  if (r > b + 8) {
    const warmEstimate = 6500 - ((r - b) / 255) * 5500 - (Math.max(0, r - g) / 255) * 1200;
    kelvin = Math.min(kelvin, warmEstimate);
  } else if (b > r + 8) {
    const coolEstimate = 6500 + ((b - r) / 255) * 9000 + (Math.max(0, b - g) / 255) * 1500;
    kelvin = Math.max(kelvin, coolEstimate);
  }
  return Math.round(clamp(kelvin, 1500, 20000));
}

export function buildTimelineColorHeatmapData(results: TimelineColorAnalysisResult[]): TimelineColorHeatmapPoint[] {
  return [...results]
    .sort((left, right) => left.start - right.start || left.clipId.localeCompare(right.clipId))
    .map((result) => ({
      clipId: result.clipId,
      start: result.start,
      end: result.start + result.duration,
      height: round(clamp(result.metrics.averageBrightness / 255, 0, 1)),
      color: colorTemperatureToHeatmapColor(result.metrics.colorTemperatureKelvin),
      brightness: result.metrics.averageBrightness,
      colorTemperatureKelvin: result.metrics.colorTemperatureKelvin,
    }));
}

export function detectSceneColorJumps(
  results: TimelineColorAnalysisResult[],
  thresholds: SceneColorDifferenceThresholds = {},
): SceneColorDifference[] {
  const resolved = { ...DEFAULT_SCENE_DIFFERENCE_THRESHOLDS, ...thresholds };
  const ordered = [...results].sort(
    (left, right) => left.start - right.start || left.clipId.localeCompare(right.clipId),
  );
  const differences: SceneColorDifference[] = [];
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const next = ordered[index];
    const difference = calculateSceneColorDifference(previous, next);
    if (
      difference.score >= resolved.score ||
      difference.temperatureDelta >= resolved.temperatureKelvin ||
      difference.brightnessDelta >= resolved.brightness ||
      difference.saturationDelta >= resolved.saturation ||
      difference.contrastDelta >= resolved.contrast ||
      difference.tintDelta >= resolved.tint
    ) {
      differences.push(difference);
    }
  }
  return differences;
}

export function buildColorAlignmentUpdates(
  samples: ColorAnalysisClipSample[],
  referenceClipId: string,
): ColorAlignmentUpdate[] {
  const reference = samples.find((item) => item.clipId === referenceClipId);
  if (!reference) {
    return [];
  }
  return samples
    .filter((item) => item.clipId !== referenceClipId)
    .map((item) => ({
      clipId: item.clipId,
      colorCorrection: {
        colorCurves: buildColorMatchCurves(item.sample, reference.sample),
      },
    }));
}

function calculateSceneColorDifference(
  left: TimelineColorAnalysisResult,
  right: TimelineColorAnalysisResult,
): SceneColorDifference {
  const temperatureDelta = Math.abs(left.metrics.colorTemperatureKelvin - right.metrics.colorTemperatureKelvin);
  const brightnessDelta = Math.abs(left.metrics.averageBrightness - right.metrics.averageBrightness);
  const saturationDelta = Math.abs(left.metrics.averageSaturation - right.metrics.averageSaturation);
  const contrastDelta = Math.abs(left.metrics.contrast - right.metrics.contrast);
  const tintDelta = Math.hypot(left.metrics.cbMean - right.metrics.cbMean, left.metrics.crMean - right.metrics.crMean);
  const score = round(
    clamp(temperatureDelta / 6000, 0, 1) * 0.34 +
      clamp(brightnessDelta / 180, 0, 1) * 0.16 +
      clamp(saturationDelta / 0.75, 0, 1) * 0.16 +
      clamp(contrastDelta / 96, 0, 1) * 0.1 +
      clamp(tintDelta / 72, 0, 1) * 0.24,
  );
  return {
    fromClipId: left.clipId,
    toClipId: right.clipId,
    time: round(right.start),
    score,
    temperatureDelta,
    brightnessDelta,
    saturationDelta,
    contrastDelta,
    tintDelta: round(tintDelta),
  };
}

function calculateHsvSaturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max <= 0 ? 0 : (max - min) / max;
}

function calculateChromaMeans(r: number, g: number, b: number): { cb: number; cr: number } {
  return {
    cb: 128 - 0.168736 * r - 0.331264 * g + 0.5 * b,
    cr: 128 + 0.5 * r - 0.418688 * g - 0.081312 * b,
  };
}

function classifyTintBias(cbMean: number, crMean: number): ColorTintBias {
  const cbOffset = cbMean - 128;
  const crOffset = crMean - 128;
  if (crOffset > 5 && crOffset >= Math.abs(cbOffset)) {
    return 'warm';
  }
  if (cbOffset > 5 && cbOffset >= Math.abs(crOffset)) {
    return 'cool';
  }
  return 'neutral';
}

function colorTemperatureToHeatmapColor(kelvin: number): string {
  const normalized = clamp((kelvin - 2500) / 7000, 0, 1);
  const red = Math.round(238 - normalized * 120);
  const green = Math.round(116 + normalized * 72);
  const blue = Math.round(47 + normalized * 190);
  return `rgb(${red}, ${green}, ${blue})`;
}

function srgbToLinear(value: number): number {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function clampByte(value: number): number {
  return clamp(Number.isFinite(value) ? value : 0, 0, 255);
}

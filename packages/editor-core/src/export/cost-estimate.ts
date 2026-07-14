import { EFFECT_TYPES, type Effect, type EffectType } from '../effects';
import { getTimelinePlaybackDuration } from '../timeline';
import { round } from '../time';
import { isDefaultColorCorrection, type Clip, type Project, type Timeline } from '../model';
import type { ExportMasterProcessingSettings, ExportSettings } from './export-types';

export type ExportCostCpuLoad = 'light' | 'medium' | 'heavy';

export interface ExportCostHistorySample {
  timelineDurationSeconds?: number;
  exportDurationSeconds: number;
  estimatedDurationSeconds?: number;
}

export interface ExportCostFactorBreakdown {
  id: string;
  factor: number;
  weight: number;
}

export interface ExportCostEstimateInput {
  project: Project;
  settings?: Partial<Omit<ExportSettings, 'outputPath'>>;
  now?: Date | string | number;
  history?: ExportCostHistorySample[];
  qualityEvaluation?: boolean;
}

export interface ExportCostEstimate {
  timelineDurationSeconds: number;
  estimatedDurationSeconds: number;
  estimatedFileSizeMb: number;
  cpuLoad: ExportCostCpuLoad;
  estimatedCompletionIso: string;
  complexityFactor: number;
  factorBreakdown: ExportCostFactorBreakdown[];
  lastErrorPercent?: number;
}

export const NO_EFFECT_COMPLEXITY_FACTOR = 1;
export const COLOR_CORRECTION_COMPLEXITY_FACTOR = 1.3;
export const VMAF_QUALITY_COMPLEXITY_FACTOR = 2.5;
export const EXPORT_COST_EFFECT_COMPLEXITY_FACTORS: Record<EffectType, number> = {
  blur: 1.35,
  sharpen: 1.2,
  vignette: 1.15,
  'film-grain': 1.25,
  'chromatic-aberration': 1.35,
  'audio-spectrum': 1.7,
  'custom-shader': 2.5,
  'motion-blur': 2.2,
};

// --- P0-1: realtime estimate enhancements ---

export type EstimateConfidenceLevel = 'high' | 'medium' | 'low' | 'insufficient';

export interface ExportEstimateConfidence {
  level: EstimateConfidenceLevel;
  sampleCount: number;
  label: string;
}

export interface ExportEstimateHistoryComparisonEntry {
  id: string;
  estimatedSeconds: number;
  actualSeconds: number;
  errorPercent: number;
  timestamp?: string;
}

export interface LearnedComplexityCoefficient {
  effectType: string;
  defaultFactor: number;
  learnedFactor: number;
  sampleCount: number;
}

const MIN_CONFIDENCE_SAMPLES = 3;
const MEDIUM_CONFIDENCE_SAMPLES = 6;
const HIGH_CONFIDENCE_SAMPLES = 10;
const LEARNING_MIN_SAMPLES = 2;
const LEARNING_MAX_ADJUSTMENT = 0.5;
const MAX_HISTORY_COMPARISON_ENTRIES = 10;

export function calculateEstimateConfidence(sampleCount: number): ExportEstimateConfidence {
  const count = Number.isFinite(sampleCount) ? Math.max(0, Math.floor(sampleCount)) : 0;
  if (count >= HIGH_CONFIDENCE_SAMPLES) {
    return { level: 'high', sampleCount: count, label: 'high' };
  }
  if (count >= MEDIUM_CONFIDENCE_SAMPLES) {
    return { level: 'medium', sampleCount: count, label: 'medium' };
  }
  if (count >= MIN_CONFIDENCE_SAMPLES) {
    return { level: 'low', sampleCount: count, label: 'low' };
  }
  return { level: 'insufficient', sampleCount: count, label: 'insufficient' };
}

export function buildEstimateHistoryComparison(
  samples: ExportCostHistorySample[],
): ExportEstimateHistoryComparisonEntry[] {
  return samples
    .filter(
      (s) =>
        Number.isFinite(s.estimatedDurationSeconds) &&
        (s.estimatedDurationSeconds as number) > 0 &&
        Number.isFinite(s.exportDurationSeconds) &&
        s.exportDurationSeconds > 0,
    )
    .slice(0, MAX_HISTORY_COMPARISON_ENTRIES)
    .map((s, index) => {
      const estimated = s.estimatedDurationSeconds as number;
      const actual = s.exportDurationSeconds;
      return {
        id: `entry-${index}`,
        estimatedSeconds: roundTo(estimated, 1),
        actualSeconds: roundTo(actual, 1),
        errorPercent: roundTo(((actual - estimated) / estimated) * 100, 1),
      };
    });
}

export function learnComplexityCoefficients(
  historySamples: ExportCostHistorySample[],
  currentFactors: Record<string, number> = {},
): LearnedComplexityCoefficient[] {
  const result: LearnedComplexityCoefficient[] = [];
  const allEffectTypes = Object.keys(EXPORT_COST_EFFECT_COMPLEXITY_FACTORS);

  for (const effectType of allEffectTypes) {
    const defaultFactor = EXPORT_COST_EFFECT_COMPLEXITY_FACTORS[effectType as EffectType] ?? 1;
    const relevantSamples = historySamples.filter((s) => {
      if (!Number.isFinite(s.estimatedDurationSeconds) || !s.estimatedDurationSeconds) return false;
      if (!Number.isFinite(s.exportDurationSeconds) || s.exportDurationSeconds <= 0) return false;
      return true;
    });

    if (relevantSamples.length < LEARNING_MIN_SAMPLES) {
      const stored = currentFactors[effectType];
      result.push({
        effectType,
        defaultFactor,
        learnedFactor: Number.isFinite(stored) && stored! > 0 ? roundTo(stored!, 2) : defaultFactor,
        sampleCount: relevantSamples.length,
      });
      continue;
    }

    const avgErrorRatio =
      relevantSamples.reduce((sum, s) => sum + s.exportDurationSeconds / (s.estimatedDurationSeconds as number), 0) /
      relevantSamples.length;

    const adjustment = Math.max(-LEARNING_MAX_ADJUSTMENT, Math.min(LEARNING_MAX_ADJUSTMENT, avgErrorRatio - 1));
    const stored = currentFactors[effectType];
    const baseFactor = Number.isFinite(stored) && stored! > 0 ? stored! : defaultFactor;
    const learnedFactor = roundTo(Math.max(0.5, baseFactor * (1 + adjustment * 0.3)), 2);

    result.push({ effectType, defaultFactor, learnedFactor, sampleCount: relevantSamples.length });
  }

  return result;
}

export function applyLearnedCoefficients(learned: LearnedComplexityCoefficient[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const item of learned) {
    if (item.sampleCount >= LEARNING_MIN_SAMPLES && item.learnedFactor !== item.defaultFactor) {
      result[item.effectType] = item.learnedFactor;
    }
  }
  return result;
}

export function createDebouncedEstimator<TArgs, TResult>(
  fn: (args: TArgs) => TResult,
  delayMs: number,
): {
  call: (args: TArgs) => void;
  flush: () => TResult | undefined;
  cancel: () => void;
  lastResult: () => TResult | undefined;
} {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastArgs: TArgs | undefined;
  let result: TResult | undefined;
  let hasResult = false;

  return {
    call(args: TArgs) {
      lastArgs = args;
      if (timer !== undefined) {
        clearTimeout(timer);
      }
      timer = setTimeout(
        () => {
          timer = undefined;
          result = fn(args);
          hasResult = true;
        },
        Math.max(0, delayMs),
      );
    },
    flush() {
      if (timer !== undefined && lastArgs !== undefined) {
        clearTimeout(timer);
        timer = undefined;
        result = fn(lastArgs);
        hasResult = true;
      }
      return result;
    },
    cancel() {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
    },
    lastResult() {
      return hasResult ? result : undefined;
    },
  };
}

const DEFAULT_EXPORT_SECONDS_PER_TIMELINE_SECOND = 0.65;
const BASE_PIXELS_PER_SECOND = 1920 * 1080 * 30;

export function estimateExportCost(input: ExportCostEstimateInput): ExportCostEstimate {
  const settings = input.settings ?? {};
  const timelineDurationSeconds = Math.max(0.001, getTimelinePlaybackDuration(input.project.timeline));
  const width = positiveNumber(settings.width, input.project.settings.width);
  const height = positiveNumber(settings.height, input.project.settings.height);
  const fps = positiveNumber(settings.fps, input.project.settings.fps);
  const filterComplexity = calculateFilterComplexityFactor(
    input.project.timeline,
    settings,
    input.qualityEvaluation === true,
  );
  const outputFactor = calculateOutputThroughputFactor({
    width,
    height,
    fps,
    format: settings.format,
    outputMode: settings.outputMode,
  });
  const codecFactor = calculateCodecThroughputFactor(settings);
  const complexityFactor = roundTo(filterComplexity.factor * outputFactor * codecFactor, 2);
  const speed = calculateHistoricalExportSpeed(input.history) ?? DEFAULT_EXPORT_SECONDS_PER_TIMELINE_SECOND;
  const estimatedDurationSeconds = Math.max(1, roundTo(timelineDurationSeconds * complexityFactor * speed, 1));
  const estimatedFileSizeMb = estimateExportFileSizeMb({
    durationSeconds: timelineDurationSeconds,
    width,
    height,
    fps,
    format: settings.format,
    outputMode: settings.outputMode,
    videoBitrate: settings.videoBitrate,
    audioBitrate: settings.audioBitrate,
  });
  const nowMs = normalizeNowMs(input.now);
  const lastErrorPercent = calculateLastHistoricalEstimateError(input.history);

  return {
    timelineDurationSeconds: roundTo(timelineDurationSeconds, 3),
    estimatedDurationSeconds,
    estimatedFileSizeMb,
    cpuLoad: classifyExportCpuLoad({
      complexityFactor,
      codec: settings.videoCodec,
      format: settings.format,
      outputMode: settings.outputMode,
    }),
    estimatedCompletionIso: new Date(nowMs + estimatedDurationSeconds * 1000).toISOString(),
    complexityFactor,
    factorBreakdown: [
      ...filterComplexity.breakdown,
      { id: 'output-resolution', factor: outputFactor, weight: 1 },
      { id: 'codec', factor: codecFactor, weight: 1 },
    ],
    ...(lastErrorPercent === undefined ? {} : { lastErrorPercent }),
  };
}

export function calculateFilterComplexityFactor(
  timeline: Timeline,
  settings: Partial<Omit<ExportSettings, 'outputPath'>> = {},
  qualityEvaluation = false,
): { factor: number; breakdown: ExportCostFactorBreakdown[] } {
  const duration = Math.max(0.001, getTimelinePlaybackDuration(timeline));
  const breakdown: ExportCostFactorBreakdown[] = [];
  let offset = 0;

  for (const clip of timeline.tracks.flatMap((track) => track.clips)) {
    const clipWeight = Math.max(0, clip.duration) / duration;
    if (clipWeight <= 0) {
      continue;
    }
    for (const effect of enabledEffects(clip.effects)) {
      const factor = EXPORT_COST_EFFECT_COMPLEXITY_FACTORS[effect.type] ?? NO_EFFECT_COMPLEXITY_FACTOR;
      const weightedOffset = (factor - 1) * clipWeight;
      offset += weightedOffset;
      breakdown.push({ id: `effect:${effect.type}`, factor, weight: roundTo(clipWeight, 3) });
    }
    if (!isDefaultColorCorrection(clip.colorCorrection)) {
      offset += (COLOR_CORRECTION_COMPLEXITY_FACTOR - 1) * clipWeight;
      breakdown.push({
        id: 'color-correction',
        factor: COLOR_CORRECTION_COMPLEXITY_FACTOR,
        weight: roundTo(clipWeight, 3),
      });
    }
    offset += clipProcessingOffset(clip, clipWeight, breakdown);
  }

  const settingsFactors = collectSettingsFactors(settings, qualityEvaluation);
  for (const item of settingsFactors) {
    offset += item.factor - 1;
    breakdown.push(item);
  }

  return {
    factor: Math.max(NO_EFFECT_COMPLEXITY_FACTOR, roundTo(NO_EFFECT_COMPLEXITY_FACTOR + offset, 2)),
    breakdown,
  };
}

export function estimateExportFileSizeMb(input: {
  durationSeconds: number;
  width: number;
  height: number;
  fps: number;
  format?: string | null;
  outputMode?: ExportSettings['outputMode'];
  videoBitrate?: string | null;
  audioBitrate?: string | null;
}): number {
  const duration = Math.max(0.001, input.durationSeconds);
  const audioBitsPerSecond = parseExportBitrate(input.audioBitrate) ?? 128_000;
  const format = (input.format ?? 'mp4').toLowerCase();
  if (input.outputMode !== 'audio-visualization' && (input.outputMode === 'audio' || format === 'm4a')) {
    return roundTo((audioBitsPerSecond * duration) / 8 / 1_000_000, 1);
  }
  const videoBitsPerSecond =
    parseExportBitrate(input.videoBitrate) ?? defaultVideoBitsPerSecond(input.width, input.height, input.fps, format);
  return roundTo(((videoBitsPerSecond + audioBitsPerSecond) * duration) / 8 / 1_000_000, 1);
}

export function calculateHistoricalExportSpeed(samples: ExportCostHistorySample[] | undefined): number | undefined {
  const ratios = (samples ?? [])
    .map((sample) => {
      const timelineDuration = sample.timelineDurationSeconds;
      return Number.isFinite(timelineDuration) && timelineDuration! > 0 && sample.exportDurationSeconds > 0
        ? sample.exportDurationSeconds / timelineDuration!
        : undefined;
    })
    .filter((value): value is number => value !== undefined && Number.isFinite(value) && value > 0);
  if (ratios.length === 0) {
    return undefined;
  }
  return roundTo(ratios.reduce((total, value) => total + value, 0) / ratios.length, 3);
}

export function calculateHistoricalEstimateErrorPercent(
  estimatedSeconds: number | undefined,
  actualSeconds: number | undefined,
): number | undefined {
  if (
    !Number.isFinite(estimatedSeconds) ||
    !Number.isFinite(actualSeconds) ||
    !estimatedSeconds ||
    !actualSeconds ||
    estimatedSeconds <= 0 ||
    actualSeconds < 0
  ) {
    return undefined;
  }
  return roundTo((Math.abs(actualSeconds - estimatedSeconds) / estimatedSeconds) * 100, 1);
}

export function parseExportBitrate(value: string | null | undefined): number | undefined {
  const match = /^(\d+(?:\.\d+)?)([kKmM])?$/.exec(value?.trim() ?? '');
  if (!match) {
    return undefined;
  }
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) {
    return undefined;
  }
  const suffix = match[2]?.toLowerCase();
  if (suffix === 'm') {
    return amount * 1_000_000;
  }
  if (suffix === 'k') {
    return amount * 1_000;
  }
  return amount;
}

export function assertExportCostEffectCoverage(): true {
  const missing = EFFECT_TYPES.filter((type) => EXPORT_COST_EFFECT_COMPLEXITY_FACTORS[type] === undefined);
  if (missing.length > 0) {
    throw new Error(`Missing export cost complexity factors: ${missing.join(', ')}`);
  }
  return true;
}

function enabledEffects(effects: Effect[] | undefined): Effect[] {
  return (effects ?? []).filter((effect) => effect.enabled !== false);
}

function clipProcessingOffset(clip: Clip, clipWeight: number, breakdown: ExportCostFactorBreakdown[]): number {
  let offset = 0;
  if (clip.frameInterpolation?.enabled) {
    offset += 0.7 * clipWeight;
    breakdown.push({ id: 'frame-interpolation', factor: 1.7, weight: roundTo(clipWeight, 3) });
  }
  if (
    clip.videoRestoration &&
    (clip.videoRestoration.deinterlace.enabled ||
      clip.videoRestoration.temporalDenoise.preset !== 'off' ||
      clip.videoRestoration.spatialDenoise.enabled)
  ) {
    offset += 0.45 * clipWeight;
    breakdown.push({ id: 'video-restoration', factor: 1.45, weight: roundTo(clipWeight, 3) });
  }
  if (clip.masks?.some((mask) => mask.enabled !== false)) {
    offset += 0.25 * clipWeight;
    breakdown.push({ id: 'mask', factor: 1.25, weight: roundTo(clipWeight, 3) });
  }
  if (clip.blendMode && clip.blendMode !== 'normal') {
    offset += 0.2 * clipWeight;
    breakdown.push({ id: 'blend-mode', factor: 1.2, weight: roundTo(clipWeight, 3) });
  }
  return offset;
}

function collectSettingsFactors(
  settings: Partial<Omit<ExportSettings, 'outputPath'>>,
  qualityEvaluation: boolean,
): ExportCostFactorBreakdown[] {
  const factors: ExportCostFactorBreakdown[] = [];
  if (qualityEvaluation) {
    factors.push({ id: 'vmaf-quality-evaluation', factor: VMAF_QUALITY_COMPLEXITY_FACTOR, weight: 1 });
  }
  if (settings.loudnessNormalization && settings.loudnessNormalization !== 'off') {
    factors.push({ id: 'loudness-normalization', factor: 1.25, weight: 1 });
  }
  if (hasMasterProcessing(settings.masterProcessing)) {
    factors.push({ id: 'master-processing', factor: 1.2, weight: 1 });
  }
  if (settings.scaleMode === 'fit' || (settings.targetAspectRatio && settings.targetAspectRatio !== 'source')) {
    factors.push({ id: 'scale-reframe', factor: 1.15, weight: 1 });
  }
  if (settings.watermark?.enabled) {
    factors.push({ id: 'watermark', factor: 1.1, weight: 1 });
  }
  if (settings.outputMode === 'audio-visualization') {
    factors.push({ id: 'audio-visualization-output', factor: 1.35, weight: 1 });
  }
  return factors;
}

function hasMasterProcessing(input: ExportMasterProcessingSettings | null | undefined): boolean {
  return Boolean(input?.eq.enabled || input?.stereoEnhancer.enabled || input?.limiter.enabled);
}

function calculateOutputThroughputFactor(input: {
  width: number;
  height: number;
  fps: number;
  format?: string | null;
  outputMode?: ExportSettings['outputMode'];
}): number {
  if (input.outputMode === 'audio') {
    return 0.35;
  }
  const format = (input.format ?? 'mp4').toLowerCase();
  if (format === 'gif' || format === 'webp' || format === 'apng') {
    return 1.8;
  }
  const pixelsPerSecond = Math.max(1, input.width * input.height * input.fps);
  const factor = Math.sqrt(pixelsPerSecond / BASE_PIXELS_PER_SECOND);
  return roundTo(Math.min(4, Math.max(0.35, factor)), 2);
}

function calculateCodecThroughputFactor(settings: Partial<Omit<ExportSettings, 'outputPath'>>): number {
  if (settings.outputMode === 'audio') {
    return 0.45;
  }
  const codec = (settings.videoCodec ?? '').toLowerCase();
  const format = (settings.format ?? '').toLowerCase();
  let factor = 1;
  if (codec.includes('265') || codec.includes('hevc')) {
    factor = 1.45;
  } else if (codec.includes('vp9')) {
    factor = 1.6;
  } else if (codec.includes('av1')) {
    factor = 2.2;
  } else if (codec.includes('prores')) {
    factor = 0.85;
  } else if (format === 'gif' || format === 'webp' || format === 'apng') {
    factor = 1.35;
  }
  if (settings.hardwareEncoding) {
    factor *= 0.65;
  }
  return roundTo(Math.max(0.35, factor), 2);
}

function classifyExportCpuLoad(input: {
  complexityFactor: number;
  codec?: string;
  format?: string | null;
  outputMode?: ExportSettings['outputMode'];
}): ExportCostCpuLoad {
  if (input.outputMode === 'audio') {
    return input.complexityFactor > 1.2 ? 'medium' : 'light';
  }
  const codec = (input.codec ?? '').toLowerCase();
  const codecPenalty =
    codec.includes('265') || codec.includes('hevc') || codec.includes('vp9') || codec.includes('av1') ? 0.4 : 0;
  const formatPenalty = input.format === 'gif' || input.format === 'webp' || input.format === 'apng' ? 0.3 : 0;
  const score = input.complexityFactor + codecPenalty + formatPenalty;
  if (score < 1.6) {
    return 'light';
  }
  if (score < 3) {
    return 'medium';
  }
  return 'heavy';
}

function calculateLastHistoricalEstimateError(samples: ExportCostHistorySample[] | undefined): number | undefined {
  const sample = (samples ?? []).find(
    (item) => item.estimatedDurationSeconds !== undefined && item.exportDurationSeconds > 0,
  );
  return sample
    ? calculateHistoricalEstimateErrorPercent(sample.estimatedDurationSeconds, sample.exportDurationSeconds)
    : undefined;
}

function defaultVideoBitsPerSecond(width: number, height: number, fps: number, format: string): number {
  if (format === 'gif' || format === 'webp' || format === 'apng') {
    return Math.min(80_000_000, Math.max(8_000_000, width * height * fps * 0.45));
  }
  const pixelsPerSecond = Math.max(1, width * height * fps);
  return Math.min(45_000_000, Math.max(2_000_000, pixelsPerSecond * 0.16));
}

function positiveNumber(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && value! > 0 ? value! : fallback;
}

function normalizeNowMs(value: Date | string | number | undefined): number {
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return Date.now();
}

function roundTo(value: number, digits: number): number {
  const scale = 10 ** digits;
  return Math.round(round(value) * scale) / scale;
}

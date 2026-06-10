import { round } from '../time';

const DEFAULT_THRESHOLD_DB = -40;
const DEFAULT_MIN_SILENCE_DURATION = 0.5;
const DEFAULT_MARGIN_DURATION = 0.1;
const DEFAULT_FRAME_DURATION = 0.02;
const EPSILON = 0.000001;

export interface DecodedAudioSamples {
  channels: Float32Array[];
  sampleRate: number;
  duration?: number;
}

export interface SilenceDetectionOptions {
  thresholdDb?: number;
  minSilenceDuration?: number;
  marginDuration?: number;
  frameDuration?: number;
}

export interface SilentRange {
  start: number;
  end: number;
  duration: number;
}

export interface NormalizedSilenceDetectionOptions {
  thresholdDb: number;
  minSilenceDuration: number;
  marginDuration: number;
  frameDuration: number;
}

export function calculateRms(channels: Float32Array[], startSample = 0, endSample?: number): number {
  if (channels.length === 0) {
    return 0;
  }
  const sampleCount = Math.max(0, Math.min(...channels.map((channel) => channel.length)));
  const start = Math.min(sampleCount, Math.max(0, Math.floor(startSample)));
  const end = Math.min(sampleCount, Math.max(start, Math.floor(endSample ?? sampleCount)));
  if (end <= start) {
    return 0;
  }
  let sum = 0;
  let count = 0;
  for (const channel of channels) {
    for (let index = start; index < end; index += 1) {
      const sample = channel[index] ?? 0;
      sum += sample * sample;
      count += 1;
    }
  }
  return count > 0 ? Math.sqrt(sum / count) : 0;
}

export function amplitudeToDb(amplitude: number): number {
  if (!Number.isFinite(amplitude) || amplitude <= 0) {
    return Number.NEGATIVE_INFINITY;
  }
  return 20 * Math.log10(amplitude);
}

export function normalizeSilenceDetectionOptions(options: SilenceDetectionOptions = {}): NormalizedSilenceDetectionOptions {
  return {
    thresholdDb: finiteOrDefault(options.thresholdDb, DEFAULT_THRESHOLD_DB),
    minSilenceDuration: Math.max(0, finiteOrDefault(options.minSilenceDuration, DEFAULT_MIN_SILENCE_DURATION)),
    marginDuration: Math.max(0, finiteOrDefault(options.marginDuration, DEFAULT_MARGIN_DURATION)),
    frameDuration: Math.max(0.001, finiteOrDefault(options.frameDuration, DEFAULT_FRAME_DURATION))
  };
}

export function findSilentRanges(audio: DecodedAudioSamples, options: SilenceDetectionOptions = {}): SilentRange[] {
  const normalized = normalizeSilenceDetectionOptions(options);
  const sampleCount = Math.max(0, Math.min(...audio.channels.map((channel) => channel.length)));
  const duration = Math.max(0, audio.duration ?? sampleCount / Math.max(1, audio.sampleRate));
  if (sampleCount === 0 || audio.sampleRate <= 0 || duration <= 0) {
    return [];
  }

  const frameSize = Math.max(1, Math.floor(audio.sampleRate * normalized.frameDuration));
  const rawRanges: SilentRange[] = [];
  let currentStart: number | undefined;

  for (let startSample = 0; startSample < sampleCount; startSample += frameSize) {
    const endSample = Math.min(sampleCount, startSample + frameSize);
    const frameStart = startSample / audio.sampleRate;
    const frameEnd = endSample / audio.sampleRate;
    const isSilent = amplitudeToDb(calculateRms(audio.channels, startSample, endSample)) <= normalized.thresholdDb;
    if (isSilent && currentStart === undefined) {
      currentStart = frameStart;
    } else if (!isSilent && currentStart !== undefined) {
      pushRawRange(rawRanges, currentStart, frameStart, normalized.minSilenceDuration);
      currentStart = undefined;
    }
    if (endSample >= sampleCount && currentStart !== undefined) {
      pushRawRange(rawRanges, currentStart, Math.min(duration, frameEnd), normalized.minSilenceDuration);
      currentStart = undefined;
    }
  }

  return applySilenceMargins(mergeCloseSilentRanges(rawRanges, normalized.marginDuration), duration, normalized.marginDuration);
}

export function mergeCloseSilentRanges(ranges: SilentRange[], marginDuration: number): SilentRange[] {
  const sorted = normalizeRanges(ranges, Number.POSITIVE_INFINITY);
  const merged: SilentRange[] = [];
  for (const range of sorted) {
    const previous = merged[merged.length - 1];
    if (previous && range.start - previous.end < marginDuration + EPSILON) {
      previous.end = round(Math.max(previous.end, range.end));
      previous.duration = round(previous.end - previous.start);
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

export function applySilenceMargins(ranges: SilentRange[], maxDuration: number, marginDuration: number): SilentRange[] {
  const duration = Math.max(0, maxDuration);
  return normalizeRanges(
    ranges.flatMap((range) => {
      const start = Math.min(duration, Math.max(0, range.start + marginDuration));
      const end = Math.min(duration, Math.max(start, range.end - marginDuration));
      if (end - start <= EPSILON) {
        return [];
      }
      return [{ start, end, duration: end - start }];
    }),
    duration
  );
}

function pushRawRange(ranges: SilentRange[], start: number, end: number, minSilenceDuration: number): void {
  const duration = end - start;
  if (duration + EPSILON >= minSilenceDuration) {
    ranges.push({ start: round(start), end: round(end), duration: round(duration) });
  }
}

function normalizeRanges(ranges: SilentRange[], maxDuration: number): SilentRange[] {
  const duration = Number.isFinite(maxDuration) ? Math.max(0, maxDuration) : Number.POSITIVE_INFINITY;
  return ranges
    .map((range) => {
      const start = round(Math.min(duration, Math.max(0, range.start)));
      const end = round(Math.min(duration, Math.max(start, range.end)));
      return { start, end, duration: round(end - start) };
    })
    .filter((range) => range.duration > EPSILON)
    .sort((left, right) => left.start - right.start || left.end - right.end);
}

function finiteOrDefault(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

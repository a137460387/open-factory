import type { ClipPitchDataPoint } from './model-types';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
const NOTE_COLORS: Record<string, string> = {
  C: '#ef4444',
  'C#': '#f97316',
  D: '#f59e0b',
  'D#': '#eab308',
  E: '#84cc16',
  F: '#22c55e',
  'F#': '#14b8a6',
  G: '#06b6d4',
  'G#': '#3b82f6',
  A: '#6366f1',
  'A#': '#8b5cf6',
  B: '#a855f7',
};

export interface PitchDetectionOptions {
  minFrequency?: number;
  maxFrequency?: number;
  threshold?: number;
}

export interface PitchFrameAnalysisOptions extends PitchDetectionOptions {
  frameSize?: number;
  hopSize?: number;
}

export interface PitchSummary {
  primaryNote?: string;
  minHz?: number;
  maxHz?: number;
  stability: number;
  sampleCount: number;
}

export function detectPitchYin(
  samples: ArrayLike<number>,
  sampleRate: number,
  options: PitchDetectionOptions = {},
): number | undefined {
  const minFrequency = options.minFrequency ?? 60;
  const maxFrequency = options.maxFrequency ?? 1200;
  const threshold = options.threshold ?? 0.15;
  if (!Number.isFinite(sampleRate) || sampleRate <= 0 || samples.length < 8) {
    return undefined;
  }
  const minTau = Math.max(2, Math.floor(sampleRate / maxFrequency));
  const maxTau = Math.min(samples.length - 1, Math.ceil(sampleRate / minFrequency));
  if (maxTau <= minTau) {
    return undefined;
  }
  const difference = new Float32Array(maxTau + 1);
  for (let tau = 1; tau <= maxTau; tau += 1) {
    let sum = 0;
    const limit = samples.length - tau;
    for (let index = 0; index < limit; index += 1) {
      const delta = samples[index] - samples[index + tau];
      sum += delta * delta;
    }
    difference[tau] = sum;
  }
  const cumulativeMean = new Float32Array(maxTau + 1);
  cumulativeMean[0] = 1;
  let runningSum = 0;
  let bestTau = 0;
  let bestValue = Number.POSITIVE_INFINITY;
  for (let tau = 1; tau <= maxTau; tau += 1) {
    runningSum += difference[tau];
    cumulativeMean[tau] = runningSum === 0 ? 1 : (difference[tau] * tau) / runningSum;
  }
  for (let tau = minTau; tau <= maxTau; tau += 1) {
    const normalized = cumulativeMean[tau];
    if (normalized < bestValue) {
      bestValue = normalized;
      bestTau = tau;
    }
    if (normalized < threshold) {
      bestTau = tau;
      while (tau + 1 <= maxTau && cumulativeMean[tau + 1] < cumulativeMean[tau]) {
        tau += 1;
        bestTau = tau;
      }
      bestValue = cumulativeMean[bestTau];
      break;
    }
  }
  if (!bestTau || bestValue > 0.45) {
    return undefined;
  }
  const refinedTau = refineTau(cumulativeMean, bestTau);
  return Math.round((sampleRate / refinedTau) * 100) / 100;
}

export function analyzePitchFrames(
  samples: ArrayLike<number>,
  sampleRate: number,
  options: PitchFrameAnalysisOptions = {},
): ClipPitchDataPoint[] {
  const frameSize = Math.max(256, Math.round(options.frameSize ?? 2048));
  const hopSize = Math.max(128, Math.round(options.hopSize ?? frameSize / 2));
  if (!Number.isFinite(sampleRate) || sampleRate <= 0 || samples.length < frameSize) {
    return [];
  }
  const points: ClipPitchDataPoint[] = [];
  for (let start = 0; start + frameSize <= samples.length; start += hopSize) {
    const hz = detectPitchYin(sliceSamples(samples, start, start + frameSize), sampleRate, options);
    if (hz !== undefined) {
      points.push({
        time: Math.round((start / sampleRate) * 1000) / 1000,
        hz,
        note: hzToNoteName(hz),
      });
    }
  }
  return points;
}

export function hzToNoteName(hz: number): string {
  if (!Number.isFinite(hz) || hz <= 0) {
    return '';
  }
  const midi = Math.round(69 + 12 * Math.log2(hz / 440));
  const noteIndex = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[noteIndex]}${octave}`;
}

export function noteNameToPitchClass(note: string | undefined): string {
  const match = String(note ?? '').match(/^([A-G]#?)/);
  return match?.[1] ?? '';
}

export function pitchNoteColor(note: string | undefined): string {
  return NOTE_COLORS[noteNameToPitchClass(note)] ?? '#94a3b8';
}

export function summarizePitchData(data: readonly ClipPitchDataPoint[] | undefined): PitchSummary {
  const samples = normalizeClipPitchData(data);
  if (!samples) {
    return { stability: 0, sampleCount: 0 };
  }
  const counts = new Map<string, number>();
  for (const sample of samples) {
    counts.set(sample.note, (counts.get(sample.note) ?? 0) + 1);
  }
  const [primaryNote, primaryCount] =
    [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0] ?? [];
  const hzValues = samples.map((sample) => sample.hz);
  const mean = hzValues.reduce((total, value) => total + value, 0) / hzValues.length;
  const variance = hzValues.reduce((total, value) => total + (value - mean) ** 2, 0) / hzValues.length;
  const coefficient = Math.sqrt(variance) / Math.max(1, mean);
  return {
    primaryNote,
    minHz: Math.min(...hzValues),
    maxHz: Math.max(...hzValues),
    stability: Math.round(Math.max(0, Math.min(1, (primaryCount ?? 0) / samples.length - coefficient)) * 100) / 100,
    sampleCount: samples.length,
  };
}

export function normalizeClipPitchData(data: unknown): ClipPitchDataPoint[] | undefined {
  if (!Array.isArray(data)) {
    return undefined;
  }
  const normalized = data
    .map((item) => {
      if (item == null || typeof item !== 'object') {
        return undefined;
      }
      const value = item as Partial<ClipPitchDataPoint>;
      const time = Number(value.time);
      const hz = Number(value.hz);
      if (!Number.isFinite(time) || time < 0 || !Number.isFinite(hz) || hz <= 0 || hz > 20_000) {
        return undefined;
      }
      return {
        time: Math.round(time * 1000) / 1000,
        hz: Math.round(hz * 100) / 100,
        note: typeof value.note === 'string' && value.note.trim() ? value.note.trim() : hzToNoteName(hz),
      };
    })
    .filter((item): item is ClipPitchDataPoint => Boolean(item))
    .sort((left, right) => left.time - right.time || left.hz - right.hz);
  return normalized.length > 0 ? normalized : undefined;
}

export function serializePitchDataCsv(data: readonly ClipPitchDataPoint[] | undefined): string {
  const rows = normalizeClipPitchData(data) ?? [];
  return [
    'time,hz,note',
    ...rows.map((point) => `${point.time.toFixed(3)},${point.hz.toFixed(2)},${escapeCsv(point.note)}`),
  ].join('\n');
}

function sliceSamples(samples: ArrayLike<number>, start: number, end: number): Float32Array {
  const frame = new Float32Array(end - start);
  for (let index = start; index < end; index += 1) {
    frame[index - start] = samples[index] ?? 0;
  }
  return frame;
}

function escapeCsv(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function refineTau(values: Float32Array, tau: number): number {
  if (tau <= 1 || tau >= values.length - 1) {
    return tau;
  }
  const left = values[tau - 1];
  const center = values[tau];
  const right = values[tau + 1];
  const denominator = 2 * (2 * center - left - right);
  if (!Number.isFinite(denominator) || Math.abs(denominator) < 1e-6) {
    return tau;
  }
  const offset = (right - left) / denominator;
  return tau + Math.max(-0.5, Math.min(0.5, offset));
}

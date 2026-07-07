import { clamp, round } from '../time';

export type AutoAudioSyncConfidence = 'high' | 'medium' | 'low';

export type AutoAudioSyncApplyMode = 'keep-secondary' | 'replace-primary-audio';

export interface AutoAudioSyncTrackInput {
  clipId: string;
  samples: ArrayLike<number>;
  sampleRate: number;
}

export interface AutoAudioSyncCorrelationPeak {
  lagSamples: number;
  offsetSeconds: number;
  score: number;
  overlapSamples: number;
}

export interface AutoAudioSyncRefinement {
  lagSamples: number;
  offsetSeconds: number;
  rmsError: number;
  overlapSamples: number;
}

export interface AutoAudioSyncResult {
  clipId: string;
  offsetSeconds: number;
  offsetMs: number;
  coarseOffsetSeconds: number;
  refinedOffsetSeconds: number;
  peakScore: number;
  confidence: AutoAudioSyncConfidence;
  applied: boolean;
}

export interface AutoAudioSyncOptions {
  targetSampleRate?: number;
  maxDurationSeconds?: number;
  maxOffsetSeconds?: number;
  fineSearchWindowSeconds?: number;
}

export interface AutoAudioSyncApplyRoute {
  mode: AutoAudioSyncApplyMode;
  offsetsByClipId: Record<string, number>;
  skippedLowConfidenceClipIds: string[];
  mutePrimaryClipId?: string;
}

const DEFAULT_TARGET_SAMPLE_RATE = 8_000;
const DEFAULT_MAX_DURATION_SECONDS = 60;
const DEFAULT_MAX_OFFSET_SECONDS = 10;
const DEFAULT_FINE_SEARCH_WINDOW_SECONDS = 0.5;
const HIGH_CONFIDENCE_THRESHOLD = 0.7;
const MEDIUM_CONFIDENCE_THRESHOLD = 0.45;
const EPSILON = 0.000001;

interface CorrelationContext {
  reference: number[];
  candidate: number[];
  candidateLength: number;
  correlation: number[];
  referenceEnergy: number[];
  candidateEnergy: number[];
}

interface LagStats {
  lagSamples: number;
  score: number;
  rmsError: number;
  overlapSamples: number;
}

export function prepareAudioSyncSamples(
  samples: ArrayLike<number>,
  sourceSampleRate: number,
  options: Pick<AutoAudioSyncOptions, 'targetSampleRate' | 'maxDurationSeconds'> = {}
): number[] {
  const sourceRate = Math.max(1, Math.round(finiteOrDefault(sourceSampleRate, DEFAULT_TARGET_SAMPLE_RATE)));
  const targetRate = Math.max(1, Math.round(finiteOrDefault(options.targetSampleRate, DEFAULT_TARGET_SAMPLE_RATE)));
  const maxSamples = Math.max(1, Math.round(finiteOrDefault(options.maxDurationSeconds, DEFAULT_MAX_DURATION_SECONDS) * sourceRate));
  const inputLength = Math.min(samples.length, maxSamples);
  if (inputLength <= 0) {
    return [];
  }
  const outputLength = Math.max(1, Math.ceil((inputLength / sourceRate) * targetRate));
  const output: number[] = [];
  for (let index = 0; index < outputLength; index += 1) {
    const start = Math.floor((index * sourceRate) / targetRate);
    const end = Math.min(inputLength, Math.max(start + 1, Math.floor(((index + 1) * sourceRate) / targetRate)));
    let sum = 0;
    let count = 0;
    for (let sourceIndex = start; sourceIndex < end; sourceIndex += 1) {
      sum += finiteOrDefault(samples[sourceIndex], 0);
      count += 1;
    }
    output.push(count > 0 ? sum / count : 0);
  }
  return output;
}

export function findAudioSyncCorrelationPeak(
  referenceSamples: ArrayLike<number>,
  candidateSamples: ArrayLike<number>,
  sampleRate: number,
  maxOffsetSeconds = DEFAULT_MAX_OFFSET_SECONDS
): AutoAudioSyncCorrelationPeak {
  const rate = Math.max(1, Math.round(finiteOrDefault(sampleRate, DEFAULT_TARGET_SAMPLE_RATE)));
  const context = createCorrelationContext(referenceSamples, candidateSamples);
  const maxLag = Math.min(context.reference.length + context.candidate.length - 2, Math.max(0, Math.round(finiteOrDefault(maxOffsetSeconds, DEFAULT_MAX_OFFSET_SECONDS) * rate)));
  const minOverlapSamples = calculateMinimumOverlapSamples(context, rate);
  let best: LagStats | undefined;
  for (let lag = -maxLag; lag <= maxLag; lag += 1) {
    const stats = scoreLag(context, lag);
    if (!stats || stats.overlapSamples < minOverlapSamples) {
      continue;
    }
    if (!best || stats.score > best.score || (Math.abs(stats.score - best.score) < EPSILON && stats.rmsError < best.rmsError)) {
      best = stats;
    }
  }
  return {
    lagSamples: best?.lagSamples ?? 0,
    offsetSeconds: round((best?.lagSamples ?? 0) / rate),
    score: round(best?.score ?? 0),
    overlapSamples: best?.overlapSamples ?? 0
  };
}

export function refineAudioSyncOffsetByRms(
  referenceSamples: ArrayLike<number>,
  candidateSamples: ArrayLike<number>,
  sampleRate: number,
  coarseOffsetSeconds: number,
  searchWindowSeconds = DEFAULT_FINE_SEARCH_WINDOW_SECONDS
): AutoAudioSyncRefinement {
  const rate = Math.max(1, Math.round(finiteOrDefault(sampleRate, DEFAULT_TARGET_SAMPLE_RATE)));
  const context = createCorrelationContext(referenceSamples, candidateSamples);
  const coarseLag = Math.round(finiteOrDefault(coarseOffsetSeconds, 0) * rate);
  const radius = Math.max(0, Math.round(finiteOrDefault(searchWindowSeconds, DEFAULT_FINE_SEARCH_WINDOW_SECONDS) * rate));
  const minLag = Math.max(-(context.candidate.length - 1), coarseLag - radius);
  const maxLag = Math.min(context.reference.length - 1, coarseLag + radius);
  const minOverlapSamples = calculateMinimumOverlapSamples(context, rate);
  let best: LagStats | undefined;
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    const stats = scoreLag(context, lag);
    if (!stats || stats.overlapSamples < minOverlapSamples) {
      continue;
    }
    if (!best || stats.rmsError < best.rmsError || (Math.abs(stats.rmsError - best.rmsError) < EPSILON && stats.score > best.score)) {
      best = stats;
    }
  }
  return {
    lagSamples: best?.lagSamples ?? coarseLag,
    offsetSeconds: round((best?.lagSamples ?? coarseLag) / rate),
    rmsError: round(best?.rmsError ?? 0),
    overlapSamples: best?.overlapSamples ?? 0
  };
}

export function labelAutoAudioSyncConfidence(score: number): AutoAudioSyncConfidence {
  const normalized = clamp(finiteOrDefault(score, 0), 0, 1);
  if (normalized >= HIGH_CONFIDENCE_THRESHOLD) {
    return 'high';
  }
  if (normalized >= MEDIUM_CONFIDENCE_THRESHOLD) {
    return 'medium';
  }
  return 'low';
}

export function analyzeAutoAudioSyncTracks(
  reference: AutoAudioSyncTrackInput,
  candidates: AutoAudioSyncTrackInput[],
  options: AutoAudioSyncOptions = {}
): AutoAudioSyncResult[] {
  const targetSampleRate = Math.max(1, Math.round(finiteOrDefault(options.targetSampleRate, DEFAULT_TARGET_SAMPLE_RATE)));
  const referenceSamples = prepareAudioSyncSamples(reference.samples, reference.sampleRate, options);
  return candidates.slice(0, 4).map((candidate) => {
    const candidateSamples = prepareAudioSyncSamples(candidate.samples, candidate.sampleRate, options);
    const peak = findAudioSyncCorrelationPeak(referenceSamples, candidateSamples, targetSampleRate, options.maxOffsetSeconds);
    const refined = refineAudioSyncOffsetByRms(referenceSamples, candidateSamples, targetSampleRate, peak.offsetSeconds, options.fineSearchWindowSeconds);
    const confidence = labelAutoAudioSyncConfidence(peak.score);
    return {
      clipId: candidate.clipId,
      offsetSeconds: refined.offsetSeconds,
      offsetMs: Math.round(refined.offsetSeconds * 1000),
      coarseOffsetSeconds: peak.offsetSeconds,
      refinedOffsetSeconds: refined.offsetSeconds,
      peakScore: peak.score,
      confidence,
      applied: confidence !== 'low'
    };
  });
}

export function resolveAutoAudioSyncApplyRoute(
  primaryClipId: string,
  results: AutoAudioSyncResult[],
  mode: AutoAudioSyncApplyMode = 'keep-secondary'
): AutoAudioSyncApplyRoute {
  const normalizedMode = normalizeAutoAudioSyncApplyMode(mode);
  const offsetsByClipId: Record<string, number> = {};
  const skippedLowConfidenceClipIds: string[] = [];
  for (const result of results) {
    if (result.confidence === 'low' || !result.applied) {
      skippedLowConfidenceClipIds.push(result.clipId);
      continue;
    }
    offsetsByClipId[result.clipId] = result.offsetSeconds;
  }
  return {
    mode: normalizedMode,
    offsetsByClipId,
    skippedLowConfidenceClipIds,
    mutePrimaryClipId: normalizedMode === 'replace-primary-audio' && Object.keys(offsetsByClipId).length > 0 ? primaryClipId : undefined
  };
}

export function normalizeAutoAudioSyncApplyMode(mode: string | undefined): AutoAudioSyncApplyMode {
  return mode === 'replace-primary-audio' ? 'replace-primary-audio' : 'keep-secondary';
}

function createCorrelationContext(referenceSamples: ArrayLike<number>, candidateSamples: ArrayLike<number>): CorrelationContext {
  const reference = normalizeForCorrelation(referenceSamples);
  const candidate = normalizeForCorrelation(candidateSamples);
  const reversedCandidate = [...candidate].reverse();
  return {
    reference,
    candidate,
    candidateLength: candidate.length,
    correlation: convolve(reference, reversedCandidate),
    referenceEnergy: prefixSquares(reference),
    candidateEnergy: prefixSquares(candidate)
  };
}

function scoreLag(context: CorrelationContext, lagSamples: number): LagStats | undefined {
  if (context.reference.length === 0 || context.candidate.length === 0) {
    return undefined;
  }
  const referenceStart = Math.max(0, lagSamples);
  const referenceEnd = Math.min(context.reference.length, context.candidate.length + lagSamples);
  const candidateStart = Math.max(0, -lagSamples);
  const candidateEnd = candidateStart + Math.max(0, referenceEnd - referenceStart);
  const overlapSamples = Math.max(0, referenceEnd - referenceStart);
  if (overlapSamples === 0 || candidateEnd > context.candidate.length) {
    return undefined;
  }
  const convolutionIndex = lagSamples + context.candidateLength - 1;
  const raw = context.correlation[convolutionIndex] ?? 0;
  const referenceEnergy = rangeSum(context.referenceEnergy, referenceStart, referenceEnd);
  const candidateEnergy = rangeSum(context.candidateEnergy, candidateStart, candidateEnd);
  const denom = Math.sqrt(referenceEnergy * candidateEnergy);
  const score = denom > EPSILON ? raw / denom : 0;
  const meanSquaredError = Math.max(0, (referenceEnergy + candidateEnergy - 2 * raw) / overlapSamples);
  return {
    lagSamples,
    score,
    rmsError: Math.sqrt(meanSquaredError),
    overlapSamples
  };
}

function calculateMinimumOverlapSamples(context: CorrelationContext, sampleRate: number): number {
  const shortest = Math.min(context.reference.length, context.candidate.length);
  if (shortest <= 0) {
    return 1;
  }
  return Math.min(shortest, Math.max(1, Math.round(sampleRate * 0.25), Math.round(shortest * 0.5)));
}

function normalizeForCorrelation(samples: ArrayLike<number>): number[] {
  const values = Array.from({ length: samples.length }, (_, index) => finiteOrDefault(samples[index], 0));
  if (values.length === 0) {
    return [];
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const centered = values.map((value) => value - mean);
  const rms = Math.sqrt(centered.reduce((sum, value) => sum + value * value, 0) / centered.length);
  if (rms <= EPSILON) {
    return centered.map(() => 0);
  }
  return centered.map((value) => value / rms);
}

function convolve(left: number[], right: number[]): number[] {
  if (left.length === 0 || right.length === 0) {
    return [];
  }
  const outputLength = left.length + right.length - 1;
  const size = nextPowerOfTwo(outputLength);
  const leftReal = new Array(size).fill(0);
  const leftImag = new Array(size).fill(0);
  const rightReal = new Array(size).fill(0);
  const rightImag = new Array(size).fill(0);
  for (let index = 0; index < left.length; index += 1) {
    leftReal[index] = left[index];
  }
  for (let index = 0; index < right.length; index += 1) {
    rightReal[index] = right[index];
  }
  fft(leftReal, leftImag, false);
  fft(rightReal, rightImag, false);
  for (let index = 0; index < size; index += 1) {
    const real = leftReal[index] * rightReal[index] - leftImag[index] * rightImag[index];
    const imag = leftReal[index] * rightImag[index] + leftImag[index] * rightReal[index];
    leftReal[index] = real;
    leftImag[index] = imag;
  }
  fft(leftReal, leftImag, true);
  return leftReal.slice(0, outputLength);
}

function fft(real: number[], imag: number[], invert: boolean): void {
  const size = real.length;
  for (let index = 1, bit = 0; index < size; index += 1) {
    let mask = size >> 1;
    for (; bit & mask; mask >>= 1) {
      bit ^= mask;
    }
    bit ^= mask;
    if (index < bit) {
      [real[index], real[bit]] = [real[bit], real[index]];
      [imag[index], imag[bit]] = [imag[bit], imag[index]];
    }
  }
  for (let length = 2; length <= size; length <<= 1) {
    const angle = ((invert ? -2 : 2) * Math.PI) / length;
    const wLengthReal = Math.cos(angle);
    const wLengthImag = Math.sin(angle);
    for (let start = 0; start < size; start += length) {
      let wReal = 1;
      let wImag = 0;
      for (let offset = 0; offset < length / 2; offset += 1) {
        const evenReal = real[start + offset];
        const evenImag = imag[start + offset];
        const oddReal = real[start + offset + length / 2] * wReal - imag[start + offset + length / 2] * wImag;
        const oddImag = real[start + offset + length / 2] * wImag + imag[start + offset + length / 2] * wReal;
        real[start + offset] = evenReal + oddReal;
        imag[start + offset] = evenImag + oddImag;
        real[start + offset + length / 2] = evenReal - oddReal;
        imag[start + offset + length / 2] = evenImag - oddImag;
        const nextWReal = wReal * wLengthReal - wImag * wLengthImag;
        wImag = wReal * wLengthImag + wImag * wLengthReal;
        wReal = nextWReal;
      }
    }
  }
  if (invert) {
    for (let index = 0; index < size; index += 1) {
      real[index] /= size;
      imag[index] /= size;
    }
  }
}

function prefixSquares(values: number[]): number[] {
  const sums = [0];
  for (const value of values) {
    sums.push(sums[sums.length - 1] + value * value);
  }
  return sums;
}

function rangeSum(prefix: number[], start: number, end: number): number {
  return (prefix[Math.max(0, Math.min(prefix.length - 1, end))] ?? 0) - (prefix[Math.max(0, Math.min(prefix.length - 1, start))] ?? 0);
}

function nextPowerOfTwo(value: number): number {
  let size = 1;
  while (size < value) {
    size <<= 1;
  }
  return size;
}

function finiteOrDefault(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

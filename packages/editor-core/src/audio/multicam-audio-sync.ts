import { round } from '../time';

export type MulticamSyncConfidence = 'high' | 'medium' | 'low';

export interface MulticamSyncWindowResult {
  windowIndex: number;
  startTime: number;
  endTime: number;
  offsetSeconds: number;
  score: number;
}

export interface MulticamSyncDriftReport {
  hasDrift: boolean;
  slope: number;
  intercept: number;
  rSquared: number;
  driftRateMsPerMin: number;
  message: string;
}

export interface MulticamAtempoSegment {
  startTime: number;
  endTime: number;
  tempoFactor: number;
}

export interface MulticamSyncReport {
  clipId: string;
  medianOffsetSeconds: number;
  medianOffsetMs: number;
  windowResults: MulticamSyncWindowResult[];
  drift: MulticamSyncDriftReport;
  confidence: MulticamSyncConfidence;
  atempoSegments: MulticamAtempoSegment[];
}

export interface MulticamSyncOptions {
  windowDurationSeconds?: number;
  sampleRate?: number;
  maxOffsetSeconds?: number;
  driftDetectionThresholdMsPerMin?: number;
}

const DEFAULT_WINDOW_DURATION_SECONDS = 10;
const DEFAULT_SAMPLE_RATE = 8000;
const DEFAULT_MAX_OFFSET_SECONDS = 10;
const DEFAULT_DRIFT_THRESHOLD_MS_PER_MIN = 50;
const HIGH_CONFIDENCE_SCORE = 0.7;
const MEDIUM_CONFIDENCE_SCORE = 0.4;

export function calculateSegmentedOffsets(
  referenceSamples: ArrayLike<number>,
  candidateSamples: ArrayLike<number>,
  sampleRate: number,
  windowDurationSeconds: number,
  maxOffsetSeconds: number,
): MulticamSyncWindowResult[] {
  const rate = Math.max(1, Math.round(sampleRate));
  const windowSamples = Math.max(1, Math.round(windowDurationSeconds * rate));
  const refLength = referenceSamples.length;
  const canLength = candidateSamples.length;
  const totalWindows = Math.max(1, Math.floor(Math.min(refLength, canLength) / windowSamples));
  const results: MulticamSyncWindowResult[] = [];

  for (let i = 0; i < totalWindows; i++) {
    const start = i * windowSamples;
    const end = Math.min(start + windowSamples, Math.min(refLength, canLength));
    if (end - start < rate) break;

    const refWindow = sliceArrayLike(referenceSamples, start, end);
    const canWindow = sliceArrayLike(candidateSamples, start, end);
    const peak = findWindowCorrelationPeak(refWindow, canWindow, rate, maxOffsetSeconds);

    results.push({
      windowIndex: i,
      startTime: round(start / rate),
      endTime: round(end / rate),
      offsetSeconds: peak.offsetSeconds,
      score: peak.score,
    });
  }
  return results;
}

export function calculateMedianOffset(windowResults: MulticamSyncWindowResult[]): number {
  if (windowResults.length === 0) return 0;
  const offsets = windowResults.map((w) => w.offsetSeconds).sort((a, b) => a - b);
  const mid = Math.floor(offsets.length / 2);
  return offsets.length % 2 === 0 ? round((offsets[mid - 1] + offsets[mid]) / 2) : round(offsets[mid]);
}

export function detectDrift(
  windowResults: MulticamSyncWindowResult[],
  thresholdMsPerMin: number = DEFAULT_DRIFT_THRESHOLD_MS_PER_MIN,
): MulticamSyncDriftReport {
  if (windowResults.length < 3) {
    return { hasDrift: false, slope: 0, intercept: 0, rSquared: 0, driftRateMsPerMin: 0, message: '' };
  }

  const n = windowResults.length;
  const xs = windowResults.map((w) => (w.startTime + w.endTime) / 2);
  const ys = windowResults.map((w) => w.offsetSeconds * 1000);

  const meanX = xs.reduce((s, v) => s + v, 0) / n;
  const meanY = ys.reduce((s, v) => s + v, 0) / n;

  let ssXX = 0;
  let ssXY = 0;
  let ssYY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    ssXX += dx * dx;
    ssXY += dx * dy;
    ssYY += dy * dy;
  }

  const slope = ssXX > 0 ? ssXY / ssXX : 0;
  const intercept = meanY - slope * meanX;
  const rSquared = ssYY > 0 ? (ssXY * ssXY) / (ssXX * ssYY) : 0;
  const driftRateMsPerMin = slope * 60;
  const hasDrift = Math.abs(driftRateMsPerMin) > thresholdMsPerMin && rSquared > 0.7;

  return {
    hasDrift,
    slope: round(slope, 6),
    intercept: round(intercept, 4),
    rSquared: round(rSquared, 4),
    driftRateMsPerMin: round(driftRateMsPerMin, 2),
    message: hasDrift ? '检测到时钟漂移，建议分段同步' : '',
  };
}

export function generateAtempoSegments(
  windowResults: MulticamSyncWindowResult[],
  drift: MulticamSyncDriftReport,
): MulticamAtempoSegment[] {
  if (!drift.hasDrift || windowResults.length < 2) {
    return [];
  }
  const segments: MulticamAtempoSegment[] = [];
  for (let i = 0; i < windowResults.length; i++) {
    const w = windowResults[i];
    const midpointMs = ((w.startTime + w.endTime) / 2) * 1000;
    const expectedMs = drift.slope * midpointMs + drift.intercept;
    const actualMs = w.offsetSeconds * 1000;
    const correctionMs = expectedMs - actualMs;
    const windowDurationMs = (w.endTime - w.startTime) * 1000;
    const tempoFactor = windowDurationMs > 0 ? round(1 + correctionMs / windowDurationMs, 6) : 1;

    segments.push({
      startTime: w.startTime,
      endTime: w.endTime,
      tempoFactor: Math.max(0.5, Math.min(2.0, tempoFactor)),
    });
  }
  return segments;
}

export function syncMulticamAudio(
  referenceSamples: ArrayLike<number>,
  candidateSamples: ArrayLike<number>,
  clipId: string,
  options: MulticamSyncOptions = {},
): MulticamSyncReport {
  const windowDuration = options.windowDurationSeconds ?? DEFAULT_WINDOW_DURATION_SECONDS;
  const sampleRate = options.sampleRate ?? DEFAULT_SAMPLE_RATE;
  const maxOffset = options.maxOffsetSeconds ?? DEFAULT_MAX_OFFSET_SECONDS;
  const driftThreshold = options.driftDetectionThresholdMsPerMin ?? DEFAULT_DRIFT_THRESHOLD_MS_PER_MIN;

  const windowResults = calculateSegmentedOffsets(
    referenceSamples,
    candidateSamples,
    sampleRate,
    windowDuration,
    maxOffset,
  );
  const medianOffset = calculateMedianOffset(windowResults);
  const drift = detectDrift(windowResults, driftThreshold);
  const atempoSegments = generateAtempoSegments(windowResults, drift);

  const avgScore = windowResults.length > 0 ? windowResults.reduce((s, w) => s + w.score, 0) / windowResults.length : 0;
  const confidence: MulticamSyncConfidence =
    avgScore >= HIGH_CONFIDENCE_SCORE ? 'high' : avgScore >= MEDIUM_CONFIDENCE_SCORE ? 'medium' : 'low';

  return {
    clipId,
    medianOffsetSeconds: medianOffset,
    medianOffsetMs: Math.round(medianOffset * 1000),
    windowResults,
    drift,
    confidence,
    atempoSegments,
  };
}

function findWindowCorrelationPeak(
  reference: number[],
  candidate: number[],
  sampleRate: number,
  maxOffsetSeconds: number,
): { offsetSeconds: number; score: number } {
  const maxLag = Math.min(reference.length - 1, Math.max(0, Math.round(maxOffsetSeconds * sampleRate)));
  let bestLag = 0;
  let bestScore = -Infinity;

  for (let lag = -maxLag; lag <= maxLag; lag++) {
    let dotProduct = 0;
    let refEnergy = 0;
    let canEnergy = 0;
    let count = 0;

    for (let i = 0; i < reference.length; i++) {
      const j = i - lag;
      if (j < 0 || j >= candidate.length) continue;
      dotProduct += reference[i] * candidate[j];
      refEnergy += reference[i] * reference[i];
      canEnergy += candidate[j] * candidate[j];
      count++;
    }

    if (count === 0) continue;
    const denom = Math.sqrt(refEnergy * canEnergy);
    const score = denom > 0 ? dotProduct / denom : 0;
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }

  return { offsetSeconds: round(bestLag / sampleRate), score: round(bestScore) };
}

function sliceArrayLike(source: ArrayLike<number>, start: number, end: number): number[] {
  const result: number[] = [];
  for (let i = start; i < end && i < source.length; i++) {
    result.push(typeof source[i] === 'number' && Number.isFinite(source[i]) ? source[i] : 0);
  }
  return result;
}

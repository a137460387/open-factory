export interface FrequencyPoint {
  index: number;
  hz: number;
  magnitude: number;
}

export interface FrequencyPeak extends FrequencyPoint {
  rank: number;
}

export interface PhasePoint {
  left: number;
  right: number;
}

export interface ChannelAnalysisFrame {
  sampleRate: number;
  frequencyData: ArrayLike<number>;
  leftTimeDomain: ArrayLike<number>;
  rightTimeDomain: ArrayLike<number>;
  recordedAtMs: number;
}

export interface ChannelAnalysisSnapshot {
  trackId: string;
  timeMs: number;
  frequency: FrequencyPoint[];
  peaks: FrequencyPeak[];
  phase: PhasePoint[];
  correlation: number;
}

export function mapFftBinsToHz(
  data: ArrayLike<number>,
  sampleRate: number,
  minHz = 20,
  maxHz = 20_000,
): FrequencyPoint[] {
  const length = Math.max(0, data.length);
  if (length === 0 || !Number.isFinite(sampleRate) || sampleRate <= 0) {
    return [];
  }
  const nyquist = sampleRate / 2;
  const cappedMax = Math.min(maxHz, nyquist);
  const binWidth = nyquist / length;
  const points: FrequencyPoint[] = [];
  for (let index = 0; index < length; index += 1) {
    const hz = index * binWidth;
    if (hz < minHz || hz > cappedMax) {
      continue;
    }
    points.push({
      index,
      hz: roundNumber(hz, 2),
      magnitude: normalizeMagnitude(data[index] ?? 0),
    });
  }
  return points;
}

export function calculateStereoCorrelation(left: ArrayLike<number>, right: ArrayLike<number>): number {
  const length = Math.min(left.length, right.length);
  if (length === 0) {
    return 0;
  }
  const leftMean = mean(left, length);
  const rightMean = mean(right, length);
  let numerator = 0;
  let leftPower = 0;
  let rightPower = 0;
  for (let index = 0; index < length; index += 1) {
    const l = normalizeWaveSample(left[index] ?? 0) - leftMean;
    const r = normalizeWaveSample(right[index] ?? 0) - rightMean;
    numerator += l * r;
    leftPower += l * l;
    rightPower += r * r;
  }
  const denominator = Math.sqrt(leftPower * rightPower);
  if (denominator <= Number.EPSILON) {
    return 0;
  }
  return roundNumber(Math.max(-1, Math.min(1, numerator / denominator)), 3);
}

export function detectTopFrequencyPeaks(points: FrequencyPoint[], count = 3): FrequencyPeak[] {
  const candidates = points.filter((point, index) => {
    const previous = points[index - 1]?.magnitude ?? -1;
    const next = points[index + 1]?.magnitude ?? -1;
    return point.magnitude >= previous && point.magnitude >= next;
  });
  const ranked = (candidates.length > 0 ? candidates : points)
    .slice()
    .sort((left, right) => right.magnitude - left.magnitude)
    .slice(0, Math.max(0, count));
  return ranked.map((point, index) => ({ ...point, rank: index + 1 }));
}

function buildPhasePoints(left: ArrayLike<number>, right: ArrayLike<number>, maxPoints = 128): PhasePoint[] {
  const length = Math.min(left.length, right.length);
  if (length === 0 || maxPoints <= 0) {
    return [];
  }
  const step = Math.max(1, Math.floor(length / maxPoints));
  const points: PhasePoint[] = [];
  for (let index = 0; index < length && points.length < maxPoints; index += step) {
    points.push({
      left: roundNumber(normalizeWaveSample(left[index] ?? 0), 3),
      right: roundNumber(normalizeWaveSample(right[index] ?? 0), 3),
    });
  }
  return points;
}

export function buildChannelAnalysisSnapshot(trackId: string, frame: ChannelAnalysisFrame): ChannelAnalysisSnapshot {
  const frequency = mapFftBinsToHz(frame.frequencyData, frame.sampleRate);
  return {
    trackId,
    timeMs: Math.round(frame.recordedAtMs),
    frequency,
    peaks: detectTopFrequencyPeaks(frequency, 3),
    phase: buildPhasePoints(frame.leftTimeDomain, frame.rightTimeDomain),
    correlation: calculateStereoCorrelation(frame.leftTimeDomain, frame.rightTimeDomain),
  };
}

export function serializeChannelAnalysisJson(snapshots: ChannelAnalysisSnapshot[]): string {
  return `${JSON.stringify(
    {
      version: 1,
      snapshots: snapshots.map((snapshot) => ({
        timeMs: snapshot.timeMs,
        trackId: snapshot.trackId,
        correlation: snapshot.correlation,
        peaks: snapshot.peaks.map((peak) => ({ rank: peak.rank, hz: peak.hz, loudness: peak.magnitude })),
        frequencyBands: snapshot.frequency.map((point) => ({ hz: point.hz, loudness: point.magnitude })),
      })),
    },
    null,
    2,
  )}\n`;
}

function normalizeMagnitude(value: number): number {
  const normalized = value > 1 ? value / 255 : value;
  return roundNumber(Math.max(0, Math.min(1, Number.isFinite(normalized) ? normalized : 0)), 4);
}

function normalizeWaveSample(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value >= 0 && value <= 255) {
    return Math.max(-1, Math.min(1, (value - 128) / 128));
  }
  return Math.max(-1, Math.min(1, value));
}

function mean(values: ArrayLike<number>, length: number): number {
  let total = 0;
  for (let index = 0; index < length; index += 1) {
    total += normalizeWaveSample(values[index] ?? 0);
  }
  return total / length;
}

function roundNumber(value: number, digits: number): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

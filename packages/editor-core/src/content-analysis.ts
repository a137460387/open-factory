import type { Clip } from './model-types';

export const CONTENT_ANALYSIS_VERSION = 1;

export const CONTENT_SCENE_TYPES = ['indoor', 'outdoor', 'night', 'action', 'dialogue', 'close-up'] as const;
export type ContentSceneType = (typeof CONTENT_SCENE_TYPES)[number];

export interface ContentAnalysisVisualSample {
  time: number;
  brightness: number;
  saturation: number;
  motion: number;
  faceRatio?: number;
  colorTemperature?: number;
}

export interface ContentAnalysisAudioSample {
  time: number;
  loudness: number;
}

export interface ContentAnalysisSegment {
  start: number;
  end: number;
  sceneTypes: ContentSceneType[];
  brightness: number;
  motion: number;
  loudness?: number;
}

export interface ContentEmotionPoint {
  time: number;
  value: number;
  brightness: number;
}

export interface ContentDialogueTurn {
  start: number;
  end: number;
  loudness: number;
}

export interface ClipContentAnalysis {
  version: number;
  analyzedAt: string;
  sceneTypes: ContentSceneType[];
  primarySceneType: ContentSceneType;
  segments: ContentAnalysisSegment[];
  emotionCurve: ContentEmotionPoint[];
  dialogueTurns: ContentDialogueTurn[];
  summary?: string;
}

export interface BuildClipContentAnalysisInput {
  duration: number;
  analyzedAt?: string;
  visualSamples: ContentAnalysisVisualSample[];
  audioSamples?: ContentAnalysisAudioSample[];
  segmentDuration?: number;
}

export function classifySceneTypes(input: {
  brightness: number;
  saturation: number;
  motion: number;
  faceRatio?: number;
  colorTemperature?: number;
  loudnessVariance?: number;
  silenceRatio?: number;
}): ContentSceneType[] {
  const brightness = clamp01(input.brightness);
  const saturation = clamp01(input.saturation);
  const motion = clamp01(input.motion);
  const faceRatio = clamp01(input.faceRatio ?? 0);
  const colorTemperature = input.colorTemperature ?? 5600;
  const loudnessVariance = Math.max(0, input.loudnessVariance ?? 0);
  const silenceRatio = clamp01(input.silenceRatio ?? 0);
  const output: ContentSceneType[] = [];

  if (brightness < 0.28) {
    output.push('night');
  }
  if (motion >= 0.58) {
    output.push('action');
  }
  if (faceRatio >= 0.32) {
    output.push('close-up');
  }
  if (loudnessVariance >= 0.08 && silenceRatio >= 0.18 && silenceRatio <= 0.72) {
    output.push('dialogue');
  }
  if (brightness >= 0.62 && saturation >= 0.34 && colorTemperature >= 5200 && !output.includes('night')) {
    output.push('outdoor');
  }
  if (!output.includes('outdoor') && !output.includes('night')) {
    output.push('indoor');
  }
  if (output.length === 0) {
    output.push('indoor');
  }
  return dedupeSceneTypes(output);
}

export function sampleEmotionCurve(
  samples: ContentAnalysisVisualSample[],
  segmentDuration: number,
): ContentEmotionPoint[] {
  const buckets = bucketVisualSamples(samples, segmentDuration);
  return buckets.map((bucket) => {
    const brightness = average(bucket.samples.map((sample) => clamp01(sample.brightness)));
    const previousBrightness = bucket.previousBrightness ?? brightness;
    return {
      time: round(bucket.start),
      brightness: round(brightness),
      value: round(Math.min(1, Math.abs(brightness - previousBrightness) * 1.6 + brightness * 0.65)),
    };
  });
}

export function detectDialogueTurns(
  samples: ContentAnalysisAudioSample[],
  options: { silenceThreshold?: number; minTurnDuration?: number; mergeGap?: number } = {},
): ContentDialogueTurn[] {
  const silenceThreshold = options.silenceThreshold ?? 0.08;
  const minTurnDuration = options.minTurnDuration ?? 0.35;
  const mergeGap = options.mergeGap ?? 0.28;
  const sorted = [...samples]
    .filter((sample) => Number.isFinite(sample.time) && Number.isFinite(sample.loudness))
    .sort((left, right) => left.time - right.time);
  const turns: ContentDialogueTurn[] = [];
  let active: { start: number; end: number; values: number[] } | undefined;

  for (let index = 0; index < sorted.length; index += 1) {
    const sample = sorted[index];
    const next = sorted[index + 1];
    const end = next ? next.time : sample.time + inferSampleStep(sorted, index);
    const loudness = clamp01(sample.loudness);
    if (loudness > silenceThreshold) {
      if (!active) {
        active = { start: sample.time, end, values: [loudness] };
      } else {
        active.end = end;
        active.values.push(loudness);
      }
      continue;
    }
    if (active && sample.time - active.end > mergeGap) {
      pushDialogueTurn(turns, active, minTurnDuration);
      active = undefined;
    }
  }
  if (active) {
    pushDialogueTurn(turns, active, minTurnDuration);
  }
  return turns;
}

export function buildClipContentAnalysis(input: BuildClipContentAnalysisInput): ClipContentAnalysis {
  const duration = Math.max(0, input.duration);
  const segmentDuration = Math.max(0.25, input.segmentDuration ?? Math.max(1, Math.min(4, duration / 4 || 1)));
  const visualBuckets = bucketVisualSamples(input.visualSamples, segmentDuration);
  const audioSamples = input.audioSamples ?? [];
  const dialogueTurns = detectDialogueTurns(audioSamples);
  const segments: ContentAnalysisSegment[] = visualBuckets.map((bucket) => {
    const audioInRange = audioSamples.filter((sample) => sample.time >= bucket.start && sample.time < bucket.end);
    const loudnessValues = audioInRange.map((sample) => clamp01(sample.loudness));
    const loudnessVariance = variance(loudnessValues);
    const silenceRatio =
      loudnessValues.length > 0 ? loudnessValues.filter((value) => value <= 0.08).length / loudnessValues.length : 0;
    const brightness = average(bucket.samples.map((sample) => clamp01(sample.brightness)));
    const motion = average(bucket.samples.map((sample) => clamp01(sample.motion)));
    const saturation = average(bucket.samples.map((sample) => clamp01(sample.saturation)));
    const faceRatio = average(bucket.samples.map((sample) => clamp01(sample.faceRatio ?? 0)));
    const colorTemperature = average(bucket.samples.map((sample) => sample.colorTemperature ?? 5600));
    return {
      start: round(bucket.start),
      end: round(Math.min(duration || bucket.end, bucket.end)),
      sceneTypes: classifySceneTypes({
        brightness,
        saturation,
        motion,
        faceRatio,
        colorTemperature,
        loudnessVariance,
        silenceRatio,
      }),
      brightness: round(brightness),
      motion: round(motion),
      ...(loudnessValues.length > 0 ? { loudness: round(average(loudnessValues)) } : {}),
    };
  });
  const sceneTypes = rankSceneTypes([
    ...segments.flatMap((segment) => segment.sceneTypes),
    ...(dialogueTurns.length > 0 ? (['dialogue'] as ContentSceneType[]) : []),
  ]);
  const primarySceneType = sceneTypes[0] ?? 'indoor';
  return normalizeClipContentAnalysis({
    version: CONTENT_ANALYSIS_VERSION,
    analyzedAt: input.analyzedAt ?? new Date(0).toISOString(),
    sceneTypes,
    primarySceneType,
    segments,
    emotionCurve: sampleEmotionCurve(input.visualSamples, segmentDuration),
    dialogueTurns,
    summary: buildContentAnalysisSummary(primarySceneType, segments.length, dialogueTurns.length),
  })!;
}

export function normalizeClipContentAnalysis(input: unknown): ClipContentAnalysis | undefined {
  if (!isRecord(input)) {
    return undefined;
  }
  const segments = Array.isArray(input.segments)
    ? input.segments.map(normalizeSegment).filter((segment): segment is ContentAnalysisSegment => Boolean(segment))
    : [];
  const emotionCurve = Array.isArray(input.emotionCurve)
    ? input.emotionCurve.map(normalizeEmotionPoint).filter((point): point is ContentEmotionPoint => Boolean(point))
    : [];
  const dialogueTurns = Array.isArray(input.dialogueTurns)
    ? input.dialogueTurns.map(normalizeDialogueTurn).filter((turn): turn is ContentDialogueTurn => Boolean(turn))
    : [];
  const sceneTypes = rankSceneTypes([
    ...(Array.isArray(input.sceneTypes) ? input.sceneTypes.filter(isContentSceneType) : []),
    ...segments.flatMap((segment) => segment.sceneTypes),
  ]);
  const primarySceneType = isContentSceneType(input.primarySceneType)
    ? input.primarySceneType
    : (sceneTypes[0] ?? 'indoor');
  const analyzedAt =
    typeof input.analyzedAt === 'string' && input.analyzedAt.trim() ? input.analyzedAt : new Date(0).toISOString();
  return {
    version: CONTENT_ANALYSIS_VERSION,
    analyzedAt,
    sceneTypes: sceneTypes.length > 0 ? sceneTypes : [primarySceneType],
    primarySceneType,
    segments,
    emotionCurve,
    dialogueTurns,
    ...(typeof input.summary === 'string' && input.summary.trim() ? { summary: input.summary.trim() } : {}),
  };
}

export function serializeClipContentAnalysisJson(clip: Pick<Clip, 'id' | 'name' | 'contentAnalysis'>): string {
  const analysis = normalizeClipContentAnalysis(clip.contentAnalysis);
  return JSON.stringify(
    {
      clipId: clip.id,
      clipName: clip.name,
      contentAnalysis: analysis ?? null,
    },
    null,
    2,
  );
}

function normalizeSegment(input: unknown): ContentAnalysisSegment | undefined {
  if (!isRecord(input)) {
    return undefined;
  }
  const start = finiteNumber(input.start);
  const end = finiteNumber(input.end);
  if (start === undefined || end === undefined || end < start) {
    return undefined;
  }
  const sceneTypes = rankSceneTypes(Array.isArray(input.sceneTypes) ? input.sceneTypes.filter(isContentSceneType) : []);
  return {
    start: round(Math.max(0, start)),
    end: round(Math.max(0, end)),
    sceneTypes: sceneTypes.length > 0 ? sceneTypes : ['indoor'],
    brightness: round(clamp01(finiteNumber(input.brightness) ?? 0)),
    motion: round(clamp01(finiteNumber(input.motion) ?? 0)),
    ...(finiteNumber(input.loudness) !== undefined ? { loudness: round(clamp01(finiteNumber(input.loudness)!)) } : {}),
  };
}

function normalizeEmotionPoint(input: unknown): ContentEmotionPoint | undefined {
  if (!isRecord(input)) {
    return undefined;
  }
  const time = finiteNumber(input.time);
  if (time === undefined) {
    return undefined;
  }
  return {
    time: round(Math.max(0, time)),
    value: round(clamp01(finiteNumber(input.value) ?? 0)),
    brightness: round(clamp01(finiteNumber(input.brightness) ?? finiteNumber(input.value) ?? 0)),
  };
}

function normalizeDialogueTurn(input: unknown): ContentDialogueTurn | undefined {
  if (!isRecord(input)) {
    return undefined;
  }
  const start = finiteNumber(input.start);
  const end = finiteNumber(input.end);
  if (start === undefined || end === undefined || end < start) {
    return undefined;
  }
  return {
    start: round(Math.max(0, start)),
    end: round(Math.max(0, end)),
    loudness: round(clamp01(finiteNumber(input.loudness) ?? 0)),
  };
}

function bucketVisualSamples(
  samples: ContentAnalysisVisualSample[],
  segmentDuration: number,
): Array<{ start: number; end: number; previousBrightness?: number; samples: ContentAnalysisVisualSample[] }> {
  const sorted = [...samples]
    .filter((sample) => Number.isFinite(sample.time))
    .sort((left, right) => left.time - right.time);
  if (sorted.length === 0) {
    return [
      { start: 0, end: segmentDuration, samples: [{ time: 0, brightness: 0.45, saturation: 0.35, motion: 0.1 }] },
    ];
  }
  const lastTime = Math.max(segmentDuration, sorted[sorted.length - 1].time);
  const buckets: Array<{
    start: number;
    end: number;
    previousBrightness?: number;
    samples: ContentAnalysisVisualSample[];
  }> = [];
  let previousBrightness: number | undefined;
  for (let start = 0; start <= lastTime + 0.000001; start += segmentDuration) {
    const end = start + segmentDuration;
    const inRange = sorted.filter((sample) => sample.time >= start && sample.time < end);
    if (inRange.length === 0) {
      continue;
    }
    buckets.push({ start, end, previousBrightness, samples: inRange });
    previousBrightness = average(inRange.map((sample) => clamp01(sample.brightness)));
  }
  return buckets;
}

function rankSceneTypes(types: ContentSceneType[]): ContentSceneType[] {
  const counts = new Map<ContentSceneType, number>();
  for (const type of types) {
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  return CONTENT_SCENE_TYPES.filter((type) => counts.has(type)).sort(
    (left, right) => (counts.get(right) ?? 0) - (counts.get(left) ?? 0),
  );
}

function dedupeSceneTypes(types: ContentSceneType[]): ContentSceneType[] {
  return CONTENT_SCENE_TYPES.filter((type) => types.includes(type));
}

function isContentSceneType(value: unknown): value is ContentSceneType {
  return typeof value === 'string' && CONTENT_SCENE_TYPES.includes(value as ContentSceneType);
}

function pushDialogueTurn(
  turns: ContentDialogueTurn[],
  active: { start: number; end: number; values: number[] },
  minTurnDuration: number,
): void {
  if (active.end - active.start < minTurnDuration) {
    return;
  }
  turns.push({ start: round(active.start), end: round(active.end), loudness: round(average(active.values)) });
}

function inferSampleStep(samples: ContentAnalysisAudioSample[], index: number): number {
  const current = samples[index];
  const previous = samples[index - 1];
  if (previous && current.time > previous.time) {
    return current.time - previous.time;
  }
  return 0.25;
}

function buildContentAnalysisSummary(primary: ContentSceneType, segmentCount: number, dialogueCount: number): string {
  return `${primary}:${segmentCount}:${dialogueCount}`;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function variance(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const mean = average(values);
  return average(values.map((value) => (value - mean) ** 2));
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

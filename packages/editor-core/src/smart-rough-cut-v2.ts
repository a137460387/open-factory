import {
  DEFAULT_CLIP_SPEED,
  DEFAULT_COLOR_CORRECTION,
  DEFAULT_TRANSFORM,
  DEFAULT_AUDIO_FADE_CURVE,
  createId
} from './model';
import type { ClipContentAnalysis } from './content-analysis';
import type { AudioClip, Clip, MediaAsset } from './model-types';
import { getClipSourceVisibleDuration, getClipSpeed } from './timeline';
import { round } from './time';

export interface SmartDialogueInterval {
  start: number;
  end: number;
  duration?: number;
  confidence?: number;
}

export type SmartRoughCutMediaClip = Extract<Clip, { type: 'video' }> | Extract<Clip, { type: 'audio' }>;
export type SmartRoughCutVisualClip = Extract<Clip, { type: 'video' }> | Extract<Clip, { type: 'image' }>;

export interface SmartRoughCutKeywordSource {
  name?: string;
  path?: string;
  type?: string;
  keywords?: string[];
  contentAnalysis?: ClipContentAnalysis;
}

export type SmartRoughCutBrollCandidate =
  | {
      kind: 'clip';
      clip: SmartRoughCutVisualClip;
      keywords?: string[];
    }
  | {
      kind: 'media';
      asset: MediaAsset;
      contentAnalysis?: ClipContentAnalysis;
      keywords?: string[];
    };

export function buildDialogueRoughCutClips(sourceClip: SmartRoughCutMediaClip, intervals: SmartDialogueInterval[]): SmartRoughCutMediaClip[] {
  const speed = getClipSpeed(sourceClip);
  let cursor = sourceClip.start;
  return normalizeDialogueIntervals(intervals, sourceClip.duration).map((interval, index) => {
    const duration = round(interval.end - interval.start);
    const trimStart = round(sourceClip.trimStart + interval.start * speed);
    const clip = cloneMediaClipSegment(sourceClip, {
      id: `${sourceClip.id}-dialogue-${index + 1}`,
      name: `${sourceClip.name} D${index + 1}`,
      start: cursor,
      duration,
      trimStart
    });
    cursor = round(cursor + duration);
    return clip;
  });
}

export function scoreBrollKeywordMatch(main: SmartRoughCutKeywordSource, candidate: SmartRoughCutKeywordSource): number {
  const mainTags = extractSceneTags(main);
  const candidateTags = extractSceneTags(candidate);
  const sceneScore = scoreSetOverlap(mainTags, candidateTags);
  const tokenScore = scoreSetOverlap(extractKeywordTokens(main), extractKeywordTokens(candidate));
  const typeScore = main.type && candidate.type && main.type === candidate.type ? 0.08 : 0;
  return round(Math.min(1, sceneScore * 0.62 + tokenScore * 0.3 + typeScore));
}

export function buildBrollInsertClips(mainClips: SmartRoughCutVisualClip[], candidates: SmartRoughCutBrollCandidate[], targetTrackId: string): SmartRoughCutVisualClip[] {
  const visualCandidates = candidates.filter(isVisualCandidate);
  if (visualCandidates.length === 0 || targetTrackId.trim() === '') {
    return [];
  }
  return [...mainClips]
    .sort((left, right) => left.start - right.start || left.id.localeCompare(right.id))
    .flatMap((mainClip, index) => {
      const candidate = chooseBestBrollCandidate(mainClip, visualCandidates, index);
      if (!candidate) {
        return [];
      }
      return [buildBrollClipFromCandidate(mainClip, candidate, targetTrackId, index)];
    });
}

export function buildRhythmAssembleClips(videoClips: SmartRoughCutVisualClip[], beatTimes: number[], targetTrackId?: string): SmartRoughCutVisualClip[] {
  const clips = [...videoClips].sort((left, right) => left.start - right.start || left.id.localeCompare(right.id));
  const beats = normalizeBeatTimes(beatTimes);
  const trackId = targetTrackId?.trim() || clips[0]?.trackId;
  if (clips.length === 0 || beats.length < 2 || !trackId) {
    return [];
  }
  return beats.slice(0, -1).flatMap((start, index) => {
    const end = beats[index + 1];
    const duration = round(end - start);
    if (duration <= 0.000001) {
      return [];
    }
    const source = clips[index % clips.length];
    return [
      cloneVisualClipSegment(source, {
        id: `${source.id}-rhythm-${index + 1}`,
        name: `${source.name} R${index + 1}`,
        trackId,
        start,
        duration,
        trimStart: source.trimStart
      })
    ];
  });
}

function normalizeDialogueIntervals(intervals: SmartDialogueInterval[], maxDuration: number): Array<{ start: number; end: number }> {
  const duration = Math.max(0, maxDuration);
  return intervals
    .map((interval) => {
      const start = round(Math.min(duration, Math.max(0, finiteOrDefault(interval.start, 0))));
      const requestedEnd = Number.isFinite(interval.end) ? interval.end : start + finiteOrDefault(interval.duration, 0);
      const end = round(Math.min(duration, Math.max(0, requestedEnd)));
      return { start: Math.min(start, end), end: Math.max(start, end) };
    })
    .filter((interval) => interval.end - interval.start > 0.000001)
    .sort((left, right) => left.start - right.start || left.end - right.end);
}

function normalizeBeatTimes(beatTimes: number[]): number[] {
  return Array.from(new Set(beatTimes.filter((time) => Number.isFinite(time) && time >= 0).map((time) => round(time)))).sort((left, right) => left - right);
}

function chooseBestBrollCandidate(
  mainClip: SmartRoughCutVisualClip,
  candidates: SmartRoughCutBrollCandidate[],
  offset: number
): SmartRoughCutBrollCandidate | undefined {
  return candidates
    .map((candidate, index) => ({
      candidate,
      index,
      score: scoreBrollKeywordMatch(mainClip, getCandidateKeywordSource(candidate))
    }))
    .sort((left, right) => right.score - left.score || ((left.index + offset) % candidates.length) - ((right.index + offset) % candidates.length))[0]?.candidate;
}

function buildBrollClipFromCandidate(
  mainClip: SmartRoughCutVisualClip,
  candidate: SmartRoughCutBrollCandidate,
  targetTrackId: string,
  index: number
): SmartRoughCutVisualClip {
  if (candidate.kind === 'clip') {
    return cloneVisualClipSegment(candidate.clip, {
      id: `${candidate.clip.id}-broll-${mainClip.id}`,
      name: `${candidate.clip.name} B${index + 1}`,
      trackId: targetTrackId,
      start: mainClip.start,
      duration: mainClip.duration,
      trimStart: candidate.clip.trimStart
    });
  }
  return createVisualClipFromAsset(candidate.asset, {
    id: `${candidate.asset.id}-broll-${mainClip.id}`,
    name: `${candidate.asset.name} B${index + 1}`,
    trackId: targetTrackId,
    start: mainClip.start,
    duration: mainClip.duration
  });
}

export function createVisualClipFromAsset(
  asset: MediaAsset,
  input: { id: string; name: string; trackId: string; start: number; duration: number }
): SmartRoughCutVisualClip {
  const duration = round(Math.max(0.001, input.duration));
  const base = {
    id: input.id,
    name: input.name,
    mediaId: asset.id,
    trackId: input.trackId,
    start: round(Math.max(0, input.start)),
    duration,
    trimStart: 0,
    trimEnd: asset.type === 'video' ? round(Math.max(0, (asset.duration || duration) - duration)) : 0,
    speed: DEFAULT_CLIP_SPEED,
    colorCorrection: { ...DEFAULT_COLOR_CORRECTION },
    transform: { ...DEFAULT_TRANSFORM }
  };
  if (asset.type === 'image') {
    return { ...base, type: 'image' };
  }
  return { ...base, type: 'video', volume: 1 };
}

function cloneMediaClipSegment<TClip extends SmartRoughCutMediaClip>(
  source: TClip,
  patch: { id: string; name: string; start: number; duration: number; trimStart: number }
): TClip {
  const trimEnd = calculateTrimEnd(source, patch.trimStart, patch.duration);
  return cloneClipValue({
    ...source,
    id: patch.id,
    name: patch.name,
    start: round(Math.max(0, patch.start)),
    duration: round(Math.max(0.001, patch.duration)),
    trimStart: round(Math.max(0, patch.trimStart)),
    trimEnd
  }) as TClip;
}

function cloneVisualClipSegment<TClip extends SmartRoughCutVisualClip>(
  source: TClip,
  patch: { id: string; name: string; trackId: string; start: number; duration: number; trimStart: number }
): TClip {
  const trimEnd = source.type === 'video' ? calculateTrimEnd(source, patch.trimStart, patch.duration) : source.trimEnd;
  return cloneClipValue({
    ...source,
    id: patch.id,
    name: patch.name,
    trackId: patch.trackId,
    start: round(Math.max(0, patch.start)),
    duration: round(Math.max(0.001, patch.duration)),
    trimStart: round(Math.max(0, patch.trimStart)),
    trimEnd
  }) as TClip;
}

function calculateTrimEnd(source: Pick<Clip, 'duration' | 'trimStart' | 'trimEnd' | 'speed' | 'keyframes'>, nextTrimStart: number, nextDuration: number): number {
  const totalSourceDuration = round(source.trimStart + getClipSourceVisibleDuration(source) + source.trimEnd);
  const visibleSourceDuration = round(nextDuration * getClipSpeed(source));
  return round(Math.max(0, totalSourceDuration - Math.max(0, nextTrimStart) - visibleSourceDuration));
}

function getCandidateKeywordSource(candidate: SmartRoughCutBrollCandidate): SmartRoughCutKeywordSource {
  if (candidate.kind === 'clip') {
    return {
      name: candidate.clip.name,
      type: candidate.clip.type,
      keywords: candidate.keywords,
      contentAnalysis: candidate.clip.contentAnalysis
    };
  }
  return {
    name: candidate.asset.name,
    path: candidate.asset.path,
    type: candidate.asset.type,
    keywords: candidate.keywords,
    contentAnalysis: candidate.contentAnalysis
  };
}

function isVisualCandidate(candidate: SmartRoughCutBrollCandidate): boolean {
  if (candidate.kind === 'clip') {
    return candidate.clip.type === 'video' || candidate.clip.type === 'image';
  }
  return candidate.asset.type === 'video' || candidate.asset.type === 'image';
}

function extractSceneTags(source: SmartRoughCutKeywordSource): string[] {
  return dedupe([
    source.type,
    source.contentAnalysis?.primarySceneType,
    ...(source.contentAnalysis?.sceneTypes ?? []),
    ...(source.contentAnalysis?.segments?.flatMap((segment) => segment.sceneTypes) ?? [])
  ]);
}

function extractKeywordTokens(source: SmartRoughCutKeywordSource): string[] {
  return dedupe([...(source.keywords ?? []), ...tokenize(source.name), ...tokenize(source.path), ...tokenize(source.contentAnalysis?.summary)]);
}

function scoreSetOverlap(left: string[], right: string[]): number {
  if (left.length === 0 || right.length === 0) {
    return 0;
  }
  const rightSet = new Set(right);
  const matches = left.filter((item) => rightSet.has(item)).length;
  return matches / Math.max(left.length, right.length);
}

function tokenize(value: string | undefined): string[] {
  return (value ?? '')
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fa5]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function dedupe(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0).map((value) => value.trim().toLowerCase())));
}

function finiteOrDefault(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function cloneClipValue<T>(value: T): T {
  return globalThis.structuredClone ? globalThis.structuredClone(value) : (JSON.parse(JSON.stringify(value)) as T);
}

// ─── Smart Montage ──────────────────────────────────────────────

export interface SmartMontageConfig {
  assets: MediaAsset[];
  beatTimes: number[];
  videoTrackId: string;
  audioTrackId: string;
  audioAsset: MediaAsset;
  strategy?: 'sequential' | 'random';
}

export interface SmartMontageResult {
  visualClips: SmartRoughCutVisualClip[];
  audioClip: AudioClip;
  estimatedBpm: number;
  beatCount: number;
}

export function estimateBpmFromTimes(beatTimes: number[]): number {
  if (beatTimes.length < 2) return 0;
  const sorted = [...beatTimes].sort((a, b) => a - b);
  const intervals: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const interval = sorted[i] - sorted[i - 1];
    if (interval > 0) intervals.push(interval);
  }
  if (intervals.length === 0) return 0;
  intervals.sort((a, b) => a - b);
  const median = intervals[Math.floor(intervals.length / 2)];
  return round(60 / median);
}

export function buildSmartMontageClips(config: SmartMontageConfig): SmartMontageResult | null {
  const { assets, beatTimes, videoTrackId, audioTrackId, audioAsset, strategy = 'sequential' } = config;
  const beats = normalizeBeatTimes(beatTimes);
  const visualAssets = assets.filter((a) => a.type === 'video' || a.type === 'image');
  if (visualAssets.length === 0 || beats.length < 2 || !videoTrackId || !audioTrackId) return null;

  const orderedAssets = strategy === 'random' ? shuffleArray([...visualAssets]) : [...visualAssets];

  const visualClips: SmartRoughCutVisualClip[] = beats.slice(0, -1).flatMap((start, index) => {
    const end = beats[index + 1];
    const duration = round(end - start);
    if (duration <= 0.000001) return [];
    const asset = orderedAssets[index % orderedAssets.length];
    return [createVisualClipFromAsset(asset, {
      id: createId('montage'),
      name: `${asset.name} M${index + 1}`,
      trackId: videoTrackId,
      start,
      duration
    })];
  });

  const montageStart = beats[0];
  const montageEnd = beats[beats.length - 1];
  const audioDuration = round(montageEnd - montageStart);
  const audioClip: AudioClip = {
    id: createId('montage-audio'),
    name: `${audioAsset.name} BGM`,
    trackId: audioTrackId,
    start: montageStart,
    duration: audioDuration,
    trimStart: 0,
    trimEnd: round(Math.max(0, (audioAsset.duration || audioDuration) - audioDuration)),
    speed: DEFAULT_CLIP_SPEED,
    colorCorrection: { ...DEFAULT_COLOR_CORRECTION },
    transform: { ...DEFAULT_TRANSFORM },
    type: 'audio',
    mediaId: audioAsset.id,
    volume: 1,
    fadeInDuration: 0,
    fadeOutDuration: 0,
    fadeInCurve: DEFAULT_AUDIO_FADE_CURVE,
    fadeOutCurve: DEFAULT_AUDIO_FADE_CURVE
  };

  return { visualClips, audioClip, estimatedBpm: estimateBpmFromTimes(beats), beatCount: beats.length };
}

function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

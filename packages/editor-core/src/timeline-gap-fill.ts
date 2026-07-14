import {
  DEFAULT_CHROMA_KEY,
  DEFAULT_CLIP_SPEED,
  DEFAULT_COLOR_CORRECTION,
  DEFAULT_TRANSFORM,
  createId,
  normalizeChromaKey,
  type Clip,
  type Timeline,
  type Transition,
  type TransitionType,
} from './model';
import {
  calculateSpeedCurveSourceDuration,
  clampTransitionDuration,
  getClipSourceVisibleDuration,
  getClipSpeed,
} from './timeline';
import { round } from './time';

const EPSILON = 0.000001;

export type GapFillStrategy = 'freeze-frame' | 'black' | 'white' | 'repeat' | 'crossfade';

export interface TimelineGap {
  trackId: string;
  start: number;
  end: number;
  duration: number;
  previousClip?: Clip;
  nextClip?: Clip;
}

export type FillGapOperation =
  | { type: 'insert-clip'; clip: Clip }
  | { type: 'repeat-previous'; clipId?: string; name?: string }
  | { type: 'crossfade'; transitionId?: string; transitionType?: TransitionType; duration?: number };

export function findTimelineGapAtTime(timeline: Timeline, trackId: string, time: number): TimelineGap | undefined {
  const track = timeline.tracks.find((item) => item.id === trackId);
  if (!track) {
    return undefined;
  }
  const sortedClips = [...track.clips].sort(
    (left, right) => left.start - right.start || left.id.localeCompare(right.id),
  );
  const target = round(Math.max(0, time));
  let cursor = 0;
  let previousClip: Clip | undefined;
  for (const clip of sortedClips) {
    if (clip.start - cursor > EPSILON && target >= cursor - EPSILON && target <= clip.start + EPSILON) {
      return {
        trackId,
        start: round(cursor),
        end: round(clip.start),
        duration: round(clip.start - cursor),
        previousClip,
        nextClip: clip,
      };
    }
    if (clip.start + clip.duration >= cursor - EPSILON) {
      cursor = Math.max(cursor, clip.start + clip.duration);
      previousClip = clip;
    }
  }
  return undefined;
}

export function buildGapFillCommandOperation(
  strategy: GapFillStrategy,
  options: { clip?: Clip; transitionType?: TransitionType } = {},
): FillGapOperation {
  if (strategy === 'repeat') {
    return { type: 'repeat-previous' };
  }
  if (strategy === 'crossfade') {
    return { type: 'crossfade', transitionType: options.transitionType ?? 'dissolve' };
  }
  if (!options.clip) {
    throw new Error('Insert gap fill strategies require a clip');
  }
  return { type: 'insert-clip', clip: options.clip };
}

export function createGapFillImageClip(input: {
  id?: string;
  name: string;
  mediaId: string;
  trackId: string;
  start: number;
  duration: number;
}): Extract<Clip, { type: 'image' }> {
  return {
    id: input.id ?? createId('clip-gap-fill'),
    type: 'image',
    name: input.name,
    mediaId: input.mediaId,
    trackId: input.trackId,
    start: round(Math.max(0, input.start)),
    duration: round(Math.max(0, input.duration)),
    trimStart: 0,
    trimEnd: 0,
    speed: DEFAULT_CLIP_SPEED,
    colorCorrection: { ...DEFAULT_COLOR_CORRECTION },
    transform: { ...DEFAULT_TRANSFORM },
    chromaKey: normalizeChromaKey(DEFAULT_CHROMA_KEY),
    masks: [],
  };
}

export function buildRepeatedGapFillClip(gap: TimelineGap, options: { clipId?: string; name?: string } = {}): Clip {
  const source = gap.previousClip;
  if (!source) {
    throw new Error('Repeat gap fill requires a previous clip');
  }
  const sourceVisibleDuration = getClipSourceVisibleDuration(source);
  const repeatDisplayDuration = Math.min(gap.duration, source.duration);
  const repeatSourceDuration = Math.min(
    sourceVisibleDuration,
    calculateSpeedCurveSourceDuration(repeatDisplayDuration, source.keyframes, getClipSpeed(source)),
  );
  const clone = cloneStructured(source);
  return {
    ...clone,
    id: options.clipId ?? createId('clip-gap-repeat'),
    name: options.name ?? `${source.name} Repeat`,
    start: gap.start,
    duration: gap.duration,
    trimStart:
      source.type === 'image' ? 0 : round(source.trimStart + Math.max(0, sourceVisibleDuration - repeatSourceDuration)),
    trimEnd: source.trimEnd,
    keyframes: undefined,
  } as Clip;
}

export function buildCrossfadeGapFillTransition(
  gap: TimelineGap,
  operation: Extract<FillGapOperation, { type: 'crossfade' }>,
): Transition {
  if (!gap.previousClip || !gap.nextClip) {
    throw new Error('Crossfade gap fill requires adjacent clips around the gap');
  }
  const duration = clampTransitionDuration(operation.duration ?? gap.duration / 2, gap.previousClip, gap.nextClip);
  if (duration <= EPSILON) {
    throw new Error('Crossfade gap fill duration is too short');
  }
  return {
    id: operation.transitionId ?? createId('transition-gap-fill'),
    type: operation.transitionType ?? 'dissolve',
    duration,
    fromClipId: gap.previousClip.id,
    toClipId: gap.nextClip.id,
  };
}

export function buildFreezeFrameFfmpegArgs(sourcePath: string, outputPath: string, sourceTime: number): string[] {
  return [
    '-y',
    '-hide_banner',
    '-ss',
    formatGapFillFfmpegSeconds(sourceTime),
    '-i',
    sourcePath,
    '-vf',
    'select=eq(n\\,0)',
    '-frames:v',
    '1',
    outputPath,
  ];
}

export function buildSolidColorFrameFfmpegArgs(
  outputPath: string,
  color: string,
  width: number,
  height: number,
): string[] {
  const safeWidth = Math.max(16, Math.round(width) || 1920);
  const safeHeight = Math.max(16, Math.round(height) || 1080);
  return [
    '-y',
    '-hide_banner',
    '-f',
    'lavfi',
    '-i',
    `color=c=${normalizeGapFillFfmpegColor(color)}:s=${safeWidth}x${safeHeight}:d=0.04`,
    '-frames:v',
    '1',
    outputPath,
  ];
}

export function normalizeGapFillFfmpegColor(color: string): string {
  const trimmed = color.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return `0x${trimmed.slice(1)}`;
  }
  if (/^[a-z]+$/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  return 'black';
}

function formatGapFillFfmpegSeconds(value: number): string {
  return String(round(Math.max(0, Number.isFinite(value) ? value : 0)));
}

function cloneStructured<T>(value: T): T {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

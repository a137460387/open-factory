import { normalizeProjectColorPipeline, type ProjectColorPipeline } from './color-pipeline';
import type { Clip, MediaAsset, Sequence, Timeline } from './model';
import { round } from './time';

export const TIMELINE_RENDER_CACHE_DEFAULT_MEMORY_BYTES = 256 * 1024 * 1024;
export const TIMELINE_RENDER_CACHE_PRERENDER_SECONDS = 5;
export const TIMELINE_RENDER_CACHE_RETAIN_SECONDS = 10;

export interface TimelineRenderFrameKeyInput {
  timeline: Timeline;
  media: MediaAsset[];
  frame: number;
  fps: number;
  width: number;
  height: number;
  sequences?: Sequence[];
  activeSequenceId?: string;
  colorPipeline?: ProjectColorPipeline;
}

export interface TimelineRenderFrameRequest {
  frame: number;
  time: number;
  key: string;
}

export interface TimelineRenderRange {
  start: number;
  end: number;
}

export interface TimelineRenderFrameCacheEntry<TBitmap> {
  key: string;
  bitmap: TBitmap;
  time: number;
  duration: number;
  bytes: number;
  ts?: number;
}

export interface TimelineRenderFrameCacheSnapshot {
  ranges: TimelineRenderRange[];
  bytes: number;
  count: number;
}

export interface TimelineRenderFrameCacheOptions<TBitmap> {
  maxBytes?: number;
  disposeBitmap?: (bitmap: TBitmap) => void;
}

export class TimelineRenderFrameCache<TBitmap> {
  private readonly entries = new Map<string, Required<TimelineRenderFrameCacheEntry<TBitmap>>>();
  private readonly maxBytes: number;
  private readonly disposeBitmap?: (bitmap: TBitmap) => void;
  private bytes = 0;

  constructor(options: TimelineRenderFrameCacheOptions<TBitmap> = {}) {
    this.maxBytes = Math.max(1, options.maxBytes ?? TIMELINE_RENDER_CACHE_DEFAULT_MEMORY_BYTES);
    this.disposeBitmap = options.disposeBitmap;
  }

  get sizeBytes(): number {
    return this.bytes;
  }

  get size(): number {
    return this.entries.size;
  }

  put(entry: TimelineRenderFrameCacheEntry<TBitmap>, now = Date.now()): TimelineRenderFrameCacheSnapshot {
    this.delete(entry.key);
    const normalized: Required<TimelineRenderFrameCacheEntry<TBitmap>> = {
      ...entry,
      time: round(Math.max(0, entry.time)),
      duration: round(Math.max(0, entry.duration)),
      bytes: Math.max(1, Math.round(entry.bytes)),
      ts: entry.ts ?? now,
    };
    this.entries.set(normalized.key, normalized);
    this.bytes += normalized.bytes;
    this.pruneToBudget();
    return this.snapshot();
  }

  get(key: string, now = Date.now()): TBitmap | undefined {
    const entry = this.entries.get(key);
    if (!entry) {
      return undefined;
    }
    entry.ts = now;
    return entry.bitmap;
  }

  has(key: string): boolean {
    return this.entries.has(key);
  }

  retainAround(
    playheadTime: number,
    retainSeconds = TIMELINE_RENDER_CACHE_RETAIN_SECONDS,
  ): TimelineRenderFrameCacheSnapshot {
    const start = Math.max(0, playheadTime - retainSeconds);
    const end = playheadTime + retainSeconds;
    for (const entry of [...this.entries.values()]) {
      if (entry.time < start || entry.time > end) {
        this.delete(entry.key);
      }
    }
    this.pruneToBudget();
    return this.snapshot();
  }

  invalidateRange(start: number, end: number): TimelineRenderFrameCacheSnapshot {
    const normalizedStart = Math.max(0, Math.min(start, end));
    const normalizedEnd = Math.max(normalizedStart, Math.max(start, end));
    for (const entry of [...this.entries.values()]) {
      const entryEnd = entry.time + Math.max(entry.duration, 0.000001);
      if (entry.time < normalizedEnd && entryEnd > normalizedStart) {
        this.delete(entry.key);
      }
    }
    return this.snapshot();
  }

  clear(): TimelineRenderFrameCacheSnapshot {
    for (const key of [...this.entries.keys()]) {
      this.delete(key);
    }
    return this.snapshot();
  }

  snapshot(): TimelineRenderFrameCacheSnapshot {
    return {
      ranges: mergeTimelineRenderRanges(
        [...this.entries.values()].map((entry) => ({
          start: entry.time,
          end: round(entry.time + Math.max(entry.duration, 0.000001)),
        })),
      ),
      bytes: this.bytes,
      count: this.entries.size,
    };
  }

  private pruneToBudget(): void {
    if (this.bytes <= this.maxBytes) return;
    // 收集所有条目并按时间戳排序（最旧的优先淘汰）
    const entries = [...this.entries.values()];
    entries.sort((a, b) => a.ts - b.ts);
    for (const entry of entries) {
      if (this.bytes <= this.maxBytes) break;
      this.delete(entry.key);
    }
  }

  private delete(key: string): void {
    const entry = this.entries.get(key);
    if (!entry) {
      return;
    }
    this.entries.delete(key);
    this.bytes = Math.max(0, this.bytes - entry.bytes);
    this.disposeBitmap?.(entry.bitmap);
  }
}

export function buildTimelineRenderFrameKey(input: TimelineRenderFrameKeyInput): string {
  const frame = Math.max(0, Math.round(input.frame));
  const fps = normalizePositiveInteger(input.fps, 30);
  const width = normalizePositiveInteger(input.width, 1280);
  const height = normalizePositiveInteger(input.height, 720);
  const signature = buildTimelineRenderSignature(input.timeline, input.media, input.sequences, input.activeSequenceId);
  const colorPipeline = normalizeProjectColorPipeline(input.colorPipeline);
  return `timeline-render:${hashString(`${signature}|colorPipeline=${colorPipeline}`)}:${width}x${height}:${fps}:${frame}`;
}

export function buildTimelineRenderFrameRequests(input: {
  timeline: Timeline;
  media: MediaAsset[];
  playheadTime: number;
  duration: number;
  fps: number;
  width: number;
  height: number;
  sequences?: Sequence[];
  activeSequenceId?: string;
  colorPipeline?: ProjectColorPipeline;
  beforeSeconds?: number;
  afterSeconds?: number;
}): TimelineRenderFrameRequest[] {
  const fps = normalizePositiveInteger(input.fps, 30);
  const duration = Math.max(0, input.duration);
  const before = Math.max(0, input.beforeSeconds ?? TIMELINE_RENDER_CACHE_PRERENDER_SECONDS);
  const after = Math.max(0, input.afterSeconds ?? TIMELINE_RENDER_CACHE_PRERENDER_SECONDS);
  const maxFrame = Math.ceil(duration * fps);
  const rawStartFrame = Math.max(0, Math.floor((input.playheadTime - before) * fps));
  const endFrame = Math.min(Math.max(rawStartFrame, Math.ceil((input.playheadTime + after) * fps)), maxFrame);
  const startFrame = Math.min(rawStartFrame, endFrame);
  const requests: TimelineRenderFrameRequest[] = [];
  for (let frame = startFrame; frame <= endFrame; frame += 1) {
    const time = round(frame / fps);
    requests.push({
      frame,
      time,
      key: buildTimelineRenderFrameKey({ ...input, fps, frame }),
    });
  }
  return requests;
}

export function getTimelineRenderInvalidationRanges(previous: Timeline, next: Timeline): TimelineRenderRange[] {
  const previousClips = flattenTimelineClips(previous);
  const nextClips = flattenTimelineClips(next);
  const ids = new Set([...previousClips.keys(), ...nextClips.keys()]);
  const ranges: TimelineRenderRange[] = [];

  for (const id of ids) {
    const before = previousClips.get(id);
    const after = nextClips.get(id);
    if (!before || !after || buildClipRenderSignature(before) !== buildClipRenderSignature(after)) {
      if (before) {
        ranges.push({ start: before.start, end: before.start + before.duration });
      }
      if (after) {
        ranges.push({ start: after.start, end: after.start + after.duration });
      }
    }
  }

  if (stableStringify(previous.transitions ?? []) !== stableStringify(next.transitions ?? [])) {
    ranges.push({ start: 0, end: Math.max(getTimelineEnd(previous), getTimelineEnd(next)) });
  }

  return mergeTimelineRenderRanges(ranges);
}

export function mergeTimelineRenderRanges(ranges: TimelineRenderRange[]): TimelineRenderRange[] {
  const sorted = ranges
    .map((range) => ({
      start: round(Math.max(0, Math.min(range.start, range.end))),
      end: round(Math.max(0, Math.max(range.start, range.end))),
    }))
    .filter((range) => range.end > range.start)
    .sort((left, right) => left.start - right.start || left.end - right.end);

  const merged: TimelineRenderRange[] = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (!last || range.start > last.end + 0.000001) {
      merged.push({ ...range });
      continue;
    }
    last.end = round(Math.max(last.end, range.end));
  }
  return merged;
}

function buildTimelineRenderSignature(
  timeline: Timeline,
  media: MediaAsset[],
  sequences: Sequence[] = [],
  activeSequenceId?: string,
): string {
  const relevantMedia = media.map((asset) => ({
    id: asset.id,
    path: asset.path,
    proxyPath: asset.proxyPath,
    missing: asset.missing,
    duration: asset.duration,
    width: asset.width,
    height: asset.height,
    size: asset.size,
    mtimeMs: asset.mtimeMs,
    cacheKey: asset.cacheKey,
  }));
  return stableStringify({
    activeSequenceId,
    timeline: normalizeTimelineForSignature(timeline),
    sequences: sequences.map((sequence) => ({
      id: sequence.id,
      timeline: normalizeTimelineForSignature(sequence.timeline),
    })),
    media: relevantMedia,
  });
}

function normalizeTimelineForSignature(timeline: Timeline): unknown {
  return {
    transitions: timeline.transitions ?? [],
    tracks: timeline.tracks.map((track) => ({
      id: track.id,
      type: track.type,
      muted: track.muted,
      solo: track.solo,
      clips: track.clips.map((clip) => buildClipRenderSignature(clip)),
    })),
  };
}

function buildClipRenderSignature(clip: Clip): string {
  return stableStringify({
    id: clip.id,
    type: clip.type,
    trackId: clip.trackId,
    start: clip.start,
    duration: clip.duration,
    trimStart: clip.trimStart,
    trimEnd: clip.trimEnd,
    speed: clip.speed,
    transform: clip.transform,
    colorCorrection: clip.colorCorrection,
    chromaKey: clip.chromaKey,
    stabilization: clip.stabilization,
    projection: clip.projection,
    panorama: clip.panorama,
    masks: clip.masks,
    keyframes: clip.keyframes,
    effects: clip.effects,
    mediaId: 'mediaId' in clip ? clip.mediaId : undefined,
    text: 'text' in clip ? clip.text : undefined,
    style: 'style' in clip ? clip.style : undefined,
    subtitleMode: 'subtitleMode' in clip ? clip.subtitleMode : undefined,
    sequenceId: 'sequenceId' in clip ? clip.sequenceId : undefined,
  });
}

function flattenTimelineClips(timeline: Timeline): Map<string, Clip> {
  return new Map(timeline.tracks.flatMap((track) => track.clips.map((clip) => [clip.id, clip] as const)));
}

function getTimelineEnd(timeline: Timeline): number {
  return timeline.tracks.reduce(
    (duration, track) => Math.max(duration, ...track.clips.map((clip) => clip.start + clip.duration), 0),
    0,
  );
}

function normalizePositiveInteger(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

function hashString(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

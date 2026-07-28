import { normalizeProjectColorPipeline } from './color-pipeline';
import { round } from './time';
// MinHeap for efficient LRU eviction
class MinHeap {
    heap = [];
    compare;
    constructor(compare) {
        this.compare = compare;
    }
    get size() {
        return this.heap.length;
    }
    push(item) {
        this.heap.push(item);
        this.bubbleUp(this.heap.length - 1);
    }
    peek() {
        return this.heap[0];
    }
    pop() {
        if (this.heap.length === 0)
            return undefined;
        const min = this.heap[0];
        const last = this.heap.pop();
        if (this.heap.length > 0) {
            this.heap[0] = last;
            this.sinkDown(0);
        }
        return min;
    }
    remove(item) {
        const index = this.heap.indexOf(item);
        if (index === -1)
            return false;
        if (index === this.heap.length - 1) {
            this.heap.pop();
            return true;
        }
        const last = this.heap.pop();
        this.heap[index] = last;
        this.bubbleUp(index);
        this.sinkDown(index);
        return true;
    }
    reheapify(item) {
        const index = this.heap.indexOf(item);
        if (index === -1)
            return;
        this.bubbleUp(index);
        this.sinkDown(index);
    }
    clear() {
        this.heap = [];
    }
    toArray() {
        return [...this.heap].sort(this.compare);
    }
    bubbleUp(index) {
        while (index > 0) {
            const parent = Math.floor((index - 1) / 2);
            if (this.compare(this.heap[index], this.heap[parent]) >= 0)
                break;
            [this.heap[index], this.heap[parent]] = [this.heap[parent], this.heap[index]];
            index = parent;
        }
    }
    sinkDown(index) {
        const length = this.heap.length;
        while (true) {
            let smallest = index;
            const left = 2 * index + 1;
            const right = 2 * index + 2;
            if (left < length && this.compare(this.heap[left], this.heap[smallest]) < 0) {
                smallest = left;
            }
            if (right < length && this.compare(this.heap[right], this.heap[smallest]) < 0) {
                smallest = right;
            }
            if (smallest === index)
                break;
            [this.heap[index], this.heap[smallest]] = [this.heap[smallest], this.heap[index]];
            index = smallest;
        }
    }
}
export const TIMELINE_RENDER_CACHE_DEFAULT_MEMORY_BYTES = 256 * 1024 * 1024;
export const TIMELINE_RENDER_CACHE_PRERENDER_SECONDS = 5;
export const TIMELINE_RENDER_CACHE_RETAIN_SECONDS = 10;
export class TimelineRenderFrameCache {
    entries = new Map();
    maxBytes;
    disposeBitmap;
    bytes = 0;
    heap;
    constructor(options = {}) {
        this.maxBytes = Math.max(1, options.maxBytes ?? TIMELINE_RENDER_CACHE_DEFAULT_MEMORY_BYTES);
        this.disposeBitmap = options.disposeBitmap;
        this.heap = new MinHeap((a, b) => a.ts - b.ts);
    }
    get sizeBytes() {
        return this.bytes;
    }
    get size() {
        return this.entries.size;
    }
    put(entry, now = Date.now()) {
        this.delete(entry.key);
        const normalized = {
            ...entry,
            time: round(Math.max(0, entry.time)),
            duration: round(Math.max(0, entry.duration)),
            bytes: Math.max(1, Math.round(entry.bytes)),
            ts: entry.ts ?? now,
        };
        this.entries.set(normalized.key, normalized);
        this.heap.push(normalized);
        this.bytes += normalized.bytes;
        this.pruneToBudget();
        return this.snapshot();
    }
    get(key, now = Date.now()) {
        const entry = this.entries.get(key);
        if (!entry) {
            return undefined;
        }
        entry.ts = now;
        this.heap.reheapify(entry);
        return entry.bitmap;
    }
    has(key) {
        return this.entries.has(key);
    }
    retainAround(playheadTime, retainSeconds = TIMELINE_RENDER_CACHE_RETAIN_SECONDS) {
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
    invalidateRange(start, end) {
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
    clear() {
        for (const key of [...this.entries.keys()]) {
            this.delete(key);
        }
        this.heap.clear();
        return this.snapshot();
    }
    snapshot() {
        return {
            ranges: mergeTimelineRenderRanges([...this.entries.values()].map((entry) => ({
                start: entry.time,
                end: round(entry.time + Math.max(entry.duration, 0.000001)),
            }))),
            bytes: this.bytes,
            count: this.entries.size,
        };
    }
    pruneToBudget() {
        if (this.bytes <= this.maxBytes)
            return;
        // Use MinHeap with lazy deletion: skip entries already removed from map
        while (this.bytes > this.maxBytes && this.heap.size > 0) {
            const oldest = this.heap.pop();
            if (!oldest)
                break;
            // Skip stale entries (removed by prior delete or replaced by put)
            if (!this.entries.has(oldest.key) || this.entries.get(oldest.key) !== oldest)
                continue;
            this.delete(oldest.key);
        }
    }
    delete(key) {
        const entry = this.entries.get(key);
        if (!entry) {
            return;
        }
        this.entries.delete(key);
        this.heap.remove(entry);
        this.bytes = Math.max(0, this.bytes - entry.bytes);
        this.disposeBitmap?.(entry.bitmap);
    }
}
export function buildTimelineRenderFrameKey(input) {
    const frame = Math.max(0, Math.round(input.frame));
    const fps = normalizePositiveInteger(input.fps, 30);
    const width = normalizePositiveInteger(input.width, 1280);
    const height = normalizePositiveInteger(input.height, 720);
    const signature = buildTimelineRenderSignature(input.timeline, input.media, input.sequences, input.activeSequenceId);
    const colorPipeline = normalizeProjectColorPipeline(input.colorPipeline);
    return `timeline-render:${hashString(`${signature}|colorPipeline=${colorPipeline}`)}:${width}x${height}:${fps}:${frame}`;
}
export function buildTimelineRenderFrameRequests(input) {
    const fps = normalizePositiveInteger(input.fps, 30);
    const duration = Math.max(0, input.duration);
    const before = Math.max(0, input.beforeSeconds ?? TIMELINE_RENDER_CACHE_PRERENDER_SECONDS);
    const after = Math.max(0, input.afterSeconds ?? TIMELINE_RENDER_CACHE_PRERENDER_SECONDS);
    const maxFrame = Math.ceil(duration * fps);
    const rawStartFrame = Math.max(0, Math.floor((input.playheadTime - before) * fps));
    const endFrame = Math.min(Math.max(rawStartFrame, Math.ceil((input.playheadTime + after) * fps)), maxFrame);
    const startFrame = Math.min(rawStartFrame, endFrame);
    const requests = [];
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
export function getTimelineRenderInvalidationRanges(previous, next) {
    const previousClips = flattenTimelineClips(previous);
    const nextClips = flattenTimelineClips(next);
    const ids = new Set([...previousClips.keys(), ...nextClips.keys()]);
    const ranges = [];
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
export function mergeTimelineRenderRanges(ranges) {
    const sorted = ranges
        .map((range) => ({
        start: round(Math.max(0, Math.min(range.start, range.end))),
        end: round(Math.max(0, Math.max(range.start, range.end))),
    }))
        .filter((range) => range.end > range.start)
        .sort((left, right) => left.start - right.start || left.end - right.end);
    const merged = [];
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
function buildTimelineRenderSignature(timeline, media, sequences = [], activeSequenceId) {
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
function normalizeTimelineForSignature(timeline) {
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
function buildClipRenderSignature(clip) {
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
function flattenTimelineClips(timeline) {
    return new Map(timeline.tracks.flatMap((track) => track.clips.map((clip) => [clip.id, clip])));
}
function getTimelineEnd(timeline) {
    return timeline.tracks.reduce((duration, track) => Math.max(duration, ...track.clips.map((clip) => clip.start + clip.duration), 0), 0);
}
function normalizePositiveInteger(value, fallback) {
    return Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;
}
function stableStringify(value) {
    if (value === null || typeof value !== 'object') {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        return `[${value.map((item) => stableStringify(item)).join(',')}]`;
    }
    const record = value;
    return `{${Object.keys(record)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
        .join(',')}}`;
}
function hashString(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
}
//# sourceMappingURL=render-cache.js.map
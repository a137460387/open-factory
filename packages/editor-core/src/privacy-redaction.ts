import { createId, type ClipPrivacyRedaction, type PrivacyRedactionType, type RedactionKeyframe } from './model';
import { round } from './time';

export interface PrivacyDetectionRegion {
  type: PrivacyRedactionType;
  box: { x: number; y: number; w: number; h: number };
}

export interface PrivacyDetectionFrame {
  time: number;
  regions: PrivacyDetectionRegion[];
}

export interface PrivacyDetectionResponse {
  frames: PrivacyDetectionFrame[];
}

export interface MatchedRegion {
  type: PrivacyRedactionType;
  trackId: number;
  frames: Array<{ time: number; x: number; y: number; w: number; h: number }>;
}

const IOU_THRESHOLD = 0.3;
const SMOOTHING_WINDOW = 3;

export function computeIOU(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): number {
  const ax1 = a.x;
  const ay1 = a.y;
  const ax2 = a.x + a.w;
  const ay2 = a.y + a.h;
  const bx1 = b.x;
  const by1 = b.y;
  const bx2 = b.x + b.w;
  const by2 = b.y + b.h;
  const ix1 = Math.max(ax1, bx1);
  const iy1 = Math.max(ay1, by1);
  const ix2 = Math.min(ax2, bx2);
  const iy2 = Math.min(ay2, by2);
  if (ix2 <= ix1 || iy2 <= iy1) return 0;
  const interArea = (ix2 - ix1) * (iy2 - iy1);
  const aArea = a.w * a.h;
  const bArea = b.w * b.h;
  const unionArea = aArea + bArea - interArea;
  return unionArea > 0 ? interArea / unionArea : 0;
}

export function matchRegionsAcrossFrames(frames: PrivacyDetectionFrame[]): MatchedRegion[] {
  const sorted = [...frames].filter((f) => Number.isFinite(f.time) && f.time >= 0).sort((a, b) => a.time - b.time);
  if (sorted.length === 0) return [];

  let nextTrackId = 0;
  const tracks: MatchedRegion[] = [];

  for (const frame of sorted) {
    const matchedIndices = new Set<number>();
    for (const track of tracks) {
      const lastFrame = track.frames[track.frames.length - 1];
      let bestIdx = -1;
      let bestIou = IOU_THRESHOLD;
      for (let i = 0; i < frame.regions.length; i++) {
        if (matchedIndices.has(i)) continue;
        const region = frame.regions[i];
        if (region.type !== track.type) continue;
        const iou = computeIOU(lastFrame, region.box);
        if (iou > bestIou) {
          bestIou = iou;
          bestIdx = i;
        }
      }
      if (bestIdx >= 0) {
        const region = frame.regions[bestIdx];
        track.frames.push({ time: frame.time, ...region.box });
        matchedIndices.add(bestIdx);
      }
    }
    for (let i = 0; i < frame.regions.length; i++) {
      if (matchedIndices.has(i)) continue;
      const region = frame.regions[i];
      tracks.push({
        type: region.type,
        trackId: nextTrackId++,
        frames: [{ time: frame.time, ...region.box }],
      });
    }
  }
  return tracks;
}

export function smoothRedactionKeyframes(
  keyframes: RedactionKeyframe[],
  windowSize = SMOOTHING_WINDOW,
): RedactionKeyframe[] {
  if (keyframes.length <= 1) return keyframes.map((k) => ({ ...k }));
  const sorted = [...keyframes].sort((a, b) => a.time - b.time);
  const half = Math.floor(windowSize / 2);
  return sorted.map((kf, i) => {
    const start = Math.max(0, i - half);
    const end = Math.min(sorted.length, i + half + 1);
    const window = sorted.slice(start, end);
    const avgX = window.reduce((s, k) => s + k.x, 0) / window.length;
    const avgY = window.reduce((s, k) => s + k.y, 0) / window.length;
    const avgW = window.reduce((s, k) => s + k.w, 0) / window.length;
    const avgH = window.reduce((s, k) => s + k.h, 0) / window.length;
    return { time: kf.time, x: round(avgX), y: round(avgY), w: round(avgW), h: round(avgH) };
  });
}

export function buildRedactionsFromDetection(
  response: PrivacyDetectionResponse,
  idPrefix?: string,
): ClipPrivacyRedaction[] {
  const matched = matchRegionsAcrossFrames(response.frames);
  return matched.map((track) => {
    const smoothed = smoothRedactionKeyframes(
      track.frames.map((f) => ({ time: f.time, x: f.x, y: f.y, w: f.w, h: f.h })),
    );
    return {
      id: createId(idPrefix ?? 'redaction'),
      type: track.type,
      keyframes: smoothed,
      blurStrength: 1,
      enabled: true,
    };
  });
}

export function parsePrivacyDetectionResponse(json: unknown): PrivacyDetectionResponse {
  if (!json || typeof json !== 'object') return { frames: [] };
  const input = json as Record<string, unknown>;
  if (!Array.isArray(input.frames)) return { frames: [] };
  const frames: PrivacyDetectionFrame[] = [];
  for (const item of input.frames) {
    if (!item || typeof item !== 'object') continue;
    const entry = item as Record<string, unknown>;
    if (typeof entry.time !== 'number' || !Number.isFinite(entry.time)) continue;
    if (!Array.isArray(entry.regions)) continue;
    const regions: PrivacyDetectionRegion[] = [];
    for (const r of entry.regions) {
      if (!r || typeof r !== 'object') continue;
      const reg = r as Record<string, unknown>;
      const type = reg.type;
      if (type !== 'face' && type !== 'license_plate' && type !== 'screen') continue;
      const box = reg.box as Record<string, unknown> | undefined;
      if (
        !box ||
        typeof box.x !== 'number' ||
        typeof box.y !== 'number' ||
        typeof box.w !== 'number' ||
        typeof box.h !== 'number'
      )
        continue;
      regions.push({ type, box: { x: box.x, y: box.y, w: box.w, h: box.h } });
    }
    frames.push({ time: entry.time, regions });
  }
  return { frames };
}

export function buildPrivacyRedactionFFmpegExpressions(
  redactions: ClipPrivacyRedaction[],
  videoWidth: number,
  videoHeight: number,
  filterType: 'delogo' | 'boxblur' = 'boxblur',
): string[] {
  const enabled = redactions.filter((r) => r.enabled && r.keyframes.length > 0);
  if (enabled.length === 0) return [];

  const filters: string[] = [];
  for (const redaction of enabled) {
    const kfs = [...redaction.keyframes].sort((a, b) => a.time - b.time);
    for (let i = 0; i < kfs.length; i++) {
      const kf = kfs[i];
      const nextTime = i < kfs.length - 1 ? kfs[i + 1].time : kf.time + 2;
      const px = Math.round(kf.x * videoWidth);
      const py = Math.round(kf.y * videoHeight);
      const pw = Math.max(2, Math.round(kf.w * videoWidth));
      const ph = Math.max(2, Math.round(kf.h * videoHeight));
      if (filterType === 'delogo') {
        filters.push(
          `delogo=x=${px}:y=${py}:w=${pw}:h=${ph}:enable='between(t,${kf.time.toFixed(3)},${nextTime.toFixed(3)})'`,
        );
      } else {
        const bx = Math.max(0, px - 2);
        const by = Math.max(0, py - 2);
        const bw = Math.min(videoWidth - bx, pw + 4);
        const bh = Math.min(videoHeight - by, ph + 4);
        filters.push(
          `boxblur=${Math.round(redaction.blurStrength * 10)}:enable='between(t,${kf.time.toFixed(3)},${nextTime.toFixed(3)})':x=${bx}:y=${by}:w=${bw}:h=${bh}`,
        );
      }
    }
  }
  return filters;
}

export function normalizePrivacyRedaction(input: Partial<ClipPrivacyRedaction>): ClipPrivacyRedaction {
  return {
    id: typeof input.id === 'string' && input.id ? input.id : createId('redaction'),
    type: input.type === 'face' || input.type === 'license_plate' || input.type === 'screen' ? input.type : 'face',
    keyframes: normalizeRedactionKeyframes(input.keyframes),
    blurStrength:
      typeof input.blurStrength === 'number' && Number.isFinite(input.blurStrength)
        ? Math.min(1, Math.max(0, input.blurStrength))
        : 1,
    enabled: input.enabled !== false,
  };
}

export function normalizeRedactionKeyframes(kfs: unknown): RedactionKeyframe[] {
  if (!Array.isArray(kfs)) return [];
  return kfs
    .filter((k): k is Partial<RedactionKeyframe> => k != null && typeof k === 'object')
    .filter((k) => typeof k.time === 'number' && Number.isFinite(k.time))
    .map((k) => ({
      time: round(Math.max(0, k.time!)),
      x: round(Math.min(1, Math.max(0, typeof k.x === 'number' ? k.x : 0))),
      y: round(Math.min(1, Math.max(0, typeof k.y === 'number' ? k.y : 0))),
      w: round(Math.min(1, Math.max(0.001, typeof k.w === 'number' ? k.w : 0.1))),
      h: round(Math.min(1, Math.max(0.001, typeof k.h === 'number' ? k.h : 0.1))),
    }))
    .sort((a, b) => a.time - b.time);
}

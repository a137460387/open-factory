import { round } from './time';

export type SnapEdge = 'start' | 'end';

export type SnapCandidateKind = 'timeline-start' | 'playhead' | 'marker' | 'beat' | 'clip-start' | 'clip-end' | 'grid';

/**
 * Snap candidate priority hierarchy (higher = preferred when distances match):
 *   beat (5) > marker (4) > grid (3) > playhead/timeline-start (2) > clip-start/clip-end (1) > unknown (0)
 */
const SNAP_CANDIDATE_PRIORITY: Record<SnapCandidateKind, number> = {
  beat: 5,
  marker: 4,
  grid: 3,
  playhead: 2,
  'timeline-start': 2,
  'clip-start': 1,
  'clip-end': 1,
};

export interface TimelineSnapCandidate {
  time: number;
  kind?: SnapCandidateKind;
  clipId?: string;
}

export interface TimelineSnapInput {
  clipStart: number;
  clipDuration: number;
  candidates: Array<number | TimelineSnapCandidate>;
  pixelsPerSecond: number;
  thresholdPx?: number;
  edges?: SnapEdge[];
  disabled?: boolean;
}

export interface TimelineSnapTarget {
  edge: SnapEdge;
  candidate: TimelineSnapCandidate;
  snappedStart: number;
  delta: number;
  distancePx: number;
}

const DEFAULT_SNAP_THRESHOLD_PX = 8;
const EPSILON_PX = 0.000001;

export function findTimelineSnapTarget(input: TimelineSnapInput): TimelineSnapTarget | null {
  if (input.disabled || input.pixelsPerSecond <= 0 || input.clipDuration <= 0) {
    return null;
  }

  const threshold = Math.max(0, input.thresholdPx ?? DEFAULT_SNAP_THRESHOLD_PX);
  const edges = input.edges ?? ['start', 'end'];
  let best: TimelineSnapTarget | null = null;

  for (const edge of edges) {
    const edgeTime = edge === 'start' ? input.clipStart : input.clipStart + input.clipDuration;
    for (const candidate of input.candidates.map(normalizeCandidate)) {
      if (candidate.time < 0 || !Number.isFinite(candidate.time)) {
        continue;
      }
      const delta = candidate.time - edgeTime;
      const distancePx = Math.abs(delta * input.pixelsPerSecond);
      if (distancePx > threshold + EPSILON_PX) {
        continue;
      }
      const snappedStart = edge === 'start' ? input.clipStart + delta : input.clipStart + delta;
      const target = {
        edge,
        candidate,
        snappedStart: round(Math.max(0, snappedStart)),
        delta: round(delta),
        distancePx
      };
      if (!best || target.distancePx < best.distancePx - EPSILON_PX || (Math.abs(target.distancePx - best.distancePx) <= EPSILON_PX && snapCandidatePriority(target.candidate) > snapCandidatePriority(best.candidate))) {
        best = target;
      }
    }
  }

  return best;
}

function normalizeCandidate(candidate: number | TimelineSnapCandidate): TimelineSnapCandidate {
  return typeof candidate === 'number' ? { time: candidate } : candidate;
}

export function snapCandidatePriority(candidate: TimelineSnapCandidate): number {
  if (!candidate.kind) return 0;
  return SNAP_CANDIDATE_PRIORITY[candidate.kind] ?? 0;
}

/** Human-readable label for snap candidate kind (zh-CN). */
export function snapCandidateKindLabel(kind: SnapCandidateKind | undefined): string {
  switch (kind) {
    case 'beat': return '节拍';
    case 'marker': return '标记点';
    case 'grid': return '网格';
    case 'playhead': return '播放头';
    case 'timeline-start': return '时间线起点';
    case 'clip-start': return 'clip起点';
    case 'clip-end': return 'clip终点';
    default: return '吸附';
  }
}

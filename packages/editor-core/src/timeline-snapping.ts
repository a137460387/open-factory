import { round } from './time';

export type SnapEdge = 'start' | 'end';

export type SnapCandidateKind = 'timeline-start' | 'playhead' | 'marker' | 'clip-start' | 'clip-end';

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
      if (!best || target.distancePx < best.distancePx) {
        best = target;
      }
    }
  }

  return best;
}

function normalizeCandidate(candidate: number | TimelineSnapCandidate): TimelineSnapCandidate {
  return typeof candidate === 'number' ? { time: candidate } : candidate;
}

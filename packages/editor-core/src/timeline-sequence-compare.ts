import type { Clip, Sequence, TimelineMarker } from './model-types';
import { createId } from './model';
import { round } from './time';

export interface SequenceCompareLayout {
  leftSequenceId: string;
  rightSequenceId: string;
  splitRatio: number;
  syncMarkersEnabled: boolean;
}

export interface SyncMarkerPair {
  leftMarkerId: string;
  rightMarkerId: string;
  label: string;
  leftTime: number;
  rightTime: number;
}

export interface CrossSequenceDragPlan {
  addClip: Clip;
  removeClipId: string;
  sourceTrackId: string;
  targetTrackId: string;
}

const DEFAULT_LAYOUT: SequenceCompareLayout = {
  leftSequenceId: '',
  rightSequenceId: '',
  splitRatio: 0.5,
  syncMarkersEnabled: false,
};

const LAYOUT_STORAGE_KEY = 'open-factory:sequence-compare-layout';

export function createSequenceCompareLayout(
  leftSequenceId: string,
  rightSequenceId: string,
  overrides?: Partial<SequenceCompareLayout>,
): SequenceCompareLayout {
  return {
    ...DEFAULT_LAYOUT,
    leftSequenceId,
    rightSequenceId,
    ...overrides,
  };
}

export function normalizeSplitRatio(ratio: unknown): number {
  if (typeof ratio !== 'number' || !Number.isFinite(ratio)) {
    return DEFAULT_LAYOUT.splitRatio;
  }
  return round(Math.min(0.8, Math.max(0.2, ratio)));
}

export function findSyncMarkerPairs(
  leftMarkers: TimelineMarker[],
  rightMarkers: TimelineMarker[],
): SyncMarkerPair[] {
  const pairs: SyncMarkerPair[] = [];
  const rightByName = new Map<string, TimelineMarker[]>();
  for (const marker of rightMarkers) {
    const key = marker.label.trim().toLowerCase();
    if (!key) continue;
    const list = rightByName.get(key) ?? [];
    list.push(marker);
    rightByName.set(key, list);
  }
  const usedRight = new Set<string>();
  for (const leftMarker of leftMarkers) {
    const key = leftMarker.label.trim().toLowerCase();
    if (!key) continue;
    const candidates = rightByName.get(key);
    if (!candidates) continue;
    for (const rightMarker of candidates) {
      if (usedRight.has(rightMarker.id)) continue;
      pairs.push({
        leftMarkerId: leftMarker.id,
        rightMarkerId: rightMarker.id,
        label: leftMarker.label,
        leftTime: leftMarker.time,
        rightTime: rightMarker.time,
      });
      usedRight.add(rightMarker.id);
      break;
    }
  }
  return pairs.sort((a, b) => a.leftTime - b.leftTime || a.label.localeCompare(b.label));
}

export function buildCrossSequenceDragPlan(
  sourceClip: Clip,
  sourceTrackId: string,
  targetTrackId: string,
  insertTime: number,
  targetTimelineDuration: number,
): CrossSequenceDragPlan {
  const newClipId = createId('clip');
  const newClip: Clip = {
    ...structuredCloneCompat(sourceClip),
    id: newClipId,
    trackId: targetTrackId,
    start: round(Math.max(0, Math.min(insertTime, targetTimelineDuration))),
  };

  return { addClip: newClip, removeClipId: sourceClip.id, sourceTrackId, targetTrackId };
}

export function serializeSequenceCompareLayout(layout: SequenceCompareLayout): string {
  return JSON.stringify(layout);
}

export function deserializeSequenceCompareLayout(raw: string | null): SequenceCompareLayout | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return undefined;
    if (typeof parsed.leftSequenceId !== 'string' || typeof parsed.rightSequenceId !== 'string') return undefined;
    return createSequenceCompareLayout(parsed.leftSequenceId, parsed.rightSequenceId, {
      splitRatio: normalizeSplitRatio(parsed.splitRatio),
      syncMarkersEnabled: parsed.syncMarkersEnabled === true,
    });
  } catch {
    return undefined;
  }
}

export function saveSequenceCompareLayout(layout: SequenceCompareLayout): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LAYOUT_STORAGE_KEY, serializeSequenceCompareLayout(layout));
  } catch {
    // storage quota exceeded, silently ignore
  }
}

export function loadSequenceCompareLayout(): SequenceCompareLayout | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return deserializeSequenceCompareLayout(window.localStorage.getItem(LAYOUT_STORAGE_KEY));
  } catch {
    return undefined;
  }
}

export function areSequencesIndependent(seqA: Sequence, seqB: Sequence): boolean {
  if (seqA.id === seqB.id) return false;
  const clipsA = new Set(seqA.timeline.tracks.flatMap((t) => t.clips.map((c) => c.id)));
  for (const track of seqB.timeline.tracks) {
    for (const clip of track.clips) {
      if (clipsA.has(clip.id)) return false;
    }
  }
  return true;
}

export function collectTimelineMarkers(timeline: { markers?: TimelineMarker[] }): TimelineMarker[] {
  return timeline.markers ?? [];
}

function structuredCloneCompat<T>(value: T): T {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

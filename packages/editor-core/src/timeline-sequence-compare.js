import { createId } from './model';
import { round } from './time';
const DEFAULT_LAYOUT = {
    leftSequenceId: '',
    rightSequenceId: '',
    splitRatio: 0.5,
    syncMarkersEnabled: false,
};
const LAYOUT_STORAGE_KEY = 'open-factory:sequence-compare-layout';
export function createSequenceCompareLayout(leftSequenceId, rightSequenceId, overrides) {
    return {
        ...DEFAULT_LAYOUT,
        leftSequenceId,
        rightSequenceId,
        ...overrides,
    };
}
export function normalizeSplitRatio(ratio) {
    if (typeof ratio !== 'number' || !Number.isFinite(ratio)) {
        return DEFAULT_LAYOUT.splitRatio;
    }
    return round(Math.min(0.8, Math.max(0.2, ratio)));
}
export function findSyncMarkerPairs(leftMarkers, rightMarkers) {
    const pairs = [];
    const rightByName = new Map();
    for (const marker of rightMarkers) {
        const key = marker.label.trim().toLowerCase();
        if (!key)
            continue;
        const list = rightByName.get(key) ?? [];
        list.push(marker);
        rightByName.set(key, list);
    }
    const usedRight = new Set();
    for (const leftMarker of leftMarkers) {
        const key = leftMarker.label.trim().toLowerCase();
        if (!key)
            continue;
        const candidates = rightByName.get(key);
        if (!candidates)
            continue;
        for (const rightMarker of candidates) {
            if (usedRight.has(rightMarker.id))
                continue;
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
export function buildCrossSequenceDragPlan(sourceClip, sourceTrackId, targetTrackId, insertTime, targetTimelineDuration) {
    const newClipId = createId('clip');
    const newClip = {
        ...structuredCloneCompat(sourceClip),
        id: newClipId,
        trackId: targetTrackId,
        start: round(Math.max(0, Math.min(insertTime, targetTimelineDuration))),
    };
    return { addClip: newClip, removeClipId: sourceClip.id, sourceTrackId, targetTrackId };
}
export function serializeSequenceCompareLayout(layout) {
    return JSON.stringify(layout);
}
export function deserializeSequenceCompareLayout(raw) {
    if (!raw)
        return undefined;
    try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object')
            return undefined;
        if (typeof parsed.leftSequenceId !== 'string' || typeof parsed.rightSequenceId !== 'string')
            return undefined;
        return createSequenceCompareLayout(parsed.leftSequenceId, parsed.rightSequenceId, {
            splitRatio: normalizeSplitRatio(parsed.splitRatio),
            syncMarkersEnabled: parsed.syncMarkersEnabled === true,
        });
    }
    catch {
        return undefined;
    }
}
export function saveSequenceCompareLayout(layout) {
    if (typeof window === 'undefined')
        return;
    try {
        window.localStorage.setItem(LAYOUT_STORAGE_KEY, serializeSequenceCompareLayout(layout));
    }
    catch {
        // storage quota exceeded, silently ignore
    }
}
export function loadSequenceCompareLayout() {
    if (typeof window === 'undefined')
        return undefined;
    try {
        return deserializeSequenceCompareLayout(window.localStorage.getItem(LAYOUT_STORAGE_KEY));
    }
    catch {
        return undefined;
    }
}
export function areSequencesIndependent(seqA, seqB) {
    if (seqA.id === seqB.id)
        return false;
    const clipsA = new Set(seqA.timeline.tracks.flatMap((t) => t.clips.map((c) => c.id)));
    for (const track of seqB.timeline.tracks) {
        for (const clip of track.clips) {
            if (clipsA.has(clip.id))
                return false;
        }
    }
    return true;
}
export function collectTimelineMarkers(timeline) {
    return timeline.markers ?? [];
}
function structuredCloneCompat(value) {
    if (typeof globalThis.structuredClone === 'function') {
        return globalThis.structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
}
//# sourceMappingURL=timeline-sequence-compare.js.map
import type { Clip, Sequence, TimelineMarker } from './model-types';
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
export declare function createSequenceCompareLayout(leftSequenceId: string, rightSequenceId: string, overrides?: Partial<SequenceCompareLayout>): SequenceCompareLayout;
export declare function normalizeSplitRatio(ratio: unknown): number;
export declare function findSyncMarkerPairs(leftMarkers: TimelineMarker[], rightMarkers: TimelineMarker[]): SyncMarkerPair[];
export declare function buildCrossSequenceDragPlan(sourceClip: Clip, sourceTrackId: string, targetTrackId: string, insertTime: number, targetTimelineDuration: number): CrossSequenceDragPlan;
export declare function serializeSequenceCompareLayout(layout: SequenceCompareLayout): string;
export declare function deserializeSequenceCompareLayout(raw: string | null): SequenceCompareLayout | undefined;
export declare function saveSequenceCompareLayout(layout: SequenceCompareLayout): void;
export declare function loadSequenceCompareLayout(): SequenceCompareLayout | undefined;
export declare function areSequencesIndependent(seqA: Sequence, seqB: Sequence): boolean;
export declare function collectTimelineMarkers(timeline: {
    markers?: TimelineMarker[];
}): TimelineMarker[];
//# sourceMappingURL=timeline-sequence-compare.d.ts.map
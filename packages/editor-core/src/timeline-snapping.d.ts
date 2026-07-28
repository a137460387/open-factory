export type SnapEdge = 'start' | 'end';
export type SnapCandidateKind = 'timeline-start' | 'playhead' | 'marker' | 'beat' | 'clip-start' | 'clip-end' | 'grid';
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
export declare function findTimelineSnapTarget(input: TimelineSnapInput): TimelineSnapTarget | null;
export declare function snapCandidatePriority(candidate: TimelineSnapCandidate): number;
/** Human-readable label for snap candidate kind (zh-CN). */
export declare function snapCandidateKindLabel(kind: SnapCandidateKind | undefined): string;
//# sourceMappingURL=timeline-snapping.d.ts.map
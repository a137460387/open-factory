import { type MediaAsset, type Project, type Sequence, type TrackType } from '../model';
export type EdlTransitionType = 'cut' | 'dissolve' | 'unknown';
export type EdlMediaMatchKind = 'exact' | 'fuzzy' | 'missing';
export interface Cmx3600EdlEvent {
    id: string;
    editNumber: string;
    reel: string;
    trackType: Extract<TrackType, 'video' | 'audio'>;
    transition: EdlTransitionType;
    rawTransition: string;
    transitionDurationFrames?: number;
    sourceStart: number;
    sourceEnd: number;
    recordStart: number;
    recordEnd: number;
    clipName?: string;
    sourceFile?: string;
    comments: string[];
}
export interface Cmx3600EdlParseResult {
    title?: string;
    events: Cmx3600EdlEvent[];
}
export interface EdlMediaMatch {
    event: Cmx3600EdlEvent;
    asset?: MediaAsset;
    kind: EdlMediaMatchKind;
    score: number;
}
export interface Cmx3600EdlImportOptions {
    fps?: number;
    sequenceName?: string;
}
export interface Cmx3600EdlImportResult {
    title: string;
    sequence: Sequence;
    media: MediaAsset[];
    matches: EdlMediaMatch[];
    matchedCount: number;
    missingCount: number;
}
export declare function parseCmx3600Edl(contents: string, fps?: number): Cmx3600EdlParseResult;
export declare function matchEdlEventsToMedia(events: Cmx3600EdlEvent[], media: MediaAsset[]): EdlMediaMatch[];
export declare function buildCmx3600EdlImport(project: Project, contents: string, options?: Cmx3600EdlImportOptions): Cmx3600EdlImportResult;
export declare function applyCmx3600EdlImport(project: Project, result: Cmx3600EdlImportResult): Project;
//# sourceMappingURL=timeline-import.d.ts.map
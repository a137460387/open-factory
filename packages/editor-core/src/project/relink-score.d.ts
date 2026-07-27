import type { MediaAsset } from '../model';
export interface RelinkCandidate {
    path: string;
    name?: string;
    size?: number;
    duration?: number;
    width?: number;
    height?: number;
}
export interface RelinkScore {
    score: number;
    reasons: string[];
}
export declare function scoreRelinkCandidate(asset: MediaAsset, candidate: RelinkCandidate): RelinkScore;
export declare function sortRelinkCandidates(asset: MediaAsset, candidates: RelinkCandidate[]): Array<RelinkCandidate & RelinkScore>;
//# sourceMappingURL=relink-score.d.ts.map
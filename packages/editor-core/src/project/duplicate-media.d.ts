import type { MediaFingerprint } from '../model-types';
export interface MediaContentSignature {
    assetId: string;
    name: string;
    path: string;
    size: number;
    headHash: string;
    fingerprint?: MediaFingerprint;
}
export interface DuplicateMediaCandidate {
    assetId: string;
    name: string;
    path: string;
}
export interface DuplicateMediaGroup {
    id: string;
    size: number;
    headHash: string;
    fingerprintHash?: string;
    keepAssetId: string;
    assets: DuplicateMediaCandidate[];
}
export declare function detectDuplicateMediaGroups(signatures: MediaContentSignature[]): DuplicateMediaGroup[];
//# sourceMappingURL=duplicate-media.d.ts.map
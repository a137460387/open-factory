import type { MediaAsset, MediaFingerprint, MediaMetadata, Project } from './model-types';
export interface LumaImageSample {
    width: number;
    height: number;
    data: ArrayLike<number>;
}
export interface MediaFingerprintReference {
    assetId: string;
    name: string;
    path: string;
    fingerprint?: MediaFingerprint;
    source?: 'project' | 'shared-library';
}
export interface FingerprintDuplicateMatch {
    assetId: string;
    path: string;
    matches: MediaFingerprintReference[];
}
export declare function calculatePerceptualHash(sample: LumaImageSample, hashSize?: number): string;
export declare function calculateFingerprintDistance(left: MediaFingerprint | undefined, right: MediaFingerprint | undefined): number;
export declare function areMediaFingerprintsEquivalent(left: MediaFingerprint | undefined, right: MediaFingerprint | undefined): boolean;
export declare function createVideoFingerprint(frameHashes: string[]): MediaFingerprint;
export declare function createAudioRmsFingerprint(rmsVector: number[]): MediaFingerprint;
export declare function collectFingerprintReferences(media: MediaAsset[], mediaMetadata: Record<string, MediaMetadata>, source?: MediaFingerprintReference['source']): MediaFingerprintReference[];
export declare function detectCrossProjectFingerprintMatches(current: MediaFingerprintReference[], shared: MediaFingerprintReference[]): FingerprintDuplicateMatch[];
export declare function listFingerprintSourcePaths(target: MediaFingerprint | undefined, references: MediaFingerprintReference[]): string[];
export declare function findProjectFingerprintSourcePaths(project: Project, assetId: string, sharedReferences?: MediaFingerprintReference[]): string[];
//# sourceMappingURL=media-fingerprint.d.ts.map
import type { MediaAsset, Project } from './model-types';
export interface SmartDuplicateCandidate {
    asset: MediaAsset;
    size: number;
    duration: number;
    frameHashes: string[];
    createdAt?: string;
}
export interface SmartDuplicateAsset {
    assetId: string;
    name: string;
    path: string;
    size: number;
    duration: number;
    width?: number;
    height?: number;
    resolutionScore: number;
    codec?: string;
    createdAt?: string;
    similarity: number;
}
export interface SmartDuplicateGroup {
    id: string;
    keepAssetId: string;
    assets: SmartDuplicateAsset[];
    similarity: number;
}
export interface RenameTemplateContext {
    date?: string | Date;
    width?: number;
    height?: number;
    codec?: string;
    index?: number;
    name?: string;
}
export interface MediaCleanupReport {
    orphaned: MediaAsset[];
    unused: MediaAsset[];
}
export interface ArchiveRelinkEntry {
    assetId: string;
    newPath: string;
}
export declare function calculatePhashSimilarity(left: string, right: string): number;
export declare function calculateMultiFramePhashSimilarity(left: string[], right: string[]): number;
export declare function detectSmartDuplicateGroups(candidates: SmartDuplicateCandidate[], threshold?: number): SmartDuplicateGroup[];
export declare function expandRenameTemplate(template: string, context: RenameTemplateContext): string;
export declare function detectMediaCleanupCandidates(project: Project, existsByPath: Record<string, boolean>): MediaCleanupReport;
export declare function applyArchiveRelinkPlan(project: Project, entries: ArchiveRelinkEntry[]): Project;
export declare function collectUsedMediaIds(project: Project): Set<string>;
//# sourceMappingURL=media-organizer.d.ts.map
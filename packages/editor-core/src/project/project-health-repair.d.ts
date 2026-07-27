import type { MediaAsset, Project } from '../model';
import type { DuplicateMediaIssue, ProjectHealthReport } from './project-health-check';
export type ProjectHealthSearchRootKind = 'original' | 'sibling' | 'recent';
export type ProjectHealthRepairEntryStatus = 'success' | 'skipped' | 'manual';
export type ProjectHealthRepairEntryType = 'missing-media' | 'duplicate-media' | 'orphan-media' | 'proxy-missing' | 'frame-rate-proxy';
export interface ProjectHealthSearchRoot {
    path: string;
    kind: ProjectHealthSearchRootKind;
    priority: number;
}
export interface PlannedMissingMediaRelink {
    assetId: string;
    candidatePath: string;
    score: number;
    rootKind: ProjectHealthSearchRootKind;
}
export interface ProjectHealthAutoRepairInput {
    relinkedAssets?: Array<{
        assetId: string;
        asset: MediaAsset;
    }>;
    duplicateIssues?: DuplicateMediaIssue[];
    orphanAssetIds?: string[];
    proxyAssetIds?: string[];
    frameRateProxyAssetIds?: string[];
    manualEntries?: Array<Omit<ProjectHealthRepairEntry, 'status'> & {
        status?: ProjectHealthRepairEntryStatus;
    }>;
    unusedFolderName?: string;
}
export interface ProjectHealthRepairEntry {
    type: ProjectHealthRepairEntryType;
    status: ProjectHealthRepairEntryStatus;
    assetId?: string;
    message: string;
}
export interface ProjectHealthRepairReport {
    successCount: number;
    skippedCount: number;
    manualCount: number;
    entries: ProjectHealthRepairEntry[];
}
export interface ProjectHealthAutoRepairResult {
    project: Project;
    report: ProjectHealthRepairReport;
}
export declare function buildProjectHealthSearchRoots(project: Project, recentDirectories?: string[]): ProjectHealthSearchRoot[];
export declare function planMissingMediaAutoRelinks(project: Project, report: ProjectHealthReport, candidatePaths: string[], roots: ProjectHealthSearchRoot[], minScore?: number): {
    replacements: PlannedMissingMediaRelink[];
    manualEntries: ProjectHealthRepairEntry[];
};
export declare function applyProjectHealthAutoRepair(project: Project, input: ProjectHealthAutoRepairInput, now?: string): ProjectHealthAutoRepairResult;
export declare function summarizeProjectHealthRepair(entries: ProjectHealthRepairEntry[]): ProjectHealthRepairReport;
//# sourceMappingURL=project-health-repair.d.ts.map
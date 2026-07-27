import { type TimelineVersionDiff } from '../timeline-compare';
import { type Project } from '../model';
import type { PostExportQualityAssuranceResult } from '../export/post-export-quality';
import type { ExportPublishNodeLog } from '../export/publish-types';
export declare const DEFAULT_PROJECT_RELEASE_VERSION = "0.1.0";
export declare const DEFAULT_SUBTITLE_RELEASE_MAX_CHARS = 80;
export type ReleaseChecklistItemId = 'qualityGate' | 'mediaRelink' | 'subtitleProof' | 'exportPreset';
export type ReleaseChecklistStatus = 'pass' | 'blocking' | 'skipped';
export interface ReleaseChecklistOptions {
    qualityGate: boolean;
    mediaRelink: boolean;
    subtitleProof: boolean;
    exportPreset: boolean;
}
export interface ReleaseChecklistContext {
    qualityAssurance?: Pick<PostExportQualityAssuranceResult, 'status'>;
    qualityBlockingIssueCount?: number;
    exportPresetId?: string;
    exportPresetName?: string;
    subtitleMaxChars?: number;
}
export interface ReleaseChecklistItemResult {
    id: ReleaseChecklistItemId;
    status: ReleaseChecklistStatus;
    message: string;
    details: string[];
}
export interface ReleaseChecklistResult {
    items: ReleaseChecklistItemResult[];
    canRelease: boolean;
    blockingCount: number;
}
export interface ProjectReleaseRecord {
    schemaVersion: 1;
    id: string;
    projectId: string;
    projectName: string;
    version: string;
    releasedAt: string;
    checklist: ReleaseChecklistItemResult[];
    exportPath: string;
    duration: number;
    assignee: string;
    changelog: string;
    snapshotPath: string;
    exportPresetId?: string;
    exportPresetName?: string;
    publishLogs?: ExportPublishNodeLog[];
}
export interface BuildReleaseRecordInput {
    project: Project;
    version: string;
    releasedAt?: string;
    checklist: ReleaseChecklistResult;
    exportPath: string;
    assignee?: string;
    changelog?: string;
    snapshotPath: string;
    exportPresetId?: string;
    exportPresetName?: string;
}
export interface ReleaseComparisonRequest {
    baseVersion: string;
    targetVersion: string;
    baseSnapshotPath: string;
    targetSnapshotPath: string;
}
export interface ReleaseVersionDiff {
    baseVersion: string;
    targetVersion: string;
    diff: TimelineVersionDiff;
}
export declare const DEFAULT_RELEASE_CHECKLIST_OPTIONS: ReleaseChecklistOptions;
export declare function normalizeProjectReleaseVersion(value: unknown, fallback?: string): string;
export declare function incrementSemverPatch(value: unknown): string;
export declare function buildSemver(major: unknown, minor: unknown, patch: unknown): string;
export declare function runReleaseChecklist(project: Project, options?: Partial<ReleaseChecklistOptions>, context?: ReleaseChecklistContext): ReleaseChecklistResult;
export declare function buildProjectReleaseRecord(input: BuildReleaseRecordInput): ProjectReleaseRecord;
export declare function createReleaseRecordFileName(version: string, releasedAt?: string): string;
export declare function buildReleaseComparisonRequest(base: ProjectReleaseRecord, target: ProjectReleaseRecord): ReleaseComparisonRequest;
export declare function diffReleaseSnapshots(baseRecord: ProjectReleaseRecord, targetRecord: ProjectReleaseRecord, baseProject: Project, targetProject: Project): ReleaseVersionDiff;
//# sourceMappingURL=release-workflow.d.ts.map
import type { MediaAsset, Project } from '../model';
export type ConformMediaMatchStrategy = 'filename' | 'timecode' | 'manual';
export type ConformMediaWarningReason = 'duration-mismatch' | 'frame-rate-mismatch' | 'resolution-mismatch';
export type ConformMediaFailureReason = 'not-found' | 'duplicate-candidates' | 'duration-mismatch';
export interface ConformMediaCandidate {
    path: string;
    name?: string;
    duration?: number;
    width?: number;
    height?: number;
    frameRate?: number;
    avgFrameRate?: string;
    realFrameRate?: string;
    timecode?: string;
    startTimecode?: string;
}
export interface ConformMediaMatch {
    assetId: string;
    strategy: ConformMediaMatchStrategy;
    candidate?: ConformMediaCandidate;
    candidatePaths?: string[];
    failureReason?: ConformMediaFailureReason;
}
export interface ConformMediaWarning {
    assetId: string;
    reason: ConformMediaWarningReason;
    proxyValue: string | number;
    originalValue: string | number;
    threshold?: number;
}
export interface ConformMediaPreflightItem {
    assetId: string;
    proxyName: string;
    proxyPath: string;
    strategy: ConformMediaMatchStrategy;
    candidatePath?: string;
    selected: boolean;
    status: 'success' | 'warning' | 'failed';
    warnings: ConformMediaWarning[];
    failureReason?: ConformMediaFailureReason;
    candidatePaths: string[];
}
export interface ConformMediaReplacement {
    assetId: string;
    replacementPath: string;
    strategy: ConformMediaMatchStrategy;
}
export interface ConformMediaReportSuccess {
    assetId: string;
    fromPath: string;
    toPath: string;
    strategy: ConformMediaMatchStrategy;
}
export interface ConformMediaReportWarning extends ConformMediaWarning {
    proxyPath: string;
    originalPath: string;
}
export interface ConformMediaReportFailure {
    assetId: string;
    proxyPath: string;
    reason: ConformMediaFailureReason;
    candidatePaths: string[];
}
export interface ConformMediaReport {
    totalCount: number;
    successCount: number;
    warningCount: number;
    failureCount: number;
    successes: ConformMediaReportSuccess[];
    warnings: ConformMediaReportWarning[];
    failures: ConformMediaReportFailure[];
}
export interface ConformMediaPreflightOptions {
    selectedAssetIds?: string[];
    fallbackFrameRate?: number;
}
export interface ConformMediaReportOptions {
    selectedOnly?: boolean;
}
export declare function stripProxySuffix(pathOrName: string): string;
export declare function buildConformFilenameKey(pathOrName: string, options?: {
    caseInsensitive?: boolean;
}): string;
export declare function matchConformByFilename(media: MediaAsset[], candidates: ConformMediaCandidate[], options?: {
    caseInsensitive?: boolean;
}): ConformMediaMatch[];
export declare function matchConformByTimecode(media: MediaAsset[], candidates: ConformMediaCandidate[]): ConformMediaMatch[];
export declare function buildManualConformMatches(pairings: Array<{
    assetId: string;
    candidate?: ConformMediaCandidate;
}>): ConformMediaMatch[];
export declare function buildConformPreflight(media: MediaAsset[], matches: ConformMediaMatch[], options?: ConformMediaPreflightOptions): ConformMediaPreflightItem[];
export declare function buildConformMediaReplacements(items: ConformMediaPreflightItem[]): ConformMediaReplacement[];
export declare function buildConformReport(items: ConformMediaPreflightItem[], options?: ConformMediaReportOptions): ConformMediaReport;
export declare function applyConformMedia(project: Project, replacements: ConformMediaReplacement[]): Project;
//# sourceMappingURL=conform-media.d.ts.map
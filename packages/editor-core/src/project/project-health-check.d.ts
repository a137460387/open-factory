import { type MediaAsset, type Project } from '../model';
import type { ProxySettings } from '../proxy/proxy-types';
export type ProjectHealthIssueType = 'missing-media' | 'duplicate-media' | 'orphan-media' | 'proxy-missing' | 'missing-font';
export interface ProjectHealthClipReference {
    clipId: string;
    clipName: string;
    trackId: string;
    trackName: string;
    sequenceId: string;
    sequenceName: string;
}
export interface ProjectHealthMediaSummary {
    assetId: string;
    name: string;
    path: string;
    fileName: string;
}
export interface MissingMediaIssue extends ProjectHealthMediaSummary {
    type: 'missing-media';
    id: string;
    references: ProjectHealthClipReference[];
}
export interface DuplicateMediaAsset extends ProjectHealthMediaSummary {
    references: ProjectHealthClipReference[];
}
export interface DuplicateMediaIssue {
    type: 'duplicate-media';
    id: string;
    size: number;
    mtimeMs: number;
    keepAssetId: string;
    assets: DuplicateMediaAsset[];
}
export interface OrphanMediaIssue extends ProjectHealthMediaSummary {
    type: 'orphan-media';
    id: string;
}
export interface ProxyMissingIssue extends ProjectHealthMediaSummary {
    type: 'proxy-missing';
    id: string;
    width: number;
    height: number;
    proxyStatus: MediaAsset['proxyStatus'];
}
export interface MissingFontIssue {
    type: 'missing-font';
    id: string;
    fontFamily: string;
    clip: ProjectHealthClipReference;
}
export interface ProjectHealthReport {
    missingMedia: MissingMediaIssue[];
    duplicateMedia: DuplicateMediaIssue[];
    orphanMedia: OrphanMediaIssue[];
    proxyMissing: ProxyMissingIssue[];
    missingFonts: MissingFontIssue[];
}
export interface ProjectHealthCheckOptions {
    missingMediaAssetIds?: Iterable<string>;
    isMediaMissing?: (asset: MediaAsset) => boolean;
    isFontFamilyAvailable?: (fontFamily: string) => boolean;
    proxySettings?: ProxySettings;
}
export declare function runProjectHealthCheck(project: Project, options?: ProjectHealthCheckOptions): ProjectHealthReport;
export declare function getProjectHealthIssueCount(report: ProjectHealthReport): number;
//# sourceMappingURL=project-health-check.d.ts.map
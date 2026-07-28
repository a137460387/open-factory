import { type Project } from '../model';
import type { ExportPlatformPreset } from './export-types';
export type PreflightSeverity = 'blocking' | 'warning';
export type PreflightIssueType = 'missing-media' | 'missing-font' | 'whisper-path' | 'ffmpeg' | 'platform-duration' | 'vfr-media' | 'frame-rate-mismatch';
export interface PreflightResult {
    id: string;
    type: PreflightIssueType;
    severity: PreflightSeverity;
    message: string;
    items: string[];
    clipIds?: string[];
    mediaIds?: string[];
    platformPreset?: ExportPlatformPreset;
    durationSeconds?: number;
    limitSeconds?: number;
    projectFrameRate?: number;
}
export interface ExportPreflightOptions {
    ffmpegAvailable?: boolean;
    whisperReady?: boolean;
    whisperMessage?: string;
    isFontFamilyAvailable?: (fontFamily: string) => boolean;
    platformPreset?: ExportPlatformPreset;
}
export declare function runExportPreflight(project: Project, options?: ExportPreflightOptions): PreflightResult[];
export declare function getPlatformDurationLimitSeconds(platformPreset: ExportPlatformPreset | undefined): number | undefined;
export declare function parseFontFamilyList(fontFamily: string): string[];
//# sourceMappingURL=preflight.d.ts.map
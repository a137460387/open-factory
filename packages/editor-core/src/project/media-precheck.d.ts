import type { MediaAsset } from '../model';
export type MediaPrecheckStatus = 'pass' | 'warning' | 'error';
export type MediaPrecheckProjectColorSpace = 'sdr' | 'hdr';
export type FfprobePrecheckErrorCategory = 'unsupported-codec' | 'invalid-data' | 'missing-file' | 'permission' | 'unknown';
export type MediaPrecheckIssueType = 'ffprobe-error' | 'codec' | 'av-sync' | 'integrity' | 'hdr-sdr' | 'file-header-mismatch';
export interface MediaPrecheckVideoStream {
    codecName?: string;
    duration?: number;
    colorSpace?: string;
    colorTransfer?: string;
    colorPrimaries?: string;
    pixelFormat?: string;
    hdrMetadata?: string[];
}
export interface MediaPrecheckAudioStream {
    codecName?: string;
    duration?: number;
}
export interface MediaPrecheckAnalysis {
    format?: {
        duration?: number;
    };
    videoStreams: MediaPrecheckVideoStream[];
    audioStreams: MediaPrecheckAudioStream[];
}
export interface ParsedFfprobePrecheckError {
    category: FfprobePrecheckErrorCategory;
    details: string;
}
export interface MediaPrecheckIssue {
    type: MediaPrecheckIssueType;
    severity: Exclude<MediaPrecheckStatus, 'pass'>;
    details?: string;
    ffprobeError?: ParsedFfprobePrecheckError;
    videoDuration?: number;
    audioDuration?: number;
    deltaSeconds?: number;
}
export interface MediaPrecheckInput {
    asset: Pick<MediaAsset, 'id' | 'name' | 'path' | 'type'>;
    analysis?: MediaPrecheckAnalysis;
    ffprobeError?: string;
    integrityErrorOutput?: string;
    projectColorSpace?: MediaPrecheckProjectColorSpace;
    fileSniff?: FileSniffResult;
    forcedImport?: boolean;
}
export interface MediaPrecheckResult {
    assetId: string;
    name: string;
    path: string;
    type: MediaAsset['type'];
    status: MediaPrecheckStatus;
    issues: MediaPrecheckIssue[];
}
export declare function buildMediaPrecheckResult(input: MediaPrecheckInput): MediaPrecheckResult;
export declare function detectAudioVideoSyncIssue(analysis: MediaPrecheckAnalysis, thresholdSeconds?: number): MediaPrecheckIssue | undefined;
export declare function detectColorSpacePrecheckIssue(analysis: MediaPrecheckAnalysis, projectColorSpace?: MediaPrecheckProjectColorSpace): MediaPrecheckIssue | undefined;
export declare function parseFfprobePrecheckError(error: string): ParsedFfprobePrecheckError;
import type { FileSniffResult } from '../media-file-sniff';
//# sourceMappingURL=media-precheck.d.ts.map
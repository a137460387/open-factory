import type { MediaAsset } from '../model';

export type MediaPrecheckStatus = 'pass' | 'warning' | 'error';
export type MediaPrecheckProjectColorSpace = 'sdr' | 'hdr';
export type FfprobePrecheckErrorCategory =
  'unsupported-codec' | 'invalid-data' | 'missing-file' | 'permission' | 'unknown';
export type MediaPrecheckIssueType =
  'ffprobe-error' | 'codec' | 'av-sync' | 'integrity' | 'hdr-sdr' | 'file-header-mismatch';

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

export function buildMediaPrecheckResult(input: MediaPrecheckInput): MediaPrecheckResult {
  const issues: MediaPrecheckIssue[] = [];
  if (input.ffprobeError?.trim()) {
    issues.push({
      type: 'ffprobe-error',
      severity: 'error',
      details: input.ffprobeError.trim(),
      ffprobeError: parseFfprobePrecheckError(input.ffprobeError),
    });
  } else if (input.analysis) {
    const codecIssue = detectCodecPrecheckIssue(input.analysis);
    if (codecIssue) {
      issues.push(codecIssue);
    }
    const syncIssue = detectAudioVideoSyncIssue(input.analysis);
    if (syncIssue) {
      issues.push(syncIssue);
    }
    const colorIssue = detectColorSpacePrecheckIssue(input.analysis, input.projectColorSpace ?? 'sdr');
    if (colorIssue) {
      issues.push(colorIssue);
    }
  }
  if (input.integrityErrorOutput?.trim()) {
    issues.push({
      type: 'integrity',
      severity: 'error',
      details: input.integrityErrorOutput.trim(),
    });
  }
  if (input.fileSniff?.status === 'mismatch') {
    issues.push({
      type: 'file-header-mismatch',
      severity: 'warning',
      details: `${input.fileSniff.extension} -> ${input.fileSniff.detectedLabel ?? 'unknown'}`,
    });
  }
  if (input.forcedImport) {
    return {
      assetId: input.asset.id,
      name: input.asset.name,
      path: input.asset.path,
      type: input.asset.type,
      status: 'warning',
      issues: [...issues, { type: 'file-header-mismatch', severity: 'warning', details: 'force-imported' }],
    };
  }
  return {
    assetId: input.asset.id,
    name: input.asset.name,
    path: input.asset.path,
    type: input.asset.type,
    status: summarizeMediaPrecheckStatus(issues),
    issues,
  };
}

export function detectAudioVideoSyncIssue(
  analysis: MediaPrecheckAnalysis,
  thresholdSeconds = 0.5,
): MediaPrecheckIssue | undefined {
  const videoDuration = firstFiniteDuration(analysis.videoStreams[0]?.duration, analysis.format?.duration);
  const audioDuration = firstFiniteDuration(analysis.audioStreams[0]?.duration, analysis.format?.duration);
  if (
    videoDuration === undefined ||
    audioDuration === undefined ||
    analysis.videoStreams.length === 0 ||
    analysis.audioStreams.length === 0
  ) {
    return undefined;
  }
  const deltaSeconds = Math.abs(videoDuration - audioDuration);
  if (deltaSeconds <= thresholdSeconds) {
    return undefined;
  }
  return {
    type: 'av-sync',
    severity: 'warning',
    videoDuration,
    audioDuration,
    deltaSeconds,
  };
}

export function detectColorSpacePrecheckIssue(
  analysis: MediaPrecheckAnalysis,
  projectColorSpace: MediaPrecheckProjectColorSpace = 'sdr',
): MediaPrecheckIssue | undefined {
  if (projectColorSpace === 'hdr') {
    return undefined;
  }
  const hdrStream = analysis.videoStreams.find(isHdrVideoStream);
  return hdrStream
    ? {
        type: 'hdr-sdr',
        severity: 'warning',
        details: [hdrStream.colorPrimaries, hdrStream.colorTransfer, hdrStream.colorSpace].filter(Boolean).join(' / '),
      }
    : undefined;
}

export function parseFfprobePrecheckError(error: string): ParsedFfprobePrecheckError {
  const details = error.trim();
  const normalized = details.toLowerCase();
  if (
    normalized.includes('unknown decoder') ||
    normalized.includes('unsupported codec') ||
    normalized.includes('decoder not found')
  ) {
    return { category: 'unsupported-codec', details };
  }
  if (
    normalized.includes('invalid data') ||
    normalized.includes('moov atom not found') ||
    normalized.includes('could not find codec parameters')
  ) {
    return { category: 'invalid-data', details };
  }
  if (
    normalized.includes('no such file') ||
    normalized.includes('cannot find the file') ||
    normalized.includes('not found')
  ) {
    return { category: 'missing-file', details };
  }
  if (normalized.includes('permission denied') || normalized.includes('access is denied')) {
    return { category: 'permission', details };
  }
  return { category: 'unknown', details };
}

function detectCodecPrecheckIssue(analysis: MediaPrecheckAnalysis): MediaPrecheckIssue | undefined {
  const missingVideoCodec = analysis.videoStreams.some((stream) => !stream.codecName?.trim());
  const missingAudioCodec = analysis.audioStreams.some((stream) => !stream.codecName?.trim());
  if (!missingVideoCodec && !missingAudioCodec) {
    return undefined;
  }
  return {
    type: 'codec',
    severity: 'warning',
    details: missingVideoCodec && missingAudioCodec ? 'video,audio' : missingVideoCodec ? 'video' : 'audio',
  };
}

function summarizeMediaPrecheckStatus(issues: MediaPrecheckIssue[]): MediaPrecheckStatus {
  if (issues.some((issue) => issue.severity === 'error')) {
    return 'error';
  }
  if (issues.length > 0) {
    return 'warning';
  }
  return 'pass';
}

function firstFiniteDuration(...values: Array<number | undefined>): number | undefined {
  return values.find((value): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0);
}

function isHdrVideoStream(stream: MediaPrecheckVideoStream): boolean {
  const values = [
    stream.colorTransfer,
    stream.colorPrimaries,
    stream.colorSpace,
    stream.pixelFormat,
    ...(stream.hdrMetadata ?? []),
  ].map((value) => value?.toLowerCase() ?? '');
  return values.some(
    (value) =>
      value.includes('smpte2084') ||
      value.includes('arib-std-b67') ||
      value.includes('bt2020') ||
      value.includes('hdr'),
  );
}
import type { FileSniffResult } from '../media-file-sniff';

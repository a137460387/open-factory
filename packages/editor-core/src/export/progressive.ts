import { dirname, joinPath } from '../project/relative-paths';
import { normalizeFfmpegPath } from './ffmpeg-escape';
import type { ExportSettings, FfmpegExportPlan } from './export-types';

const PLAYABLE_PARTIAL_MOVFLAGS = '+frag_keyframe+empty_moov+default_base_moof';

export interface ProgressiveExportState {
  enabled: boolean;
  supported: boolean;
  partialPath: string;
  completedDuration: number;
  fallbackReason?: string;
}

export interface ProgressiveExportSupportInput {
  format?: string;
  videoCodec?: string;
  outputMode?: ExportSettings['outputMode'];
}

export function buildProgressivePartialPath(outputPath: string): string {
  const normalized = outputPath.trim();
  const slash = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'));
  const dot = normalized.lastIndexOf('.');
  if (dot > slash) {
    return `${normalized.slice(0, dot)}.partial.mp4`;
  }
  return `${normalized}.partial.mp4`;
}

export function isProgressiveExportSupported(input: ProgressiveExportSupportInput): boolean {
  const format = (input.format ?? '').toLowerCase();
  const codec = (input.videoCodec ?? '').toLowerCase();
  if (input.outputMode === 'audio' || input.outputMode === 'audio-visualization') {
    return false;
  }
  if (format !== 'mp4') {
    return false;
  }
  return (
    codec.includes('264') || codec.includes('265') || codec.includes('hevc') || codec === 'h264' || codec === 'h265'
  );
}

export function createProgressiveExportState(input: {
  outputPath: string;
  settings: ProgressiveExportSupportInput;
  completedDuration?: number;
}): ProgressiveExportState {
  return {
    enabled: true,
    supported: isProgressiveExportSupported(input.settings),
    partialPath: buildProgressivePartialPath(input.outputPath),
    completedDuration: clampCompletedDuration(input.completedDuration ?? 0),
  };
}

export function buildProgressiveResumeArgs(completedDuration: number): string[] {
  const duration = clampCompletedDuration(completedDuration);
  return duration > 0 ? ['-ss', formatFfmpegSeconds(duration)] : [];
}

export function estimateProgressiveCompletedDuration(duration: number, progress: number): number {
  if (!Number.isFinite(duration) || duration <= 0) {
    return 0;
  }
  return clampCompletedDuration(duration * Math.min(0.999, Math.max(0, Number.isFinite(progress) ? progress : 0)));
}

export function buildProgressiveExportPlan(
  plan: FfmpegExportPlan,
  partialPath: string,
  completedDuration = 0,
): FfmpegExportPlan {
  const normalizedPartial = normalizeFfmpegPath(partialPath);
  const originalOutput = plan.fullArgs.at(-1);
  const resumeArgs = buildProgressiveResumeArgs(completedDuration);
  const outputArgs = withPlayablePartialMovFlags(replaceLastOutputPath(plan.outputArgs, normalizedPartial));
  const fullArgs = withPlayablePartialMovFlags(replaceLastOutputPath(plan.fullArgs, normalizedPartial));
  const withResume = resumeArgs.length > 0 ? insertResumeArgsBeforeOutput(fullArgs, resumeArgs) : fullArgs;
  return {
    ...plan,
    outputArgs: resumeArgs.length > 0 ? insertResumeArgsBeforeOutput(outputArgs, resumeArgs) : outputArgs,
    fullArgs: withResume,
    displayCommand:
      plan.displayCommand && originalOutput
        ? plan.displayCommand.replace(originalOutput, normalizedPartial)
        : plan.displayCommand,
  };
}

export function getPlayablePartialMovFlags(): string {
  return PLAYABLE_PARTIAL_MOVFLAGS;
}

export function buildProgressiveSegmentOutputPath(partialPath: string, completedDuration: number): string {
  const directory = dirname(partialPath);
  const stem =
    partialPath
      .split(/[\\/]/)
      .pop()
      ?.replace(/\.partial\.mp4$/i, '')
      .replace(/\.[^.]+$/i, '') || 'export';
  return joinPath(directory, `${stem}.resume-${Math.max(0, Math.floor(completedDuration))}.partial.mp4`);
}

function replaceLastOutputPath(args: string[], outputPath: string): string[] {
  if (args.length === 0) {
    return [outputPath];
  }
  return [...args.slice(0, -1), outputPath];
}

function insertResumeArgsBeforeOutput(args: string[], resumeArgs: string[]): string[] {
  if (args.length === 0) {
    return [...resumeArgs];
  }
  return [...args.slice(0, -1), ...resumeArgs, args[args.length - 1]];
}

function withPlayablePartialMovFlags(args: string[]): string[] {
  const movflagsIndex = args.findIndex((arg) => arg === '-movflags');
  if (movflagsIndex >= 0) {
    const merged = mergeMovFlags(args[movflagsIndex + 1] ?? '');
    return [...args.slice(0, movflagsIndex + 1), merged, ...args.slice(movflagsIndex + 2)];
  }
  if (args.length === 0) {
    return ['-movflags', PLAYABLE_PARTIAL_MOVFLAGS];
  }
  return [...args.slice(0, -1), '-movflags', PLAYABLE_PARTIAL_MOVFLAGS, args[args.length - 1]];
}

function mergeMovFlags(existing: string): string {
  const flags = existing.split('+').filter(Boolean);
  for (const flag of ['frag_keyframe', 'empty_moov', 'default_base_moof']) {
    if (!flags.includes(flag)) {
      flags.push(flag);
    }
  }
  return `+${flags.join('+')}`;
}

function clampCompletedDuration(value: number): number {
  return Math.max(0, Number.isFinite(value) ? Math.round(value * 1000) / 1000 : 0);
}

function formatFfmpegSeconds(value: number): string {
  return clampCompletedDuration(value)
    .toFixed(3)
    .replace(/\.?0+$/u, '');
}

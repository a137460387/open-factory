import type { FfmpegCapabilities, Project } from '@open-factory/editor-core';

export const EXPORT_WARMUP_CACHE_TTL_MS = 5 * 60 * 1000;

export type ExportWarmupStepId = 'proxy-check' | 'temp-dir' | 'ffmpeg' | 'fonts';

export interface ExportWarmupDependencies {
  checkProxyGeneration(project: Project): Promise<void> | void;
  createTempDirectory(): Promise<string> | string;
  getFfmpegCapabilities(): Promise<FfmpegCapabilities> | FfmpegCapabilities;
  checkFonts(project: Project): Promise<void> | void;
  now?: () => number;
}

export interface ExportWarmupOptions {
  cacheKey?: string;
  ttlMs?: number;
  ffmpegUnavailableMessage?: string;
  onStep?: (step: ExportWarmupStepId) => void;
}

export interface ExportWarmupResult {
  cached: boolean;
  cacheKey: string;
  steps: ExportWarmupStepId[];
  completedAt: number;
}

const EXPORT_WARMUP_STEPS: ExportWarmupStepId[] = ['proxy-check', 'temp-dir', 'ffmpeg', 'fonts'];
const warmupCache = new Map<string, { completedAt: number }>();

export async function runExportWarmup(
  project: Project,
  dependencies: ExportWarmupDependencies,
  options: ExportWarmupOptions = {},
): Promise<ExportWarmupResult> {
  const now = dependencies.now?.() ?? Date.now();
  const ttlMs = options.ttlMs ?? EXPORT_WARMUP_CACHE_TTL_MS;
  const cacheKey = options.cacheKey ?? buildExportWarmupCacheKey(project);
  const cached = warmupCache.get(cacheKey);
  if (cached && now - cached.completedAt < ttlMs) {
    return { cached: true, cacheKey, steps: [], completedAt: cached.completedAt };
  }

  const completedSteps: ExportWarmupStepId[] = [];
  for (const step of EXPORT_WARMUP_STEPS) {
    options.onStep?.(step);
    if (step === 'proxy-check') {
      await dependencies.checkProxyGeneration(project);
    } else if (step === 'temp-dir') {
      await dependencies.createTempDirectory();
    } else if (step === 'ffmpeg') {
      const capabilities = await dependencies.getFfmpegCapabilities();
      if (!capabilities.available) {
        throw new Error(options.ffmpegUnavailableMessage ?? 'FFmpeg is unavailable.');
      }
    } else {
      await dependencies.checkFonts(project);
    }
    completedSteps.push(step);
  }

  const completedAt = dependencies.now?.() ?? Date.now();
  warmupCache.set(cacheKey, { completedAt });
  return { cached: false, cacheKey, steps: completedSteps, completedAt };
}

export function resetExportWarmupCache(): void {
  warmupCache.clear();
}

function buildExportWarmupCacheKey(project: Project): string {
  const mediaStamp = project.media
    .map((asset) =>
      [
        asset.id,
        asset.path,
        asset.missing ? 'missing' : 'ok',
        asset.proxyStatus ?? 'none',
        asset.proxyPath ?? '',
        asset.size ?? 0,
        asset.mtimeMs ?? 0,
      ].join(':'),
    )
    .sort()
    .join('|');
  const fontStamp = project.timeline.tracks
    .flatMap((track) => track.clips)
    .flatMap((clip) => ('style' in clip && typeof clip.style?.fontFamily === 'string' ? [clip.style.fontFamily] : []))
    .sort()
    .join('|');
  return [
    project.id,
    project.updatedAt,
    project.media.length,
    project.timeline.tracks.length,
    project.sequences?.length ?? 0,
    mediaStamp,
    fontStamp,
  ].join('::');
}

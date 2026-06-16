import type { Project, SubtitleStyle } from '@open-factory/editor-core';

export type ProjectBatchOperation = 'batch-export' | 'subtitle-style' | 'replace-media-prefix' | 'cover-frame';
export type ProjectBatchTaskStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';

export interface BuildProjectBatchQueueOptions {
  operation: ProjectBatchOperation;
  outputDirectory?: string;
  pathPrefix?: {
    from: string;
    to: string;
  };
  subtitleStylePatch?: Partial<SubtitleStyle>;
}

export interface ProjectBatchTask {
  id: string;
  projectPath: string;
  operation: ProjectBatchOperation;
  outputPath?: string;
  pathPrefix?: {
    from: string;
    to: string;
  };
  subtitleStylePatch?: Partial<SubtitleStyle>;
}

export interface ProjectBatchTaskResult {
  task: ProjectBatchTask;
  status: Exclude<ProjectBatchTaskStatus, 'pending' | 'running'>;
  projectName?: string;
  outputPath?: string;
  changedCount?: number;
  message?: string;
  error?: string;
}

export interface ProjectBatchReport {
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  results: ProjectBatchTaskResult[];
}

export interface ProjectBatchRunSuccess {
  status?: 'success' | 'skipped';
  projectName?: string;
  outputPath?: string;
  changedCount?: number;
  message?: string;
}

export type ProjectBatchTaskRunner = (task: ProjectBatchTask) => Promise<ProjectBatchRunSuccess> | ProjectBatchRunSuccess;

export function buildProjectBatchQueue(projectPaths: string[], options: BuildProjectBatchQueueOptions): ProjectBatchTask[] {
  const paths = uniqueProjectPaths(projectPaths);
  return paths.map((projectPath, index) => ({
    id: `project-batch-${options.operation}-${index + 1}`,
    projectPath,
    operation: options.operation,
    outputPath: buildOperationOutputPath(projectPath, options),
    pathPrefix: options.pathPrefix,
    subtitleStylePatch: options.subtitleStylePatch
  }));
}

export async function runProjectBatchQueue(tasks: ProjectBatchTask[], runner: ProjectBatchTaskRunner): Promise<ProjectBatchReport> {
  const results: ProjectBatchTaskResult[] = [];
  for (const task of tasks) {
    try {
      const result = await runner(task);
      results.push({
        task,
        status: result.status === 'skipped' ? 'skipped' : 'success',
        projectName: result.projectName,
        outputPath: result.outputPath ?? task.outputPath,
        changedCount: result.changedCount,
        message: result.message
      });
    } catch (error) {
      results.push({
        task,
        status: 'failed',
        outputPath: task.outputPath,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  return summarizeProjectBatchResults(results);
}

export function summarizeProjectBatchResults(results: ProjectBatchTaskResult[]): ProjectBatchReport {
  return {
    total: results.length,
    succeeded: results.filter((result) => result.status === 'success').length,
    failed: results.filter((result) => result.status === 'failed').length,
    skipped: results.filter((result) => result.status === 'skipped').length,
    results
  };
}

export function serializeProjectBatchReport(report: ProjectBatchReport): string {
  return JSON.stringify(
    {
      summary: {
        total: report.total,
        succeeded: report.succeeded,
        failed: report.failed,
        skipped: report.skipped
      },
      results: report.results.map((result) => ({
        projectPath: result.task.projectPath,
        operation: result.task.operation,
        status: result.status,
        projectName: result.projectName,
        outputPath: result.outputPath,
        changedCount: result.changedCount,
        message: result.message,
        error: result.error
      }))
    },
    null,
    2
  );
}

export function replaceProjectMediaPathPrefix(
  project: Project,
  fromPrefix: string,
  toPrefix: string
): { project: Project; changedCount: number } {
  const trimmedFrom = fromPrefix.trim();
  const trimmedTo = toPrefix.trim();
  if (!trimmedFrom || !trimmedTo) {
    return { project, changedCount: 0 };
  }
  let changedCount = 0;
  const media = project.media.map((asset) => {
    let changed = false;
    const replace = (value: string | undefined | null): string | undefined | null => {
      const next = replacePathPrefix(value, trimmedFrom, trimmedTo);
      if (next !== value) {
        changed = true;
      }
      return next;
    };
    const nextImageSequence = asset.imageSequence
      ? {
          ...asset.imageSequence,
          pattern: replace(asset.imageSequence.pattern) ?? asset.imageSequence.pattern,
          paths: asset.imageSequence.paths.map((path) => replace(path) ?? path)
        }
      : undefined;
    const nextAsset = {
      ...asset,
      path: replace(asset.path) ?? asset.path,
      originalAbsolutePath: replace(asset.originalAbsolutePath) ?? asset.originalAbsolutePath,
      proxyPath: replace(asset.proxyPath) ?? asset.proxyPath,
      thumbnailCachePath: replace(asset.thumbnailCachePath) ?? asset.thumbnailCachePath,
      waveformCachePath: replace(asset.waveformCachePath) ?? asset.waveformCachePath,
      imageSequence: nextImageSequence
    };
    if (!changed) {
      return asset;
    }
    changedCount += 1;
    return { ...nextAsset, missing: false };
  });
  return changedCount > 0 ? { project: { ...project, media }, changedCount } : { project, changedCount };
}

export function updateProjectSubtitleStyle(
  project: Project,
  patch: Partial<SubtitleStyle>
): { project: Project; changedCount: number } {
  const stylePatch = compactStylePatch(patch);
  if (Object.keys(stylePatch).length === 0) {
    return { project, changedCount: 0 };
  }
  let changedCount = 0;
  const tracks = project.timeline.tracks.map((track) => {
    if (track.type !== 'subtitle') {
      return track;
    }
    const clips = track.clips.map((clip) => {
      if (clip.type !== 'subtitle') {
        return clip;
      }
      changedCount += 1;
      return { ...clip, style: { ...clip.style, ...stylePatch } };
    });
    return clips === track.clips ? track : { ...track, clips };
  });
  return changedCount > 0 ? { project: { ...project, timeline: { ...project.timeline, tracks } }, changedCount } : { project, changedCount };
}

export function buildProjectBatchOutputPath(projectPath: string, outputDirectory: string | undefined, extension: string, suffix = ''): string {
  const directory = normalizeOutputDirectory(outputDirectory) || dirname(projectPath);
  const baseName = projectFileBaseName(projectPath);
  return `${directory}/${baseName}${suffix}.${extension.replace(/^\./, '')}`;
}

function buildOperationOutputPath(projectPath: string, options: BuildProjectBatchQueueOptions): string | undefined {
  if (options.operation === 'batch-export') {
    return buildProjectBatchOutputPath(projectPath, options.outputDirectory, 'mp4');
  }
  if (options.operation === 'cover-frame') {
    return buildProjectBatchOutputPath(projectPath, options.outputDirectory, 'png', '-cover');
  }
  return undefined;
}

function replacePathPrefix(value: string | undefined | null, fromPrefix: string, toPrefix: string): string | undefined | null {
  if (!value) {
    return value;
  }
  const normalizedValue = normalizePathForCompare(value);
  const normalizedFrom = trimTrailingSlashes(normalizePathForCompare(fromPrefix));
  if (!normalizedFrom) {
    return value;
  }
  if (!normalizedValue.toLocaleLowerCase().startsWith(normalizedFrom.toLocaleLowerCase())) {
    return value;
  }
  const rest = normalizedValue.slice(normalizedFrom.length);
  if (rest && !rest.startsWith('/')) {
    return value;
  }
  const normalizedTo = trimTrailingSlashes(normalizePathForOutput(toPrefix));
  return `${normalizedTo}${rest}`;
}

function compactStylePatch(patch: Partial<SubtitleStyle>): Partial<SubtitleStyle> {
  return Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined && value !== null)) as Partial<SubtitleStyle>;
}

function uniqueProjectPaths(projectPaths: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const path of projectPaths) {
    const trimmed = path.trim();
    const key = normalizePathForCompare(trimmed).toLocaleLowerCase();
    if (!trimmed || seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(trimmed);
  }
  return output;
}

function projectFileBaseName(projectPath: string): string {
  const name = basename(projectPath);
  return name.replace(/\.cutproj\.json$/i, '').replace(/\.cutproj\.enc$/i, '').replace(/\.json$/i, '') || 'open-factory';
}

function dirname(path: string): string {
  const normalized = normalizePathForOutput(path);
  const index = normalized.lastIndexOf('/');
  return index > 0 ? normalized.slice(0, index) : '.';
}

function basename(path: string): string {
  const normalized = normalizePathForOutput(path);
  return normalized.slice(normalized.lastIndexOf('/') + 1);
}

function normalizeOutputDirectory(path: string | undefined): string {
  return trimTrailingSlashes(normalizePathForOutput(path?.trim() ?? ''));
}

function normalizePathForCompare(path: string): string {
  return path.replace(/\\/g, '/');
}

function normalizePathForOutput(path: string): string {
  return path.replace(/\\/g, '/');
}

function trimTrailingSlashes(path: string): string {
  return path.replace(/[\\/]+$/g, '');
}

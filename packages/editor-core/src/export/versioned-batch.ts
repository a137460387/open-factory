import type { ExportRenderRange } from './export-ranges';
import type { ExportTask, VersionedExportTaskMetadata } from './queue-types';
import type { ExportProject, ExportSettings } from './export-types';

export type { VersionedExportTaskMetadata } from './queue-types';

export interface VersionedExportMetadataTemplate {
  title?: string;
  author?: string;
  description?: string;
  copyright?: string;
  date?: string;
}

export interface VersionedExportDefinition {
  id: string;
  name: string;
  enabled?: boolean;
  presetId?: string;
  platform?: string;
  language?: string;
  outputPathTemplate?: string;
  range?: ExportRenderRange | null;
  variables?: Record<string, string>;
  settings?: Partial<Omit<ExportSettings, 'outputPath'>>;
  metadata?: VersionedExportMetadataTemplate;
}

export interface VersionedBatchExportTemplateFile {
  version: 1;
  name: string;
  outputPathTemplate: string;
  versions: VersionedExportDefinition[];
  exportedAt: string;
}

export interface VersionedExportJob {
  batch: VersionedExportTaskMetadata;
  outputPath: string;
  range?: ExportRenderRange | null;
  settings: Partial<Omit<ExportSettings, 'outputPath'>>;
  metadata?: ExportProject['metadata'];
  presetId?: string;
}

export interface CreateVersionedExportJobsInput {
  batchId: string;
  outputPathTemplate: string;
  defaultSettings: Partial<Omit<ExportSettings, 'outputPath'>>;
  defaultRange?: ExportRenderRange | null;
  presetSettingsById?: Map<string, Partial<Omit<ExportSettings, 'outputPath'>>>;
  metadata?: VersionedExportMetadataTemplate;
  versions: VersionedExportDefinition[];
}

export interface VersionedExportReportRow {
  batchId: string;
  versionId: string;
  versionName: string;
  platform?: string;
  language?: string;
  outputPath: string;
  status: ExportTask['status'];
  fileSizeBytes: number | null;
  durationSeconds: number | null;
  elapsedMs: number | null;
  width: number | null;
  height: number | null;
}

export function expandVersionedExportVariables(
  template: string,
  variables: Record<string, string>,
  options: { pathSafe?: boolean } = {},
): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key: string) => {
    const value = variables[key];
    if (value === undefined) {
      return match;
    }
    return options.pathSafe ? sanitizePathToken(value) : value;
  });
}

export function mergeVersionedExportSettings(
  defaultSettings: Partial<Omit<ExportSettings, 'outputPath'>>,
  presetSettings: Partial<Omit<ExportSettings, 'outputPath'>> | undefined,
  version: Pick<VersionedExportDefinition, 'settings'>,
): Partial<Omit<ExportSettings, 'outputPath'>> {
  return {
    ...cloneSettings(defaultSettings),
    ...cloneSettings(presetSettings),
    ...cloneSettings(version.settings),
  };
}

export function createVersionedExportJobs(input: CreateVersionedExportJobsInput): VersionedExportJob[] {
  return input.versions
    .filter((version) => version.enabled !== false)
    .map((version, index) => {
      const variables = buildVersionedVariables(version, index + 1);
      const template = version.outputPathTemplate?.trim() || input.outputPathTemplate;
      const presetSettings = version.presetId ? input.presetSettingsById?.get(version.presetId) : undefined;
      const settings = mergeVersionedExportSettings(input.defaultSettings, presetSettings, version);
      const metadata = buildVersionedMetadata({ ...input.metadata, ...version.metadata }, variables);
      return {
        batch: {
          batchId: input.batchId,
          versionId: version.id,
          versionName: version.name,
          ...(version.platform?.trim() ? { platform: version.platform.trim() } : {}),
          ...(version.language?.trim() ? { language: version.language.trim() } : {}),
        },
        outputPath: expandVersionedExportVariables(template, variables, { pathSafe: true }),
        range: version.range === undefined ? (input.defaultRange ?? null) : version.range,
        settings,
        metadata,
        presetId: version.presetId,
      };
    });
}

export function serializeVersionedBatchTemplate(
  name: string,
  outputPathTemplate: string,
  versions: VersionedExportDefinition[],
  exportedAt = new Date().toISOString(),
): string {
  const payload: VersionedBatchExportTemplateFile = {
    version: 1,
    name: name.trim() || 'Versioned Batch Export',
    outputPathTemplate: outputPathTemplate.trim() || './{version_name}.mp4',
    versions: versions.map(sanitizeVersionDefinition),
    exportedAt,
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}

export function parseVersionedBatchTemplate(contents: string): VersionedBatchExportTemplateFile {
  const parsed = JSON.parse(contents) as Partial<VersionedBatchExportTemplateFile>;
  if (parsed.version !== 1 || !Array.isArray(parsed.versions)) {
    throw new Error('Unsupported versioned batch export template.');
  }
  return {
    version: 1,
    name: typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.trim() : 'Versioned Batch Export',
    outputPathTemplate:
      typeof parsed.outputPathTemplate === 'string' && parsed.outputPathTemplate.trim()
        ? parsed.outputPathTemplate.trim()
        : './{version_name}.mp4',
    versions: parsed.versions.flatMap((version) => {
      if (!version || typeof version.id !== 'string' || typeof version.name !== 'string') {
        return [];
      }
      return [sanitizeVersionDefinition(version)];
    }),
    exportedAt:
      typeof parsed.exportedAt === 'string' && parsed.exportedAt.trim()
        ? parsed.exportedAt.trim()
        : new Date(0).toISOString(),
  };
}

export function countRunningVersionedBatchTasks(tasks: ExportTask[], batchId: string): number {
  return tasks.filter((task) => task.versionedBatch?.batchId === batchId && task.status === 'running').length;
}

export function buildVersionedExportReportRows(
  tasks: ExportTask[],
  options: { batchId?: string; fileSizes?: Record<string, number> } = {},
): VersionedExportReportRow[] {
  return tasks
    .filter(
      (task) => Boolean(task.versionedBatch) && (!options.batchId || task.versionedBatch?.batchId === options.batchId),
    )
    .map((task) => {
      const metadata = task.versionedBatch!;
      return {
        batchId: metadata.batchId,
        versionId: metadata.versionId,
        versionName: metadata.versionName,
        ...(metadata.platform ? { platform: metadata.platform } : {}),
        ...(metadata.language ? { language: metadata.language } : {}),
        outputPath: task.outputPath,
        status: task.status,
        fileSizeBytes: normalizeOptionalNumber(options.fileSizes?.[task.outputPath]),
        durationSeconds: normalizeOptionalNumber(task.plan.duration),
        elapsedMs: calculateElapsedMs(task.startedAt, task.finishedAt),
        width: normalizeOptionalNumber(task.plan.settings?.width),
        height: normalizeOptionalNumber(task.plan.settings?.height),
      };
    });
}

function buildVersionedVariables(version: VersionedExportDefinition, index: number): Record<string, string> {
  return {
    ...(version.variables ?? {}),
    version_name: version.name,
    platform: version.platform?.trim() ?? '',
    language: version.language?.trim() ?? '',
    index: String(index),
  };
}

function buildVersionedMetadata(
  template: VersionedExportMetadataTemplate | undefined,
  variables: Record<string, string>,
): ExportProject['metadata'] | undefined {
  if (!template) {
    return undefined;
  }
  const metadata: NonNullable<ExportProject['metadata']> = {};
  for (const key of ['title', 'author', 'description', 'copyright', 'date'] as const) {
    const value = template[key];
    if (typeof value === 'string' && value.trim()) {
      metadata[key] = expandVersionedExportVariables(value, variables).trim();
    }
  }
  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

function sanitizeVersionDefinition(version: VersionedExportDefinition): VersionedExportDefinition {
  const sanitized: VersionedExportDefinition = {
    id: version.id.trim() || `version-${Date.now()}`,
    name: version.name.trim() || 'Version',
    enabled: version.enabled !== false,
  };
  copyTrimmed(version, sanitized, 'presetId');
  copyTrimmed(version, sanitized, 'platform');
  copyTrimmed(version, sanitized, 'language');
  copyTrimmed(version, sanitized, 'outputPathTemplate');
  if (version.range !== undefined) {
    sanitized.range = version.range;
  }
  if (version.variables && typeof version.variables === 'object') {
    sanitized.variables = Object.fromEntries(
      Object.entries(version.variables)
        .filter(([key, value]) => key.trim() && typeof value === 'string')
        .map(([key, value]) => [key.trim(), value]),
    );
  }
  if (version.settings && typeof version.settings === 'object') {
    sanitized.settings = cloneSettings(version.settings);
  }
  if (version.metadata && typeof version.metadata === 'object') {
    sanitized.metadata = sanitizeMetadataTemplate(version.metadata);
  }
  return sanitized;
}

function sanitizeMetadataTemplate(template: VersionedExportMetadataTemplate): VersionedExportMetadataTemplate {
  const sanitized: VersionedExportMetadataTemplate = {};
  for (const key of ['title', 'author', 'description', 'copyright', 'date'] as const) {
    const value = template[key];
    if (typeof value === 'string' && value.trim()) {
      sanitized[key] = value.trim();
    }
  }
  return sanitized;
}

function cloneSettings(
  settings: Partial<Omit<ExportSettings, 'outputPath'>> | undefined,
): Partial<Omit<ExportSettings, 'outputPath'>> {
  return settings ? { ...settings } : {};
}

function copyTrimmed(
  source: VersionedExportDefinition,
  target: VersionedExportDefinition,
  key: 'presetId' | 'platform' | 'language' | 'outputPathTemplate',
): void {
  const value = source[key];
  if (typeof value === 'string' && value.trim()) {
    target[key] = value.trim();
  }
}

function sanitizePathToken(value: string): string {
  const sanitized = value
    .replace(/[<>:"/\\|?*\x00-\x1f]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '');
  return sanitized || 'version';
}

function normalizeOptionalNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function calculateElapsedMs(startedAt: string | undefined, finishedAt: string | undefined): number | null {
  if (!startedAt || !finishedAt) {
    return null;
  }
  const start = Date.parse(startedAt);
  const finish = Date.parse(finishedAt);
  return Number.isFinite(start) && Number.isFinite(finish) && finish >= start ? finish - start : null;
}

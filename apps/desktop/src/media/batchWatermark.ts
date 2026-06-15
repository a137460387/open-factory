import {
  DEFAULT_PRIMARY_SEQUENCE_NAME,
  PRIMARY_SEQUENCE_ID,
  createBaseClip,
  createProject,
  createTrack,
  type ExportSettings,
  type ExportWatermarkPosition,
  type MediaAsset,
  type Project
} from '@open-factory/editor-core';

export const DEFAULT_BATCH_WATERMARK_TEMPLATE = '{name}_watermarked';
export const DEFAULT_BATCH_WATERMARK_TEXT = 'Watermark';
export const DEFAULT_BATCH_WATERMARK_FONT = 'Arial';

export interface BatchWatermarkOptions {
  assetIds: string[];
  outputDirectory?: string;
  fileNameTemplate?: string;
  watermarkText?: string;
  position?: ExportWatermarkPosition;
  fontSize?: number;
  color?: string;
  fontFamily?: string;
  format?: string;
}

export interface BatchWatermarkJob {
  id: string;
  assetId: string;
  assetName: string;
  sourcePath: string;
  outputPath: string;
  project: Project;
  settings: Partial<Omit<ExportSettings, 'outputPath'>>;
}

const BATCH_WATERMARK_TRACK_ID = 'track-batch-watermark';
const BATCH_WATERMARK_IMAGE_DURATION = 3;
const DEFAULT_OUTPUT_FORMAT = 'mp4';

export function isBatchWatermarkSupportedAsset(asset: MediaAsset): boolean {
  return asset.type === 'video' || asset.type === 'image';
}

export function buildBatchWatermarkJobs(project: Project, options: BatchWatermarkOptions): BatchWatermarkJob[] {
  const selectedIds = new Set(options.assetIds);
  const jobs = project.media
    .filter((asset) => selectedIds.has(asset.id) && isBatchWatermarkSupportedAsset(asset))
    .map((asset, index) => buildBatchWatermarkJob(project, asset, options, index + 1));
  return ensureUniqueOutputPaths(jobs);
}

export function buildBatchWatermarkJob(project: Project, asset: MediaAsset, options: BatchWatermarkOptions, index: number): BatchWatermarkJob {
  const format = normalizeOutputFormat(options.format);
  const settings = buildBatchWatermarkExportSettings(project, asset, options, format);
  return {
    id: `batch-watermark-${asset.id}`,
    assetId: asset.id,
    assetName: asset.name,
    sourcePath: asset.path,
    outputPath: buildBatchWatermarkOutputPath(asset, options, index, format),
    project: buildSingleAssetWatermarkProject(project, asset),
    settings
  };
}

export function buildBatchWatermarkOutputPath(asset: MediaAsset, options: BatchWatermarkOptions, index: number, format = DEFAULT_OUTPUT_FORMAT): string {
  const directory = normalizeDirectory(options.outputDirectory) || dirname(asset.path);
  const fileName = buildBatchWatermarkFileName(asset, options.fileNameTemplate, index, format);
  return directory ? `${directory}/${fileName}` : fileName;
}

export function buildBatchWatermarkFileName(asset: MediaAsset, fileNameTemplate: string | undefined, index: number, format = DEFAULT_OUTPUT_FORMAT): string {
  const { baseName } = splitFileName(asset.name || fileNameFromPath(asset.path));
  const extension = normalizeOutputFormat(format);
  const template = fileNameTemplate?.trim() || DEFAULT_BATCH_WATERMARK_TEMPLATE;
  const rendered = template
    .replace(/\{name\}/g, baseName || 'media')
    .replace(/\{index\}/g, String(Math.max(1, index)).padStart(3, '0'))
    .replace(/\{ext\}/g, extension)
    .replace(/[<>:"|?*\u0000-\u001f]/g, '_')
    .trim();
  const safeName = rendered || `${baseName || 'media'}_watermarked`;
  return /\.[^./\\]+$/.test(safeName) ? safeName : `${safeName}.${extension}`;
}

export function selectBatchWatermarkPreviewJob(jobs: BatchWatermarkJob[]): BatchWatermarkJob | undefined {
  return jobs[0];
}

function buildBatchWatermarkExportSettings(
  project: Project,
  asset: MediaAsset,
  options: BatchWatermarkOptions,
  format: string
): Partial<Omit<ExportSettings, 'outputPath'>> {
  return {
    width: safeDimension(asset.width, project.settings.width),
    height: safeDimension(asset.height, project.settings.height),
    fps: Math.max(1, project.settings.fps || 30),
    format,
    outputMode: 'video',
    videoCodec: 'libx264',
    audioCodec: 'aac',
    scaleMode: 'fit',
    watermark: {
      enabled: true,
      type: 'text',
      text: normalizeWatermarkText(options.watermarkText),
      fontFamily: options.fontFamily?.trim() || DEFAULT_BATCH_WATERMARK_FONT,
      color: normalizeWatermarkColor(options.color),
      fontSize: normalizeFontSize(options.fontSize),
      position: normalizeWatermarkPosition(options.position)
    }
  };
}

function buildSingleAssetWatermarkProject(sourceProject: Project, asset: MediaAsset): Project {
  const duration = asset.type === 'image' ? BATCH_WATERMARK_IMAGE_DURATION : Math.max(0.1, asset.duration || 1);
  const baseClip = createBaseClip({
    id: `clip-batch-watermark-${asset.id}`,
    name: asset.name,
    trackId: BATCH_WATERMARK_TRACK_ID,
    start: 0,
    duration,
    trimStart: 0,
    trimEnd: 0,
    speed: 1
  });
  const clip =
    asset.type === 'image'
      ? ({ ...baseClip, type: 'image', mediaId: asset.id, kenBurns: false } as const)
      : ({ ...baseClip, type: 'video', mediaId: asset.id, volume: 1 } as const);
  const timeline = {
    tracks: [
      createTrack({
        id: BATCH_WATERMARK_TRACK_ID,
        type: 'video',
        name: 'Batch Watermark',
        clips: [clip]
      })
    ],
    transitions: [],
    markers: []
  };
  const project = createProject(`${sourceProject.name} - ${asset.name}`);
  return {
    ...project,
    settings: {
      ...project.settings,
      fps: sourceProject.settings.fps,
      timecodeFormat: sourceProject.settings.timecodeFormat,
      width: safeDimension(asset.width, sourceProject.settings.width),
      height: safeDimension(asset.height, sourceProject.settings.height)
    },
    masterVolume: sourceProject.masterVolume,
    media: [asset],
    timeline,
    sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
    activeSequenceId: PRIMARY_SEQUENCE_ID
  };
}

function ensureUniqueOutputPaths(jobs: BatchWatermarkJob[]): BatchWatermarkJob[] {
  const seen = new Map<string, number>();
  return jobs.map((job, index) => {
    const count = seen.get(job.outputPath) ?? 0;
    seen.set(job.outputPath, count + 1);
    if (count === 0) {
      return job;
    }
    return { ...job, outputPath: addDuplicateSuffix(job.outputPath, index + 1) };
  });
}

function addDuplicateSuffix(path: string, index: number): string {
  const slash = path.replace(/\\/g, '/').lastIndexOf('/');
  const directory = slash >= 0 ? path.slice(0, slash + 1) : '';
  const fileName = slash >= 0 ? path.slice(slash + 1) : path;
  const { baseName, extension } = splitFileName(fileName);
  return `${directory}${baseName}-${String(index).padStart(3, '0')}${extension ? `.${extension}` : ''}`;
}

function normalizeWatermarkText(text: string | undefined): string {
  return text?.trim() || DEFAULT_BATCH_WATERMARK_TEXT;
}

function normalizeWatermarkColor(color: string | undefined): string {
  return /^#[0-9a-f]{6}$/i.test(color ?? '') ? (color as string).toLowerCase() : '#ffffff';
}

function normalizeFontSize(value: number | undefined): number {
  return Math.round(Math.min(128, Math.max(12, Number.isFinite(value) ? value! : 36)));
}

function normalizeWatermarkPosition(position: ExportWatermarkPosition | undefined): ExportWatermarkPosition {
  const positions: ExportWatermarkPosition[] = ['top-left', 'top-center', 'top-right', 'middle-left', 'center', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right'];
  return position && positions.includes(position) ? position : 'bottom-right';
}

function normalizeOutputFormat(format: string | undefined): string {
  const safe = format?.trim().toLowerCase();
  return safe && /^[a-z0-9-]+$/.test(safe) ? safe : DEFAULT_OUTPUT_FORMAT;
}

function safeDimension(value: number | undefined, fallback: number): number {
  return Math.max(1, Math.round(Number.isFinite(value) && value ? value : fallback || 1280));
}

function normalizeDirectory(path: string | undefined): string {
  return path?.trim().replace(/\\/g, '/').replace(/\/+$/g, '') ?? '';
}

function dirname(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const slash = normalized.lastIndexOf('/');
  return slash >= 0 ? normalized.slice(0, slash) : '';
}

function fileNameFromPath(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const slash = normalized.lastIndexOf('/');
  return slash >= 0 ? normalized.slice(slash + 1) : normalized;
}

function splitFileName(name: string): { baseName: string; extension: string } {
  const index = name.lastIndexOf('.');
  if (index <= 0 || index === name.length - 1) {
    return { baseName: name, extension: '' };
  }
  return { baseName: name.slice(0, index), extension: name.slice(index + 1).toLowerCase() };
}

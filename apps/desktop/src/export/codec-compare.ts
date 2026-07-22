import { clamp01 } from '@open-factory/editor-core/utils/math';
import type { ExportTask, ExportTaskStatus } from '@open-factory/editor-core';
import type { QualityEvaluationResult } from '../lib/tauri-bridge';
import type { ExportPreset, ExportPresetSettings } from './export-presets';

export const MAX_CODEC_COMPARE_PRESETS = 4;

export type CodecCompareRecommendationMode = 'quality' | 'size';
export type CodecCompareSortKey = 'presetName' | 'fileSizeBytes' | 'durationMs' | 'ssim' | 'psnr';
export type CodecCompareSortDirection = 'asc' | 'desc';
type CodecCompareQualityStatus = 'idle' | 'running' | 'complete' | 'error';

export interface CodecCompareJob {
  presetId: string;
  presetName: string;
  outputPath: string;
  settings: ExportPresetSettings;
}

export interface CodecCompareResult {
  presetId: string;
  presetName: string;
  outputPath: string;
  taskId?: string;
  status: ExportTaskStatus | 'queued';
  sourcePath?: string;
  fileSizeBytes?: number;
  durationMs?: number;
  ssim?: number;
  psnr?: number;
  qualityStatus?: CodecCompareQualityStatus;
  qualityError?: string;
}

export interface CodecCompareEvaluationRequest {
  taskId: string;
  sourcePath: string;
  outputPath: string;
}

export function buildCodecCompareJobs(input: {
  baseOutputPath: string;
  presets: ExportPreset[];
  selectedPresetIds: string[];
}): CodecCompareJob[] {
  const baseOutputPath = input.baseOutputPath.trim();
  if (!baseOutputPath) {
    throw new Error('Codec compare output path is required.');
  }
  const selectedIds = unique(input.selectedPresetIds).slice(0, MAX_CODEC_COMPARE_PRESETS);
  if (selectedIds.length < 2) {
    throw new Error('Select at least two presets for codec comparison.');
  }
  const presetById = new Map(input.presets.map((preset) => [preset.id, preset]));
  return selectedIds.map((presetId, index) => {
    const preset = presetById.get(presetId);
    if (!preset) {
      throw new Error(`Export preset not found: ${presetId}`);
    }
    return {
      presetId: preset.id,
      presetName: preset.name,
      outputPath: buildCodecCompareOutputPath(baseOutputPath, preset, index + 1),
      settings: { ...preset.settings },
    };
  });
}

function buildCodecCompareOutputPath(baseOutputPath: string, preset: ExportPreset, index: number): string {
  const normalized = baseOutputPath.trim();
  const separatorIndex = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'));
  const directory = separatorIndex >= 0 ? normalized.slice(0, separatorIndex + 1) : '';
  const fileName = separatorIndex >= 0 ? normalized.slice(separatorIndex + 1) : normalized;
  const extensionMatch = /\.([a-z0-9-]+)$/i.exec(fileName);
  const baseName = extensionMatch ? fileName.slice(0, -extensionMatch[0].length) : fileName;
  const extension = String(preset.settings.format || extensionMatch?.[1] || 'mp4').replace(/^\./, '') || 'mp4';
  const suffix = sanitizePathSegment(preset.name) || `preset-${index}`;
  return `${directory}${baseName}-${suffix}.${extension}`;
}

export function createInitialCodecCompareResults(jobs: CodecCompareJob[], tasks: ExportTask[]): CodecCompareResult[] {
  return jobs.map((job, index) => {
    const task = tasks[index];
    return {
      presetId: job.presetId,
      presetName: job.presetName,
      outputPath: job.outputPath,
      taskId: task?.id,
      status: task?.status ?? 'queued',
      sourcePath: task ? getTaskSourcePath(task) : undefined,
      durationMs: task ? getTaskDurationMs(task) : undefined,
      qualityStatus: 'idle',
    };
  });
}

export function syncCodecCompareResultsWithTasks(
  results: CodecCompareResult[],
  tasks: ExportTask[],
): CodecCompareResult[] {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  return results.map((result) => {
    if (!result.taskId) {
      return result;
    }
    const task = taskById.get(result.taskId);
    if (!task) {
      return result;
    }
    return {
      ...result,
      status: task.status,
      sourcePath: result.sourcePath ?? getTaskSourcePath(task),
      durationMs: getTaskDurationMs(task) ?? result.durationMs,
      qualityStatus: task.status === 'success' && !result.qualityStatus ? 'idle' : result.qualityStatus,
    };
  });
}

export function collectPendingCodecCompareEvaluations(results: CodecCompareResult[]): CodecCompareEvaluationRequest[] {
  return results
    .filter(
      (result) =>
        result.status === 'success' &&
        result.taskId &&
        result.sourcePath &&
        (result.qualityStatus === undefined || result.qualityStatus === 'idle'),
    )
    .map((result) => ({
      taskId: result.taskId!,
      sourcePath: result.sourcePath!,
      outputPath: result.outputPath,
    }));
}

export function applyCodecCompareQualityResult(
  results: CodecCompareResult[],
  taskId: string,
  quality: QualityEvaluationResult,
  fileSizeBytes?: number,
): CodecCompareResult[] {
  return results.map((result) =>
    result.taskId === taskId
      ? {
          ...result,
          fileSizeBytes,
          ssim: quality.ssim,
          psnr: quality.psnr,
          qualityStatus: 'complete',
          qualityError: undefined,
        }
      : result,
  );
}

export function applyCodecCompareQualityError(
  results: CodecCompareResult[],
  taskId: string,
  error: string,
): CodecCompareResult[] {
  return results.map((result) =>
    result.taskId === taskId ? { ...result, qualityStatus: 'error', qualityError: error } : result,
  );
}

export function markCodecCompareQualityRunning(results: CodecCompareResult[], taskId: string): CodecCompareResult[] {
  return results.map((result) =>
    result.taskId === taskId ? { ...result, qualityStatus: 'running', qualityError: undefined } : result,
  );
}

export function recommendCodecCompareResult(
  results: CodecCompareResult[],
  mode: CodecCompareRecommendationMode,
): CodecCompareResult | undefined {
  const candidates = results.filter(
    (result) => result.qualityStatus === 'complete' && Number.isFinite(result.ssim) && Number.isFinite(result.psnr),
  );
  if (candidates.length === 0) {
    return undefined;
  }
  const sizes = candidates
    .map((result) => result.fileSizeBytes)
    .filter((value): value is number => Number.isFinite(value));
  const minSize = sizes.length > 0 ? Math.min(...sizes) : undefined;
  const maxSize = sizes.length > 0 ? Math.max(...sizes) : undefined;
  const weights = mode === 'quality' ? { quality: 0.95, size: 0.05 } : { quality: 0.2, size: 0.8 };
  return candidates
    .map((result) => ({ result, score: codecCompareScore(result, weights, minSize, maxSize) }))
    .sort((left, right) => right.score - left.score || left.result.presetName.localeCompare(right.result.presetName))[0]
    ?.result;
}

export function sortCodecCompareResults(
  results: CodecCompareResult[],
  key: CodecCompareSortKey,
  direction: CodecCompareSortDirection,
): CodecCompareResult[] {
  const multiplier = direction === 'asc' ? 1 : -1;
  return [...results].sort((left, right) => {
    const leftValue = left[key];
    const rightValue = right[key];
    if (typeof leftValue === 'string' || typeof rightValue === 'string') {
      return multiplier * String(leftValue ?? '').localeCompare(String(rightValue ?? ''));
    }
    return multiplier * ((Number(leftValue) || 0) - (Number(rightValue) || 0));
  });
}

export function areCodecCompareResultsEqual(left: CodecCompareResult[], right: CodecCompareResult[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function codecCompareScore(
  result: CodecCompareResult,
  weights: { quality: number; size: number },
  minSize?: number,
  maxSize?: number,
): number {
  const ssimScore = clamp01(result.ssim ?? 0);
  const psnrScore = clamp01(((result.psnr ?? 0) - 20) / 30);
  const qualityScore = ssimScore * 0.65 + psnrScore * 0.35;
  const sizeScore = sizeEfficiencyScore(result.fileSizeBytes, minSize, maxSize);
  return qualityScore * weights.quality + sizeScore * weights.size;
}

function sizeEfficiencyScore(
  size: number | undefined,
  minSize: number | undefined,
  maxSize: number | undefined,
): number {
  if (!Number.isFinite(size) || !Number.isFinite(minSize) || !Number.isFinite(maxSize) || minSize === maxSize) {
    return 0.5;
  }
  return clamp01(1 - ((size as number) - (minSize as number)) / ((maxSize as number) - (minSize as number)));
}

function getTaskSourcePath(task: ExportTask): string | undefined {
  return task.plan.inputs.find((input) => input.path.trim())?.path;
}

function getTaskDurationMs(task: ExportTask): number | undefined {
  if (!task.startedAt || !task.finishedAt) {
    return undefined;
  }
  const started = Date.parse(task.startedAt);
  const finished = Date.parse(task.finishedAt);
  return Number.isFinite(started) && Number.isFinite(finished) && finished >= started ? finished - started : undefined;
}

function sanitizePathSegment(value: string): string {
  return value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

function unique(values: string[]): string[] {
  return Array.from(
    new Set(values.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim())),
  );
}

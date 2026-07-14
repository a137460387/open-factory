import { normalizeFfmpegPath } from './ffmpeg-escape';
import type { ExportReport, FfmpegExportPlan } from './export-types';

export type RenderFarmSegmentStatusValue = 'pending' | 'running' | 'success' | 'error';

export interface RenderFarmTaskConfig {
  enabled: boolean;
  maxInstances: number;
}

export interface RenderFarmSegment {
  id: string;
  index: number;
  start: number;
  duration: number;
}

export interface RenderFarmSegmentStatus extends RenderFarmSegment {
  outputPath: string;
  status: RenderFarmSegmentStatusValue;
  progress: number;
  error?: string;
}

export interface RenderFarmRunOutcome {
  report?: ExportReport;
  usedFallback: boolean;
}

export interface RenderFarmRunContext {
  taskId: string;
  outputPath: string;
  plan: FfmpegExportPlan;
  config: RenderFarmTaskConfig;
  tempSegmentsDir: string;
  runPlan(plan: FfmpegExportPlan, taskId: string): Promise<{ report?: ExportReport }>;
  writeFile(path: string, contents: string): Promise<void>;
  removeFile(path: string): Promise<void>;
  onSegments?(segments: RenderFarmSegmentStatus[]): void;
  onSegmentUpdate?(segment: RenderFarmSegmentStatus): void;
  onProgress?(progress: number): void;
}

export const RENDER_FARM_SPLIT_THRESHOLD_SECONDS = 60;
export const RENDER_FARM_TARGET_SEGMENT_SECONDS = 30;

export function suggestRenderFarmInstances(cpuCores: number | undefined): number {
  if (!Number.isFinite(cpuCores) || !cpuCores || cpuCores <= 0) {
    return 1;
  }
  return clampRenderFarmInstances(Math.floor(cpuCores / 4));
}

export function clampRenderFarmInstances(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.min(4, Math.max(1, Math.round(value)));
}

export function calculateRenderFarmSegments(
  duration: number,
  options: { thresholdSeconds?: number; targetSegmentSeconds?: number } = {},
): RenderFarmSegment[] {
  const safeDuration = Math.max(0, Number.isFinite(duration) ? duration : 0);
  const threshold = Math.max(1, options.thresholdSeconds ?? RENDER_FARM_SPLIT_THRESHOLD_SECONDS);
  const target = Math.max(1, options.targetSegmentSeconds ?? RENDER_FARM_TARGET_SEGMENT_SECONDS);
  if (safeDuration <= threshold) {
    return [];
  }
  const segments: RenderFarmSegment[] = [];
  const segmentCount = Math.max(2, Math.round(safeDuration / target));
  const idealDuration = safeDuration / segmentCount;
  let start = 0;
  for (let index = 0; index < segmentCount; index += 1) {
    const segmentDuration = index === segmentCount - 1 ? round(safeDuration - start) : round(idealDuration);
    segments.push({
      id: `segment-${index + 1}`,
      index,
      start: round(start),
      duration: segmentDuration,
    });
    start = round(start + segmentDuration);
  }
  return segments;
}

export function isRenderFarmPlanEligible(plan: FfmpegExportPlan): boolean {
  return plan.duration > RENDER_FARM_SPLIT_THRESHOLD_SECONDS && !plan.passes?.length && plan.nestedPlans.length === 0;
}

export function createRenderFarmSegmentStatuses(
  segments: RenderFarmSegment[],
  tempSegmentsDir: string,
  taskId: string,
  outputPath: string,
): RenderFarmSegmentStatus[] {
  return segments.map((segment) => ({
    ...segment,
    outputPath: buildRenderFarmSegmentPath(tempSegmentsDir, taskId, segment.index, outputPath),
    status: 'pending',
    progress: 0,
  }));
}

export function buildRenderFarmSegmentPath(
  tempSegmentsDir: string,
  taskId: string,
  index: number,
  outputPath: string,
): string {
  const extension = outputPath.match(/\.([a-zA-Z0-9]+)$/)?.[1] ?? 'mp4';
  const safeTask = taskId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return normalizeFfmpegPath(
    `${tempSegmentsDir.replace(/[\\/]+$/g, '')}/${safeTask}-segment-${String(index + 1).padStart(2, '0')}.${extension}`,
  );
}

export function buildRenderFarmSegmentPlan(plan: FfmpegExportPlan, segment: RenderFarmSegmentStatus): FfmpegExportPlan {
  const fullArgs = replaceFinalOutputArg(plan.fullArgs, segment.outputPath);
  fullArgs.splice(
    Math.max(0, fullArgs.length - 1),
    0,
    '-ss',
    formatSeconds(segment.start),
    '-t',
    formatSeconds(segment.duration),
  );
  return {
    ...plan,
    fullArgs,
    outputArgs: replaceFinalOutputArg(plan.outputArgs, segment.outputPath),
    displayCommand: undefined,
    postExportScript: null,
    duration: segment.duration,
  };
}

export function buildRenderFarmConcatList(segments: Pick<RenderFarmSegmentStatus, 'outputPath'>[]): string {
  return `${segments.map((segment) => `file '${escapeConcatPath(segment.outputPath)}'`).join('\n')}\n`;
}

export function buildRenderFarmConcatPlan(
  segments: Pick<RenderFarmSegmentStatus, 'outputPath' | 'duration'>[],
  outputPath: string,
  concatListPath: string,
  sourcePlan?: Pick<FfmpegExportPlan, 'projectName' | 'postExportScript'>,
): FfmpegExportPlan {
  const normalizedOutput = normalizeFfmpegPath(outputPath);
  const normalizedList = normalizeFfmpegPath(concatListPath);
  const fullArgs = ['-y', '-f', 'concat', '-safe', '0', '-i', normalizedList, '-c', 'copy', normalizedOutput];
  return {
    projectName: sourcePlan?.projectName,
    inputs: [{ index: 0, path: normalizedList, args: ['-f', 'concat', '-safe', '0'] }],
    filterComplex: '',
    maps: [],
    outputArgs: ['-c', 'copy', normalizedOutput],
    fullArgs,
    warnings: [],
    textArtifacts: [],
    nestedPlans: [],
    postExportScript: sourcePlan?.postExportScript ?? null,
    duration: round(segments.reduce((total, segment) => total + segment.duration, 0)),
  };
}

export function calculateRenderFarmProgress(
  segments: Pick<RenderFarmSegmentStatus, 'duration' | 'progress'>[],
): number {
  const total = segments.reduce((sum, segment) => sum + Math.max(0, segment.duration), 0);
  if (total <= 0) {
    return 0;
  }
  return Math.min(
    1,
    Math.max(
      0,
      segments.reduce(
        (sum, segment) => sum + Math.max(0, segment.duration) * Math.min(1, Math.max(0, segment.progress)),
        0,
      ) / total,
    ),
  );
}

export async function runRenderFarmWithFallback(context: RenderFarmRunContext): Promise<RenderFarmRunOutcome> {
  if (!context.config.enabled || !isRenderFarmPlanEligible(context.plan)) {
    const result = await context.runPlan(context.plan, context.taskId);
    return { report: result.report, usedFallback: false };
  }
  const rawSegments = calculateRenderFarmSegments(context.plan.duration);
  if (rawSegments.length <= 1) {
    const result = await context.runPlan(context.plan, context.taskId);
    return { report: result.report, usedFallback: false };
  }
  let segments = createRenderFarmSegmentStatuses(
    rawSegments,
    context.tempSegmentsDir,
    context.taskId,
    context.outputPath,
  );
  context.onSegments?.(segments);
  const concatListPath = normalizeFfmpegPath(
    `${context.tempSegmentsDir.replace(/[\\/]+$/g, '')}/${context.taskId.replace(/[^a-zA-Z0-9_-]/g, '_')}-concat.txt`,
  );
  try {
    await runSegmentsInPool(context, segments);
    await context.writeFile(concatListPath, buildRenderFarmConcatList(segments));
    const result = await context.runPlan(
      buildRenderFarmConcatPlan(segments, context.outputPath, concatListPath, context.plan),
      `${context.taskId}:concat`,
    );
    return { report: result.report, usedFallback: false };
  } catch {
    segments = segments.map((segment) =>
      segment.status === 'success' ? segment : { ...segment, status: 'error', progress: 0 },
    );
    context.onSegments?.(segments);
    const result = await context.runPlan(context.plan, context.taskId);
    return { report: result.report, usedFallback: true };
  } finally {
    await Promise.allSettled([
      ...segments.map((segment) => context.removeFile(segment.outputPath)),
      context.removeFile(concatListPath),
    ]);
  }
}

async function runSegmentsInPool(context: RenderFarmRunContext, segments: RenderFarmSegmentStatus[]): Promise<void> {
  const maxInstances = clampRenderFarmInstances(context.config.maxInstances);
  let cursor = 0;
  let failure: unknown;
  async function worker(): Promise<void> {
    while (cursor < segments.length && !failure) {
      const segment = segments[cursor];
      cursor += 1;
      updateSegment(context, segments, segment.id, { status: 'running', progress: 0.05 });
      try {
        await context.runPlan(
          buildRenderFarmSegmentPlan(context.plan, { ...segment, status: 'running', progress: 0.05 }),
          `${context.taskId}:${segment.id}`,
        );
        updateSegment(context, segments, segment.id, { status: 'success', progress: 1 });
      } catch (error) {
        failure = error;
        updateSegment(context, segments, segment.id, {
          status: 'error',
          progress: 0,
          error: error instanceof Error ? error.message : 'Segment render failed',
        });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(maxInstances, segments.length) }, () => worker()));
  if (failure) {
    throw failure;
  }
}

function updateSegment(
  context: RenderFarmRunContext,
  segments: RenderFarmSegmentStatus[],
  segmentId: string,
  patch: Partial<RenderFarmSegmentStatus>,
): void {
  const index = segments.findIndex((segment) => segment.id === segmentId);
  if (index === -1) {
    return;
  }
  segments[index] = { ...segments[index], ...patch };
  context.onSegmentUpdate?.(segments[index]);
  context.onProgress?.(calculateRenderFarmProgress(segments) * 0.95);
}

function replaceFinalOutputArg(args: string[], outputPath: string): string[] {
  if (args.length === 0) {
    return [normalizeFfmpegPath(outputPath)];
  }
  return [...args.slice(0, -1), normalizeFfmpegPath(outputPath)];
}

function escapeConcatPath(path: string): string {
  return normalizeFfmpegPath(path).replace(/'/g, "'\\''");
}

function formatSeconds(value: number): string {
  return round(Math.max(0, value)).toFixed(6).replace(/0+$/g, '').replace(/\.$/g, '');
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

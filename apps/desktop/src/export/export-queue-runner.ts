import {
  buildExportProjectFromProject,
  buildProgressiveExportPlan,
  buildFfmpegExportPlan,
  createProgressiveExportState,
  estimateProgressiveCompletedDuration,
  appendExportRecoveryLog,
  buildExportRecoveryDecision,
  buildExportRecoveryReport,
  finalizeExportRecoveryLog,
  hasEnabledPostExportQualityChecks,
  runRenderFarmWithFallback,
  shouldRetryPostExportQuality,
  timelineHasExportableVideo,
  applyLowPowerThreads,
  type ExportProject,
  type ExportReport,
  type ExportSettings,
  type ExportRenderRange,
  type ExportTaskPriority,
  type ExportTask,
  type TextArtifact,
  type Project,
  type FfmpegExportPlan,
  type ExportRecoveryLogEntry,
  type VersionedExportTaskMetadata,
  type RenderFarmTaskConfig
} from '@open-factory/editor-core';
import { zhCN } from '../i18n/strings';
import { cancelExport as bridgeCancelExport, copyFile, getAvailableMemoryBytes, getFfmpegCapabilities, getTempSegmentsDir, listenBridge, removeFile, runExport, runPostExportQualityAssurance, writeFile } from '../lib/tauri-bridge';
import { readExportBackgroundSettings, readExportQualityAssuranceSettings } from '../settings/appSettings';
import { runExportBeforePlugins } from '../plugins/plugin-manager';
import { getExportLogPath, persistFinishedTaskToHistory } from './export-history';
import { normalizeExportProgressPayload, type ExportProgressEvent } from './export-progress';
import { useExportQueueStore } from './export-queue-store';
import { runConfiguredExportRules, type ExportRuleEventContext } from './export-rules';
import { buildSidecarSubtitlePath } from './export-sidecar';
import { runConfiguredExportUpload } from './export-upload';
import { clearMediaCache } from '../cache/cache-service';
import { appendExportSpeedSample } from './export-speed-history';

export const EXPORT_MEMORY_PAUSE_THRESHOLD_BYTES = 2 * 1024 * 1024 * 1024;
const RESOURCE_RECHECK_DELAY_MS = 500;
let runnerPromise: Promise<void> | undefined;
const activeRuns = new Map<string, Promise<void>>();
let wakeRunner: (() => void) | undefined;

export async function enqueueExport(
  project: Project,
  outputPath: string,
  settings?: Partial<Omit<ExportSettings, 'outputPath'>>,
  priority?: ExportTaskPriority,
  renderFarm?: RenderFarmTaskConfig,
  scheduledStartAt?: string,
  exportRange?: ExportRenderRange | null,
  progressive = false,
  options: { metadata?: ExportProject['metadata']; versionedBatch?: VersionedExportTaskMetadata } = {}
): Promise<ExportTask> {
  if (!timelineHasExportableVideo(project.timeline)) {
    throw new Error(zhCN.errors.exportNeedsVideo);
  }
  const capabilities = await getFfmpegCapabilities();
  if (!capabilities.available) {
    throw new Error(zhCN.errors.ffmpegMissing);
  }
  await runExportBeforePlugins(project, outputPath, settings);
  const exportProject = buildExportProjectFromProject(project, { outputPath, settings, metadata: options.metadata });
  const backgroundSettings = await readExportBackgroundSettings().catch(() => undefined);
  const rawPlan = buildFfmpegExportPlan(exportProject, capabilities, 0, [], { exportRange });
  const plan = applyLowPowerThreads(rawPlan, backgroundSettings?.lowPowerMode === true, getHardwareConcurrency());
  const progressiveState = progressive ? createProgressiveExportState({ outputPath, settings: exportProject.settings }) : undefined;
  const task = useExportQueueStore.getState().addTask({
    name: fileNameFromPath(outputPath) || `${project.name} 导出`,
    projectName: project.name,
    outputPath,
    plan,
    priority,
    renderFarm,
    progressive: progressiveState?.supported && !renderFarm?.enabled ? progressiveState : undefined,
    versionedBatch: options.versionedBatch,
    scheduledStartAt
  });
  signalRunner();
  ensureExportQueueRunner();
  return task;
}

export function retryQueuedExportTask(taskId: string): void {
  useExportQueueStore.getState().retryTask(taskId);
  signalRunner();
  ensureExportQueueRunner();
}

export function setExportQueueMaxConcurrent(maxConcurrent: number): void {
  useExportQueueStore.getState().setMaxConcurrent(maxConcurrent);
  signalRunner();
  ensureExportQueueRunner();
}

export function setExportQueuePaused(paused: boolean): void {
  useExportQueueStore.getState().setQueuePaused(paused);
  signalRunner();
  ensureExportQueueRunner();
}

export async function cancelAllQueuedExportTasks(): Promise<void> {
  const runningIds = useExportQueueStore
    .getState()
    .tasks.filter((task) => task.status === 'running')
    .map((task) => task.id);
  useExportQueueStore.getState().cancelAllTasks();
  await Promise.allSettled(runningIds.map((taskId) => bridgeCancelExport(taskId)));
  signalRunner();
}

export function ensureExportQueueRunner(): Promise<void> {
  if (runnerPromise) {
    return runnerPromise;
  }
  useExportQueueStore.getState().setRunnerActive(true);
  runnerPromise = runQueue().finally(() => {
    runnerPromise = undefined;
    useExportQueueStore.getState().setRunnerActive(false);
  });
  return runnerPromise;
}

export async function cancelQueuedExportTask(taskId: string): Promise<void> {
  const task = useExportQueueStore.getState().tasks.find((item) => item.id === taskId);
  if (!task || task.status === 'success' || task.status === 'error' || task.status === 'canceled') {
    return;
  }
  useExportQueueStore.getState().cancelTask(taskId);
  if (task.status === 'running') {
    await bridgeCancelExport(taskId);
  }
  signalRunner();
}

export async function pauseQueuedExportTask(taskId: string): Promise<void> {
  const task = useExportQueueStore.getState().tasks.find((item) => item.id === taskId);
  if (!task?.progressive || task.status !== 'running') {
    return;
  }
  useExportQueueStore.getState().interruptTask(taskId, zhCN.exportDialog.progressive.pausedMessage);
  await bridgeCancelExport(taskId);
  signalRunner();
}

async function runQueue(): Promise<void> {
  const unlisten = await listenBridge<ExportProgressEvent>('export-progress', (progress) => {
    const normalized = normalizeExportProgressPayload(progress);
    const progressTaskId = getProgressTaskId(progress);
    const childTask = progressTaskId ? parseRenderFarmChildTaskId(progressTaskId) : undefined;
    if (childTask?.kind === 'segment') {
      useExportQueueStore.getState().updateTaskSegment(childTask.parentTaskId, childTask.segmentId, { progress: normalized });
      return;
    }
    if (childTask?.kind === 'concat') {
      useExportQueueStore.getState().updateTaskProgress(childTask.parentTaskId, 0.95 + normalized * 0.05);
      return;
    }
    const taskId = progressTaskId ?? (activeRuns.size === 1 ? Array.from(activeRuns.keys())[0] : undefined);
    if (!taskId) {
      return;
    }
    const latest = useExportQueueStore.getState().tasks.find((task) => task.id === taskId);
    if (latest?.status === 'running') {
      useExportQueueStore.getState().updateTaskProgress(taskId, normalized);
      if (latest.progressive) {
        useExportQueueStore
          .getState()
          .updateTaskProgressive(taskId, { completedDuration: estimateProgressiveCompletedDuration(latest.plan.duration, normalized) });
      }
    }
  });

  try {
    while (true) {
      await startAvailableTasks();
      const hasWaiting = useExportQueueStore.getState().tasks.some((task) => task.status === 'pending' || task.status === 'scheduled');
      if (!hasWaiting && activeRuns.size === 0) {
        useExportQueueStore.getState().setResourcePaused(false);
        return;
      }
      if (hasWaiting && activeRuns.size === 0) {
        await waitForRunnerWake(nextRunnerDelayMs());
        continue;
      }
      await waitForRunnerWake();
    }
  } finally {
    unlisten();
  }
}

async function startAvailableTasks(): Promise<void> {
  useExportQueueStore.getState().activateScheduledTasks();
  const hasPending = useExportQueueStore.getState().tasks.some((task) => task.status === 'pending');
  if (!hasPending) {
    useExportQueueStore.getState().setResourcePaused(false);
    return;
  }
  if (useExportQueueStore.getState().queuePaused) {
    useExportQueueStore.getState().setResourcePaused(false);
    return;
  }
  if (await shouldPauseForMemory()) {
    useExportQueueStore.getState().setResourcePaused(true);
    return;
  }
  useExportQueueStore.getState().setResourcePaused(false);
  for (const taskId of useExportQueueStore.getState().startNextTasks()) {
    const task = useExportQueueStore.getState().tasks.find((item) => item.id === taskId);
    if (!task || activeRuns.has(task.id)) {
      continue;
    }
    const promise = runSingleTask(task).finally(async () => {
      activeRuns.delete(task.id);
      await runQueueCompleteRulesIfIdle(task.projectName);
      signalRunner();
    });
    activeRuns.set(task.id, promise);
  }
}

async function runSingleTask(task: ExportTask): Promise<void> {
  const logPath = await getExportLogPath(task.id).catch(() => undefined);
  if (logPath) {
    useExportQueueStore.getState().setTaskLogPath(task.id, logPath);
  }
  try {
    let recoveryEntries: ExportRecoveryLogEntry[] = [];
    let result = task.renderFarm?.enabled
      ? await runRenderFarmWithFallback({
          taskId: task.id,
          outputPath: task.outputPath,
          plan: task.plan,
          config: task.renderFarm,
          tempSegmentsDir: await getTempSegmentsDir(),
          runPlan: (plan, taskId) => runExport(plan, taskId),
          writeFile,
          removeFile,
          onSegments: (segments) => useExportQueueStore.getState().setTaskSegments(task.id, segments),
          onSegmentUpdate: (segment) => useExportQueueStore.getState().updateTaskSegment(task.id, segment.id, segment),
          onProgress: (progress) => useExportQueueStore.getState().updateTaskProgress(task.id, progress)
        })
      : await runRecoverableLocalExportTask(task, (entries) => {
          recoveryEntries = entries;
        });
    let report: ExportReport = { ...(result.report ?? {}) };
    const recoveryReport = buildExportRecoveryReport(recoveryEntries, recoveryEntries.length > 0);
    if (recoveryReport) {
      report.recovery = recoveryReport;
    }
    const qualitySettings = await readExportQualityAssuranceSettings().catch(() => undefined);
    if (qualitySettings && hasEnabledPostExportQualityChecks(qualitySettings)) {
      let retryAttempt = 0;
      while (true) {
        const qualityAssurance = await runPostExportQualityAssurance({
          taskId: task.id,
          outputPath: task.outputPath,
          expectedDuration: task.plan.duration,
          fps: task.plan.settings?.fps,
          expectedWidth: task.plan.settings?.width,
          expectedHeight: task.plan.settings?.height,
          duration: qualitySettings.duration,
          blackFrames: qualitySettings.blackFrames,
          silence: qualitySettings.silence,
          fileSize: qualitySettings.fileSize,
          resolution: qualitySettings.resolution,
          minFileSizeBytes: qualitySettings.minFileSizeBytes,
          maxFileSizeBytes: qualitySettings.maxFileSizeBytes,
          blackFrameDurationSeconds: qualitySettings.blackFrameDurationSeconds,
          silenceThresholdDb: qualitySettings.silenceThresholdDb,
          silenceDurationSeconds: qualitySettings.silenceDurationSeconds,
          autoRetry: qualitySettings.autoRetry
        });
        report = { ...report, qualityAssurance };
        if (!shouldRetryPostExportQuality(qualityAssurance, qualitySettings, retryAttempt)) {
          break;
        }
        retryAttempt += 1;
        useExportQueueStore.getState().updateTaskProgress(task.id, 0);
        result = task.renderFarm?.enabled ? result : await runRecoverableLocalExportTask(task, (entries) => {
          recoveryEntries = entries;
        });
        report = { ...(result.report ?? {}) };
        const retryRecoveryReport = buildExportRecoveryReport(recoveryEntries, recoveryEntries.length > 0);
        if (retryRecoveryReport) {
          report.recovery = retryRecoveryReport;
        }
      }
    }
    const latest = useExportQueueStore.getState().tasks.find((item) => item.id === task.id);
    if (latest?.status === 'running') {
      const durationMs = 'durationMs' in result ? result.durationMs : undefined;
      if (durationMs !== undefined) {
        await recordExportSpeedSample(task, durationMs).catch(() => undefined);
      }
      await writeSidecarSubtitleArtifacts(task.outputPath, task.plan.textArtifacts);
      useExportQueueStore.getState().finishTask(task.id, report);
      await persistFinishedTaskToHistory(task.id);
      await runConfiguredExportUpload(task.id);
      const finishedTask = useExportQueueStore.getState().tasks.find((item) => item.id === task.id) ?? task;
      await runExportRulesSafely({ type: 'export-success', task: finishedTask, projectName: finishedTask.projectName ?? task.projectName });
    }
  } catch (error) {
    const latest = useExportQueueStore.getState().tasks.find((item) => item.id === task.id);
    if (latest?.status === 'running') {
      const message = error instanceof Error ? error.message : zhCN.errors.exportFailed;
      const recoveryEntries = isExportRecoveryFailure(error) ? finalizeExportRecoveryLog(error.recoveryEntries, 'failed') : [];
      const recoveryReport = buildExportRecoveryReport(recoveryEntries, false);
      useExportQueueStore.getState().failTask(task.id, message, recoveryReport ? { recovery: recoveryReport } : undefined);
      await persistFinishedTaskToHistory(task.id);
      const failedTask = useExportQueueStore.getState().tasks.find((item) => item.id === task.id) ?? { ...task, error: message };
      await runExportRulesSafely({ type: 'export-failure', task: failedTask, projectName: failedTask.projectName ?? task.projectName });
    }
  }
}

async function recordExportSpeedSample(task: ExportTask, durationMs: number): Promise<void> {
  if (!Number.isFinite(durationMs) || durationMs <= 0 || !Number.isFinite(task.plan.duration) || task.plan.duration <= 0) {
    return;
  }
  await appendExportSpeedSample({
    id: task.id,
    projectName: task.projectName,
    outputPath: task.outputPath,
    durationSeconds: task.plan.duration,
    elapsedMs: durationMs,
    width: task.plan.settings?.width,
    height: task.plan.settings?.height,
    codec: task.plan.settings?.videoCodec
  });
}

class ExportRecoveryFailure extends Error {
  constructor(message: string, readonly recoveryEntries: ExportRecoveryLogEntry[]) {
    super(message);
    this.name = 'ExportRecoveryFailure';
  }
}

function isExportRecoveryFailure(error: unknown): error is ExportRecoveryFailure {
  return error instanceof ExportRecoveryFailure;
}

async function runRecoverableLocalExportTask(task: ExportTask, onRecoveryEntries: (entries: ExportRecoveryLogEntry[]) => void): Promise<Awaited<ReturnType<typeof runExport>>> {
  let currentPlan: FfmpegExportPlan = task.plan;
  let recoveryEntries: ExportRecoveryLogEntry[] = [];
  while (true) {
    try {
      const result = await runLocalExportTask(task, currentPlan);
      recoveryEntries = finalizeExportRecoveryLog(recoveryEntries, 'success');
      onRecoveryEntries(recoveryEntries);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : zhCN.errors.exportFailed;
      const decision = buildExportRecoveryDecision(currentPlan, message, recoveryEntries.length);
      if (!decision.canRetry || !decision.plan) {
        const failedEntries = recoveryEntries.length > 0
          ? finalizeExportRecoveryLog(recoveryEntries, 'failed')
          : appendExportRecoveryLog(recoveryEntries, decision, message, 'failed');
        throw new ExportRecoveryFailure(message, failedEntries);
      }
      recoveryEntries = appendExportRecoveryLog(recoveryEntries, decision, message);
      onRecoveryEntries(recoveryEntries);
      currentPlan = decision.plan;
      if (decision.action === 'reduce-concurrency') {
        useExportQueueStore.getState().setMaxConcurrent(1);
        await clearMediaCache().catch(() => undefined);
      }
      useExportQueueStore.getState().updateTaskProgress(task.id, 0);
    }
  }
}

async function runLocalExportTask(task: ExportTask, plan: FfmpegExportPlan = task.plan): Promise<Awaited<ReturnType<typeof runExport>>> {
  if (!task.progressive) {
    return runExport(plan, task.id);
  }
  const latest = useExportQueueStore.getState().tasks.find((item) => item.id === task.id) ?? task;
  const progressive = latest.progressive ?? task.progressive;
  const progressivePlan = buildProgressiveExportPlan(plan, progressive.partialPath, progressive.completedDuration);
  try {
    const result = await runExport(progressivePlan, task.id);
    const afterRun = useExportQueueStore.getState().tasks.find((item) => item.id === task.id);
    if (afterRun?.status === 'running') {
      await copyFile(progressive.partialPath, task.outputPath);
      await removeFile(progressive.partialPath).catch(() => undefined);
      useExportQueueStore.getState().updateTaskProgressive(task.id, { completedDuration: plan.duration });
      return { ...result, outputPath: task.outputPath };
    }
    return result;
  } catch (error) {
    const afterError = useExportQueueStore.getState().tasks.find((item) => item.id === task.id);
    if (afterError?.status !== 'running') {
      throw error;
    }
    await removeFile(progressive.partialPath).catch(() => undefined);
    return runExport(plan, task.id);
  }
}

async function runQueueCompleteRulesIfIdle(projectName?: string): Promise<void> {
  const tasks = useExportQueueStore.getState().tasks;
  const hasOpenTasks = activeRuns.size > 0 || tasks.some((task) => task.status === 'scheduled' || task.status === 'pending' || task.status === 'running');
  const hasCompletedTasks = tasks.some((task) => task.status === 'success' || task.status === 'error');
  if (!hasOpenTasks && hasCompletedTasks) {
    await runExportRulesSafely({ type: 'queue-complete', projectName });
  }
}

async function runExportRulesSafely(event: ExportRuleEventContext): Promise<void> {
  try {
    await runConfiguredExportRules(event);
  } catch (error) {
    console.warn('Export rule execution failed', error);
  }
}

async function shouldPauseForMemory(): Promise<boolean> {
  const availableMemoryBytes = await getAvailableMemoryBytes().catch(() => EXPORT_MEMORY_PAUSE_THRESHOLD_BYTES);
  return availableMemoryBytes < EXPORT_MEMORY_PAUSE_THRESHOLD_BYTES;
}

function getProgressTaskId(progress: ExportProgressEvent): string | undefined {
  return typeof progress === 'object' && progress !== null && typeof progress.taskId === 'string' ? progress.taskId : undefined;
}

function parseRenderFarmChildTaskId(taskId: string): { parentTaskId: string; kind: 'segment'; segmentId: string } | { parentTaskId: string; kind: 'concat' } | undefined {
  const segment = taskId.match(/^(.+):(segment-\d+)$/);
  if (segment) {
    return { parentTaskId: segment[1], kind: 'segment', segmentId: segment[2] };
  }
  const concat = taskId.match(/^(.+):concat$/);
  if (concat) {
    return { parentTaskId: concat[1], kind: 'concat' };
  }
  return undefined;
}

function signalRunner(): void {
  wakeRunner?.();
  wakeRunner = undefined;
}

function waitForRunnerWake(timeoutMs?: number): Promise<void> {
  return new Promise((resolve) => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const complete = () => {
      if (wakeRunner === complete) {
        wakeRunner = undefined;
      }
      if (timeout) {
        clearTimeout(timeout);
      }
      resolve();
    };
    wakeRunner = complete;
    if (timeoutMs !== undefined) {
      timeout = setTimeout(complete, timeoutMs);
    }
  });
}

function nextRunnerDelayMs(): number {
  const nextScheduledMs = useExportQueueStore
    .getState()
    .tasks.filter((task) => task.status === 'scheduled' && task.scheduledStartAt)
    .map((task) => Date.parse(task.scheduledStartAt!))
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right)[0];
  if (!nextScheduledMs) {
    return RESOURCE_RECHECK_DELAY_MS;
  }
  return Math.max(20, Math.min(RESOURCE_RECHECK_DELAY_MS, nextScheduledMs - Date.now()));
}

function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

function getHardwareConcurrency(): number | undefined {
  return typeof navigator === 'undefined' ? undefined : navigator.hardwareConcurrency;
}

async function writeSidecarSubtitleArtifacts(outputPath: string, artifacts: TextArtifact[]): Promise<void> {
  const sidecars = artifacts.filter((artifact) => artifact.pathMode === 'sidecar');
  for (const artifact of sidecars) {
    await writeFile(buildSidecarSubtitlePath(outputPath, artifact.fileName), artifact.text);
  }
}

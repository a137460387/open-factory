import type { ExportTask } from './export-queue';
import { estimateExportResourceNeeds, type ExportResourceEstimate } from './scheduling';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ResourceSample {
  timestamp: number;
  cpuPercent: number;
  memoryUsedMb: number;
  memoryTotalMb: number;
  diskReadMbPerSec: number;
  diskWriteMbPerSec: number;
}

export interface TaskResourceEstimate {
  taskId: string;
  taskName: string;
  cpuCost: number;
  memoryMb: number;
  memoryClass: 'light' | 'balanced' | 'heavy';
  parallelEligible: boolean;
}

export interface OverloadStatus {
  overloaded: boolean;
  runningCount: number;
  recommendedMax: number;
  cpuCores: number;
  overloadCoefficient: number;
}

export interface ExportResourceSnapshot {
  exportId: string;
  startedAt: number;
  finishedAt: number;
  samples: ResourceSample[];
  taskNames: string[];
}

export interface ResourceDashboardState {
  rollingWindow: ResourceSample[];
  exportHistory: ExportResourceSnapshot[];
  currentEstimates: TaskResourceEstimate[];
  overloadStatus: OverloadStatus;
  enabled: boolean;
}

// ── Constants ──────────────────────────────────────────────────────────────

export const ROLLING_WINDOW_DURATION_MS = 60_000;
export const MAX_EXPORT_HISTORY_COUNT = 5;
export const DEFAULT_OVERLOAD_COEFFICIENT = 1.2;
export const MAX_OVERLOAD_COEFFICIENT = 3;
export const MIN_OVERLOAD_COEFFICIENT = 0.5;

// ── Rolling Window ─────────────────────────────────────────────────────────

export function createEmptyDashboardState(): ResourceDashboardState {
  return {
    rollingWindow: [],
    exportHistory: [],
    currentEstimates: [],
    overloadStatus: {
      overloaded: false,
      runningCount: 0,
      recommendedMax: 0,
      cpuCores: 0,
      overloadCoefficient: DEFAULT_OVERLOAD_COEFFICIENT,
    },
    enabled: false,
  };
}

export function appendResourceSample(
  samples: ResourceSample[],
  sample: ResourceSample,
  nowMs: number,
  windowDurationMs = ROLLING_WINDOW_DURATION_MS,
): ResourceSample[] {
  const cutoff = nowMs - windowDurationMs;
  const filtered = samples.filter((s) => s.timestamp >= cutoff);
  return [...filtered, sample];
}

// ── Overload Detection ─────────────────────────────────────────────────────

export function calculateOverloadStatus(
  runningTaskCount: number,
  cpuCores: number,
  coefficient = DEFAULT_OVERLOAD_COEFFICIENT,
): OverloadStatus {
  const clampedCoefficient = clampCoefficient(coefficient);
  const cores = Math.max(1, Math.floor(cpuCores));
  const recommendedMax = Math.max(1, Math.round(cores * clampedCoefficient));
  return {
    overloaded: runningTaskCount > recommendedMax,
    runningCount: runningTaskCount,
    recommendedMax,
    cpuCores: cores,
    overloadCoefficient: clampedCoefficient,
  };
}

export function isOverloaded(
  runningTaskCount: number,
  cpuCores: number,
  coefficient = DEFAULT_OVERLOAD_COEFFICIENT,
): boolean {
  return calculateOverloadStatus(runningTaskCount, cpuCores, coefficient).overloaded;
}

export function clampCoefficient(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_OVERLOAD_COEFFICIENT;
  }
  return Math.min(MAX_OVERLOAD_COEFFICIENT, Math.max(MIN_OVERLOAD_COEFFICIENT, value));
}

// ── Per-Task Resource Estimation ───────────────────────────────────────────

export function estimateTaskResourceUsage(tasks: ExportTask[]): TaskResourceEstimate[] {
  return tasks
    .filter((task) => task.status === 'pending' || task.status === 'running' || task.status === 'scheduled')
    .map((task) => {
      const estimate: ExportResourceEstimate = estimateExportResourceNeeds(task.plan);
      return {
        taskId: task.id,
        taskName: task.name,
        cpuCost: estimate.cpuCost,
        memoryMb: estimate.memoryMb,
        memoryClass: estimate.memoryClass,
        parallelEligible: estimate.parallelEligible,
      };
    });
}

export function estimateSingleTaskCpuPercent(task: ExportTask, cpuCores: number): number {
  const estimate = estimateExportResourceNeeds(task.plan);
  const cores = Math.max(1, cpuCores);
  const rawPercent = (estimate.cpuCost / cores) * 100;
  return Math.min(100, Math.max(1, Math.round(rawPercent)));
}

// ── Export History Recording ────────────────────────────────────────────────

export function startExportRecording(
  snapshots: ExportResourceSnapshot[],
  exportId: string,
  taskNames: string[],
  nowMs: number,
): ExportResourceSnapshot[] {
  if (snapshots.length >= MAX_EXPORT_HISTORY_COUNT) {
    const trimmed = snapshots.slice(snapshots.length - MAX_EXPORT_HISTORY_COUNT + 1);
    return [...trimmed, { exportId, startedAt: nowMs, finishedAt: nowMs, samples: [], taskNames }];
  }
  return [...snapshots, { exportId, startedAt: nowMs, finishedAt: nowMs, samples: [], taskNames }];
}

export function appendExportSample(
  snapshots: ExportResourceSnapshot[],
  exportId: string,
  sample: ResourceSample,
): ExportResourceSnapshot[] {
  return snapshots.map((snapshot) => {
    if (snapshot.exportId !== exportId) {
      return snapshot;
    }
    return {
      ...snapshot,
      samples: [...snapshot.samples, sample],
      finishedAt: Math.max(snapshot.finishedAt, sample.timestamp),
    };
  });
}

export function finishExportRecording(
  snapshots: ExportResourceSnapshot[],
  exportId: string,
  nowMs: number,
): ExportResourceSnapshot[] {
  return snapshots.map((snapshot) => (snapshot.exportId === exportId ? { ...snapshot, finishedAt: nowMs } : snapshot));
}

export function trimExportHistory(snapshots: ExportResourceSnapshot[]): ExportResourceSnapshot[] {
  if (snapshots.length <= MAX_EXPORT_HISTORY_COUNT) {
    return snapshots;
  }
  return snapshots.slice(snapshots.length - MAX_EXPORT_HISTORY_COUNT);
}

// ── Resource Curve Extraction (for history playback) ───────────────────────

export interface ResourceCurvePoint {
  timestamp: number;
  cpuPercent: number;
  memoryUsedMb: number;
  diskReadMbPerSec: number;
  diskWriteMbPerSec: number;
  elapsedSeconds: number;
}

export function extractExportCurve(snapshot: ExportResourceSnapshot): ResourceCurvePoint[] {
  if (snapshot.samples.length === 0) {
    return [];
  }
  const startMs = snapshot.startedAt;
  return snapshot.samples.map((sample) => ({
    timestamp: sample.timestamp,
    cpuPercent: sample.cpuPercent,
    memoryUsedMb: sample.memoryUsedMb,
    diskReadMbPerSec: sample.diskReadMbPerSec,
    diskWriteMbPerSec: sample.diskWriteMbPerSec,
    elapsedSeconds: Math.round(((sample.timestamp - startMs) / 1000) * 10) / 10,
  }));
}

export function normalizeExportHistory(snapshots: ExportResourceSnapshot[]): ExportResourceSnapshot[] {
  return trimExportHistory(snapshots);
}

export function normalizeOverloadCoefficient(value: number | undefined): number {
  return clampCoefficient(value ?? DEFAULT_OVERLOAD_COEFFICIENT);
}

import { estimateExportResourceNeeds } from './scheduling';
// ── Constants ──────────────────────────────────────────────────────────────
export const ROLLING_WINDOW_DURATION_MS = 60_000;
export const MAX_EXPORT_HISTORY_COUNT = 5;
export const DEFAULT_OVERLOAD_COEFFICIENT = 1.2;
export const MAX_OVERLOAD_COEFFICIENT = 3;
export const MIN_OVERLOAD_COEFFICIENT = 0.5;
// ── Rolling Window ─────────────────────────────────────────────────────────
export function createEmptyDashboardState() {
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
export function appendResourceSample(samples, sample, nowMs, windowDurationMs = ROLLING_WINDOW_DURATION_MS) {
    const cutoff = nowMs - windowDurationMs;
    const filtered = samples.filter((s) => s.timestamp >= cutoff);
    return [...filtered, sample];
}
// ── Overload Detection ─────────────────────────────────────────────────────
export function calculateOverloadStatus(runningTaskCount, cpuCores, coefficient = DEFAULT_OVERLOAD_COEFFICIENT) {
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
export function isOverloaded(runningTaskCount, cpuCores, coefficient = DEFAULT_OVERLOAD_COEFFICIENT) {
    return calculateOverloadStatus(runningTaskCount, cpuCores, coefficient).overloaded;
}
export function clampCoefficient(value) {
    if (!Number.isFinite(value)) {
        return DEFAULT_OVERLOAD_COEFFICIENT;
    }
    return Math.min(MAX_OVERLOAD_COEFFICIENT, Math.max(MIN_OVERLOAD_COEFFICIENT, value));
}
// ── Per-Task Resource Estimation ───────────────────────────────────────────
export function estimateTaskResourceUsage(tasks) {
    return tasks
        .filter((task) => task.status === 'pending' || task.status === 'running' || task.status === 'scheduled')
        .map((task) => {
        const estimate = estimateExportResourceNeeds(task.plan);
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
export function estimateSingleTaskCpuPercent(task, cpuCores) {
    const estimate = estimateExportResourceNeeds(task.plan);
    const cores = Math.max(1, cpuCores);
    const rawPercent = (estimate.cpuCost / cores) * 100;
    return Math.min(100, Math.max(1, Math.round(rawPercent)));
}
// ── Export History Recording ────────────────────────────────────────────────
export function startExportRecording(snapshots, exportId, taskNames, nowMs) {
    if (snapshots.length >= MAX_EXPORT_HISTORY_COUNT) {
        const trimmed = snapshots.slice(snapshots.length - MAX_EXPORT_HISTORY_COUNT + 1);
        return [...trimmed, { exportId, startedAt: nowMs, finishedAt: nowMs, samples: [], taskNames }];
    }
    return [...snapshots, { exportId, startedAt: nowMs, finishedAt: nowMs, samples: [], taskNames }];
}
export function appendExportSample(snapshots, exportId, sample) {
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
export function finishExportRecording(snapshots, exportId, nowMs) {
    return snapshots.map((snapshot) => (snapshot.exportId === exportId ? { ...snapshot, finishedAt: nowMs } : snapshot));
}
export function trimExportHistory(snapshots) {
    if (snapshots.length <= MAX_EXPORT_HISTORY_COUNT) {
        return snapshots;
    }
    return snapshots.slice(snapshots.length - MAX_EXPORT_HISTORY_COUNT);
}
export function extractExportCurve(snapshot) {
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
export function normalizeExportHistory(snapshots) {
    return trimExportHistory(snapshots);
}
export function normalizeOverloadCoefficient(value) {
    return clampCoefficient(value ?? DEFAULT_OVERLOAD_COEFFICIENT);
}
//# sourceMappingURL=resource-dashboard.js.map
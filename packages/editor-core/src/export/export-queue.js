import { createId } from '../model';
import { calculateRenderFarmProgress } from './render-farm';
import { startResourceAwareExportTaskSlots } from './scheduling';
export function createExportTask(input) {
    const now = input.now ?? new Date().toISOString();
    const scheduledStartAt = normalizeScheduledStartAt(input.scheduledStartAt, now);
    const versionedBatch = normalizeVersionedExportTaskMetadata(input.versionedBatch);
    return {
        id: input.id ?? createId('export-task'),
        name: input.name,
        projectName: typeof input.projectName === 'string' && input.projectName.trim() ? input.projectName.trim() : undefined,
        outputPath: input.outputPath,
        plan: input.plan,
        priority: normalizeExportTaskPriority(input.priority),
        renderFarm: normalizeRenderFarmTaskConfig(input.renderFarm),
        progressive: normalizeProgressiveExportState(input.progressive),
        ...(versionedBatch ? { versionedBatch } : {}),
        status: scheduledStartAt ? 'scheduled' : 'pending',
        progress: 0,
        createdAt: now,
        scheduledStartAt,
    };
}
export function startNextExportTask(tasks, now = new Date().toISOString()) {
    return startExportTaskSlots(tasks, 1, now);
}
export function clampExportConcurrency(value) {
    if (!Number.isFinite(value)) {
        return 2;
    }
    return Math.min(4, Math.max(1, Math.round(value)));
}
export function startExportTaskSlots(tasks, maxConcurrent = 2, now = new Date().toISOString()) {
    return startResourceAwareExportTaskSlots(tasks, clampExportConcurrency(maxConcurrent), now);
}
function normalizeVersionedExportTaskMetadata(metadata) {
    if (!metadata?.batchId?.trim() || !metadata.versionId?.trim() || !metadata.versionName?.trim()) {
        return undefined;
    }
    return {
        batchId: metadata.batchId.trim(),
        versionId: metadata.versionId.trim(),
        versionName: metadata.versionName.trim(),
        ...(metadata.platform?.trim() ? { platform: metadata.platform.trim() } : {}),
        ...(metadata.language?.trim() ? { language: metadata.language.trim() } : {}),
    };
}
export function activateScheduledExportTasks(tasks, now = new Date().toISOString()) {
    const nowMs = Date.parse(now);
    if (!Number.isFinite(nowMs)) {
        return tasks;
    }
    return tasks.map((task) => {
        if (task.status !== 'scheduled' || !task.scheduledStartAt) {
            return task;
        }
        const scheduledMs = Date.parse(task.scheduledStartAt);
        return Number.isFinite(scheduledMs) && scheduledMs <= nowMs ? { ...task, status: 'pending' } : task;
    });
}
export function updateExportTaskProgress(tasks, taskId, progress) {
    return tasks.map((task) => (task.id === taskId ? { ...task, progress: Math.min(1, Math.max(0, progress)) } : task));
}
export function updateExportTaskProgressive(tasks, taskId, patch) {
    return tasks.map((task) => {
        if (task.id !== taskId || !task.progressive) {
            return task;
        }
        return {
            ...task,
            progressive: normalizeProgressiveExportState({ ...task.progressive, ...patch }),
        };
    });
}
export function setExportTaskSegments(tasks, taskId, segments) {
    return tasks.map((task) => task.id === taskId ? { ...task, segments, progress: calculateRenderFarmProgress(segments) } : task);
}
export function updateExportTaskSegment(tasks, taskId, segmentId, patch) {
    return tasks.map((task) => {
        if (task.id !== taskId || !task.segments) {
            return task;
        }
        const segments = task.segments.map((segment) => (segment.id === segmentId ? { ...segment, ...patch } : segment));
        return { ...task, segments, progress: calculateRenderFarmProgress(segments) };
    });
}
export function finishExportTask(tasks, taskId, report, now = new Date().toISOString()) {
    return tasks.map((task) => task.id === taskId ? { ...task, status: 'success', progress: 1, report, finishedAt: now } : task);
}
export function failExportTask(tasks, taskId, error, now = new Date().toISOString(), report) {
    return tasks.map((task) => task.id === taskId ? { ...task, status: 'error', error, report, finishedAt: now } : task);
}
export function cancelExportTask(tasks, taskId, now = new Date().toISOString()) {
    return tasks.map((task) => task.id === taskId &&
        (task.status === 'scheduled' ||
            task.status === 'pending' ||
            task.status === 'running' ||
            task.status === 'interrupted')
        ? { ...task, status: 'canceled', finishedAt: now }
        : task);
}
export function interruptExportTask(tasks, taskId, error, now = new Date().toISOString()) {
    return tasks.map((task) => task.id === taskId && task.status === 'running'
        ? {
            ...task,
            status: 'interrupted',
            error,
            finishedAt: now,
        }
        : task);
}
export function setExportTaskLogPath(tasks, taskId, logPath) {
    return tasks.map((task) => (task.id === taskId ? { ...task, logPath } : task));
}
export function sortExportQueueByPriority(tasks) {
    return tasks
        .map((task, index) => ({ task, index }))
        .sort((left, right) => {
        if (left.task.status === 'pending' && right.task.status === 'pending') {
            return comparePendingExportTasks(left, right);
        }
        return left.index - right.index;
    })
        .map(({ task }) => task);
}
export function createExportTaskHistoryEntry(task) {
    if (task.status !== 'success' && task.status !== 'error') {
        return undefined;
    }
    const sourcePath = task.plan.inputs.find((input) => input.path.trim())?.path;
    return {
        id: task.id,
        name: task.name,
        outputPath: task.outputPath,
        ...(sourcePath ? { sourcePath } : {}),
        status: task.status,
        priority: task.priority,
        createdAt: task.createdAt,
        startedAt: task.startedAt,
        finishedAt: task.finishedAt ?? new Date().toISOString(),
        logPath: task.logPath,
        error: task.error,
        ...(task.report ? { report: task.report } : {}),
    };
}
export function updateExportTaskHistoryUpload(history, entryId, patch, now = new Date().toISOString()) {
    return history.map((entry) => {
        if (entry.id !== entryId) {
            return entry;
        }
        const previous = entry.upload;
        const startingAttempt = patch.status === 'running' && previous?.status !== 'running';
        const progress = patch.progress ?? defaultUploadProgress(patch.status);
        const nextUpload = {
            targetType: patch.targetType,
            status: patch.status,
            progress: Math.min(1, Math.max(0, progress)),
            attempts: startingAttempt
                ? (previous?.attempts ?? 0) + 1
                : (previous?.attempts ?? (patch.status === 'running' ? 1 : 0)),
            updatedAt: now,
            ...(patch.destination
                ? { destination: patch.destination }
                : previous?.destination
                    ? { destination: previous.destination }
                    : {}),
            ...(patch.error ? { error: patch.error } : {}),
        };
        return { ...entry, upload: nextUpload };
    });
}
export function normalizeExportTaskPriority(priority) {
    return priority === 'high' || priority === 'low' ? priority : 'normal';
}
export function normalizeRenderFarmTaskConfig(config) {
    if (!config?.enabled) {
        return undefined;
    }
    return {
        enabled: true,
        maxInstances: Math.min(4, Math.max(1, Math.round(Number.isFinite(config.maxInstances) ? config.maxInstances : 1))),
    };
}
export function normalizeProgressiveExportState(state) {
    if (!state?.enabled || !state.supported || !state.partialPath.trim()) {
        return undefined;
    }
    return {
        enabled: true,
        supported: true,
        partialPath: state.partialPath,
        completedDuration: Math.max(0, Number.isFinite(state.completedDuration) ? Math.round(state.completedDuration * 1000) / 1000 : 0),
        ...(state.fallbackReason ? { fallbackReason: state.fallbackReason } : {}),
    };
}
function comparePendingExportTasks(left, right) {
    const priorityDelta = priorityWeight(right.task.priority) - priorityWeight(left.task.priority);
    if (priorityDelta !== 0) {
        return priorityDelta;
    }
    const createdDelta = left.task.createdAt.localeCompare(right.task.createdAt);
    return createdDelta || left.index - right.index;
}
function priorityWeight(priority) {
    return priority === 'high' ? 2 : priority === 'normal' ? 1 : 0;
}
function defaultUploadProgress(status) {
    if (status === 'success' || status === 'error') {
        return 1;
    }
    if (status === 'running') {
        return 0.25;
    }
    return 0;
}
function normalizeScheduledStartAt(value, now) {
    if (typeof value !== 'string' || !value.trim()) {
        return undefined;
    }
    const scheduledMs = Date.parse(value);
    const nowMs = Date.parse(now);
    if (!Number.isFinite(scheduledMs) || !Number.isFinite(nowMs) || scheduledMs <= nowMs) {
        return undefined;
    }
    return new Date(scheduledMs).toISOString();
}
//# sourceMappingURL=export-queue.js.map
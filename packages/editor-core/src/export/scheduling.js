const HD_PIXELS = 1920 * 1080;
const HEAVY_MEMORY_MB = 2200;
const BALANCED_MEMORY_MB = 1200;
const DEFAULT_PARALLEL_MEMORY_LIMIT_MB = 3600;
const FILTER_PATTERNS = [
    /\bscale\b/g,
    /\boverlay\b/g,
    /\bdrawtext\b/g,
    /\bminterpolate\b/g,
    /\blend=|blend=/g,
    /\blut3d\b/g,
    /\bcurves\b/g,
    /\beq=/g,
    /\bunsharp\b/g,
    /\bdeblock\b/g,
    /\barnndn\b/g,
    /\bhqdn3d\b/g,
    /\bcolorlevels\b/g,
    /\bchromakey\b/g,
    /\bmask/g,
    /\bperspective\b/g,
    /\brotate\b/g,
    /\bzoompan\b/g,
    /\bcrop\b/g,
    /\bpad\b/g,
];
export function estimateExportResourceNeeds(plan) {
    const width = clampPositive(plan.settings?.width, 1920);
    const height = clampPositive(plan.settings?.height, 1080);
    const fps = clampPositive(plan.settings?.fps, 30);
    const duration = Math.max(1, clampPositive(plan.duration, 1));
    const resolutionFactor = Math.max(0.25, (width * height) / HD_PIXELS);
    const outputArgs = plan.outputArgs ?? [];
    const fullArgs = plan.fullArgs ?? [];
    const inputs = plan.inputs ?? [];
    const textArtifacts = plan.textArtifacts ?? [];
    const nestedPlans = plan.nestedPlans ?? [];
    const filterText = [plan.filterComplex ?? '', ...outputArgs, ...fullArgs].join(' ');
    const effectCount = countFilterEffects(filterText);
    const nestedEstimate = nestedPlans.reduce((total, nested) => {
        const estimate = estimateExportResourceNeeds(nested.plan);
        total.memoryMb += estimate.memoryMb * 0.35;
        total.cpuCost += estimate.cpuCost * 0.25;
        total.effectCount += estimate.effectCount;
        return total;
    }, { memoryMb: 0, cpuCost: 0, effectCount: 0 });
    const minterpolateCost = /\bminterpolate\b/.test(filterText) ? 850 : 0;
    const heavyTemporalCost = /\b(minterpolate|tblend|mpdecimate)\b/.test(filterText) ? 0.75 : 0;
    const memoryMb = Math.round(320 +
        resolutionFactor * 360 +
        inputs.length * 96 +
        effectCount * 150 +
        textArtifacts.length * 32 +
        minterpolateCost +
        nestedEstimate.memoryMb);
    const cpuCost = roundTwo(1 + resolutionFactor * 0.8 + (fps / 30 - 1) * 0.3 + effectCount * 0.22 + heavyTemporalCost + nestedEstimate.cpuCost);
    const diskMb = Math.round((duration * width * height * fps) / 90_000_000);
    const memoryClass = memoryMb >= HEAVY_MEMORY_MB || effectCount >= 10 || minterpolateCost > 0
        ? 'heavy'
        : memoryMb >= BALANCED_MEMORY_MB || effectCount >= 5
            ? 'balanced'
            : 'light';
    const reasons = [];
    if (effectCount > 0) {
        reasons.push(`effects:${effectCount}`);
    }
    if (resolutionFactor > 1.1) {
        reasons.push(`resolution:${width}x${height}`);
    }
    if (minterpolateCost > 0) {
        reasons.push('temporal-filter:minterpolate');
    }
    if (inputs.length > 2) {
        reasons.push(`inputs:${inputs.length}`);
    }
    return {
        cpuCost,
        memoryMb,
        diskMb,
        effectCount,
        memoryClass,
        parallelEligible: memoryClass !== 'heavy',
        reasons,
    };
}
export function isExportPlanParallelEligible(plan) {
    return estimateExportResourceNeeds(plan).parallelEligible;
}
export function canRunExportTasksInParallel(left, right, memoryLimitMb = DEFAULT_PARALLEL_MEMORY_LIMIT_MB) {
    const leftEstimate = estimateExportResourceNeeds(getPlan(left));
    const rightEstimate = estimateExportResourceNeeds(getPlan(right));
    return (leftEstimate.parallelEligible &&
        rightEstimate.parallelEligible &&
        leftEstimate.memoryMb + rightEstimate.memoryMb <= memoryLimitMb);
}
export function startResourceAwareExportTaskSlots(tasks, maxConcurrent = 2, now = new Date().toISOString()) {
    const limit = Math.min(4, Math.max(1, Math.round(Number.isFinite(maxConcurrent) ? maxConcurrent : 2)));
    const running = tasks.filter((task) => task.status === 'running');
    let availableSlots = Math.max(0, limit - running.length);
    if (availableSlots === 0) {
        return tasks;
    }
    const selected = [];
    const pending = tasks
        .map((task, index) => ({ task, index }))
        .filter(({ task }) => task.status === 'pending')
        .sort(comparePendingExportTasksForScheduling);
    for (const { task } of pending) {
        if (availableSlots <= 0) {
            break;
        }
        const peers = [...running, ...selected];
        const canStart = peers.length === 0 || peers.every((peer) => canRunExportTasksInParallel(peer, task));
        if (!canStart) {
            continue;
        }
        selected.push(task);
        availableSlots -= 1;
        if (!isExportPlanParallelEligible(task.plan)) {
            break;
        }
    }
    if (selected.length === 0) {
        return tasks;
    }
    const startIds = new Set(selected.map((task) => task.id));
    return tasks.map((task) => (startIds.has(task.id) ? { ...task, status: 'running', startedAt: now } : task));
}
export function detectSharedDecodeCacheHits(tasks) {
    const groups = new Map();
    for (const task of tasks) {
        const key = buildSharedDecodeCacheKey(task.plan);
        if (!key) {
            continue;
        }
        const range = getPlanRange(task.plan);
        const inputPaths = normalizeInputPaths(task.plan);
        const group = groups.get(key);
        if (group) {
            group.taskIds.push(task.id);
        }
        else {
            groups.set(key, {
                taskIds: [task.id],
                inputPaths,
                startSeconds: range.startSeconds,
                durationSeconds: range.durationSeconds,
            });
        }
    }
    return Array.from(groups.entries())
        .filter(([, group]) => group.taskIds.length > 1)
        .map(([cacheKey, group]) => ({ cacheKey, ...group }));
}
export function buildSharedDecodeCacheKey(plan) {
    const inputPaths = normalizeInputPaths(plan);
    if (inputPaths.length === 0) {
        return undefined;
    }
    const range = getPlanRange(plan);
    return `${inputPaths.join('|')}::${range.startSeconds.toFixed(3)}::${range.durationSeconds.toFixed(3)}`;
}
export function calculateLowPowerThreadCount(hardwareConcurrency) {
    const cores = Number.isFinite(hardwareConcurrency) && hardwareConcurrency && hardwareConcurrency > 0
        ? Math.floor(hardwareConcurrency)
        : 2;
    return Math.max(1, Math.floor(cores / 2));
}
export function applyLowPowerThreads(plan, enabled, hardwareConcurrency) {
    if (!enabled) {
        return plan;
    }
    const threadCount = String(calculateLowPowerThreadCount(hardwareConcurrency));
    return {
        ...plan,
        outputArgs: insertThreadArgs(plan.outputArgs ?? [], threadCount),
        fullArgs: insertThreadArgs(plan.fullArgs ?? [], threadCount),
        passes: plan.passes?.map((pass) => ({ ...pass, fullArgs: insertThreadArgs(pass.fullArgs, threadCount) })),
        nestedPlans: (plan.nestedPlans ?? []).map((nested) => ({
            ...nested,
            plan: applyLowPowerThreads(nested.plan, enabled, hardwareConcurrency),
        })),
    };
}
function countFilterEffects(filterText) {
    return FILTER_PATTERNS.reduce((count, pattern) => count + (filterText.match(pattern)?.length ?? 0), 0);
}
function getPlan(input) {
    return 'plan' in input ? input.plan : input;
}
function normalizeInputPaths(plan) {
    return (plan.inputs ?? [])
        .map((input) => input.path.trim().replace(/\\/g, '/').toLowerCase())
        .filter(Boolean)
        .sort();
}
function getPlanRange(plan) {
    const start = findNumericArg(plan.outputArgs ?? [], '-ss') ?? findNumericArg(plan.fullArgs ?? [], '-ss') ?? 0;
    const duration = findNumericArg(plan.outputArgs ?? [], '-t') ?? findNumericArg(plan.fullArgs ?? [], '-t') ?? plan.duration;
    return {
        startSeconds: roundThree(Math.max(0, start)),
        durationSeconds: roundThree(Math.max(0, duration)),
    };
}
function findNumericArg(args, key) {
    const index = args.lastIndexOf(key);
    if (index < 0 || index + 1 >= args.length) {
        return undefined;
    }
    const value = Number(args[index + 1]);
    return Number.isFinite(value) ? value : undefined;
}
function insertThreadArgs(args, threadCount) {
    const withoutExisting = removeThreadArgs(args);
    const insertAt = Math.max(0, withoutExisting.length - 1);
    return [...withoutExisting.slice(0, insertAt), '-threads', threadCount, ...withoutExisting.slice(insertAt)];
}
function removeThreadArgs(args) {
    const next = [];
    for (let index = 0; index < args.length; index += 1) {
        if (args[index] === '-threads') {
            index += 1;
            continue;
        }
        next.push(args[index]);
    }
    return next;
}
function clampPositive(value, fallback) {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}
function roundTwo(value) {
    return Math.round(value * 100) / 100;
}
function roundThree(value) {
    return Math.round(value * 1000) / 1000;
}
function comparePendingExportTasksForScheduling(left, right) {
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
//# sourceMappingURL=scheduling.js.map
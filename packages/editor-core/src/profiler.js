export const DEFAULT_PROFILER_MEMORY_SAMPLE_INTERVAL_MS = 1000;
export const PROFILER_TOP_FRAME_COUNT = 3;
const PASS_KEYS = [
    { name: 'composite', key: 'compositeMs' },
    { name: 'color', key: 'colorMs' },
    { name: 'effects', key: 'effectsMs' },
    { name: 'overlay', key: 'overlayMs' },
];
export function normalizeRenderPassBreakdown(input) {
    const compositeMs = clampMs(input.compositeMs);
    const colorMs = clampMs(input.colorMs);
    const effectsMs = clampMs(input.effectsMs);
    const overlayMs = clampMs(input.overlayMs);
    const summed = compositeMs + colorMs + effectsMs + overlayMs;
    const totalMs = clampMs(input.totalMs);
    if (totalMs <= 0 || Math.abs(summed - totalMs) < 0.01) {
        return {
            compositeMs: roundProfilerNumber(compositeMs),
            colorMs: roundProfilerNumber(colorMs),
            effectsMs: roundProfilerNumber(effectsMs),
            overlayMs: roundProfilerNumber(overlayMs),
            totalMs: roundProfilerNumber(totalMs > 0 ? totalMs : summed),
        };
    }
    const scale = totalMs / Math.max(0.001, summed);
    return {
        compositeMs: roundProfilerNumber(compositeMs * scale),
        colorMs: roundProfilerNumber(colorMs * scale),
        effectsMs: roundProfilerNumber(effectsMs * scale),
        overlayMs: roundProfilerNumber(overlayMs * scale),
        totalMs: roundProfilerNumber(totalMs),
    };
}
export function estimateRenderPassBreakdown(input) {
    const totalMs = clampMs(input.totalMs);
    const drawCalls = Math.max(0, Math.round(Number.isFinite(input.drawCalls ?? 0) ? (input.drawCalls ?? 0) : 0));
    const effectCount = Math.max(0, Math.round(Number.isFinite(input.effectCount ?? 0) ? (input.effectCount ?? 0) : 0));
    const overlayWeight = input.overlayActive ? 0.16 : 0.08;
    const effectsWeight = Math.min(0.42, 0.18 + effectCount * 0.04);
    const colorWeight = Math.min(0.34, 0.22 + Math.min(0.08, drawCalls * 0.005));
    const compositeWeight = Math.max(0.12, 1 - overlayWeight - effectsWeight - colorWeight);
    const weightTotal = compositeWeight + colorWeight + effectsWeight + overlayWeight;
    return normalizeRenderPassBreakdown({
        compositeMs: totalMs * (compositeWeight / weightTotal),
        colorMs: totalMs * (colorWeight / weightTotal),
        effectsMs: totalMs * (effectsWeight / weightTotal),
        overlayMs: totalMs * (overlayWeight / weightTotal),
        totalMs,
    });
}
export function findSlowestProfilerFrames(frames, limit = PROFILER_TOP_FRAME_COUNT) {
    return [...frames]
        .sort((left, right) => right.render.totalMs - left.render.totalMs || left.frameIndex - right.frameIndex)
        .slice(0, Math.max(0, Math.round(limit)))
        .map((frame) => {
        const slowestPass = getSlowestRenderPass(frame.render);
        return {
            frameIndex: frame.frameIndex,
            totalMs: roundProfilerNumber(frame.render.totalMs),
            slowestPass,
            reason: frame.reason ||
                `${slowestPass}耗时${roundProfilerNumber(frame.render[passKeyForName(slowestPass)]).toFixed(1)}ms`,
        };
    });
}
export function shouldSampleProfilerMemory(previousTimestampMs, nextTimestampMs, intervalMs = DEFAULT_PROFILER_MEMORY_SAMPLE_INTERVAL_MS) {
    if (!Number.isFinite(nextTimestampMs)) {
        return false;
    }
    if (previousTimestampMs === undefined || !Number.isFinite(previousTimestampMs)) {
        return true;
    }
    return nextTimestampMs - previousTimestampMs >= Math.max(0, intervalMs);
}
export function appendProfilerMemorySample(samples, sample, minIntervalMs = DEFAULT_PROFILER_MEMORY_SAMPLE_INTERVAL_MS) {
    const previous = samples.at(-1)?.timestampMs;
    if (!shouldSampleProfilerMemory(previous, sample.timestampMs, minIntervalMs)) {
        return samples;
    }
    return [
        ...samples,
        {
            timestampMs: clampMs(sample.timestampMs),
            jsHeapBytes: clampBytes(sample.jsHeapBytes),
            webglTextureBytes: clampBytes(sample.webglTextureBytes),
            proxyCacheBytes: clampBytes(sample.proxyCacheBytes),
            undoHistoryBytes: clampBytes(sample.undoHistoryBytes),
        },
    ];
}
export function calculateProfilerFlamegraphNodes(events, options = {}) {
    const width = Math.max(1, Number.isFinite(options.width ?? 0) ? (options.width ?? 1) : 1);
    const rowHeight = Math.max(1, Number.isFinite(options.rowHeight ?? 0) ? (options.rowHeight ?? 18) : 18);
    const startMs = Number.isFinite(options.startMs ?? NaN)
        ? (options.startMs ?? 0)
        : Math.min(0, ...events.map((event) => event.startMs));
    const endMs = Number.isFinite(options.endMs ?? NaN)
        ? (options.endMs ?? startMs + 1)
        : Math.max(startMs + 1, ...events.map((event) => event.startMs + Math.max(0, event.durationMs)));
    const spanMs = Math.max(1, endMs - startMs);
    return events
        .filter((event) => event.durationMs > 0)
        .map((event) => {
        const x = ((event.startMs - startMs) / spanMs) * width;
        const nodeWidth = (event.durationMs / spanMs) * width;
        return {
            ...event,
            startMs: roundProfilerNumber(event.startMs),
            durationMs: roundProfilerNumber(event.durationMs),
            depth: Math.max(0, Math.round(event.depth)),
            x: roundProfilerNumber(Math.max(0, Math.min(width, x))),
            y: roundProfilerNumber(Math.max(0, Math.round(event.depth)) * rowHeight),
            width: roundProfilerNumber(Math.max(1, Math.min(width, nodeWidth))),
            height: rowHeight,
        };
    });
}
export function analyzeExportSpeed(input) {
    const expectedFps = Math.max(1, Number.isFinite(input.expectedFps) ? input.expectedFps : 30);
    const elapsedSeconds = Math.max(0.001, input.elapsedMs / 1000);
    const renderedSeconds = Math.max(0, input.durationSeconds) * Math.max(0, input.progressDelta);
    const actualFps = (renderedSeconds * expectedFps) / elapsedSeconds;
    let bottleneck = 'unknown';
    if ((input.queueDepth ?? 0) > 2) {
        bottleneck = 'queue';
    }
    else if ((input.availableMemoryBytes ?? Number.POSITIVE_INFINITY) < 512 * 1024 * 1024) {
        bottleneck = 'memory';
    }
    else if (actualFps < expectedFps * 0.45) {
        bottleneck = input.hardwareEncoding ? 'gpu' : 'cpu';
    }
    else if (actualFps < expectedFps * 0.75) {
        bottleneck = 'io';
    }
    return {
        expectedFps: roundProfilerNumber(expectedFps),
        actualFps: roundProfilerNumber(actualFps),
        bottleneck,
    };
}
export function buildPerformanceProfilerReport(input) {
    const stoppedAtMs = Math.max(input.startedAtMs, input.stoppedAtMs);
    const durationMs = stoppedAtMs - input.startedAtMs;
    const slowestFrames = findSlowestProfilerFrames(input.frames);
    const frameTotal = input.frames.reduce((sum, frame) => sum + frame.render.totalMs, 0);
    const peakMemoryBytes = Math.max(0, ...input.memory.map((sample) => sample.jsHeapBytes + sample.webglTextureBytes + sample.proxyCacheBytes + sample.undoHistoryBytes));
    const peakQueueDepth = Math.max(0, ...input.queues.map((sample) => sample.exportPending + sample.exportRunning + sample.mediaPending + sample.mediaRunning));
    return {
        schemaVersion: 1,
        generatedAt: input.generatedAt ?? new Date().toISOString(),
        recording: {
            startedAtMs: roundProfilerNumber(input.startedAtMs),
            stoppedAtMs: roundProfilerNumber(stoppedAtMs),
            durationMs: roundProfilerNumber(durationMs),
        },
        summary: {
            frameCount: input.frames.length,
            averageFrameMs: roundProfilerNumber(input.frames.length > 0 ? frameTotal / input.frames.length : 0),
            slowestFrames,
            exportBottlenecks: uniqueBottlenecks(input.exportSpeed.map((sample) => sample.bottleneck)),
            peakMemoryBytes,
            peakQueueDepth,
        },
        frames: input.frames,
        exportSpeed: input.exportSpeed,
        memory: input.memory,
        queues: input.queues,
        flamegraph: calculateProfilerFlamegraphNodes(input.traceEvents, {
            startMs: input.startedAtMs,
            endMs: stoppedAtMs,
            width: 1000,
            rowHeight: 18,
        }),
    };
}
export function isPerformanceProfilerReport(value) {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const report = value;
    return (report.schemaVersion === 1 &&
        typeof report.generatedAt === 'string' &&
        Array.isArray(report.frames) &&
        Array.isArray(report.exportSpeed) &&
        Array.isArray(report.memory) &&
        Array.isArray(report.queues) &&
        Array.isArray(report.flamegraph) &&
        Boolean(report.recording) &&
        Boolean(report.summary));
}
export function formatProfilerFrameReason(frame, passLabels) {
    if (frame.reason) {
        return frame.reason.startsWith('第') ? frame.reason : `第${frame.frameIndex}帧：${frame.reason}`;
    }
    return `第${frame.frameIndex}帧：${passLabels[frame.slowestPass] ?? frame.slowestPass}耗时${frame.totalMs.toFixed(1)}ms`;
}
function getSlowestRenderPass(breakdown) {
    return PASS_KEYS.reduce((slowest, current) => (breakdown[current.key] > breakdown[slowest.key] ? current : slowest), PASS_KEYS[0]).name;
}
function passKeyForName(name) {
    return PASS_KEYS.find((pass) => pass.name === name)?.key ?? 'compositeMs';
}
function uniqueBottlenecks(values) {
    return Array.from(new Set(values.filter((value) => value !== 'unknown')));
}
function clampMs(value) {
    return Number.isFinite(value ?? NaN) ? Math.max(0, value ?? 0) : 0;
}
function clampBytes(value) {
    return Number.isFinite(value ?? NaN) ? Math.max(0, Math.round(value ?? 0)) : 0;
}
function roundProfilerNumber(value) {
    return Math.round(value * 100) / 100;
}
//# sourceMappingURL=profiler.js.map
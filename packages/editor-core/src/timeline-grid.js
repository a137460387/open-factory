import { round } from './time';
import { calculateBeatGridLines } from './beats';
import { findTimelineSnapTarget, } from './timeline-snapping';
export const DEFAULT_TIMELINE_GRID_SETTINGS = {
    enabled: false,
    unit: 'frame',
};
const DEFAULT_GRID_MIN_PIXEL_SPACING = 8;
const DEFAULT_GRID_SNAP_THRESHOLD_PX = 8;
const EPSILON = 0.000001;
export function normalizeTimelineGridSettings(value) {
    if (!value || typeof value !== 'object') {
        return { ...DEFAULT_TIMELINE_GRID_SETTINGS };
    }
    const input = value;
    return {
        enabled: input.enabled === true,
        unit: normalizeTimelineGridUnit(input.unit),
    };
}
export function normalizeTimelineGridUnit(value) {
    return value === 'frame' ||
        value === '5-frames' ||
        value === '10-frames' ||
        value === 'second' ||
        value === '5-seconds' ||
        value === 'beat' ||
        value === 'measure' ||
        value === 'four-measures'
        ? value
        : 'frame';
}
export function getTimelineGridIntervalSeconds(unit, fps) {
    const safeFps = Math.max(1, fps || 30);
    if (unit === 'frame') {
        return 1 / safeFps;
    }
    if (unit === '5-frames') {
        return 5 / safeFps;
    }
    if (unit === '10-frames') {
        return 10 / safeFps;
    }
    if (unit === 'second') {
        return 1;
    }
    if (unit === '5-seconds') {
        return 5;
    }
    return undefined;
}
export function buildTimelineGridLines(input) {
    if (input.duration <= 0 || input.zoom <= 0 || input.viewportWidth <= 0 || input.visibleEnd < input.visibleStart) {
        return [];
    }
    if (isBeatGridUnit(input.unit)) {
        return filterDenseGridLines(buildBeatGridTimes(input.beatTimes, beatGridDensityForUnit(input.unit)).map((time, index) => ({
            time,
            major: input.unit !== 'beat' || index % 4 === 0,
        })), input.visibleStart, Math.min(input.duration, input.visibleEnd), input.zoom, input.minPixelSpacing ?? DEFAULT_GRID_MIN_PIXEL_SPACING);
    }
    const interval = getTimelineGridIntervalSeconds(input.unit, input.fps);
    if (!interval || interval <= 0) {
        return [];
    }
    const minPixelSpacing = Math.max(1, input.minPixelSpacing ?? DEFAULT_GRID_MIN_PIXEL_SPACING);
    const stepMultiplier = Math.max(1, Math.ceil(minPixelSpacing / Math.max(EPSILON, interval * input.zoom)));
    const step = interval * stepMultiplier;
    const start = Math.max(0, Math.floor(Math.max(0, input.visibleStart) / step) * step);
    const end = Math.min(input.duration, input.visibleEnd);
    const lines = [];
    for (let time = start; time <= end + EPSILON; time += step) {
        if (time + EPSILON < input.visibleStart) {
            continue;
        }
        const index = Math.round(time / interval);
        lines.push({ time: round(time), major: index % majorEveryForUnit(input.unit, stepMultiplier) === 0 });
    }
    return lines;
}
export function findTimelineSnapTargetWithGrid(input) {
    const timelineTarget = findTimelineSnapTarget(input);
    if (timelineTarget || input.disabled || input.grid?.enabled !== true) {
        return timelineTarget;
    }
    return findTimelineGridSnapTarget({
        clipStart: input.clipStart,
        clipDuration: input.clipDuration,
        unit: input.grid.unit,
        fps: input.grid.fps,
        beatTimes: input.grid.beatTimes,
        pixelsPerSecond: input.pixelsPerSecond,
        thresholdPx: input.thresholdPx,
        disabled: input.disabled,
        edges: input.edges,
    });
}
export function findTimelineGridSnapTarget(input) {
    if (input.disabled || input.pixelsPerSecond <= 0 || input.clipDuration <= 0) {
        return null;
    }
    const threshold = Math.max(0, input.thresholdPx ?? DEFAULT_GRID_SNAP_THRESHOLD_PX);
    const edges = input.edges ?? ['start', 'end'];
    let best = null;
    for (const edge of edges) {
        const edgeTime = edge === 'start' ? input.clipStart : input.clipStart + input.clipDuration;
        const candidateTime = nearestGridTime(edgeTime, input);
        if (candidateTime === undefined || candidateTime < 0) {
            continue;
        }
        const delta = candidateTime - edgeTime;
        const distancePx = Math.abs(delta * input.pixelsPerSecond);
        if (distancePx > threshold + EPSILON) {
            continue;
        }
        const snappedStart = round(Math.max(0, input.clipStart + delta));
        const target = {
            edge,
            candidate: { time: round(candidateTime), kind: 'grid' },
            snappedStart,
            delta: round(delta),
            distancePx,
        };
        if (!best || target.distancePx < best.distancePx - EPSILON) {
            best = target;
        }
    }
    return best;
}
export function snapTimelineTimeToGrid(input) {
    if (input.disabled || input.pixelsPerSecond <= 0) {
        return round(input.time);
    }
    const candidateTime = nearestGridTime(input.time, input);
    if (candidateTime === undefined || candidateTime < 0) {
        return round(input.time);
    }
    const threshold = Math.max(0, input.thresholdPx ?? DEFAULT_GRID_SNAP_THRESHOLD_PX);
    const distancePx = Math.abs((candidateTime - input.time) * input.pixelsPerSecond);
    return distancePx <= threshold + EPSILON ? round(candidateTime) : round(input.time);
}
function nearestGridTime(time, input) {
    if (isBeatGridUnit(input.unit)) {
        return nearestTime(time, buildBeatGridTimes(input.beatTimes, beatGridDensityForUnit(input.unit)));
    }
    const interval = getTimelineGridIntervalSeconds(input.unit, input.fps);
    return interval ? Math.round(time / interval) * interval : undefined;
}
function nearestTime(time, candidates) {
    let best;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const candidate of candidates) {
        const distance = Math.abs(candidate - time);
        if (distance < bestDistance - EPSILON) {
            best = candidate;
            bestDistance = distance;
        }
    }
    return best;
}
function buildBeatGridTimes(beatTimes, density) {
    if (!Array.isArray(beatTimes)) {
        return [];
    }
    return calculateBeatGridLines(beatTimes.filter((time) => typeof time === 'number' && Number.isFinite(time) && time >= 0), density);
}
function isBeatGridUnit(unit) {
    return unit === 'beat' || unit === 'measure' || unit === 'four-measures';
}
function beatGridDensityForUnit(unit) {
    return unit === 'four-measures' ? 'four-measures' : unit === 'measure' ? 'measure' : 'beat';
}
function filterDenseGridLines(lines, visibleStart, visibleEnd, zoom, minPixelSpacing) {
    const result = [];
    let lastAccepted = Number.NEGATIVE_INFINITY;
    for (const line of lines) {
        if (line.time + EPSILON < visibleStart || line.time - EPSILON > visibleEnd) {
            continue;
        }
        if ((line.time - lastAccepted) * zoom + EPSILON < minPixelSpacing) {
            continue;
        }
        result.push(line);
        lastAccepted = line.time;
    }
    return result;
}
function majorEveryForUnit(unit, stepMultiplier) {
    if (unit === 'frame' || unit === '5-frames' || unit === '10-frames') {
        return Math.max(1, 30 * stepMultiplier);
    }
    if (unit === 'second') {
        return Math.max(1, 5 * stepMultiplier);
    }
    return 1;
}
//# sourceMappingURL=timeline-grid.js.map
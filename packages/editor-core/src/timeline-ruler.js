import { framesToSeconds, normalizeProjectFps, secondsToFrames, secondsToTimecode } from './time';
const DEFAULT_MIN_TICK_SPACING_PX = 72;
const FRAME_STEPS = [1, 2, 5, 10];
const SECOND_STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
export function calculateTimelineRulerScale(input) {
    const zoom = normalizeZoom(input.zoom);
    const minSpacing = normalizeMinSpacing(input.minTickSpacingPx, input.viewportWidth);
    const fps = normalizeProjectFps(input.fps ?? 30);
    for (const stepFrames of FRAME_STEPS) {
        const tickSpacingPx = (stepFrames / fps) * zoom;
        if (tickSpacingPx >= minSpacing) {
            return {
                unit: stepFrames === 10 ? 'ten-frames' : 'frame',
                stepFrames,
                stepSeconds: framesToSeconds(stepFrames, fps),
                tickSpacingPx,
            };
        }
    }
    for (const stepSeconds of SECOND_STEPS) {
        const tickSpacingPx = stepSeconds * zoom;
        if (tickSpacingPx >= minSpacing) {
            return {
                unit: stepSeconds >= 60 ? 'minutes' : 'seconds',
                stepSeconds,
                tickSpacingPx,
            };
        }
    }
    const fallbackSeconds = SECOND_STEPS.at(-1);
    return {
        unit: 'minutes',
        stepSeconds: fallbackSeconds,
        tickSpacingPx: fallbackSeconds * zoom,
    };
}
export function buildTimelineRulerTicks(input) {
    const duration = Math.max(0, Number.isFinite(input.duration) ? input.duration : 0);
    if (duration <= 0) {
        return [];
    }
    const scale = calculateTimelineRulerScale(input);
    const fps = normalizeProjectFps(input.fps ?? 30);
    const start = Math.max(0, Number.isFinite(input.visibleStart) ? input.visibleStart : 0);
    const end = Math.min(duration, Math.max(start, Number.isFinite(input.visibleEnd) ? input.visibleEnd : duration));
    const paddedStart = Math.max(0, start - scale.stepSeconds);
    const paddedEnd = Math.min(duration, end + scale.stepSeconds);
    if (scale.stepFrames) {
        const startFrame = Math.max(0, Math.floor(secondsToFrames(paddedStart, fps) / scale.stepFrames) * scale.stepFrames);
        const endFrame = Math.ceil(secondsToFrames(paddedEnd, fps) / scale.stepFrames) * scale.stepFrames;
        const ticks = [];
        for (let frame = startFrame; frame <= endFrame; frame += scale.stepFrames) {
            const time = framesToSeconds(frame, fps);
            if (time > duration + 0.000001) {
                break;
            }
            ticks.push({
                time,
                label: formatTimelineRulerTickLabel(time, scale.unit, fps, input.timecodeFormat),
                unit: scale.unit,
                major: frame % Math.max(1, Math.round(fps)) === 0,
            });
        }
        return ticks;
    }
    const firstTick = Math.floor(paddedStart / scale.stepSeconds) * scale.stepSeconds;
    const ticks = [];
    for (let tick = firstTick; tick <= paddedEnd + 0.000001; tick += scale.stepSeconds) {
        const time = Math.max(0, tick);
        ticks.push({
            time,
            label: formatTimelineRulerTickLabel(time, scale.unit, fps, input.timecodeFormat),
            unit: scale.unit,
            major: scale.unit === 'minutes' ? Math.round(time) % 300 === 0 : Math.round(time) % 10 === 0,
        });
    }
    return dedupeTicks(ticks).filter((tick) => tick.time <= duration + 0.000001);
}
export function formatTimelineRulerTickLabel(time, unit, fps = 30, timecodeFormat = 'ndf') {
    if (unit === 'frame' || unit === 'ten-frames') {
        return `${secondsToFrames(time, fps)}f`;
    }
    return secondsToTimecode(time, fps, timecodeFormat);
}
function normalizeZoom(zoom) {
    return Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
}
function normalizeMinSpacing(minTickSpacingPx, viewportWidth) {
    const requested = Number.isFinite(minTickSpacingPx) ? minTickSpacingPx : DEFAULT_MIN_TICK_SPACING_PX;
    const viewportLimit = Number.isFinite(viewportWidth) && viewportWidth > 0 ? Math.max(48, viewportWidth / 10) : requested;
    return Math.max(48, Math.min(requested, viewportLimit));
}
function dedupeTicks(ticks) {
    const seen = new Set();
    const output = [];
    for (const tick of ticks) {
        const key = Math.round(tick.time * 1000);
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        output.push(tick);
    }
    return output;
}
//# sourceMappingURL=timeline-ruler.js.map
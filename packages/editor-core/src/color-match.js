import { clamp, round } from './time';
import { createDefaultColorCurves, normalizeColorCurves, } from './color-grading';
const EPSILON_STD_DEV = 0.000001;
const CURVE_SAMPLE_POINTS = [0, 0.25, 0.5, 0.75, 1];
export function calculateColorMatchStats(sample) {
    const sums = { r: 0, g: 0, b: 0 };
    const sumsSq = { r: 0, g: 0, b: 0 };
    let pixelCount = 0;
    for (let index = 0; index + 2 < sample.data.length; index += 4) {
        const alpha = sample.data[index + 3] ?? 255;
        if (alpha <= 0) {
            continue;
        }
        const r = clampChannel(sample.data[index]);
        const g = clampChannel(sample.data[index + 1]);
        const b = clampChannel(sample.data[index + 2]);
        sums.r += r;
        sums.g += g;
        sums.b += b;
        sumsSq.r += r * r;
        sumsSq.g += g * g;
        sumsSq.b += b * b;
        pixelCount += 1;
    }
    if (pixelCount === 0) {
        throw new Error('Color match requires at least one visible pixel.');
    }
    return {
        r: statsFromSums(sums.r, sumsSq.r, pixelCount),
        g: statsFromSums(sums.g, sumsSq.g, pixelCount),
        b: statsFromSums(sums.b, sumsSq.b, pixelCount),
        pixelCount,
    };
}
export function buildColorMatchTransform(source, reference) {
    return {
        r: buildChannelTransform(source.r, reference.r),
        g: buildChannelTransform(source.g, reference.g),
        b: buildChannelTransform(source.b, reference.b),
    };
}
export function buildColorMatchCurves(source, reference) {
    return colorMatchTransformToCurves(buildColorMatchTransform(calculateColorMatchStats(source), calculateColorMatchStats(reference)));
}
export function colorMatchTransformToCurves(transform) {
    return normalizeColorCurves({
        ...createDefaultColorCurves(),
        r: transformChannelToCurve(transform.r),
        g: transformChannelToCurve(transform.g),
        b: transformChannelToCurve(transform.b),
    });
}
export function applyColorMatchTransformToRgb(input, transform) {
    return {
        r: applyChannelTransform(input.r, transform.r),
        g: applyChannelTransform(input.g, transform.g),
        b: applyChannelTransform(input.b, transform.b),
    };
}
function buildChannelTransform(source, reference) {
    const slope = source.stdDev > EPSILON_STD_DEV ? reference.stdDev / source.stdDev : 1;
    return {
        slope: round(slope),
        intercept: round(reference.mean - source.mean * slope),
        sourceMean: source.mean,
    };
}
function transformChannelToCurve(transform) {
    const points = new Map();
    for (const x of [...CURVE_SAMPLE_POINTS, transform.sourceMean]) {
        const normalizedX = round(clamp(Number.isFinite(x) ? x : 0, 0, 1));
        points.set(normalizedX, { x: normalizedX, y: applyChannelTransform(normalizedX, transform) });
    }
    return [...points.values()].sort((left, right) => left.x - right.x || left.y - right.y);
}
function applyChannelTransform(value, transform) {
    return round(clamp(value * transform.slope + transform.intercept, 0, 1));
}
function statsFromSums(sum, sumSq, count) {
    const mean = sum / count;
    const variance = Math.max(0, sumSq / count - mean * mean);
    return {
        mean: round(mean),
        stdDev: round(Math.sqrt(variance)),
    };
}
function clampChannel(value) {
    return clamp((Number.isFinite(value) ? value : 0) / 255, 0, 1);
}
//# sourceMappingURL=color-match.js.map
import { clamp, round } from '../time';
export const DEFAULT_CURVE_POINTS = [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
];
export const DEFAULT_COLOR_WHEEL_VALUE = {
    r: 0,
    g: 0,
    b: 0,
    intensity: 1,
};
export const DEFAULT_COLOR_CURVES = createDefaultColorCurves();
export const DEFAULT_THREE_WAY_COLOR = createDefaultThreeWayColor();
export function createDefaultColorCurves() {
    return {
        master: cloneDefaultCurvePoints(),
        r: cloneDefaultCurvePoints(),
        g: cloneDefaultCurvePoints(),
        b: cloneDefaultCurvePoints(),
    };
}
export function createDefaultThreeWayColor() {
    return {
        lift: { ...DEFAULT_COLOR_WHEEL_VALUE },
        gamma: { ...DEFAULT_COLOR_WHEEL_VALUE },
        gain: { ...DEFAULT_COLOR_WHEEL_VALUE },
    };
}
export function normalizeCurvePoints(points) {
    const source = Array.isArray(points) && points.length >= 2 ? points : DEFAULT_CURVE_POINTS;
    const byX = new Map();
    for (const point of source) {
        const x = normalizeFinite(point.x, 0, 0, 1);
        const y = normalizeFinite(point.y, x, 0, 1);
        byX.set(x, { x, y });
    }
    const normalized = [...byX.values()].sort((left, right) => left.x - right.x || left.y - right.y);
    return normalized.length >= 2 ? normalized : cloneDefaultCurvePoints();
}
export function normalizeColorCurves(curves) {
    return {
        master: normalizeCurvePoints(curves?.master),
        r: normalizeCurvePoints(curves?.r),
        g: normalizeCurvePoints(curves?.g),
        b: normalizeCurvePoints(curves?.b),
    };
}
export function normalizeColorWheelValue(value) {
    return {
        r: normalizeFinite(value?.r, DEFAULT_COLOR_WHEEL_VALUE.r, -1, 1),
        g: normalizeFinite(value?.g, DEFAULT_COLOR_WHEEL_VALUE.g, -1, 1),
        b: normalizeFinite(value?.b, DEFAULT_COLOR_WHEEL_VALUE.b, -1, 1),
        intensity: normalizeFinite(value?.intensity, DEFAULT_COLOR_WHEEL_VALUE.intensity, 0, 2),
    };
}
export function normalizeThreeWayColor(value) {
    return {
        lift: normalizeColorWheelValue(value?.lift),
        gamma: normalizeColorWheelValue(value?.gamma),
        gain: normalizeColorWheelValue(value?.gain),
    };
}
export function isDefaultColorCurves(curves) {
    const normalized = normalizeColorCurves(curves);
    return (isDefaultCurvePoints(normalized.master) &&
        isDefaultCurvePoints(normalized.r) &&
        isDefaultCurvePoints(normalized.g) &&
        isDefaultCurvePoints(normalized.b));
}
export function isNeutralThreeWayColor(value) {
    const normalized = normalizeThreeWayColor(value);
    return isNeutralWheel(normalized.lift) && isNeutralWheel(normalized.gamma) && isNeutralWheel(normalized.gain);
}
export function sampleCurve(points, x) {
    const normalized = normalizeCurvePoints(points);
    const sampleX = clamp(Number.isFinite(x) ? x : 0, 0, 1);
    const first = normalized[0];
    const last = normalized[normalized.length - 1];
    if (sampleX <= first.x) {
        return first.y;
    }
    if (sampleX >= last.x) {
        return last.y;
    }
    if (normalized.length === 2) {
        const span = Math.max(0.000001, last.x - first.x);
        const t = clamp((sampleX - first.x) / span, 0, 1);
        return round(first.y + (last.y - first.y) * t);
    }
    const rightIndex = normalized.findIndex((point) => point.x >= sampleX);
    const index = Math.max(1, rightIndex);
    const p0 = normalized[Math.max(0, index - 2)];
    const p1 = normalized[index - 1];
    const p2 = normalized[index];
    const p3 = normalized[Math.min(normalized.length - 1, index + 1)];
    const span = Math.max(0.000001, p2.x - p1.x);
    const t = clamp((sampleX - p1.x) / span, 0, 1);
    const t2 = t * t;
    const t3 = t2 * t;
    const y = 0.5 *
        (2 * p1.y +
            (p2.y - p0.y) * t +
            (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
            (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
    return round(clamp(y, 0, 1));
}
export function sampleColorCurves(curves, x) {
    const normalized = normalizeColorCurves(curves);
    const master = sampleCurve(normalized.master, x);
    return {
        r: sampleCurve(normalized.r, master),
        g: sampleCurve(normalized.g, master),
        b: sampleCurve(normalized.b, master),
    };
}
export function applyColorCurvesToRgb(input, curves) {
    const normalized = normalizeColorCurves(curves);
    const luma = clamp(input.r * 0.2126 + input.g * 0.7152 + input.b * 0.0722, 0, 1);
    const master = sampleCurve(normalized.master, luma);
    const delta = master - luma;
    return {
        r: sampleCurve(normalized.r, clamp(input.r + delta, 0, 1)),
        g: sampleCurve(normalized.g, clamp(input.g + delta, 0, 1)),
        b: sampleCurve(normalized.b, clamp(input.b + delta, 0, 1)),
    };
}
export function serializeColorCurvesToCube(curves, size = 17, title = 'open-factory color curves') {
    const sampleCount = Math.max(2, Math.round(size));
    const lines = [
        `TITLE "${sanitizeCubeTitle(title)}"`,
        `LUT_1D_SIZE ${sampleCount}`,
        'DOMAIN_MIN 0 0 0',
        'DOMAIN_MAX 1 1 1',
    ];
    for (let index = 0; index < sampleCount; index += 1) {
        const x = index / (sampleCount - 1);
        const color = sampleColorCurves(curves, x);
        lines.push(`${formatCubeNumber(color.r)} ${formatCubeNumber(color.g)} ${formatCubeNumber(color.b)}`);
    }
    return `${lines.join('\n')}\n`;
}
export function applyThreeWayColor(input, value) {
    const normalized = normalizeThreeWayColor(value);
    return {
        r: applyCdlChannel(input.r, normalized.lift.r + normalized.lift.intensity - 1, normalized.gamma.r + normalized.gamma.intensity, normalized.gain.r + normalized.gain.intensity),
        g: applyCdlChannel(input.g, normalized.lift.g + normalized.lift.intensity - 1, normalized.gamma.g + normalized.gamma.intensity, normalized.gain.g + normalized.gain.intensity),
        b: applyCdlChannel(input.b, normalized.lift.b + normalized.lift.intensity - 1, normalized.gamma.b + normalized.gamma.intensity, normalized.gain.b + normalized.gain.intensity),
    };
}
function applyCdlChannel(input, lift, gamma, gain) {
    const base = clamp((Number.isFinite(input) ? input : 0) * Math.max(0.001, gain) + lift, 0, 1);
    return round(clamp(Math.pow(base, 1 / Math.max(0.001, gamma)), 0, 1));
}
function isDefaultCurvePoints(points) {
    const normalized = normalizeCurvePoints(points);
    return (normalized.length === 2 &&
        normalized[0].x === 0 &&
        normalized[0].y === 0 &&
        normalized[1].x === 1 &&
        normalized[1].y === 1);
}
function isNeutralWheel(value) {
    return value.r === 0 && value.g === 0 && value.b === 0 && value.intensity === 1;
}
function cloneDefaultCurvePoints() {
    return DEFAULT_CURVE_POINTS.map((point) => ({ ...point }));
}
function normalizeFinite(value, fallback, min, max) {
    return round(clamp(typeof value === 'number' && Number.isFinite(value) ? value : fallback, min, max));
}
function formatCubeNumber(value) {
    return value.toFixed(6).replace(/0+$/g, '').replace(/\.$/g, '') || '0';
}
function sanitizeCubeTitle(value) {
    return value.replace(/["\r\n]/g, ' ').trim() || 'open-factory color curves';
}
//# sourceMappingURL=color-curves.js.map
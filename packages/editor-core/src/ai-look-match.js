import { normalizeThreeWayColor, normalizeColorCurves } from './color-grading';
import { round } from './time';
import { clamp } from './utils/math';
export function parseAILookMatchResponse(json) {
    if (!json || typeof json !== 'object')
        return null;
    const input = json;
    const warmth = typeof input.warmth === 'number' ? clamp(input.warmth, -1, 1) : 0;
    const contrast = typeof input.contrast === 'number' ? clamp(input.contrast, -1, 1) : 0;
    const saturation = typeof input.saturation === 'number' ? clamp(input.saturation, -1, 1) : 0;
    const parseTint = (v) => {
        if (!v || typeof v !== 'object')
            return { r: 0, g: 0, b: 0 };
        const t = v;
        return {
            r: clamp(typeof t.r === 'number' ? t.r : 0, -1, 1),
            g: clamp(typeof t.g === 'number' ? t.g : 0, -1, 1),
            b: clamp(typeof t.b === 'number' ? t.b : 0, -1, 1),
        };
    };
    const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
    return {
        warmth,
        contrast,
        saturation,
        shadowsTint: parseTint(input.shadowsTint),
        highlightsTint: parseTint(input.highlightsTint),
        reason,
    };
}
export function mapLookMatchToWheelAdjustments(response) {
    const warmthFactor = response.warmth * 0.3;
    const contrastFactor = response.contrast * 0.2;
    return {
        lift: {
            r: round(clamp(response.shadowsTint.r * 0.4 - warmthFactor * 0.1, -1, 1)),
            g: round(clamp(response.shadowsTint.g * 0.4, -1, 1)),
            b: round(clamp(response.shadowsTint.b * 0.4 + warmthFactor * 0.1, -1, 1)),
        },
        gamma: {
            r: round(clamp(warmthFactor * 0.2 - contrastFactor * 0.05, -1, 1)),
            g: round(clamp(contrastFactor * 0.02, -1, 1)),
            b: round(clamp(-warmthFactor * 0.2 - contrastFactor * 0.05, -1, 1)),
        },
        gain: {
            r: round(clamp(response.highlightsTint.r * 0.4 + warmthFactor * 0.15, -1, 1)),
            g: round(clamp(response.highlightsTint.g * 0.4, -1, 1)),
            b: round(clamp(response.highlightsTint.b * 0.4 - warmthFactor * 0.15, -1, 1)),
        },
    };
}
export function mapLookMatchToCurveControlPoints(response) {
    const contrastOffset = response.contrast * 0.08;
    const satOffset = response.saturation * 0.06;
    const warmOffset = response.warmth * 0.04;
    const master = [
        { x: 0, y: 0 },
        { x: 0.25, y: clamp(0.25 - contrastOffset * 1.5, 0, 1) },
        { x: 0.5, y: clamp(0.5 + contrastOffset * 0.3, 0, 1) },
        { x: 0.75, y: clamp(0.75 + contrastOffset * 1.2, 0, 1) },
        { x: 1, y: 1 },
    ];
    const r = [
        { x: 0, y: 0 },
        { x: 0.5, y: clamp(0.5 + warmOffset + satOffset * 0.3, 0, 1) },
        { x: 1, y: 1 },
    ];
    const g = [
        { x: 0, y: 0 },
        { x: 0.5, y: clamp(0.5 + satOffset * 0.2, 0, 1) },
        { x: 1, y: 1 },
    ];
    const b = [
        { x: 0, y: 0 },
        { x: 0.5, y: clamp(0.5 - warmOffset + satOffset * 0.3, 0, 1) },
        { x: 1, y: 1 },
    ];
    return normalizeColorCurves({ master, r, g, b });
}
export function buildAILookMatch(response, sourceImageHash, confidence = 0.8) {
    return {
        sourceImageHash,
        wheelAdjustments: mapLookMatchToWheelAdjustments(response),
        curveControlPoints: mapLookMatchToCurveControlPoints(response),
        confidence: clamp(confidence, 0, 1),
        generatedAt: new Date().toISOString(),
        blendStrength: 100,
    };
}
export function blendWheelAdjustments(original, adjustments, blendStrength) {
    const t = clamp(blendStrength / 100, 0, 1);
    const base = normalizeThreeWayColor(original);
    const blendWheel = (base, adj) => ({
        r: round(base.r + (adj.r - base.r) * t),
        g: round(base.g + (adj.g - base.g) * t),
        b: round(base.b + (adj.b - base.b) * t),
        intensity: base.intensity,
    });
    return {
        lift: blendWheel(base.lift, adjustments.lift),
        gamma: blendWheel(base.gamma, adjustments.gamma),
        gain: blendWheel(base.gain, adjustments.gain),
    };
}
export function blendCurveControlPoints(original, target, blendStrength) {
    const t = clamp(blendStrength / 100, 0, 1);
    const base = normalizeColorCurves(original);
    const blendChannel = (baseChannel, targetChannel) => {
        const allX = new Set([...baseChannel.map((p) => p.x), ...targetChannel.map((p) => p.x)]);
        const xs = [...allX].sort((a, b) => a - b);
        return xs.map((x) => {
            const baseY = interpolateCurve(baseChannel, x);
            const targetY = interpolateCurve(targetChannel, x);
            return { x: round(x), y: round(clamp(baseY + (targetY - baseY) * t, 0, 1)) };
        });
    };
    return {
        master: blendChannel(base.master, target.master),
        r: blendChannel(base.r, target.r),
        g: blendChannel(base.g, target.g),
        b: blendChannel(base.b, target.b),
    };
}
function interpolateCurve(points, x) {
    if (points.length === 0)
        return x;
    if (x <= points[0].x)
        return points[0].y;
    if (x >= points[points.length - 1].x)
        return points[points.length - 1].y;
    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i];
        const p1 = points[i + 1];
        if (x >= p0.x && x <= p1.x) {
            const span = Math.max(0.000001, p1.x - p0.x);
            const t = (x - p0.x) / span;
            return p0.y + (p1.y - p0.y) * t;
        }
    }
    return x;
}
//# sourceMappingURL=ai-look-match.js.map
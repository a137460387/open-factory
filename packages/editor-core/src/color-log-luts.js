import { clamp01 } from './math-utils';
export const REC709_INPUT_COLOR_SPACE = 'rec709';
export const LOG_INPUT_COLOR_SPACES = ['slog2', 'slog3', 'clog', 'clog3', 'llog', 'vlog'];
export const INPUT_COLOR_SPACES = [REC709_INPUT_COLOR_SPACE, ...LOG_INPUT_COLOR_SPACES];
export const LOG_TO_REC709_LUT_SIZE = 17;
const LOG_CURVE_SPECS = {
    slog2: {
        lift: 0.028,
        gamma: 1.48,
        exposure: 1.1,
        saturation: 1.08,
        shadowTint: [1.02, 1, 0.98],
        highlightTint: [1.01, 1, 0.99],
    },
    slog3: {
        lift: 0.035,
        gamma: 1.55,
        exposure: 1.12,
        saturation: 1.1,
        shadowTint: [1.01, 1, 0.99],
        highlightTint: [1.02, 1.01, 0.98],
    },
    clog: {
        lift: 0.04,
        gamma: 1.42,
        exposure: 1.08,
        saturation: 1.06,
        shadowTint: [1, 1, 1],
        highlightTint: [1.01, 1, 0.99],
    },
    clog3: {
        lift: 0.045,
        gamma: 1.5,
        exposure: 1.1,
        saturation: 1.08,
        shadowTint: [1, 1.01, 1],
        highlightTint: [1.01, 1, 0.99],
    },
    llog: {
        lift: 0.032,
        gamma: 1.46,
        exposure: 1.09,
        saturation: 1.07,
        shadowTint: [1, 1.01, 1.02],
        highlightTint: [1.01, 1, 1],
    },
    vlog: {
        lift: 0.038,
        gamma: 1.52,
        exposure: 1.11,
        saturation: 1.09,
        shadowTint: [0.99, 1, 1.02],
        highlightTint: [1.02, 1.01, 1],
    },
};
const LOG_COLOR_SPACE_TITLES = {
    slog2: 'S-Log2 to Rec.709',
    slog3: 'S-Log3 to Rec.709',
    clog: 'Canon Log to Rec.709',
    clog3: 'Canon Log 3 to Rec.709',
    llog: 'Leica L-Log to Rec.709',
    vlog: 'Panasonic V-Log to Rec.709',
};
export const LOG_TO_REC709_LUTS = Object.freeze(Object.fromEntries(LOG_INPUT_COLOR_SPACES.map((colorSpace) => [colorSpace, buildLogToRec709Lut(colorSpace)])));
export function normalizeInputColorSpace(value) {
    return INPUT_COLOR_SPACES.includes(value) ? value : REC709_INPUT_COLOR_SPACE;
}
export function isLogInputColorSpace(value) {
    return value !== REC709_INPUT_COLOR_SPACE;
}
export function getLogToRec709Lut(colorSpace) {
    return isLogInputColorSpace(colorSpace) ? LOG_TO_REC709_LUTS[colorSpace] : undefined;
}
export function serializeLogToRec709Cube(colorSpace) {
    const lut = LOG_TO_REC709_LUTS[colorSpace];
    return [
        `TITLE "Open Factory ${lut.title}"`,
        `LUT_3D_SIZE ${lut.size}`,
        'DOMAIN_MIN 0 0 0',
        'DOMAIN_MAX 1 1 1',
        ...lut.points.map(([r, g, b]) => `${formatCubeNumber(r)} ${formatCubeNumber(g)} ${formatCubeNumber(b)}`),
    ].join('\n');
}
function buildLogToRec709Lut(colorSpace) {
    const spec = LOG_CURVE_SPECS[colorSpace];
    const scale = LOG_TO_REC709_LUT_SIZE - 1;
    const points = [];
    for (let blue = 0; blue < LOG_TO_REC709_LUT_SIZE; blue += 1) {
        for (let green = 0; green < LOG_TO_REC709_LUT_SIZE; green += 1) {
            for (let red = 0; red < LOG_TO_REC709_LUT_SIZE; red += 1) {
                const input = [red / scale, green / scale, blue / scale];
                points.push(convertLogTripletToRec709(input, spec));
            }
        }
    }
    return Object.freeze({
        colorSpace,
        title: LOG_COLOR_SPACE_TITLES[colorSpace],
        size: LOG_TO_REC709_LUT_SIZE,
        points: Object.freeze(points),
    });
}
function mapTuple(tuple, fn) {
    return [fn(tuple[0], 0), fn(tuple[1], 1), fn(tuple[2], 2)];
}
function convertLogTripletToRec709(input, spec) {
    const expanded = mapTuple(input, (channel, index) => {
        const normalized = Math.max(0, (channel - spec.lift) / Math.max(0.001, 1 - spec.lift));
        const contrast = Math.pow(normalized, spec.gamma) * spec.exposure;
        const tint = spec.shadowTint[index] * (1 - channel) + spec.highlightTint[index] * channel;
        return clamp01(contrast * tint);
    });
    const luma = expanded[0] * 0.2126 + expanded[1] * 0.7152 + expanded[2] * 0.0722;
    return [
        clamp01(luma + (expanded[0] - luma) * spec.saturation),
        clamp01(luma + (expanded[1] - luma) * spec.saturation),
        clamp01(luma + (expanded[2] - luma) * spec.saturation),
    ];
}
function formatCubeNumber(value) {
    return value.toFixed(6).replace(/\.?0+$/, '');
}
//# sourceMappingURL=color-log-luts.js.map
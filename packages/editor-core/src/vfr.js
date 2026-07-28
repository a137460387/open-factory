export function parseFrameRateRatio(value) {
    if (!value || value === '0/0') {
        return undefined;
    }
    const [numeratorRaw, denominatorRaw] = value.split('/');
    const numerator = Number(numeratorRaw);
    const denominator = denominatorRaw === undefined ? 1 : Number(denominatorRaw);
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
        return undefined;
    }
    return numerator / denominator;
}
export function isVariableFrameRateProbe(probe, tolerance = 0.001) {
    const avg = parseFrameRateRatio(probe.avgFrameRate);
    const real = parseFrameRateRatio(probe.realFrameRate);
    if (!avg || !real) {
        return false;
    }
    return Math.abs(avg - real) > tolerance;
}
export function getCfrTargetFrameRate(probe, fallback = 30) {
    const avg = parseFrameRateRatio(probe.avgFrameRate);
    const real = parseFrameRateRatio(probe.realFrameRate);
    return normalizeFrameRate(avg ?? real ?? fallback);
}
export function buildCfrFpsFilter(frameRate) {
    return `fps=${normalizeFrameRate(frameRate)}`;
}
export function normalizeFrameRate(frameRate) {
    return Math.min(120, Math.max(1, Math.round(frameRate * 1000) / 1000));
}
export function isFrameRateMismatch(mediaFrameRate, projectFrameRate, tolerance = 0.01) {
    if (!isFinitePositiveFrameRate(mediaFrameRate) || !isFinitePositiveFrameRate(projectFrameRate)) {
        return false;
    }
    return Math.abs(normalizeFrameRate(mediaFrameRate) - normalizeFrameRate(projectFrameRate)) > tolerance;
}
export function getProjectFrameRateConversionTarget(projectFrameRate, fallback = 30) {
    return normalizeFrameRate(isFinitePositiveFrameRate(projectFrameRate) ? projectFrameRate : fallback);
}
function isFinitePositiveFrameRate(value) {
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
}
//# sourceMappingURL=vfr.js.map
export interface VfrFrameRateProbe {
  avgFrameRate?: string;
  realFrameRate?: string;
}

export function parseFrameRateRatio(value: string | undefined): number | undefined {
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

export function isVariableFrameRateProbe(probe: VfrFrameRateProbe, tolerance = 0.001): boolean {
  const avg = parseFrameRateRatio(probe.avgFrameRate);
  const real = parseFrameRateRatio(probe.realFrameRate);
  if (!avg || !real) {
    return false;
  }
  return Math.abs(avg - real) > tolerance;
}

export function getCfrTargetFrameRate(probe: VfrFrameRateProbe, fallback = 30): number {
  const avg = parseFrameRateRatio(probe.avgFrameRate);
  const real = parseFrameRateRatio(probe.realFrameRate);
  return normalizeFrameRate(avg ?? real ?? fallback);
}

export function buildCfrFpsFilter(frameRate: number): string {
  return `fps=${normalizeFrameRate(frameRate)}`;
}

export function normalizeFrameRate(frameRate: number): number {
  return Math.min(120, Math.max(1, Math.round(frameRate * 1000) / 1000));
}

export function isFrameRateMismatch(mediaFrameRate: number | undefined, projectFrameRate: number | undefined, tolerance = 0.01): boolean {
  if (!isFinitePositiveFrameRate(mediaFrameRate) || !isFinitePositiveFrameRate(projectFrameRate)) {
    return false;
  }
  return Math.abs(normalizeFrameRate(mediaFrameRate) - normalizeFrameRate(projectFrameRate)) > tolerance;
}

export function getProjectFrameRateConversionTarget(projectFrameRate: number | undefined, fallback = 30): number {
  return normalizeFrameRate(isFinitePositiveFrameRate(projectFrameRate) ? projectFrameRate : fallback);
}

function isFinitePositiveFrameRate(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

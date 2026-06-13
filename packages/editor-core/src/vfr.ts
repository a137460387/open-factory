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
  const target = avg ?? real ?? fallback;
  return Math.min(120, Math.max(1, Math.round(target * 1000) / 1000));
}

export function buildCfrFpsFilter(frameRate: number): string {
  const fps = Math.min(120, Math.max(1, Math.round(frameRate * 1000) / 1000));
  return `fps=${fps}`;
}

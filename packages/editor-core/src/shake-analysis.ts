/**
 * AI camera shake stability analysis (local-only, no external AI calls).
 *
 * Samples frames at ~1 fps, uses simple block-matching to estimate
 * per-frame displacement vectors, then computes shake score as the
 * normalised variance of those vectors (0-100 scale).
 */

import { round } from './time';

// -- Public types ------------------------------------------------

export type ShakeSeverity = 'low' | 'medium' | 'high';

export interface ShakeAnalysisResult {
  /** 0-100 normalised shake score (variance of displacement vectors) */
  shakeScore: number;
  /** Severity bucket: <20 low, 20-50 medium, >50 high */
  severity: ShakeSeverity;
  /** Suggested FFmpeg filter to reduce shake */
  suggestedFilter: 'vidstab' | 'none';
}

export interface TwoStepVidstabArgs {
  /** Args for the vidstabdetect pass */
  detectArgs: string[];
  /** Args for the vidstabtransform pass */
  transformArgs: string[];
}

// -- Displacement estimation -------------------------------------

/**
 * Compute per-frame displacement vectors from an array of sampled
 * luminance frames (each frame is a flat array of [0,1] values,
 * width x height).
 *
 * Re-uses the block-matching logic from multicam-ai-cut but
 * returns the full per-pair displacement vector instead of a scalar.
 */
export function estimateDisplacementVectors(
  frames: ArrayLike<number>[],
  width: number,
  height: number,
  gridSize = 4,
  searchRadius = 4
): Array<{ dx: number; dy: number }> {
  if (frames.length < 2 || width < gridSize || height < gridSize) return [];
  const blockW = Math.floor(width / gridSize);
  const blockH = Math.floor(height / gridSize);
  if (blockW < 2 || blockH < 2) return [];

  const vectors: Array<{ dx: number; dy: number }> = [];
  for (let fi = 0; fi < frames.length - 1; fi += 1) {
    const prev = frames[fi];
    const curr = frames[fi + 1];
    let sumDx = 0;
    let sumDy = 0;
    let blockCount = 0;
    for (let gy = 0; gy < gridSize; gy += 1) {
      for (let gx = 0; gx < gridSize; gx += 1) {
        const bx = gx * blockW;
        const by = gy * blockH;
        const best = findBestBlockMatch(prev, curr, width, height, bx, by, blockW, blockH, searchRadius);
        sumDx += best.dx;
        sumDy += best.dy;
        blockCount += 1;
      }
    }
    if (blockCount > 0) {
      vectors.push({ dx: round(sumDx / blockCount), dy: round(sumDy / blockCount) });
    }
  }
  return vectors;
}

// -- Shake score computation -------------------------------------

/**
 * Compute shake score from displacement vectors.
 * Score = normalised variance of displacement magnitudes, scaled 0-100.
 */
export function calculateShakeScore(
  displacementVectors: Array<{ dx: number; dy: number }>,
  maxExpectedVariance?: number
): number {
  if (displacementVectors.length === 0) return 0;
  const magnitudes = displacementVectors.map((v) => Math.sqrt(v.dx * v.dx + v.dy * v.dy));
  const n = magnitudes.length;
  if (n === 0) return 0;

  const mean = magnitudes.reduce((a, b) => a + b, 0) / n;
  const variance = magnitudes.reduce((acc, m) => acc + (m - mean) * (m - mean), 0) / n;

  // Normalise: assume max expected variance for scaling.
  // Default maxVariance chosen so that a variance of ~25 pixels^2 → score 100.
  const maxVar = maxExpectedVariance ?? 25;
  return round(Math.min(100, Math.max(0, (variance / maxVar) * 100)));
}

// -- Severity classification -------------------------------------

/**
 * Classify shake severity from score.
 * <20 = low, 20-50 = medium, >50 = high.
 */
export function classifyShakeSeverity(score: number): ShakeSeverity {
  if (score < 20) return 'low';
  if (score <= 50) return 'medium';
  return 'high';
}

// -- Full analysis -----------------------------------------------

/**
 * Run full shake analysis on sampled luminance frames.
 */
export function analyseShake(
  frames: ArrayLike<number>[],
  width: number,
  height: number,
  maxExpectedVariance?: number
): ShakeAnalysisResult {
  const vectors = estimateDisplacementVectors(frames, width, height);
  const shakeScore = calculateShakeScore(vectors, maxExpectedVariance);
  const severity = classifyShakeSeverity(shakeScore);
  return {
    shakeScore,
    severity,
    suggestedFilter: severity === 'high' ? 'vidstab' : 'none'
  };
}

// -- FFmpeg two-step vidstab command generation -------------------

const DEFAULT_SMOOTHING = 10;
const DEFAULT_ZOOM = 0;

/**
 * Build the two-step FFmpeg arguments for vidstab stabilisation.
 * Pass 1: vidstabdetect → generates a .trf transform file.
 * Pass 2: vidstabtransform → applies the stabilisation.
 */
export function buildTwoStepVidstabArgs(
  inputPath: string,
  trfPath: string,
  smoothing = DEFAULT_SMOOTHING,
  zoom = DEFAULT_ZOOM
): TwoStepVidstabArgs {
  const safeInput = inputPath;
  const safeTrf = trfPath;
  return {
    detectArgs: [
      '-i', safeInput,
      '-vf', `vidstabdetect=stepsize=6:shakiness=5:accuracy=15:result=${safeTrf}`,
      '-f', 'null', '-'
    ],
    transformArgs: [
      '-i', safeInput,
      '-vf', `vidstabtransform=smoothing=${Math.max(0, Math.round(smoothing))}:zoom=${Math.max(0, zoom)}:input=${safeTrf}`,
      '-c:v', 'libx264', '-preset', 'medium',
      '-c:a', 'copy',
      '-y'
    ]
  };
}

// -- Internal helpers --------------------------------------------

function computeBlockNCC(
  a: ArrayLike<number>,
  b: ArrayLike<number>,
  imgW: number,
  imgH: number,
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  bW: number,
  bH: number
): number {
  let sumA = 0;
  let sumB = 0;
  let count = 0;
  for (let y = 0; y < bH; y += 1) {
    for (let x = 0; x < bW; x += 1) {
      const ax = ox + x;
      const ay = oy + y;
      const bx = ax + dx;
      const by = ay + dy;
      if (ax < 0 || ax >= imgW || ay < 0 || ay >= imgH) continue;
      if (bx < 0 || bx >= imgW || by < 0 || by >= imgH) continue;
      sumA += a[ay * imgW + ax];
      sumB += b[by * imgW + bx];
      count += 1;
    }
  }
  if (count === 0) return 0;
  const meanA = sumA / count;
  const meanB = sumB / count;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let y = 0; y < bH; y += 1) {
    for (let x = 0; x < bW; x += 1) {
      const ax = ox + x;
      const ay = oy + y;
      const bx = ax + dx;
      const by = ay + dy;
      if (ax < 0 || ax >= imgW || ay < 0 || ay >= imgH) continue;
      if (bx < 0 || bx >= imgW || by < 0 || by >= imgH) continue;
      const dA = a[ay * imgW + ax] - meanA;
      const dB = b[by * imgW + bx] - meanB;
      dot += dA * dB;
      normA += dA * dA;
      normB += dB * dB;
    }
  }
  const denom = Math.sqrt(normA * normB);
  return denom > 0 ? dot / denom : 0;
}

function findBestBlockMatch(
  prev: ArrayLike<number>,
  curr: ArrayLike<number>,
  imgW: number,
  imgH: number,
  bx: number,
  by: number,
  bW: number,
  bH: number,
  radius: number
): { dx: number; dy: number; ncc: number } {
  let bestDx = 0;
  let bestDy = 0;
  let bestNcc = -Infinity;
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const ncc = computeBlockNCC(prev, curr, imgW, imgH, bx, by, dx, dy, bW, bH);
      if (ncc > bestNcc) {
        bestNcc = ncc;
        bestDx = dx;
        bestDy = dy;
      }
    }
  }
  return { dx: bestDx, dy: bestDy, ncc: bestNcc };
}

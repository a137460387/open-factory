/**
 * AI camera motion type recognition (local-only, no external AI calls).
 *
 * Samples frames at ~5 fps, uses block-matching (shared with shake-analysis)
 * to estimate per-frame displacement vectors, then classifies motion type
 * based on vector direction consistency, magnitude, and corner divergence.
 */

import { round } from './time';
import { estimateDisplacementVectors } from './shake-analysis';
import type { AiModuleResult, TranslateFn } from './ai-module-types';
import { identityTranslator } from './ai-module-types';

export type MotionType = 'static' | 'pan' | 'tilt' | 'zoom_in' | 'zoom_out' | 'handheld';

export interface ClipMotionType {
  type: MotionType;
  confidence: number;
  analyzedAt: string;
}

export interface MotionVectorField {
  vectors: Array<{ dx: number; dy: number }>;
  blockVectors?: Array<Array<{ dx: number; dy: number }>>;
}

export const STATIC_MAGNITUDE_THRESHOLD = 1.5;
export const DIRECTION_CONSISTENCY_THRESHOLD = 0.7;
export const HANDHELD_DIRECTION_CHANGE_THRESHOLD = 0.4;
export const ZOOM_CORNER_DIVERGENCE_THRESHOLD = 0.3;
export const ZOOM_CENTER_LESS_THAN_CORNER_RATIO = 0.6;

export function computeMotionVectorField(
  frames: ArrayLike<number>[],
  width: number,
  height: number,
  gridSize = 4,
  searchRadius = 4
): MotionVectorField {
  if (frames.length < 2 || width < gridSize || height < gridSize) return { vectors: [] };
  const blockW = Math.floor(width / gridSize);
  const blockH = Math.floor(height / gridSize);
  if (blockW < 2 || blockH < 2) return { vectors: [] };

  const globalVectors: Array<{ dx: number; dy: number }> = [];
  const allBlockVectors: Array<Array<{ dx: number; dy: number }>> = [];

  for (let fi = 0; fi < frames.length - 1; fi += 1) {
    const prev = frames[fi];
    const curr = frames[fi + 1];
    let sumDx = 0;
    let sumDy = 0;
    let blockCount = 0;
    const frameBlocks: Array<{ dx: number; dy: number }> = [];

    for (let gy = 0; gy < gridSize; gy += 1) {
      for (let gx = 0; gx < gridSize; gx += 1) {
        const bx = gx * blockW;
        const by = gy * blockH;
        const best = findBestBlockMatch(prev, curr, width, height, bx, by, blockW, blockH, searchRadius);
        sumDx += best.dx;
        sumDy += best.dy;
        blockCount += 1;
        frameBlocks.push({ dx: best.dx, dy: best.dy });
      }
    }
    if (blockCount > 0) {
      globalVectors.push({ dx: round(sumDx / blockCount), dy: round(sumDy / blockCount) });
      allBlockVectors.push(frameBlocks);
    }
  }
  return { vectors: globalVectors, blockVectors: allBlockVectors };
}

export function classifyMotionType(
  vectors: Array<{ dx: number; dy: number }>,
  blockVectors?: Array<Array<{ dx: number; dy: number }>>,
  gridSize = 4
): ClipMotionType {
  const now = new Date().toISOString();
  if (vectors.length === 0) return { type: 'static', confidence: 1, analyzedAt: now };

  const magnitudes = vectors.map((v) => Math.sqrt(v.dx * v.dx + v.dy * v.dy));
  const meanMagnitude = magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length;

  if (meanMagnitude < STATIC_MAGNITUDE_THRESHOLD) {
    return { type: 'static', confidence: round(Math.min(1, 1 - meanMagnitude / STATIC_MAGNITUDE_THRESHOLD)), analyzedAt: now };
  }

  if (blockVectors && blockVectors.length > 0) {
    const zoomResult = detectZoom(blockVectors, gridSize);
    if (zoomResult) return { type: zoomResult.type, confidence: zoomResult.confidence, analyzedAt: now };
  }

  const directionStats = analyzeDirectionConsistency(vectors);

  if (directionStats.changeRatio > HANDHELD_DIRECTION_CHANGE_THRESHOLD && directionStats.dominantAxisConfidence < DIRECTION_CONSISTENCY_THRESHOLD) {
    return { type: 'handheld', confidence: round(Math.min(1, directionStats.changeRatio)), analyzedAt: now };
  }

  if (directionStats.horizontalRatio > DIRECTION_CONSISTENCY_THRESHOLD) {
    return { type: 'pan', confidence: round(directionStats.horizontalRatio), analyzedAt: now };
  }

  if (directionStats.verticalRatio > DIRECTION_CONSISTENCY_THRESHOLD) {
    return { type: 'tilt', confidence: round(directionStats.verticalRatio), analyzedAt: now };
  }

  if (directionStats.dominantAxisConfidence >= DIRECTION_CONSISTENCY_THRESHOLD) {
    if (directionStats.horizontalRatio > directionStats.verticalRatio) {
      return { type: 'pan', confidence: round(directionStats.horizontalRatio), analyzedAt: now };
    }
    return { type: 'tilt', confidence: round(directionStats.verticalRatio), analyzedAt: now };
  }

  return { type: 'handheld', confidence: round(Math.min(1, directionStats.changeRatio + 0.3)), analyzedAt: now };
}

export function analyzeMotionType(
  frames: ArrayLike<number>[],
  width: number,
  height: number,
  gridSize = 4,
  searchRadius = 4
): { motionType: ClipMotionType; vectorField: MotionVectorField } {
  const vectorField = computeMotionVectorField(frames, width, height, gridSize, searchRadius);
  const motionType = classifyMotionType(vectorField.vectors, vectorField.blockVectors, gridSize);
  return { motionType, vectorField };
}

export function buildSharedMotionData(
  vectors: Array<{ dx: number; dy: number }>
): { shakeVectors: Array<{ dx: number; dy: number }>; meanMagnitude: number; variance: number } {
  if (vectors.length === 0) return { shakeVectors: [], meanMagnitude: 0, variance: 0 };
  const magnitudes = vectors.map((v) => Math.sqrt(v.dx * v.dx + v.dy * v.dy));
  const n = magnitudes.length;
  const meanMagnitude = magnitudes.reduce((a, b) => a + b, 0) / n;
  const variance = magnitudes.reduce((acc, m) => acc + (m - meanMagnitude) * (m - meanMagnitude), 0) / n;
  return { shakeVectors: vectors, meanMagnitude: round(meanMagnitude), variance: round(variance) };
}

export function filterMediaByMotionType(
  media: Array<{ id: string; motionType?: ClipMotionType }>,
  filterType: MotionType
): Array<{ id: string; motionType?: ClipMotionType }> {
  return media.filter((item) => item.motionType?.type === filterType);
}

export interface DirectionStats {
  horizontalRatio: number;
  verticalRatio: number;
  dominantAxisConfidence: number;
  changeRatio: number;
}

export function analyzeDirectionConsistency(vectors: Array<{ dx: number; dy: number }>): DirectionStats {
  if (vectors.length === 0) return { horizontalRatio: 0, verticalRatio: 0, dominantAxisConfidence: 0, changeRatio: 0 };

  let horizontalCount = 0;
  let verticalCount = 0;
  let significantCount = 0;
  let directionChanges = 0;
  let lastAngle: number | null = null;

  for (const v of vectors) {
    const magnitude = Math.sqrt(v.dx * v.dx + v.dy * v.dy);
    if (magnitude < 0.1) continue;
    significantCount += 1;
    if (Math.abs(v.dx) > Math.abs(v.dy)) horizontalCount += 1;
    else verticalCount += 1;

    const angle = Math.atan2(v.dy, v.dx);
    if (lastAngle !== null) {
      const angleDiff = Math.abs(angle - lastAngle);
      const normalizedDiff = Math.min(angleDiff, 2 * Math.PI - angleDiff);
      if (normalizedDiff > Math.PI / 3) directionChanges += 1;
    }
    lastAngle = angle;
  }

  if (significantCount === 0) return { horizontalRatio: 0, verticalRatio: 0, dominantAxisConfidence: 0, changeRatio: 0 };

  const horizontalRatio = round(horizontalCount / significantCount);
  const verticalRatio = round(verticalCount / significantCount);
  const dominantAxisConfidence = Math.max(horizontalRatio, verticalRatio);
  const changeRatio = round(directionChanges / Math.max(1, significantCount - 1));

  return { horizontalRatio, verticalRatio, dominantAxisConfidence, changeRatio };
}

function detectZoom(
  blockVectors: Array<Array<{ dx: number; dy: number }>>,
  gridSize: number
): { type: 'zoom_in' | 'zoom_out'; confidence: number } | null {
  if (blockVectors.length === 0) return null;

  const numBlocks = gridSize * gridSize;
  const avgBlocks: Array<{ dx: number; dy: number }> = Array.from({ length: numBlocks }, () => ({ dx: 0, dy: 0 }));

  for (const frameBlocks of blockVectors) {
    for (let i = 0; i < Math.min(numBlocks, frameBlocks.length); i += 1) {
      avgBlocks[i].dx += frameBlocks[i].dx;
      avgBlocks[i].dy += frameBlocks[i].dy;
    }
  }

  for (const block of avgBlocks) {
    block.dx = round(block.dx / blockVectors.length);
    block.dy = round(block.dy / blockVectors.length);
  }

  const corners = [
    avgBlocks[0],
    avgBlocks[gridSize - 1],
    avgBlocks[(gridSize - 1) * gridSize],
    avgBlocks[(gridSize - 1) * gridSize + gridSize - 1]
  ];

  const centerIdx = Math.floor(gridSize / 2) * gridSize + Math.floor(gridSize / 2);
  const center = avgBlocks[centerIdx];
  const centerMagnitude = Math.sqrt(center.dx * center.dx + center.dy * center.dy);

  const halfW = gridSize / 2;
  const halfH = gridSize / 2;
  let outwardCount = 0;
  let inwardCount = 0;
  let cornerMagnitudes = 0;

  const cornerPositions = [
    { cx: 0, cy: 0 }, { cx: gridSize - 1, cy: 0 },
    { cx: 0, cy: gridSize - 1 }, { cx: gridSize - 1, cy: gridSize - 1 }
  ];

  for (let i = 0; i < 4; i += 1) {
    const corner = corners[i];
    const pos = cornerPositions[i];
    const dirX = pos.cx - halfW;
    const dirY = pos.cy - halfH;
    const mag = Math.sqrt(corner.dx * corner.dx + corner.dy * corner.dy);
    cornerMagnitudes += mag;
    const dot = corner.dx * dirX + corner.dy * dirY;
    if (dot > 0) outwardCount += 1;
    else if (dot < 0) inwardCount += 1;
  }

  const avgCornerMagnitude = cornerMagnitudes / 4;

  if (outwardCount >= 3 && centerMagnitude < avgCornerMagnitude * ZOOM_CENTER_LESS_THAN_CORNER_RATIO) {
    const confidence = round(Math.min(1, (outwardCount / 4) * (1 - centerMagnitude / Math.max(0.001, avgCornerMagnitude))));
    return { type: 'zoom_in', confidence: Math.max(0.5, confidence) };
  }

  if (inwardCount >= 3 && centerMagnitude < avgCornerMagnitude * ZOOM_CENTER_LESS_THAN_CORNER_RATIO) {
    const confidence = round(Math.min(1, (inwardCount / 4) * (1 - centerMagnitude / Math.max(0.001, avgCornerMagnitude))));
    return { type: 'zoom_out', confidence: Math.max(0.5, confidence) };
  }

  return null;
}

function findBestBlockMatch(
  prev: ArrayLike<number>, curr: ArrayLike<number>,
  imgW: number, imgH: number, bx: number, by: number, bW: number, bH: number, radius: number
): { dx: number; dy: number; ncc: number } {
  let bestDx = 0; let bestDy = 0; let bestNcc = -Infinity;
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const ncc = computeBlockNCC(prev, curr, imgW, imgH, bx, by, dx, dy, bW, bH);
      if (ncc > bestNcc) { bestNcc = ncc; bestDx = dx; bestDy = dy; }
    }
  }
  return { dx: bestDx, dy: bestDy, ncc: bestNcc };
}

function computeBlockNCC(
  a: ArrayLike<number>, b: ArrayLike<number>, imgW: number, imgH: number,
  ox: number, oy: number, dx: number, dy: number, bW: number, bH: number
): number {
  let sumA = 0; let sumB = 0; let count = 0;
  for (let y = 0; y < bH; y += 1) {
    for (let x = 0; x < bW; x += 1) {
      const ax = ox + x; const ay = oy + y;
      const bx2 = ax + dx; const by2 = ay + dy;
      if (ax < 0 || ax >= imgW || ay < 0 || ay >= imgH) continue;
      if (bx2 < 0 || bx2 >= imgW || by2 < 0 || by2 >= imgH) continue;
      sumA += a[ay * imgW + ax]; sumB += b[by2 * imgW + bx2]; count += 1;
    }
  }
  if (count === 0) return 0;
  const meanA = sumA / count; const meanB = sumB / count;
  let dot = 0; let normA = 0; let normB = 0;
  for (let y = 0; y < bH; y += 1) {
    for (let x = 0; x < bW; x += 1) {
      const ax = ox + x; const ay = oy + y;
      const bx2 = ax + dx; const by2 = ay + dy;
      if (ax < 0 || ax >= imgW || ay < 0 || ay >= imgH) continue;
      if (bx2 < 0 || bx2 >= imgW || by2 < 0 || by2 >= imgH) continue;
      const dA = a[ay * imgW + ax] - meanA; const dB = b[by2 * imgW + bx2] - meanB;
      dot += dA * dB; normA += dA * dA; normB += dB * dB;
    }
  }
  const denom = Math.sqrt(normA * normB);
  return denom > 0 ? dot / denom : 0;
}

export async function analyzeMotionTypeSafe(
  frames: ArrayLike<number>[],
  width: number,
  height: number,
  gridSize = 4,
  searchRadius = 4,
  t: TranslateFn = identityTranslator
): Promise<AiModuleResult<{ motionType: ClipMotionType; vectorField: MotionVectorField }>> {
  try {
    const data = analyzeMotionType(frames, width, height, gridSize, searchRadius);
    return { data, error: null, isProcessing: false };
  } catch {
    return {
      data: { motionType: { type: 'static', confidence: 0, analyzedAt: '' }, vectorField: { vectors: [] } },
      error: t('aiModules.error.computationFailed'),
      isProcessing: false,
    };
  }
}

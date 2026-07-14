/**
 * AI PiP (picture-in-picture) smart avoidance.
 *
 * Given subject bounding boxes from the main video (e.g. from reframe AI),
 * evaluates 4 candidate corner positions for a PiP overlay and picks
 * the one with least overlap. Ties broken by rule-of-thirds composition.
 */

import { round } from './time';

// -- Public types ------------------------------------------------

export type PipCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface PipPlacementSuggestion {
  recommendedCorner: PipCorner;
  /** Overlap reduction (percentage) compared to worst corner */
  overlapReduction: number;
  /** Confidence 0-1 */
  confidence: number;
}

export interface BoundingBox {
  x: number; // normalised [0,1] left edge
  y: number; // normalised [0,1] top edge
  w: number; // normalised [0,1] width
  h: number; // normalised [0,1] height
}

// -- Overlap calculation -----------------------------------------

/**
 * Calculate the overlap area between a normalised bounding box and
 * a normalised rectangle, as a percentage of the bbox area.
 */
export function calculateBboxOverlap(bbox: BoundingBox, rect: { x: number; y: number; w: number; h: number }): number {
  const bboxArea = bbox.w * bbox.h;
  if (bboxArea <= 0) return 0;

  const overlapX = Math.max(0, Math.min(bbox.x + bbox.w, rect.x + rect.w) - Math.max(bbox.x, rect.x));
  const overlapY = Math.max(0, Math.min(bbox.y + bbox.h, rect.y + rect.h) - Math.max(bbox.y, rect.y));
  const overlapArea = overlapX * overlapY;

  return round((overlapArea / bboxArea) * 100);
}

// -- Candidate position scoring ----------------------------------

/**
 * For a single corner, compute the PiP rectangle position in normalised
 * coordinates, then calculate overlap with the subject bbox.
 */
export function evaluateCandidatePosition(
  subjectBbox: BoundingBox,
  canvasW: number,
  canvasH: number,
  pipW: number,
  pipH: number,
  corner: PipCorner,
  margin: number = 0.025,
): { overlap: number; thirdsScore: number } {
  const normPipW = pipW / canvasW;
  const normPipH = pipH / canvasH;
  const m = margin;

  let x: number;
  let y: number;
  switch (corner) {
    case 'top-left':
      x = m;
      y = m;
      break;
    case 'top-right':
      x = 1 - m - normPipW;
      y = m;
      break;
    case 'bottom-left':
      x = m;
      y = 1 - m - normPipH;
      break;
    case 'bottom-right':
    default:
      x = 1 - m - normPipW;
      y = 1 - m - normPipH;
      break;
  }

  const pipRect = { x, y, w: normPipW, h: normPipH };
  const overlap = calculateBboxOverlap(subjectBbox, pipRect);

  // Rule-of-thirds tie-break: distance from PiP center to nearest
  // third-line intersection point (lower is better for composition).
  const pipCenterX = x + normPipW / 2;
  const pipCenterY = y + normPipH / 2;
  const thirdsX = [1 / 3, 2 / 3];
  const thirdsY = [1 / 3, 2 / 3];
  let minDist = Infinity;
  for (const tx of thirdsX) {
    for (const ty of thirdsY) {
      const d = Math.sqrt((pipCenterX - tx) ** 2 + (pipCenterY - ty) ** 2);
      if (d < minDist) minDist = d;
    }
  }
  // Invert so higher is better (closer to thirds point = higher score)
  const thirdsScore = round(1 / (1 + minDist * 10));

  return { overlap, thirdsScore };
}

// -- Main suggestion algorithm -----------------------------------

const ALL_CORNERS: PipCorner[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

/**
 * Suggest the best PiP corner position given subject bounding boxes
 * from multiple sampled frames.
 *
 * For each corner, computes average overlap across all sampled bboxes,
 * then picks the corner with lowest overlap. Ties broken by rule-of-thirds
 * proximity.
 */
export function suggestPipPlacement(
  subjectBboxes: BoundingBox[],
  canvasW: number,
  canvasH: number,
  pipW: number,
  pipH: number,
  margin?: number,
): PipPlacementSuggestion {
  if (subjectBboxes.length === 0 || canvasW <= 0 || canvasH <= 0 || pipW <= 0 || pipH <= 0) {
    return { recommendedCorner: 'bottom-right', overlapReduction: 0, confidence: 0 };
  }

  const cornerScores = ALL_CORNERS.map((corner) => {
    let totalOverlap = 0;
    let totalThirds = 0;
    for (const bbox of subjectBboxes) {
      const { overlap, thirdsScore } = evaluateCandidatePosition(bbox, canvasW, canvasH, pipW, pipH, corner, margin);
      totalOverlap += overlap;
      totalThirds += thirdsScore;
    }
    return {
      corner,
      avgOverlap: totalOverlap / subjectBboxes.length,
      avgThirds: totalThirds / subjectBboxes.length,
    };
  });

  // Sort: lowest overlap first; ties broken by highest thirds score
  cornerScores.sort((a, b) => {
    const overlapDiff = a.avgOverlap - b.avgOverlap;
    if (Math.abs(overlapDiff) > 0.5) return overlapDiff;
    return b.avgThirds - a.avgThirds;
  });

  const best = cornerScores[0];
  const worst = cornerScores[cornerScores.length - 1];
  const overlapReduction = round(Math.max(0, worst.avgOverlap - best.avgOverlap));

  // Confidence: higher when there's a clear winner
  const runnerUp = cornerScores[1];
  const margin2 = runnerUp ? runnerUp.avgOverlap - best.avgOverlap : 0;
  const confidence = round(Math.min(1, Math.max(0, margin2 / 20 + (best.avgOverlap < 5 ? 0.3 : 0))));

  return {
    recommendedCorner: best.corner,
    overlapReduction,
    confidence,
  };
}

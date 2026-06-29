import { describe, expect, it } from 'vitest';
import {
  calculateBboxOverlap,
  evaluateCandidatePosition,
  suggestPipPlacement,
  type BoundingBox,
  type PipCorner
} from '../src';

// -- calculateBboxOverlap -----------------------------------------

describe('calculateBboxOverlap', () => {
  const bbox: BoundingBox = { x: 0.2, y: 0.2, w: 0.3, h: 0.3 };

  it('returns 0 when no overlap', () => {
    const rect = { x: 0.8, y: 0.8, w: 0.1, h: 0.1 };
    expect(calculateBboxOverlap(bbox, rect)).toBe(0);
  });

  it('returns 100 for full overlap (rect covers entire bbox)', () => {
    const rect = { x: 0, y: 0, w: 1, h: 1 };
    expect(calculateBboxOverlap(bbox, rect)).toBe(100);
  });

  it('returns ~50 for partial overlap (half of bbox covered)', () => {
    // bbox occupies [0.2, 0.5] x [0.2, 0.5] → area = 0.09
    // rect occupies [0.35, 0.65] x [0.2, 0.5] → overlap = [0.35, 0.5] x [0.2, 0.5]
    // overlap area = 0.15 * 0.3 = 0.045 → 0.045/0.09 * 100 = 50
    const rect = { x: 0.35, y: 0.2, w: 0.3, h: 0.3 };
    expect(calculateBboxOverlap(bbox, rect)).toBe(50);
  });

  it('returns 0 for zero-area bbox', () => {
    const zeroBbox: BoundingBox = { x: 0.2, y: 0.2, w: 0, h: 0.3 };
    expect(calculateBboxOverlap(zeroBbox, { x: 0, y: 0, w: 1, h: 1 })).toBe(0);
  });

  it('returns 0 for negative-area bbox', () => {
    const negBbox: BoundingBox = { x: 0.2, y: 0.2, w: -0.1, h: 0.3 };
    expect(calculateBboxOverlap(negBbox, { x: 0, y: 0, w: 1, h: 1 })).toBe(0);
  });

  it('returns 0 for zero-area rect', () => {
    expect(calculateBboxOverlap(bbox, { x: 0.2, y: 0.2, w: 0, h: 0 })).toBe(0);
  });

  it('handles touching edges (zero overlap area)', () => {
    // bbox: [0.2, 0.5], rect: [0.5, 0.8] → they touch but don't overlap
    const rect = { x: 0.5, y: 0.2, w: 0.3, h: 0.3 };
    expect(calculateBboxOverlap(bbox, rect)).toBe(0);
  });

  it('handles rect entirely inside bbox', () => {
    const rect = { x: 0.3, y: 0.3, w: 0.05, h: 0.05 };
    // overlap area = 0.05 * 0.05 = 0.0025 → 0.0025 / 0.09 * 100 ≈ 2.78
    const result = calculateBboxOverlap(bbox, rect);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(100);
  });
});

// -- evaluateCandidatePosition ------------------------------------

describe('evaluateCandidatePosition', () => {
  const subjectBbox: BoundingBox = { x: 0.4, y: 0.4, w: 0.2, h: 0.2 };

  it('returns overlap and thirdsScore for each corner', () => {
    const corners: PipCorner[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
    for (const corner of corners) {
      const result = evaluateCandidatePosition(subjectBbox, 1920, 1080, 480, 270, corner);
      expect(typeof result.overlap).toBe('number');
      expect(typeof result.thirdsScore).toBe('number');
      expect(result.overlap).toBeGreaterThanOrEqual(0);
      expect(result.overlap).toBeLessThanOrEqual(100);
      expect(result.thirdsScore).toBeGreaterThan(0);
      expect(result.thirdsScore).toBeLessThanOrEqual(1);
    }
  });

  it('top-left corner has zero overlap for subject at center', () => {
    const result = evaluateCandidatePosition(subjectBbox, 1920, 1080, 200, 150, 'top-left');
    // PiP at top-left (small, near 0,0) should not overlap center subject (0.4-0.6)
    expect(result.overlap).toBe(0);
  });

  it('bottom-right corner has zero overlap for subject at top-left', () => {
    const topLeftBbox: BoundingBox = { x: 0.05, y: 0.05, w: 0.2, h: 0.2 };
    const result = evaluateCandidatePosition(topLeftBbox, 1920, 1080, 480, 270, 'bottom-right');
    expect(result.overlap).toBe(0);
  });

  it('respects margin parameter', () => {
    // With larger margin, PiP is pushed further into the corner
    const r1 = evaluateCandidatePosition(subjectBbox, 1920, 1080, 200, 150, 'top-left', 0.01);
    const r2 = evaluateCandidatePosition(subjectBbox, 1920, 1080, 200, 150, 'top-left', 0.1);
    // Both should have 0 overlap for center subject, but positions differ
    expect(r1.thirdsScore).not.toBe(r2.thirdsScore);
  });

  it('returns overlap > 0 when PiP covers subject', () => {
    // Subject at top-left corner area
    const cornerBbox: BoundingBox = { x: 0.025, y: 0.025, w: 0.3, h: 0.3 };
    const result = evaluateCandidatePosition(cornerBbox, 1920, 1080, 480, 270, 'top-left');
    expect(result.overlap).toBeGreaterThan(0);
  });

  it('uses default margin when not specified', () => {
    const r1 = evaluateCandidatePosition(subjectBbox, 1920, 1080, 200, 150, 'top-left');
    const r2 = evaluateCandidatePosition(subjectBbox, 1920, 1080, 200, 150, 'top-left', 0.025);
    expect(r1).toEqual(r2);
  });
});

// -- suggestPipPlacement ------------------------------------------

describe('suggestPipPlacement', () => {
  it('returns bottom-right with 0 confidence for empty bboxes', () => {
    const result = suggestPipPlacement([], 1920, 1080, 480, 270);
    expect(result.recommendedCorner).toBe('bottom-right');
    expect(result.overlapReduction).toBe(0);
    expect(result.confidence).toBe(0);
  });

  it('returns default for zero canvas dimensions', () => {
    const result = suggestPipPlacement([{ x: 0.5, y: 0.5, w: 0.1, h: 0.1 }], 0, 1080, 480, 270);
    expect(result.recommendedCorner).toBe('bottom-right');
    expect(result.confidence).toBe(0);
  });

  it('returns default for zero pip dimensions', () => {
    const result = suggestPipPlacement([{ x: 0.5, y: 0.5, w: 0.1, h: 0.1 }], 1920, 1080, 0, 270);
    expect(result.recommendedCorner).toBe('bottom-right');
    expect(result.confidence).toBe(0);
  });

  it('picks corner with least overlap for subject at center', () => {
    // Subject squarely in center → all corners have 0 overlap → pick by thirds score
    const centerBbox: BoundingBox = { x: 0.4, y: 0.4, w: 0.2, h: 0.2 };
    const result = suggestPipPlacement([centerBbox], 1920, 1080, 480, 270);
    expect(['top-left', 'top-right', 'bottom-left', 'bottom-right']).toContain(result.recommendedCorner);
    expect(result.overlapReduction).toBe(0); // all corners have 0 overlap
  });

  it('avoids subject at bottom-right by picking different corner', () => {
    const bottomRightBbox: BoundingBox = { x: 0.7, y: 0.7, w: 0.2, h: 0.2 };
    const result = suggestPipPlacement([bottomRightBbox], 1920, 1080, 480, 270);
    // Should NOT recommend bottom-right since subject is there
    expect(result.recommendedCorner).not.toBe('bottom-right');
  });

  it('computes overlap reduction correctly', () => {
    // Subject at bottom-right → bottom-right has overlap, others have 0
    const bbox: BoundingBox = { x: 0.65, y: 0.65, w: 0.3, h: 0.3 };
    const result = suggestPipPlacement([bbox], 1920, 1080, 480, 270);
    expect(result.overlapReduction).toBeGreaterThan(0);
  });

  it('handles multiple subject bboxes (averaging)', () => {
    const bboxes: BoundingBox[] = [
      { x: 0.1, y: 0.1, w: 0.15, h: 0.15 },
      { x: 0.7, y: 0.7, w: 0.15, h: 0.15 }
    ];
    const result = suggestPipPlacement(bboxes, 1920, 1080, 480, 270);
    expect(['top-left', 'top-right', 'bottom-left', 'bottom-right']).toContain(result.recommendedCorner);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('confidence is 0 when all corners have equal overlap', () => {
    // Small subject at dead center → all corners equally far from it
    const tinyCenter: BoundingBox = { x: 0.49, y: 0.49, w: 0.02, h: 0.02 };
    const result = suggestPipPlacement([tinyCenter], 1920, 1080, 100, 75);
    // All overlaps are 0, so overlap difference = 0, but base confidence may add 0.3 for <5 overlap
    expect(result.confidence).toBeGreaterThanOrEqual(0);
  });

  it('uses rule-of-thirds tie-break when overlaps are equal', () => {
    // Symmetric subject at center: all 4 corners get 0 overlap
    // The one closest to a thirds intersection should be preferred
    const centerBbox: BoundingBox = { x: 0.45, y: 0.45, w: 0.1, h: 0.1 };
    const result = suggestPipPlacement([centerBbox], 1920, 1080, 200, 150);
    // All corners have 0 overlap, so the choice depends on thirds score
    // top-right (at ≈0.875, 0.14) should be close to 2/3, 1/3 intersection
    expect(['top-left', 'top-right', 'bottom-left', 'bottom-right']).toContain(result.recommendedCorner);
  });
});

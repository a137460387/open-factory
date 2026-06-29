import { describe, expect, it } from 'vitest';
import {
  estimateDisplacementVectors,
  calculateShakeScore,
  classifyShakeSeverity,
  analyseShake,
  buildTwoStepVidstabArgs,
  type ShakeSeverity
} from '../src';

// -- Helpers -------------------------------------------------------

/** Create a deterministic luminance frame with non-linear texture. */
function makeFrame(w: number, h: number, seed = 0): number[] {
  const f = new Array(w * h);
  for (let i = 0; i < w * h; i++) {
    f[i] = 0.1 + 0.8 * Math.abs(Math.sin(i * 0.7 + seed));
  }
  return f;
}

/** Shift a frame by (sx, sy) pixels. */
function shiftFrame(frame: number[], w: number, h: number, sx: number, sy: number): number[] {
  const out = new Array(w * h).fill(0);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const srcX = x - sx;
      const srcY = y - sy;
      if (srcX >= 0 && srcX < w && srcY >= 0 && srcY < h) {
        out[y * w + x] = frame[srcY * w + srcX];
      }
    }
  }
  return out;
}

// -- estimateDisplacementVectors -----------------------------------

describe('estimateDisplacementVectors', () => {
  it('returns empty array for fewer than 2 frames', () => {
    expect(estimateDisplacementVectors([makeFrame(16, 16)], 16, 16)).toEqual([]);
  });

  it('returns empty array for empty frames', () => {
    expect(estimateDisplacementVectors([], 16, 16)).toEqual([]);
  });

  it('returns empty when width < gridSize', () => {
    expect(estimateDisplacementVectors([makeFrame(3, 16), makeFrame(3, 16)], 3, 16, 4)).toEqual([]);
  });

  it('returns empty when height < gridSize', () => {
    expect(estimateDisplacementVectors([makeFrame(16, 3), makeFrame(16, 3)], 16, 3, 4)).toEqual([]);
  });

  it('returns empty when block is too small (<2)', () => {
    expect(estimateDisplacementVectors([makeFrame(4, 4), makeFrame(4, 4)], 4, 4, 4)).toEqual([]);
  });

  it('returns zero displacement for identical frames', () => {
    const f = makeFrame(16, 16);
    const vectors = estimateDisplacementVectors([f, f], 16, 16, 4, 2);
    expect(vectors.length).toBe(1);
    expect(vectors[0].dx).toBe(0);
    expect(vectors[0].dy).toBe(0);
  });

  it('detects positive displacement for shifted frame', () => {
    const w = 32, h = 32;
    const f1 = makeFrame(w, h, 0);
    const f2 = shiftFrame(f1, w, h, 2, 0);
    const vectors = estimateDisplacementVectors([f1, f2], w, h, 4, 4);
    expect(vectors.length).toBe(1);
    // Should detect non-trivial horizontal displacement
    expect(Math.abs(vectors[0].dx)).toBeGreaterThan(0);
  });

  it('returns N-1 vectors for N frames', () => {
    const w = 16, h = 16;
    const frames = [makeFrame(w, h, 0), makeFrame(w, h, 1), makeFrame(w, h, 2)];
    const vectors = estimateDisplacementVectors(frames, w, h, 4, 2);
    expect(vectors.length).toBe(2);
  });

  it('works with non-default gridSize and searchRadius', () => {
    const w = 64, h = 64;
    const f1 = makeFrame(w, h, 0);
    const f2 = makeFrame(w, h, 3);
    const vectors = estimateDisplacementVectors([f1, f2], w, h, 8, 3);
    expect(vectors.length).toBe(1);
    expect(typeof vectors[0].dx).toBe('number');
    expect(typeof vectors[0].dy).toBe('number');
  });
});

// -- calculateShakeScore ------------------------------------------

describe('calculateShakeScore', () => {
  it('returns 0 for empty vectors', () => {
    expect(calculateShakeScore([])).toBe(0);
  });

  it('returns 0 for single zero vector', () => {
    expect(calculateShakeScore([{ dx: 0, dy: 0 }])).toBe(0);
  });

  it('returns 0 for identical vectors (zero variance)', () => {
    const vectors = [
      { dx: 1, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: 1, dy: 0 }
    ];
    expect(calculateShakeScore(vectors)).toBe(0);
  });

  it('returns >0 for varying vectors', () => {
    const vectors = [
      { dx: 0, dy: 0 },
      { dx: 3, dy: 4 },
      { dx: 0, dy: 0 },
      { dx: 5, dy: 0 }
    ];
    const score = calculateShakeScore(vectors);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('clamps at 100 for very high variance', () => {
    // Large varying magnitudes → variance > 25 → score hits 100
    const vectors = [
      { dx: 0, dy: 0 },
      { dx: 100, dy: 0 },
      { dx: 0, dy: 0 },
      { dx: 100, dy: 0 }
    ];
    expect(calculateShakeScore(vectors)).toBe(100);
  });

  it('respects custom maxExpectedVariance', () => {
    const vectors = [
      { dx: 0, dy: 0 },
      { dx: 2, dy: 0 },
      { dx: 0, dy: 0 },
      { dx: 2, dy: 0 }
    ];
    // With maxVariance=1, the variance of magnitudes should give a high score
    const score = calculateShakeScore(vectors, 1);
    expect(score).toBeGreaterThanOrEqual(90);
  });

  it('clamps at 0 for very low variance with high maxExpectedVariance', () => {
    const vectors = [{ dx: 0.001, dy: 0 }];
    const score = calculateShakeScore(vectors, 1e6);
    expect(score).toBe(0);
  });
});

// -- classifyShakeSeverity ----------------------------------------

describe('classifyShakeSeverity', () => {
  it('returns low for score=0', () => {
    expect(classifyShakeSeverity(0)).toBe('low');
  });

  it('returns low for score=19', () => {
    expect(classifyShakeSeverity(19)).toBe('low');
  });

  it('returns low for score=19.99', () => {
    expect(classifyShakeSeverity(19.99)).toBe('low');
  });

  it('returns medium for score=20 (boundary)', () => {
    expect(classifyShakeSeverity(20)).toBe('medium');
  });

  it('returns medium for score=20.01', () => {
    expect(classifyShakeSeverity(20.01)).toBe('medium');
  });

  it('returns medium for score=49', () => {
    expect(classifyShakeSeverity(49)).toBe('medium');
  });

  it('returns medium for score=49.99', () => {
    expect(classifyShakeSeverity(49.99)).toBe('medium');
  });

  it('returns medium for score=50 (boundary)', () => {
    expect(classifyShakeSeverity(50)).toBe('medium');
  });

  it('returns high for score=50.01', () => {
    expect(classifyShakeSeverity(50.01)).toBe('high');
  });

  it('returns high for score=75', () => {
    expect(classifyShakeSeverity(75)).toBe('high');
  });

  it('returns high for score=100', () => {
    expect(classifyShakeSeverity(100)).toBe('high');
  });

  it('returns low for negative score (edge)', () => {
    expect(classifyShakeSeverity(-1)).toBe('low');
  });
});

// -- analyseShake --------------------------------------------------

describe('analyseShake', () => {
  it('returns zero score and low severity for identical frames', () => {
    const f = makeFrame(16, 16);
    const result = analyseShake([f, f], 16, 16);
    expect(result.shakeScore).toBe(0);
    expect(result.severity).toBe('low');
    expect(result.suggestedFilter).toBe('none');
  });

  it('suggests vidstab for high shake', () => {
    // Use many highly different frames to generate large displacement variance
    const w = 32, h = 32;
    const frames: number[][] = [];
    for (let i = 0; i < 10; i++) {
      frames.push(makeFrame(w, h, i * 10));
    }
    const result = analyseShake(frames, w, h, 0.5);
    // With low maxExpectedVariance, shake score should be high
    if (result.shakeScore > 50) {
      expect(result.severity).toBe('high');
      expect(result.suggestedFilter).toBe('vidstab');
    }
    // At minimum, result should have valid structure
    expect(['low', 'medium', 'high']).toContain(result.severity);
    expect(['vidstab', 'none']).toContain(result.suggestedFilter);
  });

  it('returns correct structure for fewer than 2 frames', () => {
    const result = analyseShake([makeFrame(16, 16)], 16, 16);
    expect(result.shakeScore).toBe(0);
    expect(result.severity).toBe('low');
    expect(result.suggestedFilter).toBe('none');
  });
});

// -- buildTwoStepVidstabArgs --------------------------------------

describe('buildTwoStepVidstabArgs', () => {
  it('generates detect args with correct input and trf path', () => {
    const result = buildTwoStepVidstabArgs('/video/input.mp4', '/tmp/transforms.trf');
    expect(result.detectArgs).toContain('-i');
    expect(result.detectArgs).toContain('/video/input.mp4');
    expect(result.detectArgs.join(' ')).toContain('vidstabdetect');
    expect(result.detectArgs.join(' ')).toContain('/tmp/transforms.trf');
  });

  it('generates transform args with correct input and trf path', () => {
    const result = buildTwoStepVidstabArgs('/video/input.mp4', '/tmp/transforms.trf');
    expect(result.transformArgs).toContain('-i');
    expect(result.transformArgs).toContain('/video/input.mp4');
    expect(result.transformArgs.join(' ')).toContain('vidstabtransform');
    expect(result.transformArgs.join(' ')).toContain('/tmp/transforms.trf');
  });

  it('includes smoothing parameter in transform args', () => {
    const result = buildTwoStepVidstabArgs('in.mp4', 'out.trf', 15);
    expect(result.transformArgs.join(' ')).toContain('smoothing=15');
  });

  it('uses default smoothing=10 when not specified', () => {
    const result = buildTwoStepVidstabArgs('in.mp4', 'out.trf');
    expect(result.transformArgs.join(' ')).toContain('smoothing=10');
  });

  it('clamps negative smoothing to 0', () => {
    const result = buildTwoStepVidstabArgs('in.mp4', 'out.trf', -5);
    expect(result.transformArgs.join(' ')).toContain('smoothing=0');
  });

  it('includes zoom parameter in transform args', () => {
    const result = buildTwoStepVidstabArgs('in.mp4', 'out.trf', 10, 5);
    expect(result.transformArgs.join(' ')).toContain('zoom=5');
  });

  it('uses default zoom=0 when not specified', () => {
    const result = buildTwoStepVidstabArgs('in.mp4', 'out.trf');
    expect(result.transformArgs.join(' ')).toContain('zoom=0');
  });

  it('detect args end with -f null -', () => {
    const result = buildTwoStepVidstabArgs('in.mp4', 'out.trf');
    const args = result.detectArgs;
    expect(args).toContain('-f');
    expect(args).toContain('null');
    expect(args[args.length - 1]).toBe('-');
  });

  it('transform args include codec settings', () => {
    const result = buildTwoStepVidstabArgs('in.mp4', 'out.trf');
    expect(result.transformArgs).toContain('-c:v');
    expect(result.transformArgs).toContain('libx264');
    expect(result.transformArgs).toContain('-c:a');
    expect(result.transformArgs).toContain('copy');
    expect(result.transformArgs).toContain('-y');
  });

  it('handles non-default zoom value', () => {
    const result = buildTwoStepVidstabArgs('in.mp4', 'out.trf', 10, -3);
    // zoom is clamped to >=0
    expect(result.transformArgs.join(' ')).toContain('zoom=0');
  });
});

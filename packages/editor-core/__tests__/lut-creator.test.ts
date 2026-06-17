import { describe, expect, it } from 'vitest';
import {
  buildLutCreatorMatrix,
  buildLutCreatorReferenceTransform,
  createDefaultLutCreatorState,
  normalizeColorCurves,
  normalizeLutCreatorPrecision,
  normalizeLutCreatorState,
  serializeLutCreatorCube,
  type ColorMatchFrameSample
} from '../src';

function sampleFromPixels(pixels: Array<[number, number, number, number?]>): ColorMatchFrameSample {
  return {
    width: pixels.length,
    height: 1,
    data: pixels.flatMap(([r, g, b, a = 255]) => [r, g, b, a])
  };
}

describe('3D LUT creator', () => {
  it('turns lift, gamma, and gain edits into a 3D LUT matrix', () => {
    const state = {
      ...createDefaultLutCreatorState(),
      precision: 17 as const,
      threeWayColor: {
        lift: { r: 0.1, g: 0, b: 0, intensity: 1 },
        gamma: { r: 0, g: 0, b: 0.5, intensity: 1 },
        gain: { r: 0, g: 0.25, b: 0, intensity: 1 }
      }
    };

    const matrix = buildLutCreatorMatrix(state);
    const white = matrix.values.at(-1);
    const black = matrix.values[0];

    expect(matrix.size).toBe(17);
    expect(matrix.values).toHaveLength(17 ** 3);
    expect(black.r).toBeGreaterThan(0);
    expect(white?.g).toBe(1);
    expect(white?.b).toBeCloseTo(1, 3);
  });

  it('samples color curves across the generated 3D grid', () => {
    const state = {
      ...createDefaultLutCreatorState(),
      precision: 17 as const,
      colorCurves: {
        ...normalizeColorCurves(undefined),
        r: [
          { x: 0, y: 0 },
          { x: 1, y: 0.5 }
        ],
        b: [
          { x: 0, y: 0.2 },
          { x: 1, y: 1 }
        ]
      }
    };

    const matrix = buildLutCreatorMatrix(state);
    const saturatedRedIndex = 16;
    const saturatedRed = matrix.values[saturatedRedIndex];

    expect(saturatedRed.r).toBeCloseTo(0.5, 3);
    expect(saturatedRed.g).toBeCloseTo(0, 3);
    expect(saturatedRed.b).toBeGreaterThan(0.15);
  });

  it('serializes a standards-compatible 3D .cube file', () => {
    const cube = serializeLutCreatorCube({ ...createDefaultLutCreatorState(), precision: 33, title: 'Unit Test LUT' });
    const lines = cube.trim().split('\n');

    expect(lines.slice(0, 4)).toEqual(['TITLE "Unit Test LUT"', 'LUT_3D_SIZE 33', 'DOMAIN_MIN 0 0 0', 'DOMAIN_MAX 1 1 1']);
    expect(lines).toHaveLength(4 + 33 ** 3);
    expect(lines[4]).toBe('0 0 0');
    expect(lines.at(-1)).toBe('1 1 1');
  });

  it('derives a safe reference-image match transform', () => {
    const transform = buildLutCreatorReferenceTransform(sampleFromPixels([[217, 85, 63], [240, 120, 92]]));

    expect(transform).toMatchObject({
      r: { sourceMean: expect.any(Number), slope: expect.any(Number), intercept: expect.any(Number) },
      g: { sourceMean: expect.any(Number), slope: expect.any(Number), intercept: expect.any(Number) },
      b: { sourceMean: expect.any(Number), slope: expect.any(Number), intercept: expect.any(Number) }
    });
    expect(transform?.r.intercept).toBeGreaterThan(transform?.b.intercept ?? 0);
  });

  it('normalizes invalid precision, titles, and reference transform values', () => {
    const state = normalizeLutCreatorState({
      title: '  Look\n"One"  ',
      precision: 65.2,
      referenceName: ' reference.png ',
      referenceTransform: {
        r: { slope: Number.POSITIVE_INFINITY, intercept: -5, sourceMean: 2 },
        g: { slope: 9, intercept: undefined as unknown as number, sourceMean: Number.NaN },
        b: { slope: -9, intercept: 3, sourceMean: -1 }
      }
    });

    expect(normalizeLutCreatorPrecision(34)).toBe(17);
    expect(state.title).toBe('Look  One');
    expect(state.precision).toBe(65);
    expect(state.referenceName).toBe('reference.png');
    expect(state.referenceTransform).toEqual({
      r: { slope: 1, intercept: -2, sourceMean: 1 },
      g: { slope: 8, intercept: 0, sourceMean: 0.5 },
      b: { slope: -8, intercept: 2, sourceMean: 0 }
    });
  });

  it('falls back cleanly without a reference image and sanitizes cube titles', () => {
    const cube = serializeLutCreatorCube({ ...createDefaultLutCreatorState(), precision: 17 }, '  Title\n"Unsafe"  ');

    expect(buildLutCreatorReferenceTransform(undefined)).toBeNull();
    expect(cube.split('\n')[0]).toBe('TITLE "Title  Unsafe"');
  });
});

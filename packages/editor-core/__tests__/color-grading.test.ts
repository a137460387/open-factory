import { describe, expect, it } from 'vitest';
import {
  applyThreeWayColor,
  createDefaultThreeWayColor,
  isDefaultColorCurves,
  isNeutralThreeWayColor,
  normalizeColorCurves,
  normalizeThreeWayColor,
  sampleColorCurves,
  sampleCurve,
  serializeColorCurvesToCube,
  type ColorCurves
} from '../src';

describe('color grading helpers', () => {
  it('samples Catmull-Rom color curves through control points', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 0.5, y: 0.25 },
      { x: 1, y: 1 }
    ];

    expect(sampleCurve(points, 0.5)).toBe(0.25);
    expect(sampleCurve(points, 0.25)).toBeCloseTo(0.078125, 6);
    expect(sampleCurve(points, -1)).toBe(0);
    expect(sampleCurve(points, 2)).toBe(1);
  });

  it('applies master curves before RGB channel curves', () => {
    const curves: ColorCurves = {
      ...normalizeColorCurves(undefined),
      master: [
        { x: 0, y: 0 },
        { x: 0.5, y: 0.3 },
        { x: 1, y: 1 }
      ],
      r: [
        { x: 0, y: 0 },
        { x: 1, y: 0.5 }
      ]
    };

    const sample = sampleColorCurves(curves, 1);

    expect(sample.r).toBe(0.5);
    expect(sample.g).toBe(1);
    expect(sample.b).toBe(1);
  });

  it('keeps two point default curves linear', () => {
    expect(sampleCurve(undefined, 47 / 255)).toBeCloseTo(47 / 255, 6);
    const sample = sampleColorCurves(undefined, 209 / 255);
    expect(sample.r).toBeCloseTo(209 / 255, 6);
    expect(sample.g).toBeCloseTo(209 / 255, 6);
    expect(sample.b).toBeCloseTo(209 / 255, 6);
  });

  it('serializes color curves as a 17 point 1D cube LUT', () => {
    const cube = serializeColorCurvesToCube(
      {
        ...normalizeColorCurves(undefined),
        master: [
          { x: 0, y: 0 },
          { x: 1, y: 1 }
        ],
        r: [
          { x: 0, y: 1 },
          { x: 1, y: 1 }
        ]
      },
      17,
      'Unit Test Curves'
    );
    const lines = cube.trim().split('\n');

    expect(lines.slice(0, 4)).toEqual(['TITLE "Unit Test Curves"', 'LUT_1D_SIZE 17', 'DOMAIN_MIN 0 0 0', 'DOMAIN_MAX 1 1 1']);
    expect(lines).toHaveLength(21);
    expect(lines[4]).toBe('1 0 0');
    expect(lines.at(-1)).toBe('1 1 1');
  });

  it('normalizes curve and wheel defaults', () => {
    expect(isDefaultColorCurves(undefined)).toBe(true);
    expect(isDefaultColorCurves({ master: [{ x: 0, y: 1 }, { x: 1, y: 1 }] })).toBe(false);
    expect(isNeutralThreeWayColor(createDefaultThreeWayColor())).toBe(true);
    expect(normalizeThreeWayColor({ lift: { r: 9, intensity: -1 } }).lift).toEqual({ r: 1, g: 0, b: 0, intensity: 0 });
  });

  it('applies ASC CDL lift gamma gain per channel', () => {
    const result = applyThreeWayColor(
      { r: 0.25, g: 0.5, b: 0.75 },
      {
        lift: { r: 0.1, g: 0, b: 0, intensity: 1 },
        gamma: { r: 0, g: 0, b: 1, intensity: 1 },
        gain: { r: 0, g: 0.2, b: 0, intensity: 1 }
      }
    );

    expect(result.r).toBeCloseTo(0.35, 6);
    expect(result.g).toBeCloseTo(0.6, 6);
    expect(result.b).toBeCloseTo(Math.sqrt(0.75), 6);
  });
});

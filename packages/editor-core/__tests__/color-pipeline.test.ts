import { describe, expect, it } from 'vitest';
import {
  CAMERA_IDT_MATRICES,
  applyHillAcesToneMap,
  buildAcesOdtFilterChain,
  normalizeProjectColorPipeline,
  type CameraIdtMatrixId
} from '../src';

describe('project color pipeline', () => {
  it('ships complete 3x3 IDT matrices for supported camera log profiles', () => {
    const expectedIds: CameraIdtMatrixId[] = ['arri-logc3', 'sony-slog3', 'red-log3g10', 'canon-log3'];

    expect(Object.keys(CAMERA_IDT_MATRICES).sort()).toEqual([...expectedIds].sort());
    for (const id of expectedIds) {
      const matrix = CAMERA_IDT_MATRICES[id];
      expect(matrix).toHaveLength(3);
      for (const row of matrix) {
        expect(row).toHaveLength(3);
        for (const value of row) {
          expect(Number.isFinite(value)).toBe(true);
        }
      }
    }
  });

  it('builds ACES ODT zscale filters and skips SDR pipelines', () => {
    expect(buildAcesOdtFilterChain('sdr-srgb', 'srgb')).toEqual([]);

    const filters = buildAcesOdtFilterChain('aces', 'rec709');

    expect(filters).toHaveLength(2);
    expect(filters[0]).toContain('zscale=');
    expect(filters[0]).toContain('transferin=linear');
    expect(filters[1]).toContain('zscale=');
    expect(filters[1]).toContain('transfer=bt709');
    expect(filters[1]).toContain('primaries=bt709');
  });

  it('calculates Hill ACES tone mapping approximation deterministically', () => {
    expect(applyHillAcesToneMap([0, 0, 0])).toEqual([0, 0, 0]);
    const white = applyHillAcesToneMap([1, 1, 1]);
    expect(white[0]).toBeCloseTo(0.619115, 6);
    expect(white[1]).toBeCloseTo(0.619115, 6);
    expect(white[2]).toBeCloseTo(0.619115, 6);

    const mixed = applyHillAcesToneMap([4, 0.5, -1]);
    expect(mixed[0]).toBeCloseTo(0.909014, 6);
    expect(mixed[1]).toBeCloseTo(0.374308, 6);
    expect(mixed[2]).toBe(0);
  });

  it('normalizes unknown project color pipeline values to SDR sRGB', () => {
    expect(normalizeProjectColorPipeline('aces')).toBe('aces');
    expect(normalizeProjectColorPipeline('unknown')).toBe('sdr-srgb');
    expect(normalizeProjectColorPipeline(undefined)).toBe('sdr-srgb');
  });
});

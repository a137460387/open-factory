import { describe, expect, it } from 'vitest';
import {
  CAMERA_IDT_MATRICES,
  applyHillAcesToneMap,
  buildAcesOdtFilterChain,
  buildProjectColorPipelineExportDefaults,
  isAcesColorPipeline,
  normalizeProjectColorPipeline,
  toneMapHillAcesChannel,
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
    expect(isAcesColorPipeline('aces')).toBe(true);
    expect(isAcesColorPipeline('hdr-rec2020')).toBe(false);
  });

  it('returns export defaults for every color pipeline', () => {
    expect(buildProjectColorPipelineExportDefaults('sdr-srgb')).toEqual({
      inputColorSpace: 'srgb',
      outputColorSpace: 'srgb',
      embedIccProfile: true
    });
    expect(buildProjectColorPipelineExportDefaults('hdr-rec2020')).toEqual({
      inputColorSpace: 'srgb',
      outputColorSpace: 'rec2020',
      embedIccProfile: true
    });
    expect(buildProjectColorPipelineExportDefaults('aces')).toEqual({
      inputColorSpace: 'rec2020',
      outputColorSpace: 'rec709',
      embedIccProfile: true
    });
  });

  it('maps ACES ODT filters to supported output color spaces', () => {
    expect(buildAcesOdtFilterChain('aces', 'rec2020')[1]).toContain('matrix=bt2020nc:transfer=bt2020-10:primaries=bt2020');
    expect(buildAcesOdtFilterChain('aces', 'dci-p3')[1]).toContain('matrix=bt709:transfer=bt709:primaries=smpte432');
    expect(buildAcesOdtFilterChain('aces', 'srgb')[1]).toContain('matrix=bt709:transfer=iec61966-2-1:primaries=bt709');
  });

  it('clamps non-finite and high Hill ACES channel values', () => {
    expect(toneMapHillAcesChannel(Number.NaN)).toBe(0);
    expect(toneMapHillAcesChannel(1000)).toBe(1);
  });
});

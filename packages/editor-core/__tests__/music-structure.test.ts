import { describe, expect, it } from 'vitest';
import {
  calculateRMS,
  calculateSpectralCentroid,
  calculateSpectralFlux,
  detectStructureBoundary,
  filterByMinInterval,
  detectMusicStructure,
  snapToNearestStructure,
  RMS_CHANGE_THRESHOLD,
  CENTROID_SHIFT_THRESHOLD,
  MIN_INTERVAL_SECONDS,
  STRUCTURE_SNAP_TOLERANCE,
  type MusicStructurePoint,
} from '../src';

describe('calculateRMS', () => {
  it('returns 0 for empty array', () => {
    expect(calculateRMS([])).toBe(0);
    expect(calculateRMS(new Float32Array(0))).toBe(0);
  });

  it('calculates RMS correctly', () => {
    // RMS of [3, 4] = sqrt((9+16)/2) = sqrt(12.5) ≈ 3.5355
    expect(calculateRMS([3, 4])).toBeCloseTo(Math.sqrt(12.5), 5);
  });

  it('works with Float32Array', () => {
    expect(calculateRMS(new Float32Array([1, 1, 1, 1]))).toBeCloseTo(1, 5);
  });

  it('handles single value', () => {
    expect(calculateRMS([5])).toBeCloseTo(5, 5);
  });
});

describe('calculateSpectralCentroid', () => {
  it('returns 0 for empty magnitudes', () => {
    expect(calculateSpectralCentroid([], 44100)).toBe(0);
  });

  it('returns 0 when all magnitudes are 0', () => {
    expect(calculateSpectralCentroid([0, 0, 0], 44100)).toBe(0);
  });

  it('calculates weighted average frequency', () => {
    // Uniform magnitudes → centroid should be at midpoint frequency
    const mags = [1, 1, 1, 1]; // 4 bins
    const sampleRate = 44100;
    const binWidth = sampleRate / (4 * 2); // = 5512.5 Hz
    // centroid = (0.5+1.5+2.5+3.5)*5512.5*1 / (4*1) = 8*5512.5/4 / 4 = no, let me recalc
    // weighted = Σ((i+0.5)*binWidth*1) = (0.5+1.5+2.5+3.5)*5512.5 = 8*5512.5 = 44100
    // total = 4
    // centroid = 44100/4 = 11025
    const centroid = calculateSpectralCentroid(mags, sampleRate);
    expect(centroid).toBeCloseTo(11025, 1);
  });

  it('weights toward higher magnitude bins', () => {
    const mags = [0, 0, 0, 10]; // all weight in last bin
    const sampleRate = 44100;
    const binWidth = sampleRate / 8;
    const expectedFreq = 3.5 * binWidth;
    expect(calculateSpectralCentroid(mags, sampleRate)).toBeCloseTo(expectedFreq, 1);
  });
});

describe('calculateSpectralFlux', () => {
  it('returns 0 for empty arrays', () => {
    expect(calculateSpectralFlux([], [])).toBe(0);
    expect(calculateSpectralFlux(new Float32Array(0), new Float32Array(0))).toBe(0);
  });

  it('returns 0 for identical spectra', () => {
    expect(calculateSpectralFlux([1, 2, 3], [1, 2, 3])).toBe(0);
  });

  it('calculates half-wave rectified flux', () => {
    // prev = [1, 2, 3], curr = [3, 1, 5]
    // diffs: (3-1)=2, (1-2)=-1→0, (5-3)=2
    // flux = (2+0+2)/3 = 1.333...
    expect(calculateSpectralFlux([1, 2, 3], [3, 1, 5])).toBeCloseTo(4 / 3, 5);
  });

  it('handles different lengths by using minimum', () => {
    expect(calculateSpectralFlux([1, 2], [3, 4, 5])).toBeCloseTo(2, 5);
  });

  it('works with Float32Array', () => {
    const prev = new Float32Array([1, 2]);
    const curr = new Float32Array([3, 4]);
    expect(calculateSpectralFlux(prev, curr)).toBeCloseTo(2, 5);
  });
});

describe('detectStructureBoundary', () => {
  it('returns no boundary when changes are below thresholds', () => {
    const result = detectStructureBoundary(100, 110, 2000, 2100);
    expect(result.isBoundary).toBe(false);
    expect(result.confidence).toBe(0);
  });

  it('detects energy rise', () => {
    // RMS change: (140 - 100) / 100 = 0.4 ≥ 0.4
    const result = detectStructureBoundary(100, 140, 2000, 2000);
    expect(result.isBoundary).toBe(true);
    expect(result.type).toBe('energy_rise');
  });

  it('detects energy drop', () => {
    // RMS change: |60 - 100| / 100 = 0.4 ≥ 0.4
    const result = detectStructureBoundary(100, 60, 2000, 2000);
    expect(result.isBoundary).toBe(true);
    expect(result.type).toBe('energy_drop');
  });

  it('detects timbre shift when RMS below threshold but centroid above', () => {
    // RMS change: |105 - 100| / 100 = 0.05 < 0.4
    // centroid shift: |2600 - 2000| / 2000 = 0.3 ≥ 0.3
    const result = detectStructureBoundary(100, 105, 2000, 2600);
    expect(result.isBoundary).toBe(true);
    expect(result.type).toBe('timbre_shift');
  });

  it('boundary: RMS change exactly at threshold', () => {
    const prevRMS = 100;
    const currRMS = 140; // 40/100 = 0.4 exactly
    const result = detectStructureBoundary(prevRMS, currRMS, 2000, 2000);
    expect(result.isBoundary).toBe(true);
    expect(result.type).toBe('energy_rise');
  });

  it('boundary: centroid shift exactly at threshold', () => {
    const prevCentroid = 2000;
    const currCentroid = 2600; // 600/2000 = 0.3 exactly
    const result = detectStructureBoundary(100, 101, prevCentroid, currCentroid);
    expect(result.isBoundary).toBe(true);
    expect(result.type).toBe('timbre_shift');
  });

  it('handles prevRMS = 0 with currRMS > 0', () => {
    const result = detectStructureBoundary(0, 50, 2000, 2000);
    expect(result.isBoundary).toBe(true);
    expect(result.type).toBe('energy_rise');
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('handles prevRMS = 0 and currRMS = 0', () => {
    const result = detectStructureBoundary(0, 0, 2000, 2000);
    expect(result.isBoundary).toBe(false);
  });

  it('handles prevCentroid = 0 with currCentroid > 0', () => {
    const result = detectStructureBoundary(100, 101, 0, 500);
    expect(result.isBoundary).toBe(true);
    expect(result.type).toBe('timbre_shift');
  });

  it('handles prevCentroid = 0 and currCentroid = 0', () => {
    const result = detectStructureBoundary(100, 101, 0, 0);
    expect(result.isBoundary).toBe(false);
  });

  it('RMS change takes priority over centroid shift', () => {
    // Both thresholds exceeded, RMS should be detected first
    const result = detectStructureBoundary(100, 160, 2000, 3000);
    expect(result.isBoundary).toBe(true);
    expect(result.type).toBe('energy_rise'); // RMS check is first
  });
});

describe('filterByMinInterval', () => {
  it('returns empty for empty input', () => {
    expect(filterByMinInterval([])).toEqual([]);
  });

  it('returns single point unchanged', () => {
    const points: MusicStructurePoint[] = [{ time: 5, type: 'energy_rise', confidence: 0.8 }];
    expect(filterByMinInterval(points)).toEqual(points);
  });

  it('keeps points separated by >= min interval', () => {
    const points: MusicStructurePoint[] = [
      { time: 0, type: 'energy_rise', confidence: 0.8 },
      { time: 10, type: 'energy_drop', confidence: 0.7 },
    ];
    const filtered = filterByMinInterval(points);
    expect(filtered).toHaveLength(2);
  });

  it('filters points closer than min interval', () => {
    const points: MusicStructurePoint[] = [
      { time: 0, type: 'energy_rise', confidence: 0.8 },
      { time: 5, type: 'energy_drop', confidence: 0.6 },
    ];
    const filtered = filterByMinInterval(points, 8);
    expect(filtered).toHaveLength(1);
  });

  it('replaces with higher confidence point when too close', () => {
    const points: MusicStructurePoint[] = [
      { time: 0, type: 'energy_rise', confidence: 0.5 },
      { time: 3, type: 'timbre_shift', confidence: 0.9 },
    ];
    const filtered = filterByMinInterval(points, 8);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].confidence).toBe(0.9);
    expect(filtered[0].type).toBe('timbre_shift');
  });

  it('sorts by time before filtering', () => {
    const points: MusicStructurePoint[] = [
      { time: 20, type: 'energy_rise', confidence: 0.8 },
      { time: 0, type: 'energy_drop', confidence: 0.7 },
      { time: 10, type: 'timbre_shift', confidence: 0.6 },
    ];
    const filtered = filterByMinInterval(points, 8);
    expect(filtered).toHaveLength(3);
    expect(filtered[0].time).toBe(0);
    expect(filtered[1].time).toBe(10);
    expect(filtered[2].time).toBe(20);
  });

  it('does not replace when new point has lower confidence', () => {
    const points: MusicStructurePoint[] = [
      { time: 0, type: 'energy_rise', confidence: 0.9 },
      { time: 3, type: 'timbre_shift', confidence: 0.5 },
    ];
    const filtered = filterByMinInterval(points, 8);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].confidence).toBe(0.9);
    expect(filtered[0].type).toBe('energy_rise');
  });
});

describe('detectMusicStructure', () => {
  it('returns empty for fewer than 2 windows', () => {
    expect(detectMusicStructure([])).toEqual([]);
    expect(detectMusicStructure([{ startTime: 0, rms: 100, centroid: 2000 }])).toEqual([]);
  });

  it('detects structure boundaries from window data', () => {
    const windows = [
      { startTime: 0, rms: 100, centroid: 2000 },
      { startTime: 10, rms: 150, centroid: 2000 }, // energy rise at 10s
      { startTime: 20, rms: 150, centroid: 3000 }, // timbre shift at 20s
      { startTime: 30, rms: 80, centroid: 3000 },  // energy drop at 30s
    ];
    const points = detectMusicStructure(windows);
    expect(points.length).toBeGreaterThanOrEqual(2);
  });

  it('applies minimum interval filtering', () => {
    // Create windows that would produce many boundaries close together
    const windows = [
      { startTime: 0, rms: 100, centroid: 2000 },
      { startTime: 2, rms: 200, centroid: 4000 }, // big change at 2s
      { startTime: 4, rms: 50, centroid: 1000 },  // big change at 4s
      { startTime: 6, rms: 150, centroid: 3000 }, // big change at 6s
    ];
    const points = detectMusicStructure(windows);
    // With 8s min interval, many close points should be filtered
    for (let i = 1; i < points.length; i++) {
      expect(points[i].time - points[i - 1].time).toBeGreaterThanOrEqual(MIN_INTERVAL_SECONDS);
    }
  });
});

describe('snapToNearestStructure', () => {
  const points: MusicStructurePoint[] = [
    { time: 5.0, type: 'energy_rise', confidence: 0.8 },
    { time: 15.0, type: 'timbre_shift', confidence: 0.7 },
    { time: 30.0, type: 'energy_drop', confidence: 0.9 },
  ];

  it('returns null for empty points', () => {
    expect(snapToNearestStructure(5.0, [])).toBeNull();
  });

  it('snaps to nearest point within tolerance', () => {
    const result = snapToNearestStructure(5.1, points, 0.3);
    expect(result).not.toBeNull();
    expect(result!.snappedTime).toBe(5.0);
    expect(result!.point.type).toBe('energy_rise');
  });

  it('snaps to correct nearest when multiple points within tolerance', () => {
    const result = snapToNearestStructure(14.9, points, 0.3);
    expect(result).not.toBeNull();
    expect(result!.snappedTime).toBe(15.0);
  });

  it('returns null when beyond tolerance', () => {
    const result = snapToNearestStructure(10.0, points, 0.3);
    expect(result).toBeNull();
  });

  it('boundary: exactly at tolerance edge', () => {
    const result = snapToNearestStructure(5.3, points, 0.3);
    expect(result).not.toBeNull();
    expect(result!.snappedTime).toBe(5.0);
  });

  it('boundary: just beyond tolerance', () => {
    const result = snapToNearestStructure(5.31, points, 0.3);
    expect(result).toBeNull();
  });

  it('boundary: exact match', () => {
    const result = snapToNearestStructure(15.0, points);
    expect(result).not.toBeNull();
    expect(result!.snappedTime).toBe(15.0);
    expect(result!.point.type).toBe('timbre_shift');
  });
});

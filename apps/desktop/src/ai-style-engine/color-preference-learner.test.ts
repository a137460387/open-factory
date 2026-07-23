import { describe, it, expect } from 'vitest';
import {
  extractColorParams,
  extractPresetParams,
  calculateLutDistribution,
  calculateColorTemperatureStats,
  calculateContrastStats,
  calculateSaturationStats,
  clusterColorStyles,
  generatePreferenceVector,
  analyzeColorPreferences,
  compareColorProfiles,
  type ColorGradingParams,
  type ColorPreferenceProfile,
} from './color-preference-learner';

// ==================== Test Helpers ====================

function makeProject(tracks: Array<{ clips: Array<{ colorGrading?: ColorGradingParams; colorNodes?: Array<{ params: ColorGradingParams }> }> }>, presets?: Array<{ type: string; params: ColorGradingParams }>) {
  return {
    timeline: { tracks },
    presets,
  };
}

// ==================== extractColorParams ====================

describe('extractColorParams', () => {
  it('returns empty for null project', () => {
    expect(extractColorParams(null)).toEqual([]);
    expect(extractColorParams({})).toEqual([]);
  });

  it('extracts params from clip colorGrading', () => {
    const project = makeProject([
      { clips: [{ colorGrading: { contrast: 20, saturation: 10 } }] },
    ]);
    const params = extractColorParams(project);
    expect(params).toHaveLength(1);
    expect(params[0].contrast).toBe(20);
  });

  it('extracts params from colorNodes', () => {
    const project = makeProject([
      {
        clips: [{
          colorNodes: [
            { params: { exposure: 1.5 } },
            { params: { contrast: 30 } },
          ],
        }],
      },
    ]);
    const params = extractColorParams(project);
    expect(params).toHaveLength(2);
  });
});

// ==================== extractPresetParams ====================

describe('extractPresetParams', () => {
  it('returns empty for no presets', () => {
    expect(extractPresetParams(null)).toEqual([]);
    expect(extractPresetParams({})).toEqual([]);
  });

  it('extracts color-grading presets only', () => {
    const project = makeProject([], [
      { type: 'color-grading', params: { contrast: 10 } },
      { type: 'audio-effect', params: { contrast: 99 } },
    ]);
    const params = extractPresetParams(project);
    expect(params).toHaveLength(1);
    expect(params[0].contrast).toBe(10);
  });
});

// ==================== calculateLutDistribution ====================

describe('calculateLutDistribution', () => {
  it('returns empty for no LUTs', () => {
    expect(calculateLutDistribution([])).toEqual([]);
  });

  it('calculates correct distribution', () => {
    const params: ColorGradingParams[] = [
      { lut: 'cinematic.cube' },
      { lut: 'cinematic.cube' },
      { lut: 'vintage.cube' },
      {},
    ];
    const dist = calculateLutDistribution(params);
    expect(dist).toHaveLength(2);
    expect(dist[0].lut).toBe('cinematic.cube');
    expect(dist[0].percentage).toBeCloseTo(2 / 3);
    expect(dist[1].lut).toBe('vintage.cube');
  });
});

// ==================== calculateColorTemperatureStats ====================

describe('calculateColorTemperatureStats', () => {
  it('returns default 5500 for no temperature data', () => {
    const stats = calculateColorTemperatureStats([]);
    expect(stats.avg).toBe(5500);
    expect(stats.stdDev).toBe(0);
  });

  it('calculates correct average', () => {
    const params: ColorGradingParams[] = [
      { colorTemperature: 3200 },
      { colorTemperature: 5600 },
    ];
    const stats = calculateColorTemperatureStats(params);
    expect(stats.avg).toBeCloseTo(4400);
  });
});

// ==================== calculateContrastStats ====================

describe('calculateContrastStats', () => {
  it('returns zeros for empty params', () => {
    const stats = calculateContrastStats([]);
    expect(stats.avg).toBe(0);
    expect(stats.min).toBe(0);
    expect(stats.max).toBe(0);
  });

  it('calculates min/max/avg', () => {
    const params: ColorGradingParams[] = [
      { contrast: -20 },
      { contrast: 40 },
      { contrast: 10 },
    ];
    const stats = calculateContrastStats(params);
    expect(stats.avg).toBeCloseTo(10);
    expect(stats.min).toBe(-20);
    expect(stats.max).toBe(40);
  });
});

// ==================== calculateSaturationStats ====================

describe('calculateSaturationStats', () => {
  it('uses vibrance as fallback', () => {
    const params: ColorGradingParams[] = [{ vibrance: 25 }];
    const stats = calculateSaturationStats(params);
    expect(stats.avg).toBe(25);
  });

  it('prefers saturation over vibrance', () => {
    const params: ColorGradingParams[] = [{ saturation: 15, vibrance: 99 }];
    const stats = calculateSaturationStats(params);
    expect(stats.avg).toBe(15);
  });
});

// ==================== clusterColorStyles ====================

describe('clusterColorStyles', () => {
  it('returns single cluster for fewer samples than clusters', () => {
    const params: ColorGradingParams[] = [{ contrast: 10 }];
    const clusters = clusterColorStyles(params, 3);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].sampleCount).toBe(1);
  });

  it('produces correct number of clusters', () => {
    const params: ColorGradingParams[] = [
      { contrast: 10, saturation: 10, colorTemperature: 3200 },
      { contrast: 12, saturation: 8, colorTemperature: 3300 },
      { contrast: 50, saturation: 50, colorTemperature: 6500 },
      { contrast: 52, saturation: 48, colorTemperature: 6400 },
      { contrast: -30, saturation: -20, colorTemperature: 2800 },
      { contrast: -28, saturation: -22, colorTemperature: 2900 },
    ];
    const clusters = clusterColorStyles(params, 3);
    expect(clusters.length).toBeGreaterThanOrEqual(2);
    expect(clusters.length).toBeLessThanOrEqual(3);
    // All samples should be assigned
    const totalSamples = clusters.reduce((sum, c) => sum + c.sampleCount, 0);
    expect(totalSamples).toBe(6);
  });

  it('handles identical params', () => {
    const params: ColorGradingParams[] = [
      { contrast: 10, saturation: 10 },
      { contrast: 10, saturation: 10 },
      { contrast: 10, saturation: 10 },
    ];
    const clusters = clusterColorStyles(params, 2);
    expect(clusters.length).toBeGreaterThanOrEqual(1);
  });
});

// ==================== generatePreferenceVector ====================

describe('generatePreferenceVector', () => {
  it('generates 64-dimensional vector', () => {
    const profile: ColorPreferenceProfile = {
      topLuts: [{ lut: 'test.cube', usageCount: 5, percentage: 1 }],
      avgColorTemperature: 5500,
      colorTemperatureStdDev: 500,
      avgContrast: 20,
      contrastRange: { min: 0, max: 40 },
      avgSaturation: 10,
      saturationRange: { min: -10, max: 30 },
      styleClusters: [],
      dominantStyle: null,
      preferenceVector: [],
    };
    const v = generatePreferenceVector(profile);
    expect(v).toHaveLength(64);
  });

  it('normalizes temperature correctly', () => {
    const profile: ColorPreferenceProfile = {
      topLuts: [],
      avgColorTemperature: 6000, // (6000-2000)/(10000-2000) = 0.5
      colorTemperatureStdDev: 0,
      avgContrast: 0,
      contrastRange: { min: 0, max: 0 },
      avgSaturation: 0,
      saturationRange: { min: 0, max: 0 },
      styleClusters: [],
      dominantStyle: null,
      preferenceVector: [],
    };
    const v = generatePreferenceVector(profile);
    expect(v[0]).toBeCloseTo(0.5);
  });
});

// ==================== analyzeColorPreferences ====================

describe('analyzeColorPreferences', () => {
  it('returns zero profile for empty project', () => {
    const result = analyzeColorPreferences(null);
    expect(result.stats.totalSamples).toBe(0);
    expect(result.profile.avgColorTemperature).toBe(5500);
    expect(result.profile.preferenceVector).toHaveLength(64);
  });

  it('produces full analysis for project with color data', () => {
    const project = makeProject(
      [
        {
          clips: [
            { colorGrading: { contrast: 20, saturation: 10, colorTemperature: 5000, lut: 'warm.cube' } },
            { colorGrading: { contrast: 30, saturation: 15, colorTemperature: 5500, lut: 'warm.cube' } },
            { colorGrading: { contrast: -10, saturation: -5, colorTemperature: 3200 } },
          ],
        },
      ],
    );
    const result = analyzeColorPreferences(project);
    expect(result.stats.totalSamples).toBe(3);
    expect(result.profile.topLuts[0].lut).toBe('warm.cube');
    expect(result.profile.preferenceVector).toHaveLength(64);
    expect(result.profile.styleClusters.length).toBeGreaterThanOrEqual(1);
  });
});

// ==================== compareColorProfiles ====================

describe('compareColorProfiles', () => {
  const makeProfile = (vector: number[]): ColorPreferenceProfile => ({
    topLuts: [],
    avgColorTemperature: 5500,
    colorTemperatureStdDev: 0,
    avgContrast: 0,
    contrastRange: { min: 0, max: 0 },
    avgSaturation: 0,
    saturationRange: { min: 0, max: 0 },
    styleClusters: [],
    dominantStyle: null,
    preferenceVector: vector,
  });

  it('returns 0 for different length vectors', () => {
    expect(compareColorProfiles(makeProfile([1, 0]), makeProfile([1, 0, 0]))).toBe(0);
  });

  it('returns 1 for identical vectors', () => {
    const v = new Array(64).fill(0.5);
    expect(compareColorProfiles(makeProfile(v), makeProfile(v))).toBeCloseTo(1);
  });

  it('returns 0 for zero vectors', () => {
    const v = new Array(64).fill(0);
    expect(compareColorProfiles(makeProfile(v), makeProfile(v))).toBe(0);
  });
});

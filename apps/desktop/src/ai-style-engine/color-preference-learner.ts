/**
 * Color Preference Learning Module
 *
 * Analyzes user's color grading preferences from historical projects:
 * - LUT preferences
 * - Color temperature tendencies
 * - Contrast and saturation patterns
 * - Color style clustering
 */

// ==================== Types ====================

/** Minimal project shape for color analysis */
export interface ProjectLike {
  timeline?: {
    tracks: Array<{
      clips: Array<{
        colorGrading?: ColorGradingParams;
        colorNodes?: Array<{ params?: ColorGradingParams }>;
      }>;
    }>;
  };
  presets?: Array<{ type: string; params?: ColorGradingParams }>;
}

export interface ColorGradingParams {
  /** LUT file path or name */
  lut?: string;
  /** Color temperature (2000-10000K) */
  colorTemperature?: number;
  /** Tint (-100 to 100) */
  tint?: number;
  /** Exposure (-5 to 5) */
  exposure?: number;
  /** Contrast (-100 to 100) */
  contrast?: number;
  /** Highlights (-100 to 100) */
  highlights?: number;
  /** Shadows (-100 to 100) */
  shadows?: number;
  /** Whites (-100 to 100) */
  whites?: number;
  /** Blacks (-100 to 100) */
  blacks?: number;
  /** Clarity (-100 to 100) */
  clarity?: number;
  /** Vibrance (-100 to 100) */
  vibrance?: number;
  /** Saturation (-100 to 100) */
  saturation?: number;
  /** HSL adjustments */
  hsl?: {
    hue?: Record<string, number>;
    saturation?: Record<string, number>;
    luminance?: Record<string, number>;
  };
  /** Split toning */
  splitToning?: {
    highlightHue?: number;
    highlightSaturation?: number;
    shadowHue?: number;
    shadowSaturation?: number;
  };
}

export interface ColorStyleCluster {
  /** Cluster ID */
  id: string;
  /** Cluster name */
  name: string;
  /** Representative parameters */
  representative: ColorGradingParams;
  /** Number of samples in cluster */
  sampleCount: number;
  /** Cluster confidence (0-1) */
  confidence: number;
}

export interface ColorPreferenceProfile {
  /** Most used LUTs */
  topLuts: Array<{ lut: string; usageCount: number; percentage: number }>;
  /** Average color temperature */
  avgColorTemperature: number;
  /** Color temperature standard deviation */
  colorTemperatureStdDev: number;
  /** Average contrast */
  avgContrast: number;
  /** Contrast preference range */
  contrastRange: { min: number; max: number };
  /** Average saturation */
  avgSaturation: number;
  /** Saturation preference range */
  saturationRange: { min: number; max: number };
  /** Style clusters */
  styleClusters: ColorStyleCluster[];
  /** Dominant style cluster */
  dominantStyle: ColorStyleCluster | null;
  /** Color preference vector (for ML) */
  preferenceVector: number[];
}

export interface ColorAnalysisResult {
  /** Color preference profile */
  profile: ColorPreferenceProfile;
  /** Statistics */
  stats: {
    totalSamples: number;
    uniqueLuts: number;
    avgParamsPerSample: number;
  };
}

// ==================== Parameter Extraction ====================

/**
 * Extract color grading parameters from project nodes
 */
export function extractColorParams(project: ProjectLike): ColorGradingParams[] {
  const params: ColorGradingParams[] = [];

  if (!project?.timeline?.tracks) {
    return params;
  }

  for (const track of project.timeline.tracks) {
    if (!track.clips) continue;

    for (const clip of track.clips) {
      if (clip.colorGrading) {
        params.push(clip.colorGrading);
      }

      // Check for color nodes
      if (clip.colorNodes) {
        for (const node of clip.colorNodes) {
          if (node.params) {
            params.push(node.params);
          }
        }
      }
    }
  }

  return params;
}

/**
 * Extract color params from project presets
 */
export function extractPresetParams(project: ProjectLike): ColorGradingParams[] {
  const params: ColorGradingParams[] = [];

  if (!project?.presets) {
    return params;
  }

  for (const preset of project.presets) {
    if (preset.type === 'color-grading' && preset.params) {
      params.push(preset.params);
    }
  }

  return params;
}

// ==================== Statistical Analysis ====================

/**
 * Calculate average numeric value from params
 */
function calculateAverage(params: ColorGradingParams[], getter: (p: ColorGradingParams) => number | undefined): number {
  const values = params.map(getter).filter((v): v is number => v !== undefined);
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Calculate standard deviation
 */
function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map((v) => (v - avg) ** 2);
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Calculate LUT usage distribution
 */
export function calculateLutDistribution(params: ColorGradingParams[]): Array<{ lut: string; usageCount: number; percentage: number }> {
  const lutCounts: Record<string, number> = {};
  let total = 0;

  for (const p of params) {
    if (p.lut) {
      lutCounts[p.lut] = (lutCounts[p.lut] || 0) + 1;
      total++;
    }
  }

  if (total === 0) return [];

  return Object.entries(lutCounts)
    .map(([lut, count]) => ({
      lut,
      usageCount: count,
      percentage: count / total,
    }))
    .sort((a, b) => b.usageCount - a.usageCount);
}

/**
 * Calculate color temperature statistics
 */
export function calculateColorTemperatureStats(params: ColorGradingParams[]): {
  avg: number;
  stdDev: number;
} {
  const temps = params
    .map((p) => p.colorTemperature)
    .filter((t): t is number => t !== undefined);

  return {
    avg: temps.length > 0 ? temps.reduce((a, b) => a + b, 0) / temps.length : 5500,
    stdDev: calculateStdDev(temps),
  };
}

/**
 * Calculate contrast statistics
 */
export function calculateContrastStats(params: ColorGradingParams[]): {
  avg: number;
  min: number;
  max: number;
} {
  const contrasts = params
    .map((p) => p.contrast)
    .filter((c): c is number => c !== undefined);

  if (contrasts.length === 0) {
    return { avg: 0, min: 0, max: 0 };
  }

  return {
    avg: contrasts.reduce((a, b) => a + b, 0) / contrasts.length,
    min: Math.min(...contrasts),
    max: Math.max(...contrasts),
  };
}

/**
 * Calculate saturation statistics
 */
export function calculateSaturationStats(params: ColorGradingParams[]): {
  avg: number;
  min: number;
  max: number;
} {
  const sats = params
    .map((p) => p.saturation ?? p.vibrance)
    .filter((s): s is number => s !== undefined);

  if (sats.length === 0) {
    return { avg: 0, min: 0, max: 0 };
  }

  return {
    avg: sats.reduce((a, b) => a + b, 0) / sats.length,
    min: Math.min(...sats),
    max: Math.max(...sats),
  };
}

// ==================== Style Clustering ====================

/**
 * Generate feature vector from color grading params
 */
function paramsToVector(params: ColorGradingParams): number[] {
  return [
    normalizeValue(params.colorTemperature ?? 5500, 2000, 10000),
    normalizeValue(params.tint ?? 0, -100, 100),
    normalizeValue(params.exposure ?? 0, -5, 5),
    normalizeValue(params.contrast ?? 0, -100, 100),
    normalizeValue(params.highlights ?? 0, -100, 100),
    normalizeValue(params.shadows ?? 0, -100, 100),
    normalizeValue(params.whites ?? 0, -100, 100),
    normalizeValue(params.blacks ?? 0, -100, 100),
    normalizeValue(params.clarity ?? 0, -100, 100),
    normalizeValue(params.vibrance ?? 0, -100, 100),
    normalizeValue(params.saturation ?? 0, -100, 100),
  ];
}

/**
 * Normalize a value to 0-1 range
 */
function normalizeValue(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

/**
 * Calculate Euclidean distance between two vectors
 */
function vectorDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    sum += (a[i] - b[i]) ** 2;
  }
  return Math.sqrt(sum);
}

/**
 * Simple K-means clustering for color styles
 */
export function clusterColorStyles(
  params: ColorGradingParams[],
  numClusters: number = 3,
): ColorStyleCluster[] {
  if (params.length < numClusters) {
    return params.map((p, i) => ({
      id: `cluster-${i}`,
      name: `Style ${i + 1}`,
      representative: p,
      sampleCount: 1,
      confidence: 1.0,
    }));
  }

  // Convert to vectors
  const vectors = params.map(paramsToVector);

  // Initialize centroids using K-means++
  const centroids: number[][] = [];
  const indices = new Set<number>();

  // First centroid: random
  const firstIdx = Math.floor(Math.random() * vectors.length);
  centroids.push([...vectors[firstIdx]]);
  indices.add(firstIdx);

  // Remaining centroids: weighted by distance
  for (let c = 1; c < numClusters; c++) {
    const distances = vectors.map((v, i) => {
      if (indices.has(i)) return 0;
      const minDist = Math.min(...centroids.map((centroid) => vectorDistance(v, centroid)));
      return minDist ** 2;
    });

    const totalDist = distances.reduce((a, b) => a + b, 0);
    if (totalDist === 0) break;

    let rand = Math.random() * totalDist;
    for (let i = 0; i < distances.length; i++) {
      rand -= distances[i];
      if (rand <= 0 && !indices.has(i)) {
        centroids.push([...vectors[i]]);
        indices.add(i);
        break;
      }
    }
  }

  // Run K-means iterations
  const maxIterations = 50;
  let assignments = new Array(vectors.length).fill(0);

  for (let iter = 0; iter < maxIterations; iter++) {
    // Assign to nearest centroid
    const newAssignments = vectors.map((v) => {
      let minDist = Infinity;
      let minIdx = 0;
      centroids.forEach((centroid, idx) => {
        const dist = vectorDistance(v, centroid);
        if (dist < minDist) {
          minDist = dist;
          minIdx = idx;
        }
      });
      return minIdx;
    });

    // Check convergence
    if (JSON.stringify(newAssignments) === JSON.stringify(assignments)) {
      break;
    }
    assignments = newAssignments;

    // Update centroids
    for (let c = 0; c < centroids.length; c++) {
      const clusterVectors = vectors.filter((_, i) => assignments[i] === c);
      if (clusterVectors.length === 0) continue;

      const newCentroid = new Array(vectors[0].length).fill(0);
      for (const v of clusterVectors) {
        for (let i = 0; i < v.length; i++) {
          newCentroid[i] += v[i];
        }
      }
      for (let i = 0; i < newCentroid.length; i++) {
        newCentroid[i] /= clusterVectors.length;
      }
      centroids[c] = newCentroid;
    }
  }

  // Build cluster results
  const clusters: ColorStyleCluster[] = centroids.map((centroid, idx) => {
    const clusterParams = params.filter((_, i) => assignments[i] === idx);
    const representativeIdx = assignments.indexOf(idx);
    const confidence = clusterParams.length / params.length;

    return {
      id: `cluster-${idx}`,
      name: `Style ${idx + 1}`,
      representative: representativeIdx >= 0 ? params[representativeIdx] : params[0],
      sampleCount: clusterParams.length,
      confidence,
    };
  });

  return clusters.filter((c) => c.sampleCount > 0);
}

// ==================== Preference Vector ====================

/**
 * Generate color preference vector for machine learning
 */
export function generatePreferenceVector(profile: ColorPreferenceProfile): number[] {
  const vector: number[] = [
    normalizeValue(profile.avgColorTemperature, 2000, 10000),
    normalizeValue(profile.avgContrast, -100, 100),
    normalizeValue(profile.avgSaturation, -100, 100),
    profile.colorTemperatureStdDev / 2000, // Normalize by typical range
    profile.contrastRange.max - profile.contrastRange.min,
    profile.saturationRange.max - profile.saturationRange.min,
    profile.topLuts.length > 0 ? profile.topLuts[0].percentage : 0,
    profile.dominantStyle?.confidence ?? 0,
  ];

  // Pad to 64 dimensions
  while (vector.length < 64) {
    vector.push(0);
  }

  return vector;
}

// ==================== Full Analysis Pipeline ====================

/**
 * Run full color preference analysis on project
 */
export function analyzeColorPreferences(project: ProjectLike): ColorAnalysisResult {
  const clipParams = extractColorParams(project);
  const presetParams = extractPresetParams(project);
  const allParams = [...clipParams, ...presetParams];

  if (allParams.length === 0) {
    return {
      profile: {
        topLuts: [],
        avgColorTemperature: 5500,
        colorTemperatureStdDev: 0,
        avgContrast: 0,
        contrastRange: { min: 0, max: 0 },
        avgSaturation: 0,
        saturationRange: { min: 0, max: 0 },
        styleClusters: [],
        dominantStyle: null,
        preferenceVector: new Array(64).fill(0),
      },
      stats: {
        totalSamples: 0,
        uniqueLuts: 0,
        avgParamsPerSample: 0,
      },
    };
  }

  // Calculate distributions
  const topLuts = calculateLutDistribution(allParams);
  const tempStats = calculateColorTemperatureStats(allParams);
  const contrastStats = calculateContrastStats(allParams);
  const satStats = calculateSaturationStats(allParams);

  // Cluster styles
  const styleClusters = clusterColorStyles(allParams);
  const dominantStyle = styleClusters.length > 0
    ? styleClusters.reduce((a, b) => (a.confidence > b.confidence ? a : b))
    : null;

  const profile: ColorPreferenceProfile = {
    topLuts,
    avgColorTemperature: tempStats.avg,
    colorTemperatureStdDev: tempStats.stdDev,
    avgContrast: contrastStats.avg,
    contrastRange: { min: contrastStats.min, max: contrastStats.max },
    avgSaturation: satStats.avg,
    saturationRange: { min: satStats.min, max: satStats.max },
    styleClusters,
    dominantStyle,
    preferenceVector: [],
  };

  // Generate preference vector
  profile.preferenceVector = generatePreferenceVector(profile);

  // Calculate stats
  const uniqueLuts = new Set(allParams.filter((p) => p.lut).map((p) => p.lut));

  return {
    profile,
    stats: {
      totalSamples: allParams.length,
      uniqueLuts: uniqueLuts.size,
      avgParamsPerSample: allParams.length / Math.max(1, clipParams.length),
    },
  };
}

/**
 * Compare two color preference profiles and return similarity score (0-1)
 */
export function compareColorProfiles(profile1: ColorPreferenceProfile, profile2: ColorPreferenceProfile): number {
  // Compare preference vectors using cosine similarity
  const v1 = profile1.preferenceVector;
  const v2 = profile2.preferenceVector;

  if (v1.length !== v2.length || v1.length === 0) return 0;

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < v1.length; i++) {
    dotProduct += v1[i] * v2[i];
    norm1 += v1[i] ** 2;
    norm2 += v2[i] ** 2;
  }

  if (norm1 === 0 || norm2 === 0) return 0;

  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

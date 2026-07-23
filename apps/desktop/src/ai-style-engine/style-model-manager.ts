/**
 * Personal Style Model Manager
 *
 * Integrates editing rhythm and color preference analysis
 * to provide a unified personal style model for:
 * - New project style application
 * - Edit point recommendations
 * - Color grading parameter suggestions
 * - Node editor "Personal Style" input node
 */

import {
  analyzeEditingStyle,
  compareEditingStyles,
  type EditingRhythmProfile,
  type EditingStyleVector,
  type EDLAnalysisResult,
} from './edit-rhythm-analyzer';

import {
  analyzeColorPreferences,
  compareColorProfiles,
  type ColorPreferenceProfile,
  type ColorGradingParams,
  type ColorAnalysisResult,
} from './color-preference-learner';

// ==================== Types ====================

export interface PersonalStyleModel {
  /** Unique model ID */
  id: string;
  /** Model creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
  /** Source project IDs used to build this model */
  sourceProjectIds: string[];
  /** Editing rhythm profile */
  editingStyle: EditingStyleVector;
  /** Color preference profile */
  colorProfile: ColorPreferenceProfile;
  /** Combined style vector (256-dim) */
  combinedVector: number[];
  /** Style summary for display */
  summary: StyleSummary;
}

export interface StyleSummary {
  /** Dominant editing pace description */
  editingPace: 'slow' | 'medium' | 'fast' | 'very-fast';
  /** Shot duration tendency */
  shotDuration: 'short' | 'medium' | 'long' | 'mixed';
  /** Color temperature tendency */
  colorTemperature: 'warm' | 'neutral' | 'cool';
  /** Contrast preference */
  contrast: 'low' | 'medium' | 'high';
  /** Saturation preference */
  saturation: 'desaturated' | 'natural' | 'vibrant';
  /** Top LUT names */
  topLuts: string[];
  /** Human-readable style description */
  description: string;
}

export interface EditPointRecommendation {
  /** Recommended cut time in seconds */
  time: number;
  /** Confidence score 0-1 */
  confidence: number;
  /** Reason for recommendation */
  reason: 'rhythm-match' | 'energy-peak' | 'beat-sync' | 'scene-change';
  /** Suggested transition type */
  suggestedTransition?: string;
}

export interface ColorGradingRecommendation {
  /** Recommended color grading parameters */
  params: ColorGradingParams;
  /** Confidence score 0-1 */
  confidence: number;
  /** Which style cluster this matches */
  matchingCluster?: string;
}

export interface StyleApplicationResult {
  /** Recommended edit points */
  editPoints: EditPointRecommendation[];
  /** Recommended color grading */
  colorGrading: ColorGradingRecommendation;
  /** Overall style match score 0-1 */
  matchScore: number;
}

export interface StyleModelStorage {
  /** Load all saved style models */
  loadModels(): PersonalStyleModel[];
  /** Save a style model */
  saveModel(model: PersonalStyleModel): void;
  /** Delete a style model */
  deleteModel(id: string): void;
  /** Get the active model */
  getActiveModel(): PersonalStyleModel | null;
  /** Set the active model */
  setActiveModel(id: string | null): void;
}

// ==================== Style Model Creation ====================

/**
 * Create a personal style model from multiple project analyses
 */
export function createStyleModel(
  projects: Array<{ id: string; timeline: any; presets?: any[] }>,
  existingModel?: PersonalStyleModel,
): PersonalStyleModel {
  const now = Date.now();

  // Analyze editing style from all projects
  const editingResults = projects.map((p) => analyzeEditingStyle(p.timeline));
  const mergedEditingProfile = mergeEditingProfiles(editingResults);

  // Analyze color preferences from all projects
  const colorResults = projects.map((p) => analyzeColorPreferences(p));
  const mergedColorProfile = mergeColorProfiles(colorResults);

  // Generate combined vector
  const combinedVector = generateCombinedVector(mergedEditingProfile.styleVector, mergedColorProfile);

  // Generate summary
  const summary = generateStyleSummary(mergedEditingProfile.rhythmProfile, mergedColorProfile);

  return {
    id: existingModel?.id ?? `style-model-${now}`,
    createdAt: existingModel?.createdAt ?? now,
    updatedAt: now,
    sourceProjectIds: projects.map((p) => p.id),
    editingStyle: mergedEditingProfile.styleVector,
    colorProfile: mergedColorProfile,
    combinedVector,
    summary,
  };
}

/**
 * Merge multiple editing analysis results into a single profile
 */
function mergeEditingProfiles(results: EDLAnalysisResult[]): EDLAnalysisResult {
  if (results.length === 0) {
    return analyzeEditingStyle({ tracks: [] });
  }

  if (results.length === 1) {
    return results[0];
  }

  // Average the rhythm profiles
  const profiles = results.map((r) => r.rhythmProfile);
  const avgShotDuration = average(profiles.map((p) => p.avgShotDuration));
  const medianShotDuration = average(profiles.map((p) => p.medianShotDuration));
  const shotDurationStdDev = average(profiles.map((p) => p.shotDurationStdDev));
  const shortShotRatio = average(profiles.map((p) => p.shortShotRatio));
  const mediumShotRatio = average(profiles.map((p) => p.mediumShotRatio));
  const longShotRatio = average(profiles.map((p) => p.longShotRatio));
  const editingPace = average(profiles.map((p) => p.editingPace));
  const rhythmConsistency = average(profiles.map((p) => p.rhythmConsistency));

  // Merge transition distributions
  const transitionDistribution: Record<string, number> = {};
  for (const p of profiles) {
    for (const [key, value] of Object.entries(p.transitionDistribution)) {
      transitionDistribution[key] = (transitionDistribution[key] || 0) + value / profiles.length;
    }
  }

  // Use the most common rhythm pattern
  const rhythmTypes = profiles.map((p) => p.highlightRhythmPattern.type);
  const dominantRhythmType = mode(rhythmTypes) || 'irregular';

  const mergedProfile: EditingRhythmProfile = {
    avgShotDuration,
    medianShotDuration,
    shotDurationStdDev,
    shortShotRatio,
    mediumShotRatio,
    longShotRatio,
    transitionDistribution,
    highlightRhythmPattern: {
      type: dominantRhythmType as any,
      confidence: average(profiles.map((p) => p.highlightRhythmPattern.confidence)),
      avgInterval: average(profiles.map((p) => p.highlightRhythmPattern.avgInterval)),
      intervalVariance: average(profiles.map((p) => p.highlightRhythmPattern.intervalVariance)),
    },
    editingPace,
    rhythmConsistency,
  };

  // Average style vectors
  const vectors = results.map((r) => r.styleVector.vector);
  const mergedVector = vectors[0].map((_, i) => average(vectors.map((v) => v[i])));

  return {
    rhythmProfile: mergedProfile,
    styleVector: {
      vector: mergedVector,
      dimensions: results[0].styleVector.dimensions,
      confidence: results[0].styleVector.confidence,
    },
    stats: {
      totalClips: results.reduce((sum, r) => sum + r.stats.totalClips, 0),
      totalDuration: results.reduce((sum, r) => sum + r.stats.totalDuration, 0),
      uniqueMediaCount: results.reduce((sum, r) => sum + r.stats.uniqueMediaCount, 0),
      trackCount: results.reduce((sum, r) => sum + r.stats.trackCount, 0),
    },
  };
}

/**
 * Merge multiple color analysis results into a single profile
 */
function mergeColorProfiles(results: ColorAnalysisResult[]): ColorPreferenceProfile {
  if (results.length === 0) {
    return analyzeColorPreferences({ timeline: { tracks: [] } }).profile;
  }

  if (results.length === 1) {
    return results[0].profile;
  }

  const profiles = results.map((r) => r.profile);

  // Merge LUT distributions
  const lutCounts: Record<string, number> = {};
  let totalLutUsage = 0;
  for (const p of profiles) {
    for (const lut of p.topLuts) {
      lutCounts[lut.lut] = (lutCounts[lut.lut] || 0) + lut.usageCount;
      totalLutUsage += lut.usageCount;
    }
  }
  const topLuts = Object.entries(lutCounts)
    .map(([lut, count]) => ({
      lut,
      usageCount: count,
      percentage: totalLutUsage > 0 ? count / totalLutUsage : 0,
    }))
    .sort((a, b) => b.usageCount - a.usageCount);

  // Average numeric values
  const avgColorTemperature = average(profiles.map((p) => p.avgColorTemperature));
  const colorTemperatureStdDev = average(profiles.map((p) => p.colorTemperatureStdDev));
  const avgContrast = average(profiles.map((p) => p.avgContrast));
  const avgSaturation = average(profiles.map((p) => p.avgSaturation));

  const contrastRange = {
    min: Math.min(...profiles.map((p) => p.contrastRange.min)),
    max: Math.max(...profiles.map((p) => p.contrastRange.max)),
  };
  const saturationRange = {
    min: Math.min(...profiles.map((p) => p.saturationRange.min)),
    max: Math.max(...profiles.map((p) => p.saturationRange.max)),
  };

  // Use the dominant style cluster from the largest project
  const dominantStyle = profiles
    .filter((p) => p.dominantStyle)
    .sort((a, b) => (b.dominantStyle?.sampleCount ?? 0) - (a.dominantStyle?.sampleCount ?? 0))[0]
    ?.dominantStyle ?? null;

  // Average preference vectors
  const vectors = profiles.map((p) => p.preferenceVector);
  const mergedVector = vectors[0].map((_, i) => average(vectors.map((v) => v[i])));

  return {
    topLuts,
    avgColorTemperature,
    colorTemperatureStdDev,
    avgContrast,
    contrastRange,
    avgSaturation,
    saturationRange,
    styleClusters: profiles.flatMap((p) => p.styleClusters),
    dominantStyle,
    preferenceVector: mergedVector,
  };
}

// ==================== Style Application ====================

/**
 * Apply personal style to a project, generating recommendations
 */
export function applyStyleToProject(
  model: PersonalStyleModel,
  targetTimeline: any,
  audioBeatTimes?: number[],
): StyleApplicationResult {
  // Generate edit point recommendations
  const editPoints = recommendEditPoints(model, targetTimeline, audioBeatTimes);

  // Generate color grading recommendations
  const colorGrading = recommendColorGrading(model);

  // Calculate match score
  const targetEditing = analyzeEditingStyle(targetTimeline);
  const editingSimilarity = compareEditingStyles(model.editingStyle, targetEditing.styleVector);
  const matchScore = editingSimilarity;

  return {
    editPoints,
    colorGrading,
    matchScore,
  };
}

/**
 * Recommend edit points based on personal style
 */
function recommendEditPoints(
  model: PersonalStyleModel,
  timeline: any,
  audioBeatTimes?: number[],
): EditPointRecommendation[] {
  const recommendations: EditPointRecommendation[] = [];
  const profile = model.editingStyle;

  // Extract target duration info
  const targetAnalysis = analyzeEditingStyle(timeline);
  if (targetAnalysis.stats.totalClips === 0) {
    return recommendations;
  }

  // Get preferred shot duration from style vector
  const preferredAvgDuration = denormalizeValue(
    profile.vector[0], // avgShotDuration
    0, 30,
  );

  // Generate rhythm-based recommendations
  const totalDuration = targetAnalysis.stats.totalDuration;
  if (totalDuration <= 0 || preferredAvgDuration <= 0) {
    return recommendations;
  }

  // Place cuts at preferred intervals
  let currentTime = preferredAvgDuration;
  while (currentTime < totalDuration) {
    let confidence = 0.7;
    let reason: EditPointRecommendation['reason'] = 'rhythm-match';
    let suggestedTransition = 'hard-cut';

    // Boost confidence if near an audio beat
    if (audioBeatTimes && audioBeatTimes.length > 0) {
      const nearestBeat = audioBeatTimes.reduce((nearest, beat) => {
        const dist = Math.abs(beat - currentTime);
        return dist < Math.abs(nearest - currentTime) ? beat : nearest;
      });

      if (Math.abs(nearestBeat - currentTime) < 0.2) {
        confidence = Math.min(1.0, confidence + 0.2);
        reason = 'beat-sync';
      }
    }

    // Use preferred transition type
    const transitions = Object.entries(targetAnalysis.rhythmProfile.transitionDistribution);
    if (transitions.length > 0) {
      suggestedTransition = transitions.sort((a, b) => b[1] - a[1])[0][0];
    }

    recommendations.push({
      time: currentTime,
      confidence,
      reason,
      suggestedTransition,
    });

    // Add some variation to avoid robotic rhythm
    const variation = (Math.random() - 0.5) * preferredAvgDuration * 0.3;
    currentTime += preferredAvgDuration + variation;
  }

  return recommendations.sort((a, b) => a.time - b.time);
}

/**
 * Recommend color grading based on personal style
 */
function recommendColorGrading(model: PersonalStyleModel): ColorGradingRecommendation {
  const profile = model.colorProfile;

  const params: ColorGradingParams = {
    colorTemperature: profile.avgColorTemperature,
    contrast: profile.avgContrast,
    saturation: profile.avgSaturation,
  };

  // Apply dominant style cluster params if available
  if (profile.dominantStyle) {
    const rep = profile.dominantStyle.representative;
    return {
      params: {
        ...rep,
        // Override with personal averages for key params
        colorTemperature: profile.avgColorTemperature,
        contrast: profile.avgContrast,
        saturation: profile.avgSaturation,
      },
      confidence: profile.dominantStyle.confidence,
      matchingCluster: profile.dominantStyle.name,
    };
  }

  // Use top LUT if available
  if (profile.topLuts.length > 0) {
    params.lut = profile.topLuts[0].lut;
  }

  return {
    params,
    confidence: 0.6,
  };
}

// ==================== Style Comparison ====================

/**
 * Compare two style models and return similarity score
 */
export function compareStyleModels(model1: PersonalStyleModel, model2: PersonalStyleModel): number {
  const v1 = model1.combinedVector;
  const v2 = model2.combinedVector;

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

/**
 * Find the best matching style cluster for given params
 */
export function findMatchingCluster(
  model: PersonalStyleModel,
  params: ColorGradingParams,
): { cluster: string; similarity: number } | null {
  if (model.colorProfile.styleClusters.length === 0) return null;

  // Create a temporary profile for comparison
  const tempProfile: ColorPreferenceProfile = {
    ...model.colorProfile,
    dominantStyle: null,
    styleClusters: [],
    preferenceVector: [],
  };

  // Compare against each cluster representative
  let bestMatch: { cluster: string; similarity: number } | null = null;

  for (const cluster of model.colorProfile.styleClusters) {
    const clusterResult = analyzeColorPreferences({
      timeline: {
        tracks: [{
          clips: [{ colorGrading: cluster.representative }],
        }],
      },
    });

    const similarity = compareColorProfiles(tempProfile, clusterResult.profile);

    if (!bestMatch || similarity > bestMatch.similarity) {
      bestMatch = { cluster: cluster.name, similarity };
    }
  }

  return bestMatch;
}

// ==================== Node Editor Integration ====================

/**
 * Generate node editor input data for "Personal Style" node
 */
export function generateStyleNodeData(model: PersonalStyleModel): {
  inputs: Record<string, number>;
  lut?: string;
  metadata: Record<string, string>;
} {
  const inputs: Record<string, number> = {
    colorTemperature: model.colorProfile.avgColorTemperature,
    contrast: model.colorProfile.avgContrast,
    saturation: model.colorProfile.avgSaturation,
    editingPace: model.editingStyle.vector[6] * 120, // denormalize
    avgShotDuration: model.editingStyle.vector[0] * 30, // denormalize
    rhythmConsistency: model.editingStyle.vector[7],
  };

  const metadata: Record<string, string> = {
    modelId: model.id,
    sourceCount: String(model.sourceProjectIds.length),
    lastUpdated: new Date(model.updatedAt).toISOString(),
    editingPace: model.summary.editingPace,
    colorTemperature: model.summary.colorTemperature,
  };

  const result: { inputs: Record<string, number>; lut?: string; metadata: Record<string, string> } = {
    inputs,
    metadata,
  };

  if (model.colorProfile.topLuts.length > 0) {
    result.lut = model.colorProfile.topLuts[0].lut;
  }

  return result;
}

// ==================== Style Summary ====================

/**
 * Generate human-readable style summary
 */
function generateStyleSummary(
  editingProfile: EditingRhythmProfile,
  colorProfile: ColorPreferenceProfile,
): StyleSummary {
  // Editing pace
  const pace = editingProfile.editingPace;
  let editingPace: StyleSummary['editingPace'];
  if (pace < 10) editingPace = 'slow';
  else if (pace < 30) editingPace = 'medium';
  else if (pace < 60) editingPace = 'fast';
  else editingPace = 'very-fast';

  // Shot duration
  const avgDur = editingProfile.avgShotDuration;
  let shotDuration: StyleSummary['shotDuration'];
  if (avgDur < 2) shotDuration = 'short';
  else if (avgDur < 8) shotDuration = 'medium';
  else if (avgDur < 20) shotDuration = 'long';
  else shotDuration = 'mixed';

  // Color temperature
  const temp = colorProfile.avgColorTemperature;
  let colorTemperature: StyleSummary['colorTemperature'];
  if (temp < 4500) colorTemperature = 'warm';
  else if (temp < 6500) colorTemperature = 'neutral';
  else colorTemperature = 'cool';

  // Contrast
  const contrast = colorProfile.avgContrast;
  let contrastLevel: StyleSummary['contrast'];
  if (contrast < -20) contrastLevel = 'low';
  else if (contrast < 20) contrastLevel = 'medium';
  else contrastLevel = 'high';

  // Saturation
  const sat = colorProfile.avgSaturation;
  let saturation: StyleSummary['saturation'];
  if (sat < -20) saturation = 'desaturated';
  else if (sat < 20) saturation = 'natural';
  else saturation = 'vibrant';

  // Top LUTs
  const topLuts = colorProfile.topLuts.slice(0, 3).map((l) => l.lut);

  // Generate description
  const descParts: string[] = [];
  descParts.push(`${editingPace} editing pace`);
  descParts.push(`${shotDuration} shots`);
  descParts.push(`${colorTemperature} color temperature`);
  if (contrastLevel !== 'medium') descParts.push(`${contrastLevel} contrast`);
  if (saturation !== 'natural') descParts.push(`${saturation} colors`);
  if (topLuts.length > 0) descParts.push(`prefers ${topLuts[0]}`);

  return {
    editingPace,
    shotDuration,
    colorTemperature,
    contrast: contrastLevel,
    saturation,
    topLuts,
    description: descParts.join(', '),
  };
}

// ==================== Combined Vector ====================

/**
 * Generate combined 256-dim style vector from editing and color profiles
 */
function generateCombinedVector(
  editingStyle: EditingStyleVector,
  colorProfile: ColorPreferenceProfile,
): number[] {
  const combined: number[] = [];

  // First 128 dims: editing style
  for (let i = 0; i < 128; i++) {
    combined.push(editingStyle.vector[i] ?? 0);
  }

  // Next 64 dims: color preference
  for (let i = 0; i < 64; i++) {
    combined.push(colorProfile.preferenceVector[i] ?? 0);
  }

  // Pad to 256
  while (combined.length < 256) {
    combined.push(0);
  }

  return combined;
}

// ==================== Utility Functions ====================

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function mode<T>(values: T[]): T | null {
  if (values.length === 0) return null;

  const counts = new Map<T, number>();
  for (const v of values) {
    counts.set(v, (counts.get(v) || 0) + 1);
  }

  let maxCount = 0;
  let result: T | null = null;
  for (const [value, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      result = value;
    }
  }

  return result;
}

function denormalizeValue(normalized: number, min: number, max: number): number {
  return min + normalized * (max - min);
}

// ==================== Storage Implementation ====================

/**
 * LocalStorage-based style model storage
 */
export class LocalStyleModelStorage implements StyleModelStorage {
  private readonly storageKey = 'open-factory-style-models';
  private readonly activeKey = 'open-factory-active-style-model';

  loadModels(): PersonalStyleModel[] {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  saveModel(model: PersonalStyleModel): void {
    const models = this.loadModels();
    const existingIdx = models.findIndex((m) => m.id === model.id);

    if (existingIdx >= 0) {
      models[existingIdx] = model;
    } else {
      models.push(model);
    }

    localStorage.setItem(this.storageKey, JSON.stringify(models));
  }

  deleteModel(id: string): void {
    const models = this.loadModels().filter((m) => m.id !== id);
    localStorage.setItem(this.storageKey, JSON.stringify(models));

    if (this.getActiveModel()?.id === id) {
      this.setActiveModel(null);
    }
  }

  getActiveModel(): PersonalStyleModel | null {
    const activeId = localStorage.getItem(this.activeKey);
    if (!activeId) return null;

    const models = this.loadModels();
    return models.find((m) => m.id === activeId) ?? null;
  }

  setActiveModel(id: string | null): void {
    if (id) {
      localStorage.setItem(this.activeKey, id);
    } else {
      localStorage.removeItem(this.activeKey);
    }
  }
}

/**
 * Create default storage instance
 */
export function createDefaultStorage(): StyleModelStorage {
  return new LocalStyleModelStorage();
}

/**
 * Quality assessment - configuration management, suggestions, and comparison.
 *
 * Contains quality profile presets, default config creation, config validation,
 * optimization suggestion generation, and quality comparison logic.
 */

import type {
  QualityDimension,
  QualityAssessmentConfig,
  QualitySuggestion,
  EnhancedQualityAssessmentResult,
  QualityComparisonResult,
  QualityProfile,
} from './quality-assessment-types.js';

// ==================== Suggestions ====================

/**
 * Generate optimization suggestions.
 *
 * Based on the assessment result, generates actionable suggestions for each
 * low-scoring dimension, plus additional suggestions for extreme audio/video issues.
 *
 * @param result - quality assessment result
 * @returns optimization suggestion list, sorted by priority
 */
export function generateOptimizationSuggestions(result: EnhancedQualityAssessmentResult): QualitySuggestion[] {
  const allSuggestions: QualitySuggestion[] = [...result.suggestions];

  // Check audio issues
  if (result.audioMetrics.clipping) {
    allSuggestions.push({
      id: `sug-clip-fix-${Date.now()}`,
      dimension: 'audio-level',
      action: '音频存在削波失真，建议降低录音电平或使用限制器',
      expectedImprovement: 15,
      priority: 'critical',
      autoApplicable: false,
      params: { volume: 0.7 },
    });
  }

  if (result.audioMetrics.distortion > 30) {
    allSuggestions.push({
      id: `sug-dist-fix-${Date.now()}`,
      dimension: 'audio-noise',
      action: '音频存在明显失真，建议检查录音设备或重新录制',
      expectedImprovement: 20,
      priority: 'high',
      autoApplicable: false,
    });
  }

  // Check extreme video metrics
  if (result.videoMetrics.noise > 70) {
    allSuggestions.push({
      id: `sug-heavy-denoise-${Date.now()}`,
      dimension: 'noise',
      action: '噪点非常严重，建议使用强降噪滤镜',
      expectedImprovement: 25,
      priority: 'high',
      autoApplicable: true,
      params: { denoise: true, denoiseStrength: 0.8 },
    });
  }

  if (result.videoMetrics.stability < 30) {
    allSuggestions.push({
      id: `sug-heavy-stab-${Date.now()}`,
      dimension: 'stability',
      action: '画面抖动非常严重，建议使用强防抖或重新拍摄',
      expectedImprovement: 30,
      priority: 'high',
      autoApplicable: true,
      params: { stabilization: true, stabilizationStrength: 0.9 },
    });
  }

  // Deduplicate and sort by priority
  const priorityOrder: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  const seen = new Set<string>();
  const deduped: QualitySuggestion[] = [];

  for (const sug of allSuggestions.sort(
    (a, b) => (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4),
  )) {
    const key = `${sug.dimension}-${sug.action}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(sug);
    }
  }

  return deduped;
}

// ==================== Comparison ====================

/**
 * Compare quality between two assessment results.
 *
 * Identifies improved and regressed dimensions, and generates a recommendation.
 *
 * @param baseline - baseline assessment result
 * @param comparison - comparison assessment result
 * @returns quality comparison result
 */
export function compareQuality(
  baseline: EnhancedQualityAssessmentResult,
  comparison: EnhancedQualityAssessmentResult,
): QualityComparisonResult {
  const improvements: QualityComparisonResult['improvements'] = [];
  const regressions: QualityComparisonResult['regressions'] = [];

  // Build baseline dimension score map
  const baselineMap = new Map<QualityDimension, number>();
  for (const ds of baseline.dimensionScores) {
    baselineMap.set(ds.dimension, ds.score);
  }

  // Compare dimension by dimension
  for (const compDs of comparison.dimensionScores) {
    const baseScore = baselineMap.get(compDs.dimension) ?? 0;
    const delta = compDs.score - baseScore;

    if (delta > 2) {
      improvements.push({
        dimension: compDs.dimension,
        before: baseScore,
        after: compDs.score,
        delta: Math.round(delta),
      });
    } else if (delta < -2) {
      regressions.push({
        dimension: compDs.dimension,
        before: baseScore,
        after: compDs.score,
        delta: Math.round(delta),
      });
    }
  }

  const overallImprovement = comparison.overallScore - baseline.overallScore;

  // Generate recommendation text
  let recommendation: string;
  if (overallImprovement > 10) {
    recommendation = '质量有显著提升，建议保存当前优化设置';
  } else if (overallImprovement > 3) {
    recommendation = '质量有所改善，可继续微调以获得更好效果';
  } else if (overallImprovement > -3) {
    recommendation = '质量基本持平，建议关注具体维度的细微差异';
  } else if (overallImprovement > -10) {
    recommendation = '质量略有下降，建议检查退化维度的参数设置';
  } else {
    recommendation = '质量明显下降，建议回退到基准设置并重新调整';
  }

  return {
    baseline,
    comparison,
    improvements,
    regressions,
    overallImprovement: Math.round(overallImprovement),
    recommendation,
  };
}

// ==================== Configuration ====================

/**
 * Apply a quality profile preset.
 *
 * Generates an assessment configuration tailored to the given use case
 * (broadcast, web, social, cinema, archive).
 *
 * @param profile - quality profile type
 * @returns quality assessment configuration
 */
export function applyQualityProfile(profile: QualityProfile): QualityAssessmentConfig {
  const base = createDefaultQualityAssessmentConfig();

  switch (profile) {
    case 'broadcast':
      return {
        ...base,
        dimensions: [
          'sharpness',
          'noise',
          'exposure',
          'contrast',
          'color-balance',
          'stability',
          'audio-level',
          'audio-noise',
          'bitrate',
        ],
        weights: {
          sharpness: 0.15,
          noise: 0.1,
          exposure: 0.12,
          contrast: 0.1,
          saturation: 0.05,
          'color-balance': 0.12,
          stability: 0.1,
          'audio-level': 0.1,
          'audio-noise': 0.08,
          bitrate: 0.08,
        },
        qualityThresholds: {
          excellent: 92,
          good: 80,
          acceptable: 65,
          poor: 45,
        },
      };

    case 'web':
      return {
        ...base,
        dimensions: ['sharpness', 'noise', 'exposure', 'contrast', 'saturation', 'bitrate'],
        weights: {
          sharpness: 0.2,
          noise: 0.15,
          exposure: 0.15,
          contrast: 0.15,
          saturation: 0.15,
          bitrate: 0.2,
        },
        qualityThresholds: {
          excellent: 85,
          good: 70,
          acceptable: 55,
          poor: 35,
        },
      };

    case 'social':
      return {
        ...base,
        dimensions: ['sharpness', 'exposure', 'contrast', 'saturation', 'stability'],
        weights: {
          sharpness: 0.15,
          exposure: 0.2,
          contrast: 0.2,
          saturation: 0.25,
          stability: 0.2,
        },
        qualityThresholds: {
          excellent: 80,
          good: 65,
          acceptable: 50,
          poor: 30,
        },
      };

    case 'cinema':
      return {
        ...base,
        dimensions: [
          'sharpness',
          'noise',
          'exposure',
          'contrast',
          'saturation',
          'color-balance',
          'stability',
          'audio-level',
          'audio-noise',
          'bitrate',
        ],
        weights: {
          sharpness: 0.12,
          noise: 0.12,
          exposure: 0.12,
          contrast: 0.12,
          saturation: 0.08,
          'color-balance': 0.14,
          stability: 0.1,
          'audio-level': 0.08,
          'audio-noise': 0.06,
          bitrate: 0.06,
        },
        qualityThresholds: {
          excellent: 95,
          good: 85,
          acceptable: 70,
          poor: 50,
        },
        sampleCount: 20,
        enableFrameAnalysis: true,
        enableAudioAnalysis: true,
      };

    case 'archive':
      return {
        ...base,
        dimensions: [
          'sharpness',
          'noise',
          'exposure',
          'contrast',
          'saturation',
          'color-balance',
          'stability',
          'audio-level',
          'audio-noise',
          'bitrate',
        ],
        weights: {
          sharpness: 0.1,
          noise: 0.1,
          exposure: 0.1,
          contrast: 0.08,
          saturation: 0.08,
          'color-balance': 0.1,
          stability: 0.08,
          'audio-level': 0.1,
          'audio-noise': 0.1,
          bitrate: 0.16,
        },
        qualityThresholds: {
          excellent: 90,
          good: 75,
          acceptable: 60,
          poor: 40,
        },
        sampleCount: 30,
        enableFrameAnalysis: true,
        enableAudioAnalysis: true,
      };

    default:
      return base;
  }
}

/**
 * Create default quality assessment configuration.
 *
 * @returns default configuration
 */
export function createDefaultQualityAssessmentConfig(): QualityAssessmentConfig {
  return {
    dimensions: [
      'sharpness',
      'noise',
      'exposure',
      'contrast',
      'saturation',
      'color-balance',
      'stability',
      'audio-level',
      'audio-noise',
      'bitrate',
    ],
    weights: {
      sharpness: 0.15,
      noise: 0.12,
      exposure: 0.12,
      contrast: 0.1,
      saturation: 0.08,
      'color-balance': 0.08,
      stability: 0.1,
      'audio-level': 0.08,
      'audio-noise': 0.07,
      bitrate: 0.1,
    },
    sampleCount: 10,
    enableFrameAnalysis: true,
    enableAudioAnalysis: true,
    gpuAccelerated: false,
    qualityThresholds: {
      excellent: 90,
      good: 75,
      acceptable: 60,
      poor: 40,
    },
  };
}

/**
 * Validate quality assessment configuration.
 *
 * Checks: non-empty dimensions, valid dimension values, weight range 0-1,
 * positive sample count, monotonically decreasing thresholds in 0-100 range.
 *
 * @param config - configuration to validate
 * @returns whether valid
 */
export function validateQualityAssessmentConfig(config: QualityAssessmentConfig): boolean {
  // Dimensions must not be empty
  if (!config.dimensions || config.dimensions.length === 0) return false;

  // Check dimension values are valid
  const validDimensions: QualityDimension[] = [
    'sharpness',
    'noise',
    'exposure',
    'contrast',
    'saturation',
    'color-balance',
    'stability',
    'audio-level',
    'audio-noise',
    'bitrate',
  ];
  for (const dim of config.dimensions) {
    if (!validDimensions.includes(dim)) return false;
  }

  // Weights must be in 0-1 range
  if (config.weights) {
    for (const [_key, value] of Object.entries(config.weights)) {
      if (value !== undefined && (value < 0 || value > 1)) return false;
    }
  }

  // Sample count must be a positive integer in reasonable range
  if (config.sampleCount < 1 || config.sampleCount > 100) return false;

  // Thresholds must be monotonically decreasing
  const t = config.qualityThresholds;
  if (t.excellent <= t.good || t.good <= t.acceptable || t.acceptable <= t.poor) return false;

  // Thresholds must be in 0-100 range
  if (
    t.excellent < 0 ||
    t.excellent > 100 ||
    t.good < 0 ||
    t.good > 100 ||
    t.acceptable < 0 ||
    t.acceptable > 100 ||
    t.poor < 0 ||
    t.poor > 100
  ) {
    return false;
  }

  return true;
}

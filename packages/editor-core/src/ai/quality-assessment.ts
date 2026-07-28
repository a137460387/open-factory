/**
 * AI video quality assessment module (entry point).
 *
 * Re-exports all public APIs from sub-modules and contains computeQualityScore.
 *
 * Sub-modules:
 * - quality-assessment-analysis.ts: low-level analysis + core evaluation
 * - quality-assessment-config.ts: configuration, suggestions, comparison
 * - quality-assessment-prompts.ts: AI prompt building and response parsing
 *
 * All functions are pure computations with no side effects.
 */

import type {QualityDimension, QualityDimensionScore, QualityThresholds, QualityAssessmentConfig, QualityIssue, QualitySuggestion, VideoQualityMetrics, AudioQualityMetrics, EnhancedQualityAssessmentResult} from './quality-assessment-types.js';
import {clamp} from '../utils/math';
import {dimensionScoreToGrade, mapScoreToEnhancedGrade} from './quality-assessment-analysis.js';

// Re-export types from sub-module
export type {
  VideoQualityMetrics,
  AudioQualityMetrics,
  FrameQualityScore,
  QualityDimension,
  QualityDimensionScore,
  QualityThresholds,
  QualityAssessmentConfig,
  EnhancedQualityGrade,
  QualityIssue,
  QualitySuggestion,
  EnhancedQualityAssessmentResult,
  QualityComparisonResult,
  QualityProfile,
} from './quality-assessment-types.js';

// Re-export from analysis
export {
  computeImageSharpness,
  estimateNoiseLevel,
  analyzeExposure,
  computeColorBalance,
  mapScoreToEnhancedGrade,
  dimensionScoreToGrade,
} from './quality-assessment-analysis.js';

// Re-export from evaluation
export {
  assessVideoQuality,
  assessAudioQuality,
  assessFrameQuality,
} from './quality-assessment-evaluation.js';

// Re-export from config
export {
  generateOptimizationSuggestions,
  compareQuality,
  applyQualityProfile,
  createDefaultQualityAssessmentConfig,
  validateQualityAssessmentConfig,
} from './quality-assessment-config.js';

// Re-export from prompts
export {
  buildEnhancedQualitySystemPrompt,
  buildEnhancedQualityUserPrompt,
  parseEnhancedQualityResponse,
  parseEnhancedQualityResponseSafe,
} from './quality-assessment-prompts.js';

// ==================== Composite Scoring ====================

/**
 * Compute composite quality score.
 *
 * Calculates weighted dimension scores from video and audio metrics,
 * generates issues and suggestions per dimension, and produces
 * the final assessment result.
 *
 * @param metrics - video quality metrics
 * @param audioMetrics - audio quality metrics
 * @param config - quality assessment configuration
 * @returns quality assessment result
 */
export function computeQualityScore(
  metrics: VideoQualityMetrics,
  audioMetrics: AudioQualityMetrics,
  config: QualityAssessmentConfig,
): EnhancedQualityAssessmentResult {
  const startTime = Date.now();

  // Dimension-to-metric mapping
  const dimensionValueMap: Record<QualityDimension, number> = {
    sharpness: metrics.sharpness,
    noise: clamp(100 - metrics.noise, 0, 100), // Invert noise: lower raw = higher score
    exposure: metrics.exposure,
    contrast: metrics.contrast,
    saturation: metrics.saturation,
    'color-balance': metrics.colorBalance,
    stability: metrics.stability,
    'audio-level': clamp(100 - Math.abs(audioMetrics.rmsLevel + 14) * 3, 0, 100), // -14dB optimal
    'audio-noise': clamp(audioMetrics.noiseFloor < -60 ? 100 : 100 + (audioMetrics.noiseFloor + 60) * 1.5, 0, 100),
    bitrate: metrics.bitrate > 0 ? clamp(metrics.bitrate / 50, 0, 100) : 50,
  };

  // Default weights
  const defaultWeights: Record<QualityDimension, number> = {
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
  };

  // Build dimension scores
  const dimensionScores: QualityDimensionScore[] = [];
  const issues: QualityIssue[] = [];
  const suggestions: QualitySuggestion[] = [];

  for (const dim of config.dimensions) {
    const score = dimensionValueMap[dim];
    const weight = config.weights[dim] ?? defaultWeights[dim] ?? 0.1;
    const grade = dimensionScoreToGrade(score);

    const dimIssues: string[] = [];
    let dimSuggestion = '';

    // Generate issues and suggestions based on dimension and score
    if (grade === 'poor') {
      switch (dim) {
        case 'sharpness':
          dimIssues.push('画面模糊，细节丢失严重');
          dimSuggestion = '建议应用锐化滤镜或检查对焦';
          break;
        case 'noise':
          dimIssues.push('画面噪点明显，影响观看体验');
          dimSuggestion = '建议启用降噪功能';
          break;
        case 'exposure':
          dimIssues.push('曝光严重不准确');
          dimSuggestion = '建议调整亮度和曝光补偿';
          break;
        case 'contrast':
          dimIssues.push('对比度不足，画面灰蒙');
          dimSuggestion = '建议增加对比度';
          break;
        case 'saturation':
          dimIssues.push('色彩饱和度过低或过高');
          dimSuggestion = '建议调整饱和度';
          break;
        case 'color-balance':
          dimIssues.push('白平衡偏移明显');
          dimSuggestion = '建议进行白平衡校正';
          break;
        case 'stability':
          dimIssues.push('画面抖动严重');
          dimSuggestion = '建议启用防抖功能';
          break;
        case 'audio-level':
          dimIssues.push('音频电平异常');
          dimSuggestion = '建议调整音量到 -14dB 左右';
          break;
        case 'audio-noise':
          dimIssues.push('音频底噪过高');
          dimSuggestion = '建议启用音频降噪';
          break;
        case 'bitrate':
          dimIssues.push('码率偏低，画质受限');
          dimSuggestion = '建议提高输出码率';
          break;
      }
    } else if (grade === 'acceptable') {
      switch (dim) {
        case 'sharpness':
          dimIssues.push('画面锐度尚可，有提升空间');
          dimSuggestion = '可轻微增强锐化';
          break;
        case 'noise':
          dimIssues.push('存在一定噪点');
          dimSuggestion = '可轻微降噪';
          break;
        case 'exposure':
          dimIssues.push('曝光略有偏差');
          dimSuggestion = '可微调亮度';
          break;
        default:
          dimIssues.push(`${dim} 质量一般`);
          dimSuggestion = `可优化 ${dim} 参数`;
      }
    }

    // Generate quality issues
    for (const issueDesc of dimIssues) {
      const severity: QualityIssue['severity'] = grade === 'poor' ? 'high' : grade === 'acceptable' ? 'medium' : 'low';
      issues.push({
        type: dim,
        severity,
        dimension: dim,
        description: issueDesc,
        suggestedFix: dimSuggestion,
      });
    }

    // Generate optimization suggestions
    if (score < 75) {
      const priority: QualitySuggestion['priority'] =
        score < 40 ? 'critical' : score < 55 ? 'high' : score < 65 ? 'medium' : 'low';
      const expectedImprovement = Math.round((75 - score) * 0.6);

      const suggestionParams: Record<string, Record<string, number | boolean>> = {
        sharpness: { sharpness: 1.5 },
        noise: { denoise: true },
        exposure: { brightness: 0.2 },
        contrast: { contrast: 1.2 },
        saturation: { saturation: 1.15 },
        'color-balance': { colorTemperature: 0 },
        stability: { stabilization: true },
        'audio-level': { volume: 1.3 },
        'audio-noise': { noiseReduction: true },
        bitrate: { bitrate: 8000 },
      };

      suggestions.push({
        id: `sug-${dim}-${Date.now()}`,
        dimension: dim,
        action: dimSuggestion,
        expectedImprovement,
        priority,
        autoApplicable: score >= 55,
        params: suggestionParams[dim],
      });
    }

    dimensionScores.push({
      dimension: dim,
      score: Math.round(score),
      weight,
      issues: dimIssues,
      suggestion: dimSuggestion,
    });
  }

  // Compute weighted overall score
  let totalWeight = 0;
  let weightedSum = 0;
  for (const ds of dimensionScores) {
    weightedSum += ds.score * ds.weight;
    totalWeight += ds.weight;
  }
  const overallScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

  const processingTimeMs = Date.now() - startTime;

  return {
    overallScore: clamp(overallScore, 0, 100),
    videoMetrics: metrics,
    audioMetrics: audioMetrics,
    dimensionScores,
    frameScores: [],
    issues,
    suggestions,
    grade: mapScoreToEnhancedGrade(overallScore),
    processingTimeMs,
  };
}

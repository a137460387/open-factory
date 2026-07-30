/**
 * Quality assessment - AI prompt building and response parsing.
 *
 * Contains system/user prompt construction for AI-based quality assessment,
 * and safe JSON response parsing with full validation.
 */

import type {AiModuleResult, TranslateFn} from '../ai-module-types';
import {identityTranslator} from '../ai-module-types';
import {clamp} from '../utils/math';

import type {
  VideoQualityMetrics,
  AudioQualityMetrics,
  QualityDimension,
  QualityDimensionScore,
  QualityAssessmentConfig,
  EnhancedQualityGrade,
  QualityIssue,
  QualitySuggestion,
  EnhancedQualityAssessmentResult,
  QualityProfile,
} from './quality-assessment-types.js';

import {mapScoreToEnhancedGrade} from './quality-assessment-analysis.js';

// ==================== Prompt Building ====================

/**
 * Build AI quality assessment system prompt.
 *
 * Generates a system prompt that instructs the AI on how to evaluate video quality,
 * including evaluation dimensions, scoring criteria, and output format.
 *
 * @param profile - optional quality profile affecting evaluation focus
 * @returns system prompt string
 */
export function buildEnhancedQualitySystemPrompt(profile?: QualityProfile): string {
  const profileGuidance: Record<QualityProfile, string> = {
    broadcast: '广播级评估：重点关注信号合规性、色彩精度、音频电平标准化和码率达标。',
    web: '网络发布评估：重点关注压缩效率、加载友好性、清晰度和色彩吸引力。',
    social: '社交媒体评估：重点关注移动端观看体验、色彩鲜艳度、曝光合理性和内容稳定性。',
    cinema: '影院级评估：重点关注动态范围、色彩精度、噪点控制、音频纯净度和整体艺术品质。',
    archive: '归档级评估：重点关注长期保存质量、码率充足性、元数据完整性和信号无损程度。',
  };

  const guidance = profile ? profileGuidance[profile] : '通用质量评估：综合考量各维度。';

  return [
    '你是一个专业的视频质量评估助手。请根据提供的视频帧数据和音频指标，',
    '对视频素材进行全面的质量评估。',
    '',
    `评估场景：${guidance}`,
    '',
    '评估维度包括：',
    '- sharpness (锐度): 画面清晰度，使用拉普拉斯方差法衡量',
    '- noise (噪声): 画面噪点水平，值越低越好',
    '- exposure (曝光): 亮度合理性，避免过曝和欠曝',
    '- contrast (对比度): 明暗层次丰富度',
    '- saturation (饱和度): 色彩鲜艳程度',
    '- color-balance (色彩平衡): 白平衡准确性',
    '- stability (稳定性): 画面抖动程度',
    '- audio-level (音频电平): 响度合理性，推荐 -14 LUFS 附近',
    '- audio-noise (音频噪声): 底噪水平',
    '- bitrate (码率): 压缩质量',
    '',
    '评分标准：0-100 分，等级映射：',
    '- S (95+): 完美品质',
    '- A (85-94): 优秀品质',
    '- B (70-84): 良好品质',
    '- C (55-69): 一般品质',
    '- D (40-54): 较差品质',
    '- F (<40): 不合格',
    '',
    '返回格式必须是 JSON 对象，结构如下：',
    '{"overallScore":0-100,"grade":"S|A|B|C|D|F","dimensionScores":[{"dimension":"维度名","score":0-100,"issues":["问题"],"suggestion":"建议"}],"issues":[{"type":"类型","severity":"low|medium|high|critical","dimension":"维度","description":"描述","suggestedFix":"修复建议"}],"suggestions":[{"id":"ID","dimension":"维度","action":"操作","expectedImprovement":0-100,"priority":"low|medium|high|critical","autoApplicable":true/false}]}',
  ].join('\n');
}

/**
 * Build AI quality assessment user prompt.
 *
 * Formats video and audio metrics into a user prompt for AI analysis.
 *
 * @param metrics - video quality metrics
 * @param audioMetrics - audio quality metrics
 * @returns user prompt string
 */
export function buildEnhancedQualityUserPrompt(
  metrics: VideoQualityMetrics,
  audioMetrics: AudioQualityMetrics,
): string {
  const parts: string[] = [
    '请对以下视频素材进行质量评估，返回 JSON 格式的评估结果。',
    '',
    '--- 视频指标 ---',
    `锐度: ${metrics.sharpness}/100`,
    `噪声水平: ${metrics.noise}/100 (越低越好)`,
    `曝光质量: ${metrics.exposure}/100`,
    `对比度: ${metrics.contrast}/100`,
    `饱和度: ${metrics.saturation}/100`,
    `色彩平衡: ${metrics.colorBalance}/100`,
    `稳定性: ${metrics.stability}/100`,
    `分辨率: ${metrics.resolution.width}x${metrics.resolution.height}`,
    `帧率: ${metrics.frameRate} fps`,
    `码率: ${metrics.bitrate} kbps`,
    '',
    '--- 音频指标 ---',
    `RMS 电平: ${audioMetrics.rmsLevel} dB`,
    `峰值电平: ${audioMetrics.peakLevel} dB`,
    `噪声底: ${audioMetrics.noiseFloor} dB`,
    `动态范围: ${audioMetrics.dynamicRange} dB`,
    `削波: ${audioMetrics.clipping ? '是' : '否'}`,
    `失真度: ${audioMetrics.distortion}/100`,
    `频率平衡: ${audioMetrics.frequencyBalance}/100`,
    '',
    '请根据以上指标给出综合评估，包括各维度评分、发现的问题和优化建议。',
  ];

  return parts.join('\n');
}

// ==================== Response Parsing ====================

/**
 * Parse enhanced quality assessment AI response.
 *
 * Extracts and validates a quality assessment result from AI-returned JSON.
 *
 * @param json - raw JSON data from AI
 * @returns quality assessment result
 */
export function parseEnhancedQualityResponse(json: unknown): EnhancedQualityAssessmentResult {
  const emptyResult: EnhancedQualityAssessmentResult = {
    overallScore: 0,
    videoMetrics: {
      sharpness: 0,
      noise: 0,
      exposure: 0,
      contrast: 0,
      saturation: 0,
      colorBalance: 0,
      stability: 0,
      bitrate: 0,
      resolution: { width: 0, height: 0 },
      frameRate: 0,
    },
    audioMetrics: {
      rmsLevel: -100,
      peakLevel: -100,
      noiseFloor: -100,
      dynamicRange: 0,
      clipping: false,
      distortion: 0,
      frequencyBalance: 0,
    },
    dimensionScores: [],
    frameScores: [],
    issues: [],
    suggestions: [],
    grade: 'F',
    processingTimeMs: 0,
  };

  if (!json || typeof json !== 'object') return emptyResult;
  const obj = json as Record<string, unknown>;

  // Parse overall score
  const overallScore = clamp(
    typeof obj.overallScore === 'number' && !Number.isNaN(obj.overallScore) ? Math.round(obj.overallScore) : 0,
    0,
    100,
  );

  // Parse grade
  const validGrades: EnhancedQualityGrade[] = ['S', 'A', 'B', 'C', 'D', 'F'];
  const grade = validGrades.includes(obj.grade as EnhancedQualityGrade)
    ? (obj.grade as EnhancedQualityGrade)
    : mapScoreToEnhancedGrade(overallScore);

  // Parse dimension scores
  const dimensionScores: QualityDimensionScore[] = [];
  if (Array.isArray(obj.dimensionScores)) {
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
    for (const item of obj.dimensionScores) {
      if (item && typeof item === 'object') {
        const ds = item as Record<string, unknown>;
        if (
          typeof ds.dimension === 'string' &&
          validDimensions.includes(ds.dimension as QualityDimension) &&
          typeof ds.score === 'number'
        ) {
          dimensionScores.push({
            dimension: ds.dimension as QualityDimension,
            score: clamp(Math.round(ds.score), 0, 100),
            weight: typeof ds.weight === 'number' ? clamp(ds.weight, 0, 1) : 0.1,
            issues: Array.isArray(ds.issues) ? ds.issues.filter((i: unknown) => typeof i === 'string') : [],
            suggestion: typeof ds.suggestion === 'string' ? ds.suggestion : '',
          });
        }
      }
    }
  }

  // Parse issues
  const issues: QualityIssue[] = [];
  if (Array.isArray(obj.issues)) {
    const validSeverities = ['low', 'medium', 'high', 'critical'];
    for (const item of obj.issues) {
      if (item && typeof item === 'object') {
        const issue = item as Record<string, unknown>;
        if (
          typeof issue.type === 'string' &&
          validSeverities.includes(issue.severity as string) &&
          typeof issue.description === 'string'
        ) {
          issues.push({
            type: issue.type,
            severity: issue.severity as QualityIssue['severity'],
            dimension: typeof issue.dimension === 'string' ? (issue.dimension as QualityDimension) : 'sharpness',
            description: issue.description,
            suggestedFix: typeof issue.suggestedFix === 'string' ? issue.suggestedFix : '',
          });
        }
      }
    }
  }

  // Parse suggestions
  const suggestions: QualitySuggestion[] = [];
  if (Array.isArray(obj.suggestions)) {
    const validPriorities = ['low', 'medium', 'high', 'critical'];
    for (const item of obj.suggestions) {
      if (item && typeof item === 'object') {
        const sug = item as Record<string, unknown>;
        if (typeof sug.id === 'string' && typeof sug.action === 'string' && typeof sug.dimension === 'string') {
          suggestions.push({
            id: sug.id,
            dimension: sug.dimension as QualityDimension,
            action: sug.action,
            expectedImprovement:
              typeof sug.expectedImprovement === 'number' ? clamp(Math.round(sug.expectedImprovement), 0, 100) : 0,
            priority: validPriorities.includes(sug.priority as string)
              ? (sug.priority as QualitySuggestion['priority'])
              : 'medium',
            autoApplicable: typeof sug.autoApplicable === 'boolean' ? sug.autoApplicable : false,
            params:
              typeof sug.params === 'object' && sug.params !== null
                ? (sug.params as Record<string, number | boolean>)
                : undefined,
          });
        }
      }
    }
  }

  return {
    overallScore,
    videoMetrics: emptyResult.videoMetrics,
    audioMetrics: emptyResult.audioMetrics,
    dimensionScores,
    frameScores: [],
    issues,
    suggestions,
    grade,
    processingTimeMs: typeof obj.processingTimeMs === 'number' ? obj.processingTimeMs : 0,
  };
}

/**
 * Safely parse enhanced quality assessment AI response.
 *
 * Wraps parseEnhancedQualityResponse, returning an error message instead of
 * throwing on parse failure.
 *
 * @param json - raw JSON data from AI
 * @param t - optional translation function
 * @returns quality assessment result wrapped in AiModuleResult
 */
export async function parseEnhancedQualityResponseSafe(
  json: unknown,
  t: TranslateFn = identityTranslator,
): Promise<AiModuleResult<EnhancedQualityAssessmentResult>> {
  try {
    const data = parseEnhancedQualityResponse(json);
    return { data, error: null };
  } catch {
    const emptyResult: EnhancedQualityAssessmentResult = {
      overallScore: 0,
      videoMetrics: {
        sharpness: 0,
        noise: 0,
        exposure: 0,
        contrast: 0,
        saturation: 0,
        colorBalance: 0,
        stability: 0,
        bitrate: 0,
        resolution: { width: 0, height: 0 },
        frameRate: 0,
      },
      audioMetrics: {
        rmsLevel: -100,
        peakLevel: -100,
        noiseFloor: -100,
        dynamicRange: 0,
        clipping: false,
        distortion: 0,
        frequencyBalance: 0,
      },
      dimensionScores: [],
      frameScores: [],
      issues: [],
      suggestions: [],
      grade: 'F',
      processingTimeMs: 0,
    };
    return { data: emptyResult, error: t('aiModules.error.parseFailed') };
  }
}

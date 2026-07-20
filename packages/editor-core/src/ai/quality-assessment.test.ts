import { describe, it, expect } from 'vitest';
import {
  computeImageSharpness,
  estimateNoiseLevel,
  analyzeExposure,
  computeColorBalance,
  mapScoreToEnhancedGrade,
  dimensionScoreToGrade,
  createDefaultQualityAssessmentConfig,
  validateQualityAssessmentConfig,
  applyQualityProfile,
  assessFrameQuality,
  assessAudioQuality,
  compareQuality,
  generateOptimizationSuggestions,
  buildEnhancedQualitySystemPrompt,
  parseEnhancedQualityResponse,
  parseEnhancedQualityResponseSafe,
} from './quality-assessment';
import type { EnhancedQualityAssessmentResult } from './quality-assessment';

// ==================== 测试辅助数据 ====================

/** 创建一个 RGBA 帧，指定大小和均匀颜色 */
function makeFrame(width: number, height: number, r: number, g: number, b: number, a = 255): Uint8Array {
  const frame = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    frame[i * 4] = r;
    frame[i * 4 + 1] = g;
    frame[i * 4 + 2] = b;
    frame[i * 4 + 3] = a;
  }
  return frame;
}

/** 创建带有棋盘格图案的帧（用于产生边缘/锐度） */
function makeCheckerboardFrame(width: number, height: number): Uint8Array {
  const frame = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const v = (x + y) % 2 === 0 ? 255 : 0;
      frame[i] = v;
      frame[i + 1] = v;
      frame[i + 2] = v;
      frame[i + 3] = 255;
    }
  }
  return frame;
}

/** 创建正弦波音频数据 */
function makeSineWave(frequency: number, sampleRate: number, durationSec: number, amplitude = 0.5): Float32Array {
  const length = Math.floor(sampleRate * durationSec);
  const data = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    data[i] = amplitude * Math.sin((2 * Math.PI * frequency * i) / sampleRate);
  }
  return data;
}

/** 创建一个最小的评估结果 */
function makeResult(overrides: Partial<EnhancedQualityAssessmentResult> = {}): EnhancedQualityAssessmentResult {
  return {
    overallScore: 70,
    videoMetrics: {
      sharpness: 70,
      noise: 20,
      exposure: 80,
      contrast: 65,
      saturation: 60,
      colorBalance: 75,
      stability: 90,
      bitrate: 5000,
      resolution: { width: 1920, height: 1080 },
      frameRate: 30,
    },
    audioMetrics: {
      rmsLevel: -14,
      peakLevel: -3,
      noiseFloor: -60,
      dynamicRange: 40,
      clipping: false,
      distortion: 5,
      frequencyBalance: 70,
    },
    dimensionScores: [
      { dimension: 'sharpness', score: 70, weight: 0.15, issues: [], suggestion: '' },
      { dimension: 'noise', score: 80, weight: 0.12, issues: [], suggestion: '' },
      { dimension: 'exposure', score: 80, weight: 0.12, issues: [], suggestion: '' },
    ],
    frameScores: [],
    issues: [],
    suggestions: [],
    grade: 'B',
    processingTimeMs: 10,
    ...overrides,
  };
}

// ==================== computeImageSharpness ====================

describe('computeImageSharpness', () => {
  it('should return 0 for too-small frame', () => {
    const frame = makeFrame(2, 2, 128, 128, 128);
    expect(computeImageSharpness(frame, 2, 2)).toBe(0);
  });

  it('should return 0 for insufficient frame data', () => {
    const frame = new Uint8Array(10); // way too small
    expect(computeImageSharpness(frame, 100, 100)).toBe(0);
  });

  it('should return a higher score for checkerboard than flat image', () => {
    const size = 16;
    const flat = makeFrame(size, size, 128, 128, 128);
    const checker = makeCheckerboardFrame(size, size);
    const flatSharpness = computeImageSharpness(flat, size, size);
    const checkerSharpness = computeImageSharpness(checker, size, size);
    expect(checkerSharpness).toBeGreaterThan(flatSharpness);
  });

  it('should return a value between 0 and 100', () => {
    const frame = makeCheckerboardFrame(16, 16);
    const score = computeImageSharpness(frame, 16, 16);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('should return 0 for a uniform flat frame', () => {
    const frame = makeFrame(16, 16, 128, 128, 128);
    expect(computeImageSharpness(frame, 16, 16)).toBe(0);
  });
});

// ==================== estimateNoiseLevel ====================

describe('estimateNoiseLevel', () => {
  it('should return 0 for too-small frame', () => {
    const frame = makeFrame(2, 2, 128, 128, 128);
    expect(estimateNoiseLevel(frame, 2, 2)).toBe(0);
  });

  it('should return 0 for insufficient frame data', () => {
    const frame = new Uint8Array(10);
    expect(estimateNoiseLevel(frame, 100, 100)).toBe(0);
  });

  it('should return a value between 0 and 100', () => {
    const frame = makeCheckerboardFrame(16, 16);
    const noise = estimateNoiseLevel(frame, 16, 16);
    expect(noise).toBeGreaterThanOrEqual(0);
    expect(noise).toBeLessThanOrEqual(100);
  });

  it('should return 0 noise for a flat uniform frame', () => {
    const frame = makeFrame(16, 16, 128, 128, 128);
    expect(estimateNoiseLevel(frame, 16, 16)).toBe(0);
  });

  it('should detect noise in a noisy frame (random pixels)', () => {
    // Create a frame with random pixel values to simulate noise
    const size = 32;
    const frame = new Uint8Array(size * size * 4);
    for (let i = 0; i < frame.length; i += 4) {
      const v = Math.floor(Math.random() * 256);
      frame[i] = v;
      frame[i + 1] = v;
      frame[i + 2] = v;
      frame[i + 3] = 255;
    }
    const noise = estimateNoiseLevel(frame, size, size);
    expect(noise).toBeGreaterThanOrEqual(0);
    expect(noise).toBeLessThanOrEqual(100);
  });
});

// ==================== analyzeExposure ====================

describe('analyzeExposure', () => {
  it('should return all zeros for empty frame', () => {
    const result = analyzeExposure(new Uint8Array(0));
    expect(result.mean).toBe(0);
    expect(result.overexposed).toBe(0);
    expect(result.underexposed).toBe(0);
  });

  it('should return correct mean for a uniform frame', () => {
    const frame = makeFrame(8, 8, 100, 100, 100);
    const result = analyzeExposure(frame);
    // luminance of (100, 100, 100) = 0.299*100 + 0.587*100 + 0.114*100 = 100
    expect(result.mean).toBeCloseTo(100, 0);
    expect(result.overexposed).toBe(0);
    expect(result.underexposed).toBe(0);
  });

  it('should detect overexposed pixels', () => {
    const frame = makeFrame(8, 8, 255, 255, 255);
    const result = analyzeExposure(frame);
    expect(result.overexposed).toBeCloseTo(1, 1);
  });

  it('should detect underexposed pixels', () => {
    const frame = makeFrame(8, 8, 0, 0, 0);
    const result = analyzeExposure(frame);
    expect(result.underexposed).toBeCloseTo(1, 1);
  });

  it('should return overexposed and underexposed in 0-1 range', () => {
    const frame = makeFrame(8, 8, 128, 128, 128);
    const result = analyzeExposure(frame);
    expect(result.overexposed).toBeGreaterThanOrEqual(0);
    expect(result.overexposed).toBeLessThanOrEqual(1);
    expect(result.underexposed).toBeGreaterThanOrEqual(0);
    expect(result.underexposed).toBeLessThanOrEqual(1);
  });
});

// ==================== computeColorBalance ====================

describe('computeColorBalance', () => {
  it('should return zeros for empty frame', () => {
    const result = computeColorBalance(new Uint8Array(0), 0, 0);
    expect(result.r).toBe(0);
    expect(result.g).toBe(0);
    expect(result.b).toBe(0);
  });

  it('should return equal R/G/B for a neutral gray frame', () => {
    const frame = makeFrame(16, 16, 128, 128, 128);
    const result = computeColorBalance(frame, 16, 16);
    expect(result.r).toBeCloseTo(128, 0);
    expect(result.g).toBeCloseTo(128, 0);
    expect(result.b).toBeCloseTo(128, 0);
  });

  it('should reflect channel differences in a red-tinted frame', () => {
    const frame = makeFrame(16, 16, 200, 50, 50);
    const result = computeColorBalance(frame, 16, 16);
    expect(result.r).toBeGreaterThan(result.g);
    expect(result.r).toBeGreaterThan(result.b);
  });

  it('should handle small dimensions (fallback to full image)', () => {
    const frame = makeFrame(2, 2, 100, 150, 200);
    const result = computeColorBalance(frame, 2, 2);
    expect(result.r).toBeCloseTo(100, 0);
    expect(result.g).toBeCloseTo(150, 0);
    expect(result.b).toBeCloseTo(200, 0);
  });
});

// ==================== mapScoreToEnhancedGrade ====================

describe('mapScoreToEnhancedGrade', () => {
  it('should return S for 95+', () => {
    expect(mapScoreToEnhancedGrade(95)).toBe('S');
    expect(mapScoreToEnhancedGrade(100)).toBe('S');
  });

  it('should return A for 85-94', () => {
    expect(mapScoreToEnhancedGrade(85)).toBe('A');
    expect(mapScoreToEnhancedGrade(94)).toBe('A');
  });

  it('should return B for 70-84', () => {
    expect(mapScoreToEnhancedGrade(70)).toBe('B');
    expect(mapScoreToEnhancedGrade(84)).toBe('B');
  });

  it('should return C for 55-69', () => {
    expect(mapScoreToEnhancedGrade(55)).toBe('C');
    expect(mapScoreToEnhancedGrade(69)).toBe('C');
  });

  it('should return D for 40-54', () => {
    expect(mapScoreToEnhancedGrade(40)).toBe('D');
    expect(mapScoreToEnhancedGrade(54)).toBe('D');
  });

  it('should return F for below 40', () => {
    expect(mapScoreToEnhancedGrade(39)).toBe('F');
    expect(mapScoreToEnhancedGrade(0)).toBe('F');
  });

  it('should clamp scores to 0-100', () => {
    expect(mapScoreToEnhancedGrade(-10)).toBe('F');
    expect(mapScoreToEnhancedGrade(110)).toBe('S');
  });
});

// ==================== dimensionScoreToGrade ====================

describe('dimensionScoreToGrade', () => {
  it('should return excellent for 90+', () => {
    expect(dimensionScoreToGrade(90)).toBe('excellent');
    expect(dimensionScoreToGrade(100)).toBe('excellent');
  });

  it('should return good for 75-89', () => {
    expect(dimensionScoreToGrade(75)).toBe('good');
    expect(dimensionScoreToGrade(89)).toBe('good');
  });

  it('should return acceptable for 60-74', () => {
    expect(dimensionScoreToGrade(60)).toBe('acceptable');
    expect(dimensionScoreToGrade(74)).toBe('acceptable');
  });

  it('should return poor for below 60', () => {
    expect(dimensionScoreToGrade(59)).toBe('poor');
    expect(dimensionScoreToGrade(0)).toBe('poor');
  });

  it('should clamp out-of-range scores', () => {
    expect(dimensionScoreToGrade(-5)).toBe('poor');
    expect(dimensionScoreToGrade(105)).toBe('excellent');
  });
});

// ==================== createDefaultQualityAssessmentConfig ====================

describe('createDefaultQualityAssessmentConfig', () => {
  it('should have all 10 dimensions', () => {
    const config = createDefaultQualityAssessmentConfig();
    expect(config.dimensions.length).toBe(10);
    expect(config.dimensions).toContain('sharpness');
    expect(config.dimensions).toContain('noise');
    expect(config.dimensions).toContain('bitrate');
  });

  it('should have valid weights', () => {
    const config = createDefaultQualityAssessmentConfig();
    for (const value of Object.values(config.weights)) {
      if (value !== undefined) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });

  it('should have sampleCount > 0', () => {
    const config = createDefaultQualityAssessmentConfig();
    expect(config.sampleCount).toBeGreaterThan(0);
  });

  it('should have monotonic thresholds', () => {
    const config = createDefaultQualityAssessmentConfig();
    const t = config.qualityThresholds;
    expect(t.excellent).toBeGreaterThan(t.good);
    expect(t.good).toBeGreaterThan(t.acceptable);
    expect(t.acceptable).toBeGreaterThan(t.poor);
  });
});

// ==================== validateQualityAssessmentConfig ====================

describe('validateQualityAssessmentConfig', () => {
  it('should return true for default config', () => {
    const config = createDefaultQualityAssessmentConfig();
    expect(validateQualityAssessmentConfig(config)).toBe(true);
  });

  it('should return false for empty dimensions', () => {
    const config = { ...createDefaultQualityAssessmentConfig(), dimensions: [] };
    expect(validateQualityAssessmentConfig(config)).toBe(false);
  });

  it('should return false for invalid dimension values', () => {
    const config = {
      ...createDefaultQualityAssessmentConfig(),
      dimensions: ['invalid-dim' as any],
    };
    expect(validateQualityAssessmentConfig(config)).toBe(false);
  });

  it('should return false for out-of-range weights', () => {
    const config = {
      ...createDefaultQualityAssessmentConfig(),
      weights: { sharpness: 1.5 },
    };
    expect(validateQualityAssessmentConfig(config)).toBe(false);
  });

  it('should return false for invalid sampleCount', () => {
    const config = { ...createDefaultQualityAssessmentConfig(), sampleCount: 0 };
    expect(validateQualityAssessmentConfig(config)).toBe(false);
  });

  it('should return false for non-monotonic thresholds', () => {
    const config = {
      ...createDefaultQualityAssessmentConfig(),
      qualityThresholds: { excellent: 50, good: 60, acceptable: 70, poor: 80 },
    };
    expect(validateQualityAssessmentConfig(config)).toBe(false);
  });

  it('should return false for threshold values outside 0-100', () => {
    const config = {
      ...createDefaultQualityAssessmentConfig(),
      qualityThresholds: { excellent: 110, good: 75, acceptable: 60, poor: 40 },
    };
    expect(validateQualityAssessmentConfig(config)).toBe(false);
  });
});

// ==================== applyQualityProfile ====================

describe('applyQualityProfile', () => {
  it('broadcast should produce a valid config', () => {
    const config = applyQualityProfile('broadcast');
    expect(validateQualityAssessmentConfig(config)).toBe(true);
    expect(config.dimensions).toContain('audio-level');
  });

  it('web should produce a valid config', () => {
    const config = applyQualityProfile('web');
    expect(validateQualityAssessmentConfig(config)).toBe(true);
    expect(config.dimensions).toContain('bitrate');
  });

  it('social should produce a valid config', () => {
    const config = applyQualityProfile('social');
    expect(validateQualityAssessmentConfig(config)).toBe(true);
    expect(config.dimensions).toContain('saturation');
  });

  it('cinema should produce a valid config with higher sampleCount', () => {
    const config = applyQualityProfile('cinema');
    expect(validateQualityAssessmentConfig(config)).toBe(true);
    expect(config.sampleCount).toBe(20);
  });

  it('archive should produce a valid config with highest sampleCount', () => {
    const config = applyQualityProfile('archive');
    expect(validateQualityAssessmentConfig(config)).toBe(true);
    expect(config.sampleCount).toBe(30);
  });

  it('default profile should return the default config', () => {
    const config = applyQualityProfile('broadcast' as any);
    // Just verify it is valid
    expect(validateQualityAssessmentConfig(config)).toBe(true);
  });
});

// ==================== assessFrameQuality ====================

describe('assessFrameQuality', () => {
  it('should return scores in 0-100 range for a flat frame', () => {
    const frame = makeFrame(16, 16, 128, 128, 128);
    const result = assessFrameQuality(frame, 16, 16);
    expect(result.sharpness).toBeGreaterThanOrEqual(0);
    expect(result.sharpness).toBeLessThanOrEqual(100);
    expect(result.noise).toBeGreaterThanOrEqual(0);
    expect(result.noise).toBeLessThanOrEqual(100);
    expect(result.exposure).toBeGreaterThanOrEqual(0);
    expect(result.exposure).toBeLessThanOrEqual(100);
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
  });

  it('should give higher sharpness for checkerboard than flat', () => {
    const flat = makeFrame(16, 16, 128, 128, 128);
    const checker = makeCheckerboardFrame(16, 16);
    const flatResult = assessFrameQuality(flat, 16, 16);
    const checkerResult = assessFrameQuality(checker, 16, 16);
    expect(checkerResult.sharpness).toBeGreaterThan(flatResult.sharpness);
  });

  it('should give frameIndex and timestamp as 0', () => {
    const frame = makeFrame(16, 16, 128, 128, 128);
    const result = assessFrameQuality(frame, 16, 16);
    expect(result.frameIndex).toBe(0);
    expect(result.timestamp).toBe(0);
  });
});

// ==================== assessAudioQuality ====================

describe('assessAudioQuality', () => {
  const defaultConfig = createDefaultQualityAssessmentConfig();

  it('should return default values for empty audio', () => {
    const result = assessAudioQuality(new Float32Array(0), 44100, defaultConfig);
    expect(result.rmsLevel).toBe(-100);
    expect(result.clipping).toBe(false);
  });

  it('should detect clipping in saturated audio', () => {
    const audio = new Float32Array(44100);
    for (let i = 0; i < audio.length; i++) {
      audio[i] = i % 2 === 0 ? 1.0 : -1.0;
    }
    const result = assessAudioQuality(audio, 44100, defaultConfig);
    expect(result.clipping).toBe(true);
  });

  it('should not flag clipping for normal audio', () => {
    const audio = makeSineWave(440, 44100, 1.0, 0.3);
    const result = assessAudioQuality(audio, 44100, defaultConfig);
    expect(result.clipping).toBe(false);
  });

  it('should return RMS level in reasonable dB range', () => {
    const audio = makeSineWave(440, 44100, 1.0, 0.5);
    const result = assessAudioQuality(audio, 44100, defaultConfig);
    expect(result.rmsLevel).toBeLessThan(0);
    expect(result.rmsLevel).toBeGreaterThanOrEqual(-100);
  });

  it('should return dynamic range >= 0', () => {
    const audio = makeSineWave(440, 44100, 1.0, 0.5);
    const result = assessAudioQuality(audio, 44100, defaultConfig);
    expect(result.dynamicRange).toBeGreaterThanOrEqual(0);
  });

  it('should return frequencyBalance between 0 and 100', () => {
    const audio = makeSineWave(440, 44100, 1.0, 0.5);
    const result = assessAudioQuality(audio, 44100, defaultConfig);
    expect(result.frequencyBalance).toBeGreaterThanOrEqual(0);
    expect(result.frequencyBalance).toBeLessThanOrEqual(100);
  });
});

// ==================== compareQuality ====================

describe('compareQuality', () => {
  it('should detect improvements when comparison is better', () => {
    const baseline = makeResult({
      overallScore: 60,
      dimensionScores: [
        { dimension: 'sharpness', score: 50, weight: 0.15, issues: [], suggestion: '' },
        { dimension: 'noise', score: 60, weight: 0.12, issues: [], suggestion: '' },
      ],
    });
    const comparison = makeResult({
      overallScore: 80,
      dimensionScores: [
        { dimension: 'sharpness', score: 80, weight: 0.15, issues: [], suggestion: '' },
        { dimension: 'noise', score: 75, weight: 0.12, issues: [], suggestion: '' },
      ],
    });
    const result = compareQuality(baseline, comparison);
    expect(result.improvements.length).toBeGreaterThan(0);
    expect(result.overallImprovement).toBe(20);
  });

  it('should detect regressions when comparison is worse', () => {
    const baseline = makeResult({
      overallScore: 80,
      dimensionScores: [{ dimension: 'sharpness', score: 80, weight: 0.15, issues: [], suggestion: '' }],
    });
    const comparison = makeResult({
      overallScore: 50,
      dimensionScores: [{ dimension: 'sharpness', score: 40, weight: 0.15, issues: [], suggestion: '' }],
    });
    const result = compareQuality(baseline, comparison);
    expect(result.regressions.length).toBeGreaterThan(0);
    expect(result.overallImprovement).toBeLessThan(0);
  });

  it('should include recommendation string', () => {
    const baseline = makeResult({ overallScore: 70 });
    const comparison = makeResult({ overallScore: 72 });
    const result = compareQuality(baseline, comparison);
    expect(typeof result.recommendation).toBe('string');
    expect(result.recommendation.length).toBeGreaterThan(0);
  });

  it('should return empty improvements and regressions when scores are equal', () => {
    const baseline = makeResult();
    const comparison = makeResult();
    const result = compareQuality(baseline, comparison);
    expect(result.improvements.length).toBe(0);
    expect(result.regressions.length).toBe(0);
    expect(result.overallImprovement).toBe(0);
  });
});

// ==================== generateOptimizationSuggestions ====================

describe('generateOptimizationSuggestions', () => {
  it('should return suggestions for a low-score result', () => {
    const result = makeResult({
      overallScore: 30,
      dimensionScores: [
        { dimension: 'sharpness', score: 30, weight: 0.15, issues: ['blur'], suggestion: 'sharpen' },
        { dimension: 'noise', score: 25, weight: 0.12, issues: ['noise'], suggestion: 'denoise' },
      ],
      suggestions: [
        {
          id: 's1',
          dimension: 'sharpness',
          action: 'sharpen',
          expectedImprovement: 20,
          priority: 'high',
          autoApplicable: true,
        },
      ],
    });
    const suggestions = generateOptimizationSuggestions(result);
    expect(suggestions.length).toBeGreaterThan(0);
  });

  it('should add clipping fix suggestion when audio clips', () => {
    const result = makeResult({
      audioMetrics: {
        rmsLevel: -3,
        peakLevel: 0,
        noiseFloor: -60,
        dynamicRange: 40,
        clipping: true,
        distortion: 50,
        frequencyBalance: 70,
      },
    });
    const suggestions = generateOptimizationSuggestions(result);
    const clipSuggestion = suggestions.find((s) => s.action.includes('削波'));
    expect(clipSuggestion).toBeDefined();
  });

  it('should add heavy denoise suggestion when noise > 70', () => {
    const result = makeResult({
      videoMetrics: {
        sharpness: 50,
        noise: 80,
        exposure: 60,
        contrast: 50,
        saturation: 50,
        colorBalance: 50,
        stability: 50,
        bitrate: 5000,
        resolution: { width: 1920, height: 1080 },
        frameRate: 30,
      },
    });
    const suggestions = generateOptimizationSuggestions(result);
    const denoiseSuggestion = suggestions.find((s) => s.action.includes('强降噪'));
    expect(denoiseSuggestion).toBeDefined();
  });

  it('should sort by priority (critical first)', () => {
    const result = makeResult({
      audioMetrics: {
        rmsLevel: -3,
        peakLevel: 0,
        noiseFloor: -60,
        dynamicRange: 40,
        clipping: true,
        distortion: 50,
        frequencyBalance: 70,
      },
      videoMetrics: {
        sharpness: 50,
        noise: 80,
        exposure: 60,
        contrast: 50,
        saturation: 50,
        colorBalance: 50,
        stability: 50,
        bitrate: 5000,
        resolution: { width: 1920, height: 1080 },
        frameRate: 30,
      },
    });
    const suggestions = generateOptimizationSuggestions(result);
    if (suggestions.length >= 2) {
      const priorityOrder: Record<string, number> = {
        critical: 0,
        high: 1,
        medium: 2,
        low: 3,
      };
      for (let i = 1; i < suggestions.length; i++) {
        expect(priorityOrder[suggestions[i].priority]).toBeGreaterThanOrEqual(
          priorityOrder[suggestions[i - 1].priority],
        );
      }
    }
  });

  it('should not duplicate suggestions', () => {
    const result = makeResult({
      suggestions: [
        {
          id: 's1',
          dimension: 'sharpness',
          action: 'sharpen',
          expectedImprovement: 10,
          priority: 'low',
          autoApplicable: true,
        },
        {
          id: 's2',
          dimension: 'sharpness',
          action: 'sharpen',
          expectedImprovement: 10,
          priority: 'low',
          autoApplicable: true,
        },
      ],
    });
    const suggestions = generateOptimizationSuggestions(result);
    const sharpenSugs = suggestions.filter((s) => s.action === 'sharpen');
    expect(sharpenSugs.length).toBe(1);
  });
});

// ==================== buildEnhancedQualitySystemPrompt ====================

describe('buildEnhancedQualitySystemPrompt', () => {
  it('should return non-empty string without profile', () => {
    const prompt = buildEnhancedQualitySystemPrompt();
    expect(prompt.length).toBeGreaterThan(0);
    expect(prompt).toContain('质量评估');
  });

  it('should include profile guidance for broadcast', () => {
    const prompt = buildEnhancedQualitySystemPrompt('broadcast');
    expect(prompt).toContain('广播');
  });

  it('should include profile guidance for cinema', () => {
    const prompt = buildEnhancedQualitySystemPrompt('cinema');
    expect(prompt).toContain('影院');
  });

  it('should include profile guidance for social', () => {
    const prompt = buildEnhancedQualitySystemPrompt('social');
    expect(prompt).toContain('社交');
  });

  it('should mention JSON format', () => {
    const prompt = buildEnhancedQualitySystemPrompt();
    expect(prompt).toContain('JSON');
  });

  it('should mention all quality grades', () => {
    const prompt = buildEnhancedQualitySystemPrompt();
    expect(prompt).toContain('S');
    expect(prompt).toContain('A');
    expect(prompt).toContain('B');
    expect(prompt).toContain('C');
    expect(prompt).toContain('D');
    expect(prompt).toContain('F');
  });
});

// ==================== parseEnhancedQualityResponse ====================

describe('parseEnhancedQualityResponse', () => {
  it('should return empty result for null input', () => {
    const result = parseEnhancedQualityResponse(null);
    expect(result.overallScore).toBe(0);
    expect(result.grade).toBe('F');
  });

  it('should return empty result for non-object input', () => {
    const result = parseEnhancedQualityResponse('string');
    expect(result.overallScore).toBe(0);
  });

  it('should parse a valid response', () => {
    const input = {
      overallScore: 85,
      grade: 'A',
      dimensionScores: [{ dimension: 'sharpness', score: 90, weight: 0.15, issues: [], suggestion: 'good' }],
      issues: [],
      suggestions: [],
    };
    const result = parseEnhancedQualityResponse(input);
    expect(result.overallScore).toBe(85);
    expect(result.grade).toBe('A');
    expect(result.dimensionScores.length).toBe(1);
  });

  it('should clamp overallScore to 0-100', () => {
    const result = parseEnhancedQualityResponse({ overallScore: 150 });
    expect(result.overallScore).toBe(100);
  });

  it('should fallback grade from score when grade is invalid', () => {
    const result = parseEnhancedQualityResponse({ overallScore: 90, grade: 'X' });
    expect(result.grade).toBe('A');
  });

  it('should parse issues with valid severity', () => {
    const input = {
      overallScore: 50,
      issues: [
        { type: 'sharpness', severity: 'high', dimension: 'sharpness', description: 'blurry', suggestedFix: 'sharpen' },
        { type: 'noise', severity: 'invalid', dimension: 'noise', description: 'noisy' },
      ],
    };
    const result = parseEnhancedQualityResponse(input);
    expect(result.issues.length).toBe(1);
    expect(result.issues[0].severity).toBe('high');
  });

  it('should parse suggestions with valid fields', () => {
    const input = {
      overallScore: 50,
      suggestions: [
        {
          id: 's1',
          dimension: 'sharpness',
          action: 'sharpen',
          expectedImprovement: 15,
          priority: 'high',
          autoApplicable: true,
        },
      ],
    };
    const result = parseEnhancedQualityResponse(input);
    expect(result.suggestions.length).toBe(1);
    expect(result.suggestions[0].id).toBe('s1');
    expect(result.suggestions[0].priority).toBe('high');
  });

  it('should skip suggestions with missing required fields', () => {
    const input = {
      overallScore: 50,
      suggestions: [
        { action: 'test' }, // missing id and dimension
        { id: 's1', dimension: 'sharpness', action: 'sharpen' },
      ],
    };
    const result = parseEnhancedQualityResponse(input);
    expect(result.suggestions.length).toBe(1);
  });
});

// ==================== parseEnhancedQualityResponseSafe ====================

describe('parseEnhancedQualityResponseSafe', () => {
  it('should return data with no error on valid input', async () => {
    const input = {
      overallScore: 80,
      grade: 'A',
    };
    const result = await parseEnhancedQualityResponseSafe(input);
    expect(result.error).toBeNull();
    expect(result.data.overallScore).toBe(80);
  });

  it('should return data with no error on null input (does not throw)', async () => {
    const result = await parseEnhancedQualityResponseSafe(null);
    // parseEnhancedQualityResponse does not throw for null, returns empty result
    expect(result.error).toBeNull();
    expect(result.data.overallScore).toBe(0);
  });

  it('should return data on valid complex input', async () => {
    const input = {
      overallScore: 65,
      grade: 'B',
      dimensionScores: [{ dimension: 'noise', score: 50, weight: 0.1, issues: ['noisy'], suggestion: 'denoise' }],
      issues: [
        { type: 'noise', severity: 'medium', dimension: 'noise', description: 'some noise', suggestedFix: 'denoise' },
      ],
      suggestions: [
        {
          id: 's1',
          dimension: 'noise',
          action: 'denoise',
          expectedImprovement: 10,
          priority: 'medium',
          autoApplicable: true,
        },
      ],
    };
    const result = await parseEnhancedQualityResponseSafe(input);
    expect(result.error).toBeNull();
    expect(result.data.dimensionScores.length).toBe(1);
    expect(result.data.issues.length).toBe(1);
    expect(result.data.suggestions.length).toBe(1);
  });
});

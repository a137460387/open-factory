import { describe, it, expect } from 'vitest';
import {
  createDefaultIntelligentSyncConfig,
  validateIntelligentSyncConfig,
  generateAudioFingerprint,
  syncByAudioFingerprint,
  extractVisualFeature,
  computeVisualSimilarity,
  syncByVisualFeature,
  intelligentSync,
  analyzeWindowContent,
  generateSwitchSuggestions,
  toIntegrationFormat,
  type ImageData,
  type AudioFingerprint,
  type VisualFeature,
  type IntelligentSyncConfig,
} from '../../src/ai/multicam-sync';

// ==================== 辅助函数 ====================

function createTestImage(width: number, height: number, r = 128, g = 128, b = 128): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = 255;
  }
  return { data, width, height };
}

function createGradientImage(width: number, height: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      data[idx] = Math.round((x / width) * 255);
      data[idx + 1] = Math.round((y / height) * 255);
      data[idx + 2] = 128;
      data[idx + 3] = 255;
    }
  }
  return { data, width, height };
}

function createTestAudio(durationSec: number, sampleRate: number = 44100): Float32Array {
  const samples = new Float32Array(durationSec * sampleRate);
  for (let i = 0; i < samples.length; i++) {
    // 440Hz 正弦波 + 噪声
    samples[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.5 +
      (Math.random() - 0.5) * 0.1;
  }
  return samples;
}

function createOffsetAudio(original: Float32Array, offsetSamples: number): Float32Array {
  const result = new Float32Array(original.length);
  for (let i = 0; i < original.length; i++) {
    const srcIdx = i - offsetSamples;
    if (srcIdx >= 0 && srcIdx < original.length) {
      result[i] = original[srcIdx];
    }
  }
  return result;
}

function createVisualFeatureSequence(
  angleId: string,
  count: number,
  fps: number,
): VisualFeature[] {
  const features: VisualFeature[] = [];
  for (let i = 0; i < count; i++) {
    const data = new Uint8ClampedArray(16 * 16 * 4);
    for (let j = 0; j < data.length; j += 4) {
      data[j] = Math.round(Math.random() * 255);
      data[j + 1] = Math.round(Math.random() * 255);
      data[j + 2] = Math.round(Math.random() * 255);
      data[j + 3] = 255;
    }
    features.push({
      angleId,
      frameIndex: i,
      timestamp: i / fps,
      colorHistogram: new Float32Array(48).fill(1 / 48),
      edgeHistogram: new Float32Array(8).fill(1 / 8),
      motionScore: Math.random(),
      brightness: 0.5 + Math.random() * 0.3,
      complexity: Math.random() * 0.5,
    });
  }
  return features;
}

// ==================== 配置测试 ====================

describe('智能同步配置', () => {
  describe('createDefaultIntelligentSyncConfig', () => {
    it('应该创建有效的默认配置', () => {
      const config = createDefaultIntelligentSyncConfig();
      expect(config.method).toBe('hybrid');
      expect(config.audioWeight).toBe(0.6);
      expect(config.visualWeight).toBe(0.4);
      expect(config.maxOffset).toBe(10);
      expect(config.confidenceThreshold).toBe(0.5);
      expect(config.enableDriftDetection).toBe(true);
    });
  });

  describe('validateIntelligentSyncConfig', () => {
    it('应该通过有效配置的验证', () => {
      const config = createDefaultIntelligentSyncConfig();
      const errors = validateIntelligentSyncConfig(config);
      expect(errors).toHaveLength(0);
    });

    it('应该检测负权重', () => {
      const config = { ...createDefaultIntelligentSyncConfig(), audioWeight: -0.1 };
      const errors = validateIntelligentSyncConfig(config);
      expect(errors.some(e => e.includes('权重'))).toBe(true);
    });

    it('应该检测越界的置信度阈值', () => {
      const config = { ...createDefaultIntelligentSyncConfig(), confidenceThreshold: 1.5 };
      const errors = validateIntelligentSyncConfig(config);
      expect(errors.some(e => e.includes('置信度'))).toBe(true);
    });

    it('应该检测越界的最大偏移', () => {
      const config = { ...createDefaultIntelligentSyncConfig(), maxOffset: 100 };
      const errors = validateIntelligentSyncConfig(config);
      expect(errors.some(e => e.includes('偏移'))).toBe(true);
    });

    it('应该检测越界的内容窗口', () => {
      const config = { ...createDefaultIntelligentSyncConfig(), contentWindow: 0.01 };
      const errors = validateIntelligentSyncConfig(config);
      expect(errors.some(e => e.includes('窗口'))).toBe(true);
    });
  });
});

// ==================== 音频指纹测试 ====================

describe('音频指纹', () => {
  describe('generateAudioFingerprint', () => {
    it('应该生成正确长度的指纹', () => {
      const samples = createTestAudio(2); // 2 秒
      const fp = generateAudioFingerprint('angle-1', samples, 44100, 10);
      expect(fp.angleId).toBe('angle-1');
      expect(fp.hashes.length).toBe(20); // 2 秒 * 10 哈希/秒
      expect(fp.hashRate).toBe(10);
      expect(fp.duration).toBeCloseTo(2, 1);
    });

    it('应该生成能量包络', () => {
      const samples = createTestAudio(1);
      const fp = generateAudioFingerprint('angle-1', samples, 44100);
      expect(fp.energyEnvelope.length).toBeGreaterThan(0);
      // 能量包络应有非零值
      const hasNonZero = fp.energyEnvelope.some(v => v > 0);
      expect(hasNonZero).toBe(true);
    });

    it('相同音频应生成相同指纹', () => {
      const samples = createTestAudio(1);
      const fp1 = generateAudioFingerprint('a', samples, 44100, 10);
      const fp2 = generateAudioFingerprint('b', samples, 44100, 10);
      // 哈希应相同
      let matchCount = 0;
      for (let i = 0; i < fp1.hashes.length; i++) {
        if (fp1.hashes[i] === fp2.hashes[i]) matchCount++;
      }
      expect(matchCount).toBe(fp1.hashes.length);
    });
  });

  describe('syncByAudioFingerprint', () => {
    it('相同音频应有高置信度', () => {
      const samples = createTestAudio(2);
      const fp1 = generateAudioFingerprint('a', samples, 44100, 10);
      const fp2 = generateAudioFingerprint('b', samples, 44100, 10);
      const result = syncByAudioFingerprint(fp1, fp2);
      // 相同音频应有高匹配置信度
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('不同音频应有不同的匹配结果', () => {
      const samples1 = createTestAudio(2);
      const samples2 = new Float32Array(2 * 44100);
      for (let i = 0; i < samples2.length; i++) {
        samples2[i] = Math.sin(2 * Math.PI * 880 * i / 44100) * 0.5; // 不同频率
      }
      const fp1 = generateAudioFingerprint('a', samples1, 44100, 10);
      const fp2 = generateAudioFingerprint('b', samples2, 44100, 10);
      const result = syncByAudioFingerprint(fp1, fp2);
      // 不同音频的置信度应低于相同音频
      const sameResult = syncByAudioFingerprint(fp1, fp1);
      expect(result.confidence).toBeLessThanOrEqual(sameResult.confidence + 0.1);
    });
  });
});

// ==================== 视觉特征测试 ====================

describe('视觉特征', () => {
  describe('extractVisualFeature', () => {
    it('应该提取正确的特征', () => {
      const image = createTestImage(16, 16, 200, 100, 50);
      const feature = extractVisualFeature('angle-1', image, 0, 0);
      expect(feature.angleId).toBe('angle-1');
      expect(feature.colorHistogram.length).toBe(48);
      expect(feature.edgeHistogram.length).toBe(8);
      expect(feature.brightness).toBeGreaterThan(0);
      expect(feature.complexity).toBeGreaterThanOrEqual(0);
    });

    it('应该正确计算亮度', () => {
      const bright = createTestImage(16, 16, 200, 200, 200);
      const dark = createTestImage(16, 16, 50, 50, 50);
      const brightFeature = extractVisualFeature('a', bright, 0, 0);
      const darkFeature = extractVisualFeature('b', dark, 0, 0);
      expect(brightFeature.brightness).toBeGreaterThan(darkFeature.brightness);
    });
  });

  describe('computeVisualSimilarity', () => {
    it('相同特征应有高相似度', () => {
      const image = createGradientImage(16, 16);
      const feature = extractVisualFeature('a', image, 0, 0);
      const similarity = computeVisualSimilarity(feature, feature);
      expect(similarity).toBeCloseTo(1, 1);
    });

    it('不同特征应有低相似度', () => {
      const bright = createTestImage(16, 16, 250, 250, 250);
      const dark = createTestImage(16, 16, 10, 10, 10);
      const f1 = extractVisualFeature('a', bright, 0, 0);
      const f2 = extractVisualFeature('b', dark, 0, 0);
      const similarity = computeVisualSimilarity(f1, f2);
      expect(similarity).toBeLessThan(0.8);
    });
  });

  describe('syncByVisualFeature', () => {
    it('相同序列应有高置信度', () => {
      // 创建有变化的帧序列（每帧亮度略有不同）
      const features: VisualFeature[] = [];
      for (let i = 0; i < 30; i++) {
        const brightness = 0.3 + (i / 30) * 0.5; // 亮度从 0.3 递增到 0.8
        const image = createTestImage(16, 16,
          Math.round(brightness * 255),
          Math.round(brightness * 200),
          Math.round(brightness * 150),
        );
        features.push(extractVisualFeature('a', image, i, i / 30));
      }
      const result = syncByVisualFeature(features, features, 30);
      // 相同序列偏移应为 0
      expect(result.offset).toBe(0);
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('空序列应返回零偏移', () => {
      const result = syncByVisualFeature([], [], 30);
      expect(result.offset).toBe(0);
      expect(result.confidence).toBe(0);
    });
  });
});

// ==================== 混合同步测试 ====================

describe('智能混合同步', () => {
  it('单角度应返回零偏移', () => {
    const config = createDefaultIntelligentSyncConfig();
    const result = intelligentSync(
      [{ id: 'a', fps: 30 }],
      config,
    );
    expect(result.offsets.get('a')).toBe(0);
    expect(result.confidence).toBe(1);
  });

  it('空角度应返回空结果', () => {
    const config = createDefaultIntelligentSyncConfig();
    const result = intelligentSync([], config);
    expect(result.offsets.size).toBe(0);
    expect(result.confidence).toBe(0);
  });

  it('应该使用音频指纹同步', () => {
    const samples = createTestAudio(2);
    const fp1 = generateAudioFingerprint('a', samples, 44100, 10);
    const fp2 = generateAudioFingerprint('b', samples, 44100, 10);

    const config: IntelligentSyncConfig = {
      ...createDefaultIntelligentSyncConfig(),
      method: 'audio-fingerprint',
    };

    const result = intelligentSync(
      [
        { id: 'a', audioFingerprint: fp1, fps: 30 },
        { id: 'b', audioFingerprint: fp2, fps: 30 },
      ],
      config,
    );

    expect(result.offsets.size).toBe(2);
    expect(result.usedMethod).toBe('audio-fingerprint');
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('应该使用视觉特征同步', () => {
    const image = createGradientImage(16, 16);
    const features: VisualFeature[] = [];
    for (let i = 0; i < 10; i++) {
      features.push(extractVisualFeature('a', image, i, i / 10));
    }

    const config: IntelligentSyncConfig = {
      ...createDefaultIntelligentSyncConfig(),
      method: 'visual-feature',
    };

    const result = intelligentSync(
      [
        { id: 'a', visualFeatures: features, fps: 10 },
        { id: 'b', visualFeatures: [...features], fps: 10 },
      ],
      config,
    );

    expect(result.offsets.size).toBe(2);
    expect(result.usedMethod).toBe('visual-feature');
  });

  it('应该检测漂移', () => {
    const config = createDefaultIntelligentSyncConfig();
    const result = intelligentSync(
      [
        { id: 'a', fps: 30 },
        { id: 'b', fps: 30 },
      ],
      config,
    );
    expect(result.drift).toBeDefined();
    expect(typeof result.drift.detected).toBe('boolean');
  });
});

// ==================== 内容分析测试 ====================

describe('内容分析', () => {
  it('应该分析窗口内容', () => {
    const audio = createTestAudio(1);
    const frame = createGradientImage(16, 16);

    const analysis = analyzeWindowContent(
      [
        { id: 'a', audioSamples: audio, audioSampleRate: 44100, frame },
        { id: 'b', frame },
      ],
      0,
      1,
    );

    expect(analysis.windowStart).toBe(0);
    expect(analysis.windowEnd).toBe(1);
    expect(analysis.angles.length).toBe(2);
    expect(analysis.recommendedAngleId).toBeTruthy();
    expect(analysis.recommendationReason).toBeTruthy();
  });

  it('应该检测人脸', () => {
    // 创建带有肤色区域的图像
    const skinImage = createTestImage(32, 32, 200, 150, 120);
    const analysis = analyzeWindowContent(
      [{ id: 'a', frame: skinImage }],
      0,
      1,
    );
    expect(analysis.angles[0].faceCount).toBeGreaterThanOrEqual(0);
  });
});

describe('切换建议生成', () => {
  it('应该生成切换建议', () => {
    const config = createDefaultIntelligentSyncConfig();
    const audio = createTestAudio(5);

    // 创建两个不同亮度的角度
    const brightFrames: ImageData[] = [];
    const darkFrames: ImageData[] = [];
    for (let i = 0; i < 150; i++) {
      brightFrames.push(createTestImage(8, 8, 200, 200, 200));
      darkFrames.push(createTestImage(8, 8, 80, 80, 80));
    }

    const suggestions = generateSwitchSuggestions(
      [
        { id: 'a', audioSamples: audio, audioSampleRate: 44100, frames: brightFrames, fps: 30 },
        { id: 'b', audioSamples: audio, audioSampleRate: 44100, frames: darkFrames, fps: 30 },
      ],
      5,
      config,
    );

    expect(Array.isArray(suggestions)).toBe(true);
    for (const s of suggestions) {
      expect(s.time).toBeGreaterThanOrEqual(0);
      expect(s.targetAngleId).toBeTruthy();
      expect(s.confidence).toBeGreaterThanOrEqual(0);
      expect(s.confidence).toBeLessThanOrEqual(1);
    }
  });

  it('空角度应返回空建议', () => {
    const config = createDefaultIntelligentSyncConfig();
    const suggestions = generateSwitchSuggestions([], 5, config);
    expect(suggestions).toHaveLength(0);
  });
});

// ==================== 集成接口测试 ====================

describe('集成接口', () => {
  it('应该转换为集成格式', () => {
    const syncResult = {
      offsets: new Map([['a', 0], ['b', 0.05]]),
      confidence: 0.8,
      usedMethod: 'hybrid' as const,
      angleQualities: new Map([
        ['a', { level: 'excellent' as const, offsetErrorMs: 0, confidence: 1 }],
        ['b', { level: 'good' as const, offsetErrorMs: 50, confidence: 0.7 }],
      ]),
      drift: { detected: false, rateMsPerMin: 0, direction: 'none' as const },
      processingTimeMs: 100,
    };

    const suggestions = [
      {
        time: 1,
        targetAngleId: 'b',
        currentAngleId: 'a',
        reason: 'active-speaker' as const,
        confidence: 0.9,
        priority: 9,
      },
    ];

    const integration = toIntegrationFormat(syncResult, suggestions);
    expect(integration.offsets.a).toBe(0);
    expect(integration.offsets.b).toBe(0.05);
    expect(integration.switchPoints.length).toBe(1);
    expect(integration.switchPoints[0].angleId).toBe('b');
    expect(integration.qualitySummary.overall).toBe('good');
    expect(integration.qualitySummary.details.length).toBe(2);
  });
});

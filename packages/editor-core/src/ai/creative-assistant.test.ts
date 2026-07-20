import { describe, it, expect } from 'vitest';
import {
  createDefaultCreativeAssistantConfig,
  generateCreativeConcepts,
  generateVideoScript,
  generateEmotionCurve,
  generateStructureOptimizations,
  generateMusicRecommendations,
  executeCreativeAssistance,
  validateCreativeAssistantConfig,
  executeCreativeAssistanceSafe,
} from './creative-assistant';
import type { CreativeTheme, CreativeAssistantConfig, CreativeConcept } from './creative-assistant';

// ==================== 测试辅助函数 ====================

function createTestConfig(overrides?: Partial<CreativeAssistantConfig>): CreativeAssistantConfig {
  return {
    ...createDefaultCreativeAssistantConfig('tutorial'),
    ...overrides,
  };
}

// ==================== createDefaultCreativeAssistantConfig ====================

describe('createDefaultCreativeAssistantConfig', () => {
  it('should create config with given theme', () => {
    const config = createDefaultCreativeAssistantConfig('storytelling');
    expect(config.theme).toBe('storytelling');
  });

  it('should have reasonable defaults', () => {
    const config = createDefaultCreativeAssistantConfig('tutorial');
    expect(config.targetDuration).toBe(180);
    expect(config.language).toBe('zh-CN');
    expect(config.creativityLevel).toBe(0.7);
    expect(config.includeMusicRecommendations).toBe(true);
    expect(config.maxConcepts).toBe(5);
  });
});

// ==================== generateCreativeConcepts ====================

describe('generateCreativeConcepts', () => {
  it('should generate concepts from keywords', () => {
    const config = createTestConfig();
    const concepts = generateCreativeConcepts(['AI', '编程'], config);

    expect(concepts.length).toBeGreaterThan(0);
    expect(concepts.length).toBeLessThanOrEqual(config.maxConcepts);
  });

  it('should return empty for empty keywords', () => {
    const config = createTestConfig();
    const concepts = generateCreativeConcepts([], config);
    expect(concepts).toEqual([]);
  });

  it('should generate concepts with required fields', () => {
    const config = createTestConfig();
    const concepts = generateCreativeConcepts(['摄影', '技巧'], config);

    for (const concept of concepts) {
      expect(concept.id).toBeTruthy();
      expect(concept.title).toBeTruthy();
      expect(concept.description).toBeTruthy();
      expect(concept.tags.length).toBeGreaterThan(0);
      expect(concept.angle).toBeTruthy();
      expect(concept.emotionCurve.length).toBeGreaterThan(0);
      expect(concept.creativityScore).toBeGreaterThanOrEqual(0);
      expect(concept.creativityScore).toBeLessThanOrEqual(100);
    }
  });

  it('should sort by creativity score descending', () => {
    const config = createTestConfig();
    const concepts = generateCreativeConcepts(['设计', '创意'], config);

    for (let i = 1; i < concepts.length; i++) {
      expect(concepts[i].creativityScore).toBeLessThanOrEqual(concepts[i - 1].creativityScore);
    }
  });

  it('should respect maxConcepts limit', () => {
    const config = createTestConfig({ maxConcepts: 3 });
    const concepts = generateCreativeConcepts(['科技', 'AI', '未来'], config);
    expect(concepts.length).toBeLessThanOrEqual(3);
  });

  it('should generate different concepts for different themes', () => {
    const tutorialConcepts = generateCreativeConcepts(['编程'], createTestConfig({ theme: 'tutorial' }));
    const vlogConcepts = generateCreativeConcepts(['编程'], createTestConfig({ theme: 'vlog' }));

    // At least the angle should differ
    expect(tutorialConcepts[0]?.angle).not.toBe(vlogConcepts[0]?.angle);
  });
});

// ==================== generateVideoScript ====================

describe('generateVideoScript', () => {
  it('should generate script from keywords', () => {
    const config = createTestConfig();
    const script = generateVideoScript(null, ['AI', '入门'], config);

    expect(script.id).toBeTruthy();
    expect(script.title).toBeTruthy();
    expect(script.segments.length).toBeGreaterThan(0);
    expect(script.totalDuration).toBeGreaterThan(0);
    expect(script.summary).toBeTruthy();
    expect(script.style).toBe(config.theme);
  });

  it('should generate script from concept', () => {
    const config = createTestConfig();
    const concepts = generateCreativeConcepts(['编程'], config);
    const concept = concepts[0] ?? null;

    const script = generateVideoScript(concept, ['编程'], config);

    expect(script.segments.length).toBeGreaterThan(0);
    if (concept) {
      expect(script.title).toBe(concept.title);
    }
  });

  it('should have hook as first segment for most themes', () => {
    const config = createTestConfig({ theme: 'tutorial' });
    const script = generateVideoScript(null, ['测试'], config);

    expect(script.segments[0].type).toBe('hook');
  });

  it('should have segments with valid properties', () => {
    const config = createTestConfig();
    const script = generateVideoScript(null, ['视频制作'], config);

    for (const segment of script.segments) {
      expect(segment.type).toBeTruthy();
      expect(segment.content).toBeTruthy();
      expect(segment.estimatedDuration).toBeGreaterThan(0);
      expect(segment.emotion).toBeTruthy();
      expect(segment.visualSuggestion).toBeTruthy();
      expect(segment.musicSuggestion).toBeTruthy();
    }
  });

  it('should generate different scripts for different themes', () => {
    const tutorialScript = generateVideoScript(null, ['AI'], createTestConfig({ theme: 'tutorial' }));
    const adScript = generateVideoScript(null, ['AI'], createTestConfig({ theme: 'advertisement' }));

    // Advertisement should have fewer segments
    expect(adScript.segments.length).toBeLessThanOrEqual(tutorialScript.segments.length);
  });
});

// ==================== generateEmotionCurve ====================

describe('generateEmotionCurve', () => {
  it('should generate curve points from script', () => {
    const config = createTestConfig();
    const script = generateVideoScript(null, ['测试'], config);
    const curve = generateEmotionCurve(script, config);

    expect(curve.length).toBeGreaterThan(0);
  });

  it('should have valid properties on each point', () => {
    const config = createTestConfig();
    const script = generateVideoScript(null, ['测试'], config);
    const curve = generateEmotionCurve(script, config);

    for (const point of curve) {
      expect(point.time).toBeGreaterThanOrEqual(0);
      expect(point.emotion).toBeTruthy();
      expect(point.intensity).toBeGreaterThanOrEqual(0);
      expect(point.intensity).toBeLessThanOrEqual(1);
      expect(['slow', 'medium', 'fast', 'dynamic']).toContain(point.pacing);
    }
  });

  it('should have monotonically increasing time', () => {
    const config = createTestConfig();
    const script = generateVideoScript(null, ['测试'], config);
    const curve = generateEmotionCurve(script, config);

    for (let i = 1; i < curve.length; i++) {
      expect(curve[i].time).toBeGreaterThanOrEqual(curve[i - 1].time);
    }
  });
});

// ==================== generateStructureOptimizations ====================

describe('generateStructureOptimizations', () => {
  it('should generate optimizations', () => {
    const config = createTestConfig();
    const script = generateVideoScript(null, ['测试'], config);
    const curve = generateEmotionCurve(script, config);
    const optimizations = generateStructureOptimizations(script, curve, config);

    expect(Array.isArray(optimizations)).toBe(true);
  });

  it('should have valid properties on each optimization', () => {
    const config = createTestConfig();
    const script = generateVideoScript(null, ['测试'], config);
    const curve = generateEmotionCurve(script, config);
    const optimizations = generateStructureOptimizations(script, curve, config);

    for (const opt of optimizations) {
      expect(opt.id).toBeTruthy();
      expect(opt.type).toBeTruthy();
      expect(opt.description).toBeTruthy();
      expect(opt.priority).toBeGreaterThanOrEqual(1);
      expect(opt.priority).toBeLessThanOrEqual(5);
      expect(opt.expectedEffect).toBeTruthy();
    }
  });

  it('should sort by priority descending', () => {
    const config = createTestConfig();
    const script = generateVideoScript(null, ['测试'], config);
    const curve = generateEmotionCurve(script, config);
    const optimizations = generateStructureOptimizations(script, curve, config);

    for (let i = 1; i < optimizations.length; i++) {
      expect(optimizations[i].priority).toBeLessThanOrEqual(optimizations[i - 1].priority);
    }
  });
});

// ==================== generateMusicRecommendations ====================

describe('generateMusicRecommendations', () => {
  it('should generate recommendations when enabled', () => {
    const config = createTestConfig({ includeMusicRecommendations: true });
    const script = generateVideoScript(null, ['测试'], config);
    const curve = generateEmotionCurve(script, config);
    const recs = generateMusicRecommendations(script, curve, config);

    expect(recs.length).toBeGreaterThan(0);
  });

  it('should return empty when disabled', () => {
    const config = createTestConfig({ includeMusicRecommendations: false });
    const script = generateVideoScript(null, ['测试'], config);
    const curve = generateEmotionCurve(script, config);
    const recs = generateMusicRecommendations(script, curve, config);

    expect(recs).toEqual([]);
  });

  it('should have valid properties on each recommendation', () => {
    const config = createTestConfig();
    const script = generateVideoScript(null, ['测试'], config);
    const curve = generateEmotionCurve(script, config);
    const recs = generateMusicRecommendations(script, curve, config);

    for (const rec of recs) {
      expect(rec.id).toBeTruthy();
      expect(rec.genre).toBeTruthy();
      expect(rec.mood.length).toBeGreaterThan(0);
      expect(rec.bpmRange[0]).toBeLessThan(rec.bpmRange[1]);
      expect(rec.reason).toBeTruthy();
      expect(rec.matchScore).toBeGreaterThanOrEqual(0);
      expect(rec.matchScore).toBeLessThanOrEqual(1);
      expect(rec.instruments.length).toBeGreaterThan(0);
    }
  });

  it('should sort by match score descending', () => {
    const config = createTestConfig();
    const script = generateVideoScript(null, ['测试'], config);
    const curve = generateEmotionCurve(script, config);
    const recs = generateMusicRecommendations(script, curve, config);

    for (let i = 1; i < recs.length; i++) {
      expect(recs[i].matchScore).toBeLessThanOrEqual(recs[i - 1].matchScore);
    }
  });

  it('should respect maxMusicRecommendations', () => {
    const config = createTestConfig({ maxMusicRecommendations: 2 });
    const script = generateVideoScript(null, ['测试'], config);
    const curve = generateEmotionCurve(script, config);
    const recs = generateMusicRecommendations(script, curve, config);

    expect(recs.length).toBeLessThanOrEqual(2);
  });
});

// ==================== executeCreativeAssistance ====================

describe('executeCreativeAssistance', () => {
  it('should execute full creative assistance pipeline', () => {
    const config = createTestConfig();
    const result = executeCreativeAssistance(['AI', '创作'], config);

    expect(result.concepts.length).toBeGreaterThan(0);
    expect(result.script).not.toBeNull();
    expect(result.emotionCurve.length).toBeGreaterThan(0);
    expect(Array.isArray(result.optimizations)).toBe(true);
    expect(result.musicRecommendations.length).toBeGreaterThan(0);
    expect(result.generationTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('should work with minimal config', () => {
    const config = createTestConfig({
      maxConcepts: 1,
      maxMusicRecommendations: 1,
      includeMusicRecommendations: false,
    });

    const result = executeCreativeAssistance(['短视频'], config);

    expect(result.concepts.length).toBeLessThanOrEqual(1);
    expect(result.script).not.toBeNull();
  });

  it('should handle single keyword', () => {
    const config = createTestConfig();
    const result = executeCreativeAssistance(['摄影'], config);

    expect(result.concepts.length).toBeGreaterThan(0);
    expect(result.script).not.toBeNull();
  });
});

// ==================== validateCreativeAssistantConfig ====================

describe('validateCreativeAssistantConfig', () => {
  it('should accept valid config', () => {
    expect(validateCreativeAssistantConfig(createTestConfig())).toBe(true);
  });

  it('should reject invalid targetDuration', () => {
    expect(validateCreativeAssistantConfig(createTestConfig({ targetDuration: 1 }))).toBe(false);
    expect(validateCreativeAssistantConfig(createTestConfig({ targetDuration: 10000 }))).toBe(false);
  });

  it('should reject invalid creativityLevel', () => {
    expect(validateCreativeAssistantConfig(createTestConfig({ creativityLevel: -0.1 }))).toBe(false);
    expect(validateCreativeAssistantConfig(createTestConfig({ creativityLevel: 1.1 }))).toBe(false);
  });

  it('should reject invalid maxConcepts', () => {
    expect(validateCreativeAssistantConfig(createTestConfig({ maxConcepts: 0 }))).toBe(false);
    expect(validateCreativeAssistantConfig(createTestConfig({ maxConcepts: 25 }))).toBe(false);
  });
});

// ==================== executeCreativeAssistanceSafe ====================

describe('executeCreativeAssistanceSafe', () => {
  it('should return result for valid inputs', async () => {
    const result = await executeCreativeAssistanceSafe(['AI'], createTestConfig());
    expect(result.error).toBeNull();
    expect(result.data.concepts.length).toBeGreaterThan(0);
  });

  it('should return error for empty keywords', async () => {
    const result = await executeCreativeAssistanceSafe([], createTestConfig());
    expect(result.error).toBeTruthy();
  });

  it('should return error for invalid config', async () => {
    const result = await executeCreativeAssistanceSafe(['AI'], createTestConfig({ targetDuration: 1 }));
    expect(result.error).toBeTruthy();
  });
});

import { describe, it, expect } from 'vitest';
import {
  createDefaultUserProfile,
  createDefaultPersonalizationConfig,
  analyzeUserProfile,
  generatePersonalizedIntro,
  generatePersonalizedOutro,
  generatePersonalizedSubtitleStyle,
  generateRecommendations,
  generateInteractiveElements,
  generatePersonalizedContent,
  validatePersonalizationConfig,
  validateUserProfile,
  generatePersonalizedContentSafe,
} from './personalization-engine';
import type { UserProfile, PersonalizationConfig, RecommendedContent } from './personalization-engine';

// ==================== 测试辅助函数 ====================

function createTestProfile(overrides?: Partial<UserProfile>): UserProfile {
  return {
    ...createDefaultUserProfile('test-user-001'),
    interests: ['technology', 'gaming'],
    ...overrides,
  };
}

function createTestConfig(overrides?: Partial<PersonalizationConfig>): PersonalizationConfig {
  return {
    ...createDefaultPersonalizationConfig(),
    ...overrides,
  };
}

function createTestContentPool(): Array<{
  id: string;
  title: string;
  thumbnailUrl: string;
  contentType: RecommendedContent['contentType'];
  tags: string[];
  estimatedDuration: number;
}> {
  return [
    { id: 'c1', title: 'AI 入门', thumbnailUrl: '/img1.jpg', contentType: 'video', tags: ['technology', 'education'], estimatedDuration: 300 },
    { id: 'c2', title: '游戏攻略', thumbnailUrl: '/img2.jpg', contentType: 'video', tags: ['gaming', 'entertainment'], estimatedDuration: 120 },
    { id: 'c3', title: '美食探店', thumbnailUrl: '/img3.jpg', contentType: 'video', tags: ['food', 'travel'], estimatedDuration: 180 },
    { id: 'c4', title: '编程教程', thumbnailUrl: '/img4.jpg', contentType: 'playlist', tags: ['technology', 'education'], estimatedDuration: 600 },
    { id: 'c5', title: '健身日常', thumbnailUrl: '/img5.jpg', contentType: 'video', tags: ['fitness', 'health'], estimatedDuration: 90 },
  ];
}

// ==================== createDefaultUserProfile ====================

describe('createDefaultUserProfile', () => {
  it('should create a profile with the given userId', () => {
    const profile = createDefaultUserProfile('user-123');
    expect(profile.userId).toBe('user-123');
  });

  it('should have default values for all fields', () => {
    const profile = createDefaultUserProfile('user-1');
    expect(profile.ageGroup).toBe('adult');
    expect(profile.interests).toEqual([]);
    expect(profile.preferredStyle).toBe('modern');
    expect(profile.preferredLanguage).toBe('zh-CN');
    expect(profile.engagementRate).toBe(0.3);
    expect(profile.completionRate).toBe(0.5);
    expect(profile.devicePreference).toBe('mobile');
  });
});

// ==================== createDefaultPersonalizationConfig ====================

describe('createDefaultPersonalizationConfig', () => {
  it('should enable all features by default', () => {
    const config = createDefaultPersonalizationConfig();
    expect(config.enableIntroPersonalization).toBe(true);
    expect(config.enableOutroPersonalization).toBe(true);
    expect(config.enableSubtitlePersonalization).toBe(true);
    expect(config.enableRecommendations).toBe(true);
    expect(config.enableInteractiveElements).toBe(true);
  });

  it('should have reasonable defaults', () => {
    const config = createDefaultPersonalizationConfig();
    expect(config.maxRecommendations).toBe(6);
    expect(config.maxInteractiveElements).toBe(3);
    expect(config.personalizationStrength).toBe(0.7);
  });
});

// ==================== analyzeUserProfile ====================

describe('analyzeUserProfile', () => {
  it('should detect short attention span for short watch duration', () => {
    const profile = createTestProfile({ medianWatchDuration: 15 });
    const features = analyzeUserProfile(profile);
    expect(features.attentionSpan).toBe('short');
  });

  it('should detect medium attention span', () => {
    const profile = createTestProfile({ medianWatchDuration: 60 });
    const features = analyzeUserProfile(profile);
    expect(features.attentionSpan).toBe('medium');
  });

  it('should detect long attention span', () => {
    const profile = createTestProfile({ medianWatchDuration: 300 });
    const features = analyzeUserProfile(profile);
    expect(features.attentionSpan).toBe('long');
  });

  it('should detect low engagement level', () => {
    const profile = createTestProfile({ engagementRate: 0.1 });
    const features = analyzeUserProfile(profile);
    expect(features.engagementLevel).toBe('low');
  });

  it('should detect high engagement level', () => {
    const profile = createTestProfile({ engagementRate: 0.6 });
    const features = analyzeUserProfile(profile);
    expect(features.engagementLevel).toBe('high');
  });

  it('should detect rich visual preference for young users', () => {
    const profile = createTestProfile({ ageGroup: 'teen' });
    const features = analyzeUserProfile(profile);
    expect(features.visualPreference).toBe('rich');
  });

  it('should detect simple visual preference for senior desktop users', () => {
    const profile = createTestProfile({ ageGroup: 'senior', devicePreference: 'desktop' });
    const features = analyzeUserProfile(profile);
    expect(features.visualPreference).toBe('simple');
  });
});

// ==================== generatePersonalizedIntro ====================

describe('generatePersonalizedIntro', () => {
  it('should generate intro with valid properties', () => {
    const profile = createTestProfile();
    const config = createTestConfig();
    const intro = generatePersonalizedIntro(profile, config);

    expect(intro.duration).toBeGreaterThan(0);
    expect(intro.animationStyle).toBeTruthy();
    expect(intro.colorScheme.length).toBeGreaterThan(0);
    expect(intro.fontScale).toBeGreaterThan(0);
  });

  it('should use larger font scale for children', () => {
    const childProfile = createTestProfile({ ageGroup: 'child' });
    const adultProfile = createTestProfile({ ageGroup: 'adult' });
    const config = createTestConfig();

    const childIntro = generatePersonalizedIntro(childProfile, config);
    const adultIntro = generatePersonalizedIntro(adultProfile, config);

    expect(childIntro.fontScale).toBeGreaterThan(adultIntro.fontScale);
  });

  it('should show greeting when strength > 0.3', () => {
    const profile = createTestProfile();
    const config = createTestConfig({ personalizationStrength: 0.5 });
    const intro = generatePersonalizedIntro(profile, config);
    expect(intro.showGreeting).toBe(true);
  });

  it('should not show greeting when strength <= 0.3', () => {
    const profile = createTestProfile();
    const config = createTestConfig({ personalizationStrength: 0.2 });
    const intro = generatePersonalizedIntro(profile, config);
    expect(intro.showGreeting).toBe(false);
  });
});

// ==================== generatePersonalizedOutro ====================

describe('generatePersonalizedOutro', () => {
  it('should generate outro with valid properties', () => {
    const profile = createTestProfile();
    const config = createTestConfig();
    const outro = generatePersonalizedOutro(profile, config);

    expect(outro.duration).toBeGreaterThan(0);
    expect(outro.recommendationCount).toBeGreaterThan(0);
    expect(outro.ctaText).toBeTruthy();
  });

  it('should recommend more content for high engagement users', () => {
    const highProfile = createTestProfile({ engagementRate: 0.7 });
    const lowProfile = createTestProfile({ engagementRate: 0.1 });
    const config = createTestConfig();

    const highOutro = generatePersonalizedOutro(highProfile, config);
    const lowOutro = generatePersonalizedOutro(lowProfile, config);

    expect(highOutro.recommendationCount).toBeGreaterThan(lowOutro.recommendationCount);
  });

  it('should respect maxRecommendations limit', () => {
    const profile = createTestProfile({ engagementRate: 0.9 });
    const config = createTestConfig({ maxRecommendations: 3 });
    const outro = generatePersonalizedOutro(profile, config);

    expect(outro.recommendationCount).toBeLessThanOrEqual(3);
  });
});

// ==================== generatePersonalizedSubtitleStyle ====================

describe('generatePersonalizedSubtitleStyle', () => {
  it('should generate subtitle style with valid properties', () => {
    const profile = createTestProfile();
    const config = createTestConfig();
    const style = generatePersonalizedSubtitleStyle(profile, config);

    expect(style.fontFamily).toBeTruthy();
    expect(style.fontSize).toBeGreaterThan(0);
    expect(style.color).toBeTruthy();
    expect(style.strokeColor).toBeTruthy();
    expect(['none', 'solid', 'gradient', 'blur']).toContain(style.background);
    expect(['none', 'fade', 'slide-up', 'typewriter', 'bounce']).toContain(style.animation);
  });

  it('should use smaller font on mobile', () => {
    const mobileProfile = createTestProfile({ devicePreference: 'mobile' });
    const desktopProfile = createTestProfile({ devicePreference: 'desktop' });
    const config = createTestConfig();

    const mobileStyle = generatePersonalizedSubtitleStyle(mobileProfile, config);
    const desktopStyle = generatePersonalizedSubtitleStyle(desktopProfile, config);

    expect(mobileStyle.fontSize).toBeLessThanOrEqual(desktopStyle.fontSize);
  });
});

// ==================== generateRecommendations ====================

describe('generateRecommendations', () => {
  it('should return empty when recommendations disabled', () => {
    const profile = createTestProfile();
    const config = createTestConfig({ enableRecommendations: false });
    const content = createTestContentPool();

    const recs = generateRecommendations(profile, content, config);
    expect(recs).toEqual([]);
  });

  it('should return empty when content pool is empty', () => {
    const profile = createTestProfile();
    const config = createTestConfig();

    const recs = generateRecommendations(profile, [], config);
    expect(recs).toEqual([]);
  });

  it('should rank interest-matching content higher', () => {
    const profile = createTestProfile({ interests: ['technology'] });
    const config = createTestConfig();
    const content = createTestContentPool();

    const recs = generateRecommendations(profile, content, config);
    expect(recs.length).toBeGreaterThan(0);

    // Technology content should rank higher
    const techIndex = recs.findIndex((r) => r.title.includes('AI') || r.title.includes('编程'));
    const foodIndex = recs.findIndex((r) => r.title.includes('美食'));

    if (techIndex !== -1 && foodIndex !== -1) {
      expect(techIndex).toBeLessThan(foodIndex);
    }
  });

  it('should limit results to maxRecommendations', () => {
    const profile = createTestProfile();
    const config = createTestConfig({ maxRecommendations: 2 });
    const content = createTestContentPool();

    const recs = generateRecommendations(profile, content, config);
    expect(recs.length).toBeLessThanOrEqual(2);
  });
});

// ==================== generateInteractiveElements ====================

describe('generateInteractiveElements', () => {
  it('should return empty when disabled', () => {
    const profile = createTestProfile();
    const config = createTestConfig({ enableInteractiveElements: false });

    const elements = generateInteractiveElements(profile, 60, config);
    expect(elements).toEqual([]);
  });

  it('should return empty for very short videos', () => {
    const profile = createTestProfile();
    const config = createTestConfig();

    const elements = generateInteractiveElements(profile, 5, config);
    expect(elements).toEqual([]);
  });

  it('should generate elements with valid positions', () => {
    const profile = createTestProfile();
    const config = createTestConfig();
    const elements = generateInteractiveElements(profile, 120, config);

    for (const el of elements) {
      expect(el.position.x).toBeGreaterThanOrEqual(0.1);
      expect(el.position.x).toBeLessThanOrEqual(0.9);
      expect(el.position.y).toBeGreaterThanOrEqual(0.1);
      expect(el.position.y).toBeLessThanOrEqual(0.9);
    }
  });

  it('should generate more elements for high engagement users', () => {
    const highProfile = createTestProfile({ engagementRate: 0.8 });
    const lowProfile = createTestProfile({ engagementRate: 0.1 });
    const config = createTestConfig({ maxInteractiveElements: 5 });

    const highElements = generateInteractiveElements(highProfile, 120, config);
    const lowElements = generateInteractiveElements(lowProfile, 120, config);

    expect(highElements.length).toBeGreaterThanOrEqual(lowElements.length);
  });
});

// ==================== generatePersonalizedContent ====================

describe('generatePersonalizedContent', () => {
  it('should return a complete personalization result', () => {
    const profile = createTestProfile();
    const config = createTestConfig();
    const content = createTestContentPool();

    const result = generatePersonalizedContent(profile, config, content, 120);

    expect(result.intro).toBeDefined();
    expect(result.outro).toBeDefined();
    expect(result.subtitleStyle).toBeDefined();
    expect(Array.isArray(result.recommendations)).toBe(true);
    expect(Array.isArray(result.interactiveElements)).toBe(true);
    expect(result.personalizationScore).toBeGreaterThanOrEqual(0);
    expect(result.personalizationScore).toBeLessThanOrEqual(1);
    expect(result.generationTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('should disable features when config says so', () => {
    const profile = createTestProfile();
    const config = createTestConfig({
      enableIntroPersonalization: false,
      enableOutroPersonalization: false,
      enableSubtitlePersonalization: false,
      enableRecommendations: false,
      enableInteractiveElements: false,
    });

    const result = generatePersonalizedContent(profile, config, [], 60);

    // With features disabled, should get minimal defaults
    expect(result.intro.duration).toBe(2);
    expect(result.outro.recommendationCount).toBe(2);
    expect(result.recommendations).toEqual([]);
    expect(result.interactiveElements).toEqual([]);
  });
});

// ==================== validatePersonalizationConfig ====================

describe('validatePersonalizationConfig', () => {
  it('should accept valid config', () => {
    expect(validatePersonalizationConfig(createTestConfig())).toBe(true);
  });

  it('should reject invalid personalizationStrength', () => {
    expect(validatePersonalizationConfig(createTestConfig({ personalizationStrength: -0.1 }))).toBe(false);
    expect(validatePersonalizationConfig(createTestConfig({ personalizationStrength: 1.1 }))).toBe(false);
  });

  it('should reject invalid maxRecommendations', () => {
    expect(validatePersonalizationConfig(createTestConfig({ maxRecommendations: -1 }))).toBe(false);
    expect(validatePersonalizationConfig(createTestConfig({ maxRecommendations: 25 }))).toBe(false);
  });
});

// ==================== validateUserProfile ====================

describe('validateUserProfile', () => {
  it('should accept valid profile', () => {
    expect(validateUserProfile(createTestProfile())).toBe(true);
  });

  it('should reject empty userId', () => {
    expect(validateUserProfile(createTestProfile({ userId: '' }))).toBe(false);
    expect(validateUserProfile(createTestProfile({ userId: '   ' }))).toBe(false);
  });

  it('should reject invalid engagementRate', () => {
    expect(validateUserProfile(createTestProfile({ engagementRate: -0.1 }))).toBe(false);
    expect(validateUserProfile(createTestProfile({ engagementRate: 1.1 }))).toBe(false);
  });

  it('should reject invalid completionRate', () => {
    expect(validateUserProfile(createTestProfile({ completionRate: -0.1 }))).toBe(false);
    expect(validateUserProfile(createTestProfile({ completionRate: 1.1 }))).toBe(false);
  });
});

// ==================== generatePersonalizedContentSafe ====================

describe('generatePersonalizedContentSafe', () => {
  it('should return result for valid inputs', async () => {
    const result = await generatePersonalizedContentSafe(createTestProfile(), createTestConfig());
    expect(result.error).toBeNull();
    expect(result.data).toBeDefined();
    expect(result.data.personalizationScore).toBeGreaterThanOrEqual(0);
  });

  it('should return error for invalid profile', async () => {
    const result = await generatePersonalizedContentSafe(
      createTestProfile({ userId: '' }),
      createTestConfig(),
    );
    expect(result.error).toBeTruthy();
  });

  it('should return error for invalid config', async () => {
    const result = await generatePersonalizedContentSafe(
      createTestProfile(),
      createTestConfig({ personalizationStrength: 2 }),
    );
    expect(result.error).toBeTruthy();
  });
});

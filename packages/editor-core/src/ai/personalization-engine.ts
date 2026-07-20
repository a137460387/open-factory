/**
 * AI 个性化生成引擎
 *
 * 功能：
 * 1. 用户画像管理 - 年龄分段、兴趣标签、历史行为分析
 * 2. 个性化内容生成 - 根据画像动态调整片头片尾、字幕样式、推荐内容
 * 3. 动态元素插入 - 个性化推荐、互动元素、定制化水印
 * 4. 内容适配策略 - 基于用户偏好的风格、节奏、语言适配
 *
 * 所有函数均为纯计算，无副作用。
 */

import type { AiModuleResult, TranslateFn } from '../ai-module-types';
import { identityTranslator } from '../ai-module-types';

// ==================== 类型定义 ====================

/** 年龄分段 */
export type AgeGroup = 'child' | 'teen' | 'young-adult' | 'adult' | 'senior';

/** 兴趣类别 */
export type InterestCategory =
  | 'technology'
  | 'sports'
  | 'music'
  | 'travel'
  | 'food'
  | 'fashion'
  | 'gaming'
  | 'education'
  | 'entertainment'
  | 'science'
  | 'art'
  | 'fitness';

/** 内容风格偏好 */
export type ContentStyle = 'modern' | 'classic' | 'minimalist' | 'vibrant' | 'elegant' | 'playful' | 'professional';

/** 互动元素类型 */
export type InteractiveElementType =
  | 'poll'
  | 'quiz'
  | 'cta-button'
  | 'swipe-up'
  | 'countdown'
  | 'hotspot'
  | 'emoji-reaction';

/** 用户画像 */
export interface UserProfile {
  /** 用户 ID */
  userId: string;
  /** 年龄分段 */
  ageGroup: AgeGroup;
  /** 兴趣标签列表 */
  interests: InterestCategory[];
  /** 偏好风格 */
  preferredStyle: ContentStyle;
  /** 偏好语言 */
  preferredLanguage: string;
  /** 历史观看时长中位数（秒） */
  medianWatchDuration: number;
  /** 历史互动率 (0-1) */
  engagementRate: number;
  /** 历史完播率 (0-1) */
  completionRate: number;
  /** 活跃时段（0-23 小时） */
  activeHours: number[];
  /** 设备偏好 */
  devicePreference: 'mobile' | 'tablet' | 'desktop';
  /** 自定义标签 */
  customTags: string[];
}

/** 个性化片头配置 */
export interface PersonalizedIntro {
  /** 持续时长（秒） */
  duration: number;
  /** 动画风格 */
  animationStyle: 'fade' | 'slide' | 'zoom' | 'glitch' | 'particle' | 'typewriter';
  /** 背景颜色方案 */
  colorScheme: string[];
  /** 字体大小比例 (0.5-2.0) */
  fontScale: number;
  /** 是否显示用户名称 */
  showUserName: boolean;
  /** 是否显示个性化问候 */
  showGreeting: boolean;
  /** 问候语模板 */
  greetingTemplate: string;
  /** 品牌标识位置 */
  logoPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
}

/** 个性化片尾配置 */
export interface PersonalizedOutro {
  /** 持续时长（秒） */
  duration: number;
  /** 推荐内容数量 */
  recommendationCount: number;
  /** 是否显示订阅提示 */
  showSubscribePrompt: boolean;
  /** CTA 文本 */
  ctaText: string;
  /** CTA 链接 */
  ctaUrl: string;
  /** 社交分享按钮 */
  socialShareButtons: string[];
  /** 结束动画 */
  endAnimation: 'fade-out' | 'slide-left' | 'zoom-out' | 'dissolve';
}

/** 个性化字幕样式 */
export interface PersonalizedSubtitleStyle {
  /** 字体族 */
  fontFamily: string;
  /** 字体大小 (px) */
  fontSize: number;
  /** 字体颜色 */
  color: string;
  /** 描边颜色 */
  strokeColor: string;
  /** 描边宽度 (px) */
  strokeWidth: number;
  /** 背景样式 */
  background: 'none' | 'solid' | 'gradient' | 'blur';
  /** 背景颜色 */
  backgroundColor: string;
  /** 背景不透明度 (0-1) */
  backgroundOpacity: number;
  /** 位置 */
  position: 'bottom' | 'top' | 'center';
  /** 动画效果 */
  animation: 'none' | 'fade' | 'slide-up' | 'typewriter' | 'bounce';
  /** 行间距倍数 */
  lineHeight: number;
}

/** 推荐内容项 */
export interface RecommendedContent {
  /** 内容 ID */
  id: string;
  /** 标题 */
  title: string;
  /** 缩略图 URL */
  thumbnailUrl: string;
  /** 相关性评分 (0-1) */
  relevanceScore: number;
  /** 推荐理由 */
  reason: string;
  /** 内容类型 */
  contentType: 'video' | 'article' | 'playlist' | 'live';
  /** 预计观看时长（秒） */
  estimatedDuration: number;
}

/** 互动元素配置 */
export interface InteractiveElement {
  /** 元素类型 */
  type: InteractiveElementType;
  /** 出现时间（秒） */
  startTime: number;
  /** 持续时长（秒） */
  duration: number;
  /** 位置 (归一化坐标 0-1) */
  position: { x: number; y: number };
  /** 元素内容 */
  content: string;
  /** 选项（用于投票/测验） */
  options?: string[];
  /** 样式配置 */
  style: Record<string, unknown>;
}

/** 个性化生成结果 */
export interface PersonalizationResult {
  /** 个性化片头 */
  intro: PersonalizedIntro;
  /** 个性化片尾 */
  outro: PersonalizedOutro;
  /** 个性化字幕样式 */
  subtitleStyle: PersonalizedSubtitleStyle;
  /** 推荐内容列表 */
  recommendations: RecommendedContent[];
  /** 互动元素列表 */
  interactiveElements: InteractiveElement[];
  /** 个性化评分 (0-1)，越高表示越贴合用户 */
  personalizationScore: number;
  /** 生成耗时（毫秒） */
  generationTimeMs: number;
}

/** 个性化配置 */
export interface PersonalizationConfig {
  /** 是否启用片头个性化 */
  enableIntroPersonalization: boolean;
  /** 是否启用片尾个性化 */
  enableOutroPersonalization: boolean;
  /** 是否启用字幕个性化 */
  enableSubtitlePersonalization: boolean;
  /** 是否启用推荐内容 */
  enableRecommendations: boolean;
  /** 是否启用互动元素 */
  enableInteractiveElements: boolean;
  /** 最大推荐数量 */
  maxRecommendations: number;
  /** 最大互动元素数量 */
  maxInteractiveElements: number;
  /** 个性化强度 (0-1)，0 为最低个性化，1 为最高个性化 */
  personalizationStrength: number;
}

// ==================== 常量 ====================

/** 年龄分段对应的默认字体大小基准 */
const AGE_FONT_SIZE_BASE: Record<AgeGroup, number> = {
  child: 56,
  teen: 48,
  'young-adult': 44,
  adult: 42,
  senior: 52,
};

/** 年龄分段对应的动画速度系数 */
const AGE_ANIMATION_SPEED: Record<AgeGroup, number> = {
  child: 0.7,
  teen: 1.0,
  'young-adult': 1.2,
  adult: 1.0,
  senior: 0.8,
};

/** 兴趣类别对应的推荐颜色方案 */
const INTEREST_COLOR_SCHEMES: Record<InterestCategory, string[]> = {
  technology: ['#00d4ff', '#0066ff', '#00ff88'],
  sports: ['#ff4444', '#ff8800', '#ffcc00'],
  music: ['#ff00ff', '#8800ff', '#0088ff'],
  travel: ['#00ccff', '#00ff88', '#ffcc00'],
  food: ['#ff6600', '#ff3366', '#ffcc00'],
  fashion: ['#ff0088', '#ff00ff', '#8800ff'],
  gaming: ['#00ff00', '#ff0000', '#ffff00'],
  education: ['#0066ff', '#00ccff', '#00ff88'],
  entertainment: ['#ff00ff', '#ff8800', '#00ffcc'],
  science: ['#0088ff', '#00ffcc', '#8800ff'],
  art: ['#ff0088', '#ffcc00', '#00ffcc'],
  fitness: ['#ff4444', '#ff8800', '#00ff00'],
};

/** 风格对应的字体族 */
const STYLE_FONT_FAMILIES: Record<ContentStyle, string> = {
  modern: 'Inter, system-ui, sans-serif',
  classic: 'Georgia, "Times New Roman", serif',
  minimalist: '"Helvetica Neue", Arial, sans-serif',
  vibrant: 'Poppins, "Segoe UI", sans-serif',
  elegant: 'Playfair Display, Georgia, serif',
  playful: '"Comic Sans MS", "Marker Felt", cursive',
  professional: '"Source Sans Pro", "Noto Sans", sans-serif',
};

/** 设备对应的字幕位置默认值 */
const DEVICE_SUBTITLE_POSITION: Record<UserProfile['devicePreference'], PersonalizedSubtitleStyle['position']> = {
  mobile: 'bottom',
  tablet: 'bottom',
  desktop: 'bottom',
};

/** 问候语模板 */
const GREETING_TEMPLATES: Record<AgeGroup, string[]> = {
  child: ['嗨！准备好探索了吗？', '欢迎回来，小朋友！', '今天想看什么呢？'],
  teen: ['嘿！又见面了', '准备好嗨了吗？', '欢迎回来！'],
  'young-adult': ['欢迎回来', '很高兴再次见到你', '你好！'],
  adult: ['欢迎', '很高兴再次见到你', '你好，欢迎回来'],
  senior: ['欢迎回来', '祝你有愉快的一天', '您好，欢迎观看'],
};

/** 互动元素默认样式 */
const INTERACTIVE_ELEMENT_STYLES: Record<InteractiveElementType, Record<string, unknown>> = {
  poll: { borderRadius: 12, padding: 16, backgroundColor: 'rgba(0,0,0,0.7)' },
  quiz: { borderRadius: 8, padding: 20, backgroundColor: 'rgba(0,0,0,0.8)' },
  'cta-button': { borderRadius: 24, padding: '12px 32px', backgroundColor: '#0088ff' },
  'swipe-up': { opacity: 0.8, animation: 'pulse' },
  countdown: { fontSize: 48, color: '#ffffff', fontWeight: 'bold' },
  hotspot: { borderRadius: '50%', border: '2px solid #ffffff', pulse: true },
  'emoji-reaction': { fontSize: 32, spacing: 8 },
};

// ==================== 工具函数 ====================

/** 将数值限制在指定范围 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** 生成唯一 ID */
function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

/** 计算两个集合的 Jaccard 相似度 */
function jaccardSimilarity(setA: string[], setB: string[]): number {
  if (setA.length === 0 && setB.length === 0) return 1;
  const a = new Set(setA);
  const b = new Set(setB);
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/** 从列表中随机选取 n 个元素 */
function pickRandom<T>(list: T[], count: number): T[] {
  const shuffled = [...list].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, list.length));
}

// ==================== 核心函数 ====================

/**
 * 创建默认用户画像
 *
 * @param userId - 用户 ID
 * @returns 默认用户画像
 */
export function createDefaultUserProfile(userId: string): UserProfile {
  return {
    userId,
    ageGroup: 'adult',
    interests: [],
    preferredStyle: 'modern',
    preferredLanguage: 'zh-CN',
    medianWatchDuration: 120,
    engagementRate: 0.3,
    completionRate: 0.5,
    activeHours: [9, 10, 11, 14, 15, 16, 20, 21],
    devicePreference: 'mobile',
    customTags: [],
  };
}

/**
 * 创建默认个性化配置
 *
 * @returns 默认个性化配置
 */
export function createDefaultPersonalizationConfig(): PersonalizationConfig {
  return {
    enableIntroPersonalization: true,
    enableOutroPersonalization: true,
    enableSubtitlePersonalization: true,
    enableRecommendations: true,
    enableInteractiveElements: true,
    maxRecommendations: 6,
    maxInteractiveElements: 3,
    personalizationStrength: 0.7,
  };
}

/**
 * 分析用户画像特征
 *
 * 基于用户的历史行为数据，提取关键特征用于个性化决策。
 *
 * @param profile - 用户画像
 * @returns 特征分析结果
 */
export function analyzeUserProfile(profile: UserProfile): {
  attentionSpan: 'short' | 'medium' | 'long';
  engagementLevel: 'low' | 'medium' | 'high';
  contentPreference: 'quick' | 'standard' | 'deep';
  visualPreference: 'simple' | 'moderate' | 'rich';
} {
  // 注意力时长分析
  const attentionSpan: 'short' | 'medium' | 'long' =
    profile.medianWatchDuration < 30 ? 'short' : profile.medianWatchDuration < 120 ? 'medium' : 'long';

  // 互动水平分析
  const engagementLevel: 'low' | 'medium' | 'high' =
    profile.engagementRate < 0.2 ? 'low' : profile.engagementRate < 0.5 ? 'medium' : 'high';

  // 内容偏好分析
  const contentPreference: 'quick' | 'standard' | 'deep' =
    profile.completionRate < 0.3 ? 'quick' : profile.completionRate < 0.7 ? 'standard' : 'deep';

  // 视觉偏好分析（基于年龄和设备）
  const isYoung = profile.ageGroup === 'child' || profile.ageGroup === 'teen';
  const isMobile = profile.devicePreference === 'mobile';
  const visualPreference: 'simple' | 'moderate' | 'rich' =
    isYoung || isMobile ? 'rich' : profile.ageGroup === 'senior' ? 'simple' : 'moderate';

  return { attentionSpan, engagementLevel, contentPreference, visualPreference };
}

/**
 * 生成个性化片头
 *
 * 根据用户画像和配置生成片头参数，包括动画风格、颜色方案、问候语等。
 *
 * @param profile - 用户画像
 * @param config - 个性化配置
 * @returns 个性化片头配置
 */
export function generatePersonalizedIntro(
  profile: UserProfile,
  config: PersonalizationConfig,
): PersonalizedIntro {
  const features = analyzeUserProfile(profile);
  const strength = clamp(config.personalizationStrength, 0, 1);

  // 基于年龄选择字体大小
  const baseFontSize = AGE_FONT_SIZE_BASE[profile.ageGroup];
  const fontScale = clamp(baseFontSize / 42, 0.8, 1.5);

  // 基于兴趣选择颜色方案
  const primaryInterest = profile.interests[0] ?? 'entertainment';
  const colorScheme = INTEREST_COLOR_SCHEMES[primaryInterest];

  // 基于特征选择动画风格
  const animationStyles: PersonalizedIntro['animationStyle'][] =
    features.visualPreference === 'rich'
      ? ['particle', 'glitch', 'zoom']
      : features.visualPreference === 'simple'
        ? ['fade', 'slide']
        : ['fade', 'slide', 'zoom', 'typewriter'];

  const animationIndex = Math.floor(Math.abs(hashCode(profile.userId)) % animationStyles.length);
  const animationStyle = animationStyles[animationIndex];

  // 基于年龄选择问候语
  const greetings = GREETING_TEMPLATES[profile.ageGroup];
  const greetingIndex = Math.abs(hashCode(profile.userId)) % greetings.length;
  const greetingTemplate = greetings[greetingIndex];

  // 片头时长基于注意力和强度
  const baseDuration = features.attentionSpan === 'short' ? 2 : features.attentionSpan === 'medium' ? 3 : 4;
  const duration = clamp(baseDuration * strength + 1, 1.5, 6);

  return {
    duration,
    animationStyle,
    colorScheme,
    fontScale,
    showUserName: strength > 0.5,
    showGreeting: strength > 0.3,
    greetingTemplate,
    logoPosition: profile.devicePreference === 'mobile' ? 'top-right' : 'top-left',
  };
}

/**
 * 生成个性化片尾
 *
 * @param profile - 用户画像
 * @param config - 个性化配置
 * @returns 个性化片尾配置
 */
export function generatePersonalizedOutro(
  profile: UserProfile,
  config: PersonalizationConfig,
): PersonalizedOutro {
  const features = analyzeUserProfile(profile);
  const strength = clamp(config.personalizationStrength, 0, 1);

  // 推荐数量基于互动水平和配置上限
  const recommendationCount = clamp(
    Math.round(features.engagementLevel === 'high' ? 6 : features.engagementLevel === 'medium' ? 4 : 2),
    1,
    config.maxRecommendations,
  );

  // CTA 文本基于用户行为
  const ctaText =
    features.engagementLevel === 'high'
      ? '查看更多精彩内容'
      : features.engagementLevel === 'medium'
        ? '发现更多'
        : '探索推荐';

  // 时长基于注意力
  const duration = features.attentionSpan === 'short' ? 3 : features.attentionSpan === 'medium' ? 5 : 8;

  return {
    duration,
    recommendationCount,
    showSubscribePrompt: strength > 0.5 && features.engagementLevel !== 'low',
    ctaText,
    ctaUrl: '',
    socialShareButtons: profile.devicePreference === 'mobile' ? ['wechat', 'weibo', 'tiktok'] : ['twitter', 'facebook', 'linkedin'],
    endAnimation: features.visualPreference === 'rich' ? 'zoom-out' : 'fade-out',
  };
}

/**
 * 生成个性化字幕样式
 *
 * @param profile - 用户画像
 * @param config - 个性化配置
 * @returns 个性化字幕样式
 */
export function generatePersonalizedSubtitleStyle(
  profile: UserProfile,
  config: PersonalizationConfig,
): PersonalizedSubtitleStyle {
  const features = analyzeUserProfile(profile);
  const strength = clamp(config.personalizationStrength, 0, 1);

  // 字体族基于风格偏好
  const fontFamily = STYLE_FONT_FAMILIES[profile.preferredStyle];

  // 字体大小基于年龄和设备
  const baseFontSize = AGE_FONT_SIZE_BASE[profile.ageGroup];
  const deviceScale = profile.devicePreference === 'mobile' ? 0.85 : profile.devicePreference === 'tablet' ? 0.95 : 1.0;
  const fontSize = Math.round(baseFontSize * deviceScale * (0.8 + strength * 0.4));

  // 颜色基于兴趣
  const primaryInterest = profile.interests[0] ?? 'entertainment';
  const colors = INTEREST_COLOR_SCHEMES[primaryInterest];
  const color = features.visualPreference === 'rich' ? colors[0] : '#ffffff';

  // 背景样式
  const background: PersonalizedSubtitleStyle['background'] =
    features.visualPreference === 'simple' ? 'solid' : features.visualPreference === 'rich' ? 'gradient' : 'blur';

  // 动画效果
  const animation: PersonalizedSubtitleStyle['animation'] =
    features.visualPreference === 'rich'
      ? 'typewriter'
      : features.visualPreference === 'simple'
        ? 'none'
        : 'fade';

  return {
    fontFamily,
    fontSize,
    color,
    strokeColor: '#000000',
    strokeWidth: profile.devicePreference === 'mobile' ? 3 : 2,
    background,
    backgroundColor: '#000000',
    backgroundOpacity: background === 'solid' ? 0.7 : background === 'blur' ? 0.5 : 0.6,
    position: DEVICE_SUBTITLE_POSITION[profile.devicePreference],
    animation,
    lineHeight: 1.4,
  };
}

/**
 * 生成推荐内容
 *
 * 基于用户兴趣和行为生成个性化推荐列表。
 *
 * @param profile - 用户画像
 * @param availableContent - 可选内容池
 * @param config - 个性化配置
 * @returns 推荐内容列表
 */
export function generateRecommendations(
  profile: UserProfile,
  availableContent: Array<{
    id: string;
    title: string;
    thumbnailUrl: string;
    contentType: RecommendedContent['contentType'];
    tags: string[];
    estimatedDuration: number;
  }>,
  config: PersonalizationConfig,
): RecommendedContent[] {
  if (!config.enableRecommendations || availableContent.length === 0) {
    return [];
  }

  const maxCount = clamp(config.maxRecommendations, 1, 12);

  // 计算每个内容的相关性评分
  const scored = availableContent.map((content) => {
    // 兴趣匹配度
    const interestMatch = jaccardSimilarity(profile.interests, content.tags);

    // 时长适配度（越接近用户习惯越好）
    const durationDiff = Math.abs(content.estimatedDuration - profile.medianWatchDuration);
    const durationMatch = clamp(1 - durationDiff / 300, 0, 1);

    // 综合评分
    const relevanceScore = interestMatch * 0.6 + durationMatch * 0.4;

    // 推荐理由
    const reason = interestMatch > 0.5
      ? `与你感兴趣的${profile.interests[0] ?? '内容'}相关`
      : durationMatch > 0.8
        ? '时长适合你的观看习惯'
        : '为你推荐';

    return {
      id: content.id,
      title: content.title,
      thumbnailUrl: content.thumbnailUrl,
      relevanceScore: Math.round(relevanceScore * 100) / 100,
      reason,
      contentType: content.contentType,
      estimatedDuration: content.estimatedDuration,
    };
  });

  // 按相关性排序并截取
  return scored.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, maxCount);
}

/**
 * 生成互动元素
 *
 * 基于用户画像和内容上下文生成互动元素。
 *
 * @param profile - 用户画像
 * @param videoDuration - 视频总时长（秒）
 * @param config - 个性化配置
 * @returns 互动元素列表
 */
export function generateInteractiveElements(
  profile: UserProfile,
  videoDuration: number,
  config: PersonalizationConfig,
): InteractiveElement[] {
  if (!config.enableInteractiveElements || videoDuration < 10) {
    return [];
  }

  const maxCount = clamp(config.maxInteractiveElements, 1, 5);
  const features = analyzeUserProfile(profile);
  const elements: InteractiveElement[] = [];

  // 高互动用户添加更多互动元素
  const elementCount = features.engagementLevel === 'high'
    ? maxCount
    : features.engagementLevel === 'medium'
      ? Math.max(1, Math.floor(maxCount * 0.6))
      : Math.max(1, Math.floor(maxCount * 0.3));

  // 在视频的关键时间点插入互动元素
  const insertPoints = calculateInsertPoints(videoDuration, elementCount);

  for (let i = 0; i < elementCount && i < insertPoints.length; i++) {
    const point = insertPoints[i];
    const elementType = selectInteractiveElementType(i, features);

    elements.push({
      type: elementType,
      startTime: point.time,
      duration: point.duration,
      position: calculateElementPosition(elementType, i, profile.devicePreference),
      content: generateInteractiveContent(elementType, profile),
      options: elementType === 'poll' || elementType === 'quiz' ? generateInteractiveOptions(elementType, profile) : undefined,
      style: INTERACTIVE_ELEMENT_STYLES[elementType],
    });
  }

  return elements;
}

/**
 * 执行完整的个性化生成
 *
 * 整合所有个性化组件，生成完整的个性化结果。
 *
 * @param profile - 用户画像
 * @param config - 个性化配置
 * @param availableContent - 可选内容池（用于推荐）
 * @param videoDuration - 视频总时长（秒）
 * @returns 个性化生成结果
 */
export function generatePersonalizedContent(
  profile: UserProfile,
  config: PersonalizationConfig,
  availableContent: Parameters<typeof generateRecommendations>[1] = [],
  videoDuration: number = 60,
): PersonalizationResult {
  const startTime = performance.now();

  const intro = config.enableIntroPersonalization
    ? generatePersonalizedIntro(profile, config)
    : createMinimalIntro();

  const outro = config.enableOutroPersonalization
    ? generatePersonalizedOutro(profile, config)
    : createMinimalOutro();

  const subtitleStyle = config.enableSubtitlePersonalization
    ? generatePersonalizedSubtitleStyle(profile, config)
    : createDefaultSubtitleStyle();

  const recommendations = generateRecommendations(profile, availableContent, config);
  const interactiveElements = generateInteractiveElements(profile, videoDuration, config);

  // 计算个性化评分
  const personalizationScore = computePersonalizationScore(profile, config, {
    hasIntro: config.enableIntroPersonalization,
    hasOutro: config.enableOutroPersonalization,
    hasSubtitle: config.enableSubtitlePersonalization,
    hasRecommendations: recommendations.length > 0,
    hasInteractive: interactiveElements.length > 0,
  });

  const generationTimeMs = performance.now() - startTime;

  return {
    intro,
    outro,
    subtitleStyle,
    recommendations,
    interactiveElements,
    personalizationScore: Math.round(personalizationScore * 100) / 100,
    generationTimeMs,
  };
}

/**
 * 验证个性化配置
 *
 * @param config - 待验证的配置
 * @returns 是否合法
 */
export function validatePersonalizationConfig(config: PersonalizationConfig): boolean {
  if (config.personalizationStrength < 0 || config.personalizationStrength > 1) return false;
  if (config.maxRecommendations < 0 || config.maxRecommendations > 20) return false;
  if (config.maxInteractiveElements < 0 || config.maxInteractiveElements > 10) return false;
  return true;
}

/**
 * 验证用户画像
 *
 * @param profile - 待验证的画像
 * @returns 是否合法
 */
export function validateUserProfile(profile: UserProfile): boolean {
  if (!profile.userId || profile.userId.trim().length === 0) return false;
  if (profile.engagementRate < 0 || profile.engagementRate > 1) return false;
  if (profile.completionRate < 0 || profile.completionRate > 1) return false;
  if (profile.medianWatchDuration < 0) return false;
  if (!Array.isArray(profile.interests)) return false;
  if (!Array.isArray(profile.activeHours)) return false;
  return true;
}

// ==================== 内部辅助函数 ====================

/** 简单哈希函数 */
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash;
}

/** 计算互动元素插入时间点 */
function calculateInsertPoints(
  videoDuration: number,
  count: number,
): Array<{ time: number; duration: number }> {
  const points: Array<{ time: number; duration: number }> = [];
  const segmentDuration = videoDuration / (count + 1);

  for (let i = 0; i < count; i++) {
    const time = Math.round(segmentDuration * (i + 1));
    const duration = clamp(videoDuration * 0.05, 3, 10);
    points.push({ time, duration });
  }

  return points;
}

/** 选择互动元素类型 */
function selectInteractiveElementType(
  index: number,
  features: ReturnType<typeof analyzeUserProfile>,
): InteractiveElementType {
  const types: InteractiveElementType[] =
    features.engagementLevel === 'high'
      ? ['poll', 'quiz', 'emoji-reaction', 'hotspot', 'cta-button']
      : features.engagementLevel === 'medium'
        ? ['poll', 'cta-button', 'emoji-reaction']
        : ['cta-button', 'swipe-up'];

  return types[index % types.length];
}

/** 计算互动元素位置 */
function calculateElementPosition(
  type: InteractiveElementType,
  index: number,
  device: UserProfile['devicePreference'],
): { x: number; y: number } {
  // 移动设备偏下方，桌面偏右方
  const baseX = device === 'mobile' ? 0.5 : 0.75;
  const baseY = 0.7 + index * 0.1;

  // 不同类型微调位置
  const offsets: Record<InteractiveElementType, { x: number; y: number }> = {
    poll: { x: 0, y: -0.1 },
    quiz: { x: 0, y: -0.15 },
    'cta-button': { x: 0, y: 0.1 },
    'swipe-up': { x: 0, y: 0.2 },
    countdown: { x: 0.1, y: -0.2 },
    hotspot: { x: -0.1, y: 0 },
    'emoji-reaction': { x: 0, y: 0.15 },
  };

  const offset = offsets[type];
  return {
    x: clamp(baseX + offset.x, 0.1, 0.9),
    y: clamp(baseY + offset.y, 0.1, 0.9),
  };
}

/** 生成互动元素内容 */
function generateInteractiveContent(type: InteractiveElementType, profile: UserProfile): string {
  const interestLabel = profile.interests[0] ?? '内容';
  const templates: Record<InteractiveElementType, string> = {
    poll: `你觉得这个${interestLabel}怎么样？`,
    quiz: `关于${interestLabel}的小测验`,
    'cta-button': '了解更多',
    'swipe-up': '上滑查看更多',
    countdown: '精彩即将开始',
    hotspot: '点击探索',
    'emoji-reaction': '你感觉如何？',
  };
  return templates[type];
}

/** 生成互动选项 */
function generateInteractiveOptions(type: InteractiveElementType, profile: UserProfile): string[] {
  if (type === 'poll') {
    return ['非常喜欢', '还不错', '一般般', '不太喜欢'];
  }
  if (type === 'quiz') {
    const interestLabel = profile.interests[0] ?? '这个';
    return [`关于${interestLabel}的问题`, '选项 A', '选项 B', '选项 C'];
  }
  return [];
}

/** 计算个性化评分 */
function computePersonalizationScore(
  profile: UserProfile,
  config: PersonalizationConfig,
  flags: {
    hasIntro: boolean;
    hasOutro: boolean;
    hasSubtitle: boolean;
    hasRecommendations: boolean;
    hasInteractive: boolean;
  },
): number {
  let score = 0;
  let maxScore = 0;

  // 画像完整度
  maxScore += 30;
  if (profile.interests.length > 0) score += 10;
  if (profile.preferredStyle) score += 10;
  if (profile.customTags.length > 0) score += 10;

  // 功能启用度
  maxScore += 35;
  if (flags.hasIntro) score += 7;
  if (flags.hasOutro) score += 7;
  if (flags.hasSubtitle) score += 7;
  if (flags.hasRecommendations) score += 7;
  if (flags.hasInteractive) score += 7;

  // 行为数据丰富度
  maxScore += 20;
  if (profile.engagementRate > 0) score += 10;
  if (profile.completionRate > 0) score += 10;

  // 配置强度
  maxScore += 15;
  score += Math.round(config.personalizationStrength * 15);

  return maxScore > 0 ? score / maxScore : 0;
}

/** 创建最小片头 */
function createMinimalIntro(): PersonalizedIntro {
  return {
    duration: 2,
    animationStyle: 'fade',
    colorScheme: ['#ffffff', '#cccccc'],
    fontScale: 1.0,
    showUserName: false,
    showGreeting: false,
    greetingTemplate: '',
    logoPosition: 'top-left',
  };
}

/** 创建最小片尾 */
function createMinimalOutro(): PersonalizedOutro {
  return {
    duration: 3,
    recommendationCount: 2,
    showSubscribePrompt: false,
    ctaText: '查看更多',
    ctaUrl: '',
    socialShareButtons: [],
    endAnimation: 'fade-out',
  };
}

/** 创建默认字幕样式 */
function createDefaultSubtitleStyle(): PersonalizedSubtitleStyle {
  return {
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: 42,
    color: '#ffffff',
    strokeColor: '#000000',
    strokeWidth: 2,
    background: 'solid',
    backgroundColor: '#000000',
    backgroundOpacity: 0.6,
    position: 'bottom',
    animation: 'none',
    lineHeight: 1.4,
  };
}

/**
 * 安全执行个性化生成
 *
 * @param profile - 用户画像
 * @param config - 个性化配置
 * @param t - 可选的翻译函数
 * @returns 包装在 AiModuleResult 中的个性化结果
 */
export async function generatePersonalizedContentSafe(
  profile: UserProfile,
  config: PersonalizationConfig,
  t: TranslateFn = identityTranslator,
): Promise<AiModuleResult<PersonalizationResult>> {
  try {
    if (!validateUserProfile(profile)) {
      return {
        data: createEmptyPersonalizationResult(),
        error: t('aiModules.personalization.invalidProfile'),
      };
    }
    if (!validatePersonalizationConfig(config)) {
      return {
        data: createEmptyPersonalizationResult(),
        error: t('aiModules.personalization.invalidConfig'),
      };
    }
    const data = generatePersonalizedContent(profile, config);
    return { data, error: null };
  } catch {
    return {
      data: createEmptyPersonalizationResult(),
      error: t('aiModules.error.parseFailed'),
    };
  }
}

/** 创建空的个性化结果 */
function createEmptyPersonalizationResult(): PersonalizationResult {
  return {
    intro: createMinimalIntro(),
    outro: createMinimalOutro(),
    subtitleStyle: createDefaultSubtitleStyle(),
    recommendations: [],
    interactiveElements: [],
    personalizationScore: 0,
    generationTimeMs: 0,
  };
}

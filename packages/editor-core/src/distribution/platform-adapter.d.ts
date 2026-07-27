/**
 * 平台适配系统
 *
 * 为各社交媒体平台提供专属的内容适配策略。
 * 内置 YouTube、B站、抖音、小红书等平台规范，
 * 自动调整视频节奏、字幕样式、片头片尾。
 *
 * 适配维度：
 * - 视频节奏（剪辑密度、转场风格）
 * - 字幕样式（字号、位置、动画）
 * - 片头片尾（时长、风格）
 * - 平台特定优化（如抖音前3秒强吸引）
 */
import type { DistributionPlatformSpec, DistributionPlatformId } from './platform-presets';
/** 平台视频节奏风格 */
export type PlatformRhythmStyle = 'fast' | 'medium' | 'slow' | 'dynamic';
/** 转场风格偏好 */
export type TransitionStyle = 'cut' | 'smooth' | 'flashy' | 'minimal';
/** 平台字幕样式配置 */
export interface SubtitleAdaptation {
    /** 字号比例（相对画面高度，0-1） */
    fontSizeRatio: number;
    /** 字幕垂直位置（归一化 0-1，从顶部算起） */
    verticalPosition: number;
    /** 字体粗细 */
    fontWeight: 'normal' | 'bold' | 'extrabold';
    /** 是否添加描边 */
    hasOutline: boolean;
    /** 描边颜色 */
    outlineColor: string;
    /** 是否添加阴影 */
    hasShadow: boolean;
    /** 动画类型 */
    animationType: 'none' | 'fade' | 'pop' | 'slide' | 'typewriter';
    /** 每行最大字符数 */
    maxCharsPerLine: number;
    /** 是否显示说话人标签 */
    showSpeakerLabel: boolean;
    /** 背景样式 */
    backgroundStyle: 'none' | 'semi-transparent' | 'pill' | 'box';
}
/** 片头配置 */
export interface IntroConfig {
    /** 是否需要片头 */
    enabled: boolean;
    /** 片头时长（秒） */
    durationSecs: number;
    /** 片头风格 */
    style: 'title-card' | 'hook' | 'logo-reveal' | 'countdown' | 'none';
    /** 是否包含标题文字 */
    showTitle: boolean;
    /** 是否包含频道名 */
    showChannelName: boolean;
    /** 淡入时长（秒） */
    fadeInSecs: number;
}
/** 片尾配置 */
export interface OutroConfig {
    /** 是否需要片尾 */
    enabled: boolean;
    /** 片尾时长（秒） */
    durationSecs: number;
    /** 片尾风格 */
    style: 'subscribe-cta' | 'end-screen' | 'logo' | 'fade-out' | 'none';
    /** 是否显示订阅/关注提示 */
    showSubscribeCta: boolean;
    /** 是否显示相关视频推荐 */
    showRelatedVideos: boolean;
    /** 淡出时长（秒） */
    fadeOutSecs: number;
}
/** 平台特定优化配置 */
export interface PlatformOptimizations {
    /** 前N秒强吸引（针对抖音等短视频平台） */
    hookDurationSecs: number;
    /** 是否在开头添加悬念 */
    addOpeningHook: boolean;
    /** 循环播放优化（结尾平滑过渡到开头） */
    loopFriendly: boolean;
    /** 是否适配静音播放（添加字幕/文字说明） */
    silentModeFriendly: boolean;
    /** 竖屏内容主体偏上（抖音用户习惯） */
    subjectShiftUp: boolean;
    /** 是否添加平台水印位置预留 */
    reserveWatermarkSpace: boolean;
    /** 水印位置 */
    watermarkPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}
/** 完整的平台适配方案 */
export interface PlatformAdaptation {
    /** 平台信息 */
    platform: DistributionPlatformSpec;
    /** 节奏风格 */
    rhythmStyle: PlatformRhythmStyle;
    /** 建议的剪辑密度（每分钟片段数） */
    clipsPerMinute: number;
    /** 建议的单个片段时长范围（秒） */
    clipDurationRange: {
        min: number;
        max: number;
    };
    /** 转场风格 */
    transitionStyle: TransitionStyle;
    /** 建议的转场时长（秒） */
    transitionDurationSecs: number;
    /** 字幕适配 */
    subtitleAdaptation: SubtitleAdaptation;
    /** 片头配置 */
    intro: IntroConfig;
    /** 片尾配置 */
    outro: OutroConfig;
    /** 平台优化策略 */
    optimizations: PlatformOptimizations;
    /** 适配说明 */
    notes: string[];
}
/**
 * 获取平台的完整适配方案
 *
 * @param platformId 平台 ID
 * @returns 平台适配方案
 */
export declare function getPlatformAdaptation(platformId: DistributionPlatformId): PlatformAdaptation;
/**
 * 批量获取多个平台的适配方案
 */
export declare function getBatchPlatformAdaptations(platformIds: DistributionPlatformId[]): PlatformAdaptation[];
/**
 * 获取所有已注册适配规则的平台 ID
 */
export declare function getAdaptedPlatformIds(): DistributionPlatformId[];
/** 适配建议 */
export interface AdaptationSuggestion {
    type: 'rhythm' | 'subtitle' | 'intro' | 'outro' | 'optimization';
    severity: 'info' | 'warning' | 'critical';
    message: string;
    platformId: DistributionPlatformId;
}
/**
 * 分析项目并生成适配建议
 *
 * 检查项目当前设置与目标平台要求的差异，生成优化建议。
 */
export declare function analyzeAdaptationNeeds(project: {
    width: number;
    height: number;
    durationSecs: number;
    hasSubtitles: boolean;
    hasIntro: boolean;
    hasOutro: boolean;
    clipsPerMinute?: number;
}, platformId: DistributionPlatformId): AdaptationSuggestion[];
/** 平台节奏参数输出 */
export interface PlatformRhythmParams {
    /** 目标 BPM */
    targetBpm: number;
    /** 建议的片段时长列表（秒） */
    clipDurations: number[];
    /** 建议的转场间隔（秒） */
    transitionInterval: number;
    /** 节拍密度（每秒节拍数） */
    beatsPerSecond: number;
}
/**
 * 根据平台适配方案计算节奏参数
 */
export declare function calculatePlatformRhythm(adaptation: PlatformAdaptation, totalDurationSecs: number): PlatformRhythmParams;
//# sourceMappingURL=platform-adapter.d.ts.map
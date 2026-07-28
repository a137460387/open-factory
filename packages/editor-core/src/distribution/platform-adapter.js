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
import { getDistributionPlatform } from './platform-presets';
/** 平台规则映射表 */
const PLATFORM_RULES = {
    // ── YouTube ──
    'youtube-1080p': {
        rhythmStyle: 'medium',
        clipsPerMinute: 8,
        clipDurationRange: { min: 3, max: 15 },
        transitionStyle: 'smooth',
        transitionDurationSecs: 0.5,
        subtitle: {
            fontSizeRatio: 0.035,
            verticalPosition: 0.88,
            fontWeight: 'bold',
            hasOutline: true,
            outlineColor: '#000000',
            hasShadow: false,
            animationType: 'fade',
            maxCharsPerLine: 20,
            showSpeakerLabel: false,
            backgroundStyle: 'none',
        },
        intro: {
            enabled: true,
            durationSecs: 3,
            style: 'title-card',
            showTitle: true,
            showChannelName: true,
            fadeInSecs: 0.5,
        },
        outro: {
            enabled: true,
            durationSecs: 10,
            style: 'end-screen',
            showSubscribeCta: true,
            showRelatedVideos: true,
            fadeOutSecs: 1,
        },
        optimizations: {
            hookDurationSecs: 5,
            addOpeningHook: true,
            loopFriendly: false,
            silentModeFriendly: true,
            subjectShiftUp: false,
            reserveWatermarkSpace: false,
        },
        notes: ['YouTube 偏好较长内容，保持自然节奏', '片尾预留 End Screen 空间'],
    },
    'youtube-shorts': {
        rhythmStyle: 'fast',
        clipsPerMinute: 15,
        clipDurationRange: { min: 1, max: 5 },
        transitionStyle: 'cut',
        transitionDurationSecs: 0.2,
        subtitle: {
            fontSizeRatio: 0.045,
            verticalPosition: 0.5,
            fontWeight: 'extrabold',
            hasOutline: true,
            outlineColor: '#000000',
            hasShadow: true,
            animationType: 'pop',
            maxCharsPerLine: 12,
            showSpeakerLabel: false,
            backgroundStyle: 'none',
        },
        intro: { enabled: false, durationSecs: 0, style: 'none', fadeInSecs: 0 },
        outro: { enabled: false, durationSecs: 0, style: 'none', fadeOutSecs: 0 },
        optimizations: {
            hookDurationSecs: 2,
            addOpeningHook: true,
            loopFriendly: true,
            silentModeFriendly: true,
            subjectShiftUp: true,
            reserveWatermarkSpace: true,
            watermarkPosition: 'top-right',
        },
        notes: ['YouTube Shorts 需要前2秒强吸引', '优化循环播放体验'],
    },
    // ── TikTok / 抖音 ──
    tiktok: {
        rhythmStyle: 'fast',
        clipsPerMinute: 18,
        clipDurationRange: { min: 0.8, max: 4 },
        transitionStyle: 'flashy',
        transitionDurationSecs: 0.15,
        subtitle: {
            fontSizeRatio: 0.05,
            verticalPosition: 0.45,
            fontWeight: 'extrabold',
            hasOutline: true,
            outlineColor: '#000000',
            hasShadow: true,
            animationType: 'pop',
            maxCharsPerLine: 10,
            showSpeakerLabel: false,
            backgroundStyle: 'none',
        },
        intro: { enabled: false, durationSecs: 0, style: 'hook', fadeInSecs: 0 },
        outro: { enabled: false, durationSecs: 0, style: 'fade-out', fadeOutSecs: 0.3 },
        optimizations: {
            hookDurationSecs: 3,
            addOpeningHook: true,
            loopFriendly: true,
            silentModeFriendly: true,
            subjectShiftUp: true,
            reserveWatermarkSpace: true,
            watermarkPosition: 'bottom-right',
        },
        notes: ['抖音前3秒是关键，必须有强吸引力', '字幕居中偏上，避开底部操作栏', '优化循环播放，结尾平滑过渡'],
    },
    // ── Bilibili ──
    bilibili: {
        rhythmStyle: 'medium',
        clipsPerMinute: 10,
        clipDurationRange: { min: 2, max: 12 },
        transitionStyle: 'smooth',
        transitionDurationSecs: 0.4,
        subtitle: {
            fontSizeRatio: 0.032,
            verticalPosition: 0.88,
            fontWeight: 'bold',
            hasOutline: true,
            outlineColor: '#000000',
            hasShadow: false,
            animationType: 'fade',
            maxCharsPerLine: 18,
            showSpeakerLabel: true,
            backgroundStyle: 'semi-transparent',
        },
        intro: {
            enabled: true,
            durationSecs: 3,
            style: 'logo-reveal',
            showTitle: true,
            showChannelName: false,
            fadeInSecs: 0.5,
        },
        outro: {
            enabled: true,
            durationSecs: 5,
            style: 'subscribe-cta',
            showSubscribeCta: true,
            showRelatedVideos: false,
            fadeOutSecs: 0.8,
        },
        optimizations: {
            hookDurationSecs: 5,
            addOpeningHook: true,
            loopFriendly: false,
            silentModeFriendly: true,
            subjectShiftUp: false,
            reserveWatermarkSpace: false,
        },
        notes: ['B站用户偏好有深度的内容，节奏可适当放缓', '支持说话人标签显示', '字幕使用半透明背景提升可读性'],
    },
    // ── 小红书 ──
    xiaohongshu: {
        rhythmStyle: 'medium',
        clipsPerMinute: 12,
        clipDurationRange: { min: 1.5, max: 8 },
        transitionStyle: 'smooth',
        transitionDurationSecs: 0.3,
        subtitle: {
            fontSizeRatio: 0.04,
            verticalPosition: 0.5,
            fontWeight: 'bold',
            hasOutline: false,
            outlineColor: '',
            hasShadow: true,
            animationType: 'pop',
            maxCharsPerLine: 14,
            showSpeakerLabel: false,
            backgroundStyle: 'pill',
        },
        intro: {
            enabled: true,
            durationSecs: 2,
            style: 'title-card',
            showTitle: true,
            showChannelName: false,
            fadeInSecs: 0.3,
        },
        outro: {
            enabled: true,
            durationSecs: 3,
            style: 'subscribe-cta',
            showSubscribeCta: true,
            showRelatedVideos: false,
            fadeOutSecs: 0.5,
        },
        optimizations: {
            hookDurationSecs: 3,
            addOpeningHook: true,
            loopFriendly: false,
            silentModeFriendly: true,
            subjectShiftUp: true,
            reserveWatermarkSpace: false,
        },
        notes: ['小红书注重精致感，字幕使用胶囊背景', '竖屏内容主体偏上'],
    },
};
// ── 微信视频号 ──
const WEIXIN_CHANNELS_RULE = {
    rhythmStyle: 'slow',
    clipsPerMinute: 6,
    clipDurationRange: { min: 4, max: 20 },
    transitionStyle: 'smooth',
    transitionDurationSecs: 0.6,
    subtitle: {
        fontSizeRatio: 0.038,
        verticalPosition: 0.88,
        fontWeight: 'bold',
        hasOutline: true,
        outlineColor: '#000000',
        hasShadow: false,
        animationType: 'fade',
        maxCharsPerLine: 16,
        showSpeakerLabel: false,
        backgroundStyle: 'none',
    },
    intro: {
        enabled: true,
        durationSecs: 3,
        style: 'title-card',
        showTitle: true,
        showChannelName: false,
        fadeInSecs: 0.5,
    },
    outro: {
        enabled: true,
        durationSecs: 5,
        style: 'fade-out',
        showSubscribeCta: false,
        showRelatedVideos: false,
        fadeOutSecs: 1,
    },
    optimizations: {
        hookDurationSecs: 5,
        addOpeningHook: true,
        loopFriendly: false,
        silentModeFriendly: true,
        subjectShiftUp: false,
        reserveWatermarkSpace: false,
    },
    notes: ['微信视频号用户偏好轻松、生活化内容', '节奏可适当放缓'],
};
// ── 快手 ──
const KUAISHOU_RULE = {
    rhythmStyle: 'fast',
    clipsPerMinute: 15,
    clipDurationRange: { min: 1, max: 5 },
    transitionStyle: 'cut',
    transitionDurationSecs: 0.2,
    subtitle: {
        fontSizeRatio: 0.048,
        verticalPosition: 0.5,
        fontWeight: 'extrabold',
        hasOutline: true,
        outlineColor: '#000000',
        hasShadow: true,
        animationType: 'pop',
        maxCharsPerLine: 10,
        showSpeakerLabel: false,
        backgroundStyle: 'none',
    },
    intro: { enabled: false, durationSecs: 0, style: 'none', fadeInSecs: 0 },
    outro: { enabled: false, durationSecs: 0, style: 'fade-out', fadeOutSecs: 0.3 },
    optimizations: {
        hookDurationSecs: 2,
        addOpeningHook: true,
        loopFriendly: true,
        silentModeFriendly: true,
        subjectShiftUp: true,
        reserveWatermarkSpace: true,
        watermarkPosition: 'bottom-right',
    },
    notes: ['快手前2秒强吸引', '优化循环播放'],
};
// 注册到规则表
PLATFORM_RULES['weixin-channels'] = WEIXIN_CHANNELS_RULE;
PLATFORM_RULES['kuaishou'] = KUAISHOU_RULE;
/** 默认规则（用于未定义专属规则的平台） */
const DEFAULT_RULE = {
    rhythmStyle: 'medium',
    clipsPerMinute: 10,
    clipDurationRange: { min: 2, max: 10 },
    transitionStyle: 'smooth',
    transitionDurationSecs: 0.4,
    subtitle: {
        fontSizeRatio: 0.035,
        verticalPosition: 0.88,
        fontWeight: 'bold',
        hasOutline: true,
        outlineColor: '#000000',
        hasShadow: false,
        animationType: 'fade',
        maxCharsPerLine: 16,
        showSpeakerLabel: false,
        backgroundStyle: 'none',
    },
    intro: {
        enabled: true,
        durationSecs: 2,
        style: 'title-card',
        showTitle: true,
        showChannelName: false,
        fadeInSecs: 0.5,
    },
    outro: {
        enabled: true,
        durationSecs: 5,
        style: 'fade-out',
        showSubscribeCta: false,
        showRelatedVideos: false,
        fadeOutSecs: 0.8,
    },
    optimizations: {
        hookDurationSecs: 3,
        addOpeningHook: false,
        loopFriendly: false,
        silentModeFriendly: true,
        subjectShiftUp: false,
        reserveWatermarkSpace: false,
    },
    notes: [],
};
// ─── 默认字幕样式 ────────────────────────────────────────────
const DEFAULT_SUBTITLE = {
    fontSizeRatio: 0.035,
    verticalPosition: 0.88,
    fontWeight: 'bold',
    hasOutline: true,
    outlineColor: '#000000',
    hasShadow: false,
    animationType: 'fade',
    maxCharsPerLine: 16,
    showSpeakerLabel: false,
    backgroundStyle: 'none',
};
const DEFAULT_INTRO = {
    enabled: true,
    durationSecs: 2,
    style: 'title-card',
    showTitle: true,
    showChannelName: false,
    fadeInSecs: 0.5,
};
const DEFAULT_OUTRO = {
    enabled: true,
    durationSecs: 5,
    style: 'fade-out',
    showSubscribeCta: false,
    showRelatedVideos: false,
    fadeOutSecs: 0.8,
};
const DEFAULT_OPTIMIZATIONS = {
    hookDurationSecs: 3,
    addOpeningHook: false,
    loopFriendly: false,
    silentModeFriendly: true,
    subjectShiftUp: false,
    reserveWatermarkSpace: false,
};
// ─── 核心适配函数 ────────────────────────────────────────────
/**
 * 获取平台的完整适配方案
 *
 * @param platformId 平台 ID
 * @returns 平台适配方案
 */
export function getPlatformAdaptation(platformId) {
    const platform = getDistributionPlatform(platformId);
    const rule = PLATFORM_RULES[platformId] ?? DEFAULT_RULE;
    return {
        platform,
        rhythmStyle: rule.rhythmStyle,
        clipsPerMinute: rule.clipsPerMinute,
        clipDurationRange: rule.clipDurationRange,
        transitionStyle: rule.transitionStyle,
        transitionDurationSecs: rule.transitionDurationSecs,
        subtitleAdaptation: { ...DEFAULT_SUBTITLE, ...rule.subtitle },
        intro: { ...DEFAULT_INTRO, ...rule.intro },
        outro: { ...DEFAULT_OUTRO, ...rule.outro },
        optimizations: { ...DEFAULT_OPTIMIZATIONS, ...rule.optimizations },
        notes: rule.notes,
    };
}
/**
 * 批量获取多个平台的适配方案
 */
export function getBatchPlatformAdaptations(platformIds) {
    return platformIds.map(getPlatformAdaptation);
}
/**
 * 获取所有已注册适配规则的平台 ID
 */
export function getAdaptedPlatformIds() {
    return Object.keys(PLATFORM_RULES);
}
/**
 * 分析项目并生成适配建议
 *
 * 检查项目当前设置与目标平台要求的差异，生成优化建议。
 */
export function analyzeAdaptationNeeds(project, platformId) {
    const adaptation = getPlatformAdaptation(platformId);
    const suggestions = [];
    // 节奏检查
    if (project.clipsPerMinute !== undefined) {
        const diff = Math.abs(project.clipsPerMinute - adaptation.clipsPerMinute);
        if (diff > 5) {
            suggestions.push({
                type: 'rhythm',
                severity: 'warning',
                message: `当前剪辑密度 (${project.clipsPerMinute}/分钟) 与 ${adaptation.platform.name} 推荐 (${adaptation.clipsPerMinute}/分钟) 差异较大`,
                platformId,
            });
        }
    }
    // 字幕检查
    if (!project.hasSubtitles && adaptation.optimizations.silentModeFriendly) {
        suggestions.push({
            type: 'subtitle',
            severity: 'info',
            message: `${adaptation.platform.name} 推荐添加字幕以适配静音播放场景`,
            platformId,
        });
    }
    // 片头检查
    if (!project.hasIntro && adaptation.intro.enabled) {
        suggestions.push({
            type: 'intro',
            severity: 'info',
            message: `${adaptation.platform.name} 推荐添加${adaptation.intro.durationSecs}秒片头`,
            platformId,
        });
    }
    // 片尾检查
    if (!project.hasOutro && adaptation.outro.enabled) {
        suggestions.push({
            type: 'outro',
            severity: 'info',
            message: `${adaptation.platform.name} 推荐添加${adaptation.outro.durationSecs}秒片尾`,
            platformId,
        });
    }
    // 时长检查
    if (adaptation.platform.maxDurationSecs !== undefined && project.durationSecs > adaptation.platform.maxDurationSecs) {
        suggestions.push({
            type: 'optimization',
            severity: 'critical',
            message: `视频时长 (${Math.round(project.durationSecs)}秒) 超出 ${adaptation.platform.name} 限制 (${adaptation.platform.maxDurationSecs}秒)`,
            platformId,
        });
    }
    // 前N秒强吸引检查
    if (adaptation.optimizations.addOpeningHook) {
        suggestions.push({
            type: 'optimization',
            severity: 'warning',
            message: `${adaptation.platform.name} 需要前${adaptation.optimizations.hookDurationSecs}秒强吸引力内容`,
            platformId,
        });
    }
    return suggestions;
}
/**
 * 根据平台适配方案计算节奏参数
 */
export function calculatePlatformRhythm(adaptation, totalDurationSecs) {
    const { rhythmStyle, clipsPerMinute, clipDurationRange } = adaptation;
    // 根据节奏风格计算目标 BPM
    const bpmMap = {
        fast: 140,
        medium: 110,
        slow: 80,
        dynamic: 120,
    };
    const targetBpm = bpmMap[rhythmStyle];
    // 计算片段时长序列
    const totalClips = Math.round((clipsPerMinute / 60) * totalDurationSecs);
    const avgDuration = totalDurationSecs / Math.max(totalClips, 1);
    const clipDurations = [];
    for (let i = 0; i < totalClips; i++) {
        // 在范围内添加轻微变化
        const variation = rhythmStyle === 'dynamic' ? 0.3 : 0.1;
        const duration = clipDurationRange.min + Math.random() * (clipDurationRange.max - clipDurationRange.min) * variation;
        clipDurations.push(Math.max(clipDurationRange.min, Math.min(clipDurationRange.max, avgDuration + duration - avgDuration * variation)));
    }
    return {
        targetBpm,
        clipDurations,
        transitionInterval: adaptation.transitionDurationSecs,
        beatsPerSecond: targetBpm / 60,
    };
}
//# sourceMappingURL=platform-adapter.js.map
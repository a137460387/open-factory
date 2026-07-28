/**
 * 智能场景分析模块
 * 实现自动场景检测、内容标签生成、质量评估
 * 本地优先：所有分析在本地完成
 */
/** 自动化场景类型 */
export type AutomationSceneType = 'dialogue' | 'action' | 'landscape' | 'close-up' | 'wide-shot' | 'montage' | 'transition' | 'title' | 'black' | 'unknown';
/** 内容标签 */
export interface ContentTag {
    id: string;
    name: string;
    category: string;
    confidence: number;
}
/** 场景质量指标 */
export interface SceneQualityMetrics {
    /** 综合质量分 0-100 */
    overall: number;
    /** 清晰度 0-100 */
    sharpness: number;
    /** 曝光 0-100 */
    exposure: number;
    /** 色彩饱和度 0-100 */
    colorSaturation: number;
    /** 稳定性 0-100 */
    stability: number;
    /** 音频质量 0-100 */
    audioQuality: number;
    /** 噪点水平 0-100 (越低越好) */
    noiseLevel: number;
}
/** 场景分析结果 */
export interface SceneAnalysis {
    id: string;
    /** 媒体文件路径 */
    mediaPath: string;
    /** 场景开始时间（秒） */
    startTime: number;
    /** 场景结束时间（秒） */
    endTime: number;
    /** 场景时长（秒） */
    duration: number;
    /** 场景类型 */
    sceneType: AutomationSceneType;
    /** 场景类型置信度 */
    sceneTypeConfidence: number;
    /** 内容标签 */
    tags: ContentTag[];
    /** 质量指标 */
    quality: SceneQualityMetrics;
    /** 关键帧时间点 */
    keyframes: number[];
    /** 场景描述（本地生成） */
    description?: string;
    /** 分析时间戳 */
    analyzedAt: number;
}
/** 批量分析报告 */
export interface AnalysisReport {
    id: string;
    /** 分析的媒体文件列表 */
    mediaPaths: string[];
    /** 各场景分析结果 */
    scenes: SceneAnalysis[];
    /** 总体统计 */
    stats: AnalysisStats;
    /** 生成时间 */
    generatedAt: number;
}
/** 分析统计 */
export interface AnalysisStats {
    /** 总场景数 */
    totalScenes: number;
    /** 各类型场景数量 */
    sceneTypeCounts: Record<AutomationSceneType, number>;
    /** 平均质量分 */
    averageQuality: number;
    /** 最低质量分 */
    minQuality: number;
    /** 最高质量分 */
    maxQuality: number;
    /** 低质量场景列表 */
    lowQualityScenes: string[];
    /** 总时长（秒） */
    totalDuration: number;
    /** 最常见标签 */
    topTags: Array<{
        tag: string;
        count: number;
    }>;
}
/** 场景检测配置 */
export interface SceneDetectionConfig {
    /** 场景切换阈值 0-1，越高越不敏感 */
    threshold: number;
    /** 最小场景时长（秒） */
    minSceneDuration: number;
    /** 是否检测黑场 */
    detectBlackFrames: boolean;
    /** 黑场亮度阈值 */
    blackFrameThreshold: number;
    /** 是否检测静态帧 */
    detectStaticFrames: boolean;
    /** 静态帧相似度阈值 */
    staticFrameThreshold: number;
}
/** 质量评估配置 */
export interface AutomationQualityAssessmentConfig {
    /** 是否评估清晰度 */
    assessSharpness: boolean;
    /** 是否评估曝光 */
    assessExposure: boolean;
    /** 是否评估色彩 */
    assessColor: boolean;
    /** 是否评估稳定性 */
    assessStability: boolean;
    /** 是否评估音频 */
    assessAudio: boolean;
    /** 低质量阈值 */
    lowQualityThreshold: number;
}
/** 分析器配置 */
export interface SceneAnalyzerConfig {
    sceneDetection: SceneDetectionConfig;
    qualityAssessment: AutomationQualityAssessmentConfig;
    /** 是否生成标签 */
    generateTags: boolean;
    /** 是否生成描述 */
    generateDescriptions: boolean;
    /** 最大并发分析数 */
    maxConcurrent: number;
}
/** 创建默认场景检测配置 */
export declare function createDefaultSceneDetectionConfig(): SceneDetectionConfig;
/** 创建默认质量评估配置 */
export declare function createDefaultAutomationQualityAssessmentConfig(): AutomationQualityAssessmentConfig;
/** 创建默认分析器配置 */
export declare function createDefaultAnalyzerConfig(): SceneAnalyzerConfig;
/** 创建默认质量指标 */
export declare function createDefaultQualityMetrics(): SceneQualityMetrics;
/** 创建空的分析结果 */
export declare function createEmptySceneAnalysis(mediaPath: string): SceneAnalysis;
/** 计算综合质量分 */
export declare function calculateOverallQuality(metrics: Omit<SceneQualityMetrics, 'overall'>): number;
/** 判断是否为低质量场景 */
export declare function isLowQuality(quality: SceneQualityMetrics, threshold?: number): boolean;
/** 生成质量等级 */
export declare function getQualityGrade(score: number): 'excellent' | 'good' | 'fair' | 'poor' | 'terrible';
/** 质量等级中文名 */
export declare function getQualityGradeLabel(grade: ReturnType<typeof getQualityGrade>): string;
/** 预定义标签类别 */
export declare const TAG_CATEGORIES: {
    readonly mood: readonly ["欢乐", "悲伤", "紧张", "平静", "激动", "浪漫", "严肃", "幽默"];
    readonly content: readonly ["人物", "动物", "自然", "建筑", "交通", "食物", "文字", "图标"];
    readonly lighting: readonly ["明亮", "暗淡", "逆光", "侧光", "自然光", "人工光", "暖色调", "冷色调"];
    readonly motion: readonly ["静态", "缓慢", "快速", "跟踪", "摇移", "变焦"];
};
/** 根据场景类型生成默认标签 */
export declare function generateDefaultTags(sceneType: AutomationSceneType): ContentTag[];
/** 从场景分析结果生成统计 */
export declare function generateAnalysisStats(scenes: SceneAnalysis[]): AnalysisStats;
/** 生成分析报告 */
export declare function generateAnalysisReport(mediaPaths: string[], scenes: SceneAnalysis[]): AnalysisReport;
/** 分析进度回调 */
export type AnalysisProgressCallback = (progress: {
    current: number;
    total: number;
    currentFile: string;
    phase: 'detecting' | 'analyzing' | 'tagging' | 'complete';
}) => void;
/**
 * 智能场景分析器
 * 提供场景检测、质量评估、标签生成等功能
 */
export declare class SceneAnalyzer {
    private config;
    private analysisHistory;
    constructor(config?: Partial<SceneAnalyzerConfig>);
    /** 更新配置 */
    updateConfig(config: Partial<SceneAnalyzerConfig>): void;
    /** 获取配置 */
    getConfig(): SceneAnalyzerConfig;
    /**
     * 分析单个场景
     * 注意：实际的帧分析需要通过 Worker 或外部工具完成
     * 这里提供分析流程编排和结果处理
     */
    analyzeScene(mediaPath: string, startTime: number, endTime: number, frameData?: {
        brightness?: number[];
        motionVectors?: number[];
        audioLevels?: number[];
    }): Promise<SceneAnalysis>;
    /**
     * 批量分析媒体文件
     */
    analyzeBatch(mediaItems: Array<{
        path: string;
        duration: number;
        frameData?: {
            brightness?: number[];
            motionVectors?: number[];
            audioLevels?: number[];
        };
    }>, onProgress?: AnalysisProgressCallback): Promise<AnalysisReport>;
    /** 获取媒体的分析历史 */
    getAnalysisHistory(mediaPath: string): SceneAnalysis[];
    /** 清除分析历史 */
    clearHistory(mediaPath?: string): void;
    /** 检测场景类型 */
    private detectAutomationSceneType;
    /** 评估质量 */
    private assessQuality;
    /** 检测场景边界 */
    private detectSceneBoundaries;
    /** 检测关键帧 */
    private detectKeyframes;
    /** 计算方差 */
    private calculateVariance;
}
//# sourceMappingURL=scene-analyzer.d.ts.map
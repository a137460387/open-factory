/**
 * AI 视频质量评估模块
 *
 * 功能：
 * 1. 视频质量评估 - 基于拉普拉斯方差的锐度检测、噪声估计、曝光分析、色彩平衡
 * 2. 音频质量评估 - RMS 电平、峰值检测、噪声底、动态范围、削波与失真检测
 * 3. 单帧质量评分 - 逐帧分析锐度、噪声、曝光并给出综合评分
 * 4. 综合评分与分级 - 多维度加权评分，S/A/B/C/D/F 等级映射
 * 5. 优化建议生成 - 基于评分维度自动生成可操作的优化建议
 * 6. 质量对比 - 两组评估结果的逐维度对比，识别改善与退化
 * 7. 质量配置文件 - broadcast/web/social/cinema/archive 预设
 * 8. AI 提示构建与响应解析 - 构建系统/用户提示并安全解析 AI 返回的 JSON
 *
 * 所有函数均为纯计算，无副作用。
 */
import type { AiModuleResult, TranslateFn } from '../ai-module-types';
/**
 * 视频质量指标
 */
export interface VideoQualityMetrics {
    /** 锐度 (0-100)，值越高越清晰 */
    sharpness: number;
    /** 噪声水平 (0-100)，值越低越干净 */
    noise: number;
    /** 曝光质量 (0-100)，值越高曝光越合理 */
    exposure: number;
    /** 对比度 (0-100) */
    contrast: number;
    /** 饱和度 (0-100) */
    saturation: number;
    /** 色彩平衡 (0-100)，值越高白平衡越准确 */
    colorBalance: number;
    /** 稳定性 (0-100)，值越高画面越稳定 */
    stability: number;
    /** 码率 (kbps) */
    bitrate: number;
    /** 分辨率宽度 (像素) */
    resolution: {
        width: number;
        height: number;
    };
    /** 帧率 (fps) */
    frameRate: number;
}
/**
 * 音频质量指标
 */
export interface AudioQualityMetrics {
    /** RMS 电平 (dB) */
    rmsLevel: number;
    /** 峰值电平 (dB) */
    peakLevel: number;
    /** 噪声底 (dB)，值越低越安静 */
    noiseFloor: number;
    /** 动态范围 (dB) */
    dynamicRange: number;
    /** 是否存在削波 */
    clipping: boolean;
    /** 失真程度 (0-100)，0 表示无失真 */
    distortion: number;
    /** 频率平衡评分 (0-100) */
    frequencyBalance: number;
}
/**
 * 单帧质量评分
 */
export interface FrameQualityScore {
    /** 帧序号 */
    frameIndex: number;
    /** 时间戳 (秒) */
    timestamp: number;
    /** 锐度评分 (0-100) */
    sharpness: number;
    /** 噪声评分 (0-100)，值越高表示越干净 */
    noise: number;
    /** 曝光评分 (0-100) */
    exposure: number;
    /** 综合评分 (0-100) */
    overallScore: number;
}
/**
 * 质量评估维度
 */
export type QualityDimension = 'sharpness' | 'noise' | 'exposure' | 'contrast' | 'saturation' | 'color-balance' | 'stability' | 'audio-level' | 'audio-noise' | 'bitrate';
/**
 * 维度评分
 */
export interface QualityDimensionScore {
    /** 评估维度 */
    dimension: QualityDimension;
    /** 评分 (0-100) */
    score: number;
    /** 权重 (0-1) */
    weight: number;
    /** 该维度存在的问题列表 */
    issues: string[];
    /** 优化建议 */
    suggestion: string;
}
/**
 * 质量阈值配置
 */
export interface QualityThresholds {
    /** 优秀阈值 (默认 90) */
    excellent: number;
    /** 良好阈值 (默认 75) */
    good: number;
    /** 可接受阈值 (默认 60) */
    acceptable: number;
    /** 较差阈值 (默认 40) */
    poor: number;
}
/**
 * 质量评估配置
 */
export interface QualityAssessmentConfig {
    /** 需要评估的维度列表 */
    dimensions: QualityDimension[];
    /** 各维度权重，键为维度名，值为权重 (0-1) */
    weights: Partial<Record<QualityDimension, number>>;
    /** 采样帧数 (默认 10) */
    sampleCount: number;
    /** 是否启用逐帧分析 */
    enableFrameAnalysis: boolean;
    /** 是否启用音频分析 */
    enableAudioAnalysis: boolean;
    /** 是否启用 GPU 加速 */
    gpuAccelerated: boolean;
    /** 质量阈值配置 */
    qualityThresholds: QualityThresholds;
}
/**
 * 质量等级
 */
export type EnhancedQualityGrade = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
/**
 * 质量问题
 */
export interface QualityIssue {
    /** 问题类型 */
    type: string;
    /** 严重程度 */
    severity: 'low' | 'medium' | 'high' | 'critical';
    /** 所属维度 */
    dimension: QualityDimension;
    /** 问题描述 */
    description: string;
    /** 受影响的时间范围 (秒)，[start, end] */
    affectedRange?: [number, number];
    /** 建议的修复方式 */
    suggestedFix: string;
}
/**
 * 优化建议
 */
export interface QualitySuggestion {
    /** 建议 ID */
    id: string;
    /** 所属维度 */
    dimension: QualityDimension;
    /** 操作描述 */
    action: string;
    /** 预期改善 (0-100) */
    expectedImprovement: number;
    /** 优先级 */
    priority: 'low' | 'medium' | 'high' | 'critical';
    /** 是否可自动应用 */
    autoApplicable: boolean;
    /** 自动应用时的参数 */
    params?: Record<string, number | boolean>;
}
/**
 * 质量评估结果
 */
export interface EnhancedQualityAssessmentResult {
    /** 综合评分 (0-100) */
    overallScore: number;
    /** 视频质量指标 */
    videoMetrics: VideoQualityMetrics;
    /** 音频质量指标 */
    audioMetrics: AudioQualityMetrics;
    /** 各维度评分 */
    dimensionScores: QualityDimensionScore[];
    /** 逐帧质量评分 */
    frameScores: FrameQualityScore[];
    /** 检测到的问题 */
    issues: QualityIssue[];
    /** 优化建议 */
    suggestions: QualitySuggestion[];
    /** 质量等级 */
    grade: EnhancedQualityGrade;
    /** 处理耗时 (毫秒) */
    processingTimeMs: number;
}
/**
 * 质量对比结果
 */
export interface QualityComparisonResult {
    /** 基准评估结果 */
    baseline: EnhancedQualityAssessmentResult;
    /** 对比评估结果 */
    comparison: EnhancedQualityAssessmentResult;
    /** 改善的维度列表 */
    improvements: Array<{
        dimension: QualityDimension;
        before: number;
        after: number;
        delta: number;
    }>;
    /** 退化的维度列表 */
    regressions: Array<{
        dimension: QualityDimension;
        before: number;
        after: number;
        delta: number;
    }>;
    /** 综合改善幅度 (正数为改善，负数为退化) */
    overallImprovement: number;
    /** 建议文案 */
    recommendation: string;
}
/**
 * 质量配置文件类型
 */
export type QualityProfile = 'broadcast' | 'web' | 'social' | 'cinema' | 'archive';
/**
 * 计算图像锐度（拉普拉斯方差法）
 *
 * 使用 3x3 拉普拉斯算子对亮度通道做卷积，然后计算方差。
 * 方差越大表示图像边缘越丰富、越清晰。
 *
 * @param frame - RGBA 扁平像素数组
 * @param width - 图像宽度（像素）
 * @param height - 图像高度（像素）
 * @returns 锐度值 (0-100)
 */
export declare function computeImageSharpness(frame: Uint8Array, width: number, height: number): number;
/**
 * 估计噪声水平
 *
 * 使用拉普拉斯算子的 MAD（中值绝对偏差）估计高斯噪声标准差。
 * 噪声越高表示画面越不干净。
 *
 * @param frame - RGBA 扁平像素数组
 * @param width - 图像宽度（像素）
 * @param height - 图像高度（像素）
 * @returns 噪声水平 (0-100)，值越高噪声越大
 */
export declare function estimateNoiseLevel(frame: Uint8Array, width: number, height: number): number;
/**
 * 分析曝光
 *
 * 计算图像的平均亮度、过曝像素比例和欠曝像素比例。
 * 过曝定义为亮度 > 245，欠曝定义为亮度 < 10。
 *
 * @param frame - RGBA 扁平像素数组
 * @returns { mean, overexposed, underexposed } 平均亮度 (0-255)、过曝比例 (0-1)、欠曝比例 (0-1)
 */
export declare function analyzeExposure(frame: Uint8Array): {
    mean: number;
    overexposed: number;
    underexposed: number;
};
/**
 * 计算色彩平衡（白平衡）
 *
 * 计算图像各颜色通道的平均值，用于判断白平衡是否偏移。
 * 理想白平衡下 R/G/B 均值应接近相等。
 *
 * @param frame - RGBA 扁平像素数组
 * @param width - 图像宽度（像素）
 * @param height - 图像高度（像素）
 * @returns { r, g, b } 各通道平均亮度 (0-255)
 */
export declare function computeColorBalance(frame: Uint8Array, width: number, height: number): {
    r: number;
    g: number;
    b: number;
};
/**
 * 分数转质量等级
 *
 * @param score - 综合评分 (0-100)
 * @returns 质量等级 S/A/B/C/D/F
 */
export declare function mapScoreToEnhancedGrade(score: number): EnhancedQualityGrade;
/**
 * 维度分数转等级文字
 *
 * @param score - 维度评分 (0-100)
 * @returns 等级文字
 */
export declare function dimensionScoreToGrade(score: number): 'excellent' | 'good' | 'acceptable' | 'poor';
/**
 * 评估视频质量
 *
 * 从多帧中采样，计算锐度、噪声、曝光、对比度、饱和度、色彩平衡和稳定性。
 * 每个指标取多帧的平均值或统计值。
 *
 * @param frames - RGBA 扁平像素数组的列表，每个元素为一帧
 * @param config - 质量评估配置
 * @returns 视频质量指标
 */
export declare function assessVideoQuality(frames: Uint8Array[], config: QualityAssessmentConfig): VideoQualityMetrics;
/**
 * 评估音频质量
 *
 * 分析音频信号的 RMS 电平、峰值、噪声底、动态范围、削波检测和失真估计。
 *
 * @param audioData - 音频采样数据 (-1.0 ~ 1.0)
 * @param sampleRate - 采样率 (Hz)
 * @param config - 质量评估配置
 * @returns 音频质量指标
 */
export declare function assessAudioQuality(audioData: Float32Array, sampleRate: number, config: QualityAssessmentConfig): AudioQualityMetrics;
/**
 * 评估单帧质量
 *
 * 计算单帧的锐度、噪声和曝光质量，并给出综合评分。
 *
 * @param frame - RGBA 扁平像素数组
 * @param width - 图像宽度（像素）
 * @param height - 图像高度（像素）
 * @returns 单帧质量评分
 */
export declare function assessFrameQuality(frame: Uint8Array, width: number, height: number): FrameQualityScore;
/**
 * 综合评分
 *
 * 根据视频指标、音频指标和配置，计算各维度加权得分并生成评估结果。
 *
 * @param metrics - 视频质量指标
 * @param audioMetrics - 音频质量指标
 * @param config - 质量评估配置
 * @returns 质量评估结果
 */
export declare function computeQualityScore(metrics: VideoQualityMetrics, audioMetrics: AudioQualityMetrics, config: QualityAssessmentConfig): EnhancedQualityAssessmentResult;
/**
 * 生成优化建议
 *
 * 根据评估结果，为每个低分维度生成具体的优化建议。
 *
 * @param result - 质量评估结果
 * @returns 优化建议列表，按优先级排序
 */
export declare function generateOptimizationSuggestions(result: EnhancedQualityAssessmentResult): QualitySuggestion[];
/**
 * 质量对比
 *
 * 对比两组评估结果，识别改善和退化的维度，给出综合建议。
 *
 * @param baseline - 基准评估结果
 * @param comparison - 对比评估结果
 * @returns 质量对比结果
 */
export declare function compareQuality(baseline: EnhancedQualityAssessmentResult, comparison: EnhancedQualityAssessmentResult): QualityComparisonResult;
/**
 * 应用质量配置文件
 *
 * 根据预设的使用场景（广播、网络、社交媒体、影院、归档）生成对应的评估配置。
 *
 * @param profile - 质量配置文件类型
 * @returns 质量评估配置
 */
export declare function applyQualityProfile(profile: QualityProfile): QualityAssessmentConfig;
/**
 * 创建默认质量评估配置
 *
 * @returns 默认配置
 */
export declare function createDefaultQualityAssessmentConfig(): QualityAssessmentConfig;
/**
 * 验证质量评估配置
 *
 * 检查配置的合法性：维度非空、权重范围正确、采样数合理、阈值单调递减。
 *
 * @param config - 待验证的配置
 * @returns 是否合法
 */
export declare function validateQualityAssessmentConfig(config: QualityAssessmentConfig): boolean;
/**
 * 构建 AI 质量评估系统提示
 *
 * 生成指导 AI 进行视频质量评估的系统提示词，包含评估维度、
 * 评分标准和输出格式说明。
 *
 * @param profile - 可选的质量配置文件，影响评估侧重点
 * @returns 系统提示字符串
 */
export declare function buildEnhancedQualitySystemPrompt(profile?: QualityProfile): string;
/**
 * 构建 AI 质量评估用户提示
 *
 * 将视频和音频指标格式化为用户提示，供 AI 分析。
 *
 * @param metrics - 视频质量指标
 * @param audioMetrics - 音频质量指标
 * @returns 用户提示字符串
 */
export declare function buildEnhancedQualityUserPrompt(metrics: VideoQualityMetrics, audioMetrics: AudioQualityMetrics): string;
/**
 * 解析增强型质量评估 AI 响应
 *
 * 从 AI 返回的 JSON 中提取并校验质量评估结果。
 *
 * @param json - AI 返回的原始 JSON 数据
 * @returns 质量评估结果
 */
export declare function parseEnhancedQualityResponse(json: unknown): EnhancedQualityAssessmentResult;
/**
 * 安全解析增强型质量评估 AI 响应
 *
 * 包装 parseEnhancedQualityResponse，在解析失败时返回错误信息而非抛出异常。
 *
 * @param json - AI 返回的原始 JSON 数据
 * @param t - 可选的翻译函数
 * @returns 包装在 AiModuleResult 中的质量评估结果
 */
export declare function parseEnhancedQualityResponseSafe(json: unknown, t?: TranslateFn): Promise<AiModuleResult<EnhancedQualityAssessmentResult>>;
//# sourceMappingURL=quality-assessment.d.ts.map
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
export type { VideoQualityMetrics, AudioQualityMetrics, FrameQualityScore, QualityDimension, QualityDimensionScore, QualityThresholds, QualityAssessmentConfig, EnhancedQualityGrade, QualityIssue, QualitySuggestion, EnhancedQualityAssessmentResult, QualityComparisonResult, QualityProfile, } from './quality-assessment-types.js';
import type { VideoQualityMetrics, AudioQualityMetrics, FrameQualityScore, QualityAssessmentConfig, EnhancedQualityGrade, QualitySuggestion, EnhancedQualityAssessmentResult, QualityComparisonResult, QualityProfile } from './quality-assessment-types.js';
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
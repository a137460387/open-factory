/** 噪声频谱分析结果 */
export interface NoiseProfile {
    humScore: number;
    hissScore: number;
    windScore: number;
    snrEstimate: number;
}
/** 单个降噪滤镜推荐 */
export interface DenoiseFilterRecommendation {
    filter: 'afftdn' | 'highpass' | 'lowpass' | 'anlmdn';
    params: Record<string, number | string>;
    reason: string;
}
/** AI降噪推荐响应 */
export interface AIDenoiseResponse {
    recommendedFilters: DenoiseFilterRecommendation[];
    confidence: number;
}
/** 轨道级降噪推荐数据 */
export interface AIDenoiseRecommendation {
    noiseProfile: NoiseProfile;
    recommendedFilters: DenoiseFilterRecommendation[];
    appliedFilters: string[];
    generatedAt: string;
}
/**
 * 对音频样本做简化DFT频率分析，返回指定频率范围的归一化能量。
 * 使用Goertzel算法高效计算单个频率点的能量。
 */
export declare function analyzeFrequencyBand(samples: Float32Array, sampleRate: number, freqHz: number, bandwidthHz?: number): number;
/**
 * 计算宽带能量：对频率范围内多个采样点取平均。
 */
export declare function analyzeBroadbandEnergy(samples: Float32Array, sampleRate: number, lowFreq: number, highFreq: number, binCount?: number): number;
/**
 * 估算信噪比（SNR）：用信号区间的RMS与静音区间RMS的比值。
 */
export declare function estimateSNR(signalSamples: Float32Array, noiseSamples: Float32Array): number;
/**
 * 对噪声样本窗口进行频谱分析，分类噪声类型并生成噪声画像。
 */
export declare function classifyNoiseProfile(noiseSamples: Float32Array, sampleRate: number, signalSamples?: Float32Array): NoiseProfile;
/**
 * 根据噪声画像推荐FFmpeg降噪滤镜参数。
 */
export declare function recommendDenoiseFilters(profile: NoiseProfile): DenoiseFilterRecommendation[];
/**
 * 解析AI返回的降噪推荐响应。
 */
export declare function parseDenoiseAiResponse(json: unknown): AIDenoiseResponse;
/**
 * 构建FFmpeg降噪滤镜链字符串。
 */
export declare function buildDenoiseFilterChain(filters: DenoiseFilterRecommendation[]): string;
/**
 * 为每个推荐滤镜生成FFmpeg参数数组（用于Command::new("ffmpeg")风格调用）。
 */
export declare function buildDenoiseFfmpegArgs(filters: DenoiseFilterRecommendation[]): string[];
/**
 * 创建默认的AIDenoiseRecommendation对象。
 */
export declare function createDenoiseRecommendation(noiseProfile: NoiseProfile, recommendedFilters: DenoiseFilterRecommendation[]): AIDenoiseRecommendation;
/**
 * 规范化AIDenoiseRecommendation，处理旧项目兼容。
 */
export declare function normalizeAIDenoiseRecommendation(input: Partial<AIDenoiseRecommendation> | undefined): AIDenoiseRecommendation | undefined;
//# sourceMappingURL=ai-denoise-recommendation.d.ts.map
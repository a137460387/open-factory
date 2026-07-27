/**
 * GPU 加速色彩处理模块
 *
 * 功能：
 * 1. GPU 后端抽象 - 支持 WebGPU / WebGL2 双后端
 * 2. 3D LUT GPU 加速 - 通过纹理采样实现高性能 LUT 应用
 * 3. 色彩校正 GPU 管线 - Lift/Gamma/Gain/Offset 着色器
 * 4. 色调映射 GPU 加速 - 多种色调映射算法
 * 5. 多分辨率预览 - 1080p / 4K 自适应
 * 6. 预览缓存 - 参数哈希缓存机制
 * 7. 性能监控 - 帧时间、GPU 内存统计
 */
import type { PrimaryWheelParams, PrimarySliderParams } from '../color-grading/types';
import type { ToneMappingMethod, ColorSpace } from './aces';
/** GPU 后端类型 */
export type GPUBackend = 'webgpu' | 'webgl2' | 'cpu-fallback';
/** 预览分辨率 */
export type PreviewResolution = '720p' | '1080p' | '1440p' | '4k';
/** 分辨率配置 */
export interface ResolutionConfig {
    width: number;
    height: number;
    label: string;
}
/** GPU 设备信息 */
export interface GPUDeviceInfo {
    backend: GPUBackend;
    vendor: string;
    renderer: string;
    maxTextureSize: number;
    maxComputeWorkgroupSize: [number, number, number];
    supportsWebGPU: boolean;
    supportsWebGL2: boolean;
    vramEstimateMB: number;
}
/** 性能统计 */
export interface GPUPerformanceStats {
    frameTimeMs: number;
    gpuTimeMs: number;
    uploadTimeMs: number;
    downloadTimeMs: number;
    textureMemoryMB: number;
    bufferMemoryMB: number;
    framesRendered: number;
    cacheHits: number;
    cacheMisses: number;
}
/** 3D LUT GPU 数据 */
export interface GPU3DLUTData {
    size: number;
    data: Float32Array;
    textureId: string;
    format: 'rgb' | 'rgba';
}
/** 色彩校正参数 */
export interface GPUColorCorrectionParams {
    lift: {
        r: number;
        g: number;
        b: number;
    };
    liftMaster: number;
    gamma: {
        r: number;
        g: number;
        b: number;
    };
    gammaMaster: number;
    gain: {
        r: number;
        g: number;
        b: number;
    };
    gainMaster: number;
    offset: {
        r: number;
        g: number;
        b: number;
    };
    offsetMaster: number;
    temperature: number;
    tint: number;
    contrast: number;
    pivot: number;
    saturation: number;
    hueRotation: number;
}
/** 色调映射参数 */
export interface GPUToneMappingParams {
    method: ToneMappingMethod;
    exposure: number;
    whitePoint: number;
    shoulderStrength: number;
    linearStrength: number;
    linearAngle: number;
    toeStrength: number;
    toeNumerator: number;
    toeDenominator: number;
    linearWhitePoint: number;
}
/** GPU 处理管线配置 */
export interface GPUPipelineConfig {
    backend: GPUBackend;
    resolution: PreviewResolution;
    enableLUT: boolean;
    enableColorCorrection: boolean;
    enableToneMapping: boolean;
    enableCache: boolean;
    maxCacheSize: number;
    maxCacheBytes: number;
    inputColorSpace: ColorSpace;
    outputColorSpace: ColorSpace;
    hdrEnabled: boolean;
    hdrPeakLuminance: number;
}
/** GPU 处理结果 */
export interface GPUProcessResult {
    outputData: Uint8ClampedArray;
    width: number;
    height: number;
    processingTimeMs: number;
    fromCache: boolean;
    backend: GPUBackend;
}
/** 管线回调 */
export type GPUStatusCallback = (status: GPUDeviceStatus) => void;
/** 设备状态 */
export interface GPUDeviceStatus {
    available: boolean;
    backend: GPUBackend;
    message: string;
}
export declare const RESOLUTION_PRESETS: Record<PreviewResolution, ResolutionConfig>;
/** 计算参数哈希用于缓存键 */
export declare function computeParamsHash(params: Record<string, unknown>): string;
/** 生成处理管线缓存键 */
export declare function buildPipelineCacheKey(imageDataHash: string, colorCorrection: GPUColorCorrectionParams | null, toneMapping: GPUToneMappingParams | null, lutId: string | null, resolution: PreviewResolution): string;
/** 创建默认色彩校正参数 */
export declare function createDefaultColorCorrectionParams(): GPUColorCorrectionParams;
/** 创建默认色调映射参数 */
export declare function createDefaultToneMappingParams(): GPUToneMappingParams;
/** 创建默认管线配置 */
export declare function createDefaultPipelineConfig(): GPUPipelineConfig;
/** 验证色彩校正参数 */
export declare function validateGPUColorCorrectionParams(params: GPUColorCorrectionParams): GPUColorCorrectionParams;
/** 验证色调映射参数 */
export declare function validateGPUToneMappingParams(params: GPUToneMappingParams): GPUToneMappingParams;
/** 验证管线配置 */
export declare function validateGPUPipelineConfig(config: GPUPipelineConfig): GPUPipelineConfig;
/** 从 PrimaryWheelParams + PrimarySliderParams 转换为 GPUColorCorrectionParams */
export declare function fromPrimaryWheelAndSliders(wheels: PrimaryWheelParams, sliders: PrimarySliderParams): GPUColorCorrectionParams;
/** 生成完整的 GPU 色彩处理片段着色器 */
export declare function generateColorProcessingFragmentShader(): string;
/** 生成顶点着色器 */
export declare function generateVertexShader(): string;
/** 生成 WebGPU 计算着色器 (WGSL) */
export declare function generateWebGPUComputeShader(): string;
/** CPU 回退：应用 Lift/Gamma/Gain/Offset */
export declare function cpuApplyLiftGammaGain(r: number, g: number, b: number, params: GPUColorCorrectionParams): [number, number, number];
/** CPU 回退：应用色温/色调 */
export declare function cpuApplyTemperatureTint(r: number, g: number, b: number, temperature: number, tint: number): [number, number, number];
/** CPU 回退：应用对比度 */
export declare function cpuApplyContrast(r: number, g: number, b: number, contrast: number, pivot: number): [number, number, number];
/** CPU 回退：应用饱和度 */
export declare function cpuApplySaturation(r: number, g: number, b: number, saturation: number): [number, number, number];
/** CPU 回退：色调映射 - ACES Hill */
export declare function cpuToneMapAcesHill(r: number, g: number, b: number): [number, number, number];
/** CPU 回退：色调映射 - Reinhard */
export declare function cpuToneMapReinhard(r: number, g: number, b: number): [number, number, number];
/** CPU 回退：色调映射 - Filmic */
export declare function cpuToneMapFilmic(r: number, g: number, b: number): [number, number, number];
/** CPU 回退：色调映射 */
export declare function cpuApplyToneMapping(r: number, g: number, b: number, method: ToneMappingMethod, exposure: number): [number, number, number];
/** CPU 回退：3D LUT 三线性插值 */
export declare function cpuApply3DLUT(r: number, g: number, b: number, lutData: GPU3DLUTData, intensity: number): [number, number, number];
/** CPU 回退：完整色彩处理管线 */
export declare function cpuProcessPixel(r: number, g: number, b: number, colorCorrection: GPUColorCorrectionParams | null, toneMapping: GPUToneMappingParams | null, lutData: GPU3DLUTData | null, lutIntensity: number): [number, number, number];
/** 处理整帧图像数据 (CPU 回退) */
export declare function cpuProcessFrame(input: Uint8ClampedArray, width: number, height: number, colorCorrection: GPUColorCorrectionParams | null, toneMapping: GPUToneMappingParams | null, lutData: GPU3DLUTData | null, lutIntensity: number): Uint8ClampedArray;
/**
 * GPU 色彩处理器
 *
 * 提供 GPU 加速的色彩处理管线。支持 WebGPU / WebGL2 双后端，
 * 自动回退到 CPU 处理。包含 LRU 缓存和性能监控。
 */
export declare class GPUColorProcessor {
    private config;
    private deviceInfo;
    private cache;
    private cacheUsedBytes;
    private performanceHistory;
    private stats;
    private statusListeners;
    private currentBackend;
    private initialized;
    private webglCanvas;
    private webglContext;
    constructor(config?: Partial<GPUPipelineConfig>);
    /** 获取当前配置 */
    getConfig(): GPUPipelineConfig;
    /** 更新配置 */
    updateConfig(patch: Partial<GPUPipelineConfig>): void;
    /** 获取当前后端 */
    getBackend(): GPUBackend;
    /** 获取设备信息 */
    getDeviceInfo(): GPUDeviceInfo | null;
    /** 获取性能统计 */
    getPerformanceStats(): GPUPerformanceStats;
    /** 注册状态回调 */
    onStatusChange(callback: GPUStatusCallback): () => void;
    /** 初始化 GPU 设备 */
    initialize(): Promise<GPUDeviceInfo>;
    /** 处理图像帧 */
    processFrame(input: Uint8ClampedArray, width: number, height: number, colorCorrection?: GPUColorCorrectionParams | null, toneMapping?: GPUToneMappingParams | null, lutData?: GPU3DLUTData | null, lutIntensity?: number): Promise<GPUProcessResult>;
    /** 清除缓存 */
    clearCache(): void;
    /** 销毁处理器 */
    dispose(): void;
    private createEmptyStats;
    private recordFrameTime;
    private addToCache;
    private notifyStatus;
}
/**
 * 预览帧缓存
 *
 * 管理多分辨率预览帧的缓存，支持参数变化时的增量更新。
 */
export declare class PreviewFrameCache {
    private entries;
    private maxEntries;
    private ttlMs;
    constructor(maxEntries?: number, ttlMs?: number);
    /** 获取缓存帧 */
    get(key: string): {
        data: Uint8ClampedArray;
        width: number;
        height: number;
    } | null;
    /** 设置缓存帧 */
    set(key: string, data: Uint8ClampedArray, width: number, height: number): void;
    /** 清除过期条目 */
    evict(): number;
    /** 清除所有缓存 */
    clear(): void;
    /** 获取缓存大小 */
    size(): number;
}
/**
 * GPU 性能监控器
 *
 * 跟踪帧时间、GPU 利用率和内存使用。
 */
export declare class GPUPerformanceMonitor {
    private frameTimes;
    private gpuTimes;
    private maxSamples;
    constructor(maxSamples?: number);
    /** 记录一帧 */
    recordFrame(frameTimeMs: number, gpuTimeMs: number): void;
    /** 获取平均帧时间 */
    getAverageFrameTime(): number;
    /** 获取 P95 帧时间 */
    getP95FrameTime(): number;
    /** 获取预估 FPS */
    getEstimatedFPS(): number;
    /** 获取平均 GPU 时间 */
    getAverageGPUTime(): number;
    /** 获取 GPU 利用率估算 (0-1) */
    getGPUUtilization(): number;
    /** 重置统计 */
    reset(): void;
    /** 获取完整报告 */
    getReport(): {
        avgFrameTimeMs: number;
        p95FrameTimeMs: number;
        avgGpuTimeMs: number;
        estimatedFPS: number;
        gpuUtilization: number;
        sampleCount: number;
    };
}
//# sourceMappingURL=gpu-color-processing.d.ts.map
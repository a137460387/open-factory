/**
 * WebGPU 渲染引擎核心
 *
 * 提供完整的 WebGPU 渲染管线，支持：
 * - 视频帧 GPU 解码与上传
 * - 色彩校正、色调映射、LUT 应用
 * - 增量渲染与脏区域检测
 * - 智能代理切换
 * - 性能监控与统计
 */
import type { WebGPURenderPipelineConfig, WebGPUDeviceInfo, WebGPURenderStats, WebGPUDeviceStatus, WebGPUStatusCallback, FrameDecodeResult, ColorCorrectionParams, ToneMappingParams, LUT3DData, RenderQuality, ProxyStrategy } from './webgpu-types.js';
export declare class WebGPURenderEngine {
    private config;
    private device;
    private adapter;
    private context;
    private canvas;
    private frameCache;
    private prefetcher;
    private dirtyRegionManager;
    private deviceInfo;
    private status;
    private statusListeners;
    private stats;
    private colorPipeline;
    private colorBindGroupLayout;
    private colorParamsBuffer;
    private currentQuality;
    private currentProxyStrategy;
    constructor(config?: Partial<WebGPURenderPipelineConfig>);
    /**
     * 初始化 WebGPU 设备
     */
    initialize(canvas?: HTMLCanvasElement): Promise<WebGPUDeviceInfo>;
    private createRenderPipelines;
    /**
     * 上传视频帧到 GPU
     */
    uploadFrame(frame: number, bitmap: ImageBitmap, quality?: RenderQuality): Promise<FrameDecodeResult>;
    /**
     * 渲染帧到画布
     */
    renderFrame(frameResult: FrameDecodeResult, colorCorrection?: ColorCorrectionParams, toneMapping?: ToneMappingParams, lutData?: LUT3DData, lutIntensity?: number): Promise<void>;
    private buildColorParams;
    private getToneMappingMethodIndex;
    private createBindGroup;
    private createLUTTexture;
    private createEmptyStats;
    getStats(): WebGPURenderStats;
    getStatus(): WebGPUDeviceStatus;
    getDeviceInfo(): WebGPUDeviceInfo | null;
    onStatusChange(callback: WebGPUStatusCallback): () => void;
    private notifyStatus;
    getConfig(): WebGPURenderPipelineConfig;
    updateConfig(patch: Partial<WebGPURenderPipelineConfig>): void;
    setQuality(quality: RenderQuality): void;
    setProxyStrategy(strategy: ProxyStrategy): void;
    destroy(): void;
}
/**
 * 创建 WebGPU 渲染引擎实例
 */
export declare function createWebGPURenderEngine(config?: Partial<WebGPURenderPipelineConfig>): WebGPURenderEngine;
/**
 * 检测 WebGPU 支持情况
 */
export declare function detectWebGPUSupport(): Promise<{
    supported: boolean;
    adapterInfo?: GPUAdapterInfo;
    features?: string[];
    limits?: Record<string, number>;
}>;
//# sourceMappingURL=webgpu-render-engine-core.d.ts.map
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
import { DEFAULT_WEBGPU_CONFIG } from './webgpu-types.js';
import { FULLSCREEN_VERTEX_SHADER, COLOR_PROCESSING_FRAGMENT_SHADER } from './webgpu-shaders.js';
import { WebGPUFrameCacheManager } from './webgpu-frame-cache.js';
import { WebGPUPredictivePrefetcher } from './webgpu-prefetcher.js';
import { WebGPUDirtyRegionManager } from './webgpu-dirty-region.js';
import { logger } from '../utils/logger.js';
export class WebGPURenderEngine {
    config;
    device = null;
    adapter = null;
    context = null;
    canvas = null;
    frameCache;
    prefetcher;
    dirtyRegionManager;
    deviceInfo = null;
    status = 'uninitialized';
    statusListeners = new Set();
    stats;
    colorPipeline = null;
    colorBindGroupLayout = null;
    colorParamsBuffer = null;
    currentQuality = 'full';
    currentProxyStrategy = 'adaptive';
    constructor(config) {
        this.config = { ...DEFAULT_WEBGPU_CONFIG, ...config };
        this.frameCache = new WebGPUFrameCacheManager(this.config.maxCacheFrames, this.config.maxCacheBytes);
        this.prefetcher = new WebGPUPredictivePrefetcher();
        this.dirtyRegionManager = new WebGPUDirtyRegionManager(this.config.dirtyRegionBatchMs);
        this.stats = this.createEmptyStats();
    }
    // ==================== 初始化 ====================
    /**
     * 初始化 WebGPU 设备
     */
    async initialize(canvas) {
        if (this.status === 'ready' && this.deviceInfo) {
            return this.deviceInfo;
        }
        this.status = 'initializing';
        this.notifyStatus('initializing', '正在初始化 WebGPU...');
        try {
            // Check WebGPU support
            if (!navigator.gpu) {
                throw new Error('WebGPU not supported');
            }
            // Request adapter
            this.adapter = await navigator.gpu.requestAdapter({
                powerPreference: 'high-performance',
            });
            if (!this.adapter) {
                throw new Error('Failed to get WebGPU adapter');
            }
            // Request device
            const requiredFeatures = [];
            const requiredLimits = {};
            // Check for optional features
            if (this.adapter.features.has('texture-compression-bc')) {
                requiredFeatures.push('texture-compression-bc');
            }
            if (this.adapter.features.has('texture-compression-etc2')) {
                requiredFeatures.push('texture-compression-etc2');
            }
            this.device = await this.adapter.requestDevice({
                requiredFeatures,
                requiredLimits,
            });
            // Handle device lost
            this.device.lost.then((info) => {
                logger.error('WebGPU device lost:', info.message);
                this.status = 'lost';
                this.notifyStatus('lost', `设备丢失: ${info.message}`);
            });
            // Setup canvas if provided
            if (canvas) {
                this.canvas = canvas;
                this.context = canvas.getContext('webgpu');
                if (!this.context) {
                    throw new Error('Failed to get WebGPU context');
                }
                this.context.configure({
                    device: this.device,
                    format: navigator.gpu.getPreferredCanvasFormat(),
                    alphaMode: 'premultiplied',
                });
            }
            // Create render pipelines
            await this.createRenderPipelines();
            // Gather device info
            this.deviceInfo = {
                backend: 'webgpu',
                vendor: this.adapter.info?.vendor || 'unknown',
                renderer: this.adapter.info?.device || 'unknown',
                maxTextureSize: this.device.limits.maxTextureDimension2D,
                maxComputeWorkgroupSize: [
                    this.device.limits.maxComputeWorkgroupSizeX,
                    this.device.limits.maxComputeWorkgroupSizeY,
                    this.device.limits.maxComputeWorkgroupSizeZ,
                ],
                supportsWebGPU: true,
                supportsWebGL2: true,
                vramEstimateMB: 0,
                features: Array.from(this.adapter.features),
                limits: {
                    maxTextureDimension2D: this.device.limits.maxTextureDimension2D,
                    maxBufferSize: this.device.limits.maxBufferSize,
                    maxStorageBufferBindingSize: this.device.limits.maxStorageBufferBindingSize,
                },
            };
            this.status = 'ready';
            this.notifyStatus('ready', 'WebGPU 就绪');
            return this.deviceInfo;
        }
        catch (error) {
            this.status = 'error';
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.notifyStatus('error', `初始化失败: ${message}`);
            // Fallback to WebGL2 or CPU
            this.deviceInfo = {
                backend: 'cpu-fallback',
                vendor: 'cpu',
                renderer: 'cpu',
                maxTextureSize: 0,
                maxComputeWorkgroupSize: [0, 0, 0],
                supportsWebGPU: false,
                supportsWebGL2: false,
                vramEstimateMB: 0,
                features: [],
                limits: {},
            };
            return this.deviceInfo;
        }
    }
    // ==================== 渲染管线创建 ====================
    async createRenderPipelines() {
        if (!this.device) {
            throw new Error('Device not initialized');
        }
        // Create shader modules
        const vertexShaderModule = this.device.createShaderModule({
            code: FULLSCREEN_VERTEX_SHADER,
        });
        const fragmentShaderModule = this.device.createShaderModule({
            code: COLOR_PROCESSING_FRAGMENT_SHADER,
        });
        // Create bind group layout
        this.colorBindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: { sampleType: 'float' },
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: {},
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: { sampleType: 'float', viewDimension: '3d' },
                },
                {
                    binding: 3,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: { type: 'uniform' },
                },
            ],
        });
        // Create pipeline layout
        const pipelineLayout = this.device.createPipelineLayout({
            bindGroupLayouts: [this.colorBindGroupLayout],
        });
        // Create render pipeline
        this.colorPipeline = this.device.createRenderPipeline({
            layout: pipelineLayout,
            vertex: {
                module: vertexShaderModule,
                entryPoint: 'main',
            },
            fragment: {
                module: fragmentShaderModule,
                entryPoint: 'main',
                targets: [
                    {
                        format: navigator.gpu.getPreferredCanvasFormat(),
                    },
                ],
            },
            primitive: {
                topology: 'triangle-list',
            },
        });
        // Create uniform buffer for color correction params
        this.colorParamsBuffer = this.device.createBuffer({
            size: 256, // Size of ColorCorrectionParams struct
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
    }
    // ==================== 帧处理 ====================
    /**
     * 上传视频帧到 GPU
     */
    async uploadFrame(frame, bitmap, quality = 'full') {
        if (!this.device) {
            throw new Error('Device not initialized');
        }
        const start = performance.now();
        // Check cache first
        const cached = this.frameCache.get(frame);
        if (cached) {
            return cached;
        }
        // Create texture from bitmap
        const texture = this.device.createTexture({
            size: { width: bitmap.width, height: bitmap.height },
            format: 'rgba8unorm',
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
        });
        // Copy bitmap to texture
        this.device.queue.copyExternalImageToTexture({ source: bitmap }, { texture }, { width: bitmap.width, height: bitmap.height });
        const result = {
            frame,
            texture,
            bitmap,
            decodeTime: performance.now() - start,
            fromCache: false,
            quality,
        };
        // Estimate memory usage (4 bytes per pixel)
        const estimatedBytes = bitmap.width * bitmap.height * 4;
        this.frameCache.put(result, estimatedBytes);
        this.stats.framesRendered++;
        this.stats.uploadTimeMs += result.decodeTime;
        return result;
    }
    /**
     * 渲染帧到画布
     */
    async renderFrame(frameResult, colorCorrection, toneMapping, lutData, lutIntensity = 1.0) {
        if (!this.device || !this.context || !this.colorPipeline) {
            throw new Error('Device not initialized');
        }
        const start = performance.now();
        // Get current texture from canvas
        const outputTexture = this.context.getCurrentTexture();
        // Create command encoder
        const commandEncoder = this.device.createCommandEncoder();
        // Update color correction params
        if (this.colorParamsBuffer) {
            const params = this.buildColorParams(colorCorrection, toneMapping, lutIntensity);
            this.device.queue.writeBuffer(this.colorParamsBuffer, 0, params);
        }
        // Create bind group
        const bindGroup = this.createBindGroup(frameResult.texture, lutData);
        // Begin render pass
        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [
                {
                    view: outputTexture.createView(),
                    loadOp: 'clear',
                    storeOp: 'store',
                    clearValue: { r: 0, g: 0, b: 0, a: 1 },
                },
            ],
        });
        renderPass.setPipeline(this.colorPipeline);
        renderPass.setBindGroup(0, bindGroup);
        renderPass.draw(6, 1, 0, 0);
        renderPass.end();
        // Submit commands
        this.device.queue.submit([commandEncoder.finish()]);
        // Wait for completion
        await this.device.queue.onSubmittedWorkDone();
        const elapsed = performance.now() - start;
        this.stats.frameTimeMs = elapsed;
        this.stats.gpuTimeMs += elapsed;
    }
    // ==================== 辅助方法 ====================
    buildColorParams(colorCorrection, toneMapping, lutIntensity = 1.0) {
        const params = new Float32Array(64); // 256 bytes / 4
        if (colorCorrection) {
            // Lift
            params[0] = colorCorrection.lift.r;
            params[1] = colorCorrection.lift.g;
            params[2] = colorCorrection.lift.b;
            params[3] = colorCorrection.liftMaster;
            // Gamma
            params[4] = colorCorrection.gamma.r;
            params[5] = colorCorrection.gamma.g;
            params[6] = colorCorrection.gamma.b;
            params[7] = colorCorrection.gammaMaster;
            // Gain
            params[8] = colorCorrection.gain.r;
            params[9] = colorCorrection.gain.g;
            params[10] = colorCorrection.gain.b;
            params[11] = colorCorrection.gainMaster;
            // Offset
            params[12] = colorCorrection.offset.r;
            params[13] = colorCorrection.offset.g;
            params[14] = colorCorrection.offset.b;
            params[15] = colorCorrection.offsetMaster;
            // Other params
            params[16] = colorCorrection.temperature;
            params[17] = colorCorrection.tint;
            params[18] = colorCorrection.contrast;
            params[19] = colorCorrection.pivot;
            params[20] = colorCorrection.saturation;
            params[21] = colorCorrection.hueRotation;
        }
        if (toneMapping) {
            params[22] = toneMapping.exposure;
            params[23] = this.getToneMappingMethodIndex(toneMapping.method);
        }
        params[24] = lutIntensity;
        // Enable flags (bit0=LUT, bit1=CC, bit2=TM)
        let flags = 0;
        if (lutIntensity > 0)
            flags |= 1;
        if (colorCorrection)
            flags |= 2;
        if (toneMapping)
            flags |= 4;
        params[25] = flags;
        return params;
    }
    getToneMappingMethodIndex(method) {
        switch (method) {
            case 'none': return 0;
            case 'reinhard': return 1;
            case 'filmic': return 2;
            case 'aces-hill': return 3;
            case 'aces-narkowicz': return 4;
            case 'agx': return 5;
            default: return 3;
        }
    }
    createBindGroup(inputTexture, lutData) {
        if (!this.device || !this.colorBindGroupLayout) {
            throw new Error('Device not initialized');
        }
        const entries = [];
        // Input texture
        if (inputTexture) {
            entries.push({
                binding: 0,
                resource: inputTexture.createView(),
            });
        }
        // Sampler
        entries.push({
            binding: 1,
            resource: this.device.createSampler({
                magFilter: 'linear',
                minFilter: 'linear',
            }),
        });
        // LUT texture (create dummy if not provided)
        if (lutData) {
            const lutTexture = this.createLUTTexture(lutData);
            entries.push({
                binding: 2,
                resource: lutTexture.createView(),
            });
        }
        // Uniform buffer
        if (this.colorParamsBuffer) {
            entries.push({
                binding: 3,
                resource: { buffer: this.colorParamsBuffer },
            });
        }
        return this.device.createBindGroup({
            layout: this.colorBindGroupLayout,
            entries,
        });
    }
    createLUTTexture(lutData) {
        if (!this.device) {
            throw new Error('Device not initialized');
        }
        const texture = this.device.createTexture({
            size: { width: lutData.size, height: lutData.size, depthOrArrayLayers: lutData.size },
            format: 'rgba32float',
            dimension: '3d',
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUBufferUsage.COPY_DST,
        });
        this.device.queue.writeTexture({ texture }, lutData.data, { bytesPerRow: lutData.size * 16, rowsPerImage: lutData.size }, { width: lutData.size, height: lutData.size, depthOrArrayLayers: lutData.size });
        return texture;
    }
    // ==================== 统计与状态 ====================
    createEmptyStats() {
        return {
            frameTimeMs: 0,
            gpuTimeMs: 0,
            uploadTimeMs: 0,
            textureMemoryMB: 0,
            bufferMemoryMB: 0,
            framesRendered: 0,
            cacheHits: 0,
            cacheMisses: 0,
            drawCalls: 0,
            triangles: 0,
        };
    }
    getStats() {
        const cacheStats = this.frameCache.getStats();
        return {
            ...this.stats,
            cacheHits: cacheStats.hits,
            cacheMisses: cacheStats.misses,
            textureMemoryMB: cacheStats.bytes / (1024 * 1024),
        };
    }
    getStatus() {
        return this.status;
    }
    getDeviceInfo() {
        return this.deviceInfo ? { ...this.deviceInfo } : null;
    }
    onStatusChange(callback) {
        this.statusListeners.add(callback);
        return () => this.statusListeners.delete(callback);
    }
    notifyStatus(status, message) {
        for (const listener of this.statusListeners) {
            try {
                listener(status, message);
            }
            catch (error) {
                logger.error('Status listener error:', error);
            }
        }
    }
    // ==================== 配置更新 ====================
    getConfig() {
        return { ...this.config };
    }
    updateConfig(patch) {
        this.config = { ...this.config, ...patch };
    }
    setQuality(quality) {
        this.currentQuality = quality;
    }
    setProxyStrategy(strategy) {
        this.currentProxyStrategy = strategy;
    }
    // ==================== 清理 ====================
    destroy() {
        this.frameCache.clear();
        this.dirtyRegionManager.clear();
        if (this.colorParamsBuffer) {
            this.colorParamsBuffer.destroy();
            this.colorParamsBuffer = null;
        }
        if (this.device) {
            this.device.destroy();
            this.device = null;
        }
        this.adapter = null;
        this.context = null;
        this.canvas = null;
        this.colorPipeline = null;
        this.colorBindGroupLayout = null;
        this.deviceInfo = null;
        this.status = 'uninitialized';
    }
}
// ==================== 工厂函数 ====================
/**
 * 创建 WebGPU 渲染引擎实例
 */
export function createWebGPURenderEngine(config) {
    return new WebGPURenderEngine(config);
}
/**
 * 检测 WebGPU 支持情况
 */
export async function detectWebGPUSupport() {
    if (!navigator.gpu) {
        return { supported: false };
    }
    try {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
            return { supported: false };
        }
        return {
            supported: true,
            adapterInfo: adapter.info,
            features: Array.from(adapter.features),
            limits: {
                maxTextureDimension2D: adapter.limits.maxTextureDimension2D,
                maxBufferSize: adapter.limits.maxBufferSize,
            },
        };
    }
    catch {
        return { supported: false };
    }
}
//# sourceMappingURL=webgpu-render-engine-core.js.map
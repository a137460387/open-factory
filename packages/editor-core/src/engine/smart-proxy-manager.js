/**
 * 智能代理系统
 *
 * 核心功能：
 * 1. 基于设备性能的自动代理生成
 * 2. 代理文件与原始文件的无缝切换
 * 3. 代理质量自适应
 * 4. 代理缓存管理
 */
/** 默认配置 */
export const DEFAULT_PROXY_CONFIG = {
    generation: {
        quality: 'half',
        maxConcurrent: 2,
        storagePath: '/proxies',
        autoGenerateLowQuality: true,
        lowQualityThreshold: 5,
        maxCacheSizeMB: 2048,
        maxCacheCount: 100,
    },
    switchStrategy: {
        switchThresholdMs: 20, // 50fps
        recoveryThresholdMs: 14, // 70fps
        switchDelay: 10,
        enableAdaptive: true,
        sampleWindowSize: 30,
    },
    enabled: true,
    autoGenerate: true,
    smartSwitch: true,
};
// ==================== 设备性能检测 ====================
/**
 * 检测设备性能级别
 */
export async function detectDevicePerformance() {
    const info = {
        level: 'medium',
        cpuCores: navigator.hardwareConcurrency || 4,
        memoryGB: 8,
        gpuRenderer: 'unknown',
        maxTextureSize: 4096,
        supportsWebGPU: false,
        supportsWebGL2: false,
        estimatedVRAM: 0,
        benchmarkScore: 0,
    };
    // Check WebGPU support
    if (navigator.gpu) {
        try {
            const adapter = await navigator.gpu.requestAdapter();
            if (adapter) {
                info.supportsWebGPU = true;
                info.gpuRenderer = adapter.info?.device || 'webgpu';
                info.maxTextureSize = adapter.limits.maxTextureDimension2D;
            }
        }
        catch {
            // WebGPU not available
        }
    }
    // Check WebGL2 support
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl2');
        if (gl) {
            info.supportsWebGL2 = true;
            if (!info.supportsWebGPU) {
                info.gpuRenderer = gl.getParameter(gl.getExtension('WEBGL_debug_renderer_info')?.UNMASKED_RENDERER_WEBGL || gl.RENDERER);
                info.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
            }
        }
    }
    catch {
        // WebGL2 not available
    }
    // Estimate memory
    if ('deviceMemory' in navigator) {
        info.memoryGB = navigator.deviceMemory;
    }
    // Estimate VRAM based on GPU capabilities
    if (info.maxTextureSize >= 16384) {
        info.estimatedVRAM = 8192;
    }
    else if (info.maxTextureSize >= 8192) {
        info.estimatedVRAM = 4096;
    }
    else if (info.maxTextureSize >= 4096) {
        info.estimatedVRAM = 2048;
    }
    else {
        info.estimatedVRAM = 1024;
    }
    // Calculate benchmark score
    info.benchmarkScore = calculateBenchmarkScore(info);
    // Determine performance level
    info.level = determinePerformanceLevel(info);
    return info;
}
/**
 * 计算基准分数
 */
function calculateBenchmarkScore(info) {
    let score = 0;
    // CPU score (0-30)
    score += Math.min(30, info.cpuCores * 3);
    // Memory score (0-20)
    score += Math.min(20, info.memoryGB * 2);
    // GPU score (0-40)
    if (info.supportsWebGPU) {
        score += 30;
    }
    else if (info.supportsWebGL2) {
        score += 20;
    }
    // VRAM score (0-10)
    score += Math.min(10, info.estimatedVRAM / 1024);
    return score;
}
/**
 * 确定性能级别
 */
function determinePerformanceLevel(info) {
    if (info.benchmarkScore >= 80) {
        return 'ultra';
    }
    else if (info.benchmarkScore >= 60) {
        return 'high';
    }
    else if (info.benchmarkScore >= 40) {
        return 'medium';
    }
    else {
        return 'low';
    }
}
/**
 * 根据设备性能推荐代理质量
 */
export function recommendProxyQuality(deviceInfo) {
    switch (deviceInfo.level) {
        case 'ultra':
            return 'full';
        case 'high':
            return 'three-quarter';
        case 'medium':
            return 'half';
        case 'low':
            return 'quarter';
    }
}
// ==================== 代理文件管理器 ====================
/**
 * 代理文件管理器
 *
 * 管理代理文件的生成、缓存和切换
 */
export class ProxyFileManager {
    config;
    proxies = new Map();
    generationQueue = [];
    activeGenerations = 0;
    constructor(config) {
        this.config = { ...DEFAULT_PROXY_CONFIG.generation, ...config };
    }
    /**
     * 获取代理文件信息
     */
    getProxy(mediaId, quality) {
        const key = this.buildProxyKey(mediaId, quality);
        return this.proxies.get(key);
    }
    /**
     * 获取最佳可用代理
     */
    getBestAvailableProxy(mediaId, preferredQuality) {
        const qualityOrder = ['full', 'three-quarter', 'half', 'quarter'];
        const startIndex = qualityOrder.indexOf(preferredQuality);
        // Try preferred quality first, then lower qualities
        for (let i = startIndex; i < qualityOrder.length; i++) {
            const proxy = this.getProxy(mediaId, qualityOrder[i]);
            if (proxy && proxy.status === 'ready') {
                proxy.lastUsedAt = Date.now();
                proxy.useCount++;
                return proxy;
            }
        }
        return undefined;
    }
    /**
     * 注册代理文件
     */
    registerProxy(proxy) {
        const key = this.buildProxyKey(proxy.originalMediaId, proxy.quality);
        this.proxies.set(key, proxy);
        this.cleanupCache();
    }
    /**
     * 更新代理状态
     */
    updateProxyStatus(mediaId, quality, status) {
        const key = this.buildProxyKey(mediaId, quality);
        const proxy = this.proxies.get(key);
        if (proxy) {
            proxy.status = status;
        }
    }
    /**
     * 生成代理文件
     */
    async generateProxy(mediaId, quality, sourceWidth, sourceHeight, generateFn) {
        const key = this.buildProxyKey(mediaId, quality);
        // Check if already exists
        const existing = this.proxies.get(key);
        if (existing && existing.status === 'ready') {
            return existing;
        }
        // Calculate target dimensions
        const { width, height } = this.calculateProxyDimensions(sourceWidth, sourceHeight, quality);
        // Create proxy info
        const proxy = {
            id: key,
            originalMediaId: mediaId,
            quality,
            width,
            height,
            fileSize: 0,
            filePath: '',
            status: 'generating',
            createdAt: Date.now(),
            lastUsedAt: Date.now(),
            useCount: 0,
        };
        this.proxies.set(key, proxy);
        try {
            // Generate proxy
            const filePath = await generateFn(mediaId, width, height);
            proxy.filePath = filePath;
            proxy.status = 'ready';
        }
        catch (error) {
            proxy.status = 'error';
            throw error;
        }
        return proxy;
    }
    /**
     * 计算代理尺寸
     */
    calculateProxyDimensions(sourceWidth, sourceHeight, quality) {
        let scale;
        switch (quality) {
            case 'quarter':
                scale = 0.25;
                break;
            case 'half':
                scale = 0.5;
                break;
            case 'three-quarter':
                scale = 0.75;
                break;
            case 'full':
                scale = 1.0;
                break;
        }
        const width = Math.round(sourceWidth * scale);
        const height = Math.round(sourceHeight * scale);
        // Ensure dimensions are even (required for many codecs)
        return {
            width: width % 2 === 0 ? width : width + 1,
            height: height % 2 === 0 ? height : height + 1,
        };
    }
    /**
     * 构建代理键
     */
    buildProxyKey(mediaId, quality) {
        return `${mediaId}_${quality}`;
    }
    /**
     * 清理缓存
     */
    cleanupCache() {
        const proxies = Array.from(this.proxies.values());
        // Sort by last used time (oldest first)
        proxies.sort((a, b) => a.lastUsedAt - b.lastUsedAt);
        let totalSize = 0;
        let totalCount = 0;
        // Calculate current totals
        for (const proxy of proxies) {
            if (proxy.status === 'ready') {
                totalSize += proxy.fileSize;
                totalCount++;
            }
        }
        // Remove oldest proxies if over limits
        for (const proxy of proxies) {
            if (totalCount <= this.config.maxCacheCount && totalSize <= this.config.maxCacheSizeMB * 1024 * 1024) {
                break;
            }
            if (proxy.status === 'ready') {
                totalSize -= proxy.fileSize;
                totalCount--;
                this.proxies.delete(this.buildProxyKey(proxy.originalMediaId, proxy.quality));
            }
        }
    }
    /**
     * 获取统计信息
     */
    getStats() {
        const proxies = Array.from(this.proxies.values());
        const totalSize = proxies.reduce((sum, p) => sum + p.fileSize, 0);
        return {
            totalProxies: proxies.length,
            totalSizeMB: totalSize / (1024 * 1024),
        };
    }
    /**
     * 清除所有代理
     */
    clear() {
        this.proxies.clear();
        this.generationQueue = [];
        this.activeGenerations = 0;
    }
}
// ==================== 代理切换管理器 ====================
/**
 * 代理切换管理器
 *
 * 基于性能监控智能切换代理质量
 */
export class ProxySwitchManager {
    config;
    frameTimes = [];
    currentQuality;
    switchCounter = 0;
    lastSwitchTime = 0;
    switchHistory = [];
    constructor(initialQuality = 'half', config) {
        this.currentQuality = initialQuality;
        this.config = { ...DEFAULT_PROXY_CONFIG.switchStrategy, ...config };
    }
    /**
     * 记录帧时间
     */
    recordFrameTime(frameTimeMs) {
        this.frameTimes.push(frameTimeMs);
        // Keep only recent samples
        if (this.frameTimes.length > this.config.sampleWindowSize) {
            this.frameTimes.shift();
        }
        // Check if switch is needed
        if (this.config.enableAdaptive) {
            this.evaluateSwitch();
        }
    }
    /**
     * 评估是否需要切换
     */
    evaluateSwitch() {
        if (this.frameTimes.length < 10) {
            return;
        }
        const avgFrameTime = this.getAverageFrameTime();
        const now = Date.now();
        // Prevent rapid switching
        if (now - this.lastSwitchTime < 1000) {
            return;
        }
        // Check if performance is poor
        if (avgFrameTime > this.config.switchThresholdMs) {
            this.switchCounter++;
            if (this.switchCounter >= this.config.switchDelay) {
                this.downgradeQuality();
                this.switchCounter = 0;
                this.lastSwitchTime = now;
            }
        }
        // Check if performance is good enough to upgrade
        else if (avgFrameTime < this.config.recoveryThresholdMs) {
            this.switchCounter++;
            if (this.switchCounter >= this.config.switchDelay * 2) {
                this.upgradeQuality();
                this.switchCounter = 0;
                this.lastSwitchTime = now;
            }
        }
        else {
            this.switchCounter = 0;
        }
    }
    /**
     * 降低质量
     */
    downgradeQuality() {
        const qualityOrder = ['full', 'three-quarter', 'half', 'quarter'];
        const currentIndex = qualityOrder.indexOf(this.currentQuality);
        if (currentIndex < qualityOrder.length - 1) {
            const newQuality = qualityOrder[currentIndex + 1];
            this.recordSwitch(this.currentQuality, newQuality);
            this.currentQuality = newQuality;
        }
    }
    /**
     * 提升质量
     */
    upgradeQuality() {
        const qualityOrder = ['full', 'three-quarter', 'half', 'quarter'];
        const currentIndex = qualityOrder.indexOf(this.currentQuality);
        if (currentIndex > 0) {
            const newQuality = qualityOrder[currentIndex - 1];
            this.recordSwitch(this.currentQuality, newQuality);
            this.currentQuality = newQuality;
        }
    }
    /**
     * 记录切换
     */
    recordSwitch(from, to) {
        this.switchHistory.push({
            time: Date.now(),
            from,
            to,
        });
        // Keep only recent history
        if (this.switchHistory.length > 100) {
            this.switchHistory.shift();
        }
    }
    /**
     * 获取平均帧时间
     */
    getAverageFrameTime() {
        if (this.frameTimes.length === 0) {
            return 0;
        }
        const sum = this.frameTimes.reduce((a, b) => a + b, 0);
        return sum / this.frameTimes.length;
    }
    /**
     * 获取当前质量
     */
    getCurrentQuality() {
        return this.currentQuality;
    }
    /**
     * 设置当前质量
     */
    setCurrentQuality(quality) {
        this.currentQuality = quality;
    }
    /**
     * 获取切换历史
     */
    getSwitchHistory() {
        return [...this.switchHistory];
    }
    /**
     * 获取平均切换延迟
     */
    getAverageSwitchLatency() {
        if (this.switchHistory.length < 2) {
            return 0;
        }
        let totalLatency = 0;
        for (let i = 1; i < this.switchHistory.length; i++) {
            totalLatency += this.switchHistory[i].time - this.switchHistory[i - 1].time;
        }
        return totalLatency / (this.switchHistory.length - 1);
    }
    /**
     * 重置统计
     */
    resetStats() {
        this.frameTimes = [];
        this.switchCounter = 0;
        this.switchHistory = [];
    }
}
// ==================== 智能代理管理器 ====================
/**
 * 智能代理管理器
 *
 * 整合设备性能检测、代理文件管理和智能切换
 */
export class SmartProxyManager {
    config;
    deviceInfo = null;
    fileManager;
    switchManager;
    initialized = false;
    constructor(config) {
        this.config = { ...DEFAULT_PROXY_CONFIG, ...config };
        this.fileManager = new ProxyFileManager(this.config.generation);
        this.switchManager = new ProxySwitchManager('half', this.config.switchStrategy);
    }
    /**
     * 初始化代理管理器
     */
    async initialize() {
        if (this.initialized && this.deviceInfo) {
            return this.deviceInfo;
        }
        this.deviceInfo = await detectDevicePerformance();
        // Set initial quality based on device performance
        const recommendedQuality = recommendProxyQuality(this.deviceInfo);
        this.switchManager.setCurrentQuality(recommendedQuality);
        this.initialized = true;
        return this.deviceInfo;
    }
    /**
     * 获取当前推荐的代理质量
     */
    getCurrentQuality() {
        if (!this.config.smartSwitch) {
            return this.config.generation.quality;
        }
        return this.switchManager.getCurrentQuality();
    }
    /**
     * 获取最佳代理文件
     */
    getBestProxy(mediaId) {
        if (!this.config.enabled) {
            return undefined;
        }
        const quality = this.getCurrentQuality();
        return this.fileManager.getBestAvailableProxy(mediaId, quality);
    }
    /**
     * 生成代理文件
     */
    async generateProxy(mediaId, quality, sourceWidth, sourceHeight, generateFn) {
        return this.fileManager.generateProxy(mediaId, quality, sourceWidth, sourceHeight, generateFn);
    }
    /**
     * 记录帧性能
     */
    recordFramePerformance(frameTimeMs) {
        if (this.config.smartSwitch) {
            this.switchManager.recordFrameTime(frameTimeMs);
        }
    }
    /**
     * 获取性能统计
     */
    getPerformanceStats() {
        const fileStats = this.fileManager.getStats();
        return {
            currentQuality: this.switchManager.getCurrentQuality(),
            hitRate: 0, // TODO: track hits
            avgSwitchLatencyMs: this.switchManager.getAverageSwitchLatency(),
            totalProxies: fileStats.totalProxies,
            totalSizeMB: fileStats.totalSizeMB,
            cacheHitRate: 0, // TODO: track cache hits
        };
    }
    /**
     * 获取设备信息
     */
    getDeviceInfo() {
        return this.deviceInfo ? { ...this.deviceInfo } : null;
    }
    /**
     * 更新配置
     */
    updateConfig(patch) {
        this.config = { ...this.config, ...patch };
    }
    /**
     * 清除所有代理
     */
    clear() {
        this.fileManager.clear();
        this.switchManager.resetStats();
    }
    /**
     * 销毁管理器
     */
    destroy() {
        this.clear();
        this.initialized = false;
        this.deviceInfo = null;
    }
}
// ==================== 工厂函数 ====================
/**
 * 创建智能代理管理器实例
 */
export function createSmartProxyManager(config) {
    return new SmartProxyManager(config);
}
/**
 * 快速检测设备性能
 */
export async function quickDetectPerformance() {
    const info = await detectDevicePerformance();
    return info.level;
}
//# sourceMappingURL=smart-proxy-manager.js.map
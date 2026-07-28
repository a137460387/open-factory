/**
 * 智能代理系统
 *
 * 核心功能：
 * 1. 基于设备性能的自动代理生成
 * 2. 代理文件与原始文件的无缝切换
 * 3. 代理质量自适应
 * 4. 代理缓存管理
 */
/** 设备性能级别 */
export type DevicePerformanceLevel = 'low' | 'medium' | 'high' | 'ultra';
/** 代理质量 */
export type ProxyQuality = 'quarter' | 'half' | 'three-quarter' | 'full';
/** 代理文件状态 */
export type ProxyFileStatus = 'none' | 'generating' | 'ready' | 'error';
/** 代理文件信息 */
export interface ProxyFileInfo {
    id: string;
    originalMediaId: string;
    quality: ProxyQuality;
    width: number;
    height: number;
    fileSize: number;
    filePath: string;
    status: ProxyFileStatus;
    createdAt: number;
    lastUsedAt: number;
    useCount: number;
}
/** 设备性能信息 */
export interface DevicePerformanceInfo {
    level: DevicePerformanceLevel;
    cpuCores: number;
    memoryGB: number;
    gpuRenderer: string;
    maxTextureSize: number;
    supportsWebGPU: boolean;
    supportsWebGL2: boolean;
    estimatedVRAM: number;
    benchmarkScore: number;
}
/** 代理生成配置 */
export interface ProxyGenerationConfig {
    /** 目标质量 */
    quality: ProxyQuality;
    /** 最大并发生成数 */
    maxConcurrent: number;
    /** 代理文件存储路径 */
    storagePath: string;
    /** 是否自动生成低质量代理 */
    autoGenerateLowQuality: boolean;
    /** 低质量代理阈值（秒） */
    lowQualityThreshold: number;
    /** 代理文件最大缓存大小（MB） */
    maxCacheSizeMB: number;
    /** 代理文件最大数量 */
    maxCacheCount: number;
}
/** 代理切换策略 */
export interface ProxySwitchStrategy {
    /** 切换阈值（帧时间ms） */
    switchThresholdMs: number;
    /** 恢复阈值（帧时间ms） */
    recoveryThresholdMs: number;
    /** 切换延迟（帧数） */
    switchDelay: number;
    /** 是否启用自适应切换 */
    enableAdaptive: boolean;
    /** 性能采样窗口大小 */
    sampleWindowSize: number;
}
/** 代理管理器配置 */
export interface ProxyManagerConfig {
    generation: ProxyGenerationConfig;
    switchStrategy: ProxySwitchStrategy;
    /** 是否启用代理 */
    enabled: boolean;
    /** 是否启用自动代理生成 */
    autoGenerate: boolean;
    /** 是否启用智能切换 */
    smartSwitch: boolean;
}
/** 默认配置 */
export declare const DEFAULT_PROXY_CONFIG: ProxyManagerConfig;
/** 代理性能统计 */
export interface ProxyPerformanceStats {
    /** 当前使用的代理质量 */
    currentQuality: ProxyQuality;
    /** 代理命中率 */
    hitRate: number;
    /** 平均切换延迟（ms） */
    avgSwitchLatencyMs: number;
    /** 代理文件总数 */
    totalProxies: number;
    /** 代理文件总大小（MB） */
    totalSizeMB: number;
    /** 缓存命中率 */
    cacheHitRate: number;
}
/**
 * 检测设备性能级别
 */
export declare function detectDevicePerformance(): Promise<DevicePerformanceInfo>;
/**
 * 根据设备性能推荐代理质量
 */
export declare function recommendProxyQuality(deviceInfo: DevicePerformanceInfo): ProxyQuality;
/**
 * 代理文件管理器
 *
 * 管理代理文件的生成、缓存和切换
 */
export declare class ProxyFileManager {
    private config;
    private proxies;
    private generationQueue;
    private activeGenerations;
    constructor(config?: Partial<ProxyGenerationConfig>);
    /**
     * 获取代理文件信息
     */
    getProxy(mediaId: string, quality: ProxyQuality): ProxyFileInfo | undefined;
    /**
     * 获取最佳可用代理
     */
    getBestAvailableProxy(mediaId: string, preferredQuality: ProxyQuality): ProxyFileInfo | undefined;
    /**
     * 注册代理文件
     */
    registerProxy(proxy: ProxyFileInfo): void;
    /**
     * 更新代理状态
     */
    updateProxyStatus(mediaId: string, quality: ProxyQuality, status: ProxyFileStatus): void;
    /**
     * 生成代理文件
     */
    generateProxy(mediaId: string, quality: ProxyQuality, sourceWidth: number, sourceHeight: number, generateFn: (mediaId: string, width: number, height: number) => Promise<string>): Promise<ProxyFileInfo>;
    /**
     * 计算代理尺寸
     */
    private calculateProxyDimensions;
    /**
     * 构建代理键
     */
    private buildProxyKey;
    /**
     * 清理缓存
     */
    private cleanupCache;
    /**
     * 获取统计信息
     */
    getStats(): {
        totalProxies: number;
        totalSizeMB: number;
    };
    /**
     * 清除所有代理
     */
    clear(): void;
}
/**
 * 代理切换管理器
 *
 * 基于性能监控智能切换代理质量
 */
export declare class ProxySwitchManager {
    private config;
    private frameTimes;
    private currentQuality;
    private switchCounter;
    private lastSwitchTime;
    private switchHistory;
    constructor(initialQuality?: ProxyQuality, config?: Partial<ProxySwitchStrategy>);
    /**
     * 记录帧时间
     */
    recordFrameTime(frameTimeMs: number): void;
    /**
     * 评估是否需要切换
     */
    private evaluateSwitch;
    /**
     * 降低质量
     */
    private downgradeQuality;
    /**
     * 提升质量
     */
    private upgradeQuality;
    /**
     * 记录切换
     */
    private recordSwitch;
    /**
     * 获取平均帧时间
     */
    getAverageFrameTime(): number;
    /**
     * 获取当前质量
     */
    getCurrentQuality(): ProxyQuality;
    /**
     * 设置当前质量
     */
    setCurrentQuality(quality: ProxyQuality): void;
    /**
     * 获取切换历史
     */
    getSwitchHistory(): typeof this.switchHistory;
    /**
     * 获取平均切换延迟
     */
    getAverageSwitchLatency(): number;
    /**
     * 重置统计
     */
    resetStats(): void;
}
/**
 * 智能代理管理器
 *
 * 整合设备性能检测、代理文件管理和智能切换
 */
export declare class SmartProxyManager {
    private config;
    private deviceInfo;
    private fileManager;
    private switchManager;
    private initialized;
    constructor(config?: Partial<ProxyManagerConfig>);
    /**
     * 初始化代理管理器
     */
    initialize(): Promise<DevicePerformanceInfo>;
    /**
     * 获取当前推荐的代理质量
     */
    getCurrentQuality(): ProxyQuality;
    /**
     * 获取最佳代理文件
     */
    getBestProxy(mediaId: string): ProxyFileInfo | undefined;
    /**
     * 生成代理文件
     */
    generateProxy(mediaId: string, quality: ProxyQuality, sourceWidth: number, sourceHeight: number, generateFn: (mediaId: string, width: number, height: number) => Promise<string>): Promise<ProxyFileInfo>;
    /**
     * 记录帧性能
     */
    recordFramePerformance(frameTimeMs: number): void;
    /**
     * 获取性能统计
     */
    getPerformanceStats(): ProxyPerformanceStats;
    /**
     * 获取设备信息
     */
    getDeviceInfo(): DevicePerformanceInfo | null;
    /**
     * 更新配置
     */
    updateConfig(patch: Partial<ProxyManagerConfig>): void;
    /**
     * 清除所有代理
     */
    clear(): void;
    /**
     * 销毁管理器
     */
    destroy(): void;
}
/**
 * 创建智能代理管理器实例
 */
export declare function createSmartProxyManager(config?: Partial<ProxyManagerConfig>): SmartProxyManager;
/**
 * 快速检测设备性能
 */
export declare function quickDetectPerformance(): Promise<DevicePerformanceLevel>;
//# sourceMappingURL=smart-proxy-manager.d.ts.map
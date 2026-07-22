/**
 * 智能代理系统
 *
 * 核心功能：
 * 1. 基于设备性能的自动代理生成
 * 2. 代理文件与原始文件的无缝切换
 * 3. 代理质量自适应
 * 4. 代理缓存管理
 */

import type { MediaAsset } from '../model';

// ==================== 类型定义 ====================

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
export const DEFAULT_PROXY_CONFIG: ProxyManagerConfig = {
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

// ==================== 设备性能检测 ====================

/**
 * 检测设备性能级别
 */
export async function detectDevicePerformance(): Promise<DevicePerformanceInfo> {
  const info: DevicePerformanceInfo = {
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
    } catch {
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
  } catch {
    // WebGL2 not available
  }

  // Estimate memory
  if ('deviceMemory' in navigator) {
    info.memoryGB = (navigator as any).deviceMemory;
  }

  // Estimate VRAM based on GPU capabilities
  if (info.maxTextureSize >= 16384) {
    info.estimatedVRAM = 8192;
  } else if (info.maxTextureSize >= 8192) {
    info.estimatedVRAM = 4096;
  } else if (info.maxTextureSize >= 4096) {
    info.estimatedVRAM = 2048;
  } else {
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
function calculateBenchmarkScore(info: DevicePerformanceInfo): number {
  let score = 0;

  // CPU score (0-30)
  score += Math.min(30, info.cpuCores * 3);

  // Memory score (0-20)
  score += Math.min(20, info.memoryGB * 2);

  // GPU score (0-40)
  if (info.supportsWebGPU) {
    score += 30;
  } else if (info.supportsWebGL2) {
    score += 20;
  }

  // VRAM score (0-10)
  score += Math.min(10, info.estimatedVRAM / 1024);

  return score;
}

/**
 * 确定性能级别
 */
function determinePerformanceLevel(info: DevicePerformanceInfo): DevicePerformanceLevel {
  if (info.benchmarkScore >= 80) {
    return 'ultra';
  } else if (info.benchmarkScore >= 60) {
    return 'high';
  } else if (info.benchmarkScore >= 40) {
    return 'medium';
  } else {
    return 'low';
  }
}

/**
 * 根据设备性能推荐代理质量
 */
export function recommendProxyQuality(deviceInfo: DevicePerformanceInfo): ProxyQuality {
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
  private config: ProxyGenerationConfig;
  private proxies: Map<string, ProxyFileInfo> = new Map();
  private generationQueue: string[] = [];
  private activeGenerations: number = 0;

  constructor(config?: Partial<ProxyGenerationConfig>) {
    this.config = { ...DEFAULT_PROXY_CONFIG.generation, ...config };
  }

  /**
   * 获取代理文件信息
   */
  getProxy(mediaId: string, quality: ProxyQuality): ProxyFileInfo | undefined {
    const key = this.buildProxyKey(mediaId, quality);
    return this.proxies.get(key);
  }

  /**
   * 获取最佳可用代理
   */
  getBestAvailableProxy(mediaId: string, preferredQuality: ProxyQuality): ProxyFileInfo | undefined {
    const qualityOrder: ProxyQuality[] = ['full', 'three-quarter', 'half', 'quarter'];
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
  registerProxy(proxy: ProxyFileInfo): void {
    const key = this.buildProxyKey(proxy.originalMediaId, proxy.quality);
    this.proxies.set(key, proxy);
    this.cleanupCache();
  }

  /**
   * 更新代理状态
   */
  updateProxyStatus(mediaId: string, quality: ProxyQuality, status: ProxyFileStatus): void {
    const key = this.buildProxyKey(mediaId, quality);
    const proxy = this.proxies.get(key);
    if (proxy) {
      proxy.status = status;
    }
  }

  /**
   * 生成代理文件
   */
  async generateProxy(
    mediaId: string,
    quality: ProxyQuality,
    sourceWidth: number,
    sourceHeight: number,
    generateFn: (mediaId: string, width: number, height: number) => Promise<string>
  ): Promise<ProxyFileInfo> {
    const key = this.buildProxyKey(mediaId, quality);

    // Check if already exists
    const existing = this.proxies.get(key);
    if (existing && existing.status === 'ready') {
      return existing;
    }

    // Calculate target dimensions
    const { width, height } = this.calculateProxyDimensions(sourceWidth, sourceHeight, quality);

    // Create proxy info
    const proxy: ProxyFileInfo = {
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
    } catch (error) {
      proxy.status = 'error';
      throw error;
    }

    return proxy;
  }

  /**
   * 计算代理尺寸
   */
  private calculateProxyDimensions(
    sourceWidth: number,
    sourceHeight: number,
    quality: ProxyQuality
  ): { width: number; height: number } {
    let scale: number;

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
  private buildProxyKey(mediaId: string, quality: ProxyQuality): string {
    return `${mediaId}_${quality}`;
  }

  /**
   * 清理缓存
   */
  private cleanupCache(): void {
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
  getStats(): { totalProxies: number; totalSizeMB: number } {
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
  clear(): void {
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
  private config: ProxySwitchStrategy;
  private frameTimes: number[] = [];
  private currentQuality: ProxyQuality;
  private switchCounter: number = 0;
  private lastSwitchTime: number = 0;
  private switchHistory: { time: number; from: ProxyQuality; to: ProxyQuality }[] = [];

  constructor(
    initialQuality: ProxyQuality = 'half',
    config?: Partial<ProxySwitchStrategy>
  ) {
    this.currentQuality = initialQuality;
    this.config = { ...DEFAULT_PROXY_CONFIG.switchStrategy, ...config };
  }

  /**
   * 记录帧时间
   */
  recordFrameTime(frameTimeMs: number): void {
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
  private evaluateSwitch(): void {
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
    } else {
      this.switchCounter = 0;
    }
  }

  /**
   * 降低质量
   */
  private downgradeQuality(): void {
    const qualityOrder: ProxyQuality[] = ['full', 'three-quarter', 'half', 'quarter'];
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
  private upgradeQuality(): void {
    const qualityOrder: ProxyQuality[] = ['full', 'three-quarter', 'half', 'quarter'];
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
  private recordSwitch(from: ProxyQuality, to: ProxyQuality): void {
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
  getAverageFrameTime(): number {
    if (this.frameTimes.length === 0) {
      return 0;
    }

    const sum = this.frameTimes.reduce((a, b) => a + b, 0);
    return sum / this.frameTimes.length;
  }

  /**
   * 获取当前质量
   */
  getCurrentQuality(): ProxyQuality {
    return this.currentQuality;
  }

  /**
   * 设置当前质量
   */
  setCurrentQuality(quality: ProxyQuality): void {
    this.currentQuality = quality;
  }

  /**
   * 获取切换历史
   */
  getSwitchHistory(): typeof this.switchHistory {
    return [...this.switchHistory];
  }

  /**
   * 获取平均切换延迟
   */
  getAverageSwitchLatency(): number {
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
  resetStats(): void {
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
  private config: ProxyManagerConfig;
  private deviceInfo: DevicePerformanceInfo | null = null;
  private fileManager: ProxyFileManager;
  private switchManager: ProxySwitchManager;
  private initialized: boolean = false;

  constructor(config?: Partial<ProxyManagerConfig>) {
    this.config = { ...DEFAULT_PROXY_CONFIG, ...config };
    this.fileManager = new ProxyFileManager(this.config.generation);
    this.switchManager = new ProxySwitchManager('half', this.config.switchStrategy);
  }

  /**
   * 初始化代理管理器
   */
  async initialize(): Promise<DevicePerformanceInfo> {
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
  getCurrentQuality(): ProxyQuality {
    if (!this.config.smartSwitch) {
      return this.config.generation.quality;
    }

    return this.switchManager.getCurrentQuality();
  }

  /**
   * 获取最佳代理文件
   */
  getBestProxy(mediaId: string): ProxyFileInfo | undefined {
    if (!this.config.enabled) {
      return undefined;
    }

    const quality = this.getCurrentQuality();
    return this.fileManager.getBestAvailableProxy(mediaId, quality);
  }

  /**
   * 生成代理文件
   */
  async generateProxy(
    mediaId: string,
    quality: ProxyQuality,
    sourceWidth: number,
    sourceHeight: number,
    generateFn: (mediaId: string, width: number, height: number) => Promise<string>
  ): Promise<ProxyFileInfo> {
    return this.fileManager.generateProxy(mediaId, quality, sourceWidth, sourceHeight, generateFn);
  }

  /**
   * 记录帧性能
   */
  recordFramePerformance(frameTimeMs: number): void {
    if (this.config.smartSwitch) {
      this.switchManager.recordFrameTime(frameTimeMs);
    }
  }

  /**
   * 获取性能统计
   */
  getPerformanceStats(): ProxyPerformanceStats {
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
  getDeviceInfo(): DevicePerformanceInfo | null {
    return this.deviceInfo ? { ...this.deviceInfo } : null;
  }

  /**
   * 更新配置
   */
  updateConfig(patch: Partial<ProxyManagerConfig>): void {
    this.config = { ...this.config, ...patch };
  }

  /**
   * 清除所有代理
   */
  clear(): void {
    this.fileManager.clear();
    this.switchManager.resetStats();
  }

  /**
   * 销毁管理器
   */
  destroy(): void {
    this.clear();
    this.initialized = false;
    this.deviceInfo = null;
  }
}

// ==================== 工厂函数 ====================

/**
 * 创建智能代理管理器实例
 */
export function createSmartProxyManager(
  config?: Partial<ProxyManagerConfig>
): SmartProxyManager {
  return new SmartProxyManager(config);
}

/**
 * 快速检测设备性能
 */
export async function quickDetectPerformance(): Promise<DevicePerformanceLevel> {
  const info = await detectDevicePerformance();
  return info.level;
}

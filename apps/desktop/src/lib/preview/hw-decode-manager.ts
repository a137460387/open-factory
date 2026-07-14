/**
 * 硬件加速解码管理器
 *
 * 提供基于 FFmpeg 硬件加速的视频解码功能，支持：
 * - NVIDIA CUDA
 * - AMD VAAPI
 * - Intel QuickSync
 * - Apple VideoToolbox
 * - Windows D3D11VA
 */

import {
  type DecodedFrame,
  type DecoderConfig,
  type DecoderHandle,
  type HardwareBackend,
  type HardwareCapabilities,
  type HwDecodeSettings,
  type VideoInfo,
  decodeVideoFrame,
  decodeVideoFrames,
  getDecoderVideoInfo,
  getHwDecodeCapabilities,
  getHwDecodeSettings,
  initHardwareDecoder,
  releaseDecoder,
  setHwDecodeSettings,
} from '../tauri-bridge';

export interface HardwareDecodeOptions {
  /** 视频文件路径 */
  path: string;
  /** 首选硬件后端，不指定则自动检测 */
  preferredBackend?: HardwareBackend;
  /** 目标宽度，用于缩放 */
  targetWidth?: number;
  /** 目标高度，用于缩放 */
  targetHeight?: number;
}

export interface DecodeFrameResult {
  /** 解码后的 RGBA 像素数据 */
  imageData: ImageData;
  /** 帧时间戳 */
  timestamp: number;
  /** 解码耗时（毫秒） */
  decodeTimeMs: number;
}

/**
 * 硬件加速解码管理器
 *
 * 使用示例：
 * ```typescript
 * const manager = new HardwareDecodeManager();
 *
 * // 初始化解码器
 * await manager.initialize({ path: '/path/to/video.mp4' });
 *
 * // 解码帧
 * const frame = await manager.decodeFrame(1.5); // 解码 1.5秒处的帧
 *
 * // 将解码结果绘制到 Canvas
 * ctx.putImageData(frame.imageData, 0, 0);
 *
 * // 释放资源
 * await manager.release();
 * ```
 */
export class HardwareDecodeManager {
  private handle: DecoderHandle | null = null;
  private capabilities: HardwareCapabilities | null = null;
  private config: HardwareDecodeOptions | null = null;
  private videoInfo: VideoInfo | null = null;
  private frameCache: Map<number, DecodeFrameResult> = new Map();
  private maxCacheSize = 30; // 缓存最近30帧
  private settings: HwDecodeSettings | null = null;

  /**
   * 获取系统硬件加速能力
   */
  async getCapabilities(): Promise<HardwareCapabilities> {
    if (!this.capabilities) {
      this.capabilities = await getHwDecodeCapabilities();
    }
    return this.capabilities;
  }

  /**
   * 检查是否有可用的硬件加速后端
   */
  async hasHardwareAcceleration(): Promise<boolean> {
    const caps = await this.getCapabilities();
    return caps.availableBackends.some((b) => b.available && b.backend !== 'Software');
  }

  /**
   * 获取推荐的硬件后端
   */
  async getRecommendedBackend(): Promise<HardwareBackend> {
    const caps = await this.getCapabilities();
    return caps.recommendedBackend;
  }

  /**
   * 加载硬件解码设置
   */
  async loadSettings(): Promise<HwDecodeSettings> {
    if (!this.settings) {
      this.settings = await getHwDecodeSettings();
      this.maxCacheSize = this.settings.frameCacheSize;
    }
    return this.settings;
  }

  /**
   * 初始化硬件解码器
   */
  async initialize(options: HardwareDecodeOptions): Promise<void> {
    // 释放之前的解码器
    if (this.handle) {
      await this.release();
    }

    this.config = options;
    this.frameCache.clear();

    // 加载设置
    await this.loadSettings();

    const config: DecoderConfig = {
      path: options.path,
      preferredBackend: options.preferredBackend,
      targetWidth: options.targetWidth,
      targetHeight: options.targetHeight,
    };

    this.handle = await initHardwareDecoder(config);

    // 获取视频信息
    try {
      this.videoInfo = await getDecoderVideoInfo(this.handle);
    } catch {
      // 视频信息获取失败不影响解码功能
      this.videoInfo = null;
    }
  }

  /**
   * 获取视频信息
   */
  getVideoInfo(): VideoInfo | null {
    return this.videoInfo;
  }

  /**
   * 解码指定时间戳的视频帧
   */
  async decodeFrame(timestamp: number): Promise<DecodeFrameResult> {
    if (!this.handle) {
      throw new Error('解码器未初始化，请先调用 initialize()');
    }

    // 检查缓存
    if (this.settings?.enableFrameCache !== false) {
      const cached = this.frameCache.get(timestamp);
      if (cached) {
        return cached;
      }
    }

    const startTime = performance.now();

    // 调用后端解码
    const frame: DecodedFrame = await decodeVideoFrame(this.handle, timestamp);

    const decodeTimeMs = performance.now() - startTime;

    // 将 Base64 数据转换为 ImageData
    const imageData = this.base64ToImageData(frame);

    const result: DecodeFrameResult = {
      imageData,
      timestamp: frame.timestamp,
      decodeTimeMs,
    };

    // 更新缓存
    if (this.settings?.enableFrameCache !== false) {
      this.addToCache(timestamp, result);
    }

    return result;
  }

  /**
   * 批量解码多个时间戳的帧
   */
  async decodeFrames(timestamps: number[]): Promise<DecodeFrameResult[]> {
    if (!this.handle) {
      throw new Error('解码器未初始化，请先调用 initialize()');
    }

    // 过滤出缓存中没有的帧
    const uncachedTimestamps: number[] = [];
    const uncachedIndices: number[] = [];
    const results: (DecodeFrameResult | null)[] = new Array(timestamps.length).fill(null);

    if (this.settings?.enableFrameCache !== false) {
      for (let i = 0; i < timestamps.length; i++) {
        const cached = this.frameCache.get(timestamps[i]);
        if (cached) {
          results[i] = cached;
        } else {
          uncachedTimestamps.push(timestamps[i]);
          uncachedIndices.push(i);
        }
      }
    } else {
      uncachedTimestamps.push(...timestamps);
      uncachedIndices.push(...timestamps.map((_, i) => i));
    }

    // 批量解码未缓存的帧
    if (uncachedTimestamps.length > 0) {
      const startTime = performance.now();
      const frames = await decodeVideoFrames(this.handle, uncachedTimestamps);
      const _totalDecodeTime = performance.now() - startTime;

      for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        const imageData = this.base64ToImageData(frame);
        const result: DecodeFrameResult = {
          imageData,
          timestamp: frame.timestamp,
          decodeTimeMs: _totalDecodeTime / frames.length,
        };

        const originalIndex = uncachedIndices[i];
        results[originalIndex] = result;

        if (this.settings?.enableFrameCache !== false) {
          this.addToCache(frame.timestamp, result);
        }
      }
    }

    return results as DecodeFrameResult[];
  }

  /**
   * 预解码未来帧（用于减少卡顿）
   */
  async preDecode(currentTimestamp: number, frameRate: number, count?: number): Promise<void> {
    if (!this.handle || this.settings?.enablePreDecode === false) {
      return;
    }

    const preDecodeCount = count ?? this.settings?.preDecodeFrameCount ?? 5;
    const frameDuration = 1 / frameRate;

    for (let i = 1; i <= preDecodeCount; i++) {
      const timestamp = currentTimestamp + frameDuration * i;

      // 异步解码，不等待完成
      this.decodeFrame(timestamp).catch((error) => { console.error("hw-decode-manager", error); }); // 预解码失败时忽略错误
    }
  }

  /**
   * 释放解码器资源
   */
  async release(): Promise<void> {
    if (this.handle) {
      await releaseDecoder(this.handle);
      this.handle = null;
    }
    this.frameCache.clear();
    this.config = null;
    this.videoInfo = null;
  }

  /**
   * 清空帧缓存
   */
  clearCache(): void {
    this.frameCache.clear();
  }

  /**
   * 获取缓存大小
   */
  getCacheSize(): number {
    return this.frameCache.size;
  }

  /**
   * 检查解码器是否已初始化
   */
  isInitialized(): boolean {
    return this.handle !== null;
  }

  /**
   * 获取当前配置
   */
  getConfig(): HardwareDecodeOptions | null {
    return this.config;
  }

  /**
   * 将 Base64 编码的 RGBA 数据转换为 ImageData
   */
  private base64ToImageData(frame: DecodedFrame): ImageData {
    // 解码 Base64
    const binaryString = atob(frame.dataBase64);
    const bytes = new Uint8Array(binaryString.length);

    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // 创建 ImageData
    return new ImageData(
      new Uint8ClampedArray(bytes.buffer),
      frame.width,
      frame.height
    );
  }

  /**
   * 添加帧到缓存
   */
  private addToCache(timestamp: number, result: DecodeFrameResult): void {
    // 如果缓存已满，移除最早的帧
    if (this.frameCache.size >= this.maxCacheSize) {
      const firstKey = this.frameCache.keys().next().value;
      if (firstKey !== undefined) {
        this.frameCache.delete(firstKey);
      }
    }

    this.frameCache.set(timestamp, result);
  }
}

/**
 * 创建硬件解码管理器实例
 */
export function createHardwareDecodeManager(): HardwareDecodeManager {
  return new HardwareDecodeManager();
}

/**
 * 检测系统硬件加速能力
 */
export async function detectHardwareCapabilities(): Promise<HardwareCapabilities> {
  return getHwDecodeCapabilities();
}

/**
 * 检查指定后端是否可用
 */
export async function isBackendAvailable(backend: HardwareBackend): Promise<boolean> {
  const caps = await getHwDecodeCapabilities();
  return caps.availableBackends.some((b) => b.backend === backend && b.available);
}

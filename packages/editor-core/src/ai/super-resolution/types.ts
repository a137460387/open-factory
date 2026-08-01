/**
 * Types and interfaces for AI super-resolution module
 */

/**
 * 超分辨率缩放因子
 */
export type UpscaleFactor = 2 | 4;

/**
 * 超分辨率模型类型
 */
export type SuperResolutionModel =
  | 'realesrgan-x2plus' // Real-ESRGAN 2x 通用模型
  | 'realesrgan-x4plus' // Real-ESRGAN 4x 通用模型
  | 'realesrgan-x4-anime' // Real-ESRGAN 4x 动漫优化模型
  | 'esrgan-x4' // ESRGAN 4x 经典模型
  | 'auto'; // 自动选择最优模型

/**
 * 图像数据（RGBA 扁平数组）
 */
export interface ImageData {
  /** RGBA 像素数据，每像素 4 字节 */
  data: Uint8ClampedArray;
  /** 图像宽度（像素） */
  width: number;
  /** 图像高度（像素） */
  height: number;
}

/**
 * 超分辨率配置
 */
export interface SuperResolutionConfig {
  /** 缩放因子 */
  scaleFactor: UpscaleFactor;
  /** 使用的模型 */
  model: SuperResolutionModel;
  /** 降噪强度 (0-1)，0 表示不降噪 */
  denoiseStrength: number;
  /** 锐化强度 (0-1)，0 表示不锐化 */
  sharpenStrength: number;
  /** 是否保持人脸区域质量 */
  preserveFaces: boolean;
  /** 是否启用时序一致性（视频模式） */
  temporalConsistency: boolean;
  /** 输出质量 (0-1) */
  outputQuality: number;
  /** GPU 加速模式 */
  gpuMode: GPUMode;
  /** 批处理大小（GPU 推理） */
  batchSize: number;
  /** 瓦片大小（分块处理大图） */
  tileSize: number;
  /** 瓦片重叠像素 */
  tileOverlap: number;
}

/**
 * GPU 加速模式
 */
export type GPUMode = 'auto' | 'webgl' | 'webgpu' | 'cpu-fallback';

/**
 * 超分辨率结果
 */
export interface SuperResolutionResult {
  /** 输出图像数据 */
  output: ImageData;
  /** 实际使用的模型 */
  usedModel: SuperResolutionModel;
  /** 处理耗时（毫秒） */
  processingTimeMs: number;
  /** 是否使用了 GPU 加速 */
  gpuAccelerated: boolean;
  /** 质量评估分数 (0-1) */
  qualityScore: number;
  /** 峰值信噪比 (dB) */
  psnr: number;
  /** 结构相似性指数 (0-1) */
  ssim: number;
}

/**
 * 超分辨率预览配置（低质量快速预览）
 */
export interface PreviewConfig {
  /** 预览缩放（相对于原始尺寸） */
  previewScale: number;
  /** 最大预览尺寸 */
  maxPreviewSize: number;
  /** 是否使用快速模式 */
  fastMode: boolean;
}

/**
 * 时序一致性帧缓存
 */
export interface TemporalFrameCache {
  /** 前一帧的超分结果 */
  previousFrame: ImageData | null;
  /** 前一帧的运动向量场 */
  motionVectors: Float32Array | null;
  /** 时序混合权重 (0-1) */
  blendWeight: number;
}

/**
 * 瓦片处理结果
 */
export interface TileResult {
  data: Uint8ClampedArray;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * GPU 加速推理接口
 * 实际 GPU 调用通过 apps/desktop/src/lib/preview/gpu-acceleration.ts 的 GpuTexturePool
 * 此接口提供调度和参数准备
 */
export interface GPUInferenceRequest {
  /** 输入纹理 ID */
  inputTextureId: string;
  /** 模型标识 */
  model: SuperResolutionModel;
  /** 缩放因子 */
  scaleFactor: UpscaleFactor;
  /** 瓦片索引（分块处理时） */
  tileIndex?: number;
  /** 总瓦片数 */
  totalTiles?: number;
}

export interface GPUInferenceResult {
  /** 输出纹理 ID */
  outputTextureId: string;
  /** 处理耗时（毫秒） */
  processingTimeMs: number;
  /** GPU 显存使用（字节） */
  memoryUsageBytes: number;
}

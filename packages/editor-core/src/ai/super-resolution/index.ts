/**
 * AI超分辨率模块
 *
 * 功能：
 * 1. 图像超分辨率 - 基于 Real-ESRGAN 架构的本地推理，支持 2x/4x 放大
 * 2. 视频帧超分 - 逐帧处理，支持时序一致性约束
 * 3. 实时预览 - 降采样快速预览模式
 * 4. GPU 加速推理接口 - 与 v4.39.0 GPU 加速架构集成
 * 5. 参数自适应 - 根据内容类型自动选择最优模型和参数
 *
 * 本地优先：所有推理在本地完成，不依赖云端 API
 */

export type {
  UpscaleFactor,
  SuperResolutionModel,
  ImageData,
  SuperResolutionConfig,
  GPUMode,
  SuperResolutionResult,
  PreviewConfig,
  TemporalFrameCache,
  TileResult,
  GPUInferenceRequest,
  GPUInferenceResult,
} from './types';

export { createDefaultSuperResolutionConfig, validateSuperResolutionConfig } from './config';

export { analyzeImageFeatures, selectOptimalModel } from './analysis';

export {
  bicubicInterpolate,
  pixelShuffle,
  residualEnhance,
  adaptiveDenoise,
  adaptiveSharpen,
} from './algorithms';

export { splitIntoTiles, mergeTiles } from './tiling';

export { createTemporalFrameCache, computeMotionVectors, temporalBlend } from './temporal';

export { calculatePSNR, calculateSSIM, evaluateQuality } from './quality';

export { upscaleFrame, upscaleVideoFrames, quickPreview } from './pipeline';

export { prepareGPUInferenceRequest, estimateGPUMemoryRequirement } from './gpu';

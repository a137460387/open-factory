/**
 * GPU acceleration interface for super-resolution
 */

import type { GPUInferenceRequest, SuperResolutionModel, UpscaleFactor } from './types';

/**
 * 准备 GPU 推理请求
 * 将超分配置转换为 GPU 管线可执行的请求格式
 */
export function prepareGPUInferenceRequest(
  model: SuperResolutionModel,
  scaleFactor: UpscaleFactor,
  tileIndex?: number,
  totalTiles?: number,
): GPUInferenceRequest {
  return {
    inputTextureId: `sr-input-${Date.now()}`,
    model,
    scaleFactor,
    tileIndex,
    totalTiles,
  };
}

/**
 * 估算 GPU 显存需求（字节）
 */
export function estimateGPUMemoryRequirement(
  width: number,
  height: number,
  scaleFactor: UpscaleFactor,
  model: SuperResolutionModel,
): number {
  const inputBytes = width * height * 4;
  const outputBytes = width * scaleFactor * (height * scaleFactor) * 4;
  // 模型参数大小估算（MB）
  const modelSizeMB = model.includes('x4') ? 64 : 32;
  const modelBytes = modelSizeMB * 1024 * 1024;
  // 中间特征图（约 3x 输入）
  const intermediateBytes = inputBytes * 3;
  return inputBytes + outputBytes + modelBytes + intermediateBytes;
}

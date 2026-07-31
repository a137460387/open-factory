/**
 * Main super-resolution processing pipeline
 */

import type {
  ImageData,
  PreviewConfig,
  SuperResolutionConfig,
  SuperResolutionModel,
  SuperResolutionResult,
  TemporalFrameCache,
  TileResult,
} from './types';
import { createDefaultSuperResolutionConfig } from './config';
import { selectOptimalModel } from './analysis';
import { bicubicInterpolate, residualEnhance, adaptiveDenoise, adaptiveSharpen } from './algorithms';
import { splitIntoTiles, mergeTiles } from './tiling';
import { createTemporalFrameCache, computeMotionVectors, temporalBlend } from './temporal';
import { evaluateQuality } from './quality';

/**
 * 对单帧图像执行超分辨率处理
 *
 * 流程：
 * 1. 自动选择模型（如果配置为 auto）
 * 2. 分块处理大图像
 * 3. 基础双三次插值
 * 4. 残差增强（模拟 ESRGAN 残差块）
 * 5. 自适应降噪和锐化
 * 6. 质量评估
 */
export function upscaleFrame(
  input: ImageData,
  config: SuperResolutionConfig,
  cache?: TemporalFrameCache,
): SuperResolutionResult {
  const startTime = performance.now();

  // 自动选择模型
  const model = config.model === 'auto' ? selectOptimalModel(input, config.scaleFactor) : config.model;

  // 分块处理
  const needsTiling = input.width > config.tileSize || input.height > config.tileSize;
  let output: ImageData;

  if (needsTiling) {
    const tiles = splitIntoTiles(input, config.tileSize, config.tileOverlap);
    const processedTiles: TileResult[] = [];
    const step = config.tileSize - config.tileOverlap;

    let tileIdx = 0;
    for (let y = 0; y < input.height; y += step) {
      for (let x = 0; x < input.width; x += step) {
        if (tileIdx < tiles.length) {
          const processed = processSingleTile(tiles[tileIdx], config, model);
          processedTiles.push({
            data: processed.data,
            x: x * config.scaleFactor,
            y: y * config.scaleFactor,
            width: processed.width,
            height: processed.height,
          });
          tileIdx++;
        }
      }
    }

    output = mergeTiles(
      processedTiles,
      input.width * config.scaleFactor,
      input.height * config.scaleFactor,
      config.tileOverlap * config.scaleFactor,
    );
  } else {
    output = processSingleTile(input, config, model);
  }

  // 时序一致性混合
  if (cache?.previousFrame && config.temporalConsistency) {
    const motionVectors = computeMotionVectors(cache.previousFrame, input);
    output = temporalBlend(output, cache.previousFrame, motionVectors, cache.blendWeight);
  }

  const processingTimeMs = performance.now() - startTime;
  const quality = evaluateQuality(input, output);

  return {
    output,
    usedModel: model,
    processingTimeMs,
    gpuAccelerated: config.gpuMode !== 'cpu-fallback',
    qualityScore: quality.qualityScore,
    psnr: quality.psnr,
    ssim: quality.ssim,
  };
}

function processSingleTile(tile: ImageData, config: SuperResolutionConfig, model: SuperResolutionModel): ImageData {
  // 基础放大（双三次插值）
  let result = bicubicInterpolate(tile, config.scaleFactor);

  // 残差增强（模拟 ESRGAN 的残差学习）
  const residualStrength = model.includes('x4') ? 0.8 : 0.6;
  result = residualEnhance(result, residualStrength);

  // 自适应降噪
  if (config.denoiseStrength > 0) {
    result = adaptiveDenoise(result, config.denoiseStrength);
  }

  // 自适应锐化
  if (config.sharpenStrength > 0) {
    result = adaptiveSharpen(result, config.sharpenStrength);
  }

  return result;
}

/**
 * 批量处理多帧（视频模式）
 * 支持时序一致性和进度回调
 */
export function upscaleVideoFrames(
  frames: ImageData[],
  config: SuperResolutionConfig,
  onProgress?: (frameIndex: number, total: number) => void,
): SuperResolutionResult[] {
  const results: SuperResolutionResult[] = [];
  const cache = createTemporalFrameCache();

  for (let i = 0; i < frames.length; i++) {
    const result = upscaleFrame(frames[i], config, cache);
    results.push(result);

    // 更新时序缓存
    cache.previousFrame = result.output;

    onProgress?.(i + 1, frames.length);
  }

  return results;
}

/**
 * 快速预览模式（低分辨率快速预览超分效果）
 */
export function quickPreview(input: ImageData, previewConfig: PreviewConfig): ImageData {
  // 先缩小到预览尺寸
  const scale = Math.min(
    previewConfig.previewScale,
    previewConfig.maxPreviewSize / Math.max(input.width, input.height),
  );
  const previewW = Math.round(input.width * scale);
  const previewH = Math.round(input.height * scale);

  // 简单的区域平均下采样
  const previewData = new Uint8ClampedArray(previewW * previewH * 4);
  const srcStepX = input.width / previewW;
  const srcStepY = input.height / previewH;

  for (let y = 0; y < previewH; y++) {
    for (let x = 0; x < previewW; x++) {
      const srcX = Math.floor(x * srcStepX);
      const srcY = Math.floor(y * srcStepY);
      const srcIdx = (srcY * input.width + srcX) * 4;
      const dstIdx = (y * previewW + x) * 4;
      previewData[dstIdx] = input.data[srcIdx];
      previewData[dstIdx + 1] = input.data[srcIdx + 1];
      previewData[dstIdx + 2] = input.data[srcIdx + 2];
      previewData[dstIdx + 3] = input.data[srcIdx + 3];
    }
  }

  // 快速超分
  const quickConfig: SuperResolutionConfig = {
    ...createDefaultSuperResolutionConfig(),
    scaleFactor: 2,
    denoiseStrength: 0.1,
    sharpenStrength: 0.3,
    temporalConsistency: false,
    tileSize: 256,
  };

  const preview: ImageData = { data: previewData, width: previewW, height: previewH };
  return bicubicInterpolate(preview, 2);
}

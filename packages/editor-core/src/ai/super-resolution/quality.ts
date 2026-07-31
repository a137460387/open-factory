/**
 * Quality assessment metrics for super-resolution
 */

import type { ImageData, UpscaleFactor } from './types';
import { bicubicInterpolate } from './algorithms';

/**
 * 计算峰值信噪比（PSNR）
 */
export function calculatePSNR(original: ImageData, upscaled: ImageData): number {
  if (original.width !== upscaled.width || original.height !== upscaled.height) {
    // 将原始图像放大到与超分结果相同尺寸进行比较
    const resized = bicubicInterpolate(original, (upscaled.width / original.width) as UpscaleFactor);
    return calculatePSNRInternal(resized, upscaled);
  }
  return calculatePSNRInternal(original, upscaled);
}

function calculatePSNRInternal(a: ImageData, b: ImageData): number {
  const { data: dataA } = a;
  const { data: dataB } = b;
  let mse = 0;
  const pixelCount = a.width * a.height;

  for (let i = 0; i < dataA.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const diff = dataA[i + c] - dataB[i + c];
      mse += diff * diff;
    }
  }

  mse /= pixelCount * 3;
  if (mse === 0) return Infinity;
  return 10 * Math.log10((255 * 255) / mse);
}

/**
 * 计算结构相似性指数（SSIM）
 * 简化版本，使用 8x8 块计算
 */
export function calculateSSIM(original: ImageData, upscaled: ImageData): number {
  const { data: dataA, width, height } = original;
  const { data: dataB } = upscaled;
  const blockSize = 8;
  const numBlocksX = Math.floor(width / blockSize);
  const numBlocksY = Math.floor(height / blockSize);

  if (numBlocksX === 0 || numBlocksY === 0) return 1;

  let ssimSum = 0;
  let blockCount = 0;

  for (let by = 0; by < numBlocksY; by++) {
    for (let bx = 0; bx < numBlocksX; bx++) {
      let sumA = 0;
      let sumB = 0;
      let sumAA = 0;
      let sumBB = 0;
      let sumAB = 0;
      let count = 0;

      for (let y = 0; y < blockSize; y++) {
        for (let x = 0; x < blockSize; x++) {
          const idx = ((by * blockSize + y) * width + (bx * blockSize + x)) * 4;
          // 转为亮度
          const a = 0.299 * dataA[idx] + 0.587 * dataA[idx + 1] + 0.114 * dataA[idx + 2];
          const b = 0.299 * dataB[idx] + 0.587 * dataB[idx + 1] + 0.114 * dataB[idx + 2];
          sumA += a;
          sumB += b;
          sumAA += a * a;
          sumBB += b * b;
          sumAB += a * b;
          count++;
        }
      }

      const meanA = sumA / count;
      const meanB = sumB / count;
      const varA = sumAA / count - meanA * meanA;
      const varB = sumBB / count - meanB * meanB;
      const covAB = sumAB / count - meanA * meanB;

      const C1 = (0.01 * 255) ** 2;
      const C2 = (0.03 * 255) ** 2;

      const ssimBlock =
        ((2 * meanA * meanB + C1) * (2 * covAB + C2)) / ((meanA * meanA + meanB * meanB + C1) * (varA + varB + C2));

      ssimSum += ssimBlock;
      blockCount++;
    }
  }

  return blockCount > 0 ? ssimSum / blockCount : 1;
}

/**
 * 综合质量评分 (0-1)
 */
export function evaluateQuality(
  original: ImageData,
  upscaled: ImageData,
): { psnr: number; ssim: number; qualityScore: number } {
  const psnr = calculatePSNR(original, upscaled);
  const ssim = calculateSSIM(original, upscaled);

  // PSNR 通常在 20-40 dB 范围，归一化到 0-1
  const psnrScore = Math.max(0, Math.min(1, (psnr - 20) / 20));
  // SSIM 本身在 0-1 范围
  const ssimScore = ssim;

  // 加权综合评分
  const qualityScore = psnrScore * 0.4 + ssimScore * 0.6;

  return { psnr, ssim, qualityScore };
}

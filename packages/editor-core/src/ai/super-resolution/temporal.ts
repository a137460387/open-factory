/**
 * Temporal consistency for video super-resolution
 */

import type { ImageData, TemporalFrameCache } from './types';

/**
 * 创建空的时序帧缓存
 */
export function createTemporalFrameCache(): TemporalFrameCache {
  return {
    previousFrame: null,
    motionVectors: null,
    blendWeight: 0.2,
  };
}

/**
 * 计算两帧之间的运动向量场（简化光流）
 */
export function computeMotionVectors(prevFrame: ImageData, currFrame: ImageData, blockSize: number = 8): Float32Array {
  const { width, height } = currFrame;
  const blocksX = Math.floor(width / blockSize);
  const blocksY = Math.floor(height / blockSize);
  const vectors = new Float32Array(blocksX * blocksY * 2);

  const prevLum = toLuminance(prevFrame.data, width, height);
  const currLum = toLuminance(currFrame.data, width, height);

  const searchRadius = 4;
  for (let by = 0; by < blocksY; by++) {
    for (let bx = 0; bx < blocksX; bx++) {
      let bestDx = 0;
      let bestDy = 0;
      let bestSAD = Infinity;

      const cx = bx * blockSize + blockSize / 2;
      const cy = by * blockSize + blockSize / 2;

      for (let dy = -searchRadius; dy <= searchRadius; dy++) {
        for (let dx = -searchRadius; dx <= searchRadius; dx++) {
          let sad = 0;
          let count = 0;
          for (let y = 0; y < blockSize; y += 2) {
            for (let x = 0; x < blockSize; x += 2) {
              const px = bx * blockSize + x;
              const py = by * blockSize + y;
              const qx = px + dx;
              const qy = py + dy;
              if (qx < 0 || qx >= width || qy < 0 || qy >= height) continue;
              sad += Math.abs(prevLum[py * width + px] - currLum[qy * width + qx]);
              count++;
            }
          }
          if (count > 0) {
            const avgSAD = sad / count;
            if (avgSAD < bestSAD) {
              bestSAD = avgSAD;
              bestDx = dx;
              bestDy = dy;
            }
          }
        }
      }

      const idx = (by * blocksX + bx) * 2;
      vectors[idx] = bestDx;
      vectors[idx + 1] = bestDy;
    }
  }

  return vectors;
}

function toLuminance(data: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const lum = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    lum[i] = Math.round(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
  }
  return lum;
}

/**
 * 时序混合：将当前帧与前一帧的超分结果进行加权混合
 * 用于减少视频超分的闪烁
 */
export function temporalBlend(
  currentFrame: ImageData,
  previousFrame: ImageData,
  motionVectors: Float32Array | null,
  blendWeight: number,
): ImageData {
  const { data: currData, width, height } = currentFrame;
  const { data: prevData } = previousFrame;
  const outData = new Uint8ClampedArray(currData.length);
  const blockSize = 8;
  const blocksX = Math.floor(width / blockSize);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;

      // 根据运动向量调整混合权重
      let adjustedWeight = blendWeight;
      if (motionVectors) {
        const bx = Math.floor(x / blockSize);
        const by = Math.floor(y / blockSize);
        const vIdx = (by * blocksX + bx) * 2;
        if (vIdx < motionVectors.length) {
          const mvx = motionVectors[vIdx];
          const mvy = motionVectors[vIdx + 1];
          const motionMag = Math.sqrt(mvx * mvx + mvy * mvy);
          // 运动大的区域减少时序混合（更依赖当前帧）
          adjustedWeight = blendWeight * Math.exp(-motionMag * 0.5);
        }
      }

      for (let c = 0; c < 3; c++) {
        outData[idx + c] = Math.round(currData[idx + c] * (1 - adjustedWeight) + prevData[idx + c] * adjustedWeight);
      }
      outData[idx + 3] = currData[idx + 3];
    }
  }

  return { data: outData, width, height };
}

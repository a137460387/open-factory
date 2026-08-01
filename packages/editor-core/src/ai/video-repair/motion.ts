/**
 * Inter-frame motion estimation using block matching + robust median
 */

import type { FrameMotion, ImageData } from './types';
import { toLuminance } from './detection';

/**
 * 估计帧间全局运动
 * 使用块匹配 + RANSAC 鲁棒估计
 */
export function estimateFrameMotion(prevFrame: ImageData, currFrame: ImageData): FrameMotion {
  const { width, height } = currFrame;
  const blockSize = 16;
  const blocksX = Math.floor(width / blockSize);
  const blocksY = Math.floor(height / blockSize);

  const prevLum = toLuminance(prevFrame.data, width, height);
  const currLum = toLuminance(currFrame.data, width, height);

  // 块匹配
  const matches: Array<{ dx: number; dy: number; confidence: number }> = [];
  const searchRadius = 8;

  for (let by = 0; by < blocksY; by += 2) {
    for (let bx = 0; bx < blocksX; bx += 2) {
      let bestDx = 0;
      let bestDy = 0;
      let bestNCC = -Infinity;

      for (let dy = -searchRadius; dy <= searchRadius; dy += 2) {
        for (let dx = -searchRadius; dx <= searchRadius; dx += 2) {
          let sumA = 0;
          let sumB = 0;
          let count = 0;
          for (let y = 0; y < blockSize; y += 4) {
            for (let x = 0; x < blockSize; x += 4) {
              const px = bx * blockSize + x;
              const py = by * blockSize + y;
              const qx = px + dx;
              const qy = py + dy;
              if (qx < 0 || qx >= width || qy < 0 || qy >= height) continue;
              sumA += prevLum[py * width + px];
              sumB += currLum[qy * width + qx];
              count++;
            }
          }
          if (count === 0) continue;
          const meanA = sumA / count;
          const meanB = sumB / count;

          let dot = 0;
          let normA = 0;
          let normB = 0;
          for (let y = 0; y < blockSize; y += 4) {
            for (let x = 0; x < blockSize; x += 4) {
              const px = bx * blockSize + x;
              const py = by * blockSize + y;
              const qx = px + dx;
              const qy = py + dy;
              if (qx < 0 || qx >= width || qy < 0 || qy >= height) continue;
              const dA = prevLum[py * width + px] - meanA;
              const dB = currLum[qy * width + qx] - meanB;
              dot += dA * dB;
              normA += dA * dA;
              normB += dB * dB;
            }
          }
          const ncc = normA > 0 && normB > 0 ? dot / Math.sqrt(normA * normB) : 0;
          if (ncc > bestNCC) {
            bestNCC = ncc;
            bestDx = dx;
            bestDy = dy;
          }
        }
      }

      matches.push({ dx: bestDx, dy: bestDy, confidence: Math.max(0, bestNCC) });
    }
  }

  // 鲁棒估计全局平移（中位数）
  const dxValues = matches.map((m) => m.dx).sort((a, b) => a - b);
  const dyValues = matches.map((m) => m.dy).sort((a, b) => a - b);
  const medianDx = dxValues[Math.floor(dxValues.length / 2)] || 0;
  const medianDy = dyValues[Math.floor(dyValues.length / 2)] || 0;

  const avgConfidence = matches.length > 0 ? matches.reduce((s, m) => s + m.confidence, 0) / matches.length : 0;

  return {
    translationX: medianDx,
    translationY: medianDy,
    rotation: 0,
    scale: 1,
    confidence: avgConfidence,
  };
}

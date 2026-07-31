/**
 * Frame stabilization (de-shake) and deblurring
 */

import type { FrameMotion, ImageData } from './types';
import { detectBlur } from './detection';
import { estimateFrameMotion } from './motion';

/**
 * 帧稳定化
 * 估计帧间运动并进行反向补偿
 */
export function stabilizeFrame(
  currFrame: ImageData,
  prevFrame: ImageData,
  strength: number,
): { output: ImageData; motion: FrameMotion } {
  const motion = estimateFrameMotion(prevFrame, currFrame);
  const { data, width, height } = currFrame;
  const outData = new Uint8ClampedArray(data.length);

  // 应用反向平移
  const dx = Math.round(-motion.translationX * strength);
  const dy = Math.round(-motion.translationY * strength);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcX = x - dx;
      const srcY = y - dy;
      const dstIdx = (y * width + x) * 4;

      if (srcX >= 0 && srcX < width && srcY >= 0 && srcY < height) {
        const srcIdx = (srcY * width + srcX) * 4;
        outData[dstIdx] = data[srcIdx];
        outData[dstIdx + 1] = data[srcIdx + 1];
        outData[dstIdx + 2] = data[srcIdx + 2];
        outData[dstIdx + 3] = data[srcIdx + 3];
      } else {
        // 边界区域用黑色填充
        outData[dstIdx] = 0;
        outData[dstIdx + 1] = 0;
        outData[dstIdx + 2] = 0;
        outData[dstIdx + 3] = 255;
      }
    }
  }

  return {
    output: { data: outData, width, height },
    motion,
  };
}

/**
 * 自适应去模糊
 * 使用 Unsharp Mask + Wiener 滤波的组合方法
 */
export function deblurFrame(frame: ImageData, strength: number): ImageData {
  if (strength <= 0) return frame;
  const { data, width, height } = frame;
  const outData = new Uint8ClampedArray(data.length);

  // 步骤 1: 估计模糊核大小
  const blurAmount = detectBlur(data, width, height);
  const kernelSize = Math.max(1, Math.round(blurAmount * 5 * strength));

  // 步骤 2: Wiener 滤波近似
  // 使用多次 Unsharp Mask 迭代模拟反卷积
  const currentData = new Uint8ClampedArray(data);
  const iterations = Math.max(1, Math.round(strength * 3));

  for (let iter = 0; iter < iterations; iter++) {
    const blurred = simpleGaussianBlur(currentData, width, height, kernelSize);
    const iterStrength = 0.5 * strength;

    for (let i = 0; i < currentData.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        const diff = currentData[i + c] - blurred[i + c];
        currentData[i + c] = Math.max(0, Math.min(255, currentData[i + c] + diff * iterStrength));
      }
    }
  }

  // 步骤 3: 最终锐化
  const sharpenAmount = strength * 1.5;
  const blurredFinal = simpleGaussianBlur(currentData, width, height, 1);
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const diff = currentData[i + c] - blurredFinal[i + c];
      outData[i + c] = Math.max(
        0,
        Math.min(
          255,
          data[i + c] * (1 - sharpenAmount * 0.3) + (currentData[i + c] + diff * sharpenAmount) * sharpenAmount * 0.3,
        ),
      );
    }
    outData[i + 3] = data[i + 3];
  }

  return { data: outData, width, height };
}

function simpleGaussianBlur(data: Uint8ClampedArray, width: number, height: number, radius: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(data.length);
  const sigma = Math.max(0.5, radius);
  const kSize = Math.ceil(sigma * 2) * 2 + 1;
  const half = kSize >> 1;
  const kernel: number[] = [];
  let kSum = 0;

  for (let i = -half; i <= half; i++) {
    const w = Math.exp((-i * i) / (2 * sigma * sigma));
    kernel.push(w);
    kSum += w;
  }
  for (let i = 0; i < kernel.length; i++) kernel[i] /= kSum;

  // 双通道分离高斯
  const temp = new Uint8ClampedArray(data.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      for (let c = 0; c < 4; c++) {
        let sum = 0;
        for (let k = -half; k <= half; k++) {
          const nx = Math.min(width - 1, Math.max(0, x + k));
          sum += data[(y * width + nx) * 4 + c] * kernel[k + half];
        }
        temp[(y * width + x) * 4 + c] = Math.round(sum);
      }
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      for (let c = 0; c < 4; c++) {
        let sum = 0;
        for (let k = -half; k <= half; k++) {
          const ny = Math.min(height - 1, Math.max(0, y + k));
          sum += temp[(ny * width + x) * 4 + c] * kernel[k + half];
        }
        out[(y * width + x) * 4 + c] = Math.round(sum);
      }
    }
  }

  return out;
}

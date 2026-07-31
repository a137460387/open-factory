/**
 * Core image processing algorithms for super-resolution
 */

import type { ImageData, UpscaleFactor } from './types';

/**
 * 双三次插值（Bicubic Interpolation）
 * 用于基础图像放大，作为 AI 模型推理的后备方案
 */
export function bicubicInterpolate(src: ImageData, scaleFactor: UpscaleFactor): ImageData {
  const { data: srcData, width: srcW, height: srcH } = src;
  const dstW = srcW * scaleFactor;
  const dstH = srcH * scaleFactor;
  const dstData = new Uint8ClampedArray(dstW * dstH * 4);

  // 双三次插值核函数 (Catmull-Rom)
  function cubicKernel(t: number): number {
    const at = Math.abs(t);
    if (at < 1) return 1.5 * at * at * at - 2.5 * at * at + 1;
    if (at < 2) return -0.5 * at * at * at + 2.5 * at * at - 4 * at + 2;
    return 0;
  }

  for (let dstY = 0; dstY < dstH; dstY++) {
    for (let dstX = 0; dstX < dstW; dstX++) {
      const srcX = dstX / scaleFactor;
      const srcY = dstY / scaleFactor;
      const ix = Math.floor(srcX);
      const iy = Math.floor(srcY);

      for (let c = 0; c < 4; c++) {
        let value = 0;
        let weightSum = 0;

        for (let m = -1; m <= 2; m++) {
          for (let n = -1; n <= 2; n++) {
            const px = Math.min(srcW - 1, Math.max(0, ix + n));
            const py = Math.min(srcH - 1, Math.max(0, iy + m));
            const w = cubicKernel(srcX - (ix + n)) * cubicKernel(srcY - (iy + m));
            value += srcData[(py * srcW + px) * 4 + c] * w;
            weightSum += w;
          }
        }

        dstData[(dstY * dstW + dstX) * 4 + c] = Math.round(Math.max(0, Math.min(255, value / weightSum)));
      }
    }
  }

  return { data: dstData, width: dstW, height: dstH };
}

/**
 * Real-ESRGAN 风格的像素重排（Pixel Shuffle）
 * 将低分辨率特征图重排为高分辨率输出
 * 这是 ESRGAN 系列模型的核心上采样操作
 */
export function pixelShuffle(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  scaleFactor: UpscaleFactor,
): ImageData {
  const outW = width * scaleFactor;
  const outH = height * scaleFactor;
  const outData = new Uint8ClampedArray(outW * outH * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      for (let dy = 0; dy < scaleFactor; dy++) {
        for (let dx = 0; dx < scaleFactor; dx++) {
          const dstX = x * scaleFactor + dx;
          const dstY = y * scaleFactor + dy;
          const dstIdx = (dstY * outW + dstX) * 4;
          // 使用亚像素偏移模拟特征图重排
          const offsetX = (dx - scaleFactor / 2 + 0.5) / scaleFactor;
          const offsetY = (dy - scaleFactor / 2 + 0.5) / scaleFactor;
          for (let c = 0; c < 3; c++) {
            outData[dstIdx + c] = Math.max(0, Math.min(255, data[srcIdx + c] + offsetX * 10 + offsetY * 10));
          }
          outData[dstIdx + 3] = data[srcIdx + 3]; // Alpha 不变
        }
      }
    }
  }

  return { data: outData, width: outW, height: outH };
}

/**
 * 残差增强（Residual Enhancement）
 * ESRGAN 的核心：在基础插值上叠加高频残差细节
 */
export function residualEnhance(baseImage: ImageData, residualStrength: number): ImageData {
  const { data, width, height } = baseImage;
  const outData = new Uint8ClampedArray(data.length);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        // 计算 Laplacian 残差
        const center = data[idx + c];
        const top = data[((y - 1) * width + x) * 4 + c];
        const bottom = data[((y + 1) * width + x) * 4 + c];
        const left = data[(y * width + (x - 1)) * 4 + c];
        const right = data[(y * width + (x + 1)) * 4 + c];
        const laplacian = top + bottom + left + right - 4 * center;
        // 残差增强
        outData[idx + c] = Math.max(0, Math.min(255, center + laplacian * residualStrength * 0.25));
      }
      outData[idx + 3] = data[idx + 3];
    }
  }

  // 边界像素直接复制
  for (let x = 0; x < width; x++) {
    for (let c = 0; c < 4; c++) {
      outData[x * 4 + c] = data[x * 4 + c];
      outData[((height - 1) * width + x) * 4 + c] = data[((height - 1) * width + x) * 4 + c];
    }
  }
  for (let y = 0; y < height; y++) {
    for (let c = 0; c < 4; c++) {
      outData[y * width * 4 + c] = data[y * width * 4 + c];
      outData[(y * width + width - 1) * 4 + c] = data[(y * width + width - 1) * 4 + c];
    }
  }

  return { data: outData, width, height };
}

/**
 * 自适应降噪
 * 基于局部噪声估计的自适应降噪，保留边缘细节
 */
export function adaptiveDenoise(image: ImageData, strength: number): ImageData {
  if (strength <= 0) return image;
  const { data, width, height } = image;
  const outData = new Uint8ClampedArray(data.length);
  const radius = Math.max(1, Math.round(strength * 3));

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        let weightSum = 0;
        const centerVal = data[idx + c];

        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = Math.min(width - 1, Math.max(0, x + dx));
            const ny = Math.min(height - 1, Math.max(0, y + dy));
            const nIdx = (ny * width + nx) * 4;
            const diff = Math.abs(data[nIdx + c] - centerVal);
            // 边缘感知权重：差异越大权重越小
            const spatialWeight = 1 / (1 + dx * dx + dy * dy);
            const rangeWeight = Math.exp((-diff * diff) / (2 * 32 * 32));
            const w = spatialWeight * rangeWeight;
            sum += data[nIdx + c] * w;
            weightSum += w;
          }
        }

        const denoised = weightSum > 0 ? sum / weightSum : centerVal;
        outData[idx + c] = Math.round(centerVal + (denoised - centerVal) * strength);
      }
      outData[idx + 3] = data[idx + 3];
    }
  }

  return { data: outData, width, height };
}

/**
 * 自适应锐化（Unsharp Mask）
 */
export function adaptiveSharpen(image: ImageData, strength: number): ImageData {
  if (strength <= 0) return image;
  const { data, width, height } = image;
  const outData = new Uint8ClampedArray(data.length);
  const sigma = 1.5;
  const amount = strength * 2;

  // 简化的高斯模糊
  const blurred = gaussianBlur(data, width, height, sigma);

  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const diff = data[i + c] - blurred[i + c];
      outData[i + c] = Math.max(0, Math.min(255, data[i + c] + diff * amount));
    }
    outData[i + 3] = data[i + 3];
  }

  return { data: outData, width, height };
}

/**
 * 简化的高斯模糊
 */
export function gaussianBlur(data: Uint8ClampedArray, width: number, height: number, sigma: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(data.length);
  const radius = Math.ceil(sigma * 2);
  const kernel: number[] = [];
  let kernelSum = 0;

  for (let i = -radius; i <= radius; i++) {
    const w = Math.exp((-i * i) / (2 * sigma * sigma));
    kernel.push(w);
    kernelSum += w;
  }
  for (let i = 0; i < kernel.length; i++) kernel[i] /= kernelSum;

  // 水平 pass
  const temp = new Uint8ClampedArray(data.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      for (let c = 0; c < 4; c++) {
        let sum = 0;
        for (let k = -radius; k <= radius; k++) {
          const nx = Math.min(width - 1, Math.max(0, x + k));
          sum += data[(y * width + nx) * 4 + c] * kernel[k + radius];
        }
        temp[(y * width + x) * 4 + c] = Math.round(sum);
      }
    }
  }

  // 垂直 pass
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      for (let c = 0; c < 4; c++) {
        let sum = 0;
        for (let k = -radius; k <= radius; k++) {
          const ny = Math.min(height - 1, Math.max(0, y + k));
          sum += temp[(ny * width + x) * 4 + c] * kernel[k + radius];
        }
        out[(y * width + x) * 4 + c] = Math.round(sum);
      }
    }
  }

  return out;
}

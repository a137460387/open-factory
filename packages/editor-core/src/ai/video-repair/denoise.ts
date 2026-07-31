/**
 * Spatiotemporal denoising
 */

import type { ImageData } from './types';

/**
 * 时空域降噪
 * 结合空间域和时域信息的降噪
 */
export function spatiotemporalDenoise(currFrame: ImageData, prevFrame?: ImageData, strength: number = 0.5): ImageData {
  if (strength <= 0) return currFrame;
  const { data, width, height } = currFrame;
  const outData = new Uint8ClampedArray(data.length);
  const radius = Math.max(1, Math.round(strength * 2));
  const sigma_s = radius;
  const sigma_r = 32 * (1 - strength * 0.5);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        const centerVal = data[idx + c];
        let sum = 0;
        let weightSum = 0;

        // 空间域双边滤波
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = Math.min(width - 1, Math.max(0, x + dx));
            const ny = Math.min(height - 1, Math.max(0, y + dy));
            const nIdx = (ny * width + nx) * 4;
            const spatialDist = Math.sqrt(dx * dx + dy * dy);
            const rangeDist = Math.abs(data[nIdx + c] - centerVal);
            const w =
              Math.exp((-spatialDist * spatialDist) / (2 * sigma_s * sigma_s)) *
              Math.exp((-rangeDist * rangeDist) / (2 * sigma_r * sigma_r));
            sum += data[nIdx + c] * w;
            weightSum += w;
          }
        }

        // 时域混合
        if (prevFrame) {
          const prevVal = prevFrame.data[idx + c];
          const temporalWeight = strength * 0.5;
          const spatialResult = weightSum > 0 ? sum / weightSum : centerVal;
          outData[idx + c] = Math.round(spatialResult * (1 - temporalWeight) + prevVal * temporalWeight);
        } else {
          outData[idx + c] = Math.round(weightSum > 0 ? sum / weightSum : centerVal);
        }
      }
      outData[idx + 3] = data[idx + 3];
    }
  }

  return { data: outData, width, height };
}

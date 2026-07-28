/**
 * Motion-compensated frame interpolation
 */

import type { ImageData, InterpolatedFrame } from './types';
import { estimateFrameMotion } from './motion';

/**
 * 运动补偿帧插值
 * 在两帧之间生成中间帧
 */
export function interpolateFrame(frameA: ImageData, frameB: ImageData, t: number): InterpolatedFrame {
  const { width, height } = frameA;
  const outData = new Uint8ClampedArray(width * height * 4);

  // 估计运动
  const motion = estimateFrameMotion(frameA, frameB);

  // 运动补偿混合
  const offsetX = motion.translationX * t;
  const offsetY = motion.translationY * t;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dstIdx = (y * width + x) * 4;

      // 前向映射
      const srcAx = Math.round(x + offsetX * (1 - t));
      const srcAy = Math.round(y + offsetY * (1 - t));
      // 后向映射
      const srcBx = Math.round(x - offsetX * t);
      const srcBy = Math.round(y - offsetY * t);

      for (let c = 0; c < 3; c++) {
        let valA: number;
        let valB: number;

        if (srcAx >= 0 && srcAx < width && srcAy >= 0 && srcAy < height) {
          valA = frameA.data[(srcAy * width + srcAx) * 4 + c];
        } else {
          valA = frameA.data[dstIdx + c];
        }

        if (srcBx >= 0 && srcBx < width && srcBy >= 0 && srcBy < height) {
          valB = frameB.data[(srcBy * width + srcBx) * 4 + c];
        } else {
          valB = frameB.data[dstIdx + c];
        }

        outData[dstIdx + c] = Math.round(valA * (1 - t) + valB * t);
      }
      outData[dstIdx + 3] = 255;
    }
  }

  return {
    frame: { data: outData, width, height },
    t,
    quality: motion.confidence,
  };
}

/**
 * 批量帧插值
 * 在每对相邻帧之间生成指定数量的中间帧
 */
export function interpolateVideoFrames(frames: ImageData[], factor: number): ImageData[] {
  if (frames.length < 2 || factor < 2) return frames;
  const result: ImageData[] = [];

  for (let i = 0; i < frames.length - 1; i++) {
    result.push(frames[i]);
    for (let j = 1; j < factor; j++) {
      const t = j / factor;
      const interpolated = interpolateFrame(frames[i], frames[i + 1], t);
      result.push(interpolated.frame);
    }
  }
  result.push(frames[frames.length - 1]);

  return result;
}

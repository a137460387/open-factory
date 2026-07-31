/**
 * Video issue detection: blur, shake, exposure, color cast, noise, flicker
 */

import type { DetectedIssue, ImageData } from './types';

/**
 * 检测帧中的问题
 * 分析图像特征，识别需要修复的问题
 */
export function detectIssues(frame: ImageData, previousFrame?: ImageData): DetectedIssue[] {
  const issues: DetectedIssue[] = [];
  const { data, width, height } = frame;

  // 1. 检测模糊
  const blurScore = detectBlur(data, width, height);
  if (blurScore > 0.3) {
    issues.push({
      type: 'blur',
      severity: blurScore,
      description: `检测到模糊，模糊度 ${(blurScore * 100).toFixed(0)}%`,
    });
  }

  // 2. 检测抖动
  if (previousFrame) {
    const shakeScore = detectShake(previousFrame, frame);
    if (shakeScore > 0.2) {
      issues.push({
        type: 'shake',
        severity: shakeScore,
        description: `检测到抖动，抖动幅度 ${(shakeScore * 100).toFixed(0)}%`,
      });
    }
  }

  // 3. 检测曝光问题
  const exposure = detectExposureIssues(data, width, height);
  if (exposure.underexposure > 0.3) {
    issues.push({
      type: 'underexposure',
      severity: exposure.underexposure,
      description: `检测到欠曝，暗部占比 ${(exposure.underexposure * 100).toFixed(0)}%`,
    });
  }
  if (exposure.overexposure > 0.3) {
    issues.push({
      type: 'overexposure',
      severity: exposure.overexposure,
      description: `检测到过曝，亮部占比 ${(exposure.overexposure * 100).toFixed(0)}%`,
    });
  }

  // 4. 检测色彩偏移
  const colorCast = detectColorCast(data, width, height);
  if (colorCast.severity > 0.2) {
    issues.push({
      type: 'color-cast',
      severity: colorCast.severity,
      description: `检测到色彩偏移：${colorCast.direction}`,
    });
  }

  // 5. 检测噪点
  const noiseLevel = detectNoiseLevel(data, width, height);
  if (noiseLevel > 0.2) {
    issues.push({
      type: 'noise',
      severity: noiseLevel,
      description: `检测到噪点，噪声水平 ${(noiseLevel * 100).toFixed(0)}%`,
    });
  }

  // 6. 检测闪烁
  if (previousFrame) {
    const flickerScore = detectFlicker(previousFrame, frame);
    if (flickerScore > 0.15) {
      issues.push({
        type: 'flicker',
        severity: flickerScore,
        description: `检测到亮度闪烁，闪烁幅度 ${(flickerScore * 100).toFixed(0)}%`,
      });
    }
  }

  return issues;
}

/**
 * 检测模糊度（基于 Laplacian 方差）
 */
export function detectBlur(data: Uint8ClampedArray, width: number, height: number): number {
  let laplacianSum = 0;
  let laplacianSqSum = 0;
  let count = 0;

  for (let y = 1; y < height - 1; y += 2) {
    for (let x = 1; x < width - 1; x += 2) {
      const idx = (y * width + x) * 4;
      const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];

      const top =
        0.299 * data[((y - 1) * width + x) * 4] +
        0.587 * data[((y - 1) * width + x) * 4 + 1] +
        0.114 * data[((y - 1) * width + x) * 4 + 2];
      const bottom =
        0.299 * data[((y + 1) * width + x) * 4] +
        0.587 * data[((y + 1) * width + x) * 4 + 1] +
        0.114 * data[((y + 1) * width + x) * 4 + 2];
      const left =
        0.299 * data[(y * width + (x - 1)) * 4] +
        0.587 * data[(y * width + (x - 1)) * 4 + 1] +
        0.114 * data[(y * width + (x - 1)) * 4 + 2];
      const right =
        0.299 * data[(y * width + (x + 1)) * 4] +
        0.587 * data[(y * width + (x + 1)) * 4 + 1] +
        0.114 * data[(y * width + (x + 1)) * 4 + 2];

      const laplacian = top + bottom + left + right - 4 * lum;
      laplacianSum += laplacian;
      laplacianSqSum += laplacian * laplacian;
      count++;
    }
  }

  if (count === 0) return 0;
  const mean = laplacianSum / count;
  const variance = laplacianSqSum / count - mean * mean;
  // 方差越小越模糊，归一化到 0-1
  return Math.max(0, Math.min(1, 1 - variance / 2000));
}

/**
 * 检测帧间抖动
 */
export function detectShake(prevFrame: ImageData, currFrame: ImageData): number {
  const { width, height } = currFrame;
  const blockSize = 16;
  const blocksX = Math.floor(width / blockSize);
  const blocksY = Math.floor(height / blockSize);
  const displacements: number[] = [];

  const prevLum = toLuminance(prevFrame.data, width, height);
  const currLum = toLuminance(currFrame.data, width, height);

  for (let by = 0; by < blocksY; by += 2) {
    for (let bx = 0; bx < blocksX; bx += 2) {
      let bestDx = 0;
      let bestDy = 0;
      let bestSAD = Infinity;
      const searchRadius = 8;

      for (let dy = -searchRadius; dy <= searchRadius; dy += 2) {
        for (let dx = -searchRadius; dx <= searchRadius; dx += 2) {
          let sad = 0;
          let count = 0;
          for (let y = 0; y < blockSize; y += 4) {
            for (let x = 0; x < blockSize; x += 4) {
              const px = bx * blockSize + x;
              const py = by * blockSize + y;
              const qx = px + dx;
              const qy = py + dy;
              if (qx < 0 || qx >= width || qy < 0 || qy >= height) continue;
              sad += Math.abs(prevLum[py * width + px] - currLum[qy * width + qx]);
              count++;
            }
          }
          if (count > 0 && sad / count < bestSAD) {
            bestSAD = sad / count;
            bestDx = dx;
            bestDy = dy;
          }
        }
      }

      const mag = Math.sqrt(bestDx * bestDx + bestDy * bestDy);
      displacements.push(mag);
    }
  }

  if (displacements.length === 0) return 0;
  const avgDisp = displacements.reduce((s, v) => s + v, 0) / displacements.length;
  // 归一化：8像素位移对应 1.0
  return Math.min(1, avgDisp / 8);
}

/**
 * 检测曝光问题
 */
export function detectExposureIssues(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): { underexposure: number; overexposure: number } {
  const totalPixels = width * height;
  let darkPixels = 0;
  let brightPixels = 0;

  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    if (lum < 30) darkPixels++;
    if (lum > 240) brightPixels++;
  }

  return {
    underexposure: darkPixels / totalPixels,
    overexposure: brightPixels / totalPixels,
  };
}

/**
 * 检测色彩偏移
 */
export function detectColorCast(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): { severity: number; direction: string } {
  let totalR = 0;
  let totalG = 0;
  let totalB = 0;
  const pixelCount = width * height;

  for (let i = 0; i < data.length; i += 4) {
    totalR += data[i];
    totalG += data[i + 1];
    totalB += data[i + 2];
  }

  const avgR = totalR / pixelCount;
  const avgG = totalG / pixelCount;
  const avgB = totalB / pixelCount;
  const avgGray = (avgR + avgG + avgB) / 3;

  const diffR = avgR - avgGray;
  const diffG = avgG - avgGray;
  const diffB = avgB - avgGray;

  const maxDiff = Math.max(Math.abs(diffR), Math.abs(diffG), Math.abs(diffB));
  const severity = Math.min(1, maxDiff / 40);

  let direction = '无偏移';
  if (Math.abs(diffR) > 10) direction = diffR > 0 ? '偏暖（红色）' : '偏冷（青色）';
  if (Math.abs(diffB) > 10) direction = diffB > 0 ? '偏冷（蓝色）' : '偏暖（黄色）';
  if (Math.abs(diffG) > 10) direction = diffG > 0 ? '偏绿' : '偏品红';

  return { severity, direction };
}

/**
 * 检测噪点水平
 */
export function detectNoiseLevel(data: Uint8ClampedArray, width: number, height: number): number {
  let noiseSum = 0;
  let count = 0;

  for (let y = 2; y < height - 2; y += 4) {
    for (let x = 2; x < width - 2; x += 4) {
      const neighbors: number[] = [];
      for (let dy = -2; dy <= 2; dy += 2) {
        for (let dx = -2; dx <= 2; dx += 2) {
          const idx = ((y + dy) * width + (x + dx)) * 4;
          neighbors.push(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
        }
      }
      const mean = neighbors.reduce((s, v) => s + v, 0) / neighbors.length;
      const mad = neighbors.reduce((s, v) => s + Math.abs(v - mean), 0) / neighbors.length;
      noiseSum += mad;
      count++;
    }
  }

  return count > 0 ? Math.min(1, noiseSum / count / 30) : 0;
}

/**
 * 检测亮度闪烁
 */
export function detectFlicker(prevFrame: ImageData, currFrame: ImageData): number {
  let prevSum = 0;
  let currSum = 0;
  const pixelCount = prevFrame.width * prevFrame.height;

  for (let i = 0; i < prevFrame.data.length; i += 4) {
    prevSum += 0.299 * prevFrame.data[i] + 0.587 * prevFrame.data[i + 1] + 0.114 * prevFrame.data[i + 2];
    currSum += 0.299 * currFrame.data[i] + 0.587 * currFrame.data[i + 1] + 0.114 * currFrame.data[i + 2];
  }

  const prevAvg = prevSum / pixelCount;
  const currAvg = currSum / pixelCount;
  return Math.min(1, Math.abs(currAvg - prevAvg) / 50);
}

/** Convert RGBA data to luminance array (shared helper) */
export function toLuminance(data: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const lum = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    lum[i] = Math.round(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
  }
  return lum;
}

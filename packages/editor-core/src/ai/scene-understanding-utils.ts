/**
 * Scene understanding utility functions and default configuration
 *
 * Contains helper functions used across the scene understanding module:
 * ID generation, geometric calculations, image analysis, and default config.
 */

import type { BoundingBox, ImageData, Point2D, SceneUnderstandingConfig } from './scene-understanding-types';

// ==================== 辅助函数 ====================

/**
 * 生成唯一ID
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * 计算两个边界框的IoU (Intersection over Union)
 */
export function computeIoU(box1: BoundingBox, box2: BoundingBox): number {
  const x1 = Math.max(box1.x, box2.x);
  const y1 = Math.max(box1.y, box2.y);
  const x2 = Math.min(box1.x + box1.width, box2.x + box2.width);
  const y2 = Math.min(box1.y + box1.height, box2.y + box2.height);

  if (x2 <= x1 || y2 <= y1) {
    return 0;
  }

  const intersection = (x2 - x1) * (y2 - y1);
  const area1 = box1.width * box1.height;
  const area2 = box2.width * box2.height;
  const union = area1 + area2 - intersection;

  return intersection / union;
}

/**
 * 计算边界框中心点
 */
export function getBoundingBoxCenter(box: BoundingBox): Point2D {
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };
}

/**
 * 计算两个点之间的距离
 */
export function computePointDistance(point1: Point2D, point2: Point2D): number {
  const dx = point1.x - point2.x;
  const dy = point1.y - point2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 计算图像亮度
 */
export function computeImageBrightness(imageData: ImageData): number {
  const { data } = imageData;
  let totalBrightness = 0;
  const pixelCount = data.length / 4;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    totalBrightness += 0.299 * r + 0.587 * g + 0.114 * b;
  }

  return totalBrightness / pixelCount;
}

/**
 * 计算图像对比度
 */
export function computeImageContrast(imageData: ImageData): number {
  const { data } = imageData;
  let minLum = 1;
  let maxLum = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;

    minLum = Math.min(minLum, lum);
    maxLum = Math.max(maxLum, lum);
  }

  return maxLum - minLum;
}

/**
 * 计算图像运动程度
 */
export function computeMotionLevel(frame1: ImageData, frame2: ImageData, threshold: number = 30): number {
  const { data: data1, width, height } = frame1;
  const { data: data2 } = frame2;

  let changedPixels = 0;
  const totalPixels = width * height;

  for (let i = 0; i < data1.length; i += 4) {
    const diff =
      Math.abs(data1[i] - data2[i]) + Math.abs(data1[i + 1] - data2[i + 1]) + Math.abs(data1[i + 2] - data2[i + 2]);

    if (diff > threshold) {
      changedPixels++;
    }
  }

  return changedPixels / totalPixels;
}

// ==================== 核心功能 ====================

/**
 * 默认场景理解配置
 * @internal
 */
export const DEFAULT_SCENE_UNDERSTANDING_CONFIG: SceneUnderstandingConfig = {
  enableObjectDetection: true,
  enableFaceDetection: true,
  enableActionRecognition: true,
  enableSemanticSegmentation: false, // 计算密集，默认关闭
  objectConfidenceThreshold: 0.5,
  faceConfidenceThreshold: 0.5,
  actionConfidenceThreshold: 0.5,
  maxObjects: 20,
  maxFaces: 10,
  enableTracking: true,
  trackingLostThreshold: 30,
};

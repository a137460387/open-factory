/**
 * Scene understanding detection module
 *
 * Contains object detection functions using color segmentation.
 */

import type {
  BoundingBox,
  DetectedObject,
  ImageData,
  ObjectAttributes,
  ObjectCategory,
  SceneUnderstandingConfig,
} from './scene-understanding-types';
import { generateId, DEFAULT_SCENE_UNDERSTANDING_CONFIG } from './scene-understanding-utils';

// ==================== 物体检测 ====================

/**
 * 物体检测
 * 使用简化的基于颜色和纹理的物体检测
 */
export function detectObjects(imageData: ImageData, config: Partial<SceneUnderstandingConfig> = {}): DetectedObject[] {
  const mergedConfig = { ...DEFAULT_SCENE_UNDERSTANDING_CONFIG, ...config };
  const { width, height, data } = imageData;
  const objects: DetectedObject[] = [];

  // 简化的物体检测：基于颜色分割和轮廓检测
  const segments = segmentByColor(imageData);

  for (const segment of segments) {
    if (segment.pixels.length < 100) continue; // 忽略太小的区域

    const boundingBox = computeSegmentBoundingBox(segment.pixels, width, height);
    const category = classifySegment(segment);
    const confidence = computeDetectionConfidence(segment, category);

    if (confidence >= mergedConfig.objectConfidenceThreshold) {
      objects.push({
        id: generateId(),
        category,
        confidence,
        boundingBox,
        label: getObjectLabel(category),
        attributes: analyzeObjectAttributes(segment, category),
      });
    }
  }

  // 按置信度排序并限制数量
  objects.sort((a, b) => b.confidence - a.confidence);
  return objects.slice(0, mergedConfig.maxObjects);
}

/**
 * 颜色分割
 */
function segmentByColor(imageData: ImageData): Array<{ color: { r: number; g: number; b: number }; pixels: number[] }> {
  const { data, width, height } = imageData;
  const visited = new Uint8Array(width * height);
  const segments: Array<{ color: { r: number; g: number; b: number }; pixels: number[] }> = [];

  const colorThreshold = 50;

  for (let y = 0; y < height; y += 4) {
    // 采样以提高性能
    for (let x = 0; x < width; x += 4) {
      const idx = y * width + x;
      if (visited[idx]) continue;

      const pixelIdx = idx * 4;
      const color = {
        r: data[pixelIdx],
        g: data[pixelIdx + 1],
        b: data[pixelIdx + 2],
      };

      const pixels: number[] = [];
      const stack = [idx];

      while (stack.length > 0) {
        const currentIdx = stack.pop()!;
        if (visited[currentIdx]) continue;

        const currentPixelIdx = currentIdx * 4;
        const currentColor = {
          r: data[currentPixelIdx],
          g: data[currentPixelIdx + 1],
          b: data[currentPixelIdx + 2],
        };

        const colorDiff =
          Math.abs(color.r - currentColor.r) + Math.abs(color.g - currentColor.g) + Math.abs(color.b - currentColor.b);

        if (colorDiff <= colorThreshold) {
          visited[currentIdx] = 1;
          pixels.push(currentIdx);

          // 添加邻居
          const x = currentIdx % width;
          const y = Math.floor(currentIdx / width);

          if (x > 0) stack.push(currentIdx - 1);
          if (x < width - 1) stack.push(currentIdx + 1);
          if (y > 0) stack.push(currentIdx - width);
          if (y < height - 1) stack.push(currentIdx + width);
        }
      }

      if (pixels.length > 0) {
        segments.push({ color, pixels });
      }
    }
  }

  return segments;
}

/**
 * 计算分割区域的边界框
 */
export function computeSegmentBoundingBox(pixels: number[], width: number, height: number): BoundingBox {
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  for (const idx of pixels) {
    const x = idx % width;
    const y = Math.floor(idx / width);

    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  return {
    x: minX / width,
    y: minY / height,
    width: (maxX - minX) / width,
    height: (maxY - minY) / height,
  };
}

/**
 * 分类分割区域
 */
function classifySegment(segment: { color: { r: number; g: number; b: number }; pixels: number[] }): ObjectCategory {
  const { color } = segment;

  // 简化的颜色分类
  const hsl = rgbToHsl(color);

  // 肤色检测
  if (hsl.h >= 0 && hsl.h <= 50 && hsl.s >= 0.2 && hsl.s <= 0.7 && hsl.l >= 0.3 && hsl.l <= 0.8) {
    return 'person';
  }

  // 绿色（植被）
  if (hsl.h >= 80 && hsl.h <= 160 && hsl.s >= 0.2) {
    return 'nature';
  }

  // 蓝色（天空/水）
  if (hsl.h >= 180 && hsl.h <= 260 && hsl.s >= 0.2) {
    return 'nature';
  }

  // 灰色/黑色（道路/建筑）
  if (hsl.s < 0.1 && hsl.l < 0.5) {
    return 'building';
  }

  // 白色（天空/建筑）
  if (hsl.s < 0.1 && hsl.l > 0.8) {
    return 'building';
  }

  return 'object';
}

/**
 * 计算检测置信度
 */
function computeDetectionConfidence(
  segment: { color: { r: number; g: number; b: number }; pixels: number[] },
  category: ObjectCategory,
): number {
  // 基于区域大小和颜色一致性计算置信度
  const sizeScore = Math.min(segment.pixels.length / 1000, 1);
  const colorConsistency = computeColorConsistency(segment);

  return (sizeScore + colorConsistency) / 2;
}

/**
 * 计算颜色一致性
 */
function computeColorConsistency(segment: { color: { r: number; g: number; b: number }; pixels: number[] }): number {
  // 简化实现：返回固定值
  return 0.7;
}

/**
 * 获取物体标签
 */
function getObjectLabel(category: ObjectCategory): string {
  const labels: Record<ObjectCategory, string> = {
    person: '人物',
    vehicle: '车辆',
    animal: '动物',
    object: '物体',
    food: '食物',
    furniture: '家具',
    electronics: '电子设备',
    nature: '自然',
    building: '建筑',
    text: '文字',
    other: '其他',
  };

  return labels[category] || '未知';
}

/**
 * 分析物体属性
 */
function analyzeObjectAttributes(
  segment: { color: { r: number; g: number; b: number }; pixels: number[] },
  category: ObjectCategory,
): ObjectAttributes {
  const { color } = segment;
  const hsl = rgbToHsl(color);

  // 颜色属性
  let colorName = 'unknown';
  if (hsl.s < 0.1) {
    colorName = hsl.l > 0.5 ? 'white' : 'black';
  } else if (hsl.h < 30 || hsl.h >= 330) {
    colorName = 'red';
  } else if (hsl.h < 90) {
    colorName = 'yellow';
  } else if (hsl.h < 150) {
    colorName = 'green';
  } else if (hsl.h < 210) {
    colorName = 'cyan';
  } else if (hsl.h < 270) {
    colorName = 'blue';
  } else {
    colorName = 'purple';
  }

  // 大小属性
  let size: 'small' | 'medium' | 'large' = 'medium';
  if (segment.pixels.length < 500) {
    size = 'small';
  } else if (segment.pixels.length > 2000) {
    size = 'large';
  }

  return {
    color: colorName,
    size,
  };
}

/**
 * RGB转HSL
 */
export function rgbToHsl(rgb: { r: number; g: number; b: number }): { h: number; s: number; l: number } {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l };
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h = 0;
  switch (max) {
    case r:
      h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      break;
    case g:
      h = ((b - r) / d + 2) / 6;
      break;
    case b:
      h = ((r - g) / d + 4) / 6;
      break;
  }

  return { h: h * 360, s, l };
}

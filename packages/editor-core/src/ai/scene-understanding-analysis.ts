/**
 * Scene understanding analysis module
 *
 * Contains face detection and scene description helper functions.
 */

import type {
  BoundingBox,
  DetectedFace,
  DetectedObject,
  FaceExpression,
  FaceLandmarks,
  HeadPose,
  ImageData,
  SceneDescription,
  SceneMood,
  SceneType,
  LightingCondition,
  TimeOfDay,
  SceneUnderstandingConfig,
  ExpressionType,
} from './scene-understanding-types';
import { generateId, computeImageBrightness, computeImageContrast, DEFAULT_SCENE_UNDERSTANDING_CONFIG } from './scene-understanding-utils';
import { computeSegmentBoundingBox } from './scene-understanding-detection';

// ==================== 人脸检测 ====================

/**
 * 人脸检测
 * 使用简化的基于肤色和椭圆检测的方法
 */
export function detectFaces(imageData: ImageData, config: Partial<SceneUnderstandingConfig> = {}): DetectedFace[] {
  const mergedConfig = { ...DEFAULT_SCENE_UNDERSTANDING_CONFIG, ...config };
  const { width, height, data } = imageData;
  const faces: DetectedFace[] = [];

  // 检测肤色区域
  const skinRegions = detectSkinRegions(imageData);

  for (const region of skinRegions) {
    if (region.pixels.length < 200) continue; // 忽略太小的区域

    const boundingBox = computeSegmentBoundingBox(region.pixels, width, height);
    const aspectRatio = boundingBox.width / boundingBox.height;

    // 人脸宽高比通常在0.7-1.5之间
    if (aspectRatio >= 0.5 && aspectRatio <= 2.0) {
      const confidence = computeFaceConfidence(region, boundingBox);

      if (confidence >= mergedConfig.faceConfidenceThreshold) {
        faces.push({
          id: generateId(),
          boundingBox,
          confidence,
          landmarks: estimateFaceLandmarks(boundingBox),
          expression: analyzeExpression(imageData, boundingBox),
          headPose: estimateHeadPose(boundingBox),
        });
      }
    }
  }

  // 按置信度排序并限制数量
  faces.sort((a, b) => b.confidence - a.confidence);
  return faces.slice(0, mergedConfig.maxFaces);
}

/**
 * 检测肤色区域
 */
function detectSkinRegions(imageData: ImageData): Array<{ pixels: number[] }> {
  const { data, width, height } = imageData;
  const skinMask = new Uint8Array(width * height);

  // 基于YCbCr色彩空间的肤色检测
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;

    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    const cb = 0.564 * (b - y) + 0.5;
    const cr = 0.713 * (r - y) + 0.5;

    // 肤色范围
    const isSkin = y > 0.2 && y < 0.9 && cb > 0.35 && cb < 0.55 && cr > 0.45 && cr < 0.65;

    if (isSkin) {
      skinMask[i / 4] = 1;
    }
  }

  // 连通区域分析
  const visited = new Uint8Array(width * height);
  const regions: Array<{ pixels: number[] }> = [];

  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const idx = y * width + x;
      if (visited[idx] || !skinMask[idx]) continue;

      const pixels: number[] = [];
      const stack = [idx];

      while (stack.length > 0) {
        const currentIdx = stack.pop()!;
        if (visited[currentIdx]) continue;

        visited[currentIdx] = 1;
        pixels.push(currentIdx);

        // 添加邻居
        const x = currentIdx % width;
        const y = Math.floor(currentIdx / width);

        if (x > 0 && skinMask[currentIdx - 1]) stack.push(currentIdx - 1);
        if (x < width - 1 && skinMask[currentIdx + 1]) stack.push(currentIdx + 1);
        if (y > 0 && skinMask[currentIdx - width]) stack.push(currentIdx - width);
        if (y < height - 1 && skinMask[currentIdx + width]) stack.push(currentIdx + width);
      }

      if (pixels.length > 0) {
        regions.push({ pixels });
      }
    }
  }

  return regions;
}

/**
 * 计算人脸置信度
 */
function computeFaceConfidence(region: { pixels: number[] }, boundingBox: BoundingBox): number {
  // 基于区域大小和形状计算置信度
  const sizeScore = Math.min(region.pixels.length / 1000, 1);
  const aspectRatio = boundingBox.width / boundingBox.height;
  const shapeScore = 1 - Math.abs(aspectRatio - 1) / 0.5;

  return (sizeScore + shapeScore) / 2;
}

/**
 * 估计人脸关键点
 */
function estimateFaceLandmarks(boundingBox: BoundingBox): FaceLandmarks {
  const { x, y, width, height } = boundingBox;

  // 基于边界框估计关键点位置
  return {
    leftEye: { x: x + width * 0.35, y: y + height * 0.35 },
    rightEye: { x: x + width * 0.65, y: y + height * 0.35 },
    nose: { x: x + width * 0.5, y: y + height * 0.55 },
    leftMouthCorner: { x: x + width * 0.35, y: y + height * 0.7 },
    rightMouthCorner: { x: x + width * 0.65, y: y + height * 0.7 },
    leftEyebrow: [
      { x: x + width * 0.25, y: y + height * 0.25 },
      { x: x + width * 0.45, y: y + height * 0.25 },
    ],
    rightEyebrow: [
      { x: x + width * 0.55, y: y + height * 0.25 },
      { x: x + width * 0.75, y: y + height * 0.25 },
    ],
    jawline: [
      { x: x + width * 0.1, y: y + height * 0.3 },
      { x: x + width * 0.5, y: y + height * 0.95 },
      { x: x + width * 0.9, y: y + height * 0.3 },
    ],
  };
}

/**
 * 分析表情
 */
function analyzeExpression(imageData: ImageData, boundingBox: BoundingBox): FaceExpression {
  // 简化的表情分析：基于面部区域亮度和对比度
  const { data, width, height } = imageData;
  const { x, y, width: bw, height: bh } = boundingBox;

  const startX = Math.floor(x * width);
  const startY = Math.floor(y * height);
  const endX = Math.floor((x + bw) * width);
  const endY = Math.floor((y + bh) * height);

  let totalBrightness = 0;
  let pixelCount = 0;

  for (let py = startY; py < endY; py++) {
    for (let px = startX; px < endX; px++) {
      const idx = (py * width + px) * 4;
      const r = data[idx] / 255;
      const g = data[idx + 1] / 255;
      const b = data[idx + 2] / 255;
      totalBrightness += 0.299 * r + 0.587 * g + 0.114 * b;
      pixelCount++;
    }
  }

  const avgBrightness = pixelCount > 0 ? totalBrightness / pixelCount : 0.5;

  // 基于亮度估计表情（非常简化的实现）
  const probabilities: Record<ExpressionType, number> = {
    neutral: 0.6,
    happy: avgBrightness > 0.6 ? 0.3 : 0.1,
    sad: avgBrightness < 0.4 ? 0.2 : 0.05,
    angry: 0.05,
    surprised: 0.05,
    fearful: 0.05,
    disgusted: 0.05,
    contempt: 0.05,
  };

  // 找到最高概率的表情
  let primary: ExpressionType = 'neutral';
  let maxProb = 0;

  for (const [expression, prob] of Object.entries(probabilities)) {
    if (prob > maxProb) {
      maxProb = prob;
      primary = expression as ExpressionType;
    }
  }

  return {
    primary,
    confidence: maxProb,
    probabilities,
  };
}

/**
 * 估计头部姿态
 */
function estimateHeadPose(boundingBox: BoundingBox): HeadPose {
  // 简化的头部姿态估计：基于边界框位置
  const centerX = boundingBox.x + boundingBox.width / 2;
  const centerY = boundingBox.y + boundingBox.height / 2;

  return {
    yaw: (centerX - 0.5) * 60, // -30到30度
    pitch: (centerY - 0.5) * 40, // -20到20度
    roll: 0,
  };
}

// ==================== 场景描述 ====================

/**
 * 场景描述生成
 */
export function describeScene(
  imageData: ImageData,
  objects: DetectedObject[],
  faces: DetectedFace[],
): SceneDescription {
  const brightness = computeImageBrightness(imageData);
  const contrast = computeImageContrast(imageData);

  // 场景类型检测
  const sceneType = detectSceneType(imageData, objects);

  // 氛围检测
  const mood = detectSceneMood(brightness, contrast, objects, faces);

  // 光照条件
  const lighting = detectLightingCondition(brightness, contrast);

  // 时间段
  const timeOfDay = detectTimeOfDay(brightness, imageData);

  // 复杂度（基于物体数量）
  const complexity = Math.min(objects.length / 10, 1);

  // 运动程度（需要多帧，这里使用默认值）
  const motionLevel = 0;

  // 主色调
  const dominantColors = extractDominantColors(imageData);

  return {
    sceneType,
    mood,
    lighting,
    timeOfDay,
    complexity,
    motionLevel,
    dominantColors,
  };
}

/**
 * 检测场景类型
 */
function detectSceneType(imageData: ImageData, objects: DetectedObject[]): SceneType {
  const brightness = computeImageBrightness(imageData);

  // 基于物体类别判断
  const categories = objects.map((obj) => obj.category);

  if (categories.includes('nature')) {
    return 'nature';
  }

  if (categories.includes('building')) {
    return 'urban';
  }

  if (categories.includes('vehicle')) {
    return 'urban';
  }

  // 基于亮度判断
  if (brightness < 0.3) {
    return 'indoor';
  }

  return 'outdoor';
}

/**
 * 检测场景氛围
 */
function detectSceneMood(
  brightness: number,
  contrast: number,
  objects: DetectedObject[],
  faces: DetectedFace[],
): SceneMood {
  // 基于人脸表情判断
  if (faces.length > 0) {
    const expressions = faces.map((face) => face.expression.primary);

    if (expressions.includes('happy')) {
      return 'happy';
    }

    if (expressions.includes('sad')) {
      return 'sad';
    }

    if (expressions.includes('angry') || expressions.includes('fearful')) {
      return 'tense';
    }
  }

  // 基于亮度和对比度判断
  if (brightness < 0.3 && contrast > 0.5) {
    return 'mysterious';
  }

  if (brightness > 0.7 && contrast < 0.3) {
    return 'calm';
  }

  if (contrast > 0.6) {
    return 'energetic';
  }

  return 'neutral';
}

/**
 * 检测光照条件
 */
function detectLightingCondition(brightness: number, contrast: number): LightingCondition {
  if (brightness < 0.3) {
    return 'low';
  }

  if (brightness > 0.8) {
    return 'bright';
  }

  if (contrast > 0.6) {
    return 'side-lit';
  }

  if (contrast < 0.3) {
    return 'diffused';
  }

  return 'natural';
}

/**
 * 检测时间段
 */
function detectTimeOfDay(brightness: number, imageData: ImageData): TimeOfDay {
  if (brightness < 0.2) {
    return 'night';
  }

  if (brightness < 0.4) {
    return 'dusk';
  }

  if (brightness > 0.8) {
    return 'noon';
  }

  // 检测日落特征（暖色调）
  const { data } = imageData;
  let totalWarmth = 0;
  const pixelCount = data.length / 4;

  for (let i = 0; i < data.length; i += 16) {
    // 采样
    const r = data[i] / 255;
    const b = data[i + 2] / 255;
    totalWarmth += r - b;
  }

  const avgWarmth = totalWarmth / (pixelCount / 4);

  if (avgWarmth > 0.2 && brightness > 0.4 && brightness < 0.7) {
    return 'sunset';
  }

  return 'afternoon';
}

/**
 * 提取主色调
 */
function extractDominantColors(imageData: ImageData): { r: number; g: number; b: number }[] {
  const { data } = imageData;
  const colorMap = new Map<string, { color: { r: number; g: number; b: number }; count: number }>();

  // 采样像素
  for (let i = 0; i < data.length; i += 16) {
    const r = Math.round(data[i] / 32) * 32;
    const g = Math.round(data[i + 1] / 32) * 32;
    const b = Math.round(data[i + 2] / 32) * 32;
    const key = `${r},${g},${b}`;

    const existing = colorMap.get(key);
    if (existing) {
      existing.count++;
    } else {
      colorMap.set(key, { color: { r, g, b }, count: 1 });
    }
  }

  // 返回前5个主色调
  return Array.from(colorMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((item) => item.color);
}

/**
 * 场景理解增强模块
 *
 * 功能：
 * 1. 物体识别与跟踪 - 检测和跟踪视频中的物体
 * 2. 人脸检测与表情分析 - 检测人脸并分析表情
 * 3. 动作识别 - 识别视频中的动作和活动
 * 4. 场景语义分割 - 将场景分割为语义区域
 */

// Re-export all types from types module
export type {
  BoundingBox,
  DetectedObject,
  ObjectCategory,
  ObjectAttributes,
  DetectedFace,
  FaceLandmarks,
  Point2D,
  FaceExpression,
  ExpressionType,
  HeadPose,
  DetectedAction,
  ActionCategory,
  TimeRange,
  ActionAttributes,
  SemanticSegmentation,
  SegmentationCategory,
  SegmentationType,
  SceneUnderstandingResult,
  SceneDescription,
  SceneType,
  SceneMood,
  LightingCondition,
  WeatherCondition,
  TimeOfDay,
  TrackingState,
  SceneUnderstandingConfig,
  ImageData,
  VideoFrame,
} from './scene-understanding-types';

// Re-export utility functions and config from utils module
export {
  generateId,
  computeIoU,
  getBoundingBoxCenter,
  computePointDistance,
  computeImageBrightness,
  computeImageContrast,
  computeMotionLevel,
  DEFAULT_SCENE_UNDERSTANDING_CONFIG,
} from './scene-understanding-utils';

// Re-export detection functions
export { detectObjects } from './scene-understanding-detection';

// Re-export analysis functions
export { detectFaces, describeScene } from './scene-understanding-analysis';

import type {
  DetectedAction,
  DetectedObject,
  ImageData,
  SceneUnderstandingConfig,
  SceneUnderstandingResult,
  SegmentationCategory,
  SemanticSegmentation,
  TrackingState,
  VideoFrame,
  ActionCategory,
  ActionAttributes,
} from './scene-understanding-types';
import {
  generateId,
  computeMotionLevel,
  computeIoU,
  DEFAULT_SCENE_UNDERSTANDING_CONFIG,
} from './scene-understanding-utils';
import { detectObjects } from './scene-understanding-detection';
import { detectFaces, describeScene } from './scene-understanding-analysis';

// ==================== 动作识别 ====================

/**
 * 动作识别
 * 使用简化的基于运动分析的方法
 */
export function recognizeActions(
  frames: VideoFrame[],
  config: Partial<SceneUnderstandingConfig> = {},
): DetectedAction[] {
  const mergedConfig = { ...DEFAULT_SCENE_UNDERSTANDING_CONFIG, ...config };
  const actions: DetectedAction[] = [];

  if (frames.length < 2) {
    return actions;
  }

  // 分析帧间运动
  for (let i = 1; i < frames.length; i++) {
    const motionLevel = computeMotionLevel(frames[i - 1], frames[i]);

    if (motionLevel > 0.1) {
      const action = classifyMotion(frames[i - 1], frames[i], motionLevel);

      if (action && action.confidence >= mergedConfig.actionConfidenceThreshold) {
        actions.push({
          id: generateId(),
          category: action.category,
          label: action.label,
          confidence: action.confidence,
          timeRange: {
            startTime: frames[i - 1].timestamp,
            endTime: frames[i].timestamp,
          },
          participants: [],
          attributes: action.attributes,
        });
      }
    }
  }

  return actions;
}

/**
 * 分类运动
 */
function classifyMotion(
  frame1: ImageData,
  frame2: ImageData,
  motionLevel: number,
): { category: ActionCategory; label: string; confidence: number; attributes: ActionAttributes } | null {
  // 基于运动程度和模式分类动作
  if (motionLevel > 0.5) {
    return {
      category: 'movement',
      label: '快速运动',
      confidence: 0.8,
      attributes: {
        intensity: motionLevel,
        speed: 'fast',
      },
    };
  }

  if (motionLevel > 0.2) {
    return {
      category: 'movement',
      label: '中等运动',
      confidence: 0.7,
      attributes: {
        intensity: motionLevel,
        speed: 'medium',
      },
    };
  }

  if (motionLevel > 0.1) {
    return {
      category: 'gesture',
      label: '轻微动作',
      confidence: 0.6,
      attributes: {
        intensity: motionLevel,
        speed: 'slow',
      },
    };
  }

  return null;
}

// ==================== 语义分割 ====================

/**
 * 语义分割
 * 使用简化的基于颜色和位置的分割
 */
export function segmentSemantics(
  imageData: ImageData,
  config: Partial<SceneUnderstandingConfig> = {},
): SemanticSegmentation {
  const { width, height, data } = imageData;
  const mask = new Uint8Array(width * height);
  const confidence = new Uint8Array(width * height);

  // 定义分割类别
  const categories: SegmentationCategory[] = [
    { id: 0, name: '背景', type: 'background', color: { r: 128, g: 128, b: 128 } },
    { id: 1, name: '人物', type: 'person', color: { r: 255, g: 0, b: 0 } },
    { id: 2, name: '天空', type: 'sky', color: { r: 135, g: 206, b: 235 } },
    { id: 3, name: '地面', type: 'ground', color: { r: 139, g: 69, b: 19 } },
    { id: 4, name: '植被', type: 'vegetation', color: { r: 0, g: 128, b: 0 } },
    { id: 5, name: '建筑', type: 'building', color: { r: 128, g: 0, b: 0 } },
    { id: 6, name: '道路', type: 'road', color: { r: 105, g: 105, b: 105 } },
    { id: 7, name: '水', type: 'water', color: { r: 0, g: 0, b: 255 } },
  ];

  // 基于位置和颜色的简单分割
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const pixelIdx = idx * 4;

      const r = data[pixelIdx];
      const g = data[pixelIdx + 1];
      const b = data[pixelIdx + 2];

      // 基于位置的分割
      const relativeY = y / height;

      // 天空区域（上半部分，蓝色）
      if (relativeY < 0.4 && b > 150 && b > r && b > g) {
        mask[idx] = 2; // 天空
        confidence[idx] = 200;
      }
      // 地面区域（下半部分，棕色/绿色）
      else if (relativeY > 0.6 && (g > 100 || r > 100)) {
        if (g > r && g > b) {
          mask[idx] = 4; // 植被
          confidence[idx] = 180;
        } else {
          mask[idx] = 3; // 地面
          confidence[idx] = 160;
        }
      }
      // 肤色区域（人物）
      else if (isSkinColor(r, g, b)) {
        mask[idx] = 1; // 人物
        confidence[idx] = 150;
      }
      // 灰色区域（道路/建筑）
      else if (Math.abs(r - g) < 20 && Math.abs(g - b) < 20 && r < 150) {
        if (relativeY > 0.5) {
          mask[idx] = 6; // 道路
          confidence[idx] = 140;
        } else {
          mask[idx] = 5; // 建筑
          confidence[idx] = 130;
        }
      }
      // 默认背景
      else {
        mask[idx] = 0; // 背景
        confidence[idx] = 100;
      }
    }
  }

  return {
    mask,
    width,
    height,
    categories,
    confidence,
  };
}

/**
 * 判断是否为肤色
 */
function isSkinColor(r: number, g: number, b: number): boolean {
  const y = 0.299 * (r / 255) + 0.587 * (g / 255) + 0.114 * (b / 255);
  const cb = 0.564 * (b / 255 - y) + 0.5;
  const cr = 0.713 * (r / 255 - y) + 0.5;

  return y > 0.2 && y < 0.9 && cb > 0.35 && cb < 0.55 && cr > 0.45 && cr < 0.65;
}

// ==================== 物体跟踪 ====================

/**
 * 物体跟踪
 */
export function trackObjects(
  previousObjects: DetectedObject[],
  currentObjects: DetectedObject[],
  trackingStates: Map<number, TrackingState>,
): { trackedObjects: DetectedObject[]; updatedStates: Map<number, TrackingState> } {
  const trackedObjects: DetectedObject[] = [];
  const updatedStates = new Map(trackingStates);

  // 为当前帧的每个物体找到最佳匹配
  for (const currentObj of currentObjects) {
    let bestMatch: DetectedObject | null = null;
    let bestIoU = 0;

    for (const prevObj of previousObjects) {
      if (prevObj.trackingId === undefined) continue;
      if (prevObj.category !== currentObj.category) continue;

      const iou = computeIoU(prevObj.boundingBox, currentObj.boundingBox);
      if (iou > bestIoU && iou > 0.3) {
        bestIoU = iou;
        bestMatch = prevObj;
      }
    }

    if (bestMatch && bestMatch.trackingId !== undefined) {
      // 找到匹配，更新跟踪状态
      const trackingId = bestMatch.trackingId;
      const state = updatedStates.get(trackingId);

      if (state) {
        state.position = currentObj.boundingBox;
        state.quality = bestIoU;
        state.lostFrames = 0;
        state.trajectory.push(currentObj.boundingBox);

        // 限制轨迹长度
        if (state.trajectory.length > 30) {
          state.trajectory.shift();
        }

        updatedStates.set(trackingId, state);
      }

      trackedObjects.push({
        ...currentObj,
        trackingId,
      });
    } else {
      // 新物体，分配新的跟踪ID
      const newTrackingId = generateTrackingId();

      updatedStates.set(newTrackingId, {
        id: newTrackingId,
        category: currentObj.category,
        position: currentObj.boundingBox,
        velocity: { x: 0, y: 0 },
        quality: 1,
        lostFrames: 0,
        trajectory: [currentObj.boundingBox],
      });

      trackedObjects.push({
        ...currentObj,
        trackingId: newTrackingId,
      });
    }
  }

  // 更新丢失的跟踪状态
  for (const [id, state] of updatedStates) {
    const found = trackedObjects.some((obj) => obj.trackingId === id);
    if (!found) {
      state.lostFrames++;
      if (state.lostFrames > 30) {
        updatedStates.delete(id);
      }
    }
  }

  return { trackedObjects, updatedStates };
}

/**
 * 生成跟踪ID
 */
let nextTrackingId = 1;
function generateTrackingId(): number {
  return nextTrackingId++;
}

// ==================== 顶层函数 ====================

/**
 * 完整场景理解
 */
export function understandScene(
  imageData: ImageData,
  config: Partial<SceneUnderstandingConfig> = {},
): SceneUnderstandingResult {
  const startTime = performance.now();
  const mergedConfig = { ...DEFAULT_SCENE_UNDERSTANDING_CONFIG, ...config };

  // 物体检测
  const objects = mergedConfig.enableObjectDetection ? detectObjects(imageData, mergedConfig) : [];

  // 人脸检测
  const faces = mergedConfig.enableFaceDetection ? detectFaces(imageData, mergedConfig) : [];

  // 语义分割
  const segmentation = mergedConfig.enableSemanticSegmentation ? segmentSemantics(imageData, mergedConfig) : undefined;

  // 场景描述
  const sceneDescription = describeScene(imageData, objects, faces);

  const processingTime = performance.now() - startTime;

  return {
    objects,
    faces,
    actions: [], // 动作识别需要多帧，这里返回空数组
    segmentation,
    sceneDescription,
    processingTime,
  };
}

/**
 * 创建默认场景理解配置
 */
export function createDefaultSceneUnderstandingConfig(): SceneUnderstandingConfig {
  return { ...DEFAULT_SCENE_UNDERSTANDING_CONFIG };
}

/**
 * 验证场景理解配置
 */
export function validateSceneUnderstandingConfig(config: SceneUnderstandingConfig): boolean {
  return (
    typeof config.enableObjectDetection === 'boolean' &&
    typeof config.enableFaceDetection === 'boolean' &&
    typeof config.enableActionRecognition === 'boolean' &&
    typeof config.enableSemanticSegmentation === 'boolean' &&
    typeof config.objectConfidenceThreshold === 'number' &&
    typeof config.faceConfidenceThreshold === 'number' &&
    typeof config.actionConfidenceThreshold === 'number' &&
    typeof config.maxObjects === 'number' &&
    typeof config.maxFaces === 'number' &&
    typeof config.enableTracking === 'boolean' &&
    typeof config.trackingLostThreshold === 'number'
  );
}

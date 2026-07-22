import { describe, it, expect } from 'vitest';
import { clamp, lerp } from '../../src/utils/math';
import {
  generateId,
  computeIoU,
  getBoundingBoxCenter,
  computePointDistance,
  computeImageBrightness,
  computeImageContrast,
  computeMotionLevel,
  detectObjects,
  detectFaces,
  recognizeActions,
  segmentSemantics,
  describeScene,
  trackObjects,
  understandScene,
  createDefaultSceneUnderstandingConfig,
  validateSceneUnderstandingConfig,
  type BoundingBox,
  type DetectedObject,
  type DetectedFace,
  type VideoFrame,
  type ImageData,
  type SceneUnderstandingConfig,
  type TrackingState,
} from '../../src/ai/scene-understanding';

// ==================== 辅助函数测试 ====================

describe('辅助函数', () => {
  describe('generateId', () => {
    it('应该生成唯一ID', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(id1.length).toBeGreaterThan(0);
    });
  });

  describe('computeIoU', () => {
    it('应该计算完全重叠的IoU为1', () => {
      const box: BoundingBox = { x: 0.1, y: 0.1, width: 0.3, height: 0.3 };
      expect(computeIoU(box, box)).toBeCloseTo(1, 10);
    });

    it('应该计算无重叠的IoU为0', () => {
      const box1: BoundingBox = { x: 0, y: 0, width: 0.1, height: 0.1 };
      const box2: BoundingBox = { x: 0.5, y: 0.5, width: 0.1, height: 0.1 };
      expect(computeIoU(box1, box2)).toBe(0);
    });

    it('应该计算部分重叠的IoU', () => {
      const box1: BoundingBox = { x: 0, y: 0, width: 0.5, height: 0.5 };
      const box2: BoundingBox = { x: 0.25, y: 0.25, width: 0.5, height: 0.5 };
      const iou = computeIoU(box1, box2);
      expect(iou).toBeGreaterThan(0);
      expect(iou).toBeLessThan(1);
    });
  });

  describe('getBoundingBoxCenter', () => {
    it('应该计算边界框中心', () => {
      const box: BoundingBox = { x: 0.1, y: 0.2, width: 0.3, height: 0.4 };
      const center = getBoundingBoxCenter(box);
      expect(center.x).toBeCloseTo(0.25, 2);
      expect(center.y).toBeCloseTo(0.4, 2);
    });
  });

  describe('computePointDistance', () => {
    it('应该计算相同点的距离为0', () => {
      const point = { x: 0.5, y: 0.5 };
      expect(computePointDistance(point, point)).toBe(0);
    });

    it('应该计算两点之间的距离', () => {
      const point1 = { x: 0, y: 0 };
      const point2 = { x: 3, y: 4 };
      expect(computePointDistance(point1, point2)).toBe(5);
    });
  });

  describe('clamp', () => {
    it('应该限制值在范围内', () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-5, 0, 10)).toBe(0);
      expect(clamp(15, 0, 10)).toBe(10);
    });
  });

  describe('lerp', () => {
    it('应该正确插值', () => {
      expect(lerp(0, 10, 0)).toBe(0);
      expect(lerp(0, 10, 1)).toBe(10);
      expect(lerp(0, 10, 0.5)).toBe(5);
    });
  });
});

// ==================== 图像分析测试 ====================

describe('图像分析', () => {
  function createTestImage(width: number, height: number, color: { r: number; g: number; b: number }): ImageData {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = color.r;
      data[i + 1] = color.g;
      data[i + 2] = color.b;
      data[i + 3] = 255;
    }
    return { data, width, height };
  }

  describe('computeImageBrightness', () => {
    it('应该计算黑色图像的亮度为0', () => {
      const image = createTestImage(10, 10, { r: 0, g: 0, b: 0 });
      expect(computeImageBrightness(image)).toBeCloseTo(0, 2);
    });

    it('应该计算白色图像的亮度为1', () => {
      const image = createTestImage(10, 10, { r: 255, g: 255, b: 255 });
      expect(computeImageBrightness(image)).toBeCloseTo(1, 2);
    });

    it('应该计算灰色图像的亮度', () => {
      const image = createTestImage(10, 10, { r: 128, g: 128, b: 128 });
      const brightness = computeImageBrightness(image);
      expect(brightness).toBeGreaterThan(0.4);
      expect(brightness).toBeLessThan(0.6);
    });
  });

  describe('computeImageContrast', () => {
    it('应该计算纯色图像的对比度为0', () => {
      const image = createTestImage(10, 10, { r: 128, g: 128, b: 128 });
      expect(computeImageContrast(image)).toBeCloseTo(0, 2);
    });

    it('应该计算黑白图像的对比度为1', () => {
      const data = new Uint8ClampedArray(10 * 10 * 4);
      for (let i = 0; i < data.length; i += 4) {
        const isWhite = (i / 4) % 2 === 0;
        data[i] = isWhite ? 255 : 0;
        data[i + 1] = isWhite ? 255 : 0;
        data[i + 2] = isWhite ? 255 : 0;
        data[i + 3] = 255;
      }
      const image = { data, width: 10, height: 10 };
      expect(computeImageContrast(image)).toBeCloseTo(1, 2);
    });
  });

  describe('computeMotionLevel', () => {
    it('应该计算相同图像的运动为0', () => {
      const image = createTestImage(10, 10, { r: 128, g: 128, b: 128 });
      expect(computeMotionLevel(image, image)).toBe(0);
    });

    it('应该计算不同图像的运动', () => {
      const image1 = createTestImage(10, 10, { r: 0, g: 0, b: 0 });
      const image2 = createTestImage(10, 10, { r: 255, g: 255, b: 255 });
      const motion = computeMotionLevel(image1, image2);
      expect(motion).toBeGreaterThan(0);
    });
  });
});

// ==================== 物体检测测试 ====================

describe('物体检测', () => {
  function createTestImage(width: number, height: number, color: { r: number; g: number; b: number }): ImageData {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = color.r;
      data[i + 1] = color.g;
      data[i + 2] = color.b;
      data[i + 3] = 255;
    }
    return { data, width, height };
  }

  describe('detectObjects', () => {
    it('应该检测纯色图像中的物体', () => {
      const image = createTestImage(100, 100, { r: 200, g: 150, b: 100 });
      const objects = detectObjects(image);
      
      expect(Array.isArray(objects)).toBe(true);
    });

    it('应该返回符合配置的结果', () => {
      const image = createTestImage(100, 100, { r: 128, g: 128, b: 128 });
      const config: Partial<SceneUnderstandingConfig> = {
        maxObjects: 5,
        objectConfidenceThreshold: 0.8,
      };
      
      const objects = detectObjects(image, config);
      expect(objects.length).toBeLessThanOrEqual(5);
      
      for (const obj of objects) {
        expect(obj.confidence).toBeGreaterThanOrEqual(0.8);
      }
    });
  });
});

// ==================== 人脸检测测试 ====================

describe('人脸检测', () => {
  function createTestImage(width: number, height: number, color: { r: number; g: number; b: number }): ImageData {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = color.r;
      data[i + 1] = color.g;
      data[i + 2] = color.b;
      data[i + 3] = 255;
    }
    return { data, width, height };
  }

  describe('detectFaces', () => {
    it('应该检测肤色区域', () => {
      const image = createTestImage(100, 100, { r: 200, g: 150, b: 100 });
      const faces = detectFaces(image);
      
      expect(Array.isArray(faces)).toBe(true);
    });

    it('应该返回符合配置的结果', () => {
      const image = createTestImage(100, 100, { r: 200, g: 150, b: 100 });
      const config: Partial<SceneUnderstandingConfig> = {
        maxFaces: 3,
        faceConfidenceThreshold: 0.6,
      };
      
      const faces = detectFaces(image, config);
      expect(faces.length).toBeLessThanOrEqual(3);
      
      for (const face of faces) {
        expect(face.confidence).toBeGreaterThanOrEqual(0.6);
      }
    });

    it('应该包含人脸关键点', () => {
      const image = createTestImage(100, 100, { r: 200, g: 150, b: 100 });
      const faces = detectFaces(image);
      
      for (const face of faces) {
        expect(face.landmarks).toBeDefined();
        expect(face.landmarks.leftEye).toBeDefined();
        expect(face.landmarks.rightEye).toBeDefined();
        expect(face.landmarks.nose).toBeDefined();
        expect(face.landmarks.leftMouthCorner).toBeDefined();
        expect(face.landmarks.rightMouthCorner).toBeDefined();
      }
    });
  });
});

// ==================== 动作识别测试 ====================

describe('动作识别', () => {
  function createTestFrame(width: number, height: number, color: { r: number; g: number; b: number }, timestamp: number): VideoFrame {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = color.r;
      data[i + 1] = color.g;
      data[i + 2] = color.b;
      data[i + 3] = 255;
    }
    return { data, width, height, timestamp, frameNumber: Math.floor(timestamp * 30) };
  }

  describe('recognizeActions', () => {
    it('应该识别运动', () => {
      const frames: VideoFrame[] = [
        createTestFrame(100, 100, { r: 0, g: 0, b: 0 }, 0),
        createTestFrame(100, 100, { r: 255, g: 255, b: 255 }, 1 / 30),
      ];
      
      const actions = recognizeActions(frames);
      expect(Array.isArray(actions)).toBe(true);
    });

    it('应该返回空数组对于相同帧', () => {
      const frame = createTestFrame(100, 100, { r: 128, g: 128, b: 128 }, 0);
      const frames: VideoFrame[] = [frame, frame];
      
      const actions = recognizeActions(frames);
      expect(actions.length).toBe(0);
    });
  });
});

// ==================== 语义分割测试 ====================

describe('语义分割', () => {
  function createTestImage(width: number, height: number, color: { r: number; g: number; b: number }): ImageData {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = color.r;
      data[i + 1] = color.g;
      data[i + 2] = color.b;
      data[i + 3] = 255;
    }
    return { data, width, height };
  }

  describe('segmentSemantics', () => {
    it('应该返回分割结果', () => {
      const image = createTestImage(100, 100, { r: 128, g: 128, b: 128 });
      const segmentation = segmentSemantics(image);
      
      expect(segmentation.mask).toBeDefined();
      expect(segmentation.width).toBe(100);
      expect(segmentation.height).toBe(100);
      expect(segmentation.categories).toBeDefined();
      expect(segmentation.confidence).toBeDefined();
      expect(segmentation.mask.length).toBe(100 * 100);
    });

    it('应该包含多个类别', () => {
      const image = createTestImage(100, 100, { r: 128, g: 128, b: 128 });
      const segmentation = segmentSemantics(image);
      
      expect(segmentation.categories.length).toBeGreaterThan(0);
      
      for (const category of segmentation.categories) {
        expect(category.id).toBeDefined();
        expect(category.name).toBeDefined();
        expect(category.type).toBeDefined();
        expect(category.color).toBeDefined();
      }
    });
  });
});

// ==================== 场景描述测试 ====================

describe('场景描述', () => {
  function createTestImage(width: number, height: number, color: { r: number; g: number; b: number }): ImageData {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = color.r;
      data[i + 1] = color.g;
      data[i + 2] = color.b;
      data[i + 3] = 255;
    }
    return { data, width, height };
  }

  describe('describeScene', () => {
    it('应该生成场景描述', () => {
      const image = createTestImage(100, 100, { r: 128, g: 128, b: 128 });
      const description = describeScene(image, [], []);
      
      expect(description.sceneType).toBeDefined();
      expect(description.mood).toBeDefined();
      expect(description.lighting).toBeDefined();
      expect(description.timeOfDay).toBeDefined();
      expect(description.complexity).toBeDefined();
      expect(description.motionLevel).toBeDefined();
      expect(description.dominantColors).toBeDefined();
    });

    it('应该基于物体检测场景类型', () => {
      const image = createTestImage(100, 100, { r: 128, g: 128, b: 128 });
      const objects: DetectedObject[] = [
        {
          id: '1',
          category: 'nature',
          confidence: 0.9,
          boundingBox: { x: 0, y: 0, width: 1, height: 1 },
          label: '自然',
          attributes: {},
        },
      ];
      
      const description = describeScene(image, objects, []);
      expect(description.sceneType).toBe('nature');
    });
  });
});

// ==================== 物体跟踪测试 ====================

describe('物体跟踪', () => {
  describe('trackObjects', () => {
    it('应该跟踪物体', () => {
      const previousObjects: DetectedObject[] = [
        {
          id: '1',
          category: 'person',
          confidence: 0.9,
          boundingBox: { x: 0.1, y: 0.1, width: 0.2, height: 0.3 },
          label: '人物',
          attributes: {},
          trackingId: 1,
        },
      ];
      
      const currentObjects: DetectedObject[] = [
        {
          id: '2',
          category: 'person',
          confidence: 0.9,
          boundingBox: { x: 0.12, y: 0.12, width: 0.2, height: 0.3 },
          label: '人物',
          attributes: {},
        },
      ];
      
      const trackingStates = new Map<number, TrackingState>();
      trackingStates.set(1, {
        id: 1,
        category: 'person',
        position: { x: 0.1, y: 0.1, width: 0.2, height: 0.3 },
        velocity: { x: 0, y: 0 },
        quality: 1,
        lostFrames: 0,
        trajectory: [],
      });
      
      const { trackedObjects, updatedStates } = trackObjects(previousObjects, currentObjects, trackingStates);
      
      expect(trackedObjects.length).toBe(1);
      expect(trackedObjects[0].trackingId).toBe(1);
      expect(updatedStates.size).toBe(1);
    });

    it('应该分配新跟踪ID', () => {
      const currentObjects: DetectedObject[] = [
        {
          id: '1',
          category: 'person',
          confidence: 0.9,
          boundingBox: { x: 0.1, y: 0.1, width: 0.2, height: 0.3 },
          label: '人物',
          attributes: {},
        },
      ];
      
      const { trackedObjects } = trackObjects([], currentObjects, new Map());
      
      expect(trackedObjects.length).toBe(1);
      expect(trackedObjects[0].trackingId).toBeDefined();
    });
  });
});

// ==================== 完整场景理解测试 ====================

describe('完整场景理解', () => {
  function createTestImage(width: number, height: number, color: { r: number; g: number; b: number }): ImageData {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = color.r;
      data[i + 1] = color.g;
      data[i + 2] = color.b;
      data[i + 3] = 255;
    }
    return { data, width, height };
  }

  describe('understandScene', () => {
    it('应该返回完整结果', () => {
      const image = createTestImage(100, 100, { r: 128, g: 128, b: 128 });
      const result = understandScene(image);
      
      expect(result.objects).toBeDefined();
      expect(result.faces).toBeDefined();
      expect(result.actions).toBeDefined();
      expect(result.sceneDescription).toBeDefined();
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('应该支持配置选项', () => {
      const image = createTestImage(100, 100, { r: 128, g: 128, b: 128 });
      const config: Partial<SceneUnderstandingConfig> = {
        enableObjectDetection: false,
        enableFaceDetection: false,
        enableSemanticSegmentation: true,
      };
      
      const result = understandScene(image, config);
      
      expect(result.objects.length).toBe(0);
      expect(result.faces.length).toBe(0);
      expect(result.segmentation).toBeDefined();
    });
  });
});

// ==================== 配置测试 ====================

describe('配置', () => {
  describe('createDefaultSceneUnderstandingConfig', () => {
    it('应该创建默认配置', () => {
      const config = createDefaultSceneUnderstandingConfig();
      
      expect(config.enableObjectDetection).toBe(true);
      expect(config.enableFaceDetection).toBe(true);
      expect(config.enableActionRecognition).toBe(true);
      expect(config.enableSemanticSegmentation).toBe(false);
      expect(config.objectConfidenceThreshold).toBe(0.5);
      expect(config.faceConfidenceThreshold).toBe(0.5);
      expect(config.actionConfidenceThreshold).toBe(0.5);
      expect(config.maxObjects).toBe(20);
      expect(config.maxFaces).toBe(10);
      expect(config.enableTracking).toBe(true);
      expect(config.trackingLostThreshold).toBe(30);
    });
  });

  describe('validateSceneUnderstandingConfig', () => {
    it('应该验证有效配置', () => {
      const config = createDefaultSceneUnderstandingConfig();
      expect(validateSceneUnderstandingConfig(config)).toBe(true);
    });

    it('应该拒绝无效配置', () => {
      const invalid = { enableObjectDetection: 'invalid' } as any;
      expect(validateSceneUnderstandingConfig(invalid)).toBe(false);
    });
  });
});

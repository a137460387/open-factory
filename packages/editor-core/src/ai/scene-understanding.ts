/**
 * 场景理解增强模块
 * 
 * 功能：
 * 1. 物体识别与跟踪 - 检测和跟踪视频中的物体
 * 2. 人脸检测与表情分析 - 检测人脸并分析表情
 * 3. 动作识别 - 识别视频中的动作和活动
 * 4. 场景语义分割 - 将场景分割为语义区域
 */

// ==================== 类型定义 ====================

/**
 * 边界框
 */
export interface BoundingBox {
  /** 左上角X坐标 (0-1) */
  x: number;
  /** 左上角Y坐标 (0-1) */
  y: number;
  /** 宽度 (0-1) */
  width: number;
  /** 高度 (0-1) */
  height: number;
}

/**
 * 检测到的物体
 */
export interface DetectedObject {
  /** 物体ID */
  id: string;
  /** 物体类别 */
  category: ObjectCategory;
  /** 置信度 (0-1) */
  confidence: number;
  /** 边界框 */
  boundingBox: BoundingBox;
  /** 物体标签 */
  label: string;
  /** 物体属性 */
  attributes: ObjectAttributes;
  /** 跟踪ID (用于跨帧跟踪) */
  trackingId?: number;
}

/**
 * 物体类别
 */
export type ObjectCategory = 
  | 'person'
  | 'vehicle'
  | 'animal'
  | 'object'
  | 'food'
  | 'furniture'
  | 'electronics'
  | 'nature'
  | 'building'
  | 'text'
  | 'other';

/**
 * 物体属性
 */
export interface ObjectAttributes {
  /** 颜色 */
  color?: string;
  /** 大小 (small, medium, large) */
  size?: 'small' | 'medium' | 'large';
  /** 形状 */
  shape?: string;
  /** 材质 */
  material?: string;
  /** 状态 */
  state?: string;
  /** 动作 */
  action?: string;
}

/**
 * 人脸检测结果
 */
export interface DetectedFace {
  /** 人脸ID */
  id: string;
  /** 边界框 */
  boundingBox: BoundingBox;
  /** 置信度 (0-1) */
  confidence: number;
  /** 关键点 */
  landmarks: FaceLandmarks;
  /** 表情分析 */
  expression: FaceExpression;
  /** 年龄估计 */
  ageEstimate?: number;
  /** 性别估计 */
  genderEstimate?: 'male' | 'female' | 'unknown';
  /** 头部姿态 */
  headPose: HeadPose;
  /** 跟踪ID */
  trackingId?: number;
}

/**
 * 人脸关键点
 */
export interface FaceLandmarks {
  /** 左眼 */
  leftEye: Point2D;
  /** 右眼 */
  rightEye: Point2D;
  /** 鼻子 */
  nose: Point2D;
  /** 左嘴角 */
  leftMouthCorner: Point2D;
  /** 右嘴角 */
  rightMouthCorner: Point2D;
  /** 左眉毛 */
  leftEyebrow: Point2D[];
  /** 右眉毛 */
  rightEyebrow: Point2D[];
  /** 面部轮廓 */
  jawline: Point2D[];
}

/**
 * 2D点
 */
export interface Point2D {
  x: number;
  y: number;
}

/**
 * 表情分析
 */
export interface FaceExpression {
  /** 主要表情 */
  primary: ExpressionType;
  /** 表情置信度 */
  confidence: number;
  /** 所有表情概率 */
  probabilities: Record<ExpressionType, number>;
}

/**
 * 表情类型
 */
export type ExpressionType = 
  | 'neutral'
  | 'happy'
  | 'sad'
  | 'angry'
  | 'surprised'
  | 'fearful'
  | 'disgusted'
  | 'contempt';

/**
 * 头部姿态
 */
export interface HeadPose {
  /** 偏航角 (-90到90度) */
  yaw: number;
  /** 俯仰角 (-90到90度) */
  pitch: number;
  /** 翻滚角 (-90到90度) */
  roll: number;
}

/**
 * 动作识别结果
 */
export interface DetectedAction {
  /** 动作ID */
  id: string;
  /** 动作类别 */
  category: ActionCategory;
  /** 动作标签 */
  label: string;
  /** 置信度 (0-1) */
  confidence: number;
  /** 时间范围 */
  timeRange: TimeRange;
  /** 参与者 */
  participants: string[];
  /** 动作属性 */
  attributes: ActionAttributes;
}

/**
 * 动作类别
 */
export type ActionCategory = 
  | 'movement'
  | 'gesture'
  | 'interaction'
  | 'sports'
  | 'cooking'
  | 'working'
  | 'communication'
  | 'entertainment'
  | 'other';

/**
 * 时间范围
 */
export interface TimeRange {
  /** 开始时间 (秒) */
  startTime: number;
  /** 结束时间 (秒) */
  endTime: number;
}

/**
 * 动作属性
 */
export interface ActionAttributes {
  /** 动作强度 (0-1) */
  intensity?: number;
  /** 动作速度 (slow, medium, fast) */
  speed?: 'slow' | 'medium' | 'fast';
  /** 动作方向 */
  direction?: string;
  /** 重复性 */
  repetitive?: boolean;
}

/**
 * 语义分割结果
 */
export interface SemanticSegmentation {
  /** 分割掩码 (每个像素的类别ID) */
  mask: Uint8Array;
  /** 宽度 */
  width: number;
  /** 高度 */
  height: number;
  /** 类别映射 */
  categories: SegmentationCategory[];
  /** 分割置信度 */
  confidence: Uint8Array;
}

/**
 * 分割类别
 */
export interface SegmentationCategory {
  /** 类别ID */
  id: number;
  /** 类别名称 */
  name: string;
  /** 类别类型 */
  type: SegmentationType;
  /** 颜色 (用于可视化) */
  color: { r: number; g: number; b: number };
}

/**
 * 分割类型
 */
export type SegmentationType = 
  | 'background'
  | 'person'
  | 'sky'
  | 'ground'
  | 'water'
  | 'vegetation'
  | 'building'
  | 'road'
  | 'vehicle'
  | 'object'
  | 'other';

/**
 * 场景理解结果
 */
export interface SceneUnderstandingResult {
  /** 检测到的物体 */
  objects: DetectedObject[];
  /** 检测到的人脸 */
  faces: DetectedFace[];
  /** 检测到的动作 */
  actions: DetectedAction[];
  /** 语义分割 */
  segmentation?: SemanticSegmentation;
  /** 场景描述 */
  sceneDescription: SceneDescription;
  /** 处理时间 (毫秒) */
  processingTime: number;
}

/**
 * 场景描述
 */
export interface SceneDescription {
  /** 场景类型 */
  sceneType: SceneType;
  /** 场景氛围 */
  mood: SceneMood;
  /** 光照条件 */
  lighting: LightingCondition;
  /** 天气 (如果是室外) */
  weather?: WeatherCondition;
  /** 时间段 */
  timeOfDay: TimeOfDay;
  /** 场景复杂度 (0-1) */
  complexity: number;
  /** 运动程度 (0-1) */
  motionLevel: number;
  /** 主要颜色 */
  dominantColors: { r: number; g: number; b: number }[];
}

/**
 * 场景类型
 */
export type SceneType = 
  | 'indoor'
  | 'outdoor'
  | 'urban'
  | 'nature'
  | 'studio'
  | 'vehicle'
  | 'water'
  | 'other';

/**
 * 场景氛围
 */
export type SceneMood = 
  | 'neutral'
  | 'happy'
  | 'sad'
  | 'tense'
  | 'romantic'
  | 'mysterious'
  | 'energetic'
  | 'calm';

/**
 * 光照条件
 */
export type LightingCondition = 
  | 'natural'
  | 'artificial'
  | 'mixed'
  | 'low'
  | 'bright'
  | 'backlit'
  | 'side-lit'
  | 'diffused';

/**
 * 天气条件
 */
export type WeatherCondition = 
  | 'clear'
  | 'cloudy'
  | 'rainy'
  | 'snowy'
  | 'foggy'
  | 'windy'
  | 'stormy';

/**
 * 时间段
 */
export type TimeOfDay = 
  | 'dawn'
  | 'morning'
  | 'noon'
  | 'afternoon'
  | 'sunset'
  | 'dusk'
  | 'night'
  | 'unknown';

/**
 * 跟踪状态
 */
export interface TrackingState {
  /** 跟踪ID */
  id: number;
  /** 物体类别 */
  category: ObjectCategory;
  /** 当前位置 */
  position: BoundingBox;
  /** 速度 (像素/帧) */
  velocity: { x: number; y: number };
  /** 跟踪质量 (0-1) */
  quality: number;
  /** 丢失帧数 */
  lostFrames: number;
  /** 历史轨迹 */
  trajectory: BoundingBox[];
}

/**
 * 场景理解配置
 */
export interface SceneUnderstandingConfig {
  /** 是否启用物体检测 */
  enableObjectDetection: boolean;
  /** 是否启用人脸检测 */
  enableFaceDetection: boolean;
  /** 是否启用动作识别 */
  enableActionRecognition: boolean;
  /** 是否启用语义分割 */
  enableSemanticSegmentation: boolean;
  /** 物体检测置信度阈值 */
  objectConfidenceThreshold: number;
  /** 人脸检测置信度阈值 */
  faceConfidenceThreshold: number;
  /** 动作识别置信度阈值 */
  actionConfidenceThreshold: number;
  /** 最大检测物体数 */
  maxObjects: number;
  /** 最大检测人脸数 */
  maxFaces: number;
  /** 是否启用跟踪 */
  enableTracking: boolean;
  /** 跟踪丢失阈值 (帧数) */
  trackingLostThreshold: number;
}

/**
 * 图像数据
 */
export interface ImageData {
  /** 像素数据 */
  data: Uint8ClampedArray;
  /** 宽度 */
  width: number;
  /** 高度 */
  height: number;
}

/**
 * 视频帧
 */
export interface VideoFrame extends ImageData {
  /** 帧时间戳 (秒) */
  timestamp: number;
  /** 帧号 */
  frameNumber: number;
}

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
 * 钳制值到范围
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * 线性插值
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
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
export function computeMotionLevel(
  frame1: ImageData,
  frame2: ImageData,
  threshold: number = 30
): number {
  const { data: data1, width, height } = frame1;
  const { data: data2 } = frame2;
  
  let changedPixels = 0;
  const totalPixels = width * height;

  for (let i = 0; i < data1.length; i += 4) {
    const diff = Math.abs(data1[i] - data2[i]) +
                 Math.abs(data1[i + 1] - data2[i + 1]) +
                 Math.abs(data1[i + 2] - data2[i + 2]);
    
    if (diff > threshold) {
      changedPixels++;
    }
  }

  return changedPixels / totalPixels;
}

// ==================== 核心功能 ====================

/**
 * 默认场景理解配置
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

/**
 * 物体检测
 * 使用简化的基于颜色和纹理的物体检测
 */
export function detectObjects(
  imageData: ImageData,
  config: Partial<SceneUnderstandingConfig> = {}
): DetectedObject[] {
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
  
  for (let y = 0; y < height; y += 4) { // 采样以提高性能
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
        
        const colorDiff = Math.abs(color.r - currentColor.r) +
                         Math.abs(color.g - currentColor.g) +
                         Math.abs(color.b - currentColor.b);
        
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
function computeSegmentBoundingBox(pixels: number[], width: number, height: number): BoundingBox {
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
  category: ObjectCategory
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
  category: ObjectCategory
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
function rgbToHsl(rgb: { r: number; g: number; b: number }): { h: number; s: number; l: number } {
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

/**
 * 人脸检测
 * 使用简化的基于肤色和椭圆检测的方法
 */
export function detectFaces(
  imageData: ImageData,
  config: Partial<SceneUnderstandingConfig> = {}
): DetectedFace[] {
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
function computeFaceConfidence(
  region: { pixels: number[] },
  boundingBox: BoundingBox
): number {
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

/**
 * 动作识别
 * 使用简化的基于运动分析的方法
 */
export function recognizeActions(
  frames: VideoFrame[],
  config: Partial<SceneUnderstandingConfig> = {}
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
  motionLevel: number
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

/**
 * 语义分割
 * 使用简化的基于颜色和位置的分割
 */
export function segmentSemantics(
  imageData: ImageData,
  config: Partial<SceneUnderstandingConfig> = {}
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
  const cb = 0.564 * ((b / 255) - y) + 0.5;
  const cr = 0.713 * ((r / 255) - y) + 0.5;
  
  return y > 0.2 && y < 0.9 && cb > 0.35 && cb < 0.55 && cr > 0.45 && cr < 0.65;
}

/**
 * 场景描述生成
 */
export function describeScene(
  imageData: ImageData,
  objects: DetectedObject[],
  faces: DetectedFace[]
): SceneDescription {
  const { width, height } = imageData;
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
  const { width, height } = imageData;
  const brightness = computeImageBrightness(imageData);
  
  // 基于物体类别判断
  const categories = objects.map(obj => obj.category);
  
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
  faces: DetectedFace[]
): SceneMood {
  // 基于人脸表情判断
  if (faces.length > 0) {
    const expressions = faces.map(face => face.expression.primary);
    
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
  
  for (let i = 0; i < data.length; i += 16) { // 采样
    const r = data[i] / 255;
    const b = data[i + 2] / 255;
    totalWarmth += (r - b);
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
    .map(item => item.color);
}

/**
 * 物体跟踪
 */
export function trackObjects(
  previousObjects: DetectedObject[],
  currentObjects: DetectedObject[],
  trackingStates: Map<number, TrackingState>
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
    const found = trackedObjects.some(obj => obj.trackingId === id);
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

/**
 * 完整场景理解
 */
export function understandScene(
  imageData: ImageData,
  config: Partial<SceneUnderstandingConfig> = {}
): SceneUnderstandingResult {
  const startTime = performance.now();
  const mergedConfig = { ...DEFAULT_SCENE_UNDERSTANDING_CONFIG, ...config };
  
  // 物体检测
  const objects = mergedConfig.enableObjectDetection
    ? detectObjects(imageData, mergedConfig)
    : [];
  
  // 人脸检测
  const faces = mergedConfig.enableFaceDetection
    ? detectFaces(imageData, mergedConfig)
    : [];
  
  // 语义分割
  const segmentation = mergedConfig.enableSemanticSegmentation
    ? segmentSemantics(imageData, mergedConfig)
    : undefined;
  
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

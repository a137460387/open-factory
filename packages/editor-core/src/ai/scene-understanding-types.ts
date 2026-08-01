/**
 * Scene understanding type definitions
 *
 * All interfaces, types, and type aliases for the scene understanding module.
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
export type ExpressionType = 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised' | 'fearful' | 'disgusted' | 'contempt';

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
export type SceneType = 'indoor' | 'outdoor' | 'urban' | 'nature' | 'studio' | 'vehicle' | 'water' | 'other';

/**
 * 场景氛围
 */
export type SceneMood = 'neutral' | 'happy' | 'sad' | 'tense' | 'romantic' | 'mysterious' | 'energetic' | 'calm';

/**
 * 光照条件
 */
export type LightingCondition =
  'natural' | 'artificial' | 'mixed' | 'low' | 'bright' | 'backlit' | 'side-lit' | 'diffused';

/**
 * 天气条件
 */
export type WeatherCondition = 'clear' | 'cloudy' | 'rainy' | 'snowy' | 'foggy' | 'windy' | 'stormy';

/**
 * 时间段
 */
export type TimeOfDay = 'dawn' | 'morning' | 'noon' | 'afternoon' | 'sunset' | 'dusk' | 'night' | 'unknown';

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

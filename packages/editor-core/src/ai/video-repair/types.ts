/**
 * Video repair type definitions and configuration utilities
 */

// ==================== 类型定义 ====================

/**
 * 图像数据（RGBA 扁平数组）
 */
export interface ImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/**
 * 视频修复配置
 */
export interface VideoRepairConfig {
  /** 去抖动强度 (0-1) */
  stabilizationStrength: number;
  /** 去模糊强度 (0-1) */
  deblurStrength: number;
  /** 色彩修复强度 (0-1) */
  colorRepairStrength: number;
  /** 降噪强度 (0-1) */
  denoiseStrength: number;
  /** 划痕修复强度 (0-1) */
  scratchRepairStrength: number;
  /** 是否启用帧插值 */
  enableFrameInterpolation: boolean;
  /** 帧插值倍率 (2=双倍帧率) */
  frameInterpolationFactor: number;
  /** 是否启用 GPU 加速 */
  gpuAccelerated: boolean;
  /** 处理质量 (0-1) */
  quality: number;
}

/**
 * 视频修复结果
 */
export interface VideoRepairResult {
  /** 修复后的帧 */
  output: ImageData;
  /** 应用的修复操作 */
  appliedRepairs: RepairOperation[];
  /** 处理耗时（毫秒） */
  processingTimeMs: number;
  /** 质量改善评估 (0-1) */
  qualityImprovement: number;
  /** 检测到的问题 */
  detectedIssues: DetectedIssue[];
}

/**
 * 修复操作
 */
export interface RepairOperation {
  /** 操作类型 */
  type: RepairType;
  /** 应用强度 */
  strength: number;
  /** 处理耗时（毫秒） */
  processingTimeMs: number;
  /** 效果评估 (0-1) */
  effectiveness: number;
}

/**
 * 修复类型
 */
export type RepairType =
  | 'stabilization'
  | 'deblur'
  | 'color-repair'
  | 'denoise'
  | 'scratch-repair'
  | 'frame-interpolation'
  | 'exposure-compensation'
  | 'white-balance';

/**
 * 检测到的问题
 */
export interface DetectedIssue {
  /** 问题类型 */
  type: IssueType;
  /** 严重程度 (0-1) */
  severity: number;
  /** 问题区域 */
  region?: BoundingBox;
  /** 问题描述 */
  description: string;
}

/**
 * 问题类型
 */
export type IssueType =
  | 'blur'
  | 'shake'
  | 'underexposure'
  | 'overexposure'
  | 'color-cast'
  | 'noise'
  | 'scratch'
  | 'flicker'
  | 'dropped-frame';

/**
 * 边界框
 */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 帧间运动信息
 */
export interface FrameMotion {
  /** 全局平移 X */
  translationX: number;
  /** 全局平移 Y */
  translationY: number;
  /** 全局旋转角度（弧度） */
  rotation: number;
  /** 全局缩放 */
  scale: number;
  /** 运动置信度 (0-1) */
  confidence: number;
  /** 局部运动向量场 */
  localMotionVectors?: Float32Array;
}

/**
 * 色彩分析结果
 */
export interface ColorProfile {
  /** 平均亮度 (0-1) */
  averageBrightness: number;
  /** 色温 (冷-暖, -1到1) */
  colorTemperature: number;
  /** 色调偏移 (绿-品红, -1到1) */
  tint: number;
  /** 对比度 (0-1) */
  contrast: number;
  /** 饱和度 (0-1) */
  saturation: number;
  /** 直方图 */
  histogram: {
    red: number[];
    green: number[];
    blue: number[];
  };
  /** 暗部裁切比例 */
  shadowClipping: number;
  /** 亮部裁切比例 */
  highlightClipping: number;
}

/**
 * 帧插值结果
 */
export interface InterpolatedFrame {
  /** 插值帧 */
  frame: ImageData;
  /** 在原始帧之间的时间位置 (0-1) */
  t: number;
  /** 插值质量 (0-1) */
  quality: number;
}

// ==================== 默认配置 ====================

/**
 * 创建默认视频修复配置
 */
export function createDefaultVideoRepairConfig(): VideoRepairConfig {
  return {
    stabilizationStrength: 0.5,
    deblurStrength: 0.3,
    colorRepairStrength: 0.5,
    denoiseStrength: 0.3,
    scratchRepairStrength: 0.5,
    enableFrameInterpolation: false,
    frameInterpolationFactor: 2,
    gpuAccelerated: true,
    quality: 0.8,
  };
}

/**
 * 验证视频修复配置
 */
export function validateVideoRepairConfig(config: VideoRepairConfig): string[] {
  const errors: string[] = [];
  const checkRange = (val: number, name: string) => {
    if (val < 0 || val > 1) errors.push(`${name}必须在 0-1 之间`);
  };
  checkRange(config.stabilizationStrength, '去抖动强度');
  checkRange(config.deblurStrength, '去模糊强度');
  checkRange(config.colorRepairStrength, '色彩修复强度');
  checkRange(config.denoiseStrength, '降噪强度');
  checkRange(config.scratchRepairStrength, '划痕修复强度');
  checkRange(config.quality, '处理质量');
  if (config.frameInterpolationFactor < 2 || config.frameInterpolationFactor > 8) {
    errors.push('帧插值倍率必须在 2-8 之间');
  }
  return errors;
}

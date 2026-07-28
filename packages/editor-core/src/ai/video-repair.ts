/**
 * AI视频修复模块
 *
 * 功能：
 * 1. 视频去抖动 - 基于光流估计的帧稳定化
 * 2. 视频去模糊 - 基于反卷积和自适应锐化的模糊修复
 * 3. 色彩修复 - 自动白平衡、曝光补偿、色彩还原
 * 4. 划痕/噪点修复 - 基于时空域滤波的缺陷修复
 * 5. 帧插值 - 基于运动补偿的中间帧生成
 *
 * 本地优先：所有处理在本地完成，不依赖云端 API
 */

// ==================== Re-exports (向后兼容) ====================

export type {
  ImageData,
  VideoRepairConfig,
  VideoRepairResult,
  RepairOperation,
  RepairType,
  DetectedIssue,
  IssueType,
  BoundingBox,
  FrameMotion,
  ColorProfile,
  InterpolatedFrame,
} from './video-repair/types';

export { createDefaultVideoRepairConfig, validateVideoRepairConfig } from './video-repair/types';

export {
  detectIssues,
  detectBlur,
  detectShake,
  detectExposureIssues,
  detectColorCast,
  detectNoiseLevel,
  detectFlicker,
} from './video-repair/detection';

export { estimateFrameMotion } from './video-repair/motion';

export { stabilizeFrame, deblurFrame } from './video-repair/stabilization';

export { analyzeColorProfile, autoWhiteBalance, exposureCompensation, repairColor } from './video-repair/color-repair';

export { interpolateFrame, interpolateVideoFrames } from './video-repair/frame-interpolation';

export { spatiotemporalDenoise } from './video-repair/denoise';

// ==================== 主处理函数 ====================

import type { ImageData, VideoRepairConfig, VideoRepairResult, RepairOperation } from './video-repair/types';
import { detectIssues } from './video-repair/detection';
import { stabilizeFrame } from './video-repair/stabilization';
import { deblurFrame } from './video-repair/stabilization';
import { repairColor } from './video-repair/color-repair';
import { spatiotemporalDenoise } from './video-repair/denoise';

/**
 * 对单帧执行完整的视频修复流程
 *
 * 流程：
 * 1. 问题检测
 * 2. 去抖动（如果有前帧）
 * 3. 去模糊
 * 4. 色彩修复
 * 5. 降噪
 */
export function repairFrame(frame: ImageData, config: VideoRepairConfig, previousFrame?: ImageData): VideoRepairResult {
  const startTime = performance.now();
  const appliedRepairs: RepairOperation[] = [];
  let result = frame;
  const detectedIssues = detectIssues(frame, previousFrame);

  // 1. 去抖动
  if (previousFrame && config.stabilizationStrength > 0) {
    const shakeIssue = detectedIssues.find((i) => i.type === 'shake');
    if (shakeIssue && shakeIssue.severity > 0.1) {
      const t0 = performance.now();
      const stabilized = stabilizeFrame(result, previousFrame, config.stabilizationStrength);
      result = stabilized.output;
      appliedRepairs.push({
        type: 'stabilization',
        strength: config.stabilizationStrength,
        processingTimeMs: performance.now() - t0,
        effectiveness: Math.min(1, shakeIssue.severity * 2),
      });
    }
  }

  // 2. 去模糊
  if (config.deblurStrength > 0) {
    const blurIssue = detectedIssues.find((i) => i.type === 'blur');
    if (blurIssue && blurIssue.severity > 0.2) {
      const t0 = performance.now();
      result = deblurFrame(result, config.deblurStrength);
      appliedRepairs.push({
        type: 'deblur',
        strength: config.deblurStrength,
        processingTimeMs: performance.now() - t0,
        effectiveness: Math.min(1, blurIssue.severity * 1.5),
      });
    }
  }

  // 3. 色彩修复
  if (config.colorRepairStrength > 0) {
    const colorIssues = detectedIssues.filter(
      (i) => i.type === 'color-cast' || i.type === 'underexposure' || i.type === 'overexposure',
    );
    if (colorIssues.length > 0) {
      const t0 = performance.now();
      const repaired = repairColor(result, config.colorRepairStrength);
      result = repaired.output;
      appliedRepairs.push({
        type: 'color-repair',
        strength: config.colorRepairStrength,
        processingTimeMs: performance.now() - t0,
        effectiveness: 0.7,
      });
    }
  }

  // 4. 降噪
  if (config.denoiseStrength > 0) {
    const noiseIssue = detectedIssues.find((i) => i.type === 'noise');
    if (noiseIssue && noiseIssue.severity > 0.15) {
      const t0 = performance.now();
      result = spatiotemporalDenoise(result, previousFrame, config.denoiseStrength);
      appliedRepairs.push({
        type: 'denoise',
        strength: config.denoiseStrength,
        processingTimeMs: performance.now() - t0,
        effectiveness: Math.min(1, noiseIssue.severity * 1.5),
      });
    }
  }

  const processingTimeMs = performance.now() - startTime;
  const qualityImprovement =
    appliedRepairs.length > 0 ? appliedRepairs.reduce((s, r) => s + r.effectiveness, 0) / appliedRepairs.length : 0;

  return {
    output: result,
    appliedRepairs,
    processingTimeMs,
    qualityImprovement,
    detectedIssues,
  };
}

/**
 * 批量修复视频帧
 */
export function repairVideoFrames(
  frames: ImageData[],
  config: VideoRepairConfig,
  onProgress?: (frameIndex: number, total: number) => void,
): VideoRepairResult[] {
  const results: VideoRepairResult[] = [];

  for (let i = 0; i < frames.length; i++) {
    const prevFrame = i > 0 ? frames[i - 1] : undefined;
    const result = repairFrame(frames[i], config, prevFrame);
    results.push(result);
    onProgress?.(i + 1, frames.length);
  }

  return results;
}

/**
 * 多机位切换生成器模块
 *
 * 负责在多机位切换时自动生成对应的时间线剪辑片段，
 * 支持转场效果应用。纯函数化设计。
 */

import { round } from '../time';

// ── 类型定义 ──────────────────────────────────────────────────

/** 切换过渡类型 */
export type SwitchTransitionType = 'cut' | 'dissolve' | 'wipe-left' | 'wipe-right' | 'wipe-up' | 'wipe-down';

/** 生成的剪辑片段 */
export interface GeneratedSegment {
  /** 片段 ID */
  id: string;
  /** 来源机位 ID */
  angleId: string;
  /** 来源媒体 ID */
  mediaId: string;
  /** 在时间线上的起始时间 */
  startTime: number;
  /** 片段持续时间 */
  duration: number;
  /** 媒体内的起始偏移（考虑同步偏移） */
  mediaOffset: number;
  /** 片段名称 */
  name: string;
}

/** 生成的转场 */
export interface GeneratedTransition {
  id: string;
  type: SwitchTransitionType;
  duration: number;
  fromSegmentId: string;
  toSegmentId: string;
}

/** 切换生成结果 */
export interface SwitchGenerationResult {
  segments: GeneratedSegment[];
  transitions: GeneratedTransition[];
}

/** 机位定义 */
export interface AngleDefinition {
  id: string;
  mediaId: string;
  name: string;
  /** 同步偏移（秒） */
  syncOffset: number;
  /** 媒体总时长（秒） */
  mediaDuration: number;
}

/** 切换点定义 */
export interface SwitchPointDef {
  time: number;
  targetAngleIndex: number;
  transition: SwitchTransitionType;
}

/** 切换生成选项 */
export interface SwitchGenerationOptions {
  /** 默认转场时长（秒） */
  defaultTransitionDuration?: number;
  /** 最大转场时长（秒） */
  maxTransitionDuration?: number;
  /** 片段 ID 前缀 */
  segmentIdPrefix?: string;
  /** 转场 ID 前缀 */
  transitionIdPrefix?: string;
}

// ── 常量 ──────────────────────────────────────────────────────

const DEFAULT_TRANSITION_DURATION = 0.5;
const MAX_TRANSITION_DURATION = 2.0;
const DEFAULT_SEGMENT_PREFIX = 'mc-seg';
const DEFAULT_TRANSITION_PREFIX = 'mc-tr';

// ── ID 生成 ──────────────────────────────────────────────────

let idCounter = 0;

function generateId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

// ── 核心函数 ──────────────────────────────────────────────────

/**
 * 根据切换点数组生成时间线剪辑片段和转场
 *
 * @param angles - 机位定义数组
 * @param switchPoints - 切换点数组（需按时间排序）
 * @param totalDuration - 总时长（秒）
 * @param options - 生成选项
 * @returns 生成的片段和转场数组
 */
export function generateSwitchSegments(
  angles: AngleDefinition[],
  switchPoints: SwitchPointDef[],
  totalDuration: number,
  options: SwitchGenerationOptions = {},
): SwitchGenerationResult {
  if (angles.length === 0 || totalDuration <= 0) {
    return { segments: [], transitions: [] };
  }

  const transitionDuration = Math.min(
    options.defaultTransitionDuration ?? DEFAULT_TRANSITION_DURATION,
    options.maxTransitionDuration ?? MAX_TRANSITION_DURATION,
  );
  const segPrefix = options.segmentIdPrefix ?? DEFAULT_SEGMENT_PREFIX;
  const trPrefix = options.transitionIdPrefix ?? DEFAULT_TRANSITION_PREFIX;

  // 排序切换点
  const sortedSwitches = [...switchPoints].sort((a, b) => a.time - b.time);

  // 构建时间段列表
  const timeSegments: Array<{
    startTime: number;
    endTime: number;
    angleIndex: number;
    transition: SwitchTransitionType;
  }> = [];

  // 第一个段：从起始到第一个切换点（或整个时长），使用默认机位 0
  const firstEnd = sortedSwitches.length > 0 ? sortedSwitches[0].time : totalDuration;
  timeSegments.push({
    startTime: 0,
    endTime: Math.min(firstEnd, totalDuration),
    angleIndex: 0,
    transition: 'cut',
  });

  // 后续段
  for (let i = 0; i < sortedSwitches.length; i++) {
    const current = sortedSwitches[i];
    const next = sortedSwitches[i + 1];
    const endTime = next ? next.time : totalDuration;

    if (endTime > current.time) {
      timeSegments.push({
        startTime: current.time,
        endTime: Math.min(endTime, totalDuration),
        angleIndex: clampIndex(current.targetAngleIndex, angles.length),
        transition: current.transition,
      });
    }
  }

  // 合并相邻同机位段
  const mergedSegments = mergeAdjacentSegments(timeSegments);

  // 生成片段
  const segments: GeneratedSegment[] = mergedSegments.map((seg, index) => {
    const angle = angles[seg.angleIndex];
    const duration = round(Math.max(0, seg.endTime - seg.startTime));
    const mediaOffset = round(Math.max(0, seg.startTime + angle.syncOffset));

    return {
      id: generateId(segPrefix),
      angleId: angle.id,
      mediaId: angle.mediaId,
      startTime: round(seg.startTime),
      duration,
      mediaOffset: Math.max(0, mediaOffset),
      name: `${angle.name} - Segment ${index + 1}`,
    };
  });

  // 生成转场（仅在非 cut 类型时）
  const transitions: GeneratedTransition[] = [];
  for (let i = 1; i < segments.length; i++) {
    const prevSeg = mergedSegments[i - 1];
    const seg = mergedSegments[i];

    if (seg.transition !== 'cut') {
      const maxDur = Math.min(transitionDuration, segments[i].duration / 2, segments[i - 1].duration / 2);
      if (maxDur > 0.01) {
        transitions.push({
          id: generateId(trPrefix),
          type: seg.transition,
          duration: round(maxDur),
          fromSegmentId: segments[i - 1].id,
          toSegmentId: segments[i].id,
        });
      }
    }
  }

  return { segments, transitions };
}

/**
 * 生成单次实时切换的片段变更
 * 用于播放时实时切换机位的场景
 *
 * @param currentTime - 当前播放时间
 * @param currentAngleIndex - 当前机位索引
 * @param targetAngleIndex - 目标机位索引
 * @param angles - 机位定义数组
 * @param remainingDuration - 从当前时间到结束的剩余时长
 * @returns 新增的切换点
 */
export function generateRealtimeSwitch(
  currentTime: number,
  currentAngleIndex: number,
  targetAngleIndex: number,
  angles: AngleDefinition[],
  remainingDuration: number,
): SwitchPointDef | undefined {
  if (targetAngleIndex === currentAngleIndex) return undefined;
  if (targetAngleIndex < 0 || targetAngleIndex >= angles.length) return undefined;
  if (currentTime < 0) return undefined;

  return {
    time: round(currentTime),
    targetAngleIndex,
    transition: 'cut', // 实时切换默认使用硬切
  };
}

/**
 * 验证切换点数组的有效性
 */
export function validateSwitchPoints(
  switchPoints: SwitchPointDef[],
  angleCount: number,
  totalDuration: number,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (angleCount <= 0) {
    errors.push('至少需要一个机位');
  }

  for (let i = 0; i < switchPoints.length; i++) {
    const sp = switchPoints[i];

    if (sp.time < 0) {
      errors.push(`切换点 ${i}: 时间不能为负`);
    }
    if (sp.time >= totalDuration) {
      errors.push(`切换点 ${i}: 时间超出总时长`);
    }
    if (sp.targetAngleIndex < 0 || sp.targetAngleIndex >= angleCount) {
      errors.push(`切换点 ${i}: 机位索引越界`);
    }
    if (i > 0 && sp.time < switchPoints[i - 1].time) {
      errors.push(`切换点 ${i}: 时间顺序错误`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 计算切换点之间的最小间隔警告
 */
export function findSwitchIntervalWarnings(
  switchPoints: SwitchPointDef[],
  fps = 30,
  minFrames = 12,
): Array<{ index: number; gapFrames: number }> {
  const warnings: Array<{ index: number; gapFrames: number }> = [];
  const frameDuration = 1 / fps;

  for (let i = 1; i < switchPoints.length; i++) {
    const gap = switchPoints[i].time - switchPoints[i - 1].time;
    const gapFrames = Math.round(gap / frameDuration);
    if (gapFrames < minFrames) {
      warnings.push({ index: i, gapFrames });
    }
  }

  return warnings;
}

// ── 辅助函数 ──────────────────────────────────────────────────

function clampIndex(index: number, length: number): number {
  return Math.max(0, Math.min(length - 1, index));
}

function mergeAdjacentSegments(
  segments: Array<{ startTime: number; endTime: number; angleIndex: number; transition: SwitchTransitionType }>,
): Array<{ startTime: number; endTime: number; angleIndex: number; transition: SwitchTransitionType }> {
  if (segments.length <= 1) return segments;

  const merged = [segments[0]];
  for (let i = 1; i < segments.length; i++) {
    const last = merged[merged.length - 1];
    const current = segments[i];

    if (last.angleIndex === current.angleIndex && last.endTime >= current.startTime - 0.000001) {
      // 合并同机位相邻段
      merged[merged.length - 1] = {
        ...last,
        endTime: Math.max(last.endTime, current.endTime),
      };
    } else {
      merged.push(current);
    }
  }

  return merged;
}

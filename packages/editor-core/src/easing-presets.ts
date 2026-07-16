/**
 * 缓动预设库 — 30+ 种专业缓动曲线预设。
 *
 * 每个预设通过贝塞尔手柄 (inHandle/outHandle) 定义曲线形状，
 * 可直接应用到 Keyframe 对象上。
 *
 * @module easing-presets
 */

import type { KeyframeEasing, KeyframeHandle } from './model-types';

/** 缓动预设分类 */
export type EasingPresetCategory = 'standard' | 'overshoot' | 'spring' | 'steps';

/** 缓动预设定义 */
export interface EasingPreset {
  id: string;
  label: string;
  category: EasingPresetCategory;
  /** 基础缓动类型 */
  easing: KeyframeEasing;
  /** 贝塞尔入点手柄覆盖 */
  inHandle?: KeyframeHandle;
  /** 贝塞尔出点手柄覆盖 */
  outHandle?: KeyframeHandle;
  /** 步进数（仅 steps 分类） */
  steps?: number;
  description: string;
}

/** 全部缓动预设 */
export const EASING_PRESETS: EasingPreset[] = [
  // ═══ 标准类 (12) ═══
  {
    id: 'linear',
    label: 'Linear',
    category: 'standard',
    easing: 'linear',
    description: 'Constant speed from start to end',
  },
  {
    id: 'ease-in',
    label: 'Ease In',
    category: 'standard',
    easing: 'ease-in',
    description: 'Slow start, accelerating to end',
  },
  {
    id: 'ease-out',
    label: 'Ease Out',
    category: 'standard',
    easing: 'ease-out',
    description: 'Fast start, decelerating to end',
  },
  {
    id: 'ease-in-out',
    label: 'Ease In-Out',
    category: 'standard',
    easing: 'ease-in-out',
    description: 'Slow start and end, fast middle',
  },
  {
    id: 'cubic-in',
    label: 'Cubic In',
    category: 'standard',
    easing: 'ease-in',
    inHandle: { dx: 0.32, dy: 0 },
    outHandle: { dx: 0.68, dy: 0.05 },
    description: 'Cubic acceleration curve',
  },
  {
    id: 'cubic-out',
    label: 'Cubic Out',
    category: 'standard',
    easing: 'ease-out',
    inHandle: { dx: 0.32, dy: 0.95 },
    outHandle: { dx: 0.68, dy: 1 },
    description: 'Cubic deceleration curve',
  },
  {
    id: 'cubic-in-out',
    label: 'Cubic In-Out',
    category: 'standard',
    easing: 'ease-in-out',
    inHandle: { dx: 0.33, dy: 0 },
    outHandle: { dx: 0.67, dy: 1 },
    description: 'Smooth cubic S-curve',
  },
  {
    id: 'quart-in',
    label: 'Quartic In',
    category: 'standard',
    easing: 'ease-in',
    inHandle: { dx: 0.25, dy: 0 },
    outHandle: { dx: 0.75, dy: 0.02 },
    description: 'Strong acceleration (4th power)',
  },
  {
    id: 'quart-out',
    label: 'Quartic Out',
    category: 'standard',
    easing: 'ease-out',
    inHandle: { dx: 0.25, dy: 0.98 },
    outHandle: { dx: 0.75, dy: 1 },
    description: 'Strong deceleration (4th power)',
  },
  {
    id: 'quint-in',
    label: 'Quintic In',
    category: 'standard',
    easing: 'ease-in',
    inHandle: { dx: 0.22, dy: 0 },
    outHandle: { dx: 0.78, dy: 0.01 },
    description: 'Very strong acceleration (5th power)',
  },
  {
    id: 'sine-in',
    label: 'Sine In',
    category: 'standard',
    easing: 'ease-in',
    inHandle: { dx: 0.12, dy: 0 },
    outHandle: { dx: 0.39, dy: 0 },
    description: 'Sinusoidal acceleration',
  },
  {
    id: 'sine-out',
    label: 'Sine Out',
    category: 'standard',
    easing: 'ease-out',
    inHandle: { dx: 0.61, dy: 1 },
    outHandle: { dx: 0.88, dy: 1 },
    description: 'Sinusoidal deceleration',
  },

  // ═══ 过冲类 (8) ═══
  {
    id: 'sine-in-out',
    label: 'Sine In-Out',
    category: 'overshoot',
    easing: 'ease-in-out',
    inHandle: { dx: 0.37, dy: 0 },
    outHandle: { dx: 0.63, dy: 1 },
    description: 'Sinusoidal S-curve',
  },
  {
    id: 'circ-in',
    label: 'Circular In',
    category: 'overshoot',
    easing: 'ease-in',
    inHandle: { dx: 0.55, dy: 0 },
    outHandle: { dx: 1, dy: 0.45 },
    description: 'Circular arc acceleration',
  },
  {
    id: 'circ-out',
    label: 'Circular Out',
    category: 'overshoot',
    easing: 'ease-out',
    inHandle: { dx: 0, dy: 0.55 },
    outHandle: { dx: 0.45, dy: 1 },
    description: 'Circular arc deceleration',
  },
  {
    id: 'circ-in-out',
    label: 'Circular In-Out',
    category: 'overshoot',
    easing: 'ease-in-out',
    inHandle: { dx: 0.85, dy: 0 },
    outHandle: { dx: 0.15, dy: 1 },
    description: 'Circular arc S-curve',
  },
  {
    id: 'back-in',
    label: 'Back In',
    category: 'overshoot',
    easing: 'ease-in',
    inHandle: { dx: 0.36, dy: 0 },
    outHandle: { dx: 0.64, dy: -0.15 },
    description: 'Overshoots before accelerating',
  },
  {
    id: 'back-out',
    label: 'Back Out',
    category: 'overshoot',
    easing: 'ease-out',
    inHandle: { dx: 0.36, dy: 1.15 },
    outHandle: { dx: 0.64, dy: 1 },
    description: 'Overshoots past end then settles',
  },
  {
    id: 'back-in-out',
    label: 'Back In-Out',
    category: 'overshoot',
    easing: 'ease-in-out',
    inHandle: { dx: 0.36, dy: -0.1 },
    outHandle: { dx: 0.64, dy: 1.1 },
    description: 'Overshoots at both ends',
  },
  {
    id: 'expo-in',
    label: 'Exponential In',
    category: 'overshoot',
    easing: 'ease-in',
    inHandle: { dx: 0.7, dy: 0 },
    outHandle: { dx: 1, dy: 0.3 },
    description: 'Exponential acceleration',
  },

  // ═══ 弹簧类 (6) ═══
  {
    id: 'expo-out',
    label: 'Exponential Out',
    category: 'spring',
    easing: 'ease-out',
    inHandle: { dx: 0, dy: 0.7 },
    outHandle: { dx: 0.3, dy: 1 },
    description: 'Exponential deceleration',
  },
  {
    id: 'expo-in-out',
    label: 'Exponential In-Out',
    category: 'spring',
    easing: 'ease-in-out',
    inHandle: { dx: 0.87, dy: 0 },
    outHandle: { dx: 0.13, dy: 1 },
    description: 'Exponential S-curve',
  },
  {
    id: 'elastic',
    label: 'Elastic',
    category: 'spring',
    easing: 'elastic',
    description: 'Elastic spring oscillation',
  },
  {
    id: 'bounce',
    label: 'Bounce',
    category: 'spring',
    easing: 'bounce',
    description: 'Bouncing ball effect',
  },
  {
    id: 'spring-soft',
    label: 'Spring Soft',
    category: 'spring',
    easing: 'ease-out',
    inHandle: { dx: 0.15, dy: 1.05 },
    outHandle: { dx: 0.4, dy: 1 },
    description: 'Gentle spring settle',
  },
  {
    id: 'spring-hard',
    label: 'Spring Hard',
    category: 'spring',
    easing: 'ease-out',
    inHandle: { dx: 0.05, dy: 1.2 },
    outHandle: { dx: 0.3, dy: 1 },
    description: 'Aggressive spring bounce',
  },

  // ═══ 步进类 (8) ═══
  {
    id: 'steps-2',
    label: '2 Steps',
    category: 'steps',
    easing: 'linear',
    steps: 2,
    description: 'Discrete 2-step jump',
  },
  {
    id: 'steps-3',
    label: '3 Steps',
    category: 'steps',
    easing: 'linear',
    steps: 3,
    description: 'Discrete 3-step jump',
  },
  {
    id: 'steps-4',
    label: '4 Steps',
    category: 'steps',
    easing: 'linear',
    steps: 4,
    description: 'Discrete 4-step jump',
  },
  {
    id: 'steps-5',
    label: '5 Steps',
    category: 'steps',
    easing: 'linear',
    steps: 5,
    description: 'Discrete 5-step jump',
  },
  {
    id: 'steps-6',
    label: '6 Steps',
    category: 'steps',
    easing: 'linear',
    steps: 6,
    description: 'Discrete 6-step jump',
  },
  {
    id: 'steps-8',
    label: '8 Steps',
    category: 'steps',
    easing: 'linear',
    steps: 8,
    description: 'Discrete 8-step jump',
  },
  {
    id: 'steps-10',
    label: '10 Steps',
    category: 'steps',
    easing: 'linear',
    steps: 10,
    description: 'Discrete 10-step jump',
  },
  {
    id: 'steps-12',
    label: '12 Steps',
    category: 'steps',
    easing: 'linear',
    steps: 12,
    description: 'Discrete 12-step jump',
  },
];

/** 按分类获取预设 */
export function getEasingPresetsByCategory(category: EasingPresetCategory): EasingPreset[] {
  return EASING_PRESETS.filter((p) => p.category === category);
}

/** 根据 ID 查找预设 */
export function getEasingPresetById(id: string): EasingPreset | undefined {
  return EASING_PRESETS.find((p) => p.id === id);
}

/** 获取预设的手柄配置（如果有的话） */
export function getPresetHandles(presetId: string): { inHandle?: KeyframeHandle; outHandle?: KeyframeHandle } | null {
  const preset = getEasingPresetById(presetId);
  if (!preset) return null;
  return {
    inHandle: preset.inHandle,
    outHandle: preset.outHandle,
  };
}

/** 判断预设是否为步进类型 */
export function isStepsPreset(presetId: string): boolean {
  const preset = getEasingPresetById(presetId);
  return preset?.category === 'steps';
}

/** 获取步进预设的步数 */
export function getStepsCount(presetId: string): number | null {
  const preset = getEasingPresetById(presetId);
  return preset?.steps ?? null;
}

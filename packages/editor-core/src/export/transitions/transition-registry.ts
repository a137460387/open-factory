/**
 * 转场效果注册表 — 所有内置转场的元数据、分类与 FFmpeg 映射。
 * @module transitions/transition-registry
 */

import type { TransitionType } from '../../model-types';

/** 转场分类 */
export type TransitionCategory = 'basic' | 'advanced' | '3d';

/** 转场定义 */
export interface TransitionDefinition {
  type: TransitionType;
  /** 显示名称（英文，i18n 在 UI 层处理） */
  label: string;
  category: TransitionCategory;
  /** lucide-react 图标名 */
  icon: string;
  /** FFmpeg xfade transition 名称（标准转场使用） */
  xfadeName?: string;
  /** 自定义构建器标识（高级转场使用） */
  customBuilder?: 'light-leak' | 'glitch' | 'flip-h' | 'flip-v' | 'cube-rotate' | 'portal' | 'rotate' | 'motion-blur' | 'shape';
  /** 默认持续时间（秒） */
  defaultDuration: number;
  /** 简短描述 */
  description: string;
}

/** 全部转场注册表 */
export const TRANSITION_REGISTRY: TransitionDefinition[] = [
  // ═══ 基础类 ═══
  {
    type: 'dissolve',
    label: 'Cross Dissolve',
    category: 'basic',
    icon: 'Blend',
    xfadeName: 'dissolve',
    defaultDuration: 0.5,
    description: 'Classic cross dissolve between clips',
  },
  {
    type: 'fade-black',
    label: 'Fade Black',
    category: 'basic',
    icon: 'Moon',
    xfadeName: 'fadeblack',
    defaultDuration: 0.5,
    description: 'Fade through black',
  },
  {
    type: 'wipe-left',
    label: 'Wipe Left',
    category: 'basic',
    icon: 'ArrowLeft',
    xfadeName: 'wipeleft',
    defaultDuration: 0.5,
    description: 'Wipe from right to left',
  },
  {
    type: 'wipe-right',
    label: 'Wipe Right',
    category: 'basic',
    icon: 'ArrowRight',
    xfadeName: 'wiperight',
    defaultDuration: 0.5,
    description: 'Wipe from left to right',
  },
  {
    type: 'wipe-up',
    label: 'Wipe Up',
    category: 'basic',
    icon: 'ArrowUp',
    xfadeName: 'wipeup',
    defaultDuration: 0.5,
    description: 'Wipe from bottom to top',
  },
  {
    type: 'wipe-down',
    label: 'Wipe Down',
    category: 'basic',
    icon: 'ArrowDown',
    xfadeName: 'wipedown',
    defaultDuration: 0.5,
    description: 'Wipe from top to bottom',
  },
  {
    type: 'zoom-dissolve',
    label: 'Zoom Dissolve',
    category: 'basic',
    icon: 'ZoomIn',
    xfadeName: 'zoominzoomout',
    defaultDuration: 0.5,
    description: 'Zoom in/out dissolve effect',
  },
  {
    type: 'push-left',
    label: 'Push Left',
    category: 'basic',
    icon: 'MoveLeft',
    xfadeName: 'slideleft',
    defaultDuration: 0.5,
    description: 'Push outgoing clip to the left',
  },
  {
    type: 'push-right',
    label: 'Push Right',
    category: 'basic',
    icon: 'MoveRight',
    xfadeName: 'slideright',
    defaultDuration: 0.5,
    description: 'Push outgoing clip to the right',
  },
  {
    type: 'push-up',
    label: 'Push Up',
    category: 'basic',
    icon: 'MoveUp',
    xfadeName: 'slideup',
    defaultDuration: 0.5,
    description: 'Push outgoing clip upward',
  },
  {
    type: 'push-down',
    label: 'Push Down',
    category: 'basic',
    icon: 'MoveDown',
    xfadeName: 'slidedown',
    defaultDuration: 0.5,
    description: 'Push outgoing clip downward',
  },

  // ═══ 进阶类 ═══
  {
    type: 'flash-white',
    label: 'Flash White',
    category: 'advanced',
    icon: 'Zap',
    xfadeName: 'fadewhite',
    defaultDuration: 0.3,
    description: 'Flash through white',
  },
  {
    type: 'flash-black',
    label: 'Flash Black',
    category: 'advanced',
    icon: 'ZapOff',
    xfadeName: 'fadeblack',
    defaultDuration: 0.3,
    description: 'Flash through black',
  },
  {
    type: 'block',
    label: 'Block Pixelize',
    category: 'advanced',
    icon: 'Grid3x3',
    xfadeName: 'pixelize',
    defaultDuration: 0.5,
    description: 'Pixelized block transition',
  },
  {
    type: 'film-roll-open',
    label: 'Film Roll Open',
    category: 'advanced',
    icon: 'Film',
    xfadeName: 'horzopen',
    defaultDuration: 0.5,
    description: 'Film strip opening effect',
  },
  {
    type: 'film-roll-close',
    label: 'Film Roll Close',
    category: 'advanced',
    icon: 'Film',
    xfadeName: 'horzclose',
    defaultDuration: 0.5,
    description: 'Film strip closing effect',
  },
  {
    type: 'motion-blur-wipe',
    label: 'Motion Blur Wipe',
    category: 'advanced',
    icon: 'Blur',
    customBuilder: 'motion-blur',
    defaultDuration: 0.5,
    description: 'Wipe with motion blur effect',
  },
  {
    type: 'light-leak',
    label: 'Light Leak',
    category: 'advanced',
    icon: 'Sun',
    customBuilder: 'light-leak',
    defaultDuration: 0.8,
    description: 'Organic light leak overlay transition',
  },
  {
    type: 'glitch',
    label: 'Glitch',
    category: 'advanced',
    icon: 'Bug',
    customBuilder: 'glitch',
    defaultDuration: 0.4,
    description: 'Digital glitch with color shift',
  },
  {
    type: 'shape-heart',
    label: 'Shape Heart',
    category: 'advanced',
    icon: 'Heart',
    customBuilder: 'shape',
    defaultDuration: 0.6,
    description: 'Heart-shaped wipe reveal',
  },
  {
    type: 'shape-star',
    label: 'Shape Star',
    category: 'advanced',
    icon: 'Star',
    customBuilder: 'shape',
    defaultDuration: 0.6,
    description: 'Star-shaped wipe reveal',
  },

  // ═══ 3D 类 ═══
  {
    type: 'rotate',
    label: 'Rotate',
    category: '3d',
    icon: 'RotateCw',
    customBuilder: 'rotate',
    defaultDuration: 0.6,
    description: 'Rotating transition with fade',
  },
  {
    type: 'flip-horizontal',
    label: 'Flip Horizontal',
    category: '3d',
    icon: 'FlipHorizontal',
    customBuilder: 'flip-h',
    defaultDuration: 0.5,
    description: 'Horizontal flip with dissolve',
  },
  {
    type: 'flip-vertical',
    label: 'Flip Vertical',
    category: '3d',
    icon: 'FlipVertical',
    customBuilder: 'flip-v',
    defaultDuration: 0.5,
    description: 'Vertical flip with dissolve',
  },
  {
    type: 'cube-rotate',
    label: 'Cube Rotate',
    category: '3d',
    icon: 'Box',
    customBuilder: 'cube-rotate',
    defaultDuration: 0.7,
    description: '3D cube rotation transition',
  },
  {
    type: 'portal',
    label: 'Portal',
    category: '3d',
    icon: 'Circle',
    customBuilder: 'portal',
    defaultDuration: 0.6,
    description: 'Portal zoom transition',
  },
];

/** 按分类分组的转场类型 */
export function getTransitionsByCategory(category: TransitionCategory): TransitionDefinition[] {
  return TRANSITION_REGISTRY.filter((t) => t.category === category);
}

/** 根据类型查找转场定义 */
export function getTransitionDefinition(type: TransitionType): TransitionDefinition | undefined {
  return TRANSITION_REGISTRY.find((t) => t.type === type);
}

/** 获取转场的默认持续时间 */
export function getTransitionDefaultDuration(type: TransitionType): number {
  return getTransitionDefinition(type)?.defaultDuration ?? 0.5;
}

/** 判断转场是否为自定义滤镜（非标准 xfade） */
export function isCustomTransition(type: TransitionType): boolean {
  const def = getTransitionDefinition(type);
  return def != null && def.customBuilder != null;
}

/** 搜索转场（按名称/描述匹配） */
export function searchTransitions(query: string): TransitionDefinition[] {
  const q = query.toLowerCase().trim();
  if (!q) return TRANSITION_REGISTRY;
  return TRANSITION_REGISTRY.filter(
    (t) =>
      t.label.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.type.toLowerCase().includes(q),
  );
}

/**
 * ACES色彩管理模块 - 色调映射函数
 */

import type { RGBColor } from './types';
import { clamp } from './math-utils';

/**
 * 色调映射函数
 */
export const TONE_MAPPING_FUNCTIONS = {
  /**
   * Reinhard色调映射
   */
  reinhard(color: RGBColor): RGBColor {
    return {
      r: color.r / (1 + color.r),
      g: color.g / (1 + color.g),
      b: color.b / (1 + color.b),
    };
  },

  /**
   * Reinhard扩展色调映射
   */
  reinhardExtended(color: RGBColor, maxWhite: number = 1): RGBColor {
    const divisor = 1 + color.r / (maxWhite * maxWhite);
    return {
      r: (color.r * (1 + color.r / (maxWhite * maxWhite))) / divisor,
      g: (color.g * (1 + color.g / (maxWhite * maxWhite))) / (1 + color.g / (maxWhite * maxWhite)),
      b: (color.b * (1 + color.b / (maxWhite * maxWhite))) / (1 + color.b / (maxWhite * maxWhite)),
    };
  },

  /**
   * ACES Hill色调映射
   */
  acesHill(color: RGBColor): RGBColor {
    const a = 2.51;
    const b = 0.03;
    const c = 2.43;
    const d = 0.59;
    const e = 0.14;

    return {
      r: clamp((color.r * (a * color.r + b)) / (color.r * (c * color.r + d) + e), 0, 1),
      g: clamp((color.g * (a * color.g + b)) / (color.g * (c * color.g + d) + e), 0, 1),
      b: clamp((color.b * (a * color.b + b)) / (color.b * (c * color.b + d) + e), 0, 1),
    };
  },

  /**
   * ACES Narkowicz色调映射
   */
  acesNarkowicz(color: RGBColor): RGBColor {
    const a = 2.51;
    const b = 0.03;
    const c = 2.43;
    const d = 0.59;
    const e = 0.14;

    return {
      r: clamp((color.r * (a * color.r + b)) / (color.r * (c * color.r + d) + e), 0, 1),
      g: clamp((color.g * (a * color.g + b)) / (color.g * (c * color.g + d) + e), 0, 1),
      b: clamp((color.b * (a * color.b + b)) / (color.b * (c * color.b + d) + e), 0, 1),
    };
  },

  /**
   * Filmic色调映射（Hable/Uncharted 2）
   */
  filmic(color: RGBColor): RGBColor {
    const A = 0.15; // Shoulder Strength
    const B = 0.5; // Linear Strength
    const C = 0.1; // Linear Angle
    const D = 0.2; // Toe Strength
    const E = 0.02; // Toe Numerator
    const F = 0.3; // Toe Denominator

    const filmicChannel = (x: number) => {
      return (x * (A * x + C * B) + D * E) / (x * (A * x + B) + D * F) - E / F;
    };

    const whiteScale = 1 / filmicChannel(1);

    return {
      r: clamp(filmicChannel(color.r) * whiteScale, 0, 1),
      g: clamp(filmicChannel(color.g) * whiteScale, 0, 1),
      b: clamp(filmicChannel(color.b) * whiteScale, 0, 1),
    };
  },

  /**
   * AGX色调映射
   */
  agx(color: RGBColor): RGBColor {
    // 简化的AGX实现
    const minEv = -12.47393;
    const maxEv = 4.026069;

    const linearToAgx = (x: number) => {
      return clamp(Math.log2(x) - minEv / (maxEv - minEv), 0, 1);
    };

    return {
      r: linearToAgx(color.r),
      g: linearToAgx(color.g),
      b: linearToAgx(color.b),
    };
  },
};

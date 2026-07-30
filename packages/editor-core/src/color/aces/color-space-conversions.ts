/**
 * ACES色彩管理模块 - 色彩空间转换函数
 */

import type { RGBColor, XYZColor, LABColor, ColorMatrix3x3 } from './types';
import { multiplyMatrix3x3, clamp } from './math-utils';
import { TRANSFER_FUNCTIONS } from './transfer-functions';

/**
 * 色彩空间转换函数
 */
export const COLOR_SPACE_CONVERSIONS = {
  /**
   * sRGB到XYZ (D65)
   */
  srgbToXYZ(color: RGBColor): XYZColor {
    // sRGB到XYZ矩阵 (D65)
    const matrix: ColorMatrix3x3 = [
      0.4124564, 0.3575761, 0.1804375, 0.2126729, 0.7151522, 0.072175, 0.0193339, 0.119192, 0.9503041,
    ];

    // 线性化sRGB
    const linear: RGBColor = {
      r: TRANSFER_FUNCTIONS.srgbToLinear(color.r),
      g: TRANSFER_FUNCTIONS.srgbToLinear(color.g),
      b: TRANSFER_FUNCTIONS.srgbToLinear(color.b),
    };

    const result = multiplyMatrix3x3(matrix, linear);
    return { x: result.r, y: result.g, z: result.b };
  },

  /**
   * XYZ到sRGB (D65)
   */
  xyzToSrgb(color: XYZColor): RGBColor {
    // XYZ到sRGB矩阵 (D65)
    const matrix: ColorMatrix3x3 = [
      3.2404542, -1.5371385, -0.4985314, -0.969266, 1.8760108, 0.041556, 0.0556434, -0.2040259, 1.0572252,
    ];

    const linear = multiplyMatrix3x3(matrix, { r: color.x, g: color.y, b: color.z });

    return {
      r: TRANSFER_FUNCTIONS.linearToSrgb(clamp(linear.r, 0, 1)),
      g: TRANSFER_FUNCTIONS.linearToSrgb(clamp(linear.g, 0, 1)),
      b: TRANSFER_FUNCTIONS.linearToSrgb(clamp(linear.b, 0, 1)),
    };
  },

  /**
   * XYZ到LAB
   */
  xyzToLab(color: XYZColor): LABColor {
    // D65白点
    const Xn = 0.95047;
    const Yn = 1.0;
    const Zn = 1.08883;

    const f = (t: number) => {
      const delta = 6 / 29;
      return t > delta * delta * delta ? Math.pow(t, 1 / 3) : t / (3 * delta * delta) + 4 / 29;
    };

    const fx = f(color.x / Xn);
    const fy = f(color.y / Yn);
    const fz = f(color.z / Zn);

    return {
      l: 116 * fy - 16,
      a: 500 * (fx - fy),
      b: 200 * (fy - fz),
    };
  },

  /**
   * LAB到XYZ
   */
  labToXYZ(color: LABColor): XYZColor {
    // D65白点
    const Xn = 0.95047;
    const Yn = 1.0;
    const Zn = 1.08883;

    const fy = (color.l + 16) / 116;
    const fx = color.a / 500 + fy;
    const fz = fy - color.b / 200;

    const delta = 6 / 29;

    const fInv = (t: number) => {
      return t > delta ? t * t * t : 3 * delta * delta * (t - 4 / 29);
    };

    return {
      x: Xn * fInv(fx),
      y: Yn * fInv(fy),
      z: Zn * fInv(fz),
    };
  },
};

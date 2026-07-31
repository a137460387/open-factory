/**
 * ACES色彩管理模块 - 数学工具函数
 */

import type { ColorMatrix3x3, ColorMatrix4x4, RGBColor } from './types';

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
 * 矩阵向量乘法 (3x3)
 */
export function multiplyMatrix3x3(matrix: ColorMatrix3x3, vector: RGBColor): RGBColor {
  return {
    r: matrix[0] * vector.r + matrix[1] * vector.g + matrix[2] * vector.b,
    g: matrix[3] * vector.r + matrix[4] * vector.g + matrix[5] * vector.b,
    b: matrix[6] * vector.r + matrix[7] * vector.g + matrix[8] * vector.b,
  };
}

/**
 * 矩阵向量乘法 (4x4)
 */
export function multiplyMatrix4x4(matrix: ColorMatrix4x4, vector: RGBColor): RGBColor {
  return {
    r: matrix[0] * vector.r + matrix[1] * vector.g + matrix[2] * vector.b + matrix[3],
    g: matrix[4] * vector.r + matrix[5] * vector.g + matrix[6] * vector.b + matrix[7],
    b: matrix[8] * vector.r + matrix[9] * vector.g + matrix[10] * vector.b + matrix[11],
  };
}

/**
 * 矩阵乘法 (3x3)
 */
export function multiplyMatrices3x3(a: ColorMatrix3x3, b: ColorMatrix3x3): ColorMatrix3x3 {
  return [
    a[0] * b[0] + a[1] * b[3] + a[2] * b[6],
    a[0] * b[1] + a[1] * b[4] + a[2] * b[7],
    a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
    a[3] * b[0] + a[4] * b[3] + a[5] * b[6],
    a[3] * b[1] + a[4] * b[4] + a[5] * b[7],
    a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
    a[6] * b[0] + a[7] * b[3] + a[8] * b[6],
    a[6] * b[1] + a[7] * b[4] + a[8] * b[7],
    a[6] * b[2] + a[7] * b[5] + a[8] * b[8],
  ];
}

/**
 * 计算矩阵逆 (3x3)
 */
export function invertMatrix3x3(matrix: ColorMatrix3x3): ColorMatrix3x3 {
  const [a, b, c, d, e, f, g, h, i] = matrix;

  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);

  if (Math.abs(det) < 1e-10) {
    throw new Error('矩阵不可逆');
  }

  const invDet = 1 / det;

  return [
    (e * i - f * h) * invDet,
    (c * h - b * i) * invDet,
    (b * f - c * e) * invDet,
    (f * g - d * i) * invDet,
    (a * i - c * g) * invDet,
    (c * d - a * f) * invDet,
    (d * h - e * g) * invDet,
    (b * g - a * h) * invDet,
    (a * e - b * d) * invDet,
  ];
}

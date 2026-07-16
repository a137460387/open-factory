/**
 * math-utils.ts — 公共数学/数值工具函数
 *
 * 从多个模块中提取的重复数学函数，统一维护。
 * 新代码应从本模块导入，而非各处重复定义。
 */

/** 将值限制在 [min, max] 范围内 */
export function clamp(value: number, min: number, max: number): number {
  if (min > max) {
    throw new RangeError('min cannot be greater than max');
  }
  return Math.min(Math.max(value, min), max);
}

/** 将值限制在 [0, 1] 范围内 */
export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** 四舍五入到指定精度（默认 6 位小数） */
export function round(value: number, precision = 6): number {
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/** 计算数组平均值 */
export function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** 线性插值 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** 将值从一个范围映射到另一个范围 */
export function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number {
  if (inMin === inMax) return outMin;
  return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin);
}

/** 确保值为有限数，否则返回默认值 */
export function finiteOrDefault(value: number | undefined | null, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** 将 dB 转换为线性增益 */
export function dbToLinear(db: number): number {
  return 10 ** (db / 20);
}

/** 将线性增益转换为 dB */
export function linearToDb(linear: number): number {
  if (linear <= 0) return -Infinity;
  return 20 * Math.log10(linear);
}

/** 将角度转换为弧度 */
export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** 将弧度转换为角度 */
export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/** 计算两个值之间的距离 */
export function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

/** 将值限制为非负数 */
export function nonNegative(value: number): number {
  return Math.max(0, value);
}

/** 将值限制为正数 */
export function positive(value: number, fallback = 1): number {
  return value > 0 ? value : fallback;
}

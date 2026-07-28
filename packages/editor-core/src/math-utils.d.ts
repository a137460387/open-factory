/**
 * math-utils.ts — 公共数学/数值工具函数
 *
 * 从多个模块中提取的重复数学函数，统一维护。
 * 新代码应从本模块导入，而非各处重复定义。
 */
/** 将值限制在 [min, max] 范围内 */
export declare function clamp(value: number, min: number, max: number): number;
/** 将值限制在 [0, 1] 范围内 */
export declare function clamp01(value: number): number;
/** 四舍五入到指定精度（默认 6 位小数） */
export declare function round(value: number, precision?: number): number;
/** 计算数组平均值 */
export declare function average(values: number[]): number;
/** 线性插值 */
export declare function lerp(a: number, b: number, t: number): number;
/** 将值从一个范围映射到另一个范围 */
export declare function mapRange(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number;
/** 确保值为有限数，否则返回默认值 */
export declare function finiteOrDefault(value: number | undefined | null, fallback: number): number;
/** 将 dB 转换为线性增益 */
export declare function dbToLinear(db: number): number;
/** 将线性增益转换为 dB */
export declare function linearToDb(linear: number): number;
/** 将角度转换为弧度 */
export declare function degToRad(deg: number): number;
/** 将弧度转换为角度 */
export declare function radToDeg(rad: number): number;
/** 计算两个值之间的距离 */
export declare function distance(x1: number, y1: number, x2: number, y2: number): number;
/** 将值限制为非负数 */
export declare function nonNegative(value: number): number;
/** 将值限制为正数 */
export declare function positive(value: number, fallback?: number): number;
/** 校验并规范化可选的十六进制颜色值（#RGB 或 #RRGGBB），无效时返回 undefined */
export declare function normalizeOptionalHexColor(color: string | undefined): string | undefined;
//# sourceMappingURL=math-utils.d.ts.map
/**
 * math-utils.ts — 公共数学/数值工具函数
 *
 * 从多个模块中提取的重复数学函数，统一维护。
 * 新代码应从本模块导入，而非各处重复定义。
 */
/** 将值限制在 [min, max] 范围内 */
export function clamp(value, min, max) {
    if (min > max) {
        throw new RangeError('min cannot be greater than max');
    }
    return Math.min(Math.max(value, min), max);
}
/** 将值限制在 [0, 1] 范围内 */
export function clamp01(value) {
    return Math.min(1, Math.max(0, value));
}
/** 四舍五入到指定精度（默认 6 位小数） */
export function round(value, precision = 6) {
    const factor = 10 ** precision;
    return Math.round((value + Number.EPSILON) * factor) / factor;
}
/** 计算数组平均值 */
export function average(values) {
    if (values.length === 0)
        return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
}
/** 线性插值 */
export function lerp(a, b, t) {
    return a + (b - a) * t;
}
/** 将值从一个范围映射到另一个范围 */
export function mapRange(value, inMin, inMax, outMin, outMax) {
    if (inMin === inMax)
        return outMin;
    return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin);
}
/** 确保值为有限数，否则返回默认值 */
export function finiteOrDefault(value, fallback) {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
/** 将 dB 转换为线性增益 */
export function dbToLinear(db) {
    return 10 ** (db / 20);
}
/** 将线性增益转换为 dB */
export function linearToDb(linear) {
    if (linear <= 0)
        return -Infinity;
    return 20 * Math.log10(linear);
}
/** 将角度转换为弧度 */
export function degToRad(deg) {
    return (deg * Math.PI) / 180;
}
/** 将弧度转换为角度 */
export function radToDeg(rad) {
    return (rad * 180) / Math.PI;
}
/** 计算两个值之间的距离 */
export function distance(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}
/** 将值限制为非负数 */
export function nonNegative(value) {
    return Math.max(0, value);
}
/** 将值限制为正数 */
export function positive(value, fallback = 1) {
    return value > 0 ? value : fallback;
}
/** 校验并规范化可选的十六进制颜色值（#RGB 或 #RRGGBB），无效时返回 undefined */
export function normalizeOptionalHexColor(color) {
    const trimmed = color?.trim();
    if (!trimmed)
        return undefined;
    const six = /^#([0-9a-fA-F]{6})$/.exec(trimmed);
    if (six)
        return `#${six[1].toLowerCase()}`;
    const three = /^#([0-9a-fA-F]{3})$/.exec(trimmed);
    if (three) {
        const [r, g, b] = three[1].toLowerCase();
        return `#${r}${r}${g}${g}${b}${b}`;
    }
    return undefined;
}
//# sourceMappingURL=math-utils.js.map
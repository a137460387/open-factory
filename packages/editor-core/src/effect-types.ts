/**
 * 效果参数基础类型 — 零本地依赖叶节点。
 * effects.ts 和 motion-blur.ts 共同依赖此文件，避免循环引用。
 */

export type EffectParamValue = number | string | boolean;
export type EffectParams = Record<string, EffectParamValue>;

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
export declare const EASING_PRESETS: EasingPreset[];
/** 按分类获取预设 */
export declare function getEasingPresetsByCategory(category: EasingPresetCategory): EasingPreset[];
/** 根据 ID 查找预设 */
export declare function getEasingPresetById(id: string): EasingPreset | undefined;
/** 获取预设的手柄配置（如果有的话） */
export declare function getPresetHandles(presetId: string): {
    inHandle?: KeyframeHandle;
    outHandle?: KeyframeHandle;
} | null;
/** 判断预设是否为步进类型 */
export declare function isStepsPreset(presetId: string): boolean;
/** 获取步进预设的步数 */
export declare function getStepsCount(presetId: string): number | null;
//# sourceMappingURL=easing-presets.d.ts.map
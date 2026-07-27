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
export declare const TRANSITION_REGISTRY: TransitionDefinition[];
/** 按分类分组的转场类型 */
export declare function getTransitionsByCategory(category: TransitionCategory): TransitionDefinition[];
/** 根据类型查找转场定义 */
export declare function getTransitionDefinition(type: TransitionType): TransitionDefinition | undefined;
/** 获取转场的默认持续时间 */
export declare function getTransitionDefaultDuration(type: TransitionType): number;
/** 判断转场是否为自定义滤镜（非标准 xfade） */
export declare function isCustomTransition(type: TransitionType): boolean;
/** 搜索转场（按名称/描述匹配） */
export declare function searchTransitions(query: string): TransitionDefinition[];
//# sourceMappingURL=transition-registry.d.ts.map
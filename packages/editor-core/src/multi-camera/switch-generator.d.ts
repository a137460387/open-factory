/**
 * 多机位切换生成器模块
 *
 * 负责在多机位切换时自动生成对应的时间线剪辑片段，
 * 支持转场效果应用。纯函数化设计。
 */
/** 切换过渡类型 */
export type SwitchTransitionType = 'cut' | 'dissolve' | 'wipe-left' | 'wipe-right' | 'wipe-up' | 'wipe-down';
/** 生成的剪辑片段 */
export interface GeneratedSegment {
    /** 片段 ID */
    id: string;
    /** 来源机位 ID */
    angleId: string;
    /** 来源媒体 ID */
    mediaId: string;
    /** 在时间线上的起始时间 */
    startTime: number;
    /** 片段持续时间 */
    duration: number;
    /** 媒体内的起始偏移（考虑同步偏移） */
    mediaOffset: number;
    /** 片段名称 */
    name: string;
}
/** 生成的转场 */
export interface GeneratedTransition {
    id: string;
    type: SwitchTransitionType;
    duration: number;
    fromSegmentId: string;
    toSegmentId: string;
}
/** 切换生成结果 */
export interface SwitchGenerationResult {
    segments: GeneratedSegment[];
    transitions: GeneratedTransition[];
}
/** 机位定义 */
export interface AngleDefinition {
    id: string;
    mediaId: string;
    name: string;
    /** 同步偏移（秒） */
    syncOffset: number;
    /** 媒体总时长（秒） */
    mediaDuration: number;
}
/** 切换点定义 */
export interface SwitchPointDef {
    time: number;
    targetAngleIndex: number;
    transition: SwitchTransitionType;
}
/** 切换生成选项 */
export interface SwitchGenerationOptions {
    /** 默认转场时长（秒） */
    defaultTransitionDuration?: number;
    /** 最大转场时长（秒） */
    maxTransitionDuration?: number;
    /** 片段 ID 前缀 */
    segmentIdPrefix?: string;
    /** 转场 ID 前缀 */
    transitionIdPrefix?: string;
}
/**
 * 根据切换点数组生成时间线剪辑片段和转场
 *
 * @param angles - 机位定义数组
 * @param switchPoints - 切换点数组（需按时间排序）
 * @param totalDuration - 总时长（秒）
 * @param options - 生成选项
 * @returns 生成的片段和转场数组
 */
export declare function generateSwitchSegments(angles: AngleDefinition[], switchPoints: SwitchPointDef[], totalDuration: number, options?: SwitchGenerationOptions): SwitchGenerationResult;
/**
 * 生成单次实时切换的片段变更
 * 用于播放时实时切换机位的场景
 *
 * @param currentTime - 当前播放时间
 * @param currentAngleIndex - 当前机位索引
 * @param targetAngleIndex - 目标机位索引
 * @param angles - 机位定义数组
 * @param remainingDuration - 从当前时间到结束的剩余时长
 * @returns 新增的切换点
 */
export declare function generateRealtimeSwitch(currentTime: number, currentAngleIndex: number, targetAngleIndex: number, angles: AngleDefinition[], remainingDuration: number): SwitchPointDef | undefined;
/**
 * 验证切换点数组的有效性
 */
export declare function validateSwitchPoints(switchPoints: SwitchPointDef[], angleCount: number, totalDuration: number): {
    valid: boolean;
    errors: string[];
};
/**
 * 计算切换点之间的最小间隔警告
 */
export declare function findSwitchIntervalWarnings(switchPoints: SwitchPointDef[], fps?: number, minFrames?: number): Array<{
    index: number;
    gapFrames: number;
}>;
//# sourceMappingURL=switch-generator.d.ts.map
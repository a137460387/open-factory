import type { AudioEffectSlot, AudioEffectType } from './mixer-types';
/** 效果链执行计划 */
export interface EffectChainPlan {
    effects: AudioEffectSlot[];
    totalLatency: number;
}
/** FFmpeg 滤镜描述 */
export interface FfmpegAudioFilter {
    filterName: string;
    params: Record<string, string | number>;
}
/** Web Audio 节点描述 */
export interface AudioNodeDescription {
    type: AudioEffectType;
    params: Record<string, number>;
    wetDry: number;
}
export declare class EffectChainEngine {
    /**
     * 排序效果链：过滤掉已禁用的效果，按 order 升序排列
     */
    static sortChain(effects: AudioEffectSlot[]): AudioEffectSlot[];
    /**
     * 验证效果参数：将每个参数值钳制到定义的有效范围内
     */
    static validateParams(effectType: AudioEffectType, params: Record<string, number>): Record<string, number>;
    /**
     * 生成 FFmpeg 滤镜链
     */
    static toFfmpegFilters(effects: AudioEffectSlot[]): FfmpegAudioFilter[];
    /**
     * 描述 Web Audio 节点图
     */
    static describeNodeGraph(effects: AudioEffectSlot[]): AudioNodeDescription[];
    private static effectToFfmpeg;
}
//# sourceMappingURL=effect-chain.d.ts.map
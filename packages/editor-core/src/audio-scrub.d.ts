/**
 * 音频搓擦引擎（Audio Scrubbing）
 * 拖动 playhead 时按位置采样播放短音频片段
 */
export interface AudioScrubOptions {
    /** 采样窗口时长（秒），默认 0.05 */
    sampleWindowSec?: number;
    /** 最小触发间隔（ms），默认 30 */
    minIntervalMs?: number;
    /** 慢速阈值 px/s，默认 100 */
    slowSpeedPxPerSec?: number;
    /** 快速阈值 px/s，默认 500 */
    fastSpeedPxPerSec?: number;
}
export declare const DEFAULT_SCRUB_SAMPLE_WINDOW = 0.05;
export declare const DEFAULT_SCRUB_MIN_INTERVAL_MS = 30;
export declare const DEFAULT_SCRUB_SLOW_SPEED = 100;
export declare const DEFAULT_SCRUB_FAST_SPEED = 500;
export type ScrubSpeedTier = 'slow' | 'medium' | 'fast';
/**
 * 根据拖动速度返回搓擦速率等级
 */
export declare function getScrubSpeedTier(speedPxPerSec: number, options?: Pick<AudioScrubOptions, 'slowSpeedPxPerSec' | 'fastSpeedPxPerSec'>): ScrubSpeedTier;
/**
 * 根据速率等级返回采样间隔倍率
 * slow=1.0（正常）, medium=0.5, fast=0.25（跳帧播放）
 */
export declare function getScrubSampleIntervalMultiplier(tier: ScrubSpeedTier): number;
/**
 * 计算采样窗口对应的 AudioBuffer 帧数
 */
export declare function getScrubSampleFrames(sampleRate: number, options?: Pick<AudioScrubOptions, 'sampleWindowSec'>): number;
/**
 * 判断是否满足防抖间隔
 */
export declare function shouldTriggerScrub(lastTriggerMs: number, nowMs: number, options?: Pick<AudioScrubOptions, 'minIntervalMs'>): boolean;
/**
 * 从静音/独奏状态过滤出可用于搓擦的轨道
 * @param tracks 轨道列表，需包含 id, type, muted, solo
 * @returns 可播放的轨道 id 列表
 */
export declare function filterScrubTracks<T extends {
    id: string;
    type: string;
    muted?: boolean;
    solo?: boolean;
}>(tracks: readonly T[]): string[];
//# sourceMappingURL=audio-scrub.d.ts.map
/**
 * 序列独立设置模块
 * 允许每个 Sequence 拥有独立的帧率/分辨率/时长设置
 */
import type { ProjectSettings, Sequence, SequenceSettings } from './model-types';
export type { SequenceSettings };
/**
 * 获取序列的有效设置，未设置的字段继承项目级设置
 */
export declare function getEffectiveSequenceSettings(sequence: Sequence, projectSettings: ProjectSettings): ProjectSettings;
/**
 * 帧率变更时将 clip 位置从旧帧率重新对齐到新帧率
 * 不修改 clip.duration（那是源时间），只修改 clip.start
 */
export declare function recalculateClipStartsForFrameRate(timeline: {
    tracks: {
        clips: {
            start: number;
        }[];
    }[];
}, oldFps: number, newFps: number): void;
//# sourceMappingURL=sequence-settings.d.ts.map
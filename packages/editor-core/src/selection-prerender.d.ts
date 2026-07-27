import type { Clip, Timeline } from './model';
import type { Effect } from './effects';
import type { KeyframeProperty } from './model-types';
/** 预渲染缓存条目状态 */
export type SelectionCacheStatus = 'none' | 'valid' | 'stale';
/** 预渲染缓存条目 */
export interface SelectionRenderCacheEntry {
    /** 基于时间范围+clip内容摘要的SHA256 hash */
    hash: string;
    /** 缓存文件路径 */
    filePath: string;
    /** 起始时间（秒） */
    startSec: number;
    /** 结束时间（秒） */
    endSec: number;
    /** 创建时间戳 */
    createdAt: number;
}
/** 区间缓存状态 */
export interface SelectionCacheRangeStatus {
    start: number;
    end: number;
    status: SelectionCacheStatus;
    entry?: SelectionRenderCacheEntry;
}
/** clip 内容摘要输入 */
export interface ClipDigestInput {
    clipId: string;
    start: number;
    duration: number;
    trimStart: number;
    speed: number;
    colorBrightness: number;
    colorContrast: number;
    colorSaturation: number;
    colorHue: number;
    effects: Effect[];
    keyframeSnapshot: string;
}
export declare const STALE_IRRELEVANT_PROPERTIES: ReadonlySet<string>;
/**
 * 构建区间内 clip 内容摘要字符串（用于 hash 计算）。
 * 排除音量/静音/声像（不触发 stale）。
 */
export declare function buildClipContentDigest(clips: ClipDigestInput[]): string;
/**
 * 计算预渲染区间 hash。
 * hash = SHA256(startSec + endSec + clipContentDigest)
 */
export declare function calculateSelectionRenderHash(startSec: number, endSec: number, clips: ClipDigestInput[], sha256Fn?: (data: string) => Promise<string> | string): Promise<string>;
/**
 * 构建缓存文件名规则: {projectId}/{hash}.mp4
 */
export declare function buildRenderCacheFilePath(projectId: string, hash: string): string;
/**
 * 判断某个 clip 属性变更是否触发缓存 stale。
 * 只有非音频属性（色彩/特效/关键帧/裁剪/速度）变更才触发。
 */
export declare function doesPropertyChangeTriggerStale(property: KeyframeProperty | string): boolean;
/**
 * 检查给定区间缓存是否有效。
 * - 无缓存 → 'none'
 * - hash 匹配 → 'valid'
 * - hash 不匹配 → 'stale'
 */
export declare function checkSelectionCacheStatus(currentHash: string, cachedEntry: SelectionRenderCacheEntry | undefined): SelectionCacheStatus;
/**
 * 计算给定 duration 和限制时长的超出秒数。
 * 返回 0 表示未超出。
 */
export declare function calculateDurationOverflow(duration: number, maxDurationSec: number): number;
/**
 * 从 timeline 中提取区间内受 clip 变更影响的缓存范围。
 */
export declare function collectClipsInRange(timeline: Timeline, start: number, end: number): Clip[];
/**
 * 从 clip 提取摘要输入。
 */
export declare function clipToDigestInput(clip: Clip): ClipDigestInput;
//# sourceMappingURL=selection-prerender.d.ts.map
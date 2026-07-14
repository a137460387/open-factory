import type { Clip, Timeline } from './model';
import type { Effect } from './effects';
import type { KeyframeProperty } from './model-types';
import { round } from './time';

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

export const STALE_IRRELEVANT_PROPERTIES: ReadonlySet<string> = new Set(['volume', 'muted', 'pan']);

/**
 * 构建区间内 clip 内容摘要字符串（用于 hash 计算）。
 * 排除音量/静音/声像（不触发 stale）。
 */
export function buildClipContentDigest(clips: ClipDigestInput[]): string {
  const sorted = [...clips].sort((a, b) => a.clipId.localeCompare(b.clipId));
  return sorted
    .map((c) =>
      [
        c.clipId,
        c.start.toFixed(6),
        c.duration.toFixed(6),
        c.trimStart.toFixed(6),
        c.speed.toFixed(6),
        c.colorBrightness.toFixed(4),
        c.colorContrast.toFixed(4),
        c.colorSaturation.toFixed(4),
        c.colorHue.toFixed(4),
        JSON.stringify(c.effects),
        c.keyframeSnapshot,
      ].join(':'),
    )
    .join('|');
}

/**
 * 计算预渲染区间 hash。
 * hash = SHA256(startSec + endSec + clipContentDigest)
 */
export async function calculateSelectionRenderHash(
  startSec: number,
  endSec: number,
  clips: ClipDigestInput[],
  sha256Fn?: (data: string) => Promise<string> | string,
): Promise<string> {
  const digest = buildClipContentDigest(clips);
  const payload = `${startSec.toFixed(6)}:${endSec.toFixed(6)}:${digest}`;
  if (sha256Fn) {
    return sha256Fn(payload);
  }
  // browser/node SHA-256 fallback
  if (typeof globalThis.crypto?.subtle !== 'undefined') {
    const encoder = new TextEncoder();
    const data = encoder.encode(payload);
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // fallback simple hash for tests
  return simpleHash(payload);
}

/**
 * 构建缓存文件名规则: {projectId}/{hash}.mp4
 */
export function buildRenderCacheFilePath(projectId: string, hash: string): string {
  return `${projectId}/${hash}.mp4`;
}

/**
 * 判断某个 clip 属性变更是否触发缓存 stale。
 * 只有非音频属性（色彩/特效/关键帧/裁剪/速度）变更才触发。
 */
export function doesPropertyChangeTriggerStale(property: KeyframeProperty | string): boolean {
  return !STALE_IRRELEVANT_PROPERTIES.has(property);
}

/**
 * 检查给定区间缓存是否有效。
 * - 无缓存 → 'none'
 * - hash 匹配 → 'valid'
 * - hash 不匹配 → 'stale'
 */
export function checkSelectionCacheStatus(
  currentHash: string,
  cachedEntry: SelectionRenderCacheEntry | undefined,
): SelectionCacheStatus {
  if (!cachedEntry) {
    return 'none';
  }
  return cachedEntry.hash === currentHash ? 'valid' : 'stale';
}

/**
 * 计算给定 duration 和限制时长的超出秒数。
 * 返回 0 表示未超出。
 */
export function calculateDurationOverflow(duration: number, maxDurationSec: number): number {
  if (maxDurationSec <= 0) {
    return 0;
  }
  return round(Math.max(0, duration - maxDurationSec));
}

/**
 * 从 timeline 中提取区间内受 clip 变更影响的缓存范围。
 */
export function collectClipsInRange(timeline: Timeline, start: number, end: number): Clip[] {
  const result: Clip[] = [];
  for (const track of timeline.tracks) {
    for (const clip of track.clips) {
      const clipEnd = clip.start + clip.duration;
      if (clipEnd > start && clip.start < end) {
        result.push(clip);
      }
    }
  }
  return result;
}

/**
 * 从 clip 提取摘要输入。
 */
export function clipToDigestInput(clip: Clip): ClipDigestInput {
  const cc = clip.colorCorrection;
  const effects = clip.effects ?? [];
  const keyframeSnapshot = clip.keyframes ? JSON.stringify(clip.keyframes) : '';
  return {
    clipId: clip.id,
    start: clip.start,
    duration: clip.duration,
    trimStart: clip.trimStart,
    speed: clip.speed,
    colorBrightness: cc.brightness,
    colorContrast: cc.contrast,
    colorSaturation: cc.saturation,
    colorHue: cc.hue,
    effects,
    keyframeSnapshot,
  };
}

// simple non-crypto hash for testing without crypto.subtle
function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

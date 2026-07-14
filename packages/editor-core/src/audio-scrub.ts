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

export const DEFAULT_SCRUB_SAMPLE_WINDOW = 0.05;
export const DEFAULT_SCRUB_MIN_INTERVAL_MS = 30;
export const DEFAULT_SCRUB_SLOW_SPEED = 100;
export const DEFAULT_SCRUB_FAST_SPEED = 500;

export type ScrubSpeedTier = 'slow' | 'medium' | 'fast';

/**
 * 根据拖动速度返回搓擦速率等级
 */
export function getScrubSpeedTier(
  speedPxPerSec: number,
  options?: Pick<AudioScrubOptions, 'slowSpeedPxPerSec' | 'fastSpeedPxPerSec'>,
): ScrubSpeedTier {
  const slow = options?.slowSpeedPxPerSec ?? DEFAULT_SCRUB_SLOW_SPEED;
  const fast = options?.fastSpeedPxPerSec ?? DEFAULT_SCRUB_FAST_SPEED;
  if (speedPxPerSec < slow) return 'slow';
  if (speedPxPerSec > fast) return 'fast';
  return 'medium';
}

/**
 * 根据速率等级返回采样间隔倍率
 * slow=1.0（正常）, medium=0.5, fast=0.25（跳帧播放）
 */
export function getScrubSampleIntervalMultiplier(tier: ScrubSpeedTier): number {
  switch (tier) {
    case 'slow':
      return 1.0;
    case 'medium':
      return 0.5;
    case 'fast':
      return 0.25;
  }
}

/**
 * 计算采样窗口对应的 AudioBuffer 帧数
 */
export function getScrubSampleFrames(sampleRate: number, options?: Pick<AudioScrubOptions, 'sampleWindowSec'>): number {
  const windowSec = options?.sampleWindowSec ?? DEFAULT_SCRUB_SAMPLE_WINDOW;
  return Math.max(1, Math.round(sampleRate * windowSec));
}

/**
 * 判断是否满足防抖间隔
 */
export function shouldTriggerScrub(
  lastTriggerMs: number,
  nowMs: number,
  options?: Pick<AudioScrubOptions, 'minIntervalMs'>,
): boolean {
  const minInterval = options?.minIntervalMs ?? DEFAULT_SCRUB_MIN_INTERVAL_MS;
  return nowMs - lastTriggerMs >= minInterval;
}

/**
 * 从静音/独奏状态过滤出可用于搓擦的轨道
 * @param tracks 轨道列表，需包含 id, type, muted, solo
 * @returns 可播放的轨道 id 列表
 */
export function filterScrubTracks<T extends { id: string; type: string; muted?: boolean; solo?: boolean }>(
  tracks: readonly T[],
): string[] {
  const hasSolo = tracks.some((t) => t.solo);
  if (hasSolo) {
    return tracks.filter((t) => t.solo && !t.muted).map((t) => t.id);
  }
  return tracks.filter((t) => t.type === 'audio' && !t.muted).map((t) => t.id);
}

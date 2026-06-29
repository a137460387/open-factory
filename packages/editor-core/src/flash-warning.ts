import { round } from './time';

/** 帧采样数据（luma + 可选RGB） */
export interface FlashFrameSample {
  time: number;
  luma: number; // 0-255
  r?: number;
  g?: number;
  b?: number;
}

/** 闪烁警告区间 */
export interface FlashWarning {
  startTime: number;
  endTime: number;
  flashRate: number;
  severity: 'low' | 'medium' | 'high';
  isRedFlash: boolean;
}

/** 阈值常量 */
export const FLASH_FLIP_RATE_THRESHOLD = 3;
export const FLASH_AMPLITUDE_THRESHOLD = 25.5; // 10% of 255
export const RED_FLASH_R_THRESHOLD = 200;
export const RED_FLASH_RG_DIFF_THRESHOLD = 50;
export const RED_FLASH_RB_DIFF_THRESHOLD = 50;
export const SEVERITY_MEDIUM_RATE = 5;
export const SEVERITY_HIGH_RATE = 7;
export const WINDOW_DURATION = 1.0;
export const MIN_SAMPLES_PER_SECOND = 8;

/** 计算采样率（帧率/3，最低8fps） */
export function calculateSampleRate(frameRate: number): number {
  return Math.max(MIN_SAMPLES_PER_SECOND, Math.floor(frameRate / 3));
}

/**
 * 从RGB计算luma（BT.709近似）
 */
export function calculateLuma(r: number, g: number, b: number): number {
  return round(0.2126 * r + 0.7152 * g + 0.0722 * b, 4);
}

/**
 * 检测单帧是否为大面积纯红色闪烁
 */
export function isRedFlashFrame(r: number, g: number, b: number): boolean {
  return (
    r > RED_FLASH_R_THRESHOLD &&
    (r - g) > RED_FLASH_RG_DIFF_THRESHOLD &&
    (r - b) > RED_FLASH_RB_DIFF_THRESHOLD
  );
}

/**
 * 计算luma翻转点。
 * 返回翻转事件数组：{ time, amplitude, isRedFlash }
 */
export function detectLumaFlips(samples: FlashFrameSample[]): Array<{ time: number; amplitude: number; isRedFlash: boolean }> {
  if (samples.length < 2) return [];

  const flips: Array<{ time: number; amplitude: number; isRedFlash: boolean }> = [];
  let prevDelta = 0;

  for (let i = 1; i < samples.length; i++) {
    const delta = samples[i].luma - samples[i - 1].luma;
    const amplitude = Math.abs(delta);

    if (prevDelta !== 0 && delta !== 0) {
      const directionChanged = (prevDelta > 0 && delta < 0) || (prevDelta < 0 && delta > 0);
      if (directionChanged && amplitude >= FLASH_AMPLITUDE_THRESHOLD) {
        const isRed = samples[i].r !== undefined && samples[i].g !== undefined && samples[i].b !== undefined
          ? isRedFlashFrame(samples[i].r!, samples[i].g!, samples[i].b!)
          : false;
        flips.push({ time: samples[i].time, amplitude, isRedFlash: isRed });
      }
    }

    if (delta !== 0) prevDelta = delta;
  }

  return flips;
}

/**
 * 根据翻转率确定severity
 */
export function classifySeverity(flashRate: number, isRedFlash: boolean): 'low' | 'medium' | 'high' {
  if (isRedFlash) return 'high';
  if (flashRate >= SEVERITY_HIGH_RATE) return 'high';
  if (flashRate >= SEVERITY_MEDIUM_RATE) return 'medium';
  return 'low';
}

/**
 * 生成降低闪烁的FFmpeg filter参数
 */
export function buildFlashReductionFilter(startTime: number, endTime: number): string[] {
  const filters: string[] = [];
  // 使用 tblend=average 进行帧混合来降低闪烁
  filters.push(`tblend=average`);
  // 在闪烁区间内降低对比度
  const s = round(startTime, 3);
  const e = round(endTime, 3);
  filters.push(`eq=contrast=0.8:enable='between(t,${s},${e})'`);
  return filters;
}

/**
 * 合并相邻或重叠的闪烁区间
 */
export function mergeFlashIntervals(intervals: FlashWarning[], mergeGap: number = 0.2): FlashWarning[] {
  if (intervals.length === 0) return [];

  const sorted = [...intervals].sort((a, b) => a.startTime - b.startTime);
  const merged: FlashWarning[] = [structuredClone(sorted[0])];

  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const current = sorted[i];

    if (current.startTime <= last.endTime + mergeGap) {
      last.endTime = Math.max(last.endTime, current.endTime);
      last.flashRate = Math.max(last.flashRate, current.flashRate);
      last.isRedFlash = last.isRedFlash || current.isRedFlash;
      last.severity = classifySeverity(last.flashRate, last.isRedFlash);
    } else {
      merged.push(structuredClone(current));
    }
  }

  return merged;
}

/**
 * 主检测函数：对帧采样数据进行闪烁检测
 */
export function detectFlashWarnings(samples: FlashFrameSample[]): FlashWarning[] {
  if (samples.length < 3) return [];

  const flips = detectLumaFlips(samples);
  if (flips.length === 0) return [];

  // 用1秒滑动窗口统计翻转频率
  const firstTime = samples[0].time;
  const lastTime = samples[samples.length - 1].time;
  const intervals: FlashWarning[] = [];

  // 按0.5秒步长滑动窗口
  const step = 0.5;
  for (let windowStart = firstTime; windowStart <= lastTime - WINDOW_DURATION; windowStart += step) {
    const windowEnd = windowStart + WINDOW_DURATION;

    // 统计窗口内翻转
    const flipsInWindow = flips.filter(
      (f) => f.time >= windowStart && f.time < windowEnd
    );

    const flipRate = flipsInWindow.length / WINDOW_DURATION;

    if (flipRate > FLASH_FLIP_RATE_THRESHOLD) {
      const hasRedFlash = flipsInWindow.some((f) => f.isRedFlash);
      intervals.push({
        startTime: round(windowStart, 3),
        endTime: round(windowEnd, 3),
        flashRate: round(flipRate, 2),
        severity: classifySeverity(flipRate, hasRedFlash),
        isRedFlash: hasRedFlash,
      });
    }
  }

  return mergeFlashIntervals(intervals);
}

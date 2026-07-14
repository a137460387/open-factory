import { round } from './time';

export type MusicStructureType = 'energy_rise' | 'energy_drop' | 'timbre_shift';

export interface MusicStructurePoint {
  time: number;
  type: MusicStructureType;
  confidence: number;
}

/** 阈值常量 */
export const RMS_CHANGE_THRESHOLD = 0.4; // 40%
export const CENTROID_SHIFT_THRESHOLD = 0.3; // 30%
export const MIN_INTERVAL_SECONDS = 8;
export const STRUCTURE_SNAP_TOLERANCE = 0.3; // 秒
export const STRUCTURE_WINDOW_DURATION = 4.0;

/**
 * 计算RMS（均方根能量）
 */
export function calculateRMS(samples: Float32Array | number[]): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i];
  }
  return Math.sqrt(sum / samples.length);
}

/**
 * 计算频谱质心
 * magnitudes: 频率bin的幅值数组
 * sampleRate: 采样率
 */
export function calculateSpectralCentroid(magnitudes: Float32Array | number[], sampleRate: number): number {
  if (magnitudes.length === 0) return 0;
  let weightedSum = 0;
  let totalMag = 0;
  const binWidth = sampleRate / (magnitudes.length * 2);
  for (let i = 0; i < magnitudes.length; i++) {
    const freq = (i + 0.5) * binWidth;
    const mag = Math.abs(magnitudes[i]);
    weightedSum += freq * mag;
    totalMag += mag;
  }
  return totalMag > 0 ? weightedSum / totalMag : 0;
}

/**
 * 计算频谱通量（相邻帧间频谱差异）
 */
export function calculateSpectralFlux(
  prevMagnitudes: Float32Array | number[],
  currMagnitudes: Float32Array | number[],
): number {
  const len = Math.min(prevMagnitudes.length, currMagnitudes.length);
  if (len === 0) return 0;
  let flux = 0;
  for (let i = 0; i < len; i++) {
    const diff = Math.abs(currMagnitudes[i]) - Math.abs(prevMagnitudes[i]);
    flux += diff > 0 ? diff : 0; // 半波整流
  }
  return flux / len;
}

/**
 * 对窗口数据计算RMS变化和质心偏移
 */
export function detectStructureBoundary(
  prevRMS: number,
  currRMS: number,
  prevCentroid: number,
  currCentroid: number,
): { isBoundary: boolean; type: MusicStructureType; confidence: number } {
  const rmsChange = prevRMS > 0 ? Math.abs(currRMS - prevRMS) / prevRMS : currRMS > 0 ? 1 : 0;
  const centroidShift =
    prevCentroid > 0 ? Math.abs(currCentroid - prevCentroid) / prevCentroid : currCentroid > 0 ? 1 : 0;

  // 能量变化检测
  if (rmsChange >= RMS_CHANGE_THRESHOLD) {
    const isRise = currRMS > prevRMS;
    return {
      isBoundary: true,
      type: isRise ? 'energy_rise' : 'energy_drop',
      confidence: Math.min(1, round((rmsChange / RMS_CHANGE_THRESHOLD) * 0.5, 2)),
    };
  }

  // 音色偏移检测
  if (centroidShift >= CENTROID_SHIFT_THRESHOLD) {
    return {
      isBoundary: true,
      type: 'timbre_shift',
      confidence: Math.min(1, round((centroidShift / CENTROID_SHIFT_THRESHOLD) * 0.5, 2)),
    };
  }

  return { isBoundary: false, type: 'timbre_shift', confidence: 0 };
}

/**
 * 过滤候选点，保持最小间隔
 */
export function filterByMinInterval(
  points: MusicStructurePoint[],
  minInterval: number = MIN_INTERVAL_SECONDS,
): MusicStructurePoint[] {
  if (points.length === 0) return [];

  const sorted = [...points].sort((a, b) => a.time - b.time);
  const filtered: MusicStructurePoint[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const last = filtered[filtered.length - 1];
    if (sorted[i].time - last.time >= minInterval) {
      filtered.push(sorted[i]);
    } else if (sorted[i].confidence > last.confidence) {
      // 替换为置信度更高的点
      filtered[filtered.length - 1] = sorted[i];
    }
  }

  return filtered;
}

/**
 * 从时间窗口数据检测音乐结构变化点
 * 输入：每个窗口的 { startTime, rms, centroid }
 */
export function detectMusicStructure(
  windows: Array<{ startTime: number; rms: number; centroid: number }>,
): MusicStructurePoint[] {
  if (windows.length < 2) return [];

  const candidates: MusicStructurePoint[] = [];

  for (let i = 1; i < windows.length; i++) {
    const result = detectStructureBoundary(
      windows[i - 1].rms,
      windows[i].rms,
      windows[i - 1].centroid,
      windows[i].centroid,
    );

    if (result.isBoundary) {
      candidates.push({
        time: round(windows[i].startTime, 3),
        type: result.type,
        confidence: result.confidence,
      });
    }
  }

  return filterByMinInterval(candidates);
}

/**
 * 将clip边界吸附到最近的音乐结构标记
 * 返回吸附后的时间，若超出容差则返回null
 */
export function snapToNearestStructure(
  clipTime: number,
  structurePoints: MusicStructurePoint[],
  tolerance: number = STRUCTURE_SNAP_TOLERANCE,
): { snappedTime: number; point: MusicStructurePoint } | null {
  if (structurePoints.length === 0) return null;

  let bestPoint = structurePoints[0];
  let bestDist = Math.abs(clipTime - bestPoint.time);

  for (let i = 1; i < structurePoints.length; i++) {
    const dist = Math.abs(clipTime - structurePoints[i].time);
    if (dist < bestDist) {
      bestDist = dist;
      bestPoint = structurePoints[i];
    }
  }

  if (bestDist <= tolerance) {
    return { snappedTime: bestPoint.time, point: bestPoint };
  }
  return null;
}

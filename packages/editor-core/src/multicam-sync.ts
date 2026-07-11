import type { MulticamClipAngle, MediaAsset, MediaMetadata } from './model-types';
import { syncMulticamAudio } from './audio/multicam-audio-sync';

/** 多机位同步结果 */
export interface MulticamSyncResult {
  /** 各机位时间偏移量 (angleId -> offset in seconds) */
  offsets: Map<string, number>;
  /** 同步置信度 0-1 */
  confidence: number;
  /** 是否检测到时钟漂移 */
  driftDetected: boolean;
  /** 漂移速率 (秒/小时)，仅在 driftDetected 为 true 时有意义 */
  driftRate?: number;
}

/** 手动同步标记 */
export interface ManualSyncMarker {
  /** 机位 ID */
  angleId: string;
  /** 标记时间点（相对于机位起始的时间，秒） */
  time: number;
}

/**
 * 音频波形同步
 * 复用现有的 multicam-audio-sync.ts，对每个候选机位与参考机位进行音频对齐。
 */
export async function syncMulticamByAudio(
  angles: MulticamClipAngle[],
  mediaAssets: MediaAsset[],
): Promise<MulticamSyncResult> {
  if (angles.length === 0) {
    return { offsets: new Map(), confidence: 0, driftDetected: false };
  }

  const offsets = new Map<string, number>();
  // 第一个机位作为参考，偏移为 0
  const reference = angles[0];
  offsets.set(reference.id, 0);

  if (angles.length === 1) {
    return { offsets, confidence: 1, driftDetected: false };
  }

  // 为每个候选机位调用音频同步算法
  const confidenceValues: number[] = [];
  let anyDriftDetected = false;
  let totalDriftRate = 0;
  let driftCount = 0;

  for (let i = 1; i < angles.length; i++) {
    const candidate = angles[i];
    const refSamples = getAudioSamples(reference, mediaAssets);
    const candidateSamples = getAudioSamples(candidate, mediaAssets);

    const report = syncMulticamAudio(refSamples, candidateSamples, candidate.id);
    offsets.set(candidate.id, report.medianOffsetSeconds);

    // 将 confidence 映射为 0-1
    const confidenceScore = report.confidence === 'high' ? 0.9 : report.confidence === 'medium' ? 0.6 : 0.3;
    confidenceValues.push(confidenceScore);

    if (report.drift.hasDrift) {
      anyDriftDetected = true;
      totalDriftRate += report.drift.driftRateMsPerMin / 1000 * 60; // ms/min -> s/hr
      driftCount++;
    }
  }

  const avgConfidence = confidenceValues.length > 0
    ? confidenceValues.reduce((s, v) => s + v, 0) / confidenceValues.length
    : 1;

  return {
    offsets,
    confidence: avgConfidence,
    driftDetected: anyDriftDetected,
    driftRate: driftCount > 0 ? totalDriftRate / driftCount : 0,
  };
}

/**
 * 时间码同步
 * 根据媒体元数据中的时间戳计算各机位的偏移量，最早的时间作为参考点。
 */
export function syncMulticamByTimecode(
  angles: MulticamClipAngle[],
  metadata: Record<string, MediaMetadata>,
): MulticamSyncResult {
  if (angles.length === 0) {
    return { offsets: new Map(), confidence: 1, driftDetected: false };
  }

  const offsets = new Map<string, number>();

  // 找到最早的时间戳作为参考
  let earliestTime = Infinity;
  const timestamps = new Map<string, number>();

  for (const angle of angles) {
    const mediaMetadata = metadata[angle.mediaId];
    if (mediaMetadata?.date) {
      const time = new Date(mediaMetadata.date).getTime();
      timestamps.set(angle.id, time);
      if (time < earliestTime) {
        earliestTime = time;
      }
    }
  }

  // 如果没有找到任何时间戳，所有偏移为 0
  if (earliestTime === Infinity) {
    for (const angle of angles) {
      offsets.set(angle.id, 0);
    }
    return { offsets, confidence: 1, driftDetected: false };
  }

  // 计算各机位相对于最早时间的偏移
  for (const angle of angles) {
    const time = timestamps.get(angle.id);
    if (time !== undefined) {
      // 偏移 = 最早时间 - 当前时间（负值表示该机位较晚开始）
      offsets.set(angle.id, (earliestTime - time) / 1000);
    } else {
      offsets.set(angle.id, 0);
    }
  }

  return {
    offsets,
    confidence: 1,
    driftDetected: false,
  };
}

/**
 * 手动标记同步
 * 根据用户提供的同步标记计算各机位的偏移量，第一个标记作为参考点。
 */
export function syncMulticamByManual(
  angles: MulticamClipAngle[],
  markers: ManualSyncMarker[],
): MulticamSyncResult {
  const offsets = new Map<string, number>();

  // 无标记时所有偏移为 0
  const referenceMarker = markers[0];
  if (!referenceMarker) {
    for (const angle of angles) {
      offsets.set(angle.id, 0);
    }
    return { offsets, confidence: 1, driftDetected: false };
  }

  // 计算各机位相对于参考标记的偏移
  for (const angle of angles) {
    const marker = markers.find((m) => m.angleId === angle.id);
    if (marker) {
      // 偏移 = 参考标记时间 - 当前标记时间
      offsets.set(angle.id, referenceMarker.time - marker.time);
    } else {
      offsets.set(angle.id, 0);
    }
  }

  return {
    offsets,
    confidence: 1,
    driftDetected: false,
  };
}

/**
 * 检测时钟漂移
 * 对前两个机位进行音频同步分析，检测是否存在时钟漂移。
 */
export async function detectDrift(
  angles: MulticamClipAngle[],
): Promise<{ driftDetected: boolean; driftRate: number }> {
  if (angles.length < 2) {
    return { driftDetected: false, driftRate: 0 };
  }

  const reference = angles[0];
  const candidate = angles[1];

  const refSamples = getAudioSamples(reference, []);
  const candidateSamples = getAudioSamples(candidate, []);

  const report = syncMulticamAudio(refSamples, candidateSamples, candidate.id);

  return {
    driftDetected: report.drift.hasDrift,
    driftRate: report.drift.hasDrift ? report.drift.driftRateMsPerMin / 1000 * 60 : 0,
  };
}

/**
 * 获取机位对应的音频采样数据（内部辅助函数）
 * 在实际使用中，需要从媒体资源中提取音频数据。
 * 当前实现返回空数组，实际音频提取由上层负责。
 */
function getAudioSamples(_angle: MulticamClipAngle, _mediaAssets: MediaAsset[]): ArrayLike<number> {
  // TODO: 从 MediaAsset 中提取音频采样数据
  // 需要依赖音频解码器（Web Audio API 或 native module）
  return new Float32Array(0);
}

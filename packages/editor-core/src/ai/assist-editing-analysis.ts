/**
 * AI 辅助剪辑 - 内容分析模块
 *
 * 从 assist-editing.ts 拆分出的纯分析函数。
 * 包含场景检测、音频分析、情绪/节奏/说话人/关键帧检测等。
 *
 * 所有函数均为纯计算，无副作用。
 */

import type {SceneType, SceneInfo, RhythmProfile, SpeakerSegment} from './assist-editing-types';
import {clamp} from '../utils/math';

// ==================== 辅助工具函数 ====================

/**
 * 生成唯一 ID（基于时间戳和随机数）
 *
 * @returns 唯一 ID 字符串
 */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

/**
 * 计算数组的均值
 *
 * @param arr - 数值数组
 * @returns 均值，空数组返回 0
 */
export function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    sum += arr[i];
  }
  return sum / arr.length;
}

/**
 * 计算数组的标准差
 *
 * @param arr - 数值数组
 * @returns 标准差，空数组返回 0
 */
export function stddev(arr: number[]): number {
  if (arr.length === 0) return 0;
  const m = mean(arr);
  let sumSq = 0;
  for (let i = 0; i < arr.length; i++) {
    const d = arr[i] - m;
    sumSq += d * d;
  }
  return Math.sqrt(sumSq / arr.length);
}

/**
 * 对数组进行移动平均平滑
 *
 * @param arr - 输入数组
 * @param windowSize - 窗口大小（奇数），默认 5
 * @returns 平滑后的数组
 */
export function smooth(arr: number[], windowSize: number = 5): number[] {
  const half = Math.floor(windowSize / 2);
  const result: number[] = new Array(arr.length);
  for (let i = 0; i < arr.length; i++) {
    let sum = 0;
    let count = 0;
    for (let j = i - half; j <= i + half; j++) {
      if (j >= 0 && j < arr.length) {
        sum += arr[j];
        count++;
      }
    }
    result[i] = sum / count;
  }
  return result;
}

/**
 * 检测数组中的局部峰值索引
 *
 * @param arr - 输入数组
 * @param threshold - 峰值最小阈值，默认 0
 * @returns 峰值索引数组
 */
export function findPeaks(arr: number[], threshold: number = 0): number[] {
  const peaks: number[] = [];
  for (let i = 1; i < arr.length - 1; i++) {
    if (arr[i] > arr[i - 1] && arr[i] > arr[i + 1] && arr[i] >= threshold) {
      peaks.push(i);
    }
  }
  return peaks;
}

// ==================== 场景类型推断辅助 ====================

/**
 * 根据时间位置和相邻场景推断场景类型
 *
 * @param startTime - 场景开始时间
 * @param endTime - 场景结束时间
 * @param totalDuration - 总时长
 * @param prevType - 前一个场景类型
 * @param motionLevel - 运动水平 (0-1)
 * @returns 推断的场景类型
 */
export function inferSceneType(
  startTime: number,
  endTime: number,
  totalDuration: number,
  prevType: SceneType | null,
  motionLevel: number,
): SceneType {
  const relativeStart = totalDuration > 0 ? startTime / totalDuration : 0;
  const relativeEnd = totalDuration > 0 ? endTime / totalDuration : 0;
  const duration = endTime - startTime;

  // 根据相对位置推断
  if (relativeStart < 0.05) return 'intro';
  if (relativeEnd > 0.95) return 'outro';

  // 根据运动水平推断
  if (motionLevel > 0.7) return 'action';
  if (motionLevel > 0.4 && duration < 3) return 'montage';

  // 根据前后关系推断
  if (prevType === 'action' && motionLevel < 0.3) return 'transition';
  if (prevType === 'dialogue' && motionLevel > 0.5) return 'b-roll';

  return 'dialogue';
}

// ==================== 辅助函数 ====================

/**
 * 检测场景转换点
 *
 * 通过计算相邻帧之间的像素差异来检测场景切换。
 * 使用 RGB 三通道的平均绝对差作为帧间距离度量。
 *
 * @param frames - 视频帧数据数组（Uint8Array，假设 RGBA 格式）
 * @param threshold - 转换阈值 (0-1)，默认 0.35
 * @returns 场景转换点对应的帧索引数组
 */
export function detectSceneTransitions(frames: Uint8Array[], threshold: number = 0.35): number[] {
  if (frames.length < 2) return [];

  const clampedThreshold = clamp(threshold, 0, 1);
  const transitions: number[] = [];
  const diffs: number[] = [];

  // 计算相邻帧的差异
  for (let i = 1; i < frames.length; i++) {
    const prev = frames[i - 1];
    const curr = frames[i];
    const pixelCount = Math.min(prev.length, curr.length) / 4; // RGBA
    if (pixelCount === 0) {
      diffs.push(0);
      continue;
    }

    let totalDiff = 0;
    // 采样计算：每 4 个像素采样一次以提高性能
    const sampleStep = Math.max(1, Math.floor(pixelCount / 1000));
    let sampleCount = 0;

    for (let p = 0; p < pixelCount; p += sampleStep) {
      const offset = p * 4;
      // 只比较 RGB 通道，忽略 Alpha
      totalDiff +=
        Math.abs(prev[offset] - curr[offset]) +
        Math.abs(prev[offset + 1] - curr[offset + 1]) +
        Math.abs(prev[offset + 2] - curr[offset + 2]);
      sampleCount++;
    }

    // 归一化到 0-1（每个通道最大差值 255，3 个通道）
    const normalizedDiff = sampleCount > 0 ? totalDiff / (sampleCount * 255 * 3) : 0;
    diffs.push(normalizedDiff);
  }

  // 使用自适应阈值检测转换点
  const smoothedDiffs = smooth(diffs, 3);
  const meanDiff = mean(smoothedDiffs);
  const stdDiff = stddev(smoothedDiffs);
  const adaptiveThreshold = Math.max(clampedThreshold, meanDiff + stdDiff * 1.5);

  for (let i = 0; i < smoothedDiffs.length; i++) {
    if (smoothedDiffs[i] > adaptiveThreshold) {
      // 避免连续帧重复检测
      if (transitions.length === 0 || i - transitions[transitions.length - 1] > 2) {
        transitions.push(i + 1); // 转换发生在第 i+1 帧
      }
    }
  }

  return transitions;
}

/**
 * 检测音频起音点（onset detection）
 *
 * 基于短时能量变化率检测音频中的起音点。
 * 起音点通常对应声音的开始（如打击乐、语音起始等）。
 *
 * @param audioData - 音频采样数据（单声道浮点）
 * @param sampleRate - 音频采样率（Hz）
 * @returns 起音点时间数组（秒）
 */
export function computeAudioOnsets(audioData: Float32Array, sampleRate: number): number[] {
  if (audioData.length === 0 || sampleRate <= 0) return [];

  const frameSize = Math.floor(sampleRate * 0.02); // 20ms 帧
  const hopSize = Math.floor(frameSize / 2); // 10ms 跳跃
  const energyEnvelope: number[] = [];

  // 计算短时能量包络
  for (let i = 0; i <= audioData.length - frameSize; i += hopSize) {
    let energy = 0;
    for (let j = 0; j < frameSize; j++) {
      const sample = audioData[i + j];
      energy += sample * sample;
    }
    energyEnvelope.push(energy / frameSize);
  }

  // 计算能量变化率（一阶差分）
  const diff: number[] = [];
  for (let i = 1; i < energyEnvelope.length; i++) {
    diff.push(Math.max(0, energyEnvelope[i] - energyEnvelope[i - 1]));
  }

  if (diff.length === 0) return [];

  // 平滑
  const smoothed = smooth(diff, 3);

  // 检测峰值
  const meanVal = mean(smoothed);
  const stdVal = stddev(smoothed);
  const onsetThreshold = meanVal + stdVal * 2;

  const peakIndices = findPeaks(smoothed, onsetThreshold);

  // 转换为时间
  return peakIndices.map((idx) => ((idx + 1) * hopSize) / sampleRate);
}

// ==================== 内部辅助函数 ====================

/**
 * 根据场景转换时间点构建场景列表
 */
export function buildScenesFromTransitions(
  transitionTimes: number[],
  totalDuration: number,
  frames: Uint8Array[],
  fps: number,
): SceneInfo[] {
  const scenes: SceneInfo[] = [];
  const boundaries = [0, ...transitionTimes, totalDuration];

  for (let i = 0; i < boundaries.length - 1; i++) {
    const startTime = boundaries[i];
    const endTime = boundaries[i + 1];
    if (endTime <= startTime) continue;

    // 计算该场景内的运动水平
    const startFrame = Math.floor(startTime * fps);
    const endFrame = Math.min(Math.floor(endTime * fps), frames.length - 1);
    const motionLevel = computeMotionLevel(frames, startFrame, endFrame);

    const prevType = scenes.length > 0 ? scenes[scenes.length - 1].sceneType : null;
    const sceneType = inferSceneType(startTime, endTime, totalDuration, prevType, motionLevel);

    scenes.push({
      startTime,
      endTime,
      sceneType,
      description: generateSceneDescription(sceneType, motionLevel, endTime - startTime),
      confidence: clamp(0.6 + motionLevel * 0.3, 0.5, 0.95),
    });
  }

  return scenes;
}

/**
 * 计算帧范围内的运动水平
 */
export function computeMotionLevel(frames: Uint8Array[], startIdx: number, endIdx: number): number {
  if (endIdx <= startIdx || endIdx >= frames.length) return 0.5;

  let totalDiff = 0;
  let count = 0;

  for (let i = startIdx + 1; i <= endIdx; i++) {
    const prev = frames[i - 1];
    const curr = frames[i];
    const pixelCount = Math.min(prev.length, curr.length) / 4;
    const sampleStep = Math.max(1, Math.floor(pixelCount / 500));
    let frameDiff = 0;
    let samples = 0;

    for (let p = 0; p < pixelCount; p += sampleStep) {
      const offset = p * 4;
      frameDiff +=
        Math.abs(prev[offset] - curr[offset]) +
        Math.abs(prev[offset + 1] - curr[offset + 1]) +
        Math.abs(prev[offset + 2] - curr[offset + 2]);
      samples++;
    }

    if (samples > 0) {
      totalDiff += frameDiff / (samples * 255 * 3);
      count++;
    }
  }

  return count > 0 ? clamp((totalDiff / count) * 10, 0, 1) : 0.5;
}

/**
 * 生成场景描述文本
 */
export function generateSceneDescription(sceneType: SceneType, motionLevel: number, duration: number): string {
  const motionDesc = motionLevel > 0.7 ? '高动态' : motionLevel > 0.4 ? '中等动态' : '低动态';
  const durationDesc = duration < 2 ? '短' : duration < 10 ? '中' : '长';

  const typeNames: Record<SceneType, string> = {
    intro: '开场',
    action: '动作',
    dialogue: '对话',
    transition: '过渡',
    climax: '高潮',
    outro: '结尾',
    montage: '蒙太奇',
    'b-roll': 'B-Roll',
  };

  return `${typeNames[sceneType]}场景，${motionDesc}，${durationDesc}片段`;
}

/**
 * 计算情绪曲线（基于音频能量和过零率）
 */
export function computeEmotionCurve(audioData: Float32Array, sampleRate: number, duration: number): number[] {
  const samplesPerSecond = 1; // 每秒一个采样点
  const totalSamples = Math.max(1, Math.ceil(duration * samplesPerSecond));
  const curve: number[] = new Array(totalSamples);
  const frameSize = Math.floor(sampleRate / samplesPerSecond);

  for (let i = 0; i < totalSamples; i++) {
    const start = i * frameSize;
    const end = Math.min(start + frameSize, audioData.length);

    if (start >= audioData.length) {
      curve[i] = 0.5;
      continue;
    }

    // 计算短时能量
    let energy = 0;
    let crossings = 0;
    const len = end - start;

    for (let j = start; j < end; j++) {
      energy += audioData[j] * audioData[j];
      if (j > start) {
        if ((audioData[j] >= 0 && audioData[j - 1] < 0) || (audioData[j] < 0 && audioData[j - 1] >= 0)) {
          crossings++;
        }
      }
    }

    const normalizedEnergy = len > 0 ? Math.sqrt(energy / len) : 0;
    const zcr = len > 1 ? crossings / (len - 1) : 0;

    // 组合能量和过零率作为情绪指标
    // 高能量 + 低过零率 = 激昂（值高）
    // 低能量 + 高过零率 = 平静/悲伤（值低）
    const emotion = clamp(normalizedEnergy * 3 - zcr * 0.5 + 0.3, 0, 1);
    curve[i] = emotion;
  }

  return smooth(curve, 3);
}

/**
 * 计算节奏配置
 */
export function computeRhythmProfile(audioData: Float32Array, sampleRate: number): RhythmProfile {
  const frameSize = Math.floor(sampleRate * 0.025); // 25ms
  const hopSize = Math.floor(frameSize / 2);
  const energyEnvelope: number[] = [];

  // 计算能量包络
  for (let i = 0; i <= audioData.length - frameSize; i += hopSize) {
    let energy = 0;
    for (let j = 0; j < frameSize; j++) {
      const s = audioData[i + j];
      energy += s * s;
    }
    energyEnvelope.push(energy / frameSize);
  }

  // 平滑能量包络
  const smoothed = smooth(energyEnvelope, 5);

  // 检测峰值作为节拍候选
  const meanEnergy = mean(smoothed);
  const peakIndices = findPeaks(smoothed, meanEnergy * 1.2);

  // 计算 BPM
  const beatTimes: number[] = [];
  const intervals: number[] = [];

  for (let i = 0; i < peakIndices.length; i++) {
    const time = (peakIndices[i] * hopSize) / sampleRate;
    beatTimes.push(time);
    if (i > 0) {
      intervals.push(time - beatTimes[beatTimes.length - 2]);
    }
  }

  const avgInterval = intervals.length > 0 ? mean(intervals) : 0.5;
  const bpm = avgInterval > 0 ? Math.round(clamp(60 / avgInterval, 40, 240)) : 120;

  // 生成能量曲线（每秒一个采样点）
  const duration = audioData.length / sampleRate;
  const curveLen = Math.max(1, Math.ceil(duration));
  const energyCurve: number[] = new Array(curveLen);
  for (let i = 0; i < curveLen; i++) {
    const envelopeIdx = Math.floor((i / duration) * smoothed.length);
    energyCurve[i] = clamp(smoothed[Math.min(envelopeIdx, smoothed.length - 1)] / (meanEnergy * 3 + 0.001), 0, 1);
  }

  // 检测速度变化点
  const tempoChanges = detectTempoChanges(beatTimes, hopSize, sampleRate);

  return {
    bpm,
    beatTimes,
    energyCurve,
    tempoChanges,
  };
}

/**
 * 检测速度变化点
 */
export function detectTempoChanges(
  beatTimes: number[],
  hopSize: number,
  sampleRate: number,
): Array<{ time: number; bpm: number }> {
  if (beatTimes.length < 8) return [];

  const changes: Array<{ time: number; bpm: number }> = [];
  const windowSize = 4;

  for (let i = windowSize; i < beatTimes.length - windowSize; i++) {
    // 计算前半窗口的平均间隔
    const prevIntervals: number[] = [];
    for (let j = i - windowSize; j < i; j++) {
      prevIntervals.push(beatTimes[j + 1] - beatTimes[j]);
    }
    const prevAvg = mean(prevIntervals);

    // 计算后半窗口的平均间隔
    const nextIntervals: number[] = [];
    for (let j = i; j < i + windowSize; j++) {
      nextIntervals.push(beatTimes[j + 1] - beatTimes[j]);
    }
    const nextAvg = mean(nextIntervals);

    // 如果间隔变化超过 20%，认为有速度变化
    if (prevAvg > 0 && Math.abs(nextAvg - prevAvg) / prevAvg > 0.2) {
      const newBpm = nextAvg > 0 ? Math.round(clamp(60 / nextAvg, 40, 240)) : 120;
      changes.push({ time: beatTimes[i], bpm: newBpm });
    }
  }

  return changes;
}

/**
 * 检测说话人片段（基于静音段分割）
 */
export function detectSpeakerSegments(audioData: Float32Array, sampleRate: number): SpeakerSegment[] {
  const frameSize = Math.floor(sampleRate * 0.025); // 25ms
  const hopSize = Math.floor(frameSize / 2);
  const silenceThreshold = 0.005;
  const minSpeechDuration = 0.3; // 最小语音段 300ms
  const minSilenceDuration = 0.2; // 最小静音段 200ms

  // 计算每帧能量
  const frameEnergies: number[] = [];
  for (let i = 0; i <= audioData.length - frameSize; i += hopSize) {
    let energy = 0;
    for (let j = 0; j < frameSize; j++) {
      const s = audioData[i + j];
      energy += s * s;
    }
    frameEnergies.push(energy / frameSize);
  }

  // 检测语音段和静音段
  const segments: SpeakerSegment[] = [];
  let inSpeech = false;
  let speechStart = 0;
  let silenceCount = 0;
  const silenceFramesNeeded = Math.ceil((minSilenceDuration * sampleRate) / hopSize);

  for (let i = 0; i < frameEnergies.length; i++) {
    const time = (i * hopSize) / sampleRate;

    if (frameEnergies[i] > silenceThreshold) {
      if (!inSpeech) {
        inSpeech = true;
        speechStart = time;
        silenceCount = 0;
      } else {
        silenceCount = 0;
      }
    } else {
      if (inSpeech) {
        silenceCount++;
        if (silenceCount >= silenceFramesNeeded) {
          const speechEnd = time - (silenceCount * hopSize) / sampleRate;
          const duration = speechEnd - speechStart;

          if (duration >= minSpeechDuration) {
            // 使用能量特征简单区分不同说话人
            const speakerId = estimateSpeakerId(audioData, sampleRate, speechStart, speechEnd);

            segments.push({
              startTime: speechStart,
              endTime: speechEnd,
              speakerId,
              text: '',
              emotion: estimateSpeechEmotion(frameEnergies, i - silenceCount, i),
            });
          }

          inSpeech = false;
          silenceCount = 0;
        }
      }
    }
  }

  // 处理最后一个语音段
  if (inSpeech) {
    const speechEnd = audioData.length / sampleRate;
    const duration = speechEnd - speechStart;

    if (duration >= minSpeechDuration) {
      segments.push({
        startTime: speechStart,
        endTime: speechEnd,
        speakerId: 'speaker_0',
        text: '',
        emotion: 'neutral',
      });
    }
  }

  return segments;
}

/**
 * 简单估算说话人 ID（基于音高特征区分）
 */
export function estimateSpeakerId(audioData: Float32Array, sampleRate: number, startTime: number, _endTime: number): string {
  const startSample = Math.floor(startTime * sampleRate);
  const analysisLength = Math.min(Math.floor(sampleRate * 0.5), audioData.length - startSample);

  if (analysisLength <= 0) return 'speaker_0';

  // 计算平均能量作为简单的说话人区分特征
  let energy = 0;
  for (let i = 0; i < analysisLength; i++) {
    const s = audioData[startSample + i];
    energy += s * s;
  }
  const avgEnergy = energy / analysisLength;

  // 基于能量水平粗略分类（高能量 -> speaker_0，低能量 -> speaker_1）
  return avgEnergy > 0.01 ? 'speaker_0' : 'speaker_1';
}

/**
 * 估算语音段情绪
 */
export function estimateSpeechEmotion(frameEnergies: number[], startIdx: number, endIdx: number): string {
  const segmentEnergies = frameEnergies.slice(Math.max(0, startIdx), Math.min(frameEnergies.length, endIdx));

  if (segmentEnergies.length === 0) return 'neutral';

  const avgEnergy = mean(segmentEnergies);
  const energyStd = stddev(segmentEnergies);

  if (avgEnergy > 0.05 && energyStd > 0.02) return 'excited';
  if (avgEnergy > 0.03) return 'happy';
  if (avgEnergy < 0.005) return 'sad';
  return 'neutral';
}

/**
 * 检测关键帧时间点
 */
export function detectKeyFrameTimes(frames: Uint8Array[], fps: number): number[] {
  if (frames.length < 2) return [];

  const diffs: number[] = [];

  for (let i = 1; i < frames.length; i++) {
    const prev = frames[i - 1];
    const curr = frames[i];
    const pixelCount = Math.min(prev.length, curr.length) / 4;
    const sampleStep = Math.max(1, Math.floor(pixelCount / 500));
    let totalDiff = 0;
    let samples = 0;

    for (let p = 0; p < pixelCount; p += sampleStep) {
      const offset = p * 4;
      totalDiff +=
        Math.abs(prev[offset] - curr[offset]) +
        Math.abs(prev[offset + 1] - curr[offset + 1]) +
        Math.abs(prev[offset + 2] - curr[offset + 2]);
      samples++;
    }

    diffs.push(samples > 0 ? totalDiff / (samples * 255 * 3) : 0);
  }

  // 检测差异峰值作为关键帧
  const smoothed = smooth(diffs, 3);
  const meanDiff = mean(smoothed);
  const stdDiff = stddev(smoothed);
  const threshold = meanDiff + stdDiff * 1.5;

  const peakIndices = findPeaks(smoothed, threshold);

  // 转换为时间
  return peakIndices.map((idx) => (idx + 1) / fps);
}

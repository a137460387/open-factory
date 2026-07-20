/**
 * AI 说话人分离 Worker
 *
 * 在独立线程中执行 Pyannote 说话人分离推理，避免阻塞主线程。
 * 支持两种模式：
 * 1. Tauri 原生 Pyannote（通过桥接调用）
 * 2. WebAssembly 推理（前端推理，预留）
 */

import type {
  SpeakerDiarizationConfig,
  SpeakerDiarizationResult,
  SpeakerDiarizationSegment,
  VoiceprintEmbedding,
} from '@open-factory/editor-core/ai/speaker-diarization';

// -- Worker 消息类型 --

export interface AISpeakerDiarizationWorkerInput {
  type: 'diarize' | 'cancel';
  /** 音频文件路径 */
  audioPath?: string;
  /** 音频数据（PCM Float32Array） */
  audioData?: Float32Array;
  /** 采样率 */
  sampleRate?: number;
  /** 已有的转录片段（用于集成） */
  transcriptionSegments?: Array<{
    startMs: number;
    endMs: number;
    text: string;
  }>;
  /** 分离配置 */
  config?: SpeakerDiarizationConfig;
  /** Tauri 请求参数 */
  tauriRequest?: {
    modelPath: string;
    audioPath: string;
  };
}

export interface AISpeakerDiarizationWorkerOutput {
  type: 'progress' | 'result' | 'error' | 'cancelled';
  /** 进度阶段 */
  phase?: 'loading-model' | 'extracting-features' | 'clustering' | 'post-processing';
  /** 进度（0-1） */
  progress?: number;
  /** 分离结果 */
  result?: SpeakerDiarizationResult;
  /** 带说话人标签的转录片段 */
  labeledSegments?: Array<{
    startMs: number;
    endMs: number;
    text: string;
    speaker?: string;
    speakerId?: number;
  }>;
  /** 处理耗时（毫秒） */
  durationMs?: number;
  /** 错误信息 */
  error?: string;
}

// -- Worker 主逻辑 --

let cancelled = false;

self.onmessage = async (event: MessageEvent<AISpeakerDiarizationWorkerInput>) => {
  const input = event.data;

  if (input.type === 'cancel') {
    cancelled = true;
    postMessage({ type: 'cancelled' } satisfies AISpeakerDiarizationWorkerOutput);
    return;
  }

  if (input.type !== 'diarize') {
    postMessage({
      type: 'error',
      error: `未知消息类型: ${input.type}`,
    } satisfies AISpeakerDiarizationWorkerOutput);
    return;
  }

  cancelled = false;
  const startTime = performance.now();

  try {
    // 阶段 1：模型加载
    postMessage({
      type: 'progress',
      phase: 'loading-model',
      progress: 0,
    } satisfies AISpeakerDiarizationWorkerOutput);

    if (cancelled) {
      postMessage({ type: 'cancelled' } satisfies AISpeakerDiarizationWorkerOutput);
      return;
    }

    // 阶段 2：特征提取
    postMessage({
      type: 'progress',
      phase: 'extracting-features',
      progress: 0.1,
    } satisfies AISpeakerDiarizationWorkerOutput);

    let diarizationResult: SpeakerDiarizationResult;

    if (input.tauriRequest) {
      // 通过 Tauri 桥接调用 Pyannote
      diarizationResult = await callPyannoteViaBridge(input.tauriRequest);
    } else if (input.audioData && input.sampleRate) {
      // 使用前端特征提取（简化版本）
      diarizationResult = await performFrontendDiarization(input.audioData, input.sampleRate, input.config);
    } else if (input.audioPath) {
      // 需要通过桥接加载音频
      diarizationResult = await callPyannoteViaBridge({
        modelPath: '', // 使用默认模型
        audioPath: input.audioPath,
      });
    } else {
      throw new Error('缺少音频数据或路径');
    }

    if (cancelled) {
      postMessage({ type: 'cancelled' } satisfies AISpeakerDiarizationWorkerOutput);
      return;
    }

    // 阶段 3：聚类
    postMessage({
      type: 'progress',
      phase: 'clustering',
      progress: 0.7,
    } satisfies AISpeakerDiarizationWorkerOutput);

    // 阶段 4：后处理
    postMessage({
      type: 'progress',
      phase: 'post-processing',
      progress: 0.9,
    } satisfies AISpeakerDiarizationWorkerOutput);

    // 如果有转录片段，应用说话人标签
    let labeledSegments: AISpeakerDiarizationWorkerOutput['labeledSegments'];
    if (input.transcriptionSegments && input.transcriptionSegments.length > 0) {
      labeledSegments = applySpeakerLabelsToSegments(input.transcriptionSegments, diarizationResult);
    }

    const durationMs = performance.now() - startTime;

    // 返回结果
    postMessage({
      type: 'result',
      result: diarizationResult,
      labeledSegments,
      durationMs,
    } satisfies AISpeakerDiarizationWorkerOutput);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    postMessage({
      type: 'error',
      error: errorMessage,
    } satisfies AISpeakerDiarizationWorkerOutput);
  }
};

/**
 * 通过 Tauri 桥接调用 Pyannote
 */
async function callPyannoteViaBridge(request: {
  modelPath: string;
  audioPath: string;
}): Promise<SpeakerDiarizationResult> {
  return new Promise((resolve, reject) => {
    const requestId = `pyannote-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const handler = (event: MessageEvent) => {
      if (event.data?.requestId === requestId) {
        self.removeEventListener('message', handler);
        if (event.data.error) {
          reject(new Error(event.data.error));
        } else {
          resolve(event.data.result);
        }
      }
    };

    self.addEventListener('message', handler);

    // 请求主线程执行 Tauri 调用
    self.postMessage({
      type: 'tauri-request',
      requestId,
      command: 'runSpeakerDiarization',
      args: request,
    });

    // 超时保护（10 分钟）
    setTimeout(
      () => {
        self.removeEventListener('message', handler);
        reject(new Error('Pyannote 调用超时（10分钟）'));
      },
      10 * 60 * 1000,
    );
  });
}

/**
 * 前端说话人分离（简化版本）
 * 使用音频特征的统计方法进行初步分离
 */
async function performFrontendDiarization(
  audioData: Float32Array,
  sampleRate: number,
  config?: SpeakerDiarizationConfig,
): Promise<SpeakerDiarizationResult> {
  // 简化实现：基于音频能量和过零率的初步分离
  // 实际应用中应该使用 Pyannote 等专业模型

  const windowSize = Math.round(sampleRate * 0.025); // 25ms窗口
  const hopSize = Math.round(sampleRate * 0.01); // 10ms帧移
  const minSpeakers = config?.minSpeakers ?? 1;
  const maxSpeakers = config?.maxSpeakers ?? 10;

  // 提取特征
  const features: number[][] = [];
  for (let i = 0; i < audioData.length - windowSize; i += hopSize) {
    const window = audioData.slice(i, i + windowSize);

    // 计算能量
    const energy = window.reduce((sum, val) => sum + val * val, 0) / windowSize;

    // 计算过零率
    let zeroCrossings = 0;
    for (let j = 1; j < window.length; j++) {
      if ((window[j] >= 0 && window[j - 1] < 0) || (window[j] < 0 && window[j - 1] >= 0)) {
        zeroCrossings++;
      }
    }
    const zcr = zeroCrossings / windowSize;

    features.push([energy, zcr]);
  }

  // 归一化特征
  const normalizedFeatures = normalizeFeatures(features);

  // 简单聚类（基于特征差异）
  const segments = clusterByFeatures(normalizedFeatures, sampleRate, hopSize, minSpeakers, maxSpeakers);

  // 计算统计信息
  const speakerIds = new Set(segments.map((s) => s.speakerId));
  const avgConfidence = segments.length > 0 ? segments.reduce((sum, s) => sum + s.confidence, 0) / segments.length : 0;

  let maxMonologueMs = 0;
  let speakerSwitches = 0;
  let currentSpeaker = segments.length > 0 ? segments[0].speakerId : -1;
  let currentStart = segments.length > 0 ? segments[0].startMs : 0;

  for (let i = 1; i < segments.length; i++) {
    if (segments[i].speakerId !== currentSpeaker) {
      const duration = segments[i - 1].endMs - currentStart;
      maxMonologueMs = Math.max(maxMonologueMs, duration);
      currentSpeaker = segments[i].speakerId;
      currentStart = segments[i].startMs;
      speakerSwitches++;
    }
  }

  if (segments.length > 0) {
    const lastDuration = segments[segments.length - 1].endMs - currentStart;
    maxMonologueMs = Math.max(maxMonologueMs, lastDuration);
  }

  // 构建说话人声纹
  const speakers: VoiceprintEmbedding[] = [];
  for (const id of speakerIds) {
    speakers.push({
      speakerId: id,
      speakerLabel: getSpeakerLabel(id),
      embedding: [], // 简化版本不提供实际嵌入
      confidence: 0.7,
      sampleCount: segments.filter((s) => s.speakerId === id).length,
    });
  }

  const durationMs = segments.length > 0 ? Math.max(...segments.map((s) => s.endMs)) : 0;

  return {
    segments,
    speakers,
    durationMs,
    stats: {
      speakerCount: speakerIds.size,
      avgConfidence: Math.round(avgConfidence * 1000) / 1000,
      maxMonologueMs,
      speakerSwitches,
    },
  };
}

/**
 * 归一化特征
 */
function normalizeFeatures(features: number[][]): number[][] {
  if (features.length === 0) return [];

  const dim = features[0].length;
  const mins = new Array(dim).fill(Infinity);
  const maxs = new Array(dim).fill(-Infinity);

  for (const feat of features) {
    for (let d = 0; d < dim; d++) {
      mins[d] = Math.min(mins[d], feat[d]);
      maxs[d] = Math.max(maxs[d], feat[d]);
    }
  }

  return features.map((feat) =>
    feat.map((val, d) => {
      const range = maxs[d] - mins[d];
      return range > 0 ? (val - mins[d]) / range : 0.5;
    }),
  );
}

/**
 * 基于特征聚类
 */
function clusterByFeatures(
  features: number[][],
  sampleRate: number,
  hopSize: number,
  minSpeakers: number,
  maxSpeakers: number,
): SpeakerDiarizationSegment[] {
  if (features.length === 0) return [];

  // 简单策略：基于能量变化检测说话人切换
  const segments: SpeakerDiarizationSegment[] = [];
  let currentSpeaker = 0;
  let segmentStart = 0;
  const energyThreshold = 0.3; // 能量变化阈值

  for (let i = 1; i < features.length; i++) {
    const energyDiff = Math.abs(features[i][0] - features[i - 1][0]);

    // 能量突变且持续一段时间，认为是说话人切换
    if (energyDiff > energyThreshold && i - segmentStart > 50) {
      const startMs = Math.round(((segmentStart * hopSize) / sampleRate) * 1000);
      const endMs = Math.round(((i * hopSize) / sampleRate) * 1000);

      segments.push({
        startMs,
        endMs,
        speakerId: currentSpeaker,
        speakerLabel: getSpeakerLabel(currentSpeaker),
        confidence: 0.7,
      });

      currentSpeaker = (currentSpeaker + 1) % maxSpeakers;
      segmentStart = i;
    }
  }

  // 添加最后一段
  if (segmentStart < features.length) {
    const startMs = Math.round(((segmentStart * hopSize) / sampleRate) * 1000);
    const endMs = Math.round(((features.length * hopSize) / sampleRate) * 1000);

    segments.push({
      startMs,
      endMs,
      speakerId: currentSpeaker,
      speakerLabel: getSpeakerLabel(currentSpeaker),
      confidence: 0.7,
    });
  }

  // 如果检测到的说话人数量不足，合并一些片段
  const uniqueSpeakers = new Set(segments.map((s) => s.speakerId));
  if (uniqueSpeakers.size < minSpeakers && segments.length > 1) {
    // 重新分配说话人ID
    const speakerMap = new Map<number, number>();
    let newId = 0;
    for (const seg of segments) {
      if (!speakerMap.has(seg.speakerId)) {
        speakerMap.set(seg.speakerId, newId++);
      }
      seg.speakerId = speakerMap.get(seg.speakerId)!;
      seg.speakerLabel = getSpeakerLabel(seg.speakerId);
    }
  }

  return segments;
}

/**
 * 应用说话人标签到转录片段
 */
function applySpeakerLabelsToSegments(
  transcriptionSegments: Array<{ startMs: number; endMs: number; text: string }>,
  diarizationResult: SpeakerDiarizationResult,
): Array<{ startMs: number; endMs: number; text: string; speaker?: string; speakerId?: number }> {
  return transcriptionSegments.map((seg) => {
    // 找到与此转录片段时间重叠最多的分离片段
    let bestOverlap = 0;
    let bestMatch: SpeakerDiarizationSegment | null = null;

    for (const diarSeg of diarizationResult.segments) {
      const overlapStart = Math.max(seg.startMs, diarSeg.startMs);
      const overlapEnd = Math.min(seg.endMs, diarSeg.endMs);
      const overlapDuration = Math.max(0, overlapEnd - overlapStart);

      if (overlapDuration > bestOverlap) {
        bestOverlap = overlapDuration;
        bestMatch = diarSeg;
      }
    }

    if (bestMatch && bestMatch.confidence >= 0.5) {
      return {
        ...seg,
        speaker: bestMatch.speakerLabel,
        speakerId: bestMatch.speakerId,
      };
    }

    return seg;
  });
}

/**
 * 获取说话人标签
 */
function getSpeakerLabel(speakerId: number): string {
  const labels = ['说话人 A', '说话人 B', '说话人 C', '说话人 D', '说话人 E', '说话人 F', '说话人 G', '说话人 H'];

  if (speakerId >= 0 && speakerId < labels.length) {
    return labels[speakerId];
  }

  return `说话人 ${String.fromCharCode(65 + (speakerId % 26))}${speakerId >= 26 ? Math.floor(speakerId / 26) : ''}`;
}

// -- Types --
import type { TranscriptionSegment } from './transcription';

/** 说话人分离配置 */
export interface SpeakerDiarizationConfig {
  /** 最少说话人数量 */
  minSpeakers?: number;
  /** 最多说话人数量 */
  maxSpeakers?: number;
  /** 聚类阈值（0-1），越高越严格 */
  clusteringThreshold?: number;
  /** 最小片段时长（毫秒） */
  minSegmentDurationMs?: number;
  /** 说话人合并阈值（毫秒），间隔小于此值的同说话人片段将合并 */
  mergeGapMs?: number;
  /** 是否启用声纹验证 */
  enableVoiceprintVerification?: boolean;
}

/** 说话人声纹特征向量 */
export interface VoiceprintEmbedding {
  /** 说话人ID */
  speakerId: number;
  /** 说话人标签（如 "说话人 A"） */
  speakerLabel: string;
  /** 特征向量（128维或256维） */
  embedding: number[];
  /** 特征置信度 */
  confidence: number;
  /** 样本数量 */
  sampleCount: number;
}

/** 说话人分离结果片段 */
export interface SpeakerDiarizationSegment {
  /** 开始时间（毫秒） */
  startMs: number;
  /** 结束时间（毫秒） */
  endMs: number;
  /** 说话人ID */
  speakerId: number;
  /** 说话人标签 */
  speakerLabel: string;
  /** 分离置信度 */
  confidence: number;
  /** 原始文本（如果有） */
  text?: string;
}

/** 说话人分离结果 */
export interface SpeakerDiarizationResult {
  /** 分离片段列表 */
  segments: SpeakerDiarizationSegment[];
  /** 检测到的说话人列表 */
  speakers: VoiceprintEmbedding[];
  /** 总时长（毫秒） */
  durationMs: number;
  /** 处理统计 */
  stats: {
    /** 检测到的说话人数量 */
    speakerCount: number;
    /** 平均置信度 */
    avgConfidence: number;
    /** 最长单人发言时长（毫秒） */
    maxMonologueMs: number;
    /** 说话人切换次数 */
    speakerSwitches: number;
  };
}

/** 声纹聚类配置 */
export interface ClusteringOptions {
  /** 聚类方法 */
  method: 'spectral' | 'agglomerative' | 'kmeans';
  /** 距离度量 */
  distanceMetric: 'cosine' | 'euclidean' | 'angular';
  /** 最大迭代次数 */
  maxIterations?: number;
  /** 收敛阈值 */
  convergenceThreshold?: number;
}

/** 声纹特征提取配置 */
export interface FeatureExtractionConfig {
  /** 特征维度 */
  embeddingDim?: number;
  /** 窗口大小（毫秒） */
  windowMs?: number;
  /** 帧移（毫秒） */
  hopMs?: number;
  /** Mel频带数量 */
  melBands?: number;
  /** 是否使用MFCC */
  useMfcc?: boolean;
}

// -- Constants --
const DEFAULT_MIN_SPEAKERS = 1;
const DEFAULT_MAX_SPEAKERS = 10;
const DEFAULT_CLUSTERING_THRESHOLD = 0.7;
const DEFAULT_MIN_SEGMENT_DURATION_MS = 500;
const DEFAULT_MERGE_GAP_MS = 300;
const DEFAULT_EMBEDDING_DIM = 256;
const DEFAULT_WINDOW_MS = 25;
const DEFAULT_HOP_MS = 10;
const DEFAULT_MEL_BANDS = 80;
const DEFAULT_MAX_ITERATIONS = 100;
const DEFAULT_CONVERGENCE_THRESHOLD = 0.001;

/** 说话人标签映射 */
const SPEAKER_LABELS = [
  '说话人 A', '说话人 B', '说话人 C', '说话人 D',
  '说话人 E', '说话人 F', '说话人 G', '说话人 H',
  '说话人 I', '说话人 J', '说话人 K', '说话人 L',
];

// -- Feature Extraction (Pure Computation) --

/**
 * 从音频特征向量提取声纹嵌入
 * 注意：实际的声纹提取需要在Worker中调用Pyannote模型
 * 此函数提供特征向量的后处理和归一化
 */
export function normalizeEmbedding(embedding: number[]): number[] {
  if (!embedding || embedding.length === 0) {
    return [];
  }

  // L2归一化
  const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (norm < 1e-8) {
    return new Array(embedding.length).fill(0);
  }

  return embedding.map(val => val / norm);
}

/**
 * 计算两个声纹嵌入的余弦相似度
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length || a.length === 0) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator < 1e-8) {
    return 0;
  }

  return dotProduct / denominator;
}

/**
 * 计算两个声纹嵌入的欧氏距离
 */
export function euclideanDistance(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length || a.length === 0) {
    return Infinity;
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

/**
 * 计算两个声纹嵌入的角距离
 */
export function angularDistance(a: number[], b: number[]): number {
  const similarity = cosineSimilarity(a, b);
  // 将余弦相似度转换为角距离（0到π）
  return Math.acos(Math.max(-1, Math.min(1, similarity)));
}

// -- Clustering Algorithms (Pure Computation) --

/**
 * 凝聚层次聚类
 * 自底向上合并相似的说话人
 */
export function agglomerativeClustering(
  embeddings: number[][],
  threshold: number = DEFAULT_CLUSTERING_THRESHOLD,
  distanceMetric: 'cosine' | 'euclidean' | 'angular' = 'cosine',
): number[] {
  if (!embeddings || embeddings.length === 0) {
    return [];
  }

  const n = embeddings.length;
  if (n === 1) {
    return [0];
  }

  // 计算距离函数
  const distanceFn = distanceMetric === 'cosine'
    ? (a: number[], b: number[]) => 1 - cosineSimilarity(a, b)
    : distanceMetric === 'euclidean'
      ? euclideanDistance
      : angularDistance;

  // 初始化：每个样本为一个簇
  const clusters: number[][] = embeddings.map((_, i) => [i]);
  const clusterIds: number[] = Array.from({ length: n }, (_, i) => i);
  let nextClusterId = n;

  // 距离矩阵缓存
  const distanceCache = new Map<string, number>();

  const getDistance = (i: number, j: number): number => {
    const key = `${Math.min(i, j)}-${Math.max(i, j)}`;
    if (!distanceCache.has(key)) {
      distanceCache.set(key, distanceFn(embeddings[i], embeddings[j]));
    }
    return distanceCache.get(key)!;
  };

  // 合并过程
  while (clusters.length > 1) {
    // 找最近的两个簇
    let minDist = Infinity;
    let mergeI = -1;
    let mergeJ = -1;

    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        // 使用平均链接计算簇间距离
        let totalDist = 0;
        let count = 0;
        for (const ii of clusters[i]) {
          for (const jj of clusters[j]) {
            totalDist += getDistance(ii, jj);
            count++;
          }
        }
        const avgDist = totalDist / count;

        if (avgDist < minDist) {
          minDist = avgDist;
          mergeI = i;
          mergeJ = j;
        }
      }
    }

    // 如果最小距离超过阈值，停止合并
    if (minDist > threshold) {
      break;
    }

    // 合并簇
    const newCluster = [...clusters[mergeI], ...clusters[mergeJ]];
    const newClusterId = nextClusterId++;

    // 更新簇ID
    for (const idx of newCluster) {
      clusterIds[idx] = newClusterId;
    }

    // 更新簇列表
    clusters.splice(mergeJ, 1);
    clusters.splice(mergeI, 1);
    clusters.push(newCluster);
  }

  // 重新编号为连续的0, 1, 2, ...
  const uniqueIds = [...new Set(clusterIds)];
  const idMap = new Map<number, number>();
  uniqueIds.forEach((id, index) => idMap.set(id, index));

  return clusterIds.map(id => idMap.get(id)!);
}

/**
 * K-Means聚类
 * 适用于已知说话人数量的场景
 */
export function kMeansClustering(
  embeddings: number[][],
  k: number,
  maxIterations: number = DEFAULT_MAX_ITERATIONS,
  convergenceThreshold: number = DEFAULT_CONVERGENCE_THRESHOLD,
): number[] {
  if (!embeddings || embeddings.length === 0 || k <= 0) {
    return [];
  }

  const n = embeddings.length;
  const dim = embeddings[0].length;

  // 如果样本数少于k，调整k
  const effectiveK = Math.min(k, n);

  // 随机初始化质心（使用K-Means++策略）
  let centroids = initializeCentroidsKMeansPlusPlus(embeddings, effectiveK);
  let assignments = new Array(n).fill(0);

  for (let iter = 0; iter < maxIterations; iter++) {
    // 分配每个样本到最近的质心
    const newAssignments = embeddings.map(emb => {
      let minDist = Infinity;
      let bestCluster = 0;
      for (let c = 0; c < effectiveK; c++) {
        const dist = euclideanDistance(emb, centroids[c]);
        if (dist < minDist) {
          minDist = dist;
          bestCluster = c;
        }
      }
      return bestCluster;
    });

    // 检查收敛
    let changed = 0;
    for (let i = 0; i < n; i++) {
      if (newAssignments[i] !== assignments[i]) {
        changed++;
      }
    }

    assignments = newAssignments;

    if (changed / n < convergenceThreshold) {
      break;
    }

    // 更新质心
    const newCentroids: number[][] = Array.from({ length: effectiveK }, () => new Array(dim).fill(0));
    const counts = new Array(effectiveK).fill(0);

    for (let i = 0; i < n; i++) {
      const cluster = assignments[i];
      counts[cluster]++;
      for (let d = 0; d < dim; d++) {
        newCentroids[cluster][d] += embeddings[i][d];
      }
    }

    for (let c = 0; c < effectiveK; c++) {
      if (counts[c] > 0) {
        for (let d = 0; d < dim; d++) {
          newCentroids[c][d] /= counts[c];
        }
      }
    }

    centroids = newCentroids;
  }

  return assignments;
}

/**
 * K-Means++初始化质心
 */
function initializeCentroidsKMeansPlusPlus(embeddings: number[][], k: number): number[][] {
  const n = embeddings.length;
  const centroids: number[][] = [];

  // 随机选择第一个质心
  const firstIdx = Math.floor(Math.random() * n);
  centroids.push([...embeddings[firstIdx]]);

  // 选择剩余质心
  for (let c = 1; c < k; c++) {
    // 计算每个样本到最近质心的距离
    const distances = embeddings.map(emb => {
      let minDist = Infinity;
      for (const centroid of centroids) {
        const dist = euclideanDistance(emb, centroid);
        if (dist < minDist) {
          minDist = dist;
        }
      }
      return minDist * minDist;
    });

    // 按距离^2的概率选择下一个质心
    const totalDist = distances.reduce((sum, d) => sum + d, 0);
    let random = Math.random() * totalDist;
    let nextIdx = 0;

    for (let i = 0; i < n; i++) {
      random -= distances[i];
      if (random <= 0) {
        nextIdx = i;
        break;
      }
    }

    centroids.push([...embeddings[nextIdx]]);
  }

  return centroids;
}

// -- Speaker Diarization Pipeline (Pure Computation) --

/**
 * 从带时间戳的声纹嵌入序列进行说话人分离
 * 输入：时间序列的声纹嵌入
 * 输出：说话人分离结果
 */
export function diarizeFromEmbeddings(
  timeEmbeddings: Array<{ startMs: number; endMs: number; embedding: number[] }>,
  config: SpeakerDiarizationConfig = {},
): SpeakerDiarizationResult {
  if (!timeEmbeddings || timeEmbeddings.length === 0) {
    return createEmptyResult();
  }

  const minSpeakers = config.minSpeakers ?? DEFAULT_MIN_SPEAKERS;
  const maxSpeakers = config.maxSpeakers ?? DEFAULT_MAX_SPEAKERS;
  const threshold = config.clusteringThreshold ?? DEFAULT_CLUSTERING_THRESHOLD;
  const mergeGapMs = config.mergeGapMs ?? DEFAULT_MERGE_GAP_MS;

  // 归一化嵌入向量
  const normalizedEmbeddings = timeEmbeddings.map(te => normalizeEmbedding(te.embedding));

  // 使用凝聚层次聚类确定说话人
  let clusterAssignments = agglomerativeClustering(normalizedEmbeddings, threshold);

  // 限制说话人数量
  const uniqueSpeakers = new Set(clusterAssignments);
  if (uniqueSpeakers.size > maxSpeakers) {
    // 使用K-Means重新聚类
    clusterAssignments = kMeansClustering(normalizedEmbeddings, maxSpeakers);
  }
  if (uniqueSpeakers.size < minSpeakers && normalizedEmbeddings.length >= minSpeakers) {
    clusterAssignments = kMeansClustering(normalizedEmbeddings, minSpeakers);
  }

  // 构建分离结果片段
  let segments: SpeakerDiarizationSegment[] = timeEmbeddings.map((te, i) => ({
    startMs: te.startMs,
    endMs: te.endMs,
    speakerId: clusterAssignments[i],
    speakerLabel: getSpeakerLabel(clusterAssignments[i]),
    confidence: calculateSegmentConfidence(normalizedEmbeddings[i], normalizedEmbeddings, clusterAssignments, clusterAssignments[i]),
    text: undefined,
  }));

  // 合并相邻的同说话人片段
  segments = mergeAdjacentSegments(segments, mergeGapMs);

  // 构建说话人声纹
  const speakers = buildSpeakerVoiceprints(segments, normalizedEmbeddings, clusterAssignments);

  // 计算统计信息
  const stats = calculateDiarizationStats(segments);

  // 计算总时长
  const durationMs = segments.length > 0
    ? Math.max(...segments.map(s => s.endMs))
    : 0;

  return {
    segments,
    speakers,
    durationMs,
    stats,
  };
}

/**
 * 将说话人分离结果应用到转录片段
 * 将说话人标签添加到已有的转录文本中
 */
export function applySpeakerLabelsToTranscription(
  transcriptionSegments: TranscriptionSegment[],
  diarizationResult: SpeakerDiarizationResult,
): TranscriptionSegment[] {
  if (!transcriptionSegments || !diarizationResult || diarizationResult.segments.length === 0) {
    return transcriptionSegments;
  }

  return transcriptionSegments.map(seg => {
    // 找到与此转录片段时间重叠最多的分离片段
    const bestMatch = findBestOverlap(seg.startMs, seg.endMs, diarizationResult.segments);

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
 * 基于说话人ID获取多机位切换建议
 * 当说话人切换时，建议切换到对应的机位
 */
export function getSpeakerBasedAngleSwitches(
  diarizationSegments: SpeakerDiarizationSegment[],
  speakerAngleMapping: Map<number, number>,
  minSwitchIntervalMs: number = 1500,
): Array<{ timeMs: number; targetAngle: number; speakerId: number }> {
  if (!diarizationSegments || diarizationSegments.length === 0) {
    return [];
  }

  const switches: Array<{ timeMs: number; targetAngle: number; speakerId: number }> = [];
  let lastSwitchTime = -Infinity;

  for (const seg of diarizationSegments) {
    const targetAngle = speakerAngleMapping.get(seg.speakerId);
    if (targetAngle === undefined) {
      continue;
    }

    // 检查是否满足最小切换间隔
    if (seg.startMs - lastSwitchTime >= minSwitchIntervalMs) {
      switches.push({
        timeMs: seg.startMs,
        targetAngle,
        speakerId: seg.speakerId,
      });
      lastSwitchTime = seg.startMs;
    }
  }

  return switches;
}

/**
 * 从文本中提取说话人标签
 * 支持多种格式：[说话人 A]、Speaker A:、<v Speaker>等
 */
export function extractSpeakerLabelsFromText(
  text: string,
): Array<{ speaker: string; text: string; startIndex: number; endIndex: number }> {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const results: Array<{ speaker: string; text: string; startIndex: number; endIndex: number }> = [];

  // 模式1: [说话人 X] 或 [Speaker X]
  const bracketPattern = /\[(说话人\s*[A-Za-z]|Speaker\s*[A-Za-z])\]\s*/g;
  let match: RegExpExecArray | null;

  while ((match = bracketPattern.exec(text)) !== null) {
    const speaker = match[1].trim();
    const remainingText = text.substring(match.index + match[0].length);
    const nextBracket = remainingText.search(/\[/);
    const speakerText = nextBracket >= 0 ? remainingText.substring(0, nextBracket).trim() : remainingText.trim();

    if (speakerText.length > 0) {
      results.push({
        speaker,
        text: speakerText,
        startIndex: match.index,
        endIndex: match.index + match[0].length + speakerText.length,
      });
    }
  }

  // 模式2: Speaker X: 或 说话人 X：
  const colonPattern = /(说话人\s*[A-Za-z]|Speaker\s*[A-Za-z])\s*[:：]\s*/g;

  while ((match = colonPattern.exec(text)) !== null) {
    const speaker = match[1].trim();
    const remainingText = text.substring(match.index + match[0].length);
    const nextSpeaker = remainingText.search(/(说话人|Speaker)/i);
    const speakerText = nextSpeaker >= 0 ? remainingText.substring(0, nextSpeaker).trim() : remainingText.trim();

    if (speakerText.length > 0) {
      results.push({
        speaker,
        text: speakerText,
        startIndex: match.index,
        endIndex: match.index + match[0].length + speakerText.length,
      });
    }
  }

  return results;
}

// -- Helper Functions (Private) --

/**
 * 获取说话人标签
 */
function getSpeakerLabel(speakerId: number): string {
  if (speakerId >= 0 && speakerId < SPEAKER_LABELS.length) {
    return SPEAKER_LABELS[speakerId];
  }
  return `说话人 ${String.fromCharCode(65 + (speakerId % 26))}${speakerId >= 26 ? Math.floor(speakerId / 26) : ''}`;
}

/**
 * 计算片段置信度
 */
function calculateSegmentConfidence(
  embedding: number[],
  allEmbeddings: number[][],
  assignments: number[],
  clusterId: number,
): number {
  // 找到同簇的所有嵌入
  const clusterEmbeddings = allEmbeddings.filter((_, i) => assignments[i] === clusterId);

  if (clusterEmbeddings.length <= 1) {
    return 0.8; // 单一样本默认置信度
  }

  // 计算与同簇其他嵌入的平均相似度
  let totalSimilarity = 0;
  let count = 0;

  for (const other of clusterEmbeddings) {
    if (other !== embedding) {
      totalSimilarity += cosineSimilarity(embedding, other);
      count++;
    }
  }

  return count > 0 ? totalSimilarity / count : 0.8;
}

/**
 * 合并相邻的同说话人片段
 */
function mergeAdjacentSegments(
  segments: SpeakerDiarizationSegment[],
  mergeGapMs: number,
): SpeakerDiarizationSegment[] {
  if (segments.length <= 1) {
    return segments;
  }

  const sorted = [...segments].sort((a, b) => a.startMs - b.startMs);
  const merged: SpeakerDiarizationSegment[] = [];
  let current = { ...sorted[0] };

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];

    // 同一说话人且间隔小于阈值
    if (current.speakerId === next.speakerId && next.startMs - current.endMs <= mergeGapMs) {
      current = {
        startMs: current.startMs,
        endMs: Math.max(current.endMs, next.endMs),
        speakerId: current.speakerId,
        speakerLabel: current.speakerLabel,
        confidence: Math.min(current.confidence, next.confidence),
        text: current.text && next.text ? `${current.text} ${next.text}` : current.text ?? next.text,
      };
    } else {
      merged.push(current);
      current = { ...next };
    }
  }

  merged.push(current);
  return merged;
}

/**
 * 构建说话人声纹
 */
function buildSpeakerVoiceprints(
  segments: SpeakerDiarizationSegment[],
  embeddings: number[][],
  assignments: number[],
): VoiceprintEmbedding[] {
  const speakerMap = new Map<number, { embeddings: number[][]; count: number }>();

  // 收集每个说话人的嵌入
  for (let i = 0; i < segments.length; i++) {
    const speakerId = segments[i].speakerId;
    if (!speakerMap.has(speakerId)) {
      speakerMap.set(speakerId, { embeddings: [], count: 0 });
    }
    const entry = speakerMap.get(speakerId)!;
    // 使用原始嵌入索引（需要映射回）
    entry.count++;
  }

  // 构建声纹（使用聚类中心）
  const voiceprints: VoiceprintEmbedding[] = [];

  for (const [speakerId, data] of speakerMap) {
    // 计算该说话人的平均嵌入
    const speakerEmbeddings = embeddings.filter((_, i) => assignments[i] === speakerId);

    if (speakerEmbeddings.length > 0) {
      const avgEmbedding = new Array(embeddings[0].length).fill(0);
      for (const emb of speakerEmbeddings) {
        for (let d = 0; d < emb.length; d++) {
          avgEmbedding[d] += emb[d];
        }
      }
      for (let d = 0; d < avgEmbedding.length; d++) {
        avgEmbedding[d] /= speakerEmbeddings.length;
      }

      voiceprints.push({
        speakerId,
        speakerLabel: getSpeakerLabel(speakerId),
        embedding: normalizeEmbedding(avgEmbedding),
        confidence: 0.9,
        sampleCount: data.count,
      });
    }
  }

  return voiceprints.sort((a, b) => a.speakerId - b.speakerId);
}

/**
 * 计算分离统计信息
 */
function calculateDiarizationStats(segments: SpeakerDiarizationSegment[]): SpeakerDiarizationResult['stats'] {
  if (segments.length === 0) {
    return {
      speakerCount: 0,
      avgConfidence: 0,
      maxMonologueMs: 0,
      speakerSwitches: 0,
    };
  }

  const speakerIds = new Set(segments.map(s => s.speakerId));
  const avgConfidence = segments.reduce((sum, s) => sum + s.confidence, 0) / segments.length;

  // 计算最长单人发言
  let maxMonologueMs = 0;
  let currentSpeaker = segments[0].speakerId;
  let currentMonologueStart = segments[0].startMs;

  for (let i = 1; i < segments.length; i++) {
    if (segments[i].speakerId !== currentSpeaker) {
      const monologueDuration = segments[i - 1].endMs - currentMonologueStart;
      maxMonologueMs = Math.max(maxMonologueMs, monologueDuration);
      currentSpeaker = segments[i].speakerId;
      currentMonologueStart = segments[i].startMs;
    }
  }
  // 处理最后一段
  const lastMonologueDuration = segments[segments.length - 1].endMs - currentMonologueStart;
  maxMonologueMs = Math.max(maxMonologueMs, lastMonologueDuration);

  // 计算说话人切换次数
  let speakerSwitches = 0;
  for (let i = 1; i < segments.length; i++) {
    if (segments[i].speakerId !== segments[i - 1].speakerId) {
      speakerSwitches++;
    }
  }

  return {
    speakerCount: speakerIds.size,
    avgConfidence: Math.round(avgConfidence * 1000) / 1000,
    maxMonologueMs,
    speakerSwitches,
  };
}

/**
 * 找到时间重叠最多的片段
 */
function findBestOverlap(
  startMs: number,
  endMs: number,
  diarizationSegments: SpeakerDiarizationSegment[],
): SpeakerDiarizationSegment | null {
  let bestOverlap = 0;
  let bestSegment: SpeakerDiarizationSegment | null = null;

  for (const seg of diarizationSegments) {
    const overlapStart = Math.max(startMs, seg.startMs);
    const overlapEnd = Math.min(endMs, seg.endMs);
    const overlapDuration = Math.max(0, overlapEnd - overlapStart);

    if (overlapDuration > bestOverlap) {
      bestOverlap = overlapDuration;
      bestSegment = seg;
    }
  }

  return bestSegment;
}

/**
 * 创建空结果
 */
function createEmptyResult(): SpeakerDiarizationResult {
  return {
    segments: [],
    speakers: [],
    durationMs: 0,
    stats: {
      speakerCount: 0,
      avgConfidence: 0,
      maxMonologueMs: 0,
      speakerSwitches: 0,
    },
  };
}

// -- Validation --

/** 说话人分离验证问题 */
export interface DiarizationValidationIssue {
  index: number;
  type: 'low-confidence' | 'short-segment' | 'overlap' | 'invalid-time' | 'too-many-speakers';
  message: string;
}

/**
 * 验证说话人分离结果
 */
export function validateDiarizationResult(
  result: SpeakerDiarizationResult,
  minConfidence: number = 0.5,
  minSegmentDurationMs: number = DEFAULT_MIN_SEGMENT_DURATION_MS,
  maxSpeakers: number = DEFAULT_MAX_SPEAKERS,
): DiarizationValidationIssue[] {
  const issues: DiarizationValidationIssue[] = [];

  // 检查说话人数量
  if (result.stats.speakerCount > maxSpeakers) {
    issues.push({
      index: -1,
      type: 'too-many-speakers',
      message: `检测到 ${result.stats.speakerCount} 个说话人，超过最大限制 ${maxSpeakers}`,
    });
  }

  // 检查每个片段
  for (let i = 0; i < result.segments.length; i++) {
    const seg = result.segments[i];

    // 无效时间
    if (seg.startMs < 0 || seg.endMs < 0 || seg.endMs <= seg.startMs) {
      issues.push({
        index: i,
        type: 'invalid-time',
        message: `片段 ${i + 1} 时间无效：${seg.startMs}ms - ${seg.endMs}ms`,
      });
    }

    // 低置信度
    if (seg.confidence < minConfidence) {
      issues.push({
        index: i,
        type: 'low-confidence',
        message: `片段 ${i + 1} 置信度 ${seg.confidence.toFixed(3)} 低于阈值 ${minConfidence}`,
      });
    }

    // 片段过短
    const duration = seg.endMs - seg.startMs;
    if (duration > 0 && duration < minSegmentDurationMs) {
      issues.push({
        index: i,
        type: 'short-segment',
        message: `片段 ${i + 1} 时长 ${duration}ms 小于最小阈值 ${minSegmentDurationMs}ms`,
      });
    }

    // 与前一片段重叠
    if (i > 0 && seg.startMs < result.segments[i - 1].endMs - 0.001) {
      issues.push({
        index: i,
        type: 'overlap',
        message: `片段 ${i + 1} 与片段 ${i} 存在时间重叠`,
      });
    }
  }

  return issues;
}

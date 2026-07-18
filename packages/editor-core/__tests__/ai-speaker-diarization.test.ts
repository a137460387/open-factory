import { describe, it, expect } from 'vitest';
import {
  normalizeEmbedding,
  cosineSimilarity,
  euclideanDistance,
  angularDistance,
  agglomerativeClustering,
  kMeansClustering,
  diarizeFromEmbeddings,
  applySpeakerLabelsToTranscription,
  getSpeakerBasedAngleSwitches,
  extractSpeakerLabelsFromText,
  validateDiarizationResult,
} from '../src/ai/speaker-diarization';
import type { TranscriptionSegment } from '../src/ai/transcription';

describe('Speaker Diarization', () => {
  // -- 嵌入向量工具函数测试 --
  describe('Embedding Utilities', () => {
    it('normalizeEmbedding 应该归一化向量', () => {
      const embedding = [3, 4]; // 长度为5
      const normalized = normalizeEmbedding(embedding);

      expect(normalized).toHaveLength(2);
      expect(normalized[0]).toBeCloseTo(0.6, 5);
      expect(normalized[1]).toBeCloseTo(0.8, 5);

      // 验证归一化后长度为1
      const norm = Math.sqrt(normalized.reduce((sum, v) => sum + v * v, 0));
      expect(norm).toBeCloseTo(1.0, 5);
    });

    it('normalizeEmbedding 应该处理空向量', () => {
      expect(normalizeEmbedding([])).toEqual([]);
      expect(normalizeEmbedding([0, 0, 0])).toEqual([0, 0, 0]);
    });

    it('cosineSimilarity 应该计算余弦相似度', () => {
      const a = [1, 0, 0];
      const b = [0, 1, 0];
      const c = [1, 0, 0];

      expect(cosineSimilarity(a, b)).toBeCloseTo(0, 5); // 正交
      expect(cosineSimilarity(a, c)).toBeCloseTo(1, 5); // 相同方向
      expect(cosineSimilarity(a, [-1, 0, 0])).toBeCloseTo(-1, 5); // 相反方向
    });

    it('cosineSimilarity 应该处理不同长度的向量', () => {
      expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
    });

    it('euclideanDistance 应该计算欧氏距离', () => {
      const a = [0, 0];
      const b = [3, 4];

      expect(euclideanDistance(a, b)).toBeCloseTo(5, 5);
      expect(euclideanDistance(a, a)).toBeCloseTo(0, 5);
    });

    it('angularDistance 应该计算角距离', () => {
      const a = [1, 0];
      const b = [0, 1];

      expect(angularDistance(a, b)).toBeCloseTo(Math.PI / 2, 5); // 90度
      expect(angularDistance(a, a)).toBeCloseTo(0, 5); // 0度
    });
  });

  // -- 聚类算法测试 --
  describe('Clustering Algorithms', () => {
    // 生成测试用嵌入向量
    const generateClusterEmbeddings = (
      clusterCount: number,
      samplesPerCluster: number,
      dim: number = 8,
    ): number[][] => {
      const embeddings: number[][] = [];
      for (let c = 0; c < clusterCount; c++) {
        // 为每个簇生成一个中心
        const center = Array.from({ length: dim }, () => Math.random() * 2 - 1);
        for (let s = 0; s < samplesPerCluster; s++) {
          // 在中心附近添加噪声
          const embedding = center.map(v => v + (Math.random() - 0.5) * 0.3);
          embeddings.push(embedding);
        }
      }
      return embeddings;
    };

    it('agglomerativeClustering 应该将相似向量聚为一簇', () => {
      // 创建两个明显分离的簇
      const embeddings = [
        [1, 1, 1, 0, 0, 0],
        [0.9, 1.1, 0.9, 0.1, 0.1, 0.1],
        [1.1, 0.9, 1.1, -0.1, -0.1, -0.1],
        [0, 0, 0, 1, 1, 1],
        [0.1, 0.1, 0.1, 0.9, 1.1, 0.9],
        [-0.1, -0.1, -0.1, 1.1, 0.9, 1.1],
      ];

      const assignments = agglomerativeClustering(embeddings, 0.5);

      expect(assignments).toHaveLength(6);
      // 前三个应该在同一簇
      expect(assignments[0]).toBe(assignments[1]);
      expect(assignments[1]).toBe(assignments[2]);
      // 后三个应该在同一簇
      expect(assignments[3]).toBe(assignments[4]);
      expect(assignments[4]).toBe(assignments[5]);
      // 两个簇应该不同
      expect(assignments[0]).not.toBe(assignments[3]);
    });

    it('agglomerativeClustering 应该处理单个向量', () => {
      const assignments = agglomerativeClustering([[1, 2, 3]]);
      expect(assignments).toEqual([0]);
    });

    it('agglomerativeClustering 应该处理空输入', () => {
      expect(agglomerativeClustering([])).toEqual([]);
    });

    it('kMeansClustering 应该正确聚类', () => {
      const embeddings = [
        [1, 1], [1.1, 0.9], [0.9, 1.1],
        [5, 5], [5.1, 4.9], [4.9, 5.1],
      ];

      const assignments = kMeansClustering(embeddings, 2, 50);

      expect(assignments).toHaveLength(6);
      // 前三个应该在同一簇
      expect(assignments[0]).toBe(assignments[1]);
      expect(assignments[1]).toBe(assignments[2]);
      // 后三个应该在同一簇
      expect(assignments[3]).toBe(assignments[4]);
      expect(assignments[4]).toBe(assignments[5]);
      // 两个簇应该不同
      expect(assignments[0]).not.toBe(assignments[3]);
    });

    it('kMeansClustering 应该限制k不超过样本数', () => {
      const embeddings = [[1, 2], [3, 4]];
      const assignments = kMeansClustering(embeddings, 5);

      expect(assignments).toHaveLength(2);
      // 最多2个簇
      const uniqueClusters = new Set(assignments);
      expect(uniqueClusters.size).toBeLessThanOrEqual(2);
    });
  });

  // -- 说话人分离管道测试 --
  describe('Diarization Pipeline', () => {
    it('diarizeFromEmbeddings 应该处理空输入', () => {
      const result = diarizeFromEmbeddings([]);

      expect(result.segments).toEqual([]);
      expect(result.speakers).toEqual([]);
      expect(result.durationMs).toBe(0);
      expect(result.stats.speakerCount).toBe(0);
    });

    it('diarizeFromEmbeddings 应该分离两个说话人', () => {
      // 模拟两个说话人的声纹嵌入
      const timeEmbeddings = [
        // 说话人A的片段
        { startMs: 0, endMs: 2000, embedding: [1, 0, 0, 0, 0, 0, 0, 0] },
        { startMs: 2000, endMs: 4000, embedding: [0.95, 0.1, 0, 0, 0, 0, 0, 0] },
        // 说话人B的片段
        { startMs: 4000, endMs: 6000, embedding: [0, 0, 0, 0, 1, 0, 0, 0] },
        { startMs: 6000, endMs: 8000, embedding: [0, 0, 0, 0, 0.95, 0.1, 0, 0] },
        // 说话人A再次发言
        { startMs: 8000, endMs: 10000, embedding: [0.98, 0.05, 0, 0, 0, 0, 0, 0] },
      ];

      const result = diarizeFromEmbeddings(timeEmbeddings, {
        minSpeakers: 2,
        maxSpeakers: 2,
        clusteringThreshold: 0.8,
      });

      expect(result.segments.length).toBeGreaterThan(0);
      expect(result.stats.speakerCount).toBe(2);
      expect(result.speakers).toHaveLength(2);

      // 验证说话人标签
      const speakerLabels = new Set(result.segments.map(s => s.speakerLabel));
      expect(speakerLabels.size).toBe(2);
    });

    it('diarizeFromEmbeddings 应该合并相邻的同说话人片段', () => {
      const timeEmbeddings = [
        { startMs: 0, endMs: 1000, embedding: [1, 0, 0, 0] },
        { startMs: 1000, endMs: 2000, embedding: [0.98, 0.1, 0, 0] }, // 同一说话人
        { startMs: 2000, endMs: 3000, embedding: [0, 0, 1, 0] }, // 不同说话人
      ];

      const result = diarizeFromEmbeddings(timeEmbeddings, {
        clusteringThreshold: 0.9,
        mergeGapMs: 500,
      });

      // 应该合并前两个片段
      expect(result.segments.length).toBeLessThanOrEqual(2);
    });

    it('diarizeFromEmbeddings 应该计算正确的统计信息', () => {
      const timeEmbeddings = [
        { startMs: 0, endMs: 5000, embedding: [1, 0, 0, 0] },
        { startMs: 5000, endMs: 10000, embedding: [0, 1, 0, 0] },
        { startMs: 10000, endMs: 15000, embedding: [1, 0, 0, 0] },
      ];

      const result = diarizeFromEmbeddings(timeEmbeddings, {
        clusteringThreshold: 0.9,
      });

      expect(result.durationMs).toBe(15000);
      expect(result.stats.speakerSwitches).toBeGreaterThanOrEqual(1);
      expect(result.stats.avgConfidence).toBeGreaterThan(0);
      expect(result.stats.maxMonologueMs).toBeGreaterThan(0);
    });
  });

  // -- 转录集成测试 --
  describe('Transcription Integration', () => {
    it('applySpeakerLabelsToTranscription 应该添加说话人标签', () => {
      const transcription: TranscriptionSegment[] = [
        { startMs: 0, endMs: 2000, text: '你好' },
        { startMs: 2000, endMs: 4000, text: '你好吗' },
        { startMs: 4000, endMs: 6000, text: '我很好' },
      ];

      const diarResult = {
        segments: [
          { startMs: 0, endMs: 3000, speakerId: 0, speakerLabel: '说话人 A', confidence: 0.9 },
          { startMs: 3000, endMs: 6000, speakerId: 1, speakerLabel: '说话人 B', confidence: 0.85 },
        ],
        speakers: [],
        durationMs: 6000,
        stats: { speakerCount: 2, avgConfidence: 0.875, maxMonologueMs: 3000, speakerSwitches: 1 },
      };

      const labeled = applySpeakerLabelsToTranscription(transcription, diarResult);

      expect(labeled[0].speaker).toBe('说话人 A');
      expect(labeled[1].speaker).toBe('说话人 A'); // 重叠更多
      expect(labeled[2].speaker).toBe('说话人 B');
    });

    it('applySpeakerLabelsToTranscription 应该处理空输入', () => {
      const transcription: TranscriptionSegment[] = [
        { startMs: 0, endMs: 2000, text: '你好' },
      ];

      const emptyResult = {
        segments: [],
        speakers: [],
        durationMs: 0,
        stats: { speakerCount: 0, avgConfidence: 0, maxMonologueMs: 0, speakerSwitches: 0 },
      };

      const labeled = applySpeakerLabelsToTranscription(transcription, emptyResult);
      expect(labeled[0].speaker).toBeUndefined();
    });
  });

  // -- 多机位切换测试 --
  describe('Multi-Camera Switching', () => {
    it('getSpeakerBasedAngleSwitches 应该基于说话人生成切换建议', () => {
      const segments = [
        { startMs: 0, endMs: 5000, speakerId: 0, speakerLabel: '说话人 A', confidence: 0.9 },
        { startMs: 5000, endMs: 10000, speakerId: 1, speakerLabel: '说话人 B', confidence: 0.85 },
        { startMs: 10000, endMs: 15000, speakerId: 0, speakerLabel: '说话人 A', confidence: 0.92 },
      ];

      const speakerAngleMap = new Map([
        [0, 0], // 说话人A -> 机位0
        [1, 1], // 说话人B -> 机位1
      ]);

      const switches = getSpeakerBasedAngleSwitches(segments, speakerAngleMap, 1000);

      expect(switches).toHaveLength(3);
      expect(switches[0]).toEqual({ timeMs: 0, targetAngle: 0, speakerId: 0 });
      expect(switches[1]).toEqual({ timeMs: 5000, targetAngle: 1, speakerId: 1 });
      expect(switches[2]).toEqual({ timeMs: 10000, targetAngle: 0, speakerId: 0 });
    });

    it('getSpeakerBasedAngleSwitches 应该尊重最小切换间隔', () => {
      const segments = [
        { startMs: 0, endMs: 1000, speakerId: 0, speakerLabel: '说话人 A', confidence: 0.9 },
        { startMs: 1000, endMs: 2000, speakerId: 1, speakerLabel: '说话人 B', confidence: 0.85 },
        { startMs: 2000, endMs: 3000, speakerId: 0, speakerLabel: '说话人 A', confidence: 0.92 },
      ];

      const speakerAngleMap = new Map([
        [0, 0],
        [1, 1],
      ]);

      // 设置较大的最小切换间隔
      const switches = getSpeakerBasedAngleSwitches(segments, speakerAngleMap, 5000);

      // 只应该有一次切换（第一次）
      expect(switches).toHaveLength(1);
      expect(switches[0].targetAngle).toBe(0);
    });

    it('getSpeakerBasedAngleSwitches 应该处理空输入', () => {
      const switches = getSpeakerBasedAngleSwitches([], new Map());
      expect(switches).toEqual([]);
    });
  });

  // -- 文本提取测试 --
  describe('Text Speaker Extraction', () => {
    it('extractSpeakerLabelsFromText 应该提取方括号格式', () => {
      const text = '[说话人 A] 你好吗？[说话人 B] 我很好。';
      const results = extractSpeakerLabelsFromText(text);

      expect(results).toHaveLength(2);
      expect(results[0].speaker).toBe('说话人 A');
      expect(results[0].text).toBe('你好吗？');
      expect(results[1].speaker).toBe('说话人 B');
      expect(results[1].text).toBe('我很好。');
    });

    it('extractSpeakerLabelsFromText 应该提取冒号格式', () => {
      const text = '说话人A：你好\n说话人B：我很好';
      const results = extractSpeakerLabelsFromText(text);

      expect(results).toHaveLength(2);
      expect(results[0].speaker).toBe('说话人A');
      expect(results[0].text).toContain('你好');
      expect(results[1].speaker).toBe('说话人B');
      expect(results[1].text).toContain('我很好');
    });

    it('extractSpeakerLabelsFromText 应该处理空文本', () => {
      expect(extractSpeakerLabelsFromText('')).toEqual([]);
      expect(extractSpeakerLabelsFromText('   ')).toEqual([]);
    });

    it('extractSpeakerLabelsFromText 应该处理无说话人标签的文本', () => {
      const text = '这是一段没有说话人标签的文本';
      const results = extractSpeakerLabelsFromText(text);
      expect(results).toEqual([]);
    });
  });

  // -- 验证测试 --
  describe('Validation', () => {
    it('validateDiarizationResult 应该检测低置信度', () => {
      const result = {
        segments: [
          { startMs: 0, endMs: 2000, speakerId: 0, speakerLabel: '说话人 A', confidence: 0.3 },
        ],
        speakers: [],
        durationMs: 2000,
        stats: { speakerCount: 1, avgConfidence: 0.3, maxMonologueMs: 2000, speakerSwitches: 0 },
      };

      const issues = validateDiarizationResult(result, 0.5);
      expect(issues.some(i => i.type === 'low-confidence')).toBe(true);
    });

    it('validateDiarizationResult 应该检测过短片段', () => {
      const result = {
        segments: [
          { startMs: 0, endMs: 100, speakerId: 0, speakerLabel: '说话人 A', confidence: 0.9 },
        ],
        speakers: [],
        durationMs: 100,
        stats: { speakerCount: 1, avgConfidence: 0.9, maxMonologueMs: 100, speakerSwitches: 0 },
      };

      const issues = validateDiarizationResult(result, 0.5, 500);
      expect(issues.some(i => i.type === 'short-segment')).toBe(true);
    });

    it('validateDiarizationResult 应该检测时间重叠', () => {
      const result = {
        segments: [
          { startMs: 0, endMs: 2000, speakerId: 0, speakerLabel: '说话人 A', confidence: 0.9 },
          { startMs: 1500, endMs: 3000, speakerId: 1, speakerLabel: '说话人 B', confidence: 0.85 },
        ],
        speakers: [],
        durationMs: 3000,
        stats: { speakerCount: 2, avgConfidence: 0.875, maxMonologueMs: 2000, speakerSwitches: 1 },
      };

      const issues = validateDiarizationResult(result);
      expect(issues.some(i => i.type === 'overlap')).toBe(true);
    });

    it('validateDiarizationResult 应该检测过多说话人', () => {
      const result = {
        segments: [
          { startMs: 0, endMs: 1000, speakerId: 0, speakerLabel: '说话人 A', confidence: 0.9 },
          { startMs: 1000, endMs: 2000, speakerId: 1, speakerLabel: '说话人 B', confidence: 0.9 },
          { startMs: 2000, endMs: 3000, speakerId: 2, speakerLabel: '说话人 C', confidence: 0.9 },
        ],
        speakers: [],
        durationMs: 3000,
        stats: { speakerCount: 3, avgConfidence: 0.9, maxMonologueMs: 1000, speakerSwitches: 2 },
      };

      const issues = validateDiarizationResult(result, 0.5, 500, 2);
      expect(issues.some(i => i.type === 'too-many-speakers')).toBe(true);
    });

    it('validateDiarizationResult 应该通过有效结果', () => {
      const result = {
        segments: [
          { startMs: 0, endMs: 5000, speakerId: 0, speakerLabel: '说话人 A', confidence: 0.9 },
          { startMs: 5000, endMs: 10000, speakerId: 1, speakerLabel: '说话人 B', confidence: 0.85 },
        ],
        speakers: [
          { speakerId: 0, speakerLabel: '说话人 A', embedding: [1, 0], confidence: 0.9, sampleCount: 1 },
          { speakerId: 1, speakerLabel: '说话人 B', embedding: [0, 1], confidence: 0.85, sampleCount: 1 },
        ],
        durationMs: 10000,
        stats: { speakerCount: 2, avgConfidence: 0.875, maxMonologueMs: 5000, speakerSwitches: 1 },
      };

      const issues = validateDiarizationResult(result);
      expect(issues).toEqual([]);
    });
  });
});

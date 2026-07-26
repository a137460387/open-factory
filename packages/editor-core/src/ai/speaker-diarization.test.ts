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
} from './speaker-diarization';

describe('normalizeEmbedding', () => {
  it('returns empty for empty input', () => {
    expect(normalizeEmbedding([])).toEqual([]);
  });

  it('returns empty for null', () => {
    expect(normalizeEmbedding(null as any)).toEqual([]);
  });

  it('returns zeros for zero-norm embedding', () => {
    const result = normalizeEmbedding([0, 0, 0]);
    expect(result).toEqual([0, 0, 0]);
  });

  it('normalizes to unit length', () => {
    const result = normalizeEmbedding([3, 4]);
    const norm = Math.sqrt(result[0] ** 2 + result[1] ** 2);
    expect(norm).toBeCloseTo(1);
  });

  it('preserves direction', () => {
    const result = normalizeEmbedding([2, 0, 0]);
    expect(result[0]).toBeCloseTo(1);
    expect(result[1]).toBeCloseTo(0);
    expect(result[2]).toBeCloseTo(0);
  });
});

describe('cosineSimilarity', () => {
  it('returns 0 for empty arrays', () => {
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it('returns 0 for null', () => {
    expect(cosineSimilarity(null as any, [1])).toBe(0);
  });

  it('returns 0 for different lengths', () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
  });

  it('returns 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
  });

  it('returns -1 for opposite vectors', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
  });

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it('returns 0 for zero vectors', () => {
    expect(cosineSimilarity([0, 0], [1, 2])).toBe(0);
  });
});

describe('euclideanDistance', () => {
  it('returns Infinity for empty', () => {
    expect(euclideanDistance([], [])).toBe(Infinity);
  });

  it('returns Infinity for null', () => {
    expect(euclideanDistance(null as any, [1])).toBe(Infinity);
  });

  it('returns 0 for same point', () => {
    expect(euclideanDistance([1, 2, 3], [1, 2, 3])).toBe(0);
  });

  it('computes distance', () => {
    expect(euclideanDistance([0, 0], [3, 4])).toBe(5);
  });

  it('is symmetric', () => {
    expect(euclideanDistance([1, 2], [4, 6])).toBeCloseTo(euclideanDistance([4, 6], [1, 2]));
  });
});

describe('angularDistance', () => {
  it('returns 0 for identical vectors', () => {
    expect(angularDistance([1, 0], [1, 0])).toBeCloseTo(0);
  });

  it('returns PI for opposite vectors', () => {
    expect(angularDistance([1, 0], [-1, 0])).toBeCloseTo(Math.PI);
  });

  it('returns PI/2 for orthogonal vectors', () => {
    expect(angularDistance([1, 0], [0, 1])).toBeCloseTo(Math.PI / 2);
  });
});

describe('agglomerativeClustering', () => {
  it('returns empty for empty input', () => {
    expect(agglomerativeClustering([])).toEqual([]);
  });

  it('returns empty for null', () => {
    expect(agglomerativeClustering(null as any)).toEqual([]);
  });

  it('assigns single embedding to cluster 0', () => {
    const result = agglomerativeClustering([[1, 2, 3]]);
    expect(result).toEqual([0]);
  });

  it('separates distant embeddings', () => {
    const result = agglomerativeClustering(
      [[1, 0, 0], [1, 0.1, 0], [0, 0, 1], [0, 0.1, 1]],
      0.8,
      'cosine',
    );
    expect(result[0]).toBe(result[1]);
    expect(result[2]).toBe(result[3]);
  });

  it('handles euclidean metric', () => {
    const result = agglomerativeClustering(
      [[0, 0], [0.1, 0], [100, 100]],
      10,
      'euclidean',
    );
    expect(result[0]).toBe(result[1]);
    expect(result[2]).not.toBe(result[0]);
  });

  it('handles angular metric', () => {
    const result = agglomerativeClustering(
      [[1, 0], [0.9, 0.1], [0, 1]],
      0.5,
      'angular',
    );
    expect(result).toHaveLength(3);
  });
});

describe('kMeansClustering', () => {
  it('returns empty for empty input', () => {
    expect(kMeansClustering([], 2)).toEqual([]);
  });

  it('returns empty for null', () => {
    expect(kMeansClustering(null as any, 2)).toEqual([]);
  });

  it('returns empty for k=0', () => {
    expect(kMeansClustering([[1, 2]], 0)).toEqual([]);
  });

  it('assigns single point to cluster 0', () => {
    expect(kMeansClustering([[1, 2]], 3)).toEqual([0]);
  });

  it('clusters points', () => {
    const result = kMeansClustering(
      [[0, 0], [0.1, 0.1], [10, 10], [10.1, 10.1]],
      2,
    );
    expect(result[0]).toBe(result[1]);
    expect(result[2]).toBe(result[3]);
    expect(result[0]).not.toBe(result[2]);
  });

  it('adjusts k when k > n', () => {
    const result = kMeansClustering([[1, 2], [3, 4]], 10);
    expect(result).toHaveLength(2);
  });
});

// ==================== diarizeFromEmbeddings ====================

describe('diarizeFromEmbeddings', () => {
  it('returns empty result for empty input', () => {
    const result = diarizeFromEmbeddings([]);
    expect(result.segments).toEqual([]);
  });

  it('clusters embeddings into speakers', () => {
    const embeddings = [
      { startMs: 0, endMs: 1000, embedding: [1, 0, 0] },
      { startMs: 1000, endMs: 2000, embedding: [0.9, 0.1, 0] },
      { startMs: 2000, endMs: 3000, embedding: [0, 0, 1] },
      { startMs: 3000, endMs: 4000, embedding: [0.1, 0, 0.9] },
    ];
    const result = diarizeFromEmbeddings(embeddings);
    expect(result.segments.length).toBeGreaterThan(0);
    expect(result.speakers.length).toBeGreaterThan(0);
  });

  it('handles single embedding', () => {
    const result = diarizeFromEmbeddings([{ startMs: 0, endMs: 1000, embedding: [1, 2, 3] }]);
    expect(result.segments).toHaveLength(1);
  });
});

// ==================== applySpeakerLabelsToTranscription ====================

describe('applySpeakerLabelsToTranscription', () => {
  it('returns original when diarization is empty', () => {
    const segments = [{ startMs: 0, endMs: 1000, text: 'Hello' }];
    const result = applySpeakerLabelsToTranscription(segments, {
      segments: [],
      speakers: [],
      durationMs: 0,
      stats: { speakerCount: 0, avgConfidence: 0, maxMonologueMs: 0, speakerSwitches: 0 },
    });
    expect(result).toEqual(segments);
  });

  it('returns original when transcription is null', () => {
    const result = applySpeakerLabelsToTranscription(null as any, {
      segments: [],
      speakers: [],
      durationMs: 0,
      stats: { speakerCount: 0, avgConfidence: 0, maxMonologueMs: 0, speakerSwitches: 0 },
    });
    expect(result).toBeNull();
  });
});

// ==================== getSpeakerBasedAngleSwitches ====================

describe('getSpeakerBasedAngleSwitches', () => {
  it('returns empty for empty input', () => {
    const result = getSpeakerBasedAngleSwitches([], new Map());
    expect(result).toEqual([]);
  });

  it('detects speaker changes', () => {
    const segments = [
      { speakerId: 0, startMs: 0, endMs: 1000, confidence: 0.9, speakerLabel: 'A' },
      { speakerId: 1, startMs: 2000, endMs: 3000, confidence: 0.9, speakerLabel: 'B' },
      { speakerId: 0, startMs: 4000, endMs: 5000, confidence: 0.9, speakerLabel: 'A' },
    ];
    const mapping = new Map([[0, 0], [1, 90]]);
    const result = getSpeakerBasedAngleSwitches(segments, mapping);
    expect(result.length).toBe(3);
  });

  it('skips speakers not in mapping', () => {
    const segments = [
      { speakerId: 0, startMs: 0, endMs: 1000, confidence: 0.9, speakerLabel: 'A' },
      { speakerId: 99, startMs: 2000, endMs: 3000, confidence: 0.9, speakerLabel: 'B' },
    ];
    const mapping = new Map([[0, 0]]);
    const result = getSpeakerBasedAngleSwitches(segments, mapping);
    expect(result.length).toBe(1);
  });

  it('respects minSwitchIntervalMs', () => {
    const segments = [
      { speakerId: 0, startMs: 0, endMs: 1000, confidence: 0.9, speakerLabel: 'A' },
      { speakerId: 1, startMs: 500, endMs: 1500, confidence: 0.9, speakerLabel: 'B' },
    ];
    const mapping = new Map([[0, 0], [1, 90]]);
    const result = getSpeakerBasedAngleSwitches(segments, mapping, 2000);
    expect(result.length).toBe(1);
  });
});

// ==================== extractSpeakerLabelsFromText ====================

describe('extractSpeakerLabelsFromText', () => {
  it('extracts labels from bracket format', () => {
    const text = '[Speaker A] Hello\n[Speaker B] World';
    const result = extractSpeakerLabelsFromText(text);
    expect(result.length).toBe(2);
  });

  it('extracts labels from colon format', () => {
    const text = 'Speaker A: Hello\nSpeaker B: World';
    const result = extractSpeakerLabelsFromText(text);
    expect(result.length).toBe(2);
  });

  it('handles empty text', () => {
    const result = extractSpeakerLabelsFromText('');
    expect(result).toEqual([]);
  });

  it('handles text without speaker labels', () => {
    const result = extractSpeakerLabelsFromText('Just plain text');
    expect(result).toEqual([]);
  });
});

// ==================== validateDiarizationResult ====================

describe('validateDiarizationResult', () => {
  it('validates correct result', () => {
    const result = validateDiarizationResult({
      segments: [
        { speakerId: 0, startMs: 0, endMs: 1000, confidence: 0.9, speakerLabel: 'Speaker 0' },
      ],
      speakers: [{ speakerId: 0, speakerLabel: 'Speaker 0', embedding: [1, 0, 0], confidence: 0.9, sampleCount: 10 }],
      durationMs: 1000,
      stats: { speakerCount: 1, avgConfidence: 0.9, maxMonologueMs: 1000, speakerSwitches: 0 },
    });
    expect(Array.isArray(result)).toBe(true);
  });

  it('detects too many speakers', () => {
    const result = validateDiarizationResult({
      segments: [],
      speakers: [],
      durationMs: 0,
      stats: { speakerCount: 20, avgConfidence: 0.9, maxMonologueMs: 0, speakerSwitches: 0 },
    }, 0.5, 100, 5);
    expect(result.some(i => i.type === 'too-many-speakers')).toBe(true);
  });

  it('detects invalid time', () => {
    const result = validateDiarizationResult({
      segments: [
        { speakerId: 0, startMs: -1, endMs: 1000, confidence: 0.9, speakerLabel: 'Speaker 0' },
      ],
      speakers: [],
      durationMs: 1000,
      stats: { speakerCount: 1, avgConfidence: 0.9, maxMonologueMs: 1000, speakerSwitches: 0 },
    });
    expect(result.some(i => i.type === 'invalid-time')).toBe(true);
  });

  it('detects low confidence', () => {
    const result = validateDiarizationResult({
      segments: [
        { speakerId: 0, startMs: 0, endMs: 1000, confidence: 0.1, speakerLabel: 'Speaker 0' },
      ],
      speakers: [],
      durationMs: 1000,
      stats: { speakerCount: 1, avgConfidence: 0.1, maxMonologueMs: 1000, speakerSwitches: 0 },
    });
    expect(result.some(i => i.type === 'low-confidence')).toBe(true);
  });

  it('detects short segment', () => {
    const result = validateDiarizationResult({
      segments: [
        { speakerId: 0, startMs: 0, endMs: 50, confidence: 0.9, speakerLabel: 'Speaker 0' },
      ],
      speakers: [],
      durationMs: 50,
      stats: { speakerCount: 1, avgConfidence: 0.9, maxMonologueMs: 50, speakerSwitches: 0 },
    }, 0.5, 100);
    expect(result.some(i => i.type === 'short-segment')).toBe(true);
  });

  it('detects overlap', () => {
    const result = validateDiarizationResult({
      segments: [
        { speakerId: 0, startMs: 0, endMs: 1000, confidence: 0.9, speakerLabel: 'Speaker 0' },
        { speakerId: 1, startMs: 500, endMs: 1500, confidence: 0.9, speakerLabel: 'Speaker 1' },
      ],
      speakers: [],
      durationMs: 1500,
      stats: { speakerCount: 2, avgConfidence: 0.9, maxMonologueMs: 1000, speakerSwitches: 1 },
    });
    expect(result.some(i => i.type === 'overlap')).toBe(true);
  });
});

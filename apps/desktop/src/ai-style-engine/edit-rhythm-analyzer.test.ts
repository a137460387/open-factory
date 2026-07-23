import { describe, it, expect } from 'vitest';
import {
  parseEDLEntries,
  calculateShotDurationStats,
  calculateTransitionDistribution,
  analyzeRhythmPattern,
  calculateEditingPace,
  calculateRhythmConsistency,
  generateStyleVector,
  analyzeEditingStyle,
  compareEditingStyles,
  type EditDecisionEntry,
  type EditingRhythmProfile,
} from './edit-rhythm-analyzer';

// ==================== Test Helpers ====================

function makeEntry(overrides: Partial<EditDecisionEntry> = {}): EditDecisionEntry {
  return {
    startTime: 0,
    endTime: 5,
    duration: 5,
    mediaId: 'media-1',
    trackId: 'track-1',
    ...overrides,
  };
}

function makeTimeline(clips: Array<{ start: number; duration: number; mediaId?: string; transition?: { type: string } }>) {
  return {
    tracks: [
      {
        id: 'track-1',
        clips: clips.map((c, i) => ({
          start: c.start,
          duration: c.duration,
          mediaId: c.mediaId ?? `media-${i}`,
          transition: c.transition,
        })),
      },
    ],
  };
}

// ==================== parseEDLEntries ====================

describe('parseEDLEntries', () => {
  it('returns empty array for null/undefined timeline', () => {
    expect(parseEDLEntries(null)).toEqual([]);
    expect(parseEDLEntries(undefined)).toEqual([]);
    expect(parseEDLEntries({})).toEqual([]);
  });

  it('parses clips from timeline tracks', () => {
    const timeline = makeTimeline([
      { start: 0, duration: 3 },
      { start: 3, duration: 5 },
    ]);
    const entries = parseEDLEntries(timeline);
    expect(entries).toHaveLength(2);
    expect(entries[0].startTime).toBe(0);
    expect(entries[0].duration).toBe(3);
    expect(entries[1].startTime).toBe(3);
    expect(entries[1].duration).toBe(5);
  });

  it('sorts entries by start time', () => {
    const timeline = makeTimeline([
      { start: 10, duration: 2 },
      { start: 0, duration: 5 },
    ]);
    const entries = parseEDLEntries(timeline);
    expect(entries[0].startTime).toBe(0);
    expect(entries[1].startTime).toBe(10);
  });

  it('extracts transition type', () => {
    const timeline = makeTimeline([
      { start: 0, duration: 3, transition: { type: 'cross-dissolve' } },
    ]);
    const entries = parseEDLEntries(timeline);
    expect(entries[0].transitionType).toBe('cross-dissolve');
  });
});

// ==================== calculateShotDurationStats ====================

describe('calculateShotDurationStats', () => {
  it('returns zeros for empty entries', () => {
    const stats = calculateShotDurationStats([]);
    expect(stats.avg).toBe(0);
    expect(stats.median).toBe(0);
  });

  it('calculates correct average duration', () => {
    const entries = [makeEntry({ duration: 2 }), makeEntry({ duration: 4 }), makeEntry({ duration: 6 })];
    const stats = calculateShotDurationStats(entries);
    expect(stats.avg).toBe(4);
  });

  it('calculates correct median for odd count', () => {
    const entries = [makeEntry({ duration: 1 }), makeEntry({ duration: 5 }), makeEntry({ duration: 3 })];
    const stats = calculateShotDurationStats(entries);
    expect(stats.median).toBe(3);
  });

  it('calculates correct median for even count', () => {
    const entries = [makeEntry({ duration: 1 }), makeEntry({ duration: 3 })];
    const stats = calculateShotDurationStats(entries);
    expect(stats.median).toBe(2);
  });

  it('classifies short/medium/long shots', () => {
    const entries = [
      makeEntry({ duration: 1 }),   // short
      makeEntry({ duration: 1.5 }), // short
      makeEntry({ duration: 5 }),   // medium
      makeEntry({ duration: 15 }),  // long
    ];
    const stats = calculateShotDurationStats(entries);
    expect(stats.shortRatio).toBe(0.5);
    expect(stats.mediumRatio).toBe(0.25);
    expect(stats.longRatio).toBe(0.25);
  });
});

// ==================== calculateTransitionDistribution ====================

describe('calculateTransitionDistribution', () => {
  it('returns empty object when no transitions', () => {
    const entries = [makeEntry(), makeEntry()];
    expect(calculateTransitionDistribution(entries)).toEqual({});
  });

  it('calculates normalized distribution', () => {
    const entries = [
      makeEntry({ transitionType: 'hard-cut' }),
      makeEntry({ transitionType: 'hard-cut' }),
      makeEntry({ transitionType: 'cross-dissolve' }),
    ];
    const dist = calculateTransitionDistribution(entries);
    expect(dist['hard-cut']).toBeCloseTo(2 / 3);
    expect(dist['cross-dissolve']).toBeCloseTo(1 / 3);
  });
});

// ==================== analyzeRhythmPattern ====================

describe('analyzeRhythmPattern', () => {
  it('returns irregular for fewer than 3 entries', () => {
    expect(analyzeRhythmPattern([]).type).toBe('irregular');
    expect(analyzeRhythmPattern([makeEntry()]).type).toBe('irregular');
  });

  it('detects steady rhythm', () => {
    // Regular 2-second intervals
    const entries = [
      makeEntry({ startTime: 0 }),
      makeEntry({ startTime: 2 }),
      makeEntry({ startTime: 4 }),
      makeEntry({ startTime: 6 }),
      makeEntry({ startTime: 8 }),
    ];
    const pattern = analyzeRhythmPattern(entries);
    expect(pattern.type).toBe('steady');
    expect(pattern.avgInterval).toBeCloseTo(2);
  });

  it('detects accelerating rhythm', () => {
    const entries = [
      makeEntry({ startTime: 0 }),
      makeEntry({ startTime: 5 }),
      makeEntry({ startTime: 8 }),
      makeEntry({ startTime: 10 }),
      makeEntry({ startTime: 11 }),
      makeEntry({ startTime: 11.5 }),
    ];
    const pattern = analyzeRhythmPattern(entries);
    expect(pattern.type).toBe('accelerating');
  });
});

// ==================== calculateEditingPace ====================

describe('calculateEditingPace', () => {
  it('returns 0 for fewer than 2 entries', () => {
    expect(calculateEditingPace([])).toBe(0);
    expect(calculateEditingPace([makeEntry()])).toBe(0);
  });

  it('calculates cuts per minute', () => {
    const entries = [
      makeEntry({ startTime: 0, endTime: 10 }),
      makeEntry({ startTime: 10, endTime: 20 }),
      makeEntry({ startTime: 20, endTime: 30 }),
      makeEntry({ startTime: 30, endTime: 40 }),
      makeEntry({ startTime: 40, endTime: 60 }),
    ];
    // 4 cuts in 60 seconds = 4 cuts/min
    expect(calculateEditingPace(entries)).toBeCloseTo(4);
  });
});

// ==================== calculateRhythmConsistency ====================

describe('calculateRhythmConsistency', () => {
  it('returns 0 for fewer than 3 entries', () => {
    expect(calculateRhythmConsistency([])).toBe(0);
  });

  it('returns high consistency for regular intervals', () => {
    const entries = [
      makeEntry({ startTime: 0 }),
      makeEntry({ startTime: 2 }),
      makeEntry({ startTime: 4 }),
      makeEntry({ startTime: 6 }),
    ];
    const consistency = calculateRhythmConsistency(entries);
    expect(consistency).toBeCloseTo(1.0);
  });

  it('returns low consistency for irregular intervals', () => {
    const entries = [
      makeEntry({ startTime: 0 }),
      makeEntry({ startTime: 1 }),
      makeEntry({ startTime: 10 }),
      makeEntry({ startTime: 11 }),
    ];
    const consistency = calculateRhythmConsistency(entries);
    expect(consistency).toBeLessThan(0.5);
  });
});

// ==================== generateStyleVector ====================

describe('generateStyleVector', () => {
  it('generates 128-dimensional vector', () => {
    const profile: EditingRhythmProfile = {
      avgShotDuration: 3,
      medianShotDuration: 2.5,
      shotDurationStdDev: 1.2,
      shortShotRatio: 0.3,
      mediumShotRatio: 0.5,
      longShotRatio: 0.2,
      editingPace: 20,
      rhythmConsistency: 0.8,
      transitionDistribution: { 'hard-cut': 0.7, 'cross-dissolve': 0.3 },
      highlightRhythmPattern: { type: 'steady', confidence: 0.9, avgInterval: 2, intervalVariance: 0.1 },
    };
    const sv = generateStyleVector(profile);
    expect(sv.vector).toHaveLength(128);
    expect(sv.dimensions).toHaveLength(16);
    expect(sv.confidence).toHaveLength(128);
  });

  it('normalizes values to 0-1 range', () => {
    const profile: EditingRhythmProfile = {
      avgShotDuration: 15,
      medianShotDuration: 15,
      shotDurationStdDev: 7.5,
      shortShotRatio: 0,
      mediumShotRatio: 1,
      longShotRatio: 0,
      editingPace: 60,
      rhythmConsistency: 1,
      transitionDistribution: {},
      highlightRhythmPattern: { type: 'irregular', confidence: 0, avgInterval: 0, intervalVariance: 0 },
    };
    const sv = generateStyleVector(profile);
    // avgShotDuration normalized: (15-0)/30 = 0.5
    expect(sv.vector[0]).toBeCloseTo(0.5);
    // editingPace normalized: (60-0)/120 = 0.5
    expect(sv.vector[6]).toBeCloseTo(0.5);
  });
});

// ==================== analyzeEditingStyle ====================

describe('analyzeEditingStyle', () => {
  it('returns zero profile for empty timeline', () => {
    const result = analyzeEditingStyle(null);
    expect(result.rhythmProfile.avgShotDuration).toBe(0);
    expect(result.stats.totalClips).toBe(0);
    expect(result.styleVector.vector).toHaveLength(128);
  });

  it('produces full analysis for real timeline', () => {
    const timeline = makeTimeline([
      { start: 0, duration: 2 },
      { start: 2, duration: 3 },
      { start: 5, duration: 1.5 },
      { start: 6.5, duration: 4 },
      { start: 10.5, duration: 2.5 },
    ]);
    const result = analyzeEditingStyle(timeline);
    expect(result.stats.totalClips).toBe(5);
    expect(result.rhythmProfile.avgShotDuration).toBeCloseTo(2.6);
    expect(result.rhythmProfile.editingPace).toBeGreaterThan(0);
    expect(result.styleVector.vector).toHaveLength(128);
  });
});

// ==================== compareEditingStyles ====================

describe('compareEditingStyles', () => {
  it('returns 0 for vectors of different lengths', () => {
    const s1 = { vector: [1, 0], dimensions: [], confidence: [] };
    const s2 = { vector: [1, 0, 0], dimensions: [], confidence: [] };
    expect(compareEditingStyles(s1, s2)).toBe(0);
  });

  it('returns 1 for identical vectors', () => {
    const v = new Array(128).fill(0.5);
    const s1 = { vector: v, dimensions: [], confidence: [] };
    expect(compareEditingStyles(s1, s1)).toBeCloseTo(1);
  });

  it('returns 0 for orthogonal vectors', () => {
    const v1 = new Array(128).fill(0);
    v1[0] = 1;
    const v2 = new Array(128).fill(0);
    v2[1] = 1;
    const s1 = { vector: v1, dimensions: [], confidence: [] };
    const s2 = { vector: v2, dimensions: [], confidence: [] };
    expect(compareEditingStyles(s1, s2)).toBeCloseTo(0);
  });

  it('returns 0 for zero vector', () => {
    const v = new Array(128).fill(0);
    expect(compareEditingStyles({ vector: v, dimensions: [], confidence: [] }, { vector: v, dimensions: [], confidence: [] })).toBe(0);
  });
});

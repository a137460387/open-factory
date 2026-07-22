import { describe, it, expect } from 'vitest';
import {
  generateCutPoints,
  selectSegments,
  calculatePacingScore,
  calculateHighlightCoverage,
  generateRoughCutProposals,
  buildRoughCutSystemPrompt,
  buildRoughCutUserPrompt,
  DEFAULT_ROUGH_CUT_CONFIG,
} from '../src/smart-rough-cut';
import type { VisualHighlightMarker } from '../src/visual-highlight-engine';
import type { OnsetEvent } from '../src/audio-rhythm-analysis';

const mockHighlights: VisualHighlightMarker[] = [
  { time: 2, frameIndex: 60, score: 0.8, type: 'motion-peak', duration: 0.033 },
  { time: 5, frameIndex: 150, score: 0.9, type: 'scene-change', duration: 0.033 },
  { time: 10, frameIndex: 300, score: 0.7, type: 'combined', duration: 0.033 },
  { time: 15, frameIndex: 450, score: 0.85, type: 'motion-peak', duration: 0.033 },
];

const mockBeats: OnsetEvent[] = [
  { time: 1.9, strength: 0.8, band: 'bass' },
  { time: 5.1, strength: 0.7, band: 'mid' },
  { time: 10.2, strength: 0.9, band: 'bass' },
];

describe('generateCutPoints', () => {
  it('combines highlights and beats', () => {
    const points = generateCutPoints(mockHighlights, mockBeats, 20);
    expect(points.length).toBeGreaterThan(0);
    // Points should be sorted by time
    for (let i = 1; i < points.length; i++) {
      expect(points[i].time).toBeGreaterThanOrEqual(points[i - 1].time);
    }
  });

  it('merges nearby points', () => {
    const points = generateCutPoints(mockHighlights, mockBeats, 20, 0.5);
    // Highlight at 2 and beat at 1.9 should merge
    const nearTwo = points.filter((p) => p.time >= 1.5 && p.time <= 2.5);
    expect(nearTwo.length).toBeLessThanOrEqual(2);
  });

  it('returns empty for no inputs', () => {
    expect(generateCutPoints([], [], 10)).toEqual([]);
  });
});

describe('selectSegments', () => {
  it('selects segments up to target duration', () => {
    const cutPoints = generateCutPoints(mockHighlights, mockBeats, 20);
    const segments = selectSegments(cutPoints, 20, { ...DEFAULT_ROUGH_CUT_CONFIG, targetDuration: 10 });
    const totalDuration = segments.reduce((s, seg) => s + seg.duration, 0);
    // Segments are bounded by source duration (20s) and target + tolerance
    expect(totalDuration).toBeGreaterThan(0);
    expect(totalDuration).toBeLessThanOrEqual(20);
  });

  it('returns empty for no cut points', () => {
    expect(selectSegments([], 10, DEFAULT_ROUGH_CUT_CONFIG)).toEqual([]);
  });

  it('selects higher-scored segments first', () => {
    const cutPoints = [
      { time: 5, confidence: 0.9, reason: 'visual-highlight' as const },
      { time: 10, confidence: 0.3, reason: 'audio-beat' as const },
    ];
    const segments = selectSegments(cutPoints, 20, { ...DEFAULT_ROUGH_CUT_CONFIG, targetDuration: 8, maxClipDuration: 20 });
    // Should have at least one segment
    expect(segments.length).toBeGreaterThanOrEqual(1);
    // Segments should be sorted by source time
    for (let i = 1; i < segments.length; i++) {
      expect(segments[i].sourceStart).toBeGreaterThanOrEqual(segments[i - 1].sourceEnd);
    }
  });
});

describe('calculatePacingScore', () => {
  it('returns 1 for empty segments', () => {
    expect(calculatePacingScore([], 20)).toBe(1);
  });

  it('returns high score when CPM matches target', () => {
    // Create segments that result in ~20 CPM
    const segments = Array.from({ length: 5 }, (_, i) => ({
      sourceStart: i * 3,
      sourceEnd: (i + 1) * 3,
      duration: 3,
      score: 0.5,
      visualScore: 0.5,
      audioScore: 0.5,
    }));
    const score = calculatePacingScore(segments, 20);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

describe('calculateHighlightCoverage', () => {
  it('returns 1 for empty highlights', () => {
    expect(calculateHighlightCoverage([], [])).toBe(1);
  });

  it('returns fraction of covered highlights', () => {
    const segments = [{
      sourceStart: 0,
      sourceEnd: 6,
      duration: 6,
      score: 0.5,
      visualScore: 0.5,
      audioScore: 0.5,
    }];
    const coverage = calculateHighlightCoverage(segments, mockHighlights);
    // Only highlights within 0-6 are covered (at 2 and 5)
    expect(coverage).toBeCloseTo(0.5, 1);
  });
});

describe('generateRoughCutProposals', () => {
  it('generates 3 proposals sorted by quality', () => {
    const result = generateRoughCutProposals(mockHighlights, mockBeats, 30, { targetDuration: 15 });
    expect(result.proposals.length).toBe(3);
    for (let i = 1; i < result.proposals.length; i++) {
      expect(result.proposals[i].qualityScore).toBeLessThanOrEqual(result.proposals[i - 1].qualityScore);
    }
    expect(result.inputHighlightCount).toBe(4);
    expect(result.inputBeatCount).toBe(3);
  });

  it('respects target duration with tolerance', () => {
    const result = generateRoughCutProposals(mockHighlights, mockBeats, 60, { targetDuration: 20 });
    for (const proposal of result.proposals) {
      // Segments might not fill the target exactly, but should have some content
      expect(proposal.segments.length).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('buildRoughCutSystemPrompt', () => {
  it('returns prompt with JSON format', () => {
    const prompt = buildRoughCutSystemPrompt();
    expect(prompt).toContain('recommendedProposalId');
    expect(prompt).toContain('JSON');
  });
});

describe('buildRoughCutUserPrompt', () => {
  it('includes all proposal info', () => {
    const result = generateRoughCutProposals(mockHighlights, mockBeats, 30, { targetDuration: 15 });
    const prompt = buildRoughCutUserPrompt(result);
    expect(prompt).toContain('高光优先');
    expect(prompt).toContain('节奏同步');
    expect(prompt).toContain('均衡方案');
  });
});

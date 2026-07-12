import { describe, it, expect } from 'vitest';
import { analyzeNarrative } from '../src/ai-narrative-analyzer';
import type { ContentAnalysisSegment, ContentEmotionPoint } from '../src/content-analysis';

function segment(overrides: Partial<ContentAnalysisSegment> = {}): ContentAnalysisSegment {
  return {
    start: 0,
    end: 1,
    sceneTypes: ['indoor'],
    brightness: 0.5,
    motion: 0.2,
    ...overrides,
  };
}

function emotionPoint(overrides: Partial<ContentEmotionPoint> = {}): ContentEmotionPoint {
  return {
    time: 0,
    value: 0.5,
    brightness: 0.5,
    ...overrides,
  };
}

describe('analyzeNarrative', () => {
  it('returns default structure for empty input', () => {
    const result = analyzeNarrative([], []);
    expect(result.structure).toBeDefined();
    expect(result.structure.acts).toBeDefined();
    expect(result.arc).toBeDefined();
    expect(result.arc.points).toBeDefined();
    expect(typeof result.score).toBe('number');
    expect(result.suggestions).toBeDefined();
    expect(Array.isArray(result.suggestions)).toBe(true);
  });

  it('identifies three-act structure with four acts', () => {
    const segments = [
      segment({ start: 0, end: 5, brightness: 0.3, motion: 0.1 }),
      segment({ start: 5, end: 15, brightness: 0.5, motion: 0.3 }),
      segment({ start: 15, end: 25, brightness: 0.8, motion: 0.6 }),
      segment({ start: 25, end: 30, brightness: 0.4, motion: 0.2 }),
    ];
    const curve = [
      emotionPoint({ time: 0, value: 0.2, brightness: 0.3 }),
      emotionPoint({ time: 5, value: 0.4, brightness: 0.4 }),
      emotionPoint({ time: 10, value: 0.6, brightness: 0.5 }),
      emotionPoint({ time: 15, value: 0.9, brightness: 0.8 }),
      emotionPoint({ time: 20, value: 0.7, brightness: 0.6 }),
      emotionPoint({ time: 25, value: 0.3, brightness: 0.4 }),
      emotionPoint({ time: 30, value: 0.2, brightness: 0.3 }),
    ];

    const result = analyzeNarrative(segments, curve);
    expect(result.structure.acts).toHaveLength(4);
    expect(result.structure.acts.map((a) => a.label)).toEqual([
      'setup',
      'development',
      'climax',
      'resolution',
    ]);
  });

  it('generates narrative arc with points matching curve length', () => {
    const segments = [
      segment({ start: 0, end: 10, brightness: 0.5 }),
      segment({ start: 10, end: 20, brightness: 0.7 }),
    ];
    const curve = [
      emotionPoint({ time: 0, value: 0.3 }),
      emotionPoint({ time: 5, value: 0.5 }),
      emotionPoint({ time: 10, value: 0.8 }),
      emotionPoint({ time: 15, value: 0.6 }),
      emotionPoint({ time: 20, value: 0.3 }),
    ];

    const result = analyzeNarrative(segments, curve);
    expect(result.arc.points).toHaveLength(curve.length);
    result.arc.points.forEach((point) => {
      expect(point).toHaveProperty('time');
      expect(point).toHaveProperty('tension');
      expect(point).toHaveProperty('act');
      expect(['setup', 'development', 'climax', 'resolution']).toContain(point.act);
    });
  });

  it('computes narrative score between 0 and 100', () => {
    const segments = [
      segment({ start: 0, end: 5, brightness: 0.3, motion: 0.1 }),
      segment({ start: 5, end: 15, brightness: 0.5, motion: 0.3 }),
      segment({ start: 15, end: 25, brightness: 0.8, motion: 0.6 }),
      segment({ start: 25, end: 30, brightness: 0.4, motion: 0.2 }),
    ];
    const curve = [
      emotionPoint({ time: 0, value: 0.2 }),
      emotionPoint({ time: 5, value: 0.4 }),
      emotionPoint({ time: 10, value: 0.6 }),
      emotionPoint({ time: 15, value: 0.9 }),
      emotionPoint({ time: 20, value: 0.7 }),
      emotionPoint({ time: 25, value: 0.3 }),
      emotionPoint({ time: 30, value: 0.2 }),
    ];

    const result = analyzeNarrative(segments, curve);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('generates narrative suggestions', () => {
    const segments = [
      segment({ start: 0, end: 10, brightness: 0.5, motion: 0.2 }),
      segment({ start: 10, end: 20, brightness: 0.6, motion: 0.3 }),
      segment({ start: 20, end: 30, brightness: 0.7, motion: 0.4 }),
      segment({ start: 30, end: 40, brightness: 0.3, motion: 0.1 }),
    ];
    const curve = [
      emotionPoint({ time: 0, value: 0.2 }),
      emotionPoint({ time: 10, value: 0.5 }),
      emotionPoint({ time: 20, value: 0.8 }),
      emotionPoint({ time: 30, value: 0.9 }),
      emotionPoint({ time: 40, value: 0.2 }),
    ];

    const result = analyzeNarrative(segments, curve);
    expect(result.suggestions.length).toBeGreaterThan(0);
    result.suggestions.forEach((s) => {
      expect(['pacing', 'structure', 'emotion', 'engagement']).toContain(s.category);
      expect(['info', 'warning', 'critical']).toContain(s.severity);
      expect(typeof s.message).toBe('string');
      expect(s.message.length).toBeGreaterThan(0);
    });
  });

  it('uses fallback segments when only emotion curve is provided', () => {
    const curve = [
      emotionPoint({ time: 0, value: 0.3, brightness: 0.4 }),
      emotionPoint({ time: 5, value: 0.7, brightness: 0.6 }),
      emotionPoint({ time: 10, value: 0.5, brightness: 0.5 }),
    ];

    const result = analyzeNarrative([], curve);
    expect(result.structure.acts).toHaveLength(4);
    expect(result.arc.points).toHaveLength(curve.length);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it('uses fallback emotion curve when only segments are provided', () => {
    const segments = [
      segment({ start: 0, end: 5, brightness: 0.3, motion: 0.1 }),
      segment({ start: 5, end: 10, brightness: 0.7, motion: 0.4 }),
    ];

    const result = analyzeNarrative(segments, []);
    expect(result.structure.acts).toHaveLength(4);
    expect(result.arc.points.length).toBeGreaterThan(0);
  });

  it('identifies peak and trough indices', () => {
    const segments = [
      segment({ start: 0, end: 30, brightness: 0.5 }),
    ];
    const curve = [
      emotionPoint({ time: 0, value: 0.3 }),
      emotionPoint({ time: 5, value: 0.1 }),
      emotionPoint({ time: 10, value: 0.8 }),
      emotionPoint({ time: 15, value: 0.9 }),
      emotionPoint({ time: 20, value: 0.2 }),
      emotionPoint({ time: 25, value: 0.4 }),
      emotionPoint({ time: 30, value: 0.3 }),
    ];

    const result = analyzeNarrative(segments, curve);
    expect(result.structure.peakIndex).toBe(3); // value 0.9 at index 3
    expect(result.structure.troughIndex).toBe(1); // value 0.1 at index 1
  });

  it('assigns act labels to arc points', () => {
    const segments = [
      segment({ start: 0, end: 5, brightness: 0.3 }),
      segment({ start: 5, end: 15, brightness: 0.6 }),
      segment({ start: 15, end: 25, brightness: 0.9 }),
      segment({ start: 25, end: 30, brightness: 0.3 }),
    ];
    const curve = [
      emotionPoint({ time: 0, value: 0.2 }),
      emotionPoint({ time: 5, value: 0.5 }),
      emotionPoint({ time: 10, value: 0.7 }),
      emotionPoint({ time: 15, value: 0.9 }),
      emotionPoint({ time: 20, value: 0.6 }),
      emotionPoint({ time: 25, value: 0.3 }),
      emotionPoint({ time: 30, value: 0.2 }),
    ];

    const result = analyzeNarrative(segments, curve);
    const acts = result.arc.points.map((p) => p.act);
    // Should contain at least setup and resolution
    expect(acts[0]).toBe('setup');
    expect(acts[acts.length - 1]).toBe('resolution');
  });

  it('handles flat emotion curve gracefully', () => {
    const segments = [
      segment({ start: 0, end: 10, brightness: 0.5, motion: 0.2 }),
      segment({ start: 10, end: 20, brightness: 0.5, motion: 0.2 }),
    ];
    const curve = [
      emotionPoint({ time: 0, value: 0.5 }),
      emotionPoint({ time: 5, value: 0.5 }),
      emotionPoint({ time: 10, value: 0.5 }),
      emotionPoint({ time: 15, value: 0.5 }),
      emotionPoint({ time: 20, value: 0.5 }),
    ];

    const result = analyzeNarrative(segments, curve);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.suggestions.length).toBeGreaterThan(0);
    // Flat curve should trigger an emotion-related suggestion
    const emotionSuggestions = result.suggestions.filter((s) => s.category === 'emotion');
    expect(emotionSuggestions.length).toBeGreaterThan(0);
  });
});

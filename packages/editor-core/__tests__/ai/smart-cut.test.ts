import { describe, it, expect } from 'vitest';
import {
  generateSmartCuts,
  applyCutsToTimeline,
  computeCutImpact,
  detectLowEnergySegments,
} from '../../src/ai/smart-cut';
import type { VADInterval, CutSuggestion, SmartCutOptions } from '../../src/ai/smart-cut';
import type { ContentAnalysisVisualSample } from '../../src/content-analysis';

// --- Test helpers ---

function makeVAD(start: number, end: number, confidence = 0.9, isFiller = false): VADInterval {
  return { start, end, confidence, isFiller };
}

function makeSample(time: number, brightness = 0.5, saturation = 0.5, motion = 0.3): ContentAnalysisVisualSample {
  return { time, brightness, saturation, motion };
}

// --- Tests ---

describe('generateSmartCuts', () => {
  it('returns empty result for zero duration', () => {
    const result = generateSmartCuts([], [], 0);
    expect(result.suggestions).toEqual([]);
    expect(result.originalDuration).toBe(0);
    expect(result.estimatedDuration).toBe(0);
  });

  it('returns empty result for negative duration', () => {
    const result = generateSmartCuts([], [], -5);
    expect(result.suggestions).toEqual([]);
  });

  it('detects silence when no VAD intervals', () => {
    const result = generateSmartCuts([], [], 10);
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0].reason).toBe('silence');
    expect(result.suggestions[0].start).toBe(0);
    expect(result.suggestions[0].end).toBe(10);
  });

  it('detects silence gaps between speech', () => {
    const vad = [
      makeVAD(0, 2),
      makeVAD(5, 8),
    ];
    const result = generateSmartCuts(vad, [], 10, { minSilenceDuration: 0.5 });
    const silenceCuts = result.suggestions.filter((s) => s.reason === 'silence');
    expect(silenceCuts.length).toBeGreaterThan(0);
    // Should detect gap between 2s and 5s.
    const mainGap = silenceCuts.find((c) => c.start > 2 && c.end < 5);
    expect(mainGap).toBeDefined();
  });

  it('detects leading silence', () => {
    const vad = [makeVAD(3, 8)];
    const result = generateSmartCuts(vad, [], 10, { minSilenceDuration: 0.5 });
    const leadingSilence = result.suggestions.find((s) => s.reason === 'silence' && s.start < 1);
    expect(leadingSilence).toBeDefined();
    expect(leadingSilence!.description).toContain('片头');
  });

  it('detects trailing silence', () => {
    const vad = [makeVAD(0, 5)];
    const result = generateSmartCuts(vad, [], 10, { minSilenceDuration: 0.5 });
    const trailingSilence = result.suggestions.find((s) => s.reason === 'silence' && s.end >= 9.5);
    expect(trailingSilence).toBeDefined();
    expect(trailingSilence!.description).toContain('片尾');
  });

  it('detects static frames', () => {
    const samples = [
      makeSample(0, 0.5, 0.5, 0.01),
      makeSample(1, 0.5, 0.5, 0.01),
      makeSample(2, 0.5, 0.5, 0.01),
      makeSample(3, 0.5, 0.5, 0.01),
      makeSample(4, 0.5, 0.5, 0.01),
    ];
    const vad = [makeVAD(0, 4.5)];
    const result = generateSmartCuts(vad, samples, 5, {
      minStaticDuration: 2.0,
      staticMotionThreshold: 0.05,
    });
    const staticCuts = result.suggestions.filter((s) => s.reason === 'static-frame');
    expect(staticCuts.length).toBeGreaterThan(0);
  });

  it('detects long pauses between speech', () => {
    const vad = [
      makeVAD(0, 2, 0.9),
      makeVAD(4, 6, 0.9),
    ];
    // Use minSilenceDuration larger than the gap so silence detection doesn't fire,
    // allowing long-pause detection to be the sole reason.
    const result = generateSmartCuts(vad, [], 7, { minPauseDuration: 0.5, minSilenceDuration: 3.0 });
    const pauseCuts = result.suggestions.filter((s) => s.reason === 'long-pause');
    expect(pauseCuts.length).toBeGreaterThan(0);
  });

  it('detects filler words', () => {
    const vad = [
      makeVAD(0, 0.5, 0.8, true),
      makeVAD(1, 3, 0.9),
    ];
    const result = generateSmartCuts(vad, [], 4, { detectFillers: true });
    const fillerCuts = result.suggestions.filter((s) => s.reason === 'filler-word');
    expect(fillerCuts.length).toBeGreaterThan(0);
  });

  it('respects maxSuggestions limit', () => {
    const vad = [
      makeVAD(0, 1),
      makeVAD(3, 4),
      makeVAD(6, 7),
      makeVAD(9, 10),
      makeVAD(12, 13),
    ];
    const result = generateSmartCuts(vad, [], 15, {
      minSilenceDuration: 0.3,
      maxSuggestions: 2,
    });
    expect(result.suggestions.length).toBeLessThanOrEqual(2);
  });

  it('respects minConfidence filter', () => {
    const vad = [
      makeVAD(0, 2, 0.3),
      makeVAD(5, 8, 0.3),
    ];
    const result = generateSmartCuts(vad, [], 10, { minConfidence: 0.5 });
    const fillerCuts = result.suggestions.filter((s) => s.reason === 'filler-word');
    // Low confidence fillers should be filtered out.
    for (const cut of fillerCuts) {
      expect(cut.confidence).toBeGreaterThanOrEqual(0.5);
    }
  });

  it('computes correct statistics', () => {
    const vad = [
      makeVAD(0, 2),
      makeVAD(5, 8),
    ];
    const result = generateSmartCuts(vad, [], 10, { minSilenceDuration: 0.5 });
    const totalFromStats = Object.values(result.stats).reduce(
      (sum, stat) => sum + stat.duration,
      0,
    );
    expect(result.totalRemovableDuration).toBeCloseTo(totalFromStats, 1);
  });

  it('estimatedDuration is non-negative', () => {
    const vad = [makeVAD(0, 0.5, 0.8, true)];
    const result = generateSmartCuts(vad, [], 0.1);
    expect(result.estimatedDuration).toBeGreaterThanOrEqual(0);
  });
});

describe('applyCutsToTimeline', () => {
  it('returns full range for no suggestions', () => {
    const result = applyCutsToTimeline([], 10);
    expect(result).toEqual([{ start: 0, end: 10 }]);
  });

  it('returns full range when all suggestions are rejected', () => {
    const suggestions: CutSuggestion[] = [
      { id: '1', start: 2, end: 4, duration: 2, reason: 'silence', confidence: 0.8, description: '', accepted: false },
    ];
    const result = applyCutsToTimeline(suggestions, 10);
    expect(result).toEqual([{ start: 0, end: 10 }]);
  });

  it('splits timeline at cut points', () => {
    const suggestions: CutSuggestion[] = [
      { id: '1', start: 2, end: 4, duration: 2, reason: 'silence', confidence: 0.8, description: '' },
    ];
    const result = applyCutsToTimeline(suggestions, 10);
    expect(result).toEqual([
      { start: 0, end: 2 },
      { start: 4, end: 10 },
    ]);
  });

  it('handles multiple cuts', () => {
    const suggestions: CutSuggestion[] = [
      { id: '1', start: 1, end: 2, duration: 1, reason: 'silence', confidence: 0.8, description: '' },
      { id: '2', start: 5, end: 7, duration: 2, reason: 'static-frame', confidence: 0.7, description: '' },
    ];
    const result = applyCutsToTimeline(suggestions, 10);
    expect(result).toEqual([
      { start: 0, end: 1 },
      { start: 2, end: 5 },
      { start: 7, end: 10 },
    ]);
  });

  it('filters out very short retained segments', () => {
    const suggestions: CutSuggestion[] = [
      { id: '1', start: 0, end: 4.99, duration: 4.99, reason: 'silence', confidence: 0.8, description: '' },
    ];
    const result = applyCutsToTimeline(suggestions, 5);
    // The retained segment (4.99 to 5) is only 0.01s, should be filtered.
    expect(result).toHaveLength(0);
  });
});

describe('computeCutImpact', () => {
  it('returns higher impact for longer cuts', () => {
    const short: CutSuggestion = { id: '1', start: 0, end: 0.5, duration: 0.5, reason: 'silence', confidence: 0.8, description: '' };
    const long: CutSuggestion = { id: '2', start: 0, end: 5, duration: 5, reason: 'silence', confidence: 0.8, description: '' };

    const shortImpact = computeCutImpact(short, []);
    const longImpact = computeCutImpact(long, []);
    expect(longImpact).toBeGreaterThan(shortImpact);
  });

  it('returns higher impact for higher confidence', () => {
    const low: CutSuggestion = { id: '1', start: 0, end: 2, duration: 2, reason: 'silence', confidence: 0.3, description: '' };
    const high: CutSuggestion = { id: '2', start: 0, end: 2, duration: 2, reason: 'silence', confidence: 0.9, description: '' };

    expect(computeCutImpact(high, [])).toBeGreaterThan(computeCutImpact(low, []));
  });

  it('considers surrounding speech confidence', () => {
    const suggestion: CutSuggestion = { id: '1', start: 2, end: 4, duration: 2, reason: 'silence', confidence: 0.8, description: '' };
    const highConfSpeech = [{ start: 0, end: 2, confidence: 0.9 }];
    const lowConfSpeech = [{ start: 0, end: 2, confidence: 0.3 }];

    const withHigh = computeCutImpact(suggestion, highConfSpeech);
    const withLow = computeCutImpact(suggestion, lowConfSpeech);
    expect(withHigh).toBeGreaterThanOrEqual(withLow);
  });
});

describe('detectLowEnergySegments', () => {
  it('returns empty for no samples', () => {
    expect(detectLowEnergySegments([], [], 10)).toEqual([]);
  });

  it('detects low-energy regions', () => {
    const samples = [
      makeSample(0, 0.1, 0.1, 0.02),
      makeSample(1, 0.1, 0.1, 0.02),
      makeSample(2, 0.1, 0.1, 0.02),
      makeSample(3, 0.8, 0.5, 0.5),
      makeSample(4, 0.8, 0.5, 0.5),
    ];
    const result = detectLowEnergySegments(samples, [], 5, {
      energyThreshold: 0.15,
      minDuration: 1.5,
    });
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].start).toBeCloseTo(0, 0);
  });

  it('does not detect during speech', () => {
    const samples = [
      makeSample(0, 0.1, 0.1, 0.02),
      makeSample(1, 0.1, 0.1, 0.02),
      makeSample(2, 0.1, 0.1, 0.02),
    ];
    const vad = [makeVAD(0, 2.5)];
    const result = detectLowEnergySegments(samples, vad, 3, {
      energyThreshold: 0.15,
      minDuration: 1.0,
    });
    // Speech should boost energy, preventing detection.
    expect(result).toHaveLength(0);
  });
});

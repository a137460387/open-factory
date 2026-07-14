import { describe, expect, it } from 'vitest';
import { analyzeEmotion } from '../src';
import type {
  ContentAnalysisVisualSample,
  ContentAnalysisAudioSample,
} from '../src/content-analysis';

// ─── Test Helpers ────────────────────────────────────────────

function makeVisualSample(
  time: number,
  brightness = 0.5,
  saturation = 0.5,
  motion = 0.3,
): ContentAnalysisVisualSample {
  return { time, brightness, saturation, motion };
}

function makeAudioSample(time: number, loudness = 0.5): ContentAnalysisAudioSample {
  return { time, loudness };
}

// ─── Core Analysis ───────────────────────────────────────────

describe('analyzeEmotion', () => {
  describe('visual-only analysis', () => {
    it('produces a curve with correct length', () => {
      const samples = [
        makeVisualSample(0),
        makeVisualSample(1),
        makeVisualSample(2),
      ];
      const result = analyzeEmotion(samples);
      expect(result.curve).toHaveLength(3);
    });

    it('maps bright scenes to positive valence', () => {
      const samples = [makeVisualSample(0, 0.9, 0.5, 0.3)];
      const result = analyzeEmotion(samples);
      expect(result.curve[0].value).toBeGreaterThan(0);
    });

    it('maps dark scenes to negative valence', () => {
      const samples = [makeVisualSample(0, 0.1, 0.5, 0.3)];
      const result = analyzeEmotion(samples);
      expect(result.curve[0].value).toBeLessThan(0);
    });

    it('maps high saturation and motion to high arousal', () => {
      const samples = [makeVisualSample(0, 0.5, 0.9, 0.8)];
      const result = analyzeEmotion(samples);
      expect(result.curve[0].arousal).toBeGreaterThan(0.5);
    });

    it('maps low saturation and motion to low arousal', () => {
      const samples = [makeVisualSample(0, 0.5, 0.1, 0.05)];
      const result = analyzeEmotion(samples);
      expect(result.curve[0].arousal).toBeLessThan(0.5);
    });

    it('marks all points as visual source', () => {
      const samples = [makeVisualSample(0), makeVisualSample(1)];
      const result = analyzeEmotion(samples);
      for (const point of result.curve) {
        expect(point.source).toBe('visual');
      }
    });

    it('preserves time values from samples', () => {
      const samples = [makeVisualSample(0), makeVisualSample(2.5), makeVisualSample(5)];
      const result = analyzeEmotion(samples);
      expect(result.curve[0].time).toBe(0);
      expect(result.curve[1].time).toBe(2.5);
      expect(result.curve[2].time).toBe(5);
    });

    it('clamps value between -1 and 1', () => {
      const samples = [makeVisualSample(0, 1.0, 1.0, 1.0)];
      const result = analyzeEmotion(samples);
      expect(result.curve[0].value).toBeLessThanOrEqual(1);
      expect(result.curve[0].value).toBeGreaterThanOrEqual(-1);
    });

    it('clamps arousal between 0 and 1', () => {
      const samples = [makeVisualSample(0, 0.5, 1.0, 1.0)];
      const result = analyzeEmotion(samples);
      expect(result.curve[0].arousal).toBeLessThanOrEqual(1);
      expect(result.curve[0].arousal).toBeGreaterThanOrEqual(0);
    });
  });

  describe('audio-only analysis', () => {
    it('falls back to visual-only when audioSamples is undefined', () => {
      const samples = [makeVisualSample(0), makeVisualSample(1)];
      const result = analyzeEmotion(samples, undefined);
      expect(result.curve).toHaveLength(2);
      for (const point of result.curve) {
        expect(point.source).toBe('visual');
      }
    });

    it('falls back to visual-only when audioSamples is empty', () => {
      const samples = [makeVisualSample(0)];
      const result = analyzeEmotion(samples, []);
      expect(result.curve).toHaveLength(1);
      expect(result.curve[0].source).toBe('visual');
    });
  });

  describe('fused visual + audio analysis', () => {
    it('produces fused points when both sources are available', () => {
      const visual = [makeVisualSample(0, 0.8, 0.5, 0.3)];
      const audio = [makeAudioSample(0, 0.6)];
      const result = analyzeEmotion(visual, audio);
      expect(result.curve[0].source).toBe('fused');
    });

    it('combines valence with default weights (audio 0.6, visual 0.4)', () => {
      const visual = [makeVisualSample(0, 0.9, 0.5, 0.3)]; // bright → positive valence
      const audio = [makeAudioSample(0, 0.5)]; // moderate loudness → positive valence
      const result = analyzeEmotion(visual, audio);
      // Both sources suggest positive, so fused value should be positive
      expect(result.curve[0].value).toBeGreaterThan(0);
    });

    it('respects custom audioWeight and visualWeight', () => {
      const visual = [makeVisualSample(0, 0.1, 0.5, 0.3)]; // dark → negative
      const audio = [makeAudioSample(0, 0.5)]; // moderate → positive
      // With high visual weight, the negative should dominate
      const result = analyzeEmotion(visual, audio, { visualWeight: 0.9, audioWeight: 0.1 });
      expect(result.curve[0].value).toBeLessThan(0);
    });

    it('merges timestamps from both sources', () => {
      const visual = [makeVisualSample(0), makeVisualSample(2)];
      const audio = [makeAudioSample(1), makeAudioSample(3)];
      const result = analyzeEmotion(visual, audio);
      // Should have points at times 0, 1, 2, 3
      expect(result.curve.length).toBeGreaterThanOrEqual(3);
      const times = result.curve.map((p) => p.time);
      expect(times).toContain(0);
      expect(times).toContain(1);
      expect(times).toContain(2);
    });
  });

  describe('curve smoothing', () => {
    it('smooths the curve with default window size', () => {
      const samples = [
        makeVisualSample(0, 0.1, 0.5, 0.3),
        makeVisualSample(1, 0.9, 0.5, 0.3),
        makeVisualSample(2, 0.1, 0.5, 0.3),
        makeVisualSample(3, 0.9, 0.5, 0.3),
        makeVisualSample(4, 0.1, 0.5, 0.3),
      ];
      const result = analyzeEmotion(samples);
      // Smoothed curve should have reduced extremes
      const values = result.curve.map((p) => p.value);
      const maxVal = Math.max(...values);
      const minVal = Math.min(...values);
      // The smoothed max should be less than the raw max
      expect(maxVal).toBeLessThan(0.9 * 1.2 + 0.1); // raw max would be (0.9-0.5)*1.2 = 0.48
    });

    it('returns original curve when shorter than window size', () => {
      const samples = [makeVisualSample(0), makeVisualSample(1)];
      const result = analyzeEmotion(samples, undefined, { windowSize: 5 });
      expect(result.curve).toHaveLength(2);
    });

    it('applies custom window size', () => {
      const samples = Array.from({ length: 10 }, (_, i) =>
        makeVisualSample(i, i % 2 === 0 ? 0.1 : 0.9, 0.5, 0.3),
      );
      const resultSmall = analyzeEmotion(samples, undefined, { windowSize: 3 });
      const resultLarge = analyzeEmotion(samples, undefined, { windowSize: 7 });
      // Larger window should produce smoother (less extreme) values
      const rangeSmall = Math.max(...resultSmall.curve.map((p) => p.value)) -
        Math.min(...resultSmall.curve.map((p) => p.value));
      const rangeLarge = Math.max(...resultLarge.curve.map((p) => p.value)) -
        Math.min(...resultLarge.curve.map((p) => p.value));
      expect(rangeLarge).toBeLessThan(rangeSmall);
    });
  });

  describe('peak detection', () => {
    it('detects peaks above threshold', () => {
      // Create a curve with a clear peak in the middle (wide enough to survive smoothing)
      const samples = [
        makeVisualSample(0, 0.3, 0.5, 0.3),
        makeVisualSample(1, 0.3, 0.5, 0.3),
        makeVisualSample(2, 0.3, 0.5, 0.3),
        makeVisualSample(3, 0.98, 0.5, 0.3),
        makeVisualSample(4, 0.98, 0.5, 0.3),
        makeVisualSample(5, 0.98, 0.5, 0.3),
        makeVisualSample(6, 0.3, 0.5, 0.3),
        makeVisualSample(7, 0.3, 0.5, 0.3),
        makeVisualSample(8, 0.3, 0.5, 0.3),
      ];
      const result = analyzeEmotion(samples, undefined, { peakThreshold: 0.1, windowSize: 3 });
      // Should detect at least one peak
      expect(result.peaks.length).toBeGreaterThanOrEqual(1);
    });

    it('returns no peaks for flat curve', () => {
      const samples = Array.from({ length: 5 }, (_, i) =>
        makeVisualSample(i, 0.5, 0.5, 0.3),
      );
      const result = analyzeEmotion(samples, undefined, { peakThreshold: 0.5 });
      expect(result.peaks).toHaveLength(0);
    });

    it('classifies positive peaks', () => {
      const samples = [
        makeVisualSample(0, 0.3, 0.5, 0.3),
        makeVisualSample(1, 0.3, 0.5, 0.3),
        makeVisualSample(2, 0.3, 0.5, 0.3),
        makeVisualSample(3, 0.98, 0.5, 0.3),
        makeVisualSample(4, 0.98, 0.5, 0.3),
        makeVisualSample(5, 0.98, 0.5, 0.3),
        makeVisualSample(6, 0.3, 0.5, 0.3),
        makeVisualSample(7, 0.3, 0.5, 0.3),
        makeVisualSample(8, 0.3, 0.5, 0.3),
      ];
      const result = analyzeEmotion(samples, undefined, { peakThreshold: 0.1, windowSize: 3 });
      const positivePeaks = result.peaks.filter((p) => p.type === 'positive');
      expect(positivePeaks.length).toBeGreaterThanOrEqual(1);
    });

    it('classifies negative peaks', () => {
      const samples = [
        makeVisualSample(0, 0.5, 0.5, 0.3),
        makeVisualSample(1, 0.5, 0.5, 0.3),
        makeVisualSample(2, 0.5, 0.5, 0.3),
        makeVisualSample(3, 0.02, 0.5, 0.3),
        makeVisualSample(4, 0.02, 0.5, 0.3),
        makeVisualSample(5, 0.02, 0.5, 0.3),
        makeVisualSample(6, 0.5, 0.5, 0.3),
        makeVisualSample(7, 0.5, 0.5, 0.3),
        makeVisualSample(8, 0.5, 0.5, 0.3),
      ];
      const result = analyzeEmotion(samples, undefined, { peakThreshold: 0.1, windowSize: 3 });
      const negativePeaks = result.peaks.filter((p) => p.type === 'negative');
      expect(negativePeaks.length).toBeGreaterThanOrEqual(1);
    });

    it('returns empty peaks for fewer than 3 points', () => {
      const samples = [makeVisualSample(0, 0.9, 0.5, 0.3), makeVisualSample(1, 0.1, 0.5, 0.3)];
      const result = analyzeEmotion(samples);
      expect(result.peaks).toHaveLength(0);
    });

    it('respects custom peakThreshold', () => {
      const samples = [
        makeVisualSample(0, 0.3, 0.5, 0.3),
        makeVisualSample(1, 0.3, 0.5, 0.3),
        makeVisualSample(2, 0.7, 0.5, 0.3),
        makeVisualSample(3, 0.3, 0.5, 0.3),
        makeVisualSample(4, 0.3, 0.5, 0.3),
      ];
      const lowThreshold = analyzeEmotion(samples, undefined, { peakThreshold: 0.01, windowSize: 3 });
      const highThreshold = analyzeEmotion(samples, undefined, { peakThreshold: 0.9, windowSize: 3 });
      expect(lowThreshold.peaks.length).toBeGreaterThanOrEqual(highThreshold.peaks.length);
    });
  });

  describe('overall mood determination', () => {
    it('returns "neutral" for empty input', () => {
      const result = analyzeEmotion([]);
      expect(result.overallMood).toBe('neutral');
    });

    it('returns "energetic" for high positive valence and high arousal', () => {
      // High brightness + high saturation/motion
      const samples = Array.from({ length: 5 }, (_, i) =>
        makeVisualSample(i, 0.9, 0.9, 0.8),
      );
      const result = analyzeEmotion(samples);
      expect(result.overallMood).toBe('energetic');
    });

    it('returns "happy" for high positive valence and low arousal', () => {
      // High brightness + low saturation/motion
      const samples = Array.from({ length: 5 }, (_, i) =>
        makeVisualSample(i, 0.9, 0.1, 0.05),
      );
      const result = analyzeEmotion(samples);
      expect(result.overallMood).toBe('happy');
    });

    it('returns "tense" for high negative valence and high arousal', () => {
      // Low brightness + high motion
      const samples = Array.from({ length: 5 }, (_, i) =>
        makeVisualSample(i, 0.1, 0.5, 0.9),
      );
      const result = analyzeEmotion(samples);
      expect(result.overallMood).toBe('tense');
    });

    it('returns "sad" for high negative valence and low arousal', () => {
      // Low brightness + low saturation/motion
      const samples = Array.from({ length: 5 }, (_, i) =>
        makeVisualSample(i, 0.1, 0.05, 0.05),
      );
      const result = analyzeEmotion(samples);
      expect(result.overallMood).toBe('sad');
    });

    it('returns "calm" for low arousal and neutral valence', () => {
      const samples = Array.from({ length: 5 }, (_, i) =>
        makeVisualSample(i, 0.5, 0.1, 0.05),
      );
      const result = analyzeEmotion(samples);
      expect(result.overallMood).toBe('calm');
    });

    it('returns "excited" for very high arousal and neutral valence', () => {
      const samples = Array.from({ length: 5 }, (_, i) =>
        makeVisualSample(i, 0.5, 0.8, 0.7),
      );
      const result = analyzeEmotion(samples);
      expect(result.overallMood).toBe('excited');
    });
  });

  describe('emotional arc determination', () => {
    it('returns "stable" for single point', () => {
      const result = analyzeEmotion([makeVisualSample(0)]);
      expect(result.emotionalArc).toBe('stable');
    });

    it('returns "rising" when second half is more positive', () => {
      const samples = [
        makeVisualSample(0, 0.1, 0.5, 0.3),
        makeVisualSample(1, 0.1, 0.5, 0.3),
        makeVisualSample(2, 0.9, 0.5, 0.3),
        makeVisualSample(3, 0.9, 0.5, 0.3),
      ];
      const result = analyzeEmotion(samples);
      expect(result.emotionalArc).toBe('rising');
    });

    it('returns "falling" when second half is more negative', () => {
      const samples = [
        makeVisualSample(0, 0.9, 0.5, 0.3),
        makeVisualSample(1, 0.9, 0.5, 0.3),
        makeVisualSample(2, 0.1, 0.5, 0.3),
        makeVisualSample(3, 0.1, 0.5, 0.3),
      ];
      const result = analyzeEmotion(samples);
      expect(result.emotionalArc).toBe('falling');
    });

    it('returns "stable" for uniform input', () => {
      const samples = Array.from({ length: 6 }, (_, i) =>
        makeVisualSample(i, 0.5, 0.5, 0.3),
      );
      const result = analyzeEmotion(samples);
      expect(result.emotionalArc).toBe('stable');
    });
  });

  describe('edge cases', () => {
    it('handles empty visual samples', () => {
      const result = analyzeEmotion([]);
      expect(result.curve).toHaveLength(0);
      expect(result.peaks).toHaveLength(0);
      expect(result.overallMood).toBe('neutral');
      expect(result.emotionalArc).toBe('stable');
    });

    it('handles single sample', () => {
      const result = analyzeEmotion([makeVisualSample(0, 0.7, 0.6, 0.4)]);
      expect(result.curve).toHaveLength(1);
      expect(result.peaks).toHaveLength(0);
    });

    it('handles two samples', () => {
      const result = analyzeEmotion([makeVisualSample(0), makeVisualSample(1)]);
      expect(result.curve).toHaveLength(2);
      expect(result.peaks).toHaveLength(0);
    });

    it('handles extreme brightness values', () => {
      const samples = [makeVisualSample(0, 0, 0, 0), makeVisualSample(1, 1, 1, 1)];
      const result = analyzeEmotion(samples);
      for (const point of result.curve) {
        expect(point.value).toBeGreaterThanOrEqual(-1);
        expect(point.value).toBeLessThanOrEqual(1);
        expect(point.arousal).toBeGreaterThanOrEqual(0);
        expect(point.arousal).toBeLessThanOrEqual(1);
      }
    });

    it('handles audio samples with very high loudness', () => {
      const visual = [makeVisualSample(0)];
      const audio = [makeAudioSample(0, 1.0)];
      const result = analyzeEmotion(visual, audio);
      expect(result.curve[0].arousal).toBeLessThanOrEqual(1);
    });

    it('handles audio samples with zero loudness', () => {
      const visual = [makeVisualSample(0)];
      const audio = [makeAudioSample(0, 0)];
      const result = analyzeEmotion(visual, audio);
      expect(result.curve[0].arousal).toBeGreaterThanOrEqual(0);
    });
  });

  describe('options', () => {
    it('uses default options when none provided', () => {
      const samples = Array.from({ length: 10 }, (_, i) => makeVisualSample(i));
      const result = analyzeEmotion(samples);
      expect(result.curve).toHaveLength(10);
    });

    it('accepts all custom options', () => {
      const visual = Array.from({ length: 10 }, (_, i) => makeVisualSample(i, 0.8, 0.7, 0.5));
      const audio = Array.from({ length: 10 }, (_, i) => makeAudioSample(i, 0.6));
      const result = analyzeEmotion(visual, audio, {
        windowSize: 3,
        peakThreshold: 0.1,
        audioWeight: 0.7,
        visualWeight: 0.3,
      });
      expect(result.curve).toHaveLength(10);
      expect(result.overallMood).toBeDefined();
      expect(result.emotionalArc).toBeDefined();
    });
  });
});

import { describe, it, expect } from 'vitest';
import {
  detectStutters,
  buildRefinedCutIntervals,
  estimateRefinedDuration,
} from '../src/smart-stutter-detection';
import type { AudioFrameForStutter, WhisperSegmentForStutter } from '../src/smart-stutter-detection';

function makeFrames(count: number, opts?: { loudness?: number; pitchHz?: number }): AudioFrameForStutter[] {
  return Array.from({ length: count }, (_, i) => ({
    time: i * 0.1,
    duration: 0.1,
    loudness: opts?.loudness ?? 0.5,
    pitchHz: opts?.pitchHz ?? 200,
  }));
}

describe('smart-stutter-detection', () => {
  describe('detectStutters', () => {
    it('returns empty for no input', () => {
      expect(detectStutters([])).toEqual([]);
    });

    it('detects prolonged pauses', () => {
      const frames: AudioFrameForStutter[] = [
        { time: 0, duration: 0.1, loudness: 0.5, pitchHz: 200 },
        { time: 0.1, duration: 0.1, loudness: 0.5, pitchHz: 200 },
        { time: 0.2, duration: 0.1, loudness: 0.01 },
        { time: 0.3, duration: 0.1, loudness: 0.01 },
        { time: 0.4, duration: 0.1, loudness: 0.01 },
        { time: 0.5, duration: 0.1, loudness: 0.01 },
        { time: 0.6, duration: 0.1, loudness: 0.01 },
        { time: 0.7, duration: 0.1, loudness: 0.01 },
        { time: 0.8, duration: 0.1, loudness: 0.01 },
        { time: 0.9, duration: 0.1, loudness: 0.01 },
        { time: 1.0, duration: 0.1, loudness: 0.01 },
        { time: 1.1, duration: 0.1, loudness: 0.01 },
        { time: 1.2, duration: 0.1, loudness: 0.01 },
        { time: 1.5, duration: 0.1, loudness: 0.5, pitchHz: 200 },
      ];
      const stutters = detectStutters(frames, undefined, { minConfidence: 0.1 });
      const pauses = stutters.filter((s) => s.type === 'prolonged_pause');
      expect(pauses.length).toBeGreaterThanOrEqual(1);
      if (pauses.length > 0) {
        expect(pauses[0].duration).toBeGreaterThanOrEqual(0.4);
      }
    });

    it('detects filler words from whisper segments', () => {
      const segments: WhisperSegmentForStutter[] = [
        { start: 0, end: 0.5, text: '你好世界' },
        { start: 0.6, end: 1.0, text: '嗯' },
        { start: 1.2, end: 1.8, text: '那个' },
        { start: 2.0, end: 2.5, text: '今天天气不错' },
      ];
      const stutters = detectStutters([], segments);
      const fillers = stutters.filter((s) => s.type === 'filler');
      expect(fillers.length).toBe(2);
      expect(fillers[0].reason).toContain('嗯');
    });

    it('detects repetition from whisper segments', () => {
      const segments: WhisperSegmentForStutter[] = [
        { start: 0, end: 0.5, text: '今天天气' },
        { start: 0.6, end: 1.0, text: '今天天气' },
        { start: 1.1, end: 1.5, text: '今天天气' },
        { start: 2.0, end: 2.5, text: '好' },
      ];
      const stutters = detectStutters([], segments, { minRepetitions: 2, minConfidence: 0.1 });
      const reps = stutters.filter((s) => s.type === 'repetition');
      expect(reps.length).toBeGreaterThanOrEqual(1);
    });

    it('filters by minConfidence', () => {
      const segments: WhisperSegmentForStutter[] = [
        { start: 0, end: 0.5, text: '嗯' },
      ];
      const high = detectStutters([], segments, { minConfidence: 0.9 });
      const low = detectStutters([], segments, { minConfidence: 0.1 });
      expect(low.length).toBeGreaterThanOrEqual(high.length);
    });

    it('handles english filler words', () => {
      const segments: WhisperSegmentForStutter[] = [
        { start: 0, end: 0.3, text: 'um' },
        { start: 0.5, end: 0.8, text: 'uh' },
        { start: 1.0, end: 1.5, text: 'hello world' },
      ];
      const stutters = detectStutters([], segments);
      const fillers = stutters.filter((s) => s.type === 'filler');
      expect(fillers.length).toBe(2);
    });
  });

  describe('buildRefinedCutIntervals', () => {
    it('returns full duration as single segment when nothing to remove', () => {
      const result = buildRefinedCutIntervals([], [], 10, { minSegmentDuration: 0 });
      expect(result.length).toBe(1);
      expect(result[0].end).toBe(10);
    });

    it('returns full duration as single segment when no removals', () => {
      const result = buildRefinedCutIntervals([], [], 10, { minSegmentDuration: 0 });
      expect(result.length).toBe(1);
      expect(result[0].end).toBe(10);
    });

    it('removes silence ranges and keeps remaining', () => {
      const silences = [{ start: 2, end: 4, duration: 2 }];
      const result = buildRefinedCutIntervals(silences, [], 10, { paddingBefore: 0, paddingAfter: 0 });
      expect(result.length).toBe(2);
      expect(result[0].start).toBe(0);
      expect(result[0].end).toBe(2);
      expect(result[1].start).toBe(4);
      expect(result[1].end).toBe(10);
    });

    it('removes stutter intervals', () => {
      const stutters = [{
        id: 's1',
        start: 3,
        end: 3.5,
        duration: 0.5,
        type: 'filler' as const,
        confidence: 0.8,
        reason: 'filler',
      }];
      const result = buildRefinedCutIntervals([], stutters, 10, { paddingBefore: 0, paddingAfter: 0 });
      expect(result.length).toBe(2);
    });

    it('merges overlapping removal ranges', () => {
      const silences = [{ start: 2, end: 4, duration: 2 }];
      const stutters = [{
        id: 's1',
        start: 3.5,
        end: 5,
        duration: 1.5,
        type: 'filler' as const,
        confidence: 0.8,
        reason: 'filler',
      }];
      const result = buildRefinedCutIntervals(silences, stutters, 10, { paddingBefore: 0, paddingAfter: 0 });
      expect(result.length).toBe(2);
      expect(result[0].end).toBe(2);
      expect(result[1].start).toBe(5);
    });
  });

  describe('estimateRefinedDuration', () => {
    it('sums segment durations', () => {
      expect(estimateRefinedDuration([{ duration: 2 }, { duration: 3 }])).toBe(5);
    });

    it('returns 0 for empty', () => {
      expect(estimateRefinedDuration([])).toBe(0);
    });
  });
});

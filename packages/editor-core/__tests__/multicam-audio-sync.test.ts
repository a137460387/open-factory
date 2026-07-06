import { describe, expect, it } from 'vitest';
import {
  calculateMedianOffset,
  calculateSegmentedOffsets,
  detectDrift,
  generateAtempoSegments,
  syncMulticamAudio,
  type MulticamSyncWindowResult
} from '../src/audio/multicam-audio-sync';

function pulseSeries(peaks: number[], length: number, sampleRate = 100): number[] {
  const samples = new Array(length).fill(0);
  for (const peak of peaks) {
    const idx = Math.round(peak * sampleRate);
    if (idx >= 0 && idx < length) {
      samples[idx] = 1;
    }
  }
  return samples;
}

describe('multicam audio sync', () => {
  describe('calculateMedianOffset', () => {
    it('returns 0 for empty input', () => {
      expect(calculateMedianOffset([])).toBe(0);
    });

    it('returns the single offset for one window', () => {
      const windows: MulticamSyncWindowResult[] = [
        { windowIndex: 0, startTime: 0, endTime: 10, offsetSeconds: -0.3, score: 0.9 }
      ];
      expect(calculateMedianOffset(windows)).toBe(-0.3);
    });

    it('calculates the median of odd-length window results', () => {
      const windows: MulticamSyncWindowResult[] = [
        { windowIndex: 0, startTime: 0, endTime: 10, offsetSeconds: -0.1, score: 0.8 },
        { windowIndex: 1, startTime: 10, endTime: 20, offsetSeconds: -0.3, score: 0.9 },
        { windowIndex: 2, startTime: 20, endTime: 30, offsetSeconds: -0.2, score: 0.85 }
      ];
      expect(calculateMedianOffset(windows)).toBe(-0.2);
    });

    it('calculates the median of even-length window results', () => {
      const windows: MulticamSyncWindowResult[] = [
        { windowIndex: 0, startTime: 0, endTime: 10, offsetSeconds: -0.1, score: 0.8 },
        { windowIndex: 1, startTime: 10, endTime: 20, offsetSeconds: -0.3, score: 0.9 }
      ];
      expect(calculateMedianOffset(windows)).toBe(-0.2);
    });
  });

  describe('detectDrift', () => {
    it('returns no drift for fewer than 3 windows', () => {
      const result = detectDrift([
        { windowIndex: 0, startTime: 0, endTime: 10, offsetSeconds: -0.1, score: 0.9 },
        { windowIndex: 1, startTime: 10, endTime: 20, offsetSeconds: -0.1, score: 0.9 }
      ]);
      expect(result.hasDrift).toBe(false);
    });

    it('detects linear drift from increasing offsets', () => {
      const windows: MulticamSyncWindowResult[] = [];
      for (let i = 0; i < 10; i++) {
        windows.push({
          windowIndex: i,
          startTime: i * 10,
          endTime: (i + 1) * 10,
          offsetSeconds: -0.1 - i * 0.01,
          score: 0.9
        });
      }
      const result = detectDrift(windows, 10);
      expect(result.hasDrift).toBe(true);
      expect(result.rSquared).toBeGreaterThan(0.9);
      expect(result.message).toContain('时钟漂移');
    });

    it('returns no drift for constant offsets', () => {
      const windows: MulticamSyncWindowResult[] = [];
      for (let i = 0; i < 10; i++) {
        windows.push({
          windowIndex: i,
          startTime: i * 10,
          endTime: (i + 1) * 10,
          offsetSeconds: -0.1,
          score: 0.9
        });
      }
      const result = detectDrift(windows, 10);
      expect(result.hasDrift).toBe(false);
    });
  });

  describe('generateAtempoSegments', () => {
    it('returns empty array when no drift detected', () => {
      const windows: MulticamSyncWindowResult[] = [
        { windowIndex: 0, startTime: 0, endTime: 10, offsetSeconds: -0.1, score: 0.9 }
      ];
      const result = generateAtempoSegments(windows, {
        hasDrift: false, slope: 0, intercept: 0, rSquared: 0, driftRateMsPerMin: 0, message: ''
      });
      expect(result).toEqual([]);
    });

    it('generates atempo segments for drift-corrected windows', () => {
      const windows: MulticamSyncWindowResult[] = [
        { windowIndex: 0, startTime: 0, endTime: 10, offsetSeconds: -0.1, score: 0.9 },
        { windowIndex: 1, startTime: 10, endTime: 20, offsetSeconds: -0.15, score: 0.9 },
        { windowIndex: 2, startTime: 20, endTime: 30, offsetSeconds: -0.2, score: 0.9 }
      ];
      const drift = {
        hasDrift: true,
        slope: -0.005,
        intercept: -100,
        rSquared: 0.95,
        driftRateMsPerMin: -300,
        message: '检测到时钟漂移，建议分段同步'
      };
      const segments = generateAtempoSegments(windows, drift);
      expect(segments.length).toBe(3);
      expect(segments[0].startTime).toBe(0);
      expect(segments[0].endTime).toBe(10);
      expect(segments[0].tempoFactor).toBeGreaterThan(0.5);
      expect(segments[0].tempoFactor).toBeLessThan(2.0);
    });

    it('clamps tempo factors to valid range', () => {
      const windows: MulticamSyncWindowResult[] = [];
      for (let i = 0; i < 5; i++) {
        windows.push({
          windowIndex: i,
          startTime: i * 10,
          endTime: (i + 1) * 10,
          offsetSeconds: -0.1,
          score: 0.9
        });
      }
      const drift = {
        hasDrift: true,
        slope: -100,
        intercept: 0,
        rSquared: 0.99,
        driftRateMsPerMin: -6000,
        message: 'test'
      };
      const segments = generateAtempoSegments(windows, drift);
      for (const seg of segments) {
        expect(seg.tempoFactor).toBeGreaterThanOrEqual(0.5);
        expect(seg.tempoFactor).toBeLessThanOrEqual(2.0);
      }
    });
  });

  describe('calculateSegmentedOffsets', () => {
    it('returns window results for each segment', () => {
      const ref = new Array(600).fill(0).map((_, i) => Math.sin(2 * Math.PI * i / 50));
      const candidate = new Array(600).fill(0).map((_, i) => Math.sin(2 * Math.PI * (i - 5) / 50));
      const results = calculateSegmentedOffsets(ref, candidate, 100, 1, 0.2);
      expect(results.length).toBeGreaterThan(0);
      for (const r of results) {
        expect(r.windowIndex).toBeGreaterThanOrEqual(0);
        expect(r.score).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('syncMulticamAudio', () => {
    it('returns a complete sync report', () => {
      const ref = new Array(3000).fill(0).map((_, i) => Math.sin(2 * Math.PI * i / 50));
      const candidate = new Array(3000).fill(0).map((_, i) => Math.sin(2 * Math.PI * (i - 3) / 50));
      const report = syncMulticamAudio(ref, candidate, 'clip-a', { sampleRate: 100, windowDurationSeconds: 1, maxOffsetSeconds: 0.2 });
      expect(report.clipId).toBe('clip-a');
      expect(report.windowResults.length).toBeGreaterThan(0);
      expect(report.confidence).toBeDefined();
    });

    it('returns low confidence when audio is too short for any windows', () => {
      const report = syncMulticamAudio(new Array(1).fill(0), new Array(1).fill(0), 'clip-a', { sampleRate: 100, windowDurationSeconds: 1, maxOffsetSeconds: 0.2 });
      expect(report.windowResults).toHaveLength(0);
      expect(report.confidence).toBe('low');
    });
  });
});

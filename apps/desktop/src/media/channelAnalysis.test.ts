import { describe, expect, it } from 'vitest';
import {
  buildChannelAnalysisSnapshot,
  calculateStereoCorrelation,
  detectTopFrequencyPeaks,
  mapFftBinsToHz,
  serializeChannelAnalysisJson
} from './channelAnalysis';

describe('channel analysis', () => {
  it('maps FFT bins to Hz within the audible range', () => {
    const points = mapFftBinsToHz([0, 64, 128, 255], 8000, 1000, 3000);

    expect(points).toEqual([
      { index: 1, hz: 1000, magnitude: 0.251 },
      { index: 2, hz: 2000, magnitude: 0.502 },
      { index: 3, hz: 3000, magnitude: 1 }
    ]);
  });

  it('calculates stereo correlation for aligned and inverted channels', () => {
    expect(calculateStereoCorrelation([255, 128, 0], [255, 128, 0])).toBe(1);
    expect(calculateStereoCorrelation([255, 128, 0], [0, 128, 255])).toBe(-1);
  });

  it('detects the top three spectral peaks', () => {
    const peaks = detectTopFrequencyPeaks([
      { index: 1, hz: 100, magnitude: 0.2 },
      { index: 2, hz: 200, magnitude: 0.8 },
      { index: 3, hz: 300, magnitude: 0.1 },
      { index: 4, hz: 400, magnitude: 0.9 },
      { index: 5, hz: 500, magnitude: 0.2 },
      { index: 6, hz: 600, magnitude: 0.7 }
    ]);

    expect(peaks.map((peak) => ({ rank: peak.rank, hz: peak.hz }))).toEqual([
      { rank: 1, hz: 400 },
      { rank: 2, hz: 200 },
      { rank: 3, hz: 600 }
    ]);
  });

  it('serializes analysis snapshots with time, bands, and loudness', () => {
    const snapshot = buildChannelAnalysisSnapshot('track-a', {
      sampleRate: 8000,
      frequencyData: [0, 255, 0, 128],
      leftTimeDomain: [255, 128, 0],
      rightTimeDomain: [255, 128, 0],
      recordedAtMs: 123.4
    });
    const parsed = JSON.parse(serializeChannelAnalysisJson([snapshot])) as {
      version: number;
      snapshots: Array<{ timeMs: number; frequencyBands: Array<{ hz: number; loudness: number }> }>;
    };

    expect(parsed.version).toBe(1);
    expect(parsed.snapshots[0].timeMs).toBe(123);
    expect(parsed.snapshots[0].frequencyBands).toContainEqual({ hz: 1000, loudness: 1 });
  });
});

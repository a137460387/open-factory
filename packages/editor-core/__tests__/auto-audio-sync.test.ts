import { describe, expect, it } from 'vitest';
import {
  analyzeAutoAudioSyncTracks,
  findAudioSyncCorrelationPeak,
  labelAutoAudioSyncConfidence,
  refineAudioSyncOffsetByRms,
  resolveAutoAudioSyncApplyRoute,
  type AutoAudioSyncResult
} from '../src/audio/auto-audio-sync';

describe('auto audio sync', () => {
  it('calculates the FFT cross-correlation peak offset for delayed secondary audio', () => {
    const reference = pulseSeries([10, 28], 48);
    const delayedCandidate = pulseSeries([13, 31], 48);

    const peak = findAudioSyncCorrelationPeak(reference, delayedCandidate, 10, 1);

    expect(peak.offsetSeconds).toBe(-0.3);
    expect(peak.score).toBeGreaterThan(0.9);
  });

  it('returns zero offset gracefully for empty audio samples', () => {
    const peak = findAudioSyncCorrelationPeak([], [], 44100, 1);
    expect(peak.offsetSeconds).toBe(0);
    expect(peak.score).toBe(0);
    expect(peak.overlapSamples).toBe(0);
  });

  it('refines coarse offsets by minimizing RMS error inside the fine search window', () => {
    const reference = pulseSeries([20, 36], 64);
    const delayedCandidate = pulseSeries([24, 40], 64);

    const refined = refineAudioSyncOffsetByRms(reference, delayedCandidate, 10, -0.3, 0.2);

    expect(refined.offsetSeconds).toBe(-0.4);
    expect(refined.rmsError).toBeLessThan(0.01);
  });

  it('labels confidence from normalized correlation peak strength', () => {
    expect(labelAutoAudioSyncConfidence(0.8)).toBe('high');
    expect(labelAutoAudioSyncConfidence(0.55)).toBe('medium');
    expect(labelAutoAudioSyncConfidence(0.2)).toBe('low');
  });

  it('analyzes up to four secondary tracks and skips low confidence results by default', () => {
    const reference = pulseSeries([10, 28], 48);
    const delayedCandidate = pulseSeries([13, 31], 48);
    const flatCandidate = new Array(48).fill(0);

    const results = analyzeAutoAudioSyncTracks(
      { clipId: 'primary', samples: reference, sampleRate: 10 },
      [
        { clipId: 'secondary-a', samples: delayedCandidate, sampleRate: 10 },
        { clipId: 'secondary-b', samples: flatCandidate, sampleRate: 10 }
      ],
      { targetSampleRate: 10, maxOffsetSeconds: 1, fineSearchWindowSeconds: 0.2 }
    );

    expect(results[0]).toMatchObject({ clipId: 'secondary-a', offsetSeconds: -0.3, confidence: 'high', applied: true });
    expect(results[1]).toMatchObject({ clipId: 'secondary-b', confidence: 'low', applied: false });
  });

  it('routes replace mode by muting the primary clip while keeping low confidence tracks unapplied', () => {
    const results: AutoAudioSyncResult[] = [
      makeResult('secondary-a', -0.25, 'high'),
      makeResult('secondary-b', 0.5, 'low')
    ];

    expect(resolveAutoAudioSyncApplyRoute('primary', results, 'keep-secondary')).toEqual({
      mode: 'keep-secondary',
      offsetsByClipId: { 'secondary-a': -0.25 },
      skippedLowConfidenceClipIds: ['secondary-b'],
      mutePrimaryClipId: undefined
    });
    expect(resolveAutoAudioSyncApplyRoute('primary', results, 'replace-primary-audio')).toEqual({
      mode: 'replace-primary-audio',
      offsetsByClipId: { 'secondary-a': -0.25 },
      skippedLowConfidenceClipIds: ['secondary-b'],
      mutePrimaryClipId: 'primary'
    });
  });
});

function pulseSeries(peaks: number[], length: number): number[] {
  const samples = new Array(length).fill(0);
  for (const peak of peaks) {
    samples[peak - 1] = 0.25;
    samples[peak] = 1;
    samples[peak + 1] = 0.25;
  }
  return samples;
}

function makeResult(clipId: string, offsetSeconds: number, confidence: AutoAudioSyncResult['confidence']): AutoAudioSyncResult {
  return {
    clipId,
    offsetSeconds,
    offsetMs: Math.round(offsetSeconds * 1000),
    coarseOffsetSeconds: offsetSeconds,
    refinedOffsetSeconds: offsetSeconds,
    peakScore: confidence === 'low' ? 0.2 : 0.9,
    confidence,
    applied: confidence !== 'low'
  };
}

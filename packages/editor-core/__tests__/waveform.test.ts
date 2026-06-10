import { describe, expect, it } from 'vitest';
import { buildTimelineWaveformCacheKey, buildWaveformChannelHash, extractDecodedWaveform, sampleAudioPeaksForPixels } from '../src';

describe('decoded waveform extraction', () => {
  it('extracts normalized peaks from stereo decoded channels', () => {
    const left = new Float32Array([0, 0.25, -0.5, 0.1, 0.2, -0.9, 0.1, 0]);
    const right = new Float32Array([0, -0.1, 0.2, 0.75, 0.1, 0.2, -0.3, 0.4]);
    const waveform = extractDecodedWaveform({ channels: [left, right], sampleRate: 4, pointsPerSecond: 2 });

    expect(waveform.channels).toBe(2);
    expect(waveform.duration).toBe(2);
    expect(waveform.peaks).toEqual([0.25, 0.75, 0.9, 0.4]);
  });

  it('supports multi-channel input and clamps peaks', () => {
    const waveform = extractDecodedWaveform({
      channels: [new Float32Array([1.5, 0]), new Float32Array([0, -0.4]), new Float32Array([0.2, -2])],
      sampleRate: 2,
      pointsPerSecond: 2
    });

    expect(waveform.channels).toBe(3);
    expect(waveform.peaks).toEqual([1, 1]);
  });

  it('samples decoded audio to one peak per timeline pixel', () => {
    const left = new Float32Array([0, 0.1, -0.4, 0.2, 0.8, -0.1, 0, 0.3]);
    const right = new Float32Array([0, -0.2, 0.1, -0.7, 0.2, 0.1, -0.5, 0]);

    expect(sampleAudioPeaksForPixels({ channels: [left, right], pixelWidth: 4 })).toEqual([0.2, 0.7, 0.8, 0.5]);
  });

  it('builds stable timeline waveform cache keys from media path and channel hash', () => {
    const hash = buildWaveformChannelHash(2, 44100, 1.23456);

    expect(hash).toBe('ch=2|sr=44100|d=1.235');
    expect(buildTimelineWaveformCacheKey('D:\\Media\\voice.wav', hash)).toBe('D:/Media/voice.wav|ch=2|sr=44100|d=1.235');
  });
});

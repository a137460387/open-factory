import { describe, expect, it } from 'vitest';
import {
  buildSmartMontageClips,
  estimateBpmFromTimes,
  type SmartMontageConfig
} from '../src';
import type { MediaAsset } from '../src/model-types';

const makeVideoAsset = (id: string, name: string, duration: number): MediaAsset => ({
  id,
  name,
  type: 'video',
  path: `/videos/${name}.mp4`,
  duration,
  width: 1920,
  height: 1080,
  fps: 30,
  folderId: null,
  labelColor: null,
  flags: [],
  tags: [],
  metadata: {}
} as MediaAsset);

const makeAudioAsset = (id: string, name: string, duration: number): MediaAsset => ({
  id,
  name,
  type: 'audio',
  path: `/audio/${name}.mp3`,
  duration,
  folderId: null,
  labelColor: null,
  flags: [],
  tags: [],
  metadata: {}
} as MediaAsset);

const makeImageAsset = (id: string, name: string): MediaAsset => ({
  id,
  name,
  type: 'image',
  path: `/images/${name}.jpg`,
  duration: 0,
  width: 1920,
  height: 1080,
  folderId: null,
  labelColor: null,
  flags: [],
  tags: [],
  metadata: {}
} as MediaAsset);

describe('estimateBpmFromTimes', () => {
  it('returns 0 for empty array', () => {
    expect(estimateBpmFromTimes([])).toBe(0);
  });

  it('returns 0 for single beat', () => {
    expect(estimateBpmFromTimes([1.0])).toBe(0);
  });

  it('calculates BPM from evenly spaced beats', () => {
    // Beats every 0.5s = 120 BPM
    const beats = [0, 0.5, 1.0, 1.5, 2.0];
    expect(estimateBpmFromTimes(beats)).toBe(120);
  });

  it('calculates BPM from 1-second intervals', () => {
    const beats = [0, 1, 2, 3, 4];
    expect(estimateBpmFromTimes(beats)).toBe(60);
  });

  it('uses median interval for robustness', () => {
    // Most intervals are 0.5s (120 BPM), one outlier is 2.0s
    const beats = [0, 0.5, 1.0, 1.5, 3.5, 4.0];
    expect(estimateBpmFromTimes(beats)).toBe(120);
  });

  it('handles unsorted input', () => {
    const beats = [2.0, 0, 1.0, 0.5, 1.5];
    expect(estimateBpmFromTimes(beats)).toBe(120);
  });
});

describe('buildSmartMontageClips', () => {
  const defaultConfig: SmartMontageConfig = {
    assets: [makeVideoAsset('v1', 'clip1', 10), makeVideoAsset('v2', 'clip2', 15)],
    beatTimes: [0, 0.5, 1.0, 1.5, 2.0],
    videoTrackId: 'video-track-1',
    audioTrackId: 'audio-track-1',
    audioAsset: makeAudioAsset('a1', 'bgm', 120)
  };

  it('returns null for empty assets', () => {
    const result = buildSmartMontageClips({ ...defaultConfig, assets: [] });
    expect(result).toBeNull();
  });

  it('returns null for less than 2 beats', () => {
    const result = buildSmartMontageClips({ ...defaultConfig, beatTimes: [0] });
    expect(result).toBeNull();
  });

  it('returns null for empty track IDs', () => {
    const result = buildSmartMontageClips({ ...defaultConfig, videoTrackId: '' });
    expect(result).toBeNull();
  });

  it('creates correct number of visual clips', () => {
    const result = buildSmartMontageClips(defaultConfig);
    expect(result).not.toBeNull();
    // 5 beats = 4 intervals = 4 clips
    expect(result!.visualClips).toHaveLength(4);
  });

  it('assigns clips to the correct track', () => {
    const result = buildSmartMontageClips(defaultConfig);
    expect(result).not.toBeNull();
    for (const clip of result!.visualClips) {
      expect(clip.trackId).toBe('video-track-1');
    }
  });

  it('sets correct start times based on beats', () => {
    const result = buildSmartMontageClips(defaultConfig);
    expect(result).not.toBeNull();
    expect(result!.visualClips[0].start).toBe(0);
    expect(result!.visualClips[1].start).toBe(0.5);
    expect(result!.visualClips[2].start).toBe(1.0);
    expect(result!.visualClips[3].start).toBe(1.5);
  });

  it('sets correct durations based on beat intervals', () => {
    const result = buildSmartMontageClips(defaultConfig);
    expect(result).not.toBeNull();
    for (const clip of result!.visualClips) {
      expect(clip.duration).toBeCloseTo(0.5, 4);
    }
  });

  it('distributes assets in round-robin order', () => {
    const result = buildSmartMontageClips(defaultConfig);
    expect(result).not.toBeNull();
    // 4 clips, 2 assets: v1, v2, v1, v2
    expect(result!.visualClips[0].mediaId).toBe('v1');
    expect(result!.visualClips[1].mediaId).toBe('v2');
    expect(result!.visualClips[2].mediaId).toBe('v1');
    expect(result!.visualClips[3].mediaId).toBe('v2');
  });

  it('creates audio clip spanning the full beat range', () => {
    const result = buildSmartMontageClips(defaultConfig);
    expect(result).not.toBeNull();
    const audio = result!.audioClip;
    expect(audio.type).toBe('audio');
    expect(audio.mediaId).toBe('a1');
    expect(audio.trackId).toBe('audio-track-1');
    expect(audio.start).toBe(0);
    expect(audio.duration).toBeCloseTo(2.0, 4);
  });

  it('returns correct BPM estimate', () => {
    const result = buildSmartMontageClips(defaultConfig);
    expect(result).not.toBeNull();
    expect(result!.estimatedBpm).toBe(120);
  });

  it('returns correct beat count', () => {
    const result = buildSmartMontageClips(defaultConfig);
    expect(result).not.toBeNull();
    expect(result!.beatCount).toBe(5);
  });

  it('handles image assets mixed with video', () => {
    const config: SmartMontageConfig = {
      assets: [makeVideoAsset('v1', 'clip1', 10), makeImageAsset('img1', 'photo1')],
      beatTimes: [0, 1, 2, 3],
      videoTrackId: 'vt',
      audioTrackId: 'at',
      audioAsset: makeAudioAsset('a1', 'bgm', 60)
    };
    const result = buildSmartMontageClips(config);
    expect(result).not.toBeNull();
    expect(result!.visualClips).toHaveLength(3);
    expect(result!.visualClips[0].mediaId).toBe('v1');
    expect(result!.visualClips[1].mediaId).toBe('img1');
    expect(result!.visualClips[2].mediaId).toBe('v1');
  });

  it('filters out audio-only assets from visual clips', () => {
    const config: SmartMontageConfig = {
      assets: [makeAudioAsset('a2', 'extra-audio', 10)],
      beatTimes: [0, 1, 2],
      videoTrackId: 'vt',
      audioTrackId: 'at',
      audioAsset: makeAudioAsset('a1', 'bgm', 60)
    };
    const result = buildSmartMontageClips(config);
    expect(result).toBeNull();
  });

  it('skips zero-duration beat intervals', () => {
    const config: SmartMontageConfig = {
      assets: [makeVideoAsset('v1', 'clip1', 10)],
      beatTimes: [0, 0, 1.0, 2.0],
      videoTrackId: 'vt',
      audioTrackId: 'at',
      audioAsset: makeAudioAsset('a1', 'bgm', 60)
    };
    const result = buildSmartMontageClips(config);
    expect(result).not.toBeNull();
    // Duplicate beat at 0 should be removed, giving [0, 1, 2] = 2 intervals
    expect(result!.visualClips).toHaveLength(2);
  });
});

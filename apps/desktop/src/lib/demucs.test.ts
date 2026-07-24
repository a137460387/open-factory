import { beforeAll, describe, expect, it } from 'vitest';
import {
  DEFAULT_CLIP_SPEED,
  DEFAULT_COLOR_CORRECTION,
  DEFAULT_TRANSFORM,
  type Clip,
  type MediaAsset,
} from '@open-factory/editor-core';
import { setLanguage, setLanguageAsync } from '../i18n/strings';
import {
  assertDemucsSettingsReady,
  buildSeparatedAudioMediaAssets,
  buildSeparatedAudioTracksForClip,
  canSeparateAudioForClip,
} from './demucs';

describe('demucs helpers', () => {
  beforeAll(async () => {
    await setLanguageAsync('en');
  });
  it('returns clear errors when the demucs path is not configured or missing', async () => {
    await expect(assertDemucsSettingsReady({ executablePath: '' })).rejects.toThrow('Demucs path is not configured.');
    await expect(
      assertDemucsSettingsReady({ executablePath: 'C:/Tools/demucs.exe' }, async () => false),
    ).rejects.toThrow('Demucs executable does not exist.');
  });

  it('enables separation only for configured audio/video clips with audio media', () => {
    const asset = makeAsset();

    expect(canSeparateAudioForClip(makeClip('video'), asset, true)).toBe(true);
    expect(canSeparateAudioForClip(makeClip('audio'), { ...asset, type: 'audio', width: 0, height: 0 }, true)).toBe(
      true,
    );
    expect(canSeparateAudioForClip(makeClip('video'), { ...asset, hasAudio: false }, true)).toBe(false);
    expect(canSeparateAudioForClip(makeClip('video'), { ...asset, missing: true }, true)).toBe(false);
    expect(canSeparateAudioForClip(makeClip('video'), asset, false)).toBe(false);
  });

  it('builds separated audio media items and aligned independent tracks', async () => {
    const clip = makeClip('video', { start: 12, duration: 3, trimStart: 2 });
    const media = await buildSeparatedAudioMediaAssets(
      clip,
      makeAsset(),
      {
        vocalsPath: 'C:/Temp/demucs/vocals.wav',
        accompanimentPath: 'C:/Temp/demucs/no_vocals.wav',
        outputDir: 'C:/Temp/demucs',
        durationMs: 20,
      },
      async (path) => ({ path, size: path.endsWith('/vocals.wav') ? 100 : 200, mtimeMs: 1234 }),
    );
    const tracks = buildSeparatedAudioTracksForClip(clip, media);

    expect(media.map((asset) => asset.name)).toEqual(['Interview Vocals.wav', 'Interview Background.wav']);
    expect(media.map((asset) => asset.size)).toEqual([100, 200]);
    expect(tracks).toHaveLength(2);
    expect(tracks.map((track) => track.type)).toEqual(['audio', 'audio']);
    expect(tracks.flatMap((track) => track.clips.map((item) => [item.start, item.duration, item.trimStart]))).toEqual([
      [12, 3, 2],
      [12, 3, 2],
    ]);
  });
});

function makeAsset(): MediaAsset {
  return {
    id: 'asset-1',
    type: 'video',
    name: 'interview.mp4',
    path: 'C:/Media/interview.mp4',
    duration: 8,
    width: 1280,
    height: 720,
    hasAudio: true,
    audioChannels: 2,
    audioSampleRate: 44_100,
    audioCodec: 'aac',
  };
}

function makeClip(
  type: 'audio' | 'video',
  patch: Partial<Extract<Clip, { type: 'audio' | 'video' }>> = {},
): Extract<Clip, { type: 'audio' | 'video' }> {
  return {
    id: `clip-${type}`,
    type,
    name: 'Interview',
    mediaId: 'asset-1',
    trackId: type === 'audio' ? 'track-audio' : 'track-video',
    start: 0,
    duration: 4,
    trimStart: 0,
    trimEnd: 0,
    speed: DEFAULT_CLIP_SPEED,
    colorCorrection: DEFAULT_COLOR_CORRECTION,
    transform: DEFAULT_TRANSFORM,
    volume: 1,
    ...patch,
  };
}

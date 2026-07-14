import { describe, expect, it } from 'vitest';
import { assertWhisperSettingsReady, buildWhisperSubtitleTrackForClip, canGenerateSubtitlesForClip } from './whisper';
import {
  DEFAULT_CLIP_SPEED,
  DEFAULT_COLOR_CORRECTION,
  DEFAULT_TRANSFORM,
  createDefaultTimeline,
  type Clip,
} from '@open-factory/editor-core';

describe('whisper helpers', () => {
  it('returns clear errors when whisper paths are not configured or do not exist', async () => {
    await expect(assertWhisperSettingsReady({ executablePath: '', modelPath: '' })).rejects.toThrow(
      'Whisper 路径未配置。',
    );
    await expect(
      assertWhisperSettingsReady(
        { executablePath: 'C:/Tools/whisper.exe', modelPath: 'C:/Models/base.bin' },
        async (path) => path.endsWith('base.bin'),
      ),
    ).rejects.toThrow('Whisper 可执行文件不存在。');
    await expect(
      assertWhisperSettingsReady(
        { executablePath: 'C:/Tools/whisper.exe', modelPath: 'C:/Models/base.bin' },
        async (path) => path.endsWith('whisper.exe'),
      ),
    ).rejects.toThrow('Whisper 模型文件不存在。');
  });

  it('enables subtitle generation only for configured audio/video clips with existing media', () => {
    const asset = {
      id: 'asset-1',
      type: 'video' as const,
      name: 'clip.mp4',
      path: 'C:/Media/clip.mp4',
      duration: 2,
      width: 1280,
      height: 720,
    };

    expect(canGenerateSubtitlesForClip(makeClip('video'), asset, true)).toBe(true);
    expect(canGenerateSubtitlesForClip(makeClip('audio'), asset, true)).toBe(true);
    expect(canGenerateSubtitlesForClip(makeClip('video'), { ...asset, missing: true }, true)).toBe(false);
    expect(canGenerateSubtitlesForClip(makeClip('video'), asset, false)).toBe(false);
  });

  it('builds a subtitle track from Whisper SRT output', async () => {
    const asset = {
      id: 'asset-1',
      type: 'video' as const,
      name: 'clip.mp4',
      path: 'C:/Media/clip.mp4',
      duration: 4,
      width: 1280,
      height: 720,
      hasAudio: true,
    };
    const track = await buildWhisperSubtitleTrackForClip(
      makeClip('video'),
      asset,
      createDefaultTimeline(),
      { executablePath: 'C:/Tools/whisper.exe', modelPath: 'C:/Models/base.bin' },
      {
        exists: async () => true,
        run: async (request) => {
          expect(request).toMatchObject({
            executablePath: 'C:/Tools/whisper.exe',
            modelPath: 'C:/Models/base.bin',
            audioPath: 'C:/Media/clip.mp4',
            clipId: 'clip-video',
          });
          return {
            srtPath: 'C:/Temp/clip.srt',
            contents: [
              '1',
              '00:00:00,000 --> 00:00:01,000',
              'Hello',
              '',
              '2',
              '00:00:01,500 --> 00:00:02,500',
              'Factory',
              '',
            ].join('\n'),
            durationMs: 20,
          };
        },
      },
    );

    expect(track.type).toBe('subtitle');
    expect(track.clips).toHaveLength(2);
    expect(track.clips.map((clip) => ('text' in clip ? clip.text : ''))).toEqual(['Hello', 'Factory']);
  });

  it('aligns Whisper SRT cues to the selected clip timeline window', async () => {
    const asset = {
      id: 'asset-1',
      type: 'video' as const,
      name: 'clip.mp4',
      path: 'C:/Media/clip.mp4',
      duration: 8,
      width: 1280,
      height: 720,
      hasAudio: true,
    };
    const track = await buildWhisperSubtitleTrackForClip(
      makeClip('video', { start: 10, duration: 2, trimStart: 2, speed: 2 }),
      asset,
      createDefaultTimeline(),
      { executablePath: 'C:/Tools/whisper.exe', modelPath: 'C:/Models/base.bin' },
      {
        exists: async () => true,
        run: async () => ({
          srtPath: 'C:/Temp/clip.srt',
          contents: [
            '1',
            '00:00:01,000 --> 00:00:02,500',
            'Leading edge',
            '',
            '2',
            '00:00:03,000 --> 00:00:05,000',
            'Middle cue',
            '',
            '3',
            '00:00:06,500 --> 00:00:07,000',
            'Outside',
            '',
          ].join('\n'),
          durationMs: 20,
        }),
      },
    );

    expect(track.clips).toHaveLength(2);
    expect(track.clips.map((clip) => clip.start)).toEqual([10, 10.5]);
    expect(track.clips.map((clip) => clip.duration)).toEqual([0.25, 1]);
    expect(track.clips.map((clip) => ('text' in clip ? clip.text : ''))).toEqual(['Leading edge', 'Middle cue']);
  });
});

function makeClip(
  type: 'audio' | 'video',
  patch: Partial<Extract<Clip, { type: 'audio' | 'video' }>> = {},
): Extract<Clip, { type: 'audio' | 'video' }> {
  return {
    id: `clip-${type}`,
    type,
    name: type,
    mediaId: 'asset-1',
    trackId: type === 'audio' ? 'track-audio' : 'track-video',
    start: 0,
    duration: 2,
    trimStart: 0,
    trimEnd: 0,
    speed: DEFAULT_CLIP_SPEED,
    colorCorrection: DEFAULT_COLOR_CORRECTION,
    transform: DEFAULT_TRANSFORM,
    volume: 1,
    ...patch,
  };
}

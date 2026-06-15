import { describe, expect, it } from 'vitest';
import {
  CommandManager,
  FillGapCommand,
  buildCrossfadeGapFillTransition,
  buildFreezeFrameFfmpegArgs,
  buildGapFillCommandOperation,
  buildRepeatedGapFillClip,
  buildSolidColorFrameFfmpegArgs,
  createGapFillImageClip,
  findTimelineGapAtTime,
  normalizeGapFillFfmpegColor
} from '../src';
import { makeAccessor, makeImageClip, makeTimeline, makeVideoClip } from './test-utils';

describe('timeline gap fill', () => {
  it('detects gaps between clips with surrounding context', () => {
    const timeline = makeTimeline([makeVideoClip({ id: 'clip-a', start: 0, duration: 2 }), makeVideoClip({ id: 'clip-b', start: 5, duration: 2 })]);

    const gap = findTimelineGapAtTime(timeline, 'track-video', 3);

    expect(gap).toMatchObject({
      trackId: 'track-video',
      start: 2,
      end: 5,
      duration: 3,
      previousClip: { id: 'clip-a' },
      nextClip: { id: 'clip-b' }
    });
  });

  it('returns leading gaps and ignores occupied or missing tracks', () => {
    const timeline = makeTimeline([makeVideoClip({ id: 'clip-a', start: 2, duration: 2 })]);

    expect(findTimelineGapAtTime(timeline, 'track-video', 1)).toMatchObject({ start: 0, end: 2, duration: 2, nextClip: { id: 'clip-a' } });
    expect(findTimelineGapAtTime(timeline, 'track-video', 3)).toBeUndefined();
    expect(findTimelineGapAtTime(timeline, 'missing-track', 1)).toBeUndefined();
  });

  it('builds freeze frame and solid color ffmpeg args', () => {
    expect(buildFreezeFrameFfmpegArgs('C:/Media/source.mp4', 'C:/Cache/freeze.png', 2.25)).toEqual([
      '-y',
      '-hide_banner',
      '-ss',
      '2.25',
      '-i',
      'C:/Media/source.mp4',
      '-vf',
      'select=eq(n\\,0)',
      '-frames:v',
      '1',
      'C:/Cache/freeze.png'
    ]);
    expect(buildSolidColorFrameFfmpegArgs('C:/Cache/black.png', '#000000', 1280, 720)).toContain('color=c=0x000000:s=1280x720:d=0.04');
    expect(buildSolidColorFrameFfmpegArgs('C:/Cache/fallback.png', 'bad color', 0, Number.NaN)).toContain('color=c=black:s=1920x1080:d=0.04');
    expect(normalizeGapFillFfmpegColor(' WHITE ')).toBe('white');
    expect(normalizeGapFillFfmpegColor('#AaBbCc')).toBe('0xAaBbCc');
  });

  it('maps fill strategies to command operations', () => {
    const clip = createGapFillImageClip({ id: 'clip-fill', name: 'Freeze', mediaId: 'media-fill', trackId: 'track-video', start: 2, duration: 1 });

    expect(buildGapFillCommandOperation('freeze-frame', { clip })).toEqual({ type: 'insert-clip', clip });
    expect(buildGapFillCommandOperation('black', { clip })).toEqual({ type: 'insert-clip', clip });
    expect(buildGapFillCommandOperation('repeat')).toEqual({ type: 'repeat-previous' });
    expect(buildGapFillCommandOperation('crossfade')).toEqual({ type: 'crossfade', transitionType: 'dissolve' });
    expect(() => buildGapFillCommandOperation('white')).toThrow('require a clip');
  });

  it('rejects repeat and crossfade operations without enough surrounding clips', () => {
    const timeline = makeTimeline([makeVideoClip({ id: 'clip-a', start: 2, duration: 2 })]);
    const leadingGap = findTimelineGapAtTime(timeline, 'track-video', 1)!;
    expect(() => buildRepeatedGapFillClip(leadingGap)).toThrow('previous clip');
    expect(() => buildCrossfadeGapFillTransition(leadingGap, { type: 'crossfade' })).toThrow('adjacent clips');
  });

  it('fills a gap with an inserted clip and supports undo', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-a', start: 0, duration: 2 }), makeVideoClip({ id: 'clip-b', start: 4, duration: 2 })]));
    const manager = new CommandManager();
    const clip = createGapFillImageClip({ id: 'clip-gap', name: 'Freeze', mediaId: 'media-gap', trackId: 'track-video', start: 0, duration: 1 });

    manager.execute(new FillGapCommand(accessor, 'track-video', 3, { type: 'insert-clip', clip }));

    expect(accessor.current().tracks[0].clips.map((item) => ({ id: item.id, start: item.start, duration: item.duration }))).toEqual([
      { id: 'clip-a', start: 0, duration: 2 },
      { id: 'clip-b', start: 4, duration: 2 },
      { id: 'clip-gap', start: 2, duration: 2 }
    ]);
    manager.undo();
    expect(accessor.current().tracks[0].clips.map((item) => item.id)).toEqual(['clip-a', 'clip-b']);
  });

  it('generates repeat and crossfade gap fill commands', () => {
    const repeatAccessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-a', start: 0, duration: 5, trimStart: 1 }), makeVideoClip({ id: 'clip-b', start: 7, duration: 2 })]));
    new FillGapCommand(repeatAccessor, 'track-video', 6, { type: 'repeat-previous', clipId: 'clip-repeat' }).execute();
    const repeatClip = repeatAccessor.current().tracks[0].clips.find((clip) => clip.id === 'clip-repeat');
    expect(repeatClip).toMatchObject({ start: 5, duration: 2, mediaId: 'asset-1' });
    expect(repeatClip?.trimStart).toBeGreaterThan(1);

    const crossfadeAccessor = makeAccessor(makeTimeline([makeImageClip({ id: 'clip-left', start: 0, duration: 2 }), makeImageClip({ id: 'clip-right', start: 4, duration: 2 })]));
    new FillGapCommand(crossfadeAccessor, 'track-video', 3, { type: 'crossfade', transitionId: 'transition-gap', duration: 1 }).execute();
    expect(crossfadeAccessor.current().tracks[0].clips.map((clip) => ({ id: clip.id, start: clip.start }))).toEqual([
      { id: 'clip-left', start: 0 },
      { id: 'clip-right', start: 2 }
    ]);
    expect(crossfadeAccessor.current().transitions).toEqual([{ id: 'transition-gap', type: 'dissolve', duration: 1, fromClipId: 'clip-left', toClipId: 'clip-right' }]);
  });
});

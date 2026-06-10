import { describe, expect, it } from 'vitest';
import {
  detectOverlap,
  findClipAtTime,
  getActiveClipsAtTime,
  getClipDisplayDuration,
  getClipSourceVisibleDuration,
  getRenderableTracks,
  getClipPlaybackStart,
  getTimelineDuration,
  getTimelinePlaybackDuration,
  getTransitionMaxDuration,
  getTransitionPlaybackWindow,
  moveClip,
  removeClip,
  setClipSpeed,
  snapTime,
  splitClip,
  trimClip
} from '../src';
import { makeTimeline, makeVideoClip } from './test-utils';

describe('timeline helpers', () => {
  it('finds active clips at a given time', () => {
    const clip = makeVideoClip({ start: 2, duration: 4 });
    const timeline = makeTimeline([clip]);

    expect(findClipAtTime(timeline.tracks[0], 3)?.id).toBe(clip.id);
    expect(findClipAtTime(timeline.tracks[0], 6)).toBeUndefined();
    expect(getActiveClipsAtTime(timeline, 3)).toHaveLength(1);
  });

  it('splits a clip and preserves trim accounting', () => {
    const clip = makeVideoClip({ start: 5, duration: 10, trimStart: 2, trimEnd: 3 });
    const [left, right] = splitClip(clip, 9);

    expect(left.start).toBe(5);
    expect(left.duration).toBe(4);
    expect(left.trimStart).toBe(2);
    expect(left.trimEnd).toBe(9);
    expect(right.start).toBe(9);
    expect(right.duration).toBe(6);
    expect(right.trimStart).toBe(6);
    expect(right.trimEnd).toBe(3);
    expect(left.id).not.toBe(clip.id);
    expect(right.id).not.toBe(clip.id);
  });

  it('splits clip keyframes across the resulting clip durations', () => {
    const clip = makeVideoClip({
      start: 0,
      duration: 4,
      keyframes: {
        opacity: [
          { id: 'o-a', time: 1, value: 0.25, easing: 'linear' },
          { id: 'o-b', time: 3, value: 0.75, easing: 'linear' }
        ]
      }
    });
    const [left, right] = splitClip(clip, 2);

    expect(left.keyframes?.opacity).toEqual([
      { id: 'o-a', time: 1, value: 0.25, easing: 'linear' },
      { id: 'o-b', time: 2, value: 0.75, easing: 'linear' }
    ]);
    expect(right.keyframes?.opacity).toEqual([
      { id: 'o-a', time: 0, value: 0.25, easing: 'linear' },
      { id: 'o-b', time: 1, value: 0.75, easing: 'linear' }
    ]);
  });

  it('computes display and source durations from clip speed', () => {
    const clip = makeVideoClip({ duration: 1.5, speed: 2 });

    expect(getClipSourceVisibleDuration(clip)).toBe(3);
    expect(getClipDisplayDuration(3, 2)).toBe(1.5);
    expect(setClipSpeed(clip, 0.5)).toMatchObject({ speed: 0.5, duration: 6 });
  });

  it('trims speed-adjusted clips using source media time', () => {
    const clip = makeVideoClip({ duration: 2, speed: 2, trimStart: 1, trimEnd: 1 });
    const trimmed = trimClip(clip, 2, 1);

    expect(trimmed.trimStart).toBe(2);
    expect(trimmed.duration).toBe(1.5);
  });

  it('rejects boundary splits', () => {
    const clip = makeVideoClip({ start: 5, duration: 10 });
    expect(() => splitClip(clip, 5)).toThrow(RangeError);
    expect(() => splitClip(clip, 15)).toThrow(RangeError);
  });

  it('trims head, tail, and both ends', () => {
    const clip = makeVideoClip({ duration: 10, trimStart: 0, trimEnd: 0 });
    expect(trimClip(clip, 2, 0).duration).toBe(8);
    expect(trimClip(clip, 0, 3).duration).toBe(7);
    const both = trimClip(clip, 2, 3);
    expect(both.duration).toBe(5);
    expect(both.trimStart).toBe(2);
    expect(both.trimEnd).toBe(3);
    expect(() => trimClip(clip, 8, 2)).toThrow(RangeError);
  });

  it('moves clips without allowing negative start times', () => {
    expect(moveClip(makeVideoClip(), 4.125).start).toBe(4.125);
    expect(moveClip(makeVideoClip(), -10).start).toBe(0);
  });

  it('detects overlap while allowing adjacent clips', () => {
    const first = makeVideoClip({ id: 'a', start: 0, duration: 5 });
    const adjacent = makeVideoClip({ id: 'b', start: 5, duration: 2 });
    const overlapping = makeVideoClip({ id: 'c', start: 4.9, duration: 2 });
    const track = makeTimeline([first, adjacent]).tracks[0];

    expect(detectOverlap(track, overlapping)).toBe(true);
    expect(detectOverlap(track, makeVideoClip({ id: 'd', start: 7, duration: 1 }))).toBe(false);
    expect(detectOverlap(track, adjacent)).toBe(false);
  });

  it('snaps time and computes timeline duration', () => {
    const timeline = makeTimeline([
      makeVideoClip({ id: 'a', start: 0, duration: 2 }),
      makeVideoClip({ id: 'b', start: 6, duration: 3 })
    ]);
    expect(snapTime(0.049, 1 / 30)).toBeCloseTo(1 / 30);
    expect(getTimelineDuration(timeline)).toBe(9);
  });

  it('computes transition-aware playback duration and clip start offsets', () => {
    const timeline = makeTimeline([
      makeVideoClip({ id: 'a', start: 0, duration: 2 }),
      makeVideoClip({ id: 'b', start: 2, duration: 2 })
    ]);
    timeline.transitions = [{ id: 'transition-1', type: 'dissolve', duration: 0.5, fromClipId: 'a', toClipId: 'b' }];

    expect(getTransitionMaxDuration(timeline.tracks[0].clips[0], timeline.tracks[0].clips[1])).toBe(1);
    expect(getTimelineDuration(timeline)).toBe(4);
    expect(getTimelinePlaybackDuration(timeline)).toBe(3.5);
    expect(getClipPlaybackStart(timeline, 'a')).toBe(0);
    expect(getClipPlaybackStart(timeline, 'b')).toBe(1.5);
    expect(getTransitionPlaybackWindow(timeline, timeline.transitions[0])).toMatchObject({ start: 1.5, end: 2, duration: 0.5 });
    expect(getClipPlaybackStart(timeline, 'missing')).toBeUndefined();
    expect(getTransitionPlaybackWindow(timeline, { id: 'missing', type: 'dissolve', duration: 0.5, fromClipId: 'a', toClipId: 'missing' })).toBeUndefined();
  });

  it('removes clips with related transitions while preserving timeline markers', () => {
    const timeline = makeTimeline([
      makeVideoClip({ id: 'a', start: 0, duration: 2 }),
      makeVideoClip({ id: 'b', start: 2, duration: 2 })
    ]);
    timeline.transitions = [{ id: 'transition-1', type: 'dissolve', duration: 0.5, fromClipId: 'a', toClipId: 'b' }];
    timeline.markers = [{ id: 'marker-1', time: 1, label: 'Intro', color: '#f97316' }];

    const result = removeClip(timeline, 'a');

    expect(result.clip?.id).toBe('a');
    expect(result.index).toBe(0);
    expect(result.trackId).toBe('track-video');
    expect(result.timeline.transitions).toEqual([]);
    expect(result.timeline.markers).toEqual(timeline.markers);
    expect(removeClip(timeline, 'missing')).toMatchObject({ clip: undefined, index: -1, trackId: undefined });
  });

  it('filters renderable tracks by mute and solo state', () => {
    const timeline = makeTimeline([]);
    timeline.tracks[0].solo = true;
    timeline.tracks[1].solo = true;
    timeline.tracks[2].muted = true;

    expect(getRenderableTracks(timeline).map((track) => track.id)).toEqual(['track-video', 'track-audio']);

    timeline.tracks[0].solo = false;
    timeline.tracks[1].solo = false;
    timeline.tracks[0].muted = true;
    expect(getRenderableTracks(timeline).map((track) => track.id)).toEqual(['track-audio']);
  });
});

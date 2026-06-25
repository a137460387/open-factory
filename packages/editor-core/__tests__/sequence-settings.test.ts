import { describe, expect, it } from 'vitest';
import { getEffectiveSequenceSettings, recalculateClipStartsForFrameRate, type SequenceSettings } from '../src';
import { createSequence, createProject } from '../src';
import { makeTimeline, makeVideoClip } from './test-utils';

describe('sequence settings', () => {
  const projectSettings = createProject('test').settings;

  it('inherits project settings when sequence has no settings', () => {
    const seq = createSequence({ timeline: makeTimeline([]) });
    const effective = getEffectiveSequenceSettings(seq, projectSettings);
    expect(effective.fps).toBe(projectSettings.fps);
    expect(effective.width).toBe(projectSettings.width);
    expect(effective.height).toBe(projectSettings.height);
  });

  it('overrides fps when sequence has frameRate setting', () => {
    const seq = createSequence({ timeline: makeTimeline([]) }) as ReturnType<typeof createSequence> & { settings: SequenceSettings };
    seq.settings = { frameRate: 24 };
    const effective = getEffectiveSequenceSettings(seq, projectSettings);
    expect(effective.fps).toBe(24);
    expect(effective.width).toBe(projectSettings.width);
  });

  it('overrides resolution when sequence has width/height', () => {
    const seq = createSequence({ timeline: makeTimeline([]) }) as ReturnType<typeof createSequence> & { settings: SequenceSettings };
    seq.settings = { width: 1920, height: 1080 };
    const effective = getEffectiveSequenceSettings(seq, projectSettings);
    expect(effective.width).toBe(1920);
    expect(effective.height).toBe(1080);
  });

  describe('recalculateClipStartsForFrameRate', () => {
    it('recalculates starts when fps changes from 30 to 24', () => {
      const timeline = makeTimeline([
        makeVideoClip({ id: 'c1', trackId: 'track-video', start: 2, duration: 1 }),
        makeVideoClip({ id: 'c2', trackId: 'track-video', start: 5, duration: 2 }),
      ]);
      recalculateClipStartsForFrameRate(timeline, 30, 24);
      // 2s * 30/24 = 2.5s, 5s * 30/24 = 6.25s
      expect(timeline.tracks[0].clips[0].start).toBeCloseTo(2.5, 4);
      expect(timeline.tracks[0].clips[1].start).toBeCloseTo(6.25, 4);
    });

    it('does nothing when fps is unchanged', () => {
      const timeline = makeTimeline([
        makeVideoClip({ id: 'c1', trackId: 'track-video', start: 2, duration: 1 }),
      ]);
      recalculateClipStartsForFrameRate(timeline, 30, 30);
      expect(timeline.tracks[0].clips[0].start).toBe(2);
    });

    it('does nothing when fps is invalid', () => {
      const timeline = makeTimeline([
        makeVideoClip({ id: 'c1', trackId: 'track-video', start: 2, duration: 1 }),
      ]);
      recalculateClipStartsForFrameRate(timeline, 0, 24);
      expect(timeline.tracks[0].clips[0].start).toBe(2);
    });
  });
});

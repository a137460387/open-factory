import { describe, expect, it } from 'vitest';
import {
  TIMELINE_LABEL_COLOR_HEX,
  filterTimelineClipsByColor,
  getEffectiveClipColorLabel,
  getTimelineLabelColorHex,
  normalizeTimelineLabelColor
} from '../src';
import { makeAudioClip, makeTimeline, makeVideoClip } from './test-utils';

describe('timeline color labels', () => {
  it('normalizes supported timeline label colors and rejects invalid values', () => {
    expect(normalizeTimelineLabelColor('teal')).toBe('teal');
    expect(normalizeTimelineLabelColor('cyan')).toBe('cyan');
    expect(normalizeTimelineLabelColor('brown')).toBeNull();
    expect(getTimelineLabelColorHex('pink')).toBe(TIMELINE_LABEL_COLOR_HEX.pink);
    expect(getTimelineLabelColorHex(null)).toBe('#94a3b8');
  });

  it('inherits track color when a clip has no override', () => {
    const timeline = makeTimeline([makeVideoClip({ id: 'clip-inherit' })]);
    timeline.tracks[0] = { ...timeline.tracks[0], color: 'blue' };

    expect(getEffectiveClipColorLabel(timeline.tracks[0].clips[0], timeline.tracks[0])).toBe('blue');
  });

  it('uses clip color override before track color', () => {
    const timeline = makeTimeline([makeVideoClip({ id: 'clip-override' })]);
    timeline.tracks[0] = { ...timeline.tracks[0], color: 'green', clips: [{ ...timeline.tracks[0].clips[0], colorLabel: 'pink' }] };

    expect(getEffectiveClipColorLabel(timeline.tracks[0].clips[0], timeline.tracks[0])).toBe('pink');
  });

  it('filters clips by effective color label', () => {
    const timeline = makeTimeline([
      makeVideoClip({ id: 'clip-track-blue' }),
      { ...makeAudioClip({ id: 'clip-audio' }), colorLabel: 'amber' }
    ]);
    timeline.tracks[0] = { ...timeline.tracks[0], color: 'blue' };

    expect(filterTimelineClipsByColor(timeline, 'blue').map((clip) => clip.id)).toEqual(['clip-track-blue']);
    expect(filterTimelineClipsByColor(timeline, 'amber').map((clip) => clip.id)).toEqual(['clip-audio']);
    expect(filterTimelineClipsByColor(timeline, null).map((clip) => clip.id)).toEqual(['clip-track-blue', 'clip-audio']);
  });
});

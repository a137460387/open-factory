import { describe, expect, it } from 'vitest';
import { TITLE_TEMPLATE_IDS, createDefaultTimeline, createTrack, instantiateTitleTemplate } from '../src';

describe('title templates', () => {
  it('instantiates every built-in template as a text clip with keyframes', () => {
    const timeline = createDefaultTimeline();
    const track = createTrack({ id: 'track-text', type: 'text', name: 'Text 1', clips: [] });

    const clips = TITLE_TEMPLATE_IDS.map((templateId) => instantiateTitleTemplate(templateId, track, timeline, { id: `clip-${templateId}` }));

    expect(clips).toHaveLength(5);
    expect(clips.every((clip) => clip.type === 'text')).toBe(true);
    expect(clips.every((clip) => Object.keys(clip.keyframes ?? {}).length > 0)).toBe(true);
  });

  it('places templates at the requested start and scales keyframe timing to custom duration', () => {
    const timeline = createDefaultTimeline();
    const track = createTrack({ id: 'track-text', type: 'text', name: 'Text 1', clips: [] });

    const clip = instantiateTitleTemplate('fullscreen-title', track, timeline, {
      id: 'clip-title',
      name: 'Opening',
      text: 'Factory',
      start: 2,
      duration: 8,
      color: '#22c55e'
    });

    expect(clip).toMatchObject({
      id: 'clip-title',
      name: 'Opening',
      text: 'Factory',
      start: 2,
      duration: 8,
      style: { color: '#22c55e' }
    });
    expect(clip.keyframes?.opacity?.at(-1)?.time).toBe(8);
  });

  it('rejects non-text tracks', () => {
    const timeline = createDefaultTimeline();
    const track = createTrack({ id: 'track-video', type: 'video', name: 'Video 1', clips: [] });

    expect(() => instantiateTitleTemplate('lower-third', track, timeline)).toThrow('text tracks');
  });
});

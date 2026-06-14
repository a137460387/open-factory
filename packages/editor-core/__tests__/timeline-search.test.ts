import { describe, expect, it } from 'vitest';
import { createTimelineSearchJump, createTrack, searchTimeline } from '../src';
import { makeAudioClip, makeImageClip, makeProject, makeSubtitleClip, makeVideoClip } from './test-utils';

describe('timeline search', () => {
  it('returns no results for an empty query without active filters', () => {
    const project = makeSearchProject();

    expect(searchTimeline(project, { query: '' }).results).toEqual([]);
  });

  it('filters clips by multiple conditions', () => {
    const project = makeSearchProject();

    expect(
      searchTimeline(project, {
        query: '',
        mediaFilter: 'video',
        effectFilter: 'has-effects',
        keyframeFilter: 'has-keyframes'
      }).results.map((result) => result.id)
    ).toEqual(['clip-video']);

    expect(searchTimeline(project, { query: '', mediaFilter: 'audio', effectFilter: 'no-effects' }).results.map((result) => result.id)).toEqual(['clip-audio']);
  });

  it('filters clips with no keyframes', () => {
    const project = makeSearchProject();

    expect(searchTimeline(project, { query: '', keyframeFilter: 'no-keyframes' }).results.map((result) => result.id)).toEqual(['clip-audio', 'clip-image', 'clip-subtitle']);
  });

  it('filters image and subtitle clips by type', () => {
    const project = makeSearchProject();

    expect(searchTimeline(project, { query: '', mediaFilter: 'image' }).results.map((result) => result.id)).toEqual(['clip-image']);
    expect(searchTimeline(project, { query: '', mediaFilter: 'subtitle' }).results.map((result) => result.id)).toEqual(['clip-subtitle']);
  });

  it('does not include marker results while clip filters are active', () => {
    const project = makeSearchProject();

    expect(searchTimeline(project, { query: 'Review marker', mediaFilter: 'video' }).results).toEqual([]);
    expect(searchTimeline(project, { query: 'Review marker', effectFilter: 'no-effects' }).results).toEqual([]);
  });

  it('supports regular expression matching', () => {
    const project = makeSearchProject();

    expect(searchTimeline(project, { query: '^Scene\\s+\\d+$', useRegex: true }).results.map((result) => result.id)).toEqual(['clip-video']);
    expect(searchTimeline(project, { query: '[', useRegex: true })).toEqual({ results: [], error: 'invalid-regex' });
  });

  it('matches media paths case-insensitively', () => {
    const project = makeSearchProject();

    expect(searchTimeline(project, { query: 'c:/media/SCENE' }).results.map((result) => result.id)).toEqual(['clip-video']);
  });

  it('searches effect type, subtitle text, color label, file name, group name, and marker name', () => {
    const project = makeSearchProject();

    expect(searchTimeline(project, { query: 'motion-blur' }).results.map((result) => result.id)).toEqual(['clip-video']);
    expect(searchTimeline(project, { query: 'caption line' }).results.map((result) => result.id)).toEqual(['clip-subtitle']);
    expect(searchTimeline(project, { query: 'blue' }).results.map((result) => result.id)).toContain('clip-image');
    expect(searchTimeline(project, { query: 'dialogue.wav' }).results.map((result) => result.id)).toEqual(['clip-audio']);
    expect(searchTimeline(project, { query: 'Interview group' }).results.map((result) => result.id)).toEqual(['clip-video']);
    expect(searchTimeline(project, { query: 'Review marker' }).results.map((result) => result.id)).toEqual(['marker-review']);
  });

  it('sorts clips before markers at the same start time', () => {
    const project = makeSearchProject();
    project.timeline.markers = [{ id: 'marker-scene', time: 1, label: 'Scene marker', color: '#f97316' }];

    expect(searchTimeline(project, { query: 'Scene' }).results.map((result) => `${result.kind}:${result.id}`)).toEqual(['clip:clip-video', 'marker:marker-scene']);
  });

  it('builds jump state that selects clip results but not marker results', () => {
    const project = makeSearchProject();
    const [clipResult] = searchTimeline(project, { query: 'Scene' }).results;
    const [markerResult] = searchTimeline(project, { query: 'Review marker' }).results;

    expect(createTimelineSearchJump(clipResult)).toEqual({ playheadTime: 1, selectedClipIds: ['clip-video'] });
    expect(createTimelineSearchJump(markerResult)).toEqual({ playheadTime: 4, selectedClipIds: [] });
  });
});

function makeSearchProject() {
  const project = makeProject();
  const video = makeVideoClip({
    id: 'clip-video',
    name: 'Scene 12',
    mediaId: 'asset-video',
    start: 1,
    effects: [{ id: 'effect-motion', type: 'motion-blur', enabled: true, params: { intensity: 0.5, angle: 0, samples: 8 } }],
    keyframes: { opacity: [{ id: 'opacity-1', time: 0.5, value: 0.5, easing: 'linear' }] }
  });
  const image = makeImageClip({ id: 'clip-image', name: 'Plate', mediaId: 'asset-image', start: 3, colorLabel: 'blue' });
  const audio = makeAudioClip({ id: 'clip-audio', name: 'Dialogue', mediaId: 'asset-audio', start: 2 });
  const subtitle = makeSubtitleClip({ id: 'clip-subtitle', name: 'Subtitle', text: 'Caption line one', start: 5 });
  const timeline = {
    transitions: [],
    markers: [{ id: 'marker-review', time: 4, label: 'Review marker', color: '#f97316' }],
    tracks: [
      createTrack({ id: 'track-video', type: 'video', name: 'Video 1', color: 'blue', clips: [video, image] }),
      createTrack({ id: 'track-audio', type: 'audio', name: 'Audio 1', clips: [audio] }),
      createTrack({ id: 'track-subtitle', type: 'subtitle', name: 'Subtitles', clips: [subtitle] })
    ]
  };
  return {
    ...project,
    media: [
      { id: 'asset-video', type: 'video' as const, name: 'scene.mov', path: 'C:/Media/scene.mov', duration: 10, width: 1920, height: 1080 },
      { id: 'asset-image', type: 'image' as const, name: 'plate.png', path: 'C:/Media/plate.png', duration: 0, width: 1280, height: 720 },
      { id: 'asset-audio', type: 'audio' as const, name: 'dialogue.wav', path: 'C:/Media/dialogue.wav', duration: 10, width: 0, height: 0 }
    ],
    timeline,
    clipGroups: [{ id: 'group-interview', name: 'Interview group', clipIds: ['clip-video'], color: 'blue' as const }]
  };
}

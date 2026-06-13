import { describe, expect, it } from 'vitest';
import { applyTimelineVersionDiffSelection, createTrack, diffTimelineSnapshots, diffTimelineVersions } from '../src';
import { makeAudioClip, makeSubtitleClip, makeTextClip, makeTimeline, makeVideoClip } from './test-utils';

describe('timeline snapshot compare', () => {
  it('returns changed time ranges when clip timing differs between versions', () => {
    const snapshot = makeTimeline([makeVideoClip({ id: 'clip-a', start: 0, duration: 2 })]);
    const current = makeTimeline([makeVideoClip({ id: 'clip-a', start: 0, duration: 1 }), makeVideoClip({ id: 'clip-b', start: 1, duration: 1 })]);

    expect(diffTimelineSnapshots(current, snapshot)).toEqual([{ start: 0, end: 2 }]);
  });

  it('detects property-only changes over the clip range', () => {
    const snapshot = makeTimeline([makeTextClip({ id: 'title', start: 0.5, duration: 2, text: 'Before' })]);
    const current = makeTimeline([makeTextClip({ id: 'title', start: 0.5, duration: 2, text: 'After' })]);

    expect(diffTimelineSnapshots(current, snapshot)).toEqual([{ start: 0.5, end: 2.5 }]);
  });

  it('merges adjacent changed ranges', () => {
    const snapshot = makeTimeline([makeVideoClip({ id: 'clip-a', start: 0, duration: 3 })]);
    const current = makeTimeline([
      makeVideoClip({ id: 'clip-a', start: 0, duration: 1 }),
      makeVideoClip({ id: 'clip-b', start: 1, duration: 1 }),
      makeVideoClip({ id: 'clip-c', start: 2, duration: 1 })
    ]);

    expect(diffTimelineSnapshots(current, snapshot)).toEqual([{ start: 0, end: 3 }]);
  });

  it('classifies added, deleted, and modified clips with changed fields', () => {
    const before = makeTimeline([
      makeVideoClip({ id: 'clip-a', start: 0, duration: 2, name: 'A' }),
      makeVideoClip({ id: 'clip-deleted', start: 3, duration: 1, name: 'Deleted' })
    ]);
    const after = makeTimeline([
      makeVideoClip({ id: 'clip-a', start: 0, duration: 3, name: 'A changed' }),
      makeVideoClip({ id: 'clip-added', start: 4, duration: 1, name: 'Added' })
    ]);

    const diff = diffTimelineVersions(before, after);

    expect(diff.summary).toEqual({ added: 1, deleted: 1, modified: 1, trackChanges: 0 });
    expect(diff.items.find((item) => item.id === 'clip-modified:clip-a')?.fields.map((field) => field.field)).toEqual(
      expect.arrayContaining(['duration', 'name'])
    );
  });

  it('applies only selected snapshot differences to a target timeline', () => {
    const current = makeTimeline([
      makeVideoClip({ id: 'clip-a', start: 0, duration: 3, name: 'Current' }),
      makeVideoClip({ id: 'clip-extra', start: 4, duration: 1, name: 'Extra' })
    ]);
    const snapshot = makeTimeline([makeVideoClip({ id: 'clip-a', start: 0, duration: 2, name: 'Snapshot' })]);

    const merged = applyTimelineVersionDiffSelection(current, snapshot, ['clip-modified:clip-a']);

    const clips = merged.tracks[0].clips;
    expect(clips.find((clip) => clip.id === 'clip-a')).toMatchObject({ duration: 2, name: 'Snapshot' });
    expect(clips.some((clip) => clip.id === 'clip-extra')).toBe(true);
  });

  it('reports added and removed tracks separately from clip edits', () => {
    const removedTrack = createTrack({
      id: 'track-old',
      type: 'video',
      name: 'Old overlays',
      muted: true,
      clips: [makeVideoClip({ id: 'old-overlay', trackId: 'track-old', name: 'Old overlay' })]
    });
    const addedTrack = createTrack({
      id: 'track-new',
      type: 'subtitle',
      name: 'New captions',
      locked: true,
      clips: [makeSubtitleClip({ id: 'new-caption', trackId: 'track-new', text: 'Caption' })]
    });
    const before = { ...makeTimeline(), tracks: [...makeTimeline().tracks, removedTrack] };
    const after = { ...makeTimeline(), tracks: [...makeTimeline().tracks, addedTrack] };

    const diff = diffTimelineVersions(before, after);

    expect(diff.summary).toMatchObject({ added: 1, deleted: 1, modified: 0, trackChanges: 2 });
    expect(diff.items.find((item) => item.id === 'track-added:track-new')).toMatchObject({
      type: 'track-added',
      fields: [{ field: 'track', before: null, after: expect.objectContaining({ type: 'subtitle', locked: true, clipCount: 1 }) }]
    });
    expect(diff.items.find((item) => item.id === 'track-removed:track-old')).toMatchObject({
      type: 'track-removed',
      fields: [{ field: 'track', before: expect.objectContaining({ type: 'video', muted: true, clipCount: 1 }), after: null }]
    });
  });

  it('keeps the target unchanged when no version diff items are selected', () => {
    const target = makeTimeline([makeVideoClip({ id: 'clip-a', duration: 2 })]);
    const source = makeTimeline([makeVideoClip({ id: 'clip-a', duration: 4 })]);

    expect(applyTimelineVersionDiffSelection(target, source, [])).toBe(target);
  });

  it('cherry-picks added and deleted clips without applying unselected changes', () => {
    const current = makeTimeline([
      makeVideoClip({ id: 'keep', start: 0, duration: 2, name: 'Keep' }),
      makeVideoClip({ id: 'remove-me', start: 2, duration: 1, name: 'Remove me' })
    ]);
    const source = makeTimeline([
      makeVideoClip({ id: 'keep', start: 0, duration: 5, name: 'Keep changed' }),
      makeVideoClip({ id: 'add-me', start: 5, duration: 1, name: 'Add me' })
    ]);

    const merged = applyTimelineVersionDiffSelection(current, source, ['clip-added:add-me', 'clip-deleted:remove-me']);
    const clips = merged.tracks[0].clips;

    expect(clips.map((clip) => clip.id)).toEqual(['keep', 'add-me']);
    expect(clips.find((clip) => clip.id === 'keep')).toMatchObject({ duration: 2, name: 'Keep' });
  });

  it('cherry-picks track additions and removals', () => {
    const current = {
      ...makeTimeline(),
      tracks: [
        ...makeTimeline().tracks,
        createTrack({
          id: 'track-extra',
          type: 'video',
          name: 'Extra',
          clips: [makeVideoClip({ id: 'extra-clip', trackId: 'track-extra' })]
        })
      ]
    };
    const source = {
      ...makeTimeline(),
      tracks: [
        ...makeTimeline().tracks,
        createTrack({
          id: 'track-captions',
          type: 'subtitle',
          name: 'Captions',
          clips: [makeSubtitleClip({ id: 'caption-clip', trackId: 'track-captions' })]
        })
      ]
    };

    const merged = applyTimelineVersionDiffSelection(current, source, ['track-added:track-captions', 'track-removed:track-extra']);

    expect(merged.tracks.some((track) => track.id === 'track-captions')).toBe(true);
    expect(merged.tracks.some((track) => track.id === 'track-extra')).toBe(false);
  });

  it('creates a matching track when applying an added clip whose source track is missing', () => {
    const current = makeTimeline();
    const source = {
      ...makeTimeline(),
      tracks: [
        ...makeTimeline().tracks,
        createTrack({
          id: 'track-voice',
          type: 'audio',
          name: 'Voice',
          clips: [makeAudioClip({ id: 'voice-clip', trackId: 'track-voice', start: 3 })]
        })
      ]
    };

    const merged = applyTimelineVersionDiffSelection(current, source, ['clip-added:voice-clip']);
    const voiceTrack = merged.tracks.find((track) => track.id === 'track-voice');

    expect(voiceTrack).toMatchObject({ id: 'track-voice', type: 'audio', name: 'track-voice' });
    expect(voiceTrack?.clips[0]).toMatchObject({ id: 'voice-clip', trackId: 'track-voice', start: 3 });
  });

  it('moves a modified clip between tracks when the track id changed', () => {
    const current = makeTimeline([makeTextClip({ id: 'title', trackId: 'track-text', text: 'Draft' })]);
    const source = {
      ...makeTimeline(),
      tracks: [
        ...makeTimeline().tracks,
        createTrack({
          id: 'track-subtitle',
          type: 'subtitle',
          name: 'Subtitles',
          clips: [makeSubtitleClip({ id: 'title', trackId: 'track-subtitle', text: 'Final' })]
        })
      ]
    };

    const diff = diffTimelineVersions(current, source);
    const moved = applyTimelineVersionDiffSelection(current, source, ['clip-modified:title']);

    expect(diff.items.find((item) => item.id === 'clip-modified:title')?.fields).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'trackId', before: 'track-text', after: 'track-subtitle' })])
    );
    expect(moved.tracks.find((track) => track.id === 'track-text')?.clips).toEqual([]);
    expect(moved.tracks.find((track) => track.id === 'track-subtitle')?.clips[0]).toMatchObject({ id: 'title', text: 'Final' });
  });
});

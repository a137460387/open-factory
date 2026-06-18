import { describe, expect, it } from 'vitest';
import {
  BrollInsertCommand,
  CommandManager,
  DialogueRoughCutCommand,
  RhythmAssembleCommand,
  buildBrollInsertClips,
  buildDialogueRoughCutClips,
  buildRhythmAssembleClips,
  createTrack,
  scoreBrollKeywordMatch,
  type ClipContentAnalysis,
  type MediaAsset
} from '../src';
import { makeAccessor, makeImageClip, makeTimeline, makeVideoClip } from './test-utils';

describe('smart rough cut v2', () => {
  it('builds one dialogue rough cut clip per detected voice interval', () => {
    const source = makeVideoClip({ id: 'dialogue-source', duration: 8, trimStart: 2 });
    const clips = buildDialogueRoughCutClips(source, [
      { start: 0.5, end: 1.5, confidence: 0.8 },
      { start: 3, end: 4.25, confidence: 0.9 },
      { start: 7.5, end: 9, confidence: 0.7 }
    ]);

    expect(clips).toHaveLength(3);
    expect(clips.map((clip) => [clip.start, clip.duration, clip.trimStart])).toEqual([
      [0, 1, 2.5],
      [1, 1.25, 5],
      [2.25, 0.5, 9.5]
    ]);
  });

  it('normalizes dialogue intervals with reversed bounds and duration fallback', () => {
    const source = makeVideoClip({ id: 'dialogue-normalized', start: 3, duration: 5 });
    const clips = buildDialogueRoughCutClips(source, [
      { start: 2.5, end: 1.5 },
      { start: Number.NaN, end: Number.NaN, duration: 0.75 },
      { start: 9, end: 10 }
    ]);

    expect(clips.map((clip) => [clip.start, clip.duration, clip.trimStart])).toEqual([
      [3, 0.75, 0],
      [3.75, 1, 1.5]
    ]);
  });

  it('applies DialogueRoughCutCommand with undo support', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-dialogue', duration: 4 })]));
    const manager = new CommandManager();

    manager.execute(
      new DialogueRoughCutCommand(accessor, 'clip-dialogue', [
        { start: 0.25, end: 1 },
        { start: 2, end: 3 }
      ])
    );
    expect(accessor.current().tracks[0].clips.map((clip) => clip.id)).toEqual(['clip-dialogue-dialogue-1', 'clip-dialogue-dialogue-2']);

    manager.undo();
    expect(accessor.current().tracks[0].clips.map((clip) => clip.id)).toEqual(['clip-dialogue']);
  });

  it('rejects empty dialogue command input', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-empty-dialogue', duration: 4 })]));

    expect(() => new DialogueRoughCutCommand(accessor, 'clip-empty-dialogue', []).execute()).toThrow('No dialogue intervals');
  });

  it('scores B-roll keyword and scene matches above unrelated candidates', () => {
    const main = makeVideoClip({
      name: 'interview close up',
      contentAnalysis: analysis('dialogue', ['dialogue', 'close-up'], 'interview close up')
    });
    const matching = {
      name: 'close up interview reaction',
      type: 'video',
      contentAnalysis: analysis('dialogue', ['dialogue', 'close-up'], 'speaker reaction')
    };
    const unrelated = {
      name: 'night action street',
      type: 'video',
      contentAnalysis: analysis('night', ['night', 'action'], 'street chase')
    };

    expect(scoreBrollKeywordMatch(main, matching)).toBeGreaterThan(scoreBrollKeywordMatch(main, unrelated));
    expect(scoreBrollKeywordMatch(main, matching)).toBeGreaterThan(0.5);
  });

  it('returns zero B-roll score when both sides have no usable tags or tokens', () => {
    expect(scoreBrollKeywordMatch({}, {})).toBe(0);
  });

  it('builds B-roll clips from clip and image media candidates while skipping audio-only candidates', () => {
    const main = makeVideoClip({ id: 'main-b', name: 'outdoor action', start: 1, duration: 3, contentAnalysis: analysis('outdoor', ['outdoor', 'action'], 'wide action') });
    const imageAsset: MediaAsset = {
      id: 'asset-image',
      type: 'image',
      name: 'outdoor still.png',
      path: 'C:/Media/outdoor-still.png',
      duration: 0,
      width: 1920,
      height: 1080
    };
    const audioAsset: MediaAsset = {
      id: 'asset-audio',
      type: 'audio',
      name: 'outdoor ambience.wav',
      path: 'C:/Media/outdoor-ambience.wav',
      duration: 3,
      width: 0,
      height: 0
    };
    const imageClip = makeImageClip({ id: 'image-broll', name: 'outdoor action card', duration: 6, contentAnalysis: analysis('outdoor', ['outdoor'], 'action card') });

    expect(buildBrollInsertClips([main], [{ kind: 'media', asset: audioAsset }], 'track-broll')).toEqual([]);
    expect(buildBrollInsertClips([main], [{ kind: 'media', asset: imageAsset }], '')).toEqual([]);
    expect(buildBrollInsertClips([main], [{ kind: 'media', asset: imageAsset }], 'track-broll')[0]).toMatchObject({
      id: 'asset-image-broll-main-b',
      type: 'image',
      duration: 3
    });
    expect(
      buildBrollInsertClips(
        [main],
        [
          { kind: 'media', asset: imageAsset, contentAnalysis: analysis('outdoor', ['outdoor'], 'still') },
          { kind: 'clip', clip: imageClip, keywords: ['outdoor', 'action'] }
        ],
        'track-broll'
      )[0]
    ).toMatchObject({ id: 'image-broll-broll-main-b', type: 'image', trackId: 'track-broll', start: 1, duration: 3 });
  });

  it('aligns rhythm assembled clip durations to beat intervals', () => {
    const clips = buildRhythmAssembleClips(
      [makeVideoClip({ id: 'clip-a', duration: 5 }), makeVideoClip({ id: 'clip-b', start: 6, duration: 5 })],
      [0, 1.25, 2, 3.5],
      'track-video'
    );

    expect(clips.map((clip) => [clip.id, clip.start, clip.duration])).toEqual([
      ['clip-a-rhythm-1', 0, 1.25],
      ['clip-b-rhythm-2', 1.25, 0.75],
      ['clip-a-rhythm-3', 2, 1.5]
    ]);
  });

  it('uses the first source track for rhythm assembly and ignores invalid beat points', () => {
    const clips = buildRhythmAssembleClips([makeVideoClip({ id: 'clip-default-track', trackId: 'track-a', duration: 3 })], [-1, 2, 1, 1, 3]);

    expect(clips.map((clip) => [clip.trackId, clip.start, clip.duration])).toEqual([
      ['track-a', 1, 1],
      ['track-a', 2, 1]
    ]);
    expect(buildRhythmAssembleClips([], [0, 1], 'track-video')).toEqual([]);
    expect(buildRhythmAssembleClips([makeVideoClip()], [0], 'track-video')).toEqual([]);
  });

  it('undoes RhythmAssembleCommand and restores the original clips', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-a', duration: 4 }), makeVideoClip({ id: 'clip-b', start: 5, duration: 4 })]));
    const manager = new CommandManager();

    manager.execute(new RhythmAssembleCommand(accessor, ['clip-a', 'clip-b'], [0, 1, 2, 3], 'track-video'));
    expect(accessor.current().tracks[0].clips.map((clip) => clip.id)).toEqual(['clip-a-rhythm-1', 'clip-b-rhythm-2', 'clip-a-rhythm-3']);

    manager.undo();
    expect(accessor.current().tracks[0].clips.map((clip) => clip.id)).toEqual(['clip-a', 'clip-b']);
  });

  it('inserts B-roll clips onto the selected target track', () => {
    const brollTrack = createTrack({ id: 'track-broll', type: 'video', name: 'B-roll', clips: [] });
    const main = makeVideoClip({ id: 'main-a', name: 'dialogue main', duration: 2, contentAnalysis: analysis('dialogue', ['dialogue'], 'speaker') });
    const asset: MediaAsset = {
      id: 'asset-broll',
      type: 'video',
      name: 'speaker reaction.mp4',
      path: 'C:/Media/speaker-reaction.mp4',
      duration: 6,
      width: 1920,
      height: 1080
    };
    const clips = buildBrollInsertClips([main], [{ kind: 'media', asset, contentAnalysis: analysis('dialogue', ['dialogue'], 'speaker') }], brollTrack.id);
    const accessor = makeAccessor({ ...makeTimeline([main]), tracks: [...makeTimeline([main]).tracks, brollTrack] });

    new BrollInsertCommand(accessor, clips).execute();

    expect(accessor.current().tracks.find((track) => track.id === 'track-broll')?.clips[0]).toMatchObject({
      mediaId: 'asset-broll',
      trackId: 'track-broll',
      start: 0,
      duration: 2
    });
  });

  it('rejects empty B-roll and rhythm command payloads', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-a', duration: 2 })]));

    expect(() => new BrollInsertCommand(accessor, []).execute()).toThrow('No B-roll clips');
    expect(() => new RhythmAssembleCommand(accessor, [], [0, 1], 'track-video').execute()).toThrow('No rhythm clips');
  });
});

function analysis(primarySceneType: ClipContentAnalysis['primarySceneType'], sceneTypes: ClipContentAnalysis['sceneTypes'], summary: string): ClipContentAnalysis {
  return {
    version: 1,
    analyzedAt: new Date(0).toISOString(),
    primarySceneType,
    sceneTypes,
    segments: [],
    emotionCurve: [],
    dialogueTurns: [],
    summary
  };
}

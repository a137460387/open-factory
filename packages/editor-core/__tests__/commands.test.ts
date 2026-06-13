import { describe, expect, it } from 'vitest';
import {
  AddAdjustmentLayerCommand,
  AddClipCommand,
  AddEffectCommand,
  AddKeyframeCommand,
  AddMaskCommand,
  AddProjectAnnotationCommand,
  AddSubtitleClipCommand,
  AddTrackCommand,
  AddTimelineMarkerCommand,
  ApplyTextAnimationCommand,
  AddTransitionCommand,
  DEFAULT_COLOR_CORRECTION,
  type Command,
  CommandManager,
  CloseGapCommand,
  DeleteClipCommand,
  DeleteClipsCommand,
  ImportEDLCommand,
  LoadProjectCommand,
  MoveClipCommand,
  MoveClipsCommand,
  PackNestedSequenceCommand,
  RemoveEffectCommand,
  RemoveMaskCommand,
  RemoveProjectAnnotationCommand,
  RemoveKeyframeCommand,
  RemoveTimelineMarkerCommand,
  RemoveTransitionCommand,
  ReorderEffectsCommand,
  RemoveSilenceCommand,
  RippleDeleteCommand,
  RollingTrimCommand,
  SlideClipCommand,
  SlipClipCommand,
  SplitClipCommand,
  SplitClipAtTimesCommand,
  TrimClipCommand,
  UpdateKeyframeCommand,
  UpdateClipCommand,
  UpdateEffectCommand,
  UpdateProjectAnnotationCommand,
  UpdateTimelineMarkerCommand,
  UpdateMaskCommand,
  UpdateProjectAudioCommand,
  UpdateTrackCommand,
  createTrack
} from '../src';
import { makeAccessor, makeAdjustmentClip, makeAudioClip, makeProject, makeSubtitleClip, makeTextClip, makeTimeline, makeVideoClip } from './test-utils';

describe('timeline commands', () => {
  it('loads a project with undo and redo support', () => {
    let project = makeProject();
    const beforeId = project.id;
    const restored = { ...makeProject(), id: 'project-restored', name: 'Restored Snapshot' };
    const accessor = {
      getProject: () => project,
      setProject: (next: typeof project) => {
        project = next;
      }
    };
    const manager = new CommandManager();

    manager.execute(new LoadProjectCommand(accessor, restored));
    expect(project.id).toBe('project-restored');
    expect(project.name).toBe('Restored Snapshot');

    manager.undo();
    expect(project.id).toBe(beforeId);

    manager.redo();
    expect(project.id).toBe('project-restored');
  });

  it('imports an EDL as an undoable active sequence with missing media placeholders', () => {
    let project = makeProject();
    const accessor = {
      getProject: () => project,
      setProject: (next: typeof project) => {
        project = next;
      }
    };
    const manager = new CommandManager();
    const command = new ImportEDLCommand(
      accessor,
      [
        'TITLE: Command Import',
        '001  AX       V     C        00:00:00:00 00:00:01:00 00:00:00:00 00:00:01:00',
        '* FROM CLIP NAME: sample.mp4',
        '002  AX       V     C        00:00:00:00 00:00:01:00 00:00:01:00 00:00:02:00',
        '* FROM CLIP NAME: Offline.mov'
      ].join('\n')
    );

    manager.execute(command);

    expect(command.result).toMatchObject({ matchedCount: 1, missingCount: 1 });
    expect(project.activeSequenceId).toBe(command.result?.sequence.id);
    expect(project.timeline.tracks[0].clips).toHaveLength(2);
    expect(project.media.some((asset) => asset.name === 'Offline.mov' && asset.missing)).toBe(true);

    manager.undo();
    expect(project.activeSequenceId).not.toBe(command.result?.sequence.id);
    expect(project.media.some((asset) => asset.name === 'Offline.mov')).toBe(false);

    manager.redo();
    expect(project.activeSequenceId).toBe(command.result?.sequence.id);
    expect(project.timeline.tracks[0].clips).toHaveLength(2);
  });

  it('adds tracks and clips with undo/redo', () => {
    const accessor = makeAccessor(makeTimeline());
    const manager = new CommandManager();
    const clip = makeVideoClip();

    manager.execute(new AddTrackCommand(accessor, { id: 'track-extra', type: 'video', name: 'Video 2', clips: [] }));
    expect(accessor.current().tracks).toHaveLength(4);
    manager.undo();
    expect(accessor.current().tracks).toHaveLength(3);
    manager.redo();
    expect(accessor.current().tracks).toHaveLength(4);

    manager.execute(new AddClipCommand(accessor, clip));
    expect(accessor.current().tracks[0].clips).toHaveLength(1);
    manager.undo();
    expect(accessor.current().tracks[0].clips).toHaveLength(0);
    manager.redo();
    expect(accessor.current().tracks[0].clips[0].id).toBe(clip.id);
  });

  it('adds adjustment layers as one undoable command', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-base', duration: 4 })]));
    const manager = new CommandManager();
    const track = createTrack({ id: 'track-adjustment', type: 'video', name: 'Adjustment', clips: [] });
    const clip = makeAdjustmentClip({ id: 'adjustment-a', trackId: 'track-adjustment', duration: 4 });

    manager.execute(new AddAdjustmentLayerCommand(accessor, track, clip));
    expect(accessor.current().tracks.at(-1)?.id).toBe('track-adjustment');
    expect(accessor.current().tracks.at(-1)?.clips.map((item) => item.id)).toEqual(['adjustment-a']);

    manager.undo();
    expect(accessor.current().tracks.some((item) => item.id === 'track-adjustment')).toBe(false);

    manager.redo();
    expect(accessor.current().tracks.at(-1)?.clips[0].type).toBe('adjustment');
  });

  it('adds adjustment layers to existing tracks and rejects overlaps', () => {
    const track = createTrack({ id: 'track-adjustment', type: 'video', name: 'Adjustment', clips: [] });
    const accessor = makeAccessor({ ...makeTimeline(), tracks: [...makeTimeline().tracks, track] });
    const manager = new CommandManager();

    manager.execute(new AddAdjustmentLayerCommand(accessor, track, makeAdjustmentClip({ id: 'adjustment-a', trackId: 'track-adjustment', start: 0, duration: 2 })));
    expect(accessor.current().tracks.find((item) => item.id === 'track-adjustment')?.clips).toHaveLength(1);
    expect(() =>
      manager.execute(new AddAdjustmentLayerCommand(accessor, track, makeAdjustmentClip({ id: 'adjustment-b', trackId: 'track-adjustment', start: 1, duration: 2 })))
    ).toThrow('overlaps');

    manager.undo();
    expect(accessor.current().tracks.find((item) => item.id === 'track-adjustment')?.clips).toHaveLength(0);
  });

  it('adds subtitle clips only to subtitle tracks with undo and redo', () => {
    const accessor = makeAccessor({
      ...makeTimeline(),
      tracks: [
        ...makeTimeline().tracks,
        createTrack({ id: 'track-subtitle', type: 'subtitle', name: 'Subtitle 1', clips: [] })
      ]
    });
    const manager = new CommandManager();
    const subtitle = makeSubtitleClip({ id: 'subtitle-a', trackId: 'track-subtitle', start: 0, duration: 1.5 });

    manager.execute(new AddSubtitleClipCommand(accessor, subtitle));
    expect(accessor.current().tracks.find((track) => track.id === 'track-subtitle')?.clips).toHaveLength(1);

    manager.undo();
    expect(accessor.current().tracks.find((track) => track.id === 'track-subtitle')?.clips).toHaveLength(0);

    manager.redo();
    expect(accessor.current().tracks.find((track) => track.id === 'track-subtitle')?.clips.map((clip) => clip.id)).toEqual(['subtitle-a']);
    expect(() => manager.execute(new AddSubtitleClipCommand(accessor, makeSubtitleClip({ id: 'subtitle-overlap', trackId: 'track-subtitle', start: 0.5, duration: 1 })))).toThrow('overlaps');
    expect(() => manager.execute(new AddSubtitleClipCommand(accessor, makeSubtitleClip({ id: 'subtitle-wrong-track', trackId: 'track-text' })))).toThrow('subtitle tracks');
  });

  it('updates track controls with undo and redo', () => {
    const accessor = makeAccessor(makeTimeline());
    const manager = new CommandManager();

    manager.execute(new UpdateTrackCommand(accessor, 'track-video', { muted: true, solo: true, locked: true, volume: 0.5, pan: -0.75 }));
    expect(accessor.current().tracks[0]).toMatchObject({ muted: true, solo: true, locked: true, volume: 0.5, pan: -0.75 });

    manager.undo();
    expect(accessor.current().tracks[0]).toMatchObject({ muted: false, solo: false, locked: false, volume: 1, pan: 0 });

    manager.redo();
    expect(accessor.current().tracks[0]).toMatchObject({ muted: true, solo: true, locked: true, volume: 0.5, pan: -0.75 });
  });

  it('updates track EQ and compressor controls with undo and redo', () => {
    const accessor = makeAccessor(makeTimeline());
    const manager = new CommandManager();

    manager.execute(
      new UpdateTrackCommand(accessor, 'track-video', {
        eq: {
          enabled: true,
          bands: [
            { id: 'eq-low', type: 'lowshelf', frequency: 90, gain: 3, q: 0.8 },
            { id: 'eq-low-mid', type: 'peaking', frequency: 450, gain: -2, q: 1.2 },
            { id: 'eq-high-mid', type: 'peaking', frequency: 3000, gain: 0, q: 1 },
            { id: 'eq-high', type: 'highshelf', frequency: 9000, gain: 1.5, q: 0.7 }
          ]
        },
        compressor: { enabled: true, threshold: -24, ratio: 4, attack: 12, release: 180, makeupGain: 6 }
      })
    );
    expect(accessor.current().tracks[0].eq?.bands.map((band) => band.gain)).toEqual([3, -2, 0, 1.5]);
    expect(accessor.current().tracks[0].compressor).toMatchObject({ enabled: true, threshold: -24, ratio: 4, attack: 12, release: 180, makeupGain: 6 });

    manager.undo();
    expect(accessor.current().tracks[0].eq?.bands.every((band) => band.gain === 0)).toBe(true);
    expect(accessor.current().tracks[0].compressor?.enabled).toBe(false);

    manager.redo();
    expect(accessor.current().tracks[0].eq?.bands[1]).toMatchObject({ frequency: 450, gain: -2, q: 1.2 });
    expect(accessor.current().tracks[0].compressor?.ratio).toBe(4);
  });

  it('adds and removes adjacent clip transitions with undo and redo', () => {
    const accessor = makeAccessor(
      makeTimeline([makeVideoClip({ id: 'a', start: 0, duration: 2 }), makeVideoClip({ id: 'b', start: 2, duration: 2 })])
    );
    const manager = new CommandManager();

    manager.execute(new AddTransitionCommand(accessor, { id: 'transition-1', type: 'dissolve', duration: 5, fromClipId: 'a', toClipId: 'b' }));
    expect(accessor.current().transitions).toEqual([{ id: 'transition-1', type: 'dissolve', duration: 1, fromClipId: 'a', toClipId: 'b' }]);

    manager.undo();
    expect(accessor.current().transitions).toEqual([]);

    manager.redo();
    expect(accessor.current().transitions?.[0].duration).toBe(1);

    manager.execute(new RemoveTransitionCommand(accessor, 'transition-1'));
    expect(accessor.current().transitions).toEqual([]);

    manager.undo();
    expect(accessor.current().transitions?.[0].id).toBe('transition-1');
  });

  it('rejects transitions between non-adjacent clips', () => {
    const accessor = makeAccessor(
      makeTimeline([makeVideoClip({ id: 'a', start: 0, duration: 2 }), makeVideoClip({ id: 'b', start: 3, duration: 2 })])
    );
    const manager = new CommandManager();

    expect(() => manager.execute(new AddTransitionCommand(accessor, { type: 'dissolve', duration: 0.5, fromClipId: 'a', toClipId: 'b' }))).toThrow(
      'adjacent'
    );
  });

  it('rejects duplicate transitions and keeps transition undo guards as no-ops', () => {
    const accessor = makeAccessor(
      makeTimeline([makeVideoClip({ id: 'a', start: 0, duration: 2 }), makeVideoClip({ id: 'b', start: 2, duration: 2 })])
    );
    const manager = new CommandManager();
    const add = new AddTransitionCommand(accessor, { id: 'transition-1', type: 'dissolve', duration: 0.5, fromClipId: 'a', toClipId: 'b' });
    const remove = new RemoveTransitionCommand(accessor, 'transition-1');

    add.undo();
    remove.undo();
    expect(accessor.current().transitions).toEqual([]);

    manager.execute(add);
    expect(() => manager.execute(new AddTransitionCommand(accessor, { type: 'fade-black', duration: 0.25, fromClipId: 'a', toClipId: 'b' }))).toThrow(
      'already exists'
    );
    expect(() => manager.execute(new RemoveTransitionCommand(accessor, 'missing-transition'))).toThrow('not found');
  });

  it('adds, updates, removes, and restores timeline markers', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-1', duration: 5 })]));
    const manager = new CommandManager();

    manager.execute(new AddTimelineMarkerCommand(accessor, { id: 'marker-b', time: 4, label: 'Outro', color: '#00aa55' }));
    manager.execute(new AddTimelineMarkerCommand(accessor, { id: 'marker-a', time: 1, label: 'Intro', color: '#3366ff' }));
    expect(accessor.current().markers).toEqual([
      { id: 'marker-a', time: 1, label: 'Intro', color: '#3366ff' },
      { id: 'marker-b', time: 4, label: 'Outro', color: '#00aa55' }
    ]);

    manager.execute(new UpdateTimelineMarkerCommand(accessor, 'marker-b', { time: 99, label: 'End', color: 'not-a-color' }));
    expect(accessor.current().markers?.at(-1)).toEqual({ id: 'marker-b', time: 5, label: 'End', color: '#f97316' });

    manager.execute(new RemoveTimelineMarkerCommand(accessor, 'marker-a'));
    expect(accessor.current().markers?.map((marker) => marker.id)).toEqual(['marker-b']);

    manager.undo();
    expect(accessor.current().markers?.map((marker) => marker.id)).toEqual(['marker-a', 'marker-b']);
    manager.undo();
    expect(accessor.current().markers?.find((marker) => marker.id === 'marker-b')?.label).toBe('Outro');
  });

  it('adds, updates, removes, and restores project annotations', () => {
    let project = makeProject();
    const accessor = {
      getProject: () => project,
      setProject: (next: typeof project) => {
        project = next;
      }
    };
    const manager = new CommandManager();

    manager.execute(new AddProjectAnnotationCommand(accessor, { id: 'annotation-a', time: 99, text: '  Needs trim  ', color: '#A78BFA' }));
    expect(project.annotations).toEqual([{ id: 'annotation-a', time: 10, text: 'Needs trim', color: '#a78bfa' }]);

    manager.execute(new UpdateProjectAnnotationCommand(accessor, 'annotation-a', { time: 2, text: 'Keep this beat', color: 'invalid' }));
    expect(project.annotations[0]).toEqual({ id: 'annotation-a', time: 2, text: 'Keep this beat', color: '#facc15' });

    manager.execute(new RemoveProjectAnnotationCommand(accessor, 'annotation-a'));
    expect(project.annotations).toEqual([]);

    manager.undo();
    expect(project.annotations[0].text).toBe('Keep this beat');
    manager.undo();
    expect(project.annotations[0].text).toBe('Needs trim');
    manager.undo();
    expect(project.annotations).toEqual([]);
    manager.redo();
    expect(project.annotations[0].id).toBe('annotation-a');
  });

  it('packs selected clips into a nested sequence with undo and redo', () => {
    let project = makeProject();
    project.timeline = makeTimeline([makeVideoClip({ id: 'clip-a', start: 0, duration: 2 }), makeVideoClip({ id: 'clip-b', start: 2, duration: 2 })]);
    const accessor = {
      getProject: () => project,
      setProject: (next: typeof project) => {
        project = next;
      }
    };
    const manager = new CommandManager();

    manager.execute(new PackNestedSequenceCommand(accessor, ['clip-a', 'clip-b'], 'Nested A'));

    const nestedClip = project.timeline.tracks[0].clips[0];
    expect(nestedClip).toMatchObject({ type: 'nested-sequence', name: 'Nested A', start: 0, duration: 4 });
    expect(project.sequences).toHaveLength(2);
    expect(project.sequences[1].timeline.tracks[0].clips.map((clip) => ({ id: clip.id, start: clip.start }))).toEqual([
      { id: 'clip-a', start: 0 },
      { id: 'clip-b', start: 2 }
    ]);

    manager.undo();
    expect(project.timeline.tracks[0].clips.map((clip) => clip.id)).toEqual(['clip-a', 'clip-b']);
    expect(project.sequences).toHaveLength(1);

    manager.redo();
    expect(project.timeline.tracks[0].clips[0].type).toBe('nested-sequence');
    expect(project.sequences).toHaveLength(2);
  });

  it('rejects updates and removals for missing timeline markers', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-1' })]));
    const manager = new CommandManager();

    expect(() => manager.execute(new UpdateTimelineMarkerCommand(accessor, 'missing-marker', { label: 'Missing' }))).toThrow('missing-marker not found');
    expect(() => manager.execute(new RemoveTimelineMarkerCommand(accessor, 'missing-marker'))).toThrow('missing-marker not found');
  });

  it('clamps track volume updates', () => {
    const accessor = makeAccessor(makeTimeline());
    const manager = new CommandManager();

    manager.execute(new UpdateTrackCommand(accessor, 'track-video', { volume: 9, pan: 9 }));
    expect(accessor.current().tracks[0].volume).toBe(2);
    expect(accessor.current().tracks[0].pan).toBe(1);
  });

  it('clamps track EQ and compressor updates', () => {
    const accessor = makeAccessor(makeTimeline());
    const manager = new CommandManager();

    manager.execute(
      new UpdateTrackCommand(accessor, 'track-video', {
        eq: {
          enabled: true,
          bands: [
            { id: 'eq-low', type: 'lowshelf', frequency: 5, gain: 99, q: 0.01 },
            { id: 'eq-low-mid', type: 'peaking', frequency: 50_000, gain: -99, q: 9 },
            { id: 'eq-high-mid', type: 'peaking', frequency: 2500, gain: 0, q: 1 },
            { id: 'eq-high', type: 'highshelf', frequency: 8000, gain: 0, q: 1 }
          ]
        },
        compressor: { enabled: true, threshold: -90, ratio: 99, attack: -1, release: 99_999, makeupGain: 99 }
      })
    );

    expect(accessor.current().tracks[0].eq?.bands[0]).toMatchObject({ frequency: 20, gain: 24, q: 0.1 });
    expect(accessor.current().tracks[0].eq?.bands[1]).toMatchObject({ frequency: 20000, gain: -24, q: 4 });
    expect(accessor.current().tracks[0].compressor).toMatchObject({ threshold: -60, ratio: 20, attack: 0.01, release: 9000, makeupGain: 24 });
  });

  it('updates project audio controls with undo and redo', () => {
    let project = makeProject();
    const accessor = {
      getProject: () => project,
      setProject: (next: typeof project) => {
        project = next;
      }
    };
    const manager = new CommandManager();

    manager.execute(new UpdateProjectAudioCommand(accessor, { masterVolume: 3 }));
    expect(project.masterVolume).toBe(2);

    manager.undo();
    expect(project.masterVolume).toBe(1);

    manager.redo();
    expect(project.masterVolume).toBe(2);
  });

  it('moves, trims, splits, deletes, and updates clips', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-1', duration: 10 })]));
    const manager = new CommandManager();

    manager.execute(new MoveClipCommand(accessor, 'clip-1', 2));
    expect(accessor.current().tracks[0].clips[0].start).toBe(2);

    manager.execute(new TrimClipCommand(accessor, 'clip-1', 1, 1));
    expect(accessor.current().tracks[0].clips[0].duration).toBe(8);

    manager.execute(new UpdateClipCommand(accessor, 'clip-1', { name: 'Renamed', transform: { opacity: 0.5 } }));
    expect(accessor.current().tracks[0].clips[0].name).toBe('Renamed');
    expect(accessor.current().tracks[0].clips[0].transform.opacity).toBe(0.5);

    manager.execute(new SplitClipCommand(accessor, 'clip-1', 5));
    expect(accessor.current().tracks[0].clips).toHaveLength(2);

    const firstSplitId = accessor.current().tracks[0].clips[0].id;
    manager.execute(new DeleteClipCommand(accessor, firstSplitId));
    expect(accessor.current().tracks[0].clips).toHaveLength(1);

    manager.undo();
    expect(accessor.current().tracks[0].clips).toHaveLength(2);
    manager.undo();
    expect(accessor.current().tracks[0].clips).toHaveLength(1);
  });

  it('updates clip uniform and independent canvas scale values', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-1', transform: { scale: 1, scaleX: 1, scaleY: 1 } })]));
    const manager = new CommandManager();

    manager.execute(new UpdateClipCommand(accessor, 'clip-1', { transform: { scale: 0.5 } }));
    expect(accessor.current().tracks[0].clips[0].transform).toMatchObject({ scale: 0.5, scaleX: 0.5, scaleY: 0.5 });

    manager.execute(new UpdateClipCommand(accessor, 'clip-1', { transform: { scaleX: 1.25, scaleY: 0.75 } }));
    expect(accessor.current().tracks[0].clips[0].transform).toMatchObject({ scale: 1, scaleX: 1.25, scaleY: 0.75 });

    manager.undo();
    expect(accessor.current().tracks[0].clips[0].transform).toMatchObject({ scale: 0.5, scaleX: 0.5, scaleY: 0.5 });
  });

  it('removes silent ranges as one undoable command', () => {
    const accessor = makeAccessor(makeTimeline([makeAudioClip({ id: 'clip-audio', duration: 2.5 })]));
    const manager = new CommandManager();

    manager.execute(new RemoveSilenceCommand(accessor, 'clip-audio', [{ start: 1, end: 1.5 }]));

    const clips = accessor.current().tracks[1].clips;
    expect(clips).toHaveLength(2);
    expect(clips.map((clip) => clip.start)).toEqual([0, 1]);
    expect(clips.map((clip) => clip.duration)).toEqual([1, 1]);
    expect(clips.map((clip) => clip.trimStart)).toEqual([0, 1.5]);
    expect(clips.map((clip) => clip.trimEnd)).toEqual([1.5, 0]);

    manager.undo();
    expect(accessor.current().tracks[1].clips).toEqual([makeAudioClip({ id: 'clip-audio', duration: 2.5 })]);

    manager.redo();
    expect(accessor.current().tracks[1].clips).toHaveLength(2);
  });

  it('normalizes silence ranges and rejects no-op or destructive silence removal', () => {
    const accessor = makeAccessor(makeTimeline([makeAudioClip({ id: 'clip-audio', duration: 3 })]));
    const manager = new CommandManager();

    manager.execute(
      new RemoveSilenceCommand(accessor, 'clip-audio', [
        { start: 2.5, end: 1.5 },
        { start: 1, end: 2 }
      ])
    );
    expect(accessor.current().tracks[1].clips.map((clip) => [clip.start, clip.duration, clip.trimStart])).toEqual([
      [0, 1, 0],
      [1, 0.5, 2.5]
    ]);

    const noOpAccessor = makeAccessor(makeTimeline([makeAudioClip({ id: 'clip-noop', duration: 3 })]));
    expect(() => new RemoveSilenceCommand(noOpAccessor, 'clip-noop', []).execute()).toThrow('No silence ranges');

    const fullAccessor = makeAccessor(makeTimeline([makeAudioClip({ id: 'clip-full', duration: 3 })]));
    expect(() => new RemoveSilenceCommand(fullAccessor, 'clip-full', [{ start: 0, end: 3 }]).execute()).toThrow('entire clip');

    new RemoveSilenceCommand(fullAccessor, 'clip-full', [{ start: 1, end: 2 }]).undo();
  });

  it('splits a clip at multiple scene times as one undoable command', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-scene', duration: 3 })]));
    const manager = new CommandManager();

    manager.execute(new SplitClipAtTimesCommand(accessor, 'clip-scene', [1, 2]));

    expect(accessor.current().tracks[0].clips.map((clip) => [clip.start, clip.duration, clip.trimStart, clip.trimEnd])).toEqual([
      [0, 1, 0, 2],
      [1, 1, 1, 1],
      [2, 1, 2, 0]
    ]);

    manager.undo();
    expect(accessor.current().tracks[0].clips).toEqual([makeVideoClip({ id: 'clip-scene', duration: 3 })]);
  });

  it('splits clip keyframes with scene split ranges and rejects invalid split points', () => {
    const accessor = makeAccessor(
      makeTimeline([
        makeVideoClip({
          id: 'clip-keyed-scene',
          duration: 2,
          keyframes: {
            opacity: [
              { id: 'kf-left', time: 0.5, value: 0.5, easing: 'linear' },
              { id: 'kf-right', time: 1.5, value: 0.25, easing: 'linear' }
            ]
          }
        })
      ])
    );

    new SplitClipAtTimesCommand(accessor, 'clip-keyed-scene', []).undo();
    const command = new SplitClipAtTimesCommand(accessor, 'clip-keyed-scene', [1]);
    command.execute();

    const clips = accessor.current().tracks[0].clips;
    expect(clips[0].keyframes?.opacity).toEqual([{ id: 'kf-left', time: 0.5, value: 0.5, easing: 'linear' }]);
    expect(clips[1].keyframes?.opacity).toEqual([{ id: 'kf-right', time: 0.5, value: 0.25, easing: 'linear' }]);

    const invalidAccessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-invalid', duration: 2 })]));
    expect(() => new SplitClipAtTimesCommand(invalidAccessor, 'clip-invalid', [0, 2]).execute()).toThrow('No valid split points');
  });

  it('adds, updates, removes, and restores clip keyframes with undo and redo', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-1', duration: 2 })]));
    const manager = new CommandManager();

    manager.execute(new AddKeyframeCommand(accessor, 'clip-1', 'opacity', { id: 'kf-a', time: 0, value: 1 }));
    manager.execute(new AddKeyframeCommand(accessor, 'clip-1', 'opacity', { id: 'kf-b', time: 1, value: 0.25, easing: 'ease-out' }));
    expect(accessor.current().tracks[0].clips[0].keyframes?.opacity).toEqual([
      { id: 'kf-a', time: 0, value: 1, easing: 'linear' },
      { id: 'kf-b', time: 1, value: 0.25, easing: 'ease-out' }
    ]);

    manager.execute(new UpdateKeyframeCommand(accessor, 'clip-1', 'opacity', 'kf-b', { time: 99, value: -1, easing: 'ease-in-out' }));
    expect(accessor.current().tracks[0].clips[0].keyframes?.opacity?.[1]).toEqual({ id: 'kf-b', time: 2, value: 0, easing: 'ease-in-out' });

    manager.undo();
    expect(accessor.current().tracks[0].clips[0].keyframes?.opacity?.[1]).toEqual({ id: 'kf-b', time: 1, value: 0.25, easing: 'ease-out' });

    manager.execute(new RemoveKeyframeCommand(accessor, 'clip-1', 'opacity', 'kf-a'));
    expect(accessor.current().tracks[0].clips[0].keyframes?.opacity?.map((frame) => frame.id)).toEqual(['kf-b']);

    manager.undo();
    expect(accessor.current().tracks[0].clips[0].keyframes?.opacity?.map((frame) => frame.id)).toEqual(['kf-a', 'kf-b']);
  });

  it('applies text animation presets through an undoable command', () => {
    const accessor = makeAccessor(makeTimeline([makeTextClip({ id: 'text-1', duration: 2, text: 'Title' })]));
    const manager = new CommandManager();

    manager.execute(new ApplyTextAnimationCommand(accessor, 'text-1', { preset: 'fade', duration: 0.4, direction: 'in' }));
    expect(accessor.current().tracks[2].clips[0].keyframes?.opacity?.map((frame) => [frame.time, frame.value])).toEqual([
      [0, 0],
      [0.4, 1]
    ]);

    manager.undo();
    expect(accessor.current().tracks[2].clips[0].keyframes).toBeUndefined();
    manager.redo();
    expect(accessor.current().tracks[2].clips[0].keyframes?.opacity).toHaveLength(2);
  });

  it('rejects updates and removals for missing keyframes', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-1' })]));
    const manager = new CommandManager();

    expect(() => manager.execute(new UpdateKeyframeCommand(accessor, 'clip-1', 'opacity', 'missing', { value: 0 }))).toThrow('Keyframe missing not found');
    expect(() => manager.execute(new RemoveKeyframeCommand(accessor, 'clip-1', 'opacity', 'missing'))).toThrow('Keyframe missing not found');
  });

  it('updates text style safely', () => {
    const accessor = makeAccessor(makeTimeline([makeTextClip()]));
    const manager = new CommandManager();
    manager.execute(
      new UpdateClipCommand(accessor, 'text-1', {
        text: 'Updated',
        style: { bold: true, color: '#ff0000', backgroundColor: '#102030', backgroundOpacity: 0.4 }
      })
    );
    const text = accessor.current().tracks[2].clips[0];
    expect(text.type).toBe('text');
    if (text.type === 'text') {
      expect(text.text).toBe('Updated');
      expect(text.style.bold).toBe(true);
      expect(text.style.color).toBe('#ff0000');
      expect(text.style.backgroundColor).toBe('#102030');
      expect(text.style.backgroundOpacity).toBe(0.4);
    }
  });

  it('updates clip opacity, volume, and text style through undoable commands', () => {
    const accessor = makeAccessor(
      makeTimeline([
        makeVideoClip({ id: 'clip-video', volume: 1, transform: { opacity: 1 } }),
        makeTextClip({ id: 'clip-text', style: { color: '#ffffff', backgroundColor: '#000000', backgroundOpacity: 0 } })
      ])
    );
    const manager = new CommandManager();

    manager.execute(new UpdateClipCommand(accessor, 'clip-video', { volume: 1.5, transform: { opacity: 0.35 } }));
    manager.execute(
      new UpdateClipCommand(accessor, 'clip-text', {
        style: { fontSize: 72, color: '#ff4fd8', backgroundColor: '#00e5ff', backgroundOpacity: 0.45 }
      })
    );

    const video = accessor.current().tracks[0].clips[0];
    const text = accessor.current().tracks[2].clips[0];
    expect(video.type).toBe('video');
    if (video.type === 'video') {
      expect(video.volume).toBe(1.5);
      expect(video.transform.opacity).toBe(0.35);
    }
    expect(text.type).toBe('text');
    if (text.type === 'text') {
      expect(text.style.fontSize).toBe(72);
      expect(text.style.color).toBe('#ff4fd8');
      expect(text.style.backgroundColor).toBe('#00e5ff');
      expect(text.style.backgroundOpacity).toBe(0.45);
    }

    manager.undo();
    const revertedText = accessor.current().tracks[2].clips[0];
    expect(revertedText.type).toBe('text');
    if (revertedText.type === 'text') {
      expect(revertedText.style.color).toBe('#ffffff');
      expect(revertedText.style.backgroundOpacity).toBe(0);
    }
    manager.undo();
    const revertedVideo = accessor.current().tracks[0].clips[0];
    expect(revertedVideo.type).toBe('video');
    if (revertedVideo.type === 'video') {
      expect(revertedVideo.volume).toBe(1);
      expect(revertedVideo.transform.opacity).toBe(1);
    }
  });

  it('updates speed and color correction through undoable commands', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-video', duration: 3, speed: 1 })]));
    const manager = new CommandManager();

    manager.execute(
      new UpdateClipCommand(accessor, 'clip-video', {
        speed: 2,
        colorCorrection: { brightness: 0.5, contrast: 1.25, saturation: 1.5, hue: 60 }
      })
    );

    const updated = accessor.current().tracks[0].clips[0];
    expect(updated.speed).toBe(2);
    expect(updated.duration).toBe(1.5);
    expect(updated.colorCorrection).toEqual({ ...DEFAULT_COLOR_CORRECTION, brightness: 0.5, contrast: 1.25, saturation: 1.5, hue: 60, lutPath: null });

    manager.undo();
    const reverted = accessor.current().tracks[0].clips[0];
    expect(reverted.speed).toBe(1);
    expect(reverted.duration).toBe(3);
    expect(reverted.colorCorrection).toEqual(DEFAULT_COLOR_CORRECTION);
  });

  it('clamps speed and color correction patches', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-video', duration: 3 })]));
    const manager = new CommandManager();

    manager.execute(new UpdateClipCommand(accessor, 'clip-video', { speed: 100, colorCorrection: { brightness: 4, contrast: 4, saturation: -2, hue: 400 } }));

    const updated = accessor.current().tracks[0].clips[0];
    expect(updated.speed).toBe(4);
    expect(updated.colorCorrection).toEqual({ ...DEFAULT_COLOR_CORRECTION, brightness: 1, contrast: 2, saturation: 0, hue: 180, lutPath: null });
  });

  it('updates the first chroma key sample when patching the legacy color field', () => {
    const accessor = makeAccessor(
      makeTimeline([
        makeVideoClip({
          id: 'clip-video',
          duration: 3,
          chromaKey: {
            enabled: true,
            color: [0, 255, 0],
            colors: [
              [0, 255, 0],
              [0, 0, 255]
            ],
            similarity: 0.2,
            blend: 0.05,
            spillSuppression: false,
            erosion: 0
          }
        })
      ])
    );
    const manager = new CommandManager();

    manager.execute(new UpdateClipCommand(accessor, 'clip-video', { chromaKey: { color: [255, 0, 0] } }));

    expect(accessor.current().tracks[0].clips[0].chromaKey).toMatchObject({
      color: [255, 0, 0],
      colors: [
        [255, 0, 0],
        [0, 0, 255]
      ]
    });
    manager.undo();
    expect(accessor.current().tracks[0].clips[0].chromaKey?.colors).toEqual([
      [0, 255, 0],
      [0, 0, 255]
    ]);
  });

  it('clamps advanced audio clip patches', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-video', duration: 3 })]));
    const manager = new CommandManager();

    manager.execute(
      new UpdateClipCommand(accessor, 'clip-video', {
        pitchSemitones: 99,
        reverseAudio: true,
        fadeInDuration: 99,
        fadeOutDuration: -1,
        fadeInCurve: 'ease-out',
        fadeOutCurve: 'ease-in-out' as never
      })
    );

    expect(accessor.current().tracks[0].clips[0]).toMatchObject({
      pitchSemitones: 12,
      reverseAudio: true,
      fadeInDuration: 3,
      fadeOutDuration: 0,
      fadeInCurve: 'ease-out',
      fadeOutCurve: 'linear'
    });

    manager.undo();
    expect(accessor.current().tracks[0].clips[0]).toMatchObject({ pitchSemitones: 0, reverseAudio: false, fadeInCurve: 'linear' });
  });

  it('normalizes stabilization and PNG sequence frame rate patches with undo', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-video', duration: 3 })]));
    const manager = new CommandManager();

    manager.execute(
      new UpdateClipCommand(accessor, 'clip-video', {
        stabilization: { enabled: true, smoothing: 999, zoom: -1, analyzed: true, trfPath: ' C:\\Temp\\clip.trf ' },
        frameInterpolation: { enabled: true, targetFps: 144 as never },
        slowMotionMode: 'optical-flow',
        sequenceFrameRate: 240
      })
    );

    expect(accessor.current().tracks[0].clips[0]).toMatchObject({
      stabilization: { enabled: true, smoothing: 100, zoom: 0, analyzed: true, trfPath: 'C:\\Temp\\clip.trf' },
      frameInterpolation: { enabled: true, targetFps: 60 },
      slowMotionMode: 'optical-flow',
      sequenceFrameRate: 120
    });

    manager.execute(new UpdateClipCommand(accessor, 'clip-video', { slowMotionMode: 'invalid' as never }));
    expect(accessor.current().tracks[0].clips[0]).toMatchObject({
      slowMotionMode: 'none'
    });

    manager.undo();
    expect(accessor.current().tracks[0].clips[0]).toMatchObject({
      slowMotionMode: 'optical-flow'
    });

    manager.undo();
    expect(accessor.current().tracks[0].clips[0]).toMatchObject({
      stabilization: { enabled: false, smoothing: 30, zoom: 0, analyzed: false, trfPath: null },
      frameInterpolation: { enabled: false, targetFps: 60 },
      slowMotionMode: 'none',
      sequenceFrameRate: undefined
    });
  });

  it('adds, updates, removes, and restores effects with undo and redo', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-video', duration: 3 })]));
    const manager = new CommandManager();

    manager.execute(new AddEffectCommand(accessor, 'clip-video', { id: 'effect-blur', type: 'blur', params: { radius: 60 } }));
    expect(accessor.current().tracks[0].clips[0].effects).toEqual([{ id: 'effect-blur', type: 'blur', enabled: true, params: { radius: 50 } }]);

    manager.undo();
    expect(accessor.current().tracks[0].clips[0].effects).toBeUndefined();

    manager.redo();
    expect(accessor.current().tracks[0].clips[0].effects?.map((effect) => effect.id)).toEqual(['effect-blur']);

    manager.execute(new UpdateEffectCommand(accessor, 'clip-video', 'effect-blur', { enabled: false, params: { radius: 4 } }));
    expect(accessor.current().tracks[0].clips[0].effects?.[0]).toEqual({ id: 'effect-blur', type: 'blur', enabled: false, params: { radius: 4 } });

    manager.undo();
    expect(accessor.current().tracks[0].clips[0].effects?.[0].enabled).toBe(true);

    manager.execute(new RemoveEffectCommand(accessor, 'clip-video', 'effect-blur'));
    expect(accessor.current().tracks[0].clips[0].effects).toBeUndefined();

    manager.undo();
    expect(accessor.current().tracks[0].clips[0].effects?.map((effect) => effect.id)).toEqual(['effect-blur']);
  });

  it('adds, updates, removes, and restores masks with undo and redo', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-video', duration: 3 })]));
    const manager = new CommandManager();

    manager.execute(new AddMaskCommand(accessor, 'clip-video', { id: 'mask-rect', type: 'rect' }));
    expect(accessor.current().tracks[0].clips[0].masks).toEqual([
      expect.objectContaining({ id: 'mask-rect', type: 'rect', x: 0.25, y: 0.25, w: 0.5, h: 0.5, enabled: true })
    ]);

    manager.undo();
    expect(accessor.current().tracks[0].clips[0].masks).toEqual([]);

    manager.redo();
    manager.execute(new UpdateMaskCommand(accessor, 'clip-video', 'mask-rect', { type: 'ellipse', x: 0.1, y: 0.2, w: 0.4, h: 0.3, inverted: true, feather: 0.2 }));
    expect(accessor.current().tracks[0].clips[0].masks?.[0]).toEqual(
      expect.objectContaining({ id: 'mask-rect', type: 'ellipse', x: 0.1, y: 0.2, w: 0.4, h: 0.3, inverted: true, feather: 0.2 })
    );

    manager.undo();
    expect(accessor.current().tracks[0].clips[0].masks?.[0]).toEqual(expect.objectContaining({ id: 'mask-rect', type: 'rect', inverted: false }));

    manager.execute(new RemoveMaskCommand(accessor, 'clip-video', 'mask-rect'));
    expect(accessor.current().tracks[0].clips[0].masks).toEqual([]);

    manager.undo();
    expect(accessor.current().tracks[0].clips[0].masks?.map((mask) => mask.id)).toEqual(['mask-rect']);
  });

  it('reorders effects and restores the original order on undo', () => {
    const accessor = makeAccessor(
      makeTimeline([
        makeVideoClip({
          id: 'clip-video',
          effects: [
            { id: 'effect-blur', type: 'blur', enabled: true, params: { radius: 4 } },
            { id: 'effect-sharpen', type: 'sharpen', enabled: true, params: { strength: 1 } },
            { id: 'effect-grain', type: 'film-grain', enabled: true, params: { strength: 0.3, size: 2 } }
          ]
        })
      ])
    );
    const manager = new CommandManager();

    manager.execute(new ReorderEffectsCommand(accessor, 'clip-video', ['effect-grain', 'effect-blur', 'effect-sharpen']));
    expect(accessor.current().tracks[0].clips[0].effects?.map((effect) => effect.id)).toEqual(['effect-grain', 'effect-blur', 'effect-sharpen']);

    manager.undo();
    expect(accessor.current().tracks[0].clips[0].effects?.map((effect) => effect.id)).toEqual(['effect-blur', 'effect-sharpen', 'effect-grain']);

    expect(() => manager.execute(new ReorderEffectsCommand(accessor, 'clip-video', ['missing-effect']))).toThrow('Effect order');
  });

  it('clears redo stack when executing after undo', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-1' })]));
    const manager = new CommandManager();

    manager.execute(new MoveClipCommand(accessor, 'clip-1', 1));
    manager.execute(new MoveClipCommand(accessor, 'clip-1', 2));
    manager.undo();
    expect(manager.canRedo()).toBe(true);
    manager.execute(new MoveClipCommand(accessor, 'clip-1', 3));
    expect(manager.canRedo()).toBe(false);
    expect(accessor.current().tracks[0].clips[0].start).toBe(3);
  });

  it('caps command history at 100 entries', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-1' })]));
    const manager = new CommandManager();

    for (let index = 1; index <= 105; index += 1) {
      manager.execute(new MoveClipCommand(accessor, 'clip-1', index));
    }

    expect(manager.historySize()).toBe(100);
    for (let index = 0; index < 100; index += 1) {
      manager.undo();
    }
    expect(accessor.current().tracks[0].clips[0].start).toBe(5);
    expect(manager.canUndo()).toBe(false);
  });

  it('rejects overlapping command results', () => {
    const accessor = makeAccessor(
      makeTimeline([makeVideoClip({ id: 'a', start: 0, duration: 5 }), makeVideoClip({ id: 'b', start: 6, duration: 3 })])
    );
    const manager = new CommandManager();

    expect(() => manager.execute(new MoveClipCommand(accessor, 'b', 4))).toThrow('overlaps');
  });

  it('deletes multiple clips as one undoable command', () => {
    const accessor = makeAccessor(
      makeTimeline([
        makeVideoClip({ id: 'a', start: 0, duration: 2 }),
        makeVideoClip({ id: 'b', start: 3, duration: 2 }),
        makeTextClip({ id: 'c', start: 0, duration: 2 })
      ])
    );
    const manager = new CommandManager();

    manager.execute(new DeleteClipsCommand(accessor, ['a', 'c']));
    expect(accessor.current().tracks[0].clips.map((clip) => clip.id)).toEqual(['b']);
    expect(accessor.current().tracks[2].clips).toHaveLength(0);

    manager.undo();
    expect(accessor.current().tracks[0].clips.map((clip) => clip.id)).toEqual(['a', 'b']);
    expect(accessor.current().tracks[2].clips.map((clip) => clip.id)).toEqual(['c']);

    manager.redo();
    expect(accessor.current().tracks[0].clips.map((clip) => clip.id)).toEqual(['b']);
    expect(accessor.current().tracks[2].clips).toHaveLength(0);
  });

  it('ripple deletes clips on their own tracks and preserves undo', () => {
    const accessor = makeAccessor(
      makeTimeline([
        makeVideoClip({ id: 'a', start: 0, duration: 2 }),
        makeVideoClip({ id: 'b', start: 3, duration: 2 }),
        makeVideoClip({ id: 'c', start: 7, duration: 1 }),
        makeTextClip({ id: 'title', start: 7, duration: 1 })
      ])
    );
    const manager = new CommandManager();

    manager.execute(new RippleDeleteCommand(accessor, ['b']));
    expect(accessor.current().tracks[0].clips.map((clip) => [clip.id, clip.start])).toEqual([
      ['a', 0],
      ['c', 5]
    ]);
    expect(accessor.current().tracks[2].clips.map((clip) => [clip.id, clip.start])).toEqual([['title', 7]]);

    manager.undo();
    expect(accessor.current().tracks[0].clips.map((clip) => [clip.id, clip.start])).toEqual([
      ['a', 0],
      ['b', 3],
      ['c', 7]
    ]);

    manager.redo();
    expect(accessor.current().tracks[0].clips.map((clip) => clip.id)).toEqual(['a', 'c']);
  });

  it('ripple deletes multiple selected intervals and rejects empty selections', () => {
    const accessor = makeAccessor(
      makeTimeline([
        makeVideoClip({ id: 'a', start: 0, duration: 1 }),
        makeVideoClip({ id: 'b', start: 1, duration: 1 }),
        makeVideoClip({ id: 'c', start: 3, duration: 1 }),
        makeVideoClip({ id: 'd', start: 5, duration: 1 })
      ])
    );

    new RippleDeleteCommand(accessor, ['a', 'b', 'd']).execute();
    expect(accessor.current().tracks[0].clips.map((clip) => [clip.id, clip.start])).toEqual([['c', 1]]);

    expect(() => new RippleDeleteCommand(accessor, []).execute()).toThrow('No clips selected');
  });

  it('closes a clicked track gap with undo and rejects non-gaps', () => {
    const accessor = makeAccessor(
      makeTimeline([
        makeVideoClip({ id: 'a', start: 0, duration: 2 }),
        makeVideoClip({ id: 'b', start: 4, duration: 2 }),
        makeVideoClip({ id: 'c', start: 7, duration: 1 })
      ])
    );
    const manager = new CommandManager();

    manager.execute(new CloseGapCommand(accessor, 'track-video', 3));
    expect(accessor.current().tracks[0].clips.map((clip) => [clip.id, clip.start])).toEqual([
      ['a', 0],
      ['b', 2],
      ['c', 5]
    ]);

    manager.undo();
    expect(accessor.current().tracks[0].clips.map((clip) => [clip.id, clip.start])).toEqual([
      ['a', 0],
      ['b', 4],
      ['c', 7]
    ]);

    expect(() => manager.execute(new CloseGapCommand(accessor, 'track-video', 1))).toThrow('No closeable gap');
    expect(() => manager.execute(new CloseGapCommand(accessor, 'track-video', 9))).toThrow('No closeable gap');
  });

  it('rolling trims adjacent clips while preserving their combined duration', () => {
    const accessor = makeAccessor(
      makeTimeline([
        makeVideoClip({ id: 'left', start: 0, duration: 3, trimStart: 0, trimEnd: 2 }),
        makeVideoClip({ id: 'right', start: 3, duration: 3, trimStart: 1, trimEnd: 0 })
      ])
    );
    const manager = new CommandManager();

    manager.execute(new RollingTrimCommand(accessor, 'left', 'right', 1, 1 / 30));
    const [left, right] = accessor.current().tracks[0].clips;
    expect(left.duration + right.duration).toBeCloseTo(6, 6);
    expect(left).toMatchObject({ id: 'left', start: 0, duration: 4, trimEnd: 1 });
    expect(right).toMatchObject({ id: 'right', start: 4, duration: 2, trimStart: 2 });

    manager.undo();
    expect(accessor.current().tracks[0].clips.map((clip) => [clip.id, clip.start, clip.duration, clip.trimStart, clip.trimEnd])).toEqual([
      ['left', 0, 3, 0, 2],
      ['right', 3, 3, 1, 0]
    ]);
  });

  it('rejects rolling trims without adjacent clips or available media', () => {
    const nonAdjacent = makeAccessor(
      makeTimeline([
        makeVideoClip({ id: 'left', start: 0, duration: 2 }),
        makeVideoClip({ id: 'right', start: 3, duration: 2 })
      ])
    );
    expect(() => new RollingTrimCommand(nonAdjacent, 'left', 'right', 0.5).execute()).toThrow('adjacent');

    const bounded = makeAccessor(
      makeTimeline([
        makeVideoClip({ id: 'left', start: 0, duration: 2, trimStart: 0, trimEnd: 0 }),
        makeVideoClip({ id: 'right', start: 2, duration: 2, trimStart: 0, trimEnd: 0 })
      ])
    );
    expect(() => new RollingTrimCommand(bounded, 'left', 'right', 0.5).execute()).toThrow('no available media');
  });

  it('slips clip source trims without changing timeline position or duration', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-slip', start: 4, duration: 2, trimStart: 1, trimEnd: 3 })]));
    const manager = new CommandManager();

    manager.execute(new SlipClipCommand(accessor, 'clip-slip', 10));
    expect(accessor.current().tracks[0].clips[0]).toMatchObject({ start: 4, duration: 2, trimStart: 4, trimEnd: 0 });

    manager.undo();
    expect(accessor.current().tracks[0].clips[0]).toMatchObject({ start: 4, duration: 2, trimStart: 1, trimEnd: 3 });

    manager.execute(new SlipClipCommand(accessor, 'clip-slip', -10));
    expect(accessor.current().tracks[0].clips[0]).toMatchObject({ start: 4, duration: 2, trimStart: 0, trimEnd: 4 });
  });

  it('slides a clip by compensating adjacent trims and preserving total duration', () => {
    const accessor = makeAccessor(
      makeTimeline([
        makeVideoClip({ id: 'left', start: 0, duration: 2, trimStart: 0, trimEnd: 2 }),
        makeVideoClip({ id: 'middle', start: 2, duration: 2, trimStart: 0, trimEnd: 0 }),
        makeVideoClip({ id: 'right', start: 4, duration: 2, trimStart: 0, trimEnd: 2 })
      ])
    );
    const manager = new CommandManager();
    const beforeTotal = accessor.current().tracks[0].clips.reduce((total, clip) => total + clip.duration, 0);

    manager.execute(new SlideClipCommand(accessor, 'middle', 1, 1 / 30));
    const [left, middle, right] = accessor.current().tracks[0].clips;
    expect(accessor.current().tracks[0].clips.reduce((total, clip) => total + clip.duration, 0)).toBeCloseTo(beforeTotal, 6);
    expect(left).toMatchObject({ id: 'left', start: 0, duration: 3, trimEnd: 1 });
    expect(middle).toMatchObject({ id: 'middle', start: 3, duration: 2, trimStart: 0, trimEnd: 0 });
    expect(right).toMatchObject({ id: 'right', start: 5, duration: 1, trimStart: 1 });

    manager.undo();
    expect(accessor.current().tracks[0].clips.map((clip) => [clip.id, clip.start, clip.duration, clip.trimStart, clip.trimEnd])).toEqual([
      ['left', 0, 2, 0, 2],
      ['middle', 2, 2, 0, 0],
      ['right', 4, 2, 0, 2]
    ]);
  });

  it('clamps slide edits to adjacent media handles and minimum durations', () => {
    const accessor = makeAccessor(
      makeTimeline([
        makeVideoClip({ id: 'left', start: 0, duration: 2, trimStart: 0, trimEnd: 1 }),
        makeVideoClip({ id: 'middle', start: 2, duration: 2 }),
        makeVideoClip({ id: 'right', start: 4, duration: 2, trimStart: 0, trimEnd: 0 })
      ])
    );

    new SlideClipCommand(accessor, 'middle', 10, 1 / 30).execute();
    const [left, middle, right] = accessor.current().tracks[0].clips;
    expect(left.duration).toBeCloseTo(3, 6);
    expect(middle.start).toBeCloseTo(3, 6);
    expect(right.start).toBeCloseTo(5, 6);
    expect(right.duration).toBeCloseTo(1, 6);
  });

  it('moves multiple selected clips while preserving their relative spacing', () => {
    const accessor = makeAccessor(
      makeTimeline([
        makeVideoClip({ id: 'a', start: 1, duration: 1 }),
        makeVideoClip({ id: 'b', start: 3, duration: 1 })
      ])
    );
    const manager = new CommandManager();

    manager.execute(new MoveClipsCommand(accessor, { a: 2, b: 4 }));
    expect(accessor.current().tracks[0].clips.map((clip) => clip.start)).toEqual([2, 4]);

    manager.undo();
    expect(accessor.current().tracks[0].clips.map((clip) => clip.start)).toEqual([1, 3]);
  });

  it('clamps trim commands to source duration and one frame minimum', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-1', duration: 6, trimStart: 1, trimEnd: 1 })]));
    const manager = new CommandManager();

    manager.execute(new TrimClipCommand(accessor, 'clip-1', 100, 1, undefined, 1 / 30));
    const trimmed = accessor.current().tracks[0].clips[0];
    expect(trimmed.trimStart).toBeCloseTo(6.967, 3);
    expect(trimmed.trimEnd).toBe(1);
    expect(trimmed.duration).toBeCloseTo(0.033, 3);

    manager.undo();
    expect(accessor.current().tracks[0].clips[0]).toMatchObject({ trimStart: 1, trimEnd: 1, duration: 6 });
  });

  it('keeps undo and redo as no-ops at history boundaries', () => {
    const manager = new CommandManager();
    const changes: ReturnType<CommandManager['getHistoryMeta']>[] = [];
    manager.setOnChange((meta) => changes.push(meta));

    manager.undo();
    manager.redo();

    expect(manager.getHistoryMeta()).toMatchObject({ canUndo: false, canRedo: false, cursor: -1, position: 0, total: 0, entries: [] });
    expect(changes).toEqual([{ canUndo: false, canRedo: false, cursor: -1, entries: [], position: 0, total: 0 }]);
  });

  it('does not record a command when execute throws', () => {
    let undoCount = 0;
    const manager = new CommandManager();
    const failing: Command = {
      description: 'Fail',
      execute: () => {
        throw new Error('boom');
      },
      undo: () => {
        undoCount += 1;
      }
    };

    expect(() => manager.execute(failing)).toThrow('boom');
    expect(manager.historySize()).toBe(0);
    expect(manager.canUndo()).toBe(false);

    manager.undo();
    expect(undoCount).toBe(0);
  });

  it('clears history and prevents redo of previously undone commands', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-1' })]));
    const manager = new CommandManager();

    manager.execute(new MoveClipCommand(accessor, 'clip-1', 1));
    manager.execute(new MoveClipCommand(accessor, 'clip-1', 2));
    manager.undo();
    expect(manager.canRedo()).toBe(true);

    manager.clear();
    expect(manager.getHistoryMeta()).toMatchObject({ canUndo: false, canRedo: false, cursor: -1, position: 0, total: 0, entries: [] });
    manager.redo();
    expect(accessor.current().tracks[0].clips[0].start).toBe(1);
  });

  it('jumps to a selected history entry with undo and redo operations', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-1', start: 0 })]));
    const manager = new CommandManager();

    manager.execute(new MoveClipCommand(accessor, 'clip-1', 1));
    manager.execute(new MoveClipCommand(accessor, 'clip-1', 2));
    manager.execute(new MoveClipCommand(accessor, 'clip-1', 3));

    manager.jumpTo(0);
    expect(accessor.current().tracks[0].clips[0].start).toBe(1);
    expect(manager.getHistoryMeta()).toMatchObject({ cursor: 0, position: 1, total: 3 });

    manager.jumpTo(2);
    expect(accessor.current().tracks[0].clips[0].start).toBe(3);
    expect(manager.getHistoryMeta()).toMatchObject({ cursor: 2, position: 3, total: 3 });
  });

  it('evicts the oldest history entries at the configured limit', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-1', start: 0 })]));
    const manager = new CommandManager(2);

    manager.execute(new MoveClipCommand(accessor, 'clip-1', 1));
    manager.execute(new MoveClipCommand(accessor, 'clip-1', 2));
    manager.execute(new MoveClipCommand(accessor, 'clip-1', 3));

    const meta = manager.getHistoryMeta();
    expect(meta.total).toBe(2);
    expect(meta.entries.map((entry) => entry.description)).toEqual(['Move clip', 'Move clip']);
    manager.jumpTo(-1);
    expect(accessor.current().tracks[0].clips[0].start).toBe(1);
  });

  it('treats direct undo before execute as a no-op for stateful timeline commands', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-1', duration: 6 })]));
    const before = accessor.current();

    new MoveClipCommand(accessor, 'clip-1', 2).undo();
    new TrimClipCommand(accessor, 'clip-1', 1, 1).undo();
    new SplitClipCommand(accessor, 'clip-1', 3).undo();
    new DeleteClipCommand(accessor, 'clip-1').undo();
    new UpdateClipCommand(accessor, 'clip-1', { name: 'No-op' }).undo();

    expect(accessor.current()).toBe(before);
  });
});

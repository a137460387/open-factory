import { describe, expect, it } from 'vitest';
import {
  AddClipCommand,
  AddKeyframeCommand,
  AddTrackCommand,
  AddTimelineMarkerCommand,
  AddTransitionCommand,
  type Command,
  CommandManager,
  DeleteClipCommand,
  DeleteClipsCommand,
  MoveClipCommand,
  MoveClipsCommand,
  RemoveKeyframeCommand,
  RemoveTimelineMarkerCommand,
  RemoveTransitionCommand,
  RemoveSilenceCommand,
  SplitClipCommand,
  SplitClipAtTimesCommand,
  TrimClipCommand,
  UpdateKeyframeCommand,
  UpdateClipCommand,
  UpdateTimelineMarkerCommand,
  UpdateProjectAudioCommand,
  UpdateTrackCommand
} from '../src';
import { makeAccessor, makeAudioClip, makeProject, makeTextClip, makeTimeline, makeVideoClip } from './test-utils';

describe('timeline commands', () => {
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
    expect(updated.colorCorrection).toEqual({ brightness: 0.5, contrast: 1.25, saturation: 1.5, hue: 60, lutPath: null });

    manager.undo();
    const reverted = accessor.current().tracks[0].clips[0];
    expect(reverted.speed).toBe(1);
    expect(reverted.duration).toBe(3);
    expect(reverted.colorCorrection).toEqual({ brightness: 0, contrast: 1, saturation: 1, hue: 0, lutPath: null });
  });

  it('clamps speed and color correction patches', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-video', duration: 3 })]));
    const manager = new CommandManager();

    manager.execute(new UpdateClipCommand(accessor, 'clip-video', { speed: 100, colorCorrection: { brightness: 4, contrast: 4, saturation: -2, hue: 400 } }));

    const updated = accessor.current().tracks[0].clips[0];
    expect(updated.speed).toBe(4);
    expect(updated.colorCorrection).toEqual({ brightness: 1, contrast: 2, saturation: 0, hue: 180, lutPath: null });
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
    const changes: Array<{ canUndo: boolean; canRedo: boolean }> = [];
    manager.setOnChange((meta) => changes.push(meta));

    manager.undo();
    manager.redo();

    expect(manager.getHistoryMeta()).toEqual({ canUndo: false, canRedo: false });
    expect(changes).toEqual([{ canUndo: false, canRedo: false }]);
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
    expect(manager.getHistoryMeta()).toEqual({ canUndo: false, canRedo: false });
    manager.redo();
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

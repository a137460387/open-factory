import { describe, expect, it } from 'vitest';
import {
  CommandManager,
  CreateMulticamSequenceCommand,
  CutMulticamClipCommand,
  calculateAudioAlignmentOffset,
  createTrack,
  setMulticamSwitch,
  type Project,
  type ProjectAccessor
} from '../src';
import { makeProject, makeVideoClip } from './test-utils';

describe('multicam editing', () => {
  it('calculates audio alignment offset with cross-correlation', () => {
    const reference = [0, 0, 1, 0, 0, 0];
    const delayedCandidate = [0, 0, 0, 0, 1, 0];

    expect(calculateAudioAlignmentOffset(reference, delayedCandidate, 10, 1)).toBe(-0.2);
  });

  it('adds and replaces sorted multicam switch points', () => {
    const multicam = {
      angles: [
        { id: 'angle-a', clipId: 'clip-a', trackId: 'track-a', name: 'A', offset: 0 },
        { id: 'angle-b', clipId: 'clip-b', trackId: 'track-b', name: 'B', offset: 0 }
      ],
      switches: [{ id: 'switch-0', time: 0, angleId: 'angle-a' }]
    };

    const added = setMulticamSwitch(multicam, 1.5, 'angle-b', 4);
    const replaced = setMulticamSwitch({ ...multicam, switches: added }, 1.5, 'angle-a', 4);

    expect(added.map((item) => [item.time, item.angleId])).toEqual([
      [0, 'angle-a'],
      [1.5, 'angle-b']
    ]);
    expect(replaced.map((item) => [item.time, item.angleId])).toEqual([
      [0, 'angle-a'],
      [1.5, 'angle-a']
    ]);
  });

  it('creates a multicam sequence and records cuts through undoable commands', () => {
    const accessor = makeProjectAccessor(makeTwoCameraProject());
    const manager = new CommandManager();
    const createCommand = new CreateMulticamSequenceCommand(accessor, ['clip-a', 'clip-b'], 'Scene 1 Multicam');

    manager.execute(createCommand);
    const multicamClipId = createCommand.multicamClipId!;
    const multicamClip = accessor
      .current()
      .timeline.tracks.flatMap((track) => track.clips)
      .find((clip) => clip.id === multicamClipId);

    expect(multicamClip?.type).toBe('nested-sequence');
    expect(multicamClip?.name).toBe('Scene 1 Multicam');
    expect(multicamClip?.multicam?.angles).toHaveLength(2);
    expect(accessor.current().sequences.some((sequence) => sequence.id === createCommand.sequenceId)).toBe(true);

    const secondAngleId = multicamClip?.multicam?.angles[1].id ?? '';
    manager.execute(new CutMulticamClipCommand(accessor, multicamClipId, 2, secondAngleId));
    const cutClip = accessor
      .current()
      .timeline.tracks.flatMap((track) => track.clips)
      .find((clip) => clip.id === multicamClipId);

    expect(cutClip?.type).toBe('nested-sequence');
    expect(cutClip?.multicam?.switches.map((item) => [item.time, item.angleId])).toEqual([
      [0, 'angle-1'],
      [2, 'angle-2']
    ]);

    manager.undo();
    const undoneCutClip = accessor
      .current()
      .timeline.tracks.flatMap((track) => track.clips)
      .find((clip) => clip.id === multicamClipId);
    expect(undoneCutClip?.type).toBe('nested-sequence');
    expect(undoneCutClip?.multicam?.switches).toHaveLength(1);

    manager.undo();
    expect(accessor.current().timeline.tracks.flatMap((track) => track.clips).map((clip) => clip.id).sort()).toEqual(['clip-a', 'clip-b']);
  });
});

function makeProjectAccessor(initial: Project): ProjectAccessor & { current(): Project } {
  let project = initial;
  return {
    getProject: () => project,
    setProject: (next) => {
      project = next;
    },
    current: () => project
  };
}

function makeTwoCameraProject(): Project {
  const project = makeProject();
  project.media.push({
    id: 'asset-2',
    type: 'video',
    name: 'camera-b.mp4',
    path: 'D:\\Media\\camera-b.mp4',
    duration: 20,
    width: 1920,
    height: 1080,
    size: 8192,
    mtimeMs: 2000,
    hasAudio: true,
    audioChannels: 2,
    audioSampleRate: 48000,
    audioCodec: 'aac'
  });
  project.timeline = {
    ...project.timeline,
    tracks: [
      createTrack({ id: 'track-a', type: 'video', name: 'Camera A', clips: [makeVideoClip({ id: 'clip-a', trackId: 'track-a', mediaId: 'asset-1', duration: 4 })] }),
      createTrack({ id: 'track-b', type: 'video', name: 'Camera B', clips: [makeVideoClip({ id: 'clip-b', trackId: 'track-b', mediaId: 'asset-2', duration: 4 })] })
    ]
  };
  return project;
}

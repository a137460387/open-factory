import { describe, expect, it } from 'vitest';
import {
  CommandManager,
  CreateMulticamSequenceCommand,
  CutMulticamClipCommand,
  RecordAngleCutCommand,
  TrimMulticamSwitchCommand,
  buildMulticamSwitchHistory,
  calculateAudioAlignmentOffset,
  calculateManualMarkerAlignmentOffsets,
  calculateTimecodeAlignmentOffsets,
  createTrack,
  findFrequentMulticamSwitchWarnings,
  flattenMulticamProjectForExport,
  parseLtcTimecode,
  parseVitcTimecode,
  serializeMulticamSwitchHistory,
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
    expect(calculateAudioAlignmentOffset([], delayedCandidate, 10, 1)).toBe(0);
  });

  it('parses LTC and VITC timecodes and derives sync offsets', () => {
    expect(parseLtcTimecode('LTC 01:02:03:12', 30)).toMatchObject({
      seconds: 3723.4,
      totalFrames: 111702,
      frames: 12
    });
    expect(parseVitcTimecode('01:02:04;00', 30)).toMatchObject({ seconds: 3724, frames: 0 });
    expect(calculateTimecodeAlignmentOffsets(
      [
        { clipId: 'clip-a', timecode: '01:00:00:00' },
        { clipId: 'clip-b', timecode: '01:00:02:15' }
      ],
      'clip-a',
      30
    )).toEqual({ 'clip-a': 0, 'clip-b': -2.5 });
    expect(parseLtcTimecode('not timecode', 30)).toBeUndefined();
    expect(parseLtcTimecode('00:00:00:30', 30)).toBeUndefined();
    expect(calculateTimecodeAlignmentOffsets([{ clipId: 'clip-b', timecode: '01:00:02:15' }], 'clip-a', 30)).toEqual({});
  });

  it('calculates manual marker alignment offsets', () => {
    expect(calculateManualMarkerAlignmentOffsets(
      [
        { clipId: 'clip-a', markerTime: 12 },
        { clipId: 'clip-b', markerTime: 13.5 }
      ],
      'clip-a'
    )).toEqual({ 'clip-a': 0, 'clip-b': -1.5 });
    expect(calculateManualMarkerAlignmentOffsets([{ clipId: 'clip-b', markerTime: 13.5 }], 'clip-a')).toEqual({});
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

  it('serializes switch history and warns when cuts are closer than 12 frames', () => {
    const multicam = {
      angles: [
        { id: 'angle-a', clipId: 'clip-a', trackId: 'track-a', name: 'A', offset: 0 },
        { id: 'angle-b', clipId: 'clip-b', trackId: 'track-b', name: 'B', offset: 0 }
      ],
      switches: [
        { id: 'switch-0', time: 0, angleId: 'angle-a' },
        { id: 'switch-1', time: 1, angleId: 'angle-b' },
        { id: 'switch-2', time: 1.2, angleId: 'angle-a' }
      ]
    };

    expect(findFrequentMulticamSwitchWarnings(multicam, 4, 30)).toEqual([{ fromSwitchId: 'switch-1', toSwitchId: 'switch-2', frameGap: 6 }]);
    expect(buildMulticamSwitchHistory(multicam, 4, 30).map((entry) => [entry.timecode, entry.angleName, entry.durationTimecode, entry.tooFrequent])).toEqual([
      ['00:00:00:00', 'A', '00:00:01:00', false],
      ['00:00:01:00', 'B', '00:00:00:06', false],
      ['00:00:01:06', 'A', '00:00:02:24', true]
    ]);
    expect(JSON.parse(serializeMulticamSwitchHistory(multicam, 4, 30))).toMatchObject({
      version: 1,
      fps: 30,
      switches: [
        { switchId: 'switch-0', angleName: 'A' },
        { switchId: 'switch-1', angleName: 'B' },
        { switchId: 'switch-2', tooFrequent: true }
      ]
    });
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

  it('undoes a live angle cut batch as a single command', () => {
    const accessor = makeProjectAccessor(makeTwoCameraProject());
    const manager = new CommandManager();
    const createCommand = new CreateMulticamSequenceCommand(accessor, ['clip-a', 'clip-b'], 'Scene 1 Multicam');
    manager.execute(createCommand);
    const multicamClipId = createCommand.multicamClipId!;
    const multicamClip = accessor.current().timeline.tracks[0].clips[0];
    const secondAngleId = multicamClip.type === 'nested-sequence' ? multicamClip.multicam?.angles[1].id ?? '' : '';
    const firstAngleId = multicamClip.type === 'nested-sequence' ? multicamClip.multicam?.angles[0].id ?? '' : '';
    const liveCommand = new RecordAngleCutCommand(accessor, multicamClipId, [{ sceneTime: 1, angleId: secondAngleId }]);

    manager.execute(liveCommand);
    liveCommand.record(1.5, firstAngleId);

    const cutClip = accessor.current().timeline.tracks[0].clips[0];
    expect(cutClip.type).toBe('nested-sequence');
    expect(cutClip.multicam?.switches.map((item) => [item.time, item.angleId])).toEqual([
      [0, 'angle-1'],
      [1, 'angle-2'],
      [1.5, 'angle-1']
    ]);
    expect(liveCommand.cutCount).toBe(2);

    manager.undo();
    const undoneClip = accessor.current().timeline.tracks[0].clips[0];
    expect(undoneClip.type).toBe('nested-sequence');
    expect(undoneClip.multicam?.switches).toHaveLength(1);
  });

  it('trims a switch by 10 frame handles through an undoable command', () => {
    const accessor = makeProjectAccessor(makeTwoCameraProject());
    const manager = new CommandManager();
    const createCommand = new CreateMulticamSequenceCommand(accessor, ['clip-a', 'clip-b'], 'Scene 1 Multicam');
    manager.execute(createCommand);
    const multicamClipId = createCommand.multicamClipId!;
    const multicamClip = accessor.current().timeline.tracks[0].clips[0];
    const secondAngleId = multicamClip.type === 'nested-sequence' ? multicamClip.multicam?.angles[1].id ?? '' : '';
    manager.execute(new CutMulticamClipCommand(accessor, multicamClipId, 2, secondAngleId));
    const switchId = accessor.current().timeline.tracks[0].clips[0].type === 'nested-sequence' ? accessor.current().timeline.tracks[0].clips[0].multicam?.switches[1].id ?? '' : '';

    manager.execute(new TrimMulticamSwitchCommand(accessor, multicamClipId, switchId, -10, 30));
    const trimmedClip = accessor.current().timeline.tracks[0].clips[0];
    expect(trimmedClip.type).toBe('nested-sequence');
    expect(trimmedClip.multicam?.switches[1].time).toBeCloseTo(1.666667, 6);

    manager.undo();
    const restoredClip = accessor.current().timeline.tracks[0].clips[0];
    expect(restoredClip.type).toBe('nested-sequence');
    expect(restoredClip.multicam?.switches[1].time).toBe(2);
  });

  it('keeps export flattening stable when live cut segments have missing or empty angle media', () => {
    const accessor = makeProjectAccessor(makeTwoCameraProject());
    const manager = new CommandManager();
    const createCommand = new CreateMulticamSequenceCommand(accessor, ['clip-a', 'clip-b'], 'Scene 1 Multicam');
    manager.execute(createCommand);
    const multicamClip = accessor.current().timeline.tracks[0].clips[0];
    expect(multicamClip.type).toBe('nested-sequence');
    const clipId = multicamClip.id;
    const secondAngleId = multicamClip.multicam?.angles[1].id ?? '';
    manager.execute(new CutMulticamClipCommand(accessor, clipId, 1, secondAngleId));

    const missingAngleProject = {
      ...accessor.current(),
      sequences: accessor.current().sequences.map((sequence) =>
        sequence.id === multicamClip.sequenceId
          ? { ...sequence, timeline: { ...sequence.timeline, tracks: sequence.timeline.tracks.map((track) => ({ ...track, clips: [] })) } }
          : sequence
      )
    };
    expect(flattenMulticamProjectForExport(missingAngleProject).timeline.tracks[0].clips[0].type).toBe('nested-sequence');

    const emptyFirstSegmentProject = {
      ...accessor.current(),
      sequences: accessor.current().sequences.map((sequence) =>
        sequence.id === multicamClip.sequenceId
          ? {
              ...sequence,
              timeline: {
                ...sequence.timeline,
                tracks: sequence.timeline.tracks.map((track, index) =>
                  index === 0 ? { ...track, clips: track.clips.map((clip) => ({ ...clip, start: 2 })) } : track
                )
              }
            }
          : sequence
      )
    };
    const flattened = flattenMulticamProjectForExport(emptyFirstSegmentProject).timeline.tracks[0].clips;
    expect(flattened).toHaveLength(1);
    expect(flattened[0].name).toContain('angle 2');
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

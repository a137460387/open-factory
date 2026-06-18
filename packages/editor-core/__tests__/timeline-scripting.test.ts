import { describe, expect, it } from 'vitest';
import {
  BUILTIN_TIMELINE_SCRIPTS,
  CommandManager,
  RunScriptCommand,
  TIMELINE_SCRIPT_API_SIGNATURES,
  createTimelineScriptSnapshot,
  getTimelineScriptApiFunctionNames,
  getTimelineScriptExportRequests,
  normalizeTimelineScriptOperations,
  type TimelineScriptOperation
} from '../src';
import { makeAccessor, makeTimeline, makeVideoClip } from './test-utils';

describe('timeline scripting', () => {
  it('declares the complete public Timeline API surface', () => {
    expect(getTimelineScriptApiFunctionNames()).toEqual([
      'getClips',
      'updateClip',
      'addClip',
      'deleteClip',
      'getMarkers',
      'addMarker',
      'exportProject'
    ]);
    expect(TIMELINE_SCRIPT_API_SIGNATURES.every((entry) => entry.signature.includes(entry.name))).toBe(true);
  });

  it('ships at least five built-in example scripts', () => {
    expect(BUILTIN_TIMELINE_SCRIPTS).toHaveLength(5);
    expect(BUILTIN_TIMELINE_SCRIPTS.map((script) => script.id)).toEqual([
      'bulk-speed',
      'sort-by-color-label',
      'minute-markers',
      'export-each-clip',
      'project-stats'
    ]);
  });

  it('captures a timeline snapshot for the script worker without sharing clip references', () => {
    const clip = makeVideoClip({ id: 'clip-a', duration: 4 });
    const timeline = { ...makeTimeline([clip]), markers: [{ id: 'marker-a', time: 1, label: 'A' }] };
    const snapshot = createTimelineScriptSnapshot({ timeline });

    snapshot.clips[0].name = 'changed in worker';
    snapshot.markers[0].label = 'changed';

    expect(timeline.tracks[0].clips[0].name).toBe('Clip');
    expect(timeline.markers?.[0].label).toBe('A');
    expect(snapshot.duration).toBe(4);
  });

  it('applies script operations as one undoable command', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-a', duration: 4 }), makeVideoClip({ id: 'clip-b', start: 5, duration: 2 })]));
    const manager = new CommandManager();
    const command = new RunScriptCommand(accessor, [
      { type: 'updateClip', clipId: 'clip-a', patch: { speed: 1.5 } },
      { type: 'updateClip', clipId: 'clip-b', patch: { name: 'Renamed' } },
      { type: 'addMarker', marker: { id: 'marker-script', time: 2, label: 'Script marker' } }
    ]);

    manager.execute(command);

    const clips = accessor.current().tracks.flatMap((track) => track.clips);
    expect(clips.find((clip) => clip.id === 'clip-a')?.speed).toBe(1.5);
    expect(clips.find((clip) => clip.id === 'clip-b')?.name).toBe('Renamed');
    expect(accessor.current().markers?.map((marker) => marker.label)).toEqual(['Script marker']);
    expect(command.appliedOperationCount).toBe(3);
    expect(manager.historySize()).toBe(1);

    manager.undo();
    const restored = accessor.current().tracks.flatMap((track) => track.clips);
    expect(restored.find((clip) => clip.id === 'clip-a')?.speed).toBe(1);
    expect(restored.find((clip) => clip.id === 'clip-b')?.name).toBe('Clip');
    expect(accessor.current().markers).toBeUndefined();
  });

  it('keeps export requests out of undoable timeline mutations', () => {
    const operations: TimelineScriptOperation[] = [
      { type: 'exportProject', preset: 'clip-clip-a' },
      { type: 'updateClip', clipId: 'clip-a', patch: { speed: 1.1 } }
    ];
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-a' })]));
    const command = new RunScriptCommand(accessor, operations);

    command.execute();

    expect(command.appliedOperationCount).toBe(1);
    expect(getTimelineScriptExportRequests(operations)).toEqual([{ type: 'exportProject', preset: 'clip-clip-a' }]);
  });

  it('applies add, delete, marker, and cached redo script branches', () => {
    const newClip = makeVideoClip({ id: 'clip-new', name: 'New', start: 20, duration: 2 });
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-a', duration: 4 })]));
    const command = new RunScriptCommand(accessor, [
      { type: 'addClip', clip: newClip },
      { type: 'deleteClip', clipId: 'clip-a' },
      { type: 'addMarker', marker: { id: 'marker-colored', time: 1, label: 'Colored', color: '#ff0000' } },
      { type: 'exportProject', preset: 'h264-1080p' }
    ]);

    command.execute();
    command.undo();
    command.execute();

    expect(accessor.current().tracks.flatMap((track) => track.clips).map((clip) => clip.id)).toEqual(['clip-new']);
    expect(accessor.current().markers).toEqual([{ id: 'marker-colored', time: 1, label: 'Colored', color: '#ff0000' }]);
    expect(command.appliedOperationCount).toBe(3);
  });

  it('rejects malformed script operations before mutating the timeline', () => {
    const invalidOperations = [
      null,
      { type: 'updateClip', clipId: '', patch: {} },
      { type: 'updateClip', clipId: 'clip-a', patch: null },
      { type: 'addClip', clip: { id: '', type: 'video', name: 'Clip', trackId: 'track-video' } },
      { type: 'addMarker', marker: { time: 'oops' } },
      { type: 'exportProject', preset: '' },
      { type: 'unknown' }
    ] as unknown as TimelineScriptOperation[];

    for (const operation of invalidOperations) {
      expect(() => normalizeTimelineScriptOperations([operation])).toThrow();
    }
  });
});

import { describe, expect, it } from 'vitest';
import {
  buildOperationReplaySchedule,
  createOperationRecording,
  generateOperationRecordingSlidesHtml,
  getOperationProjectAtStep,
  parseOperationRecording,
  recordOperationCommand,
  replayOperationRecording,
  serializeOperationRecording,
  type OperationRecordingFile
} from '../src/operation-recording';
import type { Command } from '../src/commands/command';
import { createProject, createTrack, type Project } from '../src/model';

describe('operation recording', () => {
  it('serializes command sequence with timestamps and project snapshots', () => {
    const initial = makeProject(0);
    const command = makeCommand('Add clip');
    const recording = recordOperationCommand(createOperationRecording(initial, { startedAtMs: 1_000, createdAt: '2026-01-01T00:00:00.000Z' }), command, makeProject(1), 1_250);

    const parsed = parseOperationRecording(serializeOperationRecording(recording));

    expect(parsed?.format).toBe('open-factory-operation-recording');
    expect(parsed?.commands).toHaveLength(1);
    expect(parsed?.commands[0]).toMatchObject({
      commandType: 'Object',
      description: 'Add clip',
      timestampMs: 1_250,
      relativeTimeMs: 250
    });
    expect(parsed?.commands[0].projectAfter.timeline.tracks[0].clips).toHaveLength(1);
  });

  it('replays project snapshots in recorded command order', () => {
    const recording = makeRecording([1, 2, 3]);
    const seen: number[] = [];

    replayOperationRecording(recording, (project) => {
      seen.push(project.timeline.tracks[0].clips.length);
    });

    expect(seen).toEqual([1, 2, 3]);
  });

  it('calculates accelerated replay delays from command timestamps', () => {
    const recording = makeRecording([1, 2, 3], [1_000, 1_500, 2_500]);

    expect(buildOperationReplaySchedule(recording, 1).map((step) => step.delayMs)).toEqual([0, 500, 1_000]);
    expect(buildOperationReplaySchedule(recording, 2).map((step) => step.delayMs)).toEqual([0, 250, 500]);
    expect(buildOperationReplaySchedule(recording, 4).map((step) => step.delayMs)).toEqual([0, 125, 250]);
  });

  it('returns initial project for negative jump and final snapshot for out-of-range jump', () => {
    const recording = makeRecording([1, 2]);

    expect(getOperationProjectAtStep(recording, -1).timeline.tracks[0].clips).toHaveLength(0);
    expect(getOperationProjectAtStep(recording, 99).timeline.tracks[0].clips).toHaveLength(2);
  });

  it('generates an HTML slide report with escaped operation descriptions', () => {
    const recording = recordOperationCommand(createOperationRecording(makeProject(0), { startedAtMs: 1_000 }), makeCommand('Trim <clip>'), makeProject(1), 1_100);

    const html = generateOperationRecordingSlidesHtml(recording, 1);

    expect(html).toContain('<!doctype html>');
    expect(html).toContain('Trim &lt;clip&gt;');
    expect(html).toContain('Clip 1 / Track 3');
  });
});

function makeRecording(clipCounts: number[], timestamps = clipCounts.map((_, index) => 1_000 + index * 100)): OperationRecordingFile {
  return clipCounts.reduce(
    (recording, clipCount, index) => recordOperationCommand(recording, makeCommand(`Step ${index + 1}`), makeProject(clipCount), timestamps[index]),
    createOperationRecording(makeProject(0), { startedAtMs: 1_000, createdAt: '2026-01-01T00:00:00.000Z' })
  );
}

function makeCommand(description: string): Command {
  return {
    description,
    execute: () => undefined,
    undo: () => undefined
  };
}

function makeProject(clipCount: number): Project {
  const project = createProject('Recording Test');
  const clips = Array.from({ length: clipCount }, (_, index) => ({
    id: `clip-${index}`,
    type: 'video' as const,
    name: `Clip ${index + 1}`,
    mediaId: 'media-video',
    trackId: 'track-video',
    start: index,
    duration: 1,
    trimStart: 0,
    trimEnd: 0,
    speed: 1,
    colorCorrection: { brightness: 0, contrast: 1, saturation: 1, hue: 0 },
    transform: { x: 0, y: 0, scale: 1, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
    volume: 1
  }));
  const timeline = {
    markers: [],
    transitions: [],
    tracks: [
      createTrack({ id: 'track-video', type: 'video', name: 'Video 1', clips }),
      createTrack({ id: 'track-audio', type: 'audio', name: 'Audio 1', clips: [] }),
      createTrack({ id: 'track-text', type: 'text', name: 'Text 1', clips: [] })
    ]
  };
  return {
    ...project,
    media: [
      {
        id: 'media-video',
        type: 'video',
        name: 'video.mp4',
        path: 'C:/Media/video.mp4',
        duration: 6,
        width: 1280,
        height: 720
      }
    ],
    timeline,
    sequences: [{ id: 'sequence-main', name: 'Main Sequence', timeline }],
    activeSequenceId: 'sequence-main'
  };
}

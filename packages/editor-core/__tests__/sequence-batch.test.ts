import { describe, expect, it } from 'vitest';
import {
  PRIMARY_SEQUENCE_ID,
  SequenceDependencyCycleError,
  buildProjectForSequenceExport,
  createNestedSequenceClip,
  createSequence,
  createTrack,
  expandSequenceBatchOutputPath,
  sortBatchSequenceIds
} from '../src';
import { makeProject, makeTimeline, makeVideoClip } from './test-utils';

describe('sequence batch export helpers', () => {
  it('sorts selected sequences so nested dependencies render before parent sequences', () => {
    const project = makeProject();
    const child = createSequence({
      id: 'sequence-child',
      name: 'Child',
      timeline: makeTimeline([makeVideoClip({ id: 'child-video' })])
    });
    const main = createSequence({
      id: PRIMARY_SEQUENCE_ID,
      name: 'Main',
      timeline: {
        tracks: [
          createTrack({
            id: 'track-video',
            type: 'video',
            name: 'Video',
            clips: [
              createNestedSequenceClip({
                id: 'main-nested-child',
                name: 'Child',
                trackId: 'track-video',
                sequenceId: child.id,
                start: 0,
                duration: 4,
                trimStart: 0,
                trimEnd: 0
              })
            ]
          })
        ]
      }
    });
    project.timeline = main.timeline;
    project.sequences = [main, child];

    expect(sortBatchSequenceIds(project, [PRIMARY_SEQUENCE_ID, child.id])).toEqual([child.id, PRIMARY_SEQUENCE_ID]);
  });

  it('expands sequence filename variables with sanitized sequence names', () => {
    const path = expandSequenceBatchOutputPath('C:/Exports/{date}-{index}-{sequence}.mp4', { name: 'Scene: A/B' }, 2, new Date('2026-06-15T12:00:00Z'));

    expect(path).toBe('C:/Exports/20260615-2-Scene- A-B.mp4');
  });

  it('detects circular nested-sequence dependencies', () => {
    const project = makeProject();
    const sequenceA = createSequence({
      id: 'sequence-a',
      name: 'A',
      timeline: makeTimeline([
        createNestedSequenceClip({
          id: 'a-to-b',
          name: 'B',
          trackId: 'track-video',
          sequenceId: 'sequence-b',
          start: 0,
          duration: 3,
          trimStart: 0,
          trimEnd: 0
        })
      ])
    });
    const sequenceB = createSequence({
      id: 'sequence-b',
      name: 'B',
      timeline: makeTimeline([
        createNestedSequenceClip({
          id: 'b-to-a',
          name: 'A',
          trackId: 'track-video',
          sequenceId: 'sequence-a',
          start: 0,
          duration: 3,
          trimStart: 0,
          trimEnd: 0
        })
      ])
    });
    project.sequences = [createSequence({ id: PRIMARY_SEQUENCE_ID, name: 'Main', timeline: project.timeline }), sequenceA, sequenceB];

    expect(() => sortBatchSequenceIds(project, ['sequence-a', 'sequence-b'])).toThrow(SequenceDependencyCycleError);
  });

  it('builds a project whose primary export timeline is the selected sequence', () => {
    const project = makeProject();
    const alt = createSequence({
      id: 'sequence-alt',
      name: 'Alt',
      timeline: makeTimeline([makeVideoClip({ id: 'alt-video', duration: 5 })])
    });
    project.sequences = [createSequence({ id: PRIMARY_SEQUENCE_ID, name: 'Main', timeline: project.timeline }), alt];

    const exportProject = buildProjectForSequenceExport(project, alt.id);

    expect(exportProject.activeSequenceId).toBe(PRIMARY_SEQUENCE_ID);
    expect(exportProject.timeline.tracks.flatMap((track) => track.clips).map((clip) => clip.id)).toContain('alt-video');
    expect(exportProject.sequences.find((sequence) => sequence.id === PRIMARY_SEQUENCE_ID)?.timeline).toBe(alt.timeline);
  });
});

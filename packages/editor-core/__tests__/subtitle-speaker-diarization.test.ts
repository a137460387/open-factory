import { describe, expect, it } from 'vitest';
import {
  assignSpeakerIds,
  batchRenameSpeakers,
  buildSpeakerLabels,
  detectPauseBoundaries,
  detectSpeakerChange,
  performSpeakerDiarization,
  renameSpeaker,
  type SubtitleSegmentInput
} from '../src/subtitles/subtitle-speaker-diarization';

function makeSegment(id: string, start: number, end: number, text: string, zcr?: number): SubtitleSegmentInput {
  return { id, start, end, text, zeroCrossingRate: zcr };
}

describe('pause boundary detection', () => {
  it('detects gaps above threshold as boundaries', () => {
    const segments = [
      makeSegment('a', 0, 1, 'hello'),
      makeSegment('b', 2.5, 3.5, 'world'),
      makeSegment('c', 3.8, 4.5, 'again')
    ];
    const boundaries = detectPauseBoundaries(segments, 1.2);
    expect(boundaries).toEqual([false, true, false]);
  });

  it('returns [false] for single segment', () => {
    expect(detectPauseBoundaries([makeSegment('a', 0, 1, 'hi')])).toEqual([false]);
  });

  it('returns empty for no segments', () => {
    expect(detectPauseBoundaries([])).toEqual([]);
  });
});

describe('zero crossing rate change detection', () => {
  it('detects change when difference exceeds threshold', () => {
    expect(detectSpeakerChange(0.3, 0.1, 0.15)).toBe(true);
  });

  it('returns false when difference is below threshold', () => {
    expect(detectSpeakerChange(0.25, 0.2, 0.15)).toBe(false);
  });
});

describe('speaker ID assignment', () => {
  it('assigns same speaker for continuous segments', () => {
    const segments = [
      makeSegment('a', 0, 1, 'hi', 0.2),
      makeSegment('b', 1.05, 2, 'there', 0.22)
    ];
    const result = assignSpeakerIds(segments);
    expect(result[0].speakerId).toBe(0);
    expect(result[1].speakerId).toBe(0);
  });

  it('assigns new speaker on pause + zcr change', () => {
    const segments = [
      makeSegment('a', 0, 1, 'hi', 0.2),
      makeSegment('b', 3, 4, 'there', 0.5)
    ];
    const result = assignSpeakerIds(segments, 1.2, 0.15);
    expect(result[0].speakerId).toBe(0);
    expect(result[1].speakerId).toBe(1);
  });

  it('does not create new speaker on pause alone without zcr change', () => {
    const segments = [
      makeSegment('a', 0, 1, 'hi', 0.2),
      makeSegment('b', 3, 4, 'there', 0.25)
    ];
    const result = assignSpeakerIds(segments, 1.2, 0.15);
    expect(result[0].speakerId).toBe(0);
    expect(result[1].speakerId).toBe(0);
  });
});

describe('speaker labels', () => {
  it('generates default labels', () => {
    expect(buildSpeakerLabels(3)).toEqual({ 0: '说话人1', 1: '说话人2', 2: '说话人3' });
  });

  it('renames a single speaker', () => {
    const labels = buildSpeakerLabels(2);
    const updated = renameSpeaker(labels, 0, '主持人');
    expect(updated[0]).toBe('主持人');
    expect(updated[1]).toBe('说话人2');
  });

  it('batch renames speakers', () => {
    const labels = buildSpeakerLabels(3);
    const updated = batchRenameSpeakers(labels, { 0: '主持人', 2: '嘉宾' });
    expect(updated[0]).toBe('主持人');
    expect(updated[1]).toBe('说话人2');
    expect(updated[2]).toBe('嘉宾');
  });

  it('ignores rename for non-existent speaker', () => {
    const labels = buildSpeakerLabels(2);
    const updated = renameSpeaker(labels, 99, 'ghost');
    expect(updated).toEqual(labels);
  });
});

describe('full speaker diarization', () => {
  it('detects 3 speakers from alternating segments', () => {
    const segments = [
      makeSegment('s1', 0, 1, 'A speaks', 0.2),
      makeSegment('s2', 1.5, 2.5, 'A continues', 0.22),
      makeSegment('s3', 4, 5, 'B speaks', 0.6),
      makeSegment('s4', 5.5, 6.5, 'B continues', 0.58),
      makeSegment('s5', 8, 9, 'C speaks', 0.9),
      makeSegment('s6', 9.5, 10, 'C continues', 0.88)
    ];
    const result = performSpeakerDiarization(segments, 1.2, 0.15);
    expect(result.assignments).toHaveLength(6);
    const uniqueSpeakers = new Set(result.assignments.map((a) => a.speakerId));
    expect(uniqueSpeakers.size).toBe(3);
    expect(Object.keys(result.speakerLabels)).toHaveLength(3);
  });
});

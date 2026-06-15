import { describe, expect, it } from 'vitest';
import { buildTimelineNoteLayout, serializeTimelineNotesCsv, timelineNotesOverlap, type TimelineNote } from '../src';

const baseNote: TimelineNote = {
  id: 'note-a',
  start: 0,
  end: 1,
  text: 'Opening beat',
  color: '#facc15',
  createdAt: '2026-06-15T00:00:00.000Z'
};

describe('timeline notes', () => {
  it('detects overlapping timeline note ranges', () => {
    expect(timelineNotesOverlap({ start: 1, end: 3 }, { start: 2, end: 4 })).toBe(true);
    expect(timelineNotesOverlap({ start: 1, end: 3 }, { start: 3, end: 4 })).toBe(false);
  });

  it('assigns overlapping notes to stacked lanes by creation order', () => {
    const layout = buildTimelineNoteLayout([
      { ...baseNote, id: 'note-late', start: 0.5, end: 2, createdAt: '2026-06-15T00:00:02.000Z' },
      { ...baseNote, id: 'note-early', start: 0, end: 1.5, createdAt: '2026-06-15T00:00:01.000Z' },
      { ...baseNote, id: 'note-clear', start: 2.5, end: 3, createdAt: '2026-06-15T00:00:03.000Z' }
    ]);

    expect(layout.map((row) => [row.note.id, row.lane, row.overlaps])).toEqual([
      ['note-early', 0, true],
      ['note-late', 1, true],
      ['note-clear', 0, false]
    ]);
  });

  it('serializes timeline notes to CSV with timecodes, text, and color', () => {
    expect(
      serializeTimelineNotesCsv([
        { ...baseNote, start: 1, end: 2.5, text: 'Needs, review', color: '#38bdf8' },
        { ...baseNote, id: 'note-b', start: 3, end: 4, text: 'Quote "here"', color: '#34d399' }
      ], 30)
    ).toBe('start_timecode,end_timecode,text,color\n00:00:01:00,00:00:02:15,"Needs, review",#38bdf8\n00:00:03:00,00:00:04:00,"Quote ""here""",#34d399\n');
  });
});

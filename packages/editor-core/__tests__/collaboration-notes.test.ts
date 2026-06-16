import { describe, expect, it } from 'vitest';
import {
  buildCollaborationReportHtml,
  createProject,
  filterCollaborationNotesByAuthor,
  toggleCollaborationNoteResolved,
  type CollaborationNote
} from '../src';

describe('collaboration notes', () => {
  const notes: CollaborationNote[] = [
    {
      id: 'note-a',
      type: 'comment',
      authorName: 'Alice',
      authorColor: '#38bdf8',
      start: 2,
      text: 'Check cut',
      resolved: false,
      createdAt: '2026-06-16T00:00:01.000Z'
    },
    {
      id: 'note-b',
      type: 'highlight',
      authorName: 'Bob',
      authorColor: '#facc15',
      start: 1,
      end: 3,
      text: 'Hold this range',
      resolved: false,
      createdAt: '2026-06-16T00:00:02.000Z'
    }
  ];

  it('filters notes by author and sorts them by time', () => {
    expect(filterCollaborationNotesByAuthor(notes, 'bob').map((note) => note.id)).toEqual(['note-b']);
    expect(filterCollaborationNotesByAuthor(notes).map((note) => note.id)).toEqual(['note-b', 'note-a']);
  });

  it('toggles resolved state immutably', () => {
    const toggled = toggleCollaborationNoteResolved(notes, 'note-a', true, '2026-06-16T00:00:03.000Z');

    expect(toggled.find((note) => note.id === 'note-a')).toMatchObject({
      resolved: true,
      updatedAt: '2026-06-16T00:00:03.000Z'
    });
    expect(notes[0].resolved).toBe(false);
  });

  it('renders an HTML report with author names', () => {
    const project = createProject('Collab Report');
    project.collaborationNotes = notes;

    const html = buildCollaborationReportHtml(project, { generatedAt: '2026-06-16T00:00:00.000Z', locale: 'zh' });

    expect(html).toContain('协同标注报告');
    expect(html).toContain('Alice');
    expect(html).toContain('Bob');
    expect(html).toContain('Check cut');
  });
});

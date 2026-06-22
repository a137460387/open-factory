import { describe, expect, it } from 'vitest';
import {
  getAnnotationSyncFilename,
  packAnnotationSyncData,
  serializeAnnotationSyncData,
  parseAnnotationSyncData,
  mergeAnnotationSyncData,
  type AnnotationSyncNote,
  type AnnotationSyncBookmark,
  type AnnotationSyncMarker
} from '../src/annotation-sync';

describe('annotation sync', () => {
  const notes: AnnotationSyncNote[] = [
    { id: 'n1', start: 5, end: 10, text: 'Good shot', color: '#ff0000', authorName: 'Alice', resolved: false, updatedAt: '2026-01-01T00:00:00.000Z' }
  ];
  const bookmarks: AnnotationSyncBookmark[] = [
    { id: 'b1', time: 3, note: 'Important', updatedAt: '2026-01-01T00:00:00.000Z' }
  ];
  const markers: AnnotationSyncMarker[] = [
    { id: 'm1', time: 15, label: 'Scene 1', updatedAt: '2026-01-01T00:00:00.000Z' }
  ];

  describe('getAnnotationSyncFilename', () => {
    it('generates correct filename from project id', () => {
      expect(getAnnotationSyncFilename('proj-123')).toBe('annotations_proj-123.json');
    });
  });

  describe('packAnnotationSyncData', () => {
    it('creates a valid sync data structure', () => {
      const data = packAnnotationSyncData('proj-1', notes, bookmarks, markers, '2026-01-01T00:00:00.000Z');
      expect(data.version).toBe(1);
      expect(data.projectId).toBe('proj-1');
      expect(data.notes.length).toBe(1);
      expect(data.bookmarks.length).toBe(1);
      expect(data.markers.length).toBe(1);
      expect(data.syncedAt).toBe('2026-01-01T00:00:00.000Z');
    });

    it('generates ids for items without ids', () => {
      const data = packAnnotationSyncData('proj-1', [
        { id: '', start: 0, end: 5, text: 'test', color: '#fff', authorName: 'Bob', resolved: false, updatedAt: '2026-01-01' }
      ], [], []);
      expect(data.notes[0].id).toBeTruthy();
    });
  });

  describe('serializeAnnotationSyncData / parseAnnotationSyncData', () => {
    it('round-trips data through JSON', () => {
      const data = packAnnotationSyncData('proj-1', notes, bookmarks, markers, '2026-01-01');
      const serialized = serializeAnnotationSyncData(data);
      const parsed = parseAnnotationSyncData(serialized);
      expect(parsed).toBeDefined();
      expect(parsed?.projectId).toBe('proj-1');
      expect(parsed?.notes.length).toBe(1);
    });

    it('returns undefined for invalid JSON', () => {
      expect(parseAnnotationSyncData('not json')).toBeUndefined();
    });

    it('returns undefined for wrong version', () => {
      expect(parseAnnotationSyncData(JSON.stringify({ version: 2, projectId: 'p' }))).toBeUndefined();
    });
  });

  describe('mergeAnnotationSyncData', () => {
    it('merges notes from local and remote', () => {
      const local = packAnnotationSyncData('proj-1', notes, bookmarks, markers, '2026-01-01');
      const remoteNotes: AnnotationSyncNote[] = [
        { id: 'n2', start: 20, end: 25, text: 'Another shot', color: '#00ff00', authorName: 'Bob', resolved: false, updatedAt: '2026-01-02' }
      ];
      const remote = packAnnotationSyncData('proj-1', remoteNotes, [], [], '2026-01-02');
      const result = mergeAnnotationSyncData(local, remote, '2026-01-03');
      expect(result.merged.notes.length).toBe(2);
      expect(result.conflicts.length).toBe(0);
    });

    it('resolves conflicts by taking newer timestamp', () => {
      const local = packAnnotationSyncData('proj-1', [
        { id: 'n1', start: 5, end: 10, text: 'local edit', color: '#ff0000', authorName: 'Alice', resolved: false, updatedAt: '2026-01-02' }
      ], [], []);
      const remote = packAnnotationSyncData('proj-1', [
        { id: 'n1', start: 5, end: 10, text: 'remote edit', color: '#ff0000', authorName: 'Alice', resolved: false, updatedAt: '2026-01-03' }
      ], [], []);
      const result = mergeAnnotationSyncData(local, remote);
      expect(result.conflicts.length).toBe(1);
      expect(result.conflicts[0].resolvedTo).toBe('remote');
      expect(result.merged.notes[0].text).toBe('remote edit');
    });

    it('keeps local when local is newer', () => {
      const local = packAnnotationSyncData('proj-1', [
        { id: 'n1', start: 5, end: 10, text: 'local newer', color: '#ff0000', authorName: 'Alice', resolved: false, updatedAt: '2026-01-05' }
      ], [], []);
      const remote = packAnnotationSyncData('proj-1', [
        { id: 'n1', start: 5, end: 10, text: 'remote older', color: '#ff0000', authorName: 'Alice', resolved: false, updatedAt: '2026-01-01' }
      ], [], []);
      const result = mergeAnnotationSyncData(local, remote);
      expect(result.conflicts.length).toBe(1);
      expect(result.conflicts[0].resolvedTo).toBe('local');
      expect(result.merged.notes[0].text).toBe('local newer');
    });

    it('merges bookmarks and markers', () => {
      const local = packAnnotationSyncData('proj-1', [], bookmarks, []);
      const remote = packAnnotationSyncData('proj-1', [], [], markers);
      const result = mergeAnnotationSyncData(local, remote);
      expect(result.merged.bookmarks.length).toBe(1);
      expect(result.merged.markers.length).toBe(1);
    });

    it('handles identical timestamps without conflict', () => {
      const local = packAnnotationSyncData('proj-1', notes, [], [], '2026-01-01');
      const remote = packAnnotationSyncData('proj-1', notes, [], [], '2026-01-01');
      const result = mergeAnnotationSyncData(local, remote);
      expect(result.conflicts.length).toBe(0);
    });
  });
});

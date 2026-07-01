import { describe, expect, it } from 'vitest';
import {
  applyBatchAction,
  buildConflictReport,
  createConflictWizard,
  detectDuplicateFileConflict,
  detectFileLockedConflict,
  detectSameNameDifferentContentConflict,
  detectSpecialCharactersConflict,
  getRecommendedAction,
  moveToNextUnresolved,
  normalizeConflictAction,
  resolveCurrentConflict,
  type ImportConflictItem
} from '../src';

describe('media import conflict resolution', () => {
  describe('conflict type detection', () => {
    it('detects duplicate file conflict (same path, same size)', () => {
      const result = detectDuplicateFileConflict(
        'video.mp4',
        'C:/media/video.mp4',
        ['C:/media/video.mp4'],
        new Map([['C:/media/video.mp4', 1024]]),
        1024
      );
      expect(result).toBeDefined();
      expect(result!.conflictType).toBe('duplicate-file');
      expect(result!.recommendedAction).toBe('skip');
    });

    it('detects same-name different content conflict', () => {
      const result = detectSameNameDifferentContentConflict(
        'clip.mp4',
        'C:/imports/clip.mp4',
        ['D:/media/clip.mp4'],
        new Map([['D:/media/clip.mp4', 2048]]),
        4096
      );
      expect(result).toBeDefined();
      expect(result!.conflictType).toBe('same-name-different-content');
      expect(result!.recommendedAction).toBe('rename');
    });

    it('detects special characters in path', () => {
      const result = detectSpecialCharactersConflict(
        'my video.mp4',
        'C:/media/my video&more.mp4'
      );
      expect(result).toBeDefined();
      expect(result!.conflictType).toBe('special-characters');
      expect(result!.recommendedAction).toBe('rename');
    });

    it('detects file locked conflict', () => {
      const result = detectFileLockedConflict(
        'locked.mp4',
        'C:/media/locked.mp4',
        true
      );
      expect(result).toBeDefined();
      expect(result!.conflictType).toBe('file-locked');
      expect(result!.recommendedAction).toBe('skip');
    });

    it('returns undefined for duplicate file with different size', () => {
      const result = detectDuplicateFileConflict(
        'video.mp4',
        'C:/media/video.mp4',
        ['C:/media/video.mp4'],
        new Map([['C:/media/video.mp4', 2048]]),
        1024
      );
      expect(result).toBeUndefined();
    });

    it('returns undefined when no matching path exists', () => {
      const result = detectDuplicateFileConflict(
        'video.mp4',
        'C:/media/video.mp4',
        ['D:/media/other.mp4'],
        new Map([['D:/media/other.mp4', 1024]]),
        1024
      );
      expect(result).toBeUndefined();
    });

    it('returns undefined when existing size not in map', () => {
      const result = detectDuplicateFileConflict(
        'video.mp4',
        'C:/media/video.mp4',
        ['C:/media/video.mp4'],
        new Map(),
        1024
      );
      expect(result).toBeUndefined();
    });

    it('returns undefined for same-name same-path conflict', () => {
      const result = detectSameNameDifferentContentConflict(
        'clip.mp4',
        'C:/media/clip.mp4',
        ['C:/media/clip.mp4'],
        new Map([['C:/media/clip.mp4', 2048]]),
        4096
      );
      expect(result).toBeUndefined();
    });

    it('returns undefined for same-name with no matching name', () => {
      const result = detectSameNameDifferentContentConflict(
        'clip.mp4',
        'C:/imports/clip.mp4',
        ['D:/media/other.mp4'],
        new Map([['D:/media/other.mp4', 2048]]),
        4096
      );
      expect(result).toBeUndefined();
    });

    it('returns undefined for same-name when existing size not in map', () => {
      const result = detectSameNameDifferentContentConflict(
        'clip.mp4',
        'C:/imports/clip.mp4',
        ['D:/media/clip.mp4'],
        new Map(),
        4096
      );
      expect(result).toBeUndefined();
    });

    it('returns undefined for clean path without special characters', () => {
      const result = detectSpecialCharactersConflict(
        'normal-video.mp4',
        'C:/media/normal-video.mp4'
      );
      expect(result).toBeUndefined();
    });

    it('returns undefined for unlocked file', () => {
      const result = detectFileLockedConflict(
        'video.mp4',
        'C:/media/video.mp4',
        false
      );
      expect(result).toBeUndefined();
    });
  });

  describe('smart default action', () => {
    it('recommends skip for duplicate-file', () => {
      expect(getRecommendedAction('duplicate-file')).toBe('skip');
    });

    it('recommends rename for same-name-different-content', () => {
      expect(getRecommendedAction('same-name-different-content')).toBe('rename');
    });

    it('recommends rename for special-characters', () => {
      expect(getRecommendedAction('special-characters')).toBe('rename');
    });

    it('recommends skip for file-locked', () => {
      expect(getRecommendedAction('file-locked')).toBe('skip');
    });
  });

  describe('wizard flow', () => {
    function makeItems(): ImportConflictItem[] {
      return [
        { id: 'c1', conflictType: 'duplicate-file', fileName: 'a.mp4', filePath: '/a.mp4', detail: 'dup', recommendedAction: 'skip' },
        { id: 'c2', conflictType: 'special-characters', fileName: 'b&c.mp4', filePath: '/b&c.mp4', detail: 'special', recommendedAction: 'rename' },
        { id: 'c3', conflictType: 'file-locked', fileName: 'd.mp4', filePath: '/d.mp4', detail: 'locked', recommendedAction: 'skip' }
      ];
    }

    it('creates wizard and resolves items one by one', () => {
      let state = createConflictWizard(makeItems());
      expect(state.currentIndex).toBe(0);
      expect(state.completed).toBe(false);

      state = resolveCurrentConflict(state, 'skip');
      expect(state.currentIndex).toBe(1);
      expect(state.items[0].resolvedAction).toBe('skip');

      state = resolveCurrentConflict(state, 'rename', 'b_fixed.mp4');
      expect(state.items[1].resolvedAction).toBe('rename');
      expect(state.items[1].resolvedNewName).toBe('b_fixed.mp4');
    });

    it('applies batch action to all unresolved items', () => {
      let state = createConflictWizard(makeItems());
      state = resolveCurrentConflict(state, 'skip');
      state = applyBatchAction(state, 'rename');
      expect(state.batchApplied).toBe(true);
      expect(state.completed).toBe(true);
      expect(state.items[0].resolvedAction).toBe('skip');
      expect(state.items[1].resolvedAction).toBe('rename');
      expect(state.items[2].resolvedAction).toBe('rename');
    });

    it('handles empty wizard as completed', () => {
      const state = createConflictWizard([]);
      expect(state.completed).toBe(true);
    });

    it('auto-generates rename when no newName provided', () => {
      let state = createConflictWizard([
        { id: 'c1', conflictType: 'same-name-different-content', fileName: 'clip.mp4', filePath: '/clip.mp4', detail: 'test', recommendedAction: 'rename' }
      ]);
      state = resolveCurrentConflict(state, 'rename');
      expect(state.items[0].resolvedAction).toBe('rename');
      expect(state.items[0].resolvedNewName).toBe('clip_imported.mp4');
    });

    it('auto-generates rename for file without extension', () => {
      let state = createConflictWizard([
        { id: 'c1', conflictType: 'same-name-different-content', fileName: 'readme', filePath: '/readme', detail: 'test', recommendedAction: 'rename' }
      ]);
      state = resolveCurrentConflict(state, 'rename');
      expect(state.items[0].resolvedNewName).toBe('readme_imported');
    });

    it('sets resolvedNewName to undefined for non-rename actions', () => {
      let state = createConflictWizard([
        { id: 'c1', conflictType: 'duplicate-file', fileName: 'a.mp4', filePath: '/a.mp4', detail: '', recommendedAction: 'skip' }
      ]);
      state = resolveCurrentConflict(state, 'skip');
      expect(state.items[0].resolvedNewName).toBeUndefined();
    });

    it('auto-generates rename for file starting with dot', () => {
      let state = createConflictWizard([
        { id: 'c1', conflictType: 'same-name-different-content', fileName: '.hidden', filePath: '/.hidden', detail: 'test', recommendedAction: 'rename' }
      ]);
      state = resolveCurrentConflict(state, 'rename');
      expect(state.items[0].resolvedNewName).toBe('.hidden_imported');
    });
  });

  describe('conflict report', () => {
    it('builds report with correct statistics', () => {
      const items: ImportConflictItem[] = [
        { id: 'c1', conflictType: 'duplicate-file', fileName: 'a.mp4', filePath: '/a.mp4', detail: '', recommendedAction: 'skip', resolvedAction: 'skip' },
        { id: 'c2', conflictType: 'same-name-different-content', fileName: 'b.mp4', filePath: '/b.mp4', detail: '', recommendedAction: 'rename', resolvedAction: 'rename' },
        { id: 'c3', conflictType: 'special-characters', fileName: 'c.mp4', filePath: '/c&d.mp4', detail: '', recommendedAction: 'rename', resolvedAction: 'rename' },
        { id: 'c4', conflictType: 'file-locked', fileName: 'd.mp4', filePath: '/d.mp4', detail: '', recommendedAction: 'skip', resolvedAction: 'skip' }
      ];
      const report = buildConflictReport(items);
      expect(report.totalConflicts).toBe(4);
      expect(report.resolved).toBe(4);
      expect(report.skipped).toBe(2);
      expect(report.renamed).toBe(2);
      expect(report.overwritten).toBe(0);
      expect(report.byType['duplicate-file']).toBe(1);
      expect(report.byType['same-name-different-content']).toBe(1);
      expect(report.byType['special-characters']).toBe(1);
      expect(report.byType['file-locked']).toBe(1);
    });

    it('handles unresolved items in report', () => {
      const items: ImportConflictItem[] = [
        { id: 'c1', conflictType: 'duplicate-file', fileName: 'a.mp4', filePath: '/a.mp4', detail: '', recommendedAction: 'skip' }
      ];
      const report = buildConflictReport(items);
      expect(report.totalConflicts).toBe(1);
      expect(report.resolved).toBe(0);
    });

    it('counts overwrite and force-import actions', () => {
      const items: ImportConflictItem[] = [
        { id: 'c1', conflictType: 'duplicate-file', fileName: 'a.mp4', filePath: '/a.mp4', detail: '', recommendedAction: 'skip', resolvedAction: 'overwrite' },
        { id: 'c2', conflictType: 'file-locked', fileName: 'b.mp4', filePath: '/b.mp4', detail: '', recommendedAction: 'skip', resolvedAction: 'force-import' }
      ];
      const report = buildConflictReport(items);
      expect(report.overwritten).toBe(1);
      expect(report.forceImported).toBe(1);
      expect(report.resolved).toBe(2);
    });

    it('handles empty items', () => {
      const report = buildConflictReport([]);
      expect(report.totalConflicts).toBe(0);
      expect(report.resolved).toBe(0);
      expect(report.skipped).toBe(0);
      expect(report.renamed).toBe(0);
    });
  });

  describe('moveToNextUnresolved', () => {
    it('moves to next unresolved item', () => {
      let state = createConflictWizard([
        { id: 'c1', conflictType: 'duplicate-file', fileName: 'a.mp4', filePath: '/a.mp4', detail: '', recommendedAction: 'skip', resolvedAction: 'skip' },
        { id: 'c2', conflictType: 'file-locked', fileName: 'b.mp4', filePath: '/b.mp4', detail: '', recommendedAction: 'skip' }
      ]);
      state = moveToNextUnresolved(state);
      expect(state.currentIndex).toBe(1);
      expect(state.completed).toBe(false);
    });

    it('marks as completed when all items are resolved', () => {
      let state = createConflictWizard([
        { id: 'c1', conflictType: 'duplicate-file', fileName: 'a.mp4', filePath: '/a.mp4', detail: '', recommendedAction: 'skip', resolvedAction: 'skip' }
      ]);
      state = moveToNextUnresolved(state);
      expect(state.completed).toBe(true);
    });

    it('marks as completed for empty items', () => {
      let state = createConflictWizard([]);
      state = moveToNextUnresolved(state);
      expect(state.completed).toBe(true);
    });
  });

  describe('normalizeConflictAction', () => {
    it('returns valid action strings', () => {
      expect(normalizeConflictAction('rename')).toBe('rename');
      expect(normalizeConflictAction('skip')).toBe('skip');
      expect(normalizeConflictAction('overwrite')).toBe('overwrite');
      expect(normalizeConflictAction('force-import')).toBe('force-import');
    });

    it('returns undefined for invalid action', () => {
      expect(normalizeConflictAction('invalid')).toBeUndefined();
      expect(normalizeConflictAction(undefined)).toBeUndefined();
      expect(normalizeConflictAction('')).toBeUndefined();
    });
  });
});

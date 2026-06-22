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
  });
});

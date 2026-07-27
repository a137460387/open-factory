import { describe, it, expect } from 'vitest';
import {
  createInitialDialogState,
  applyDialogUpdate,
  DIALOG_KEYS,
  type DialogState,
  type DialogKey,
} from '../dialog-state';

describe('dialog-state', () => {
  describe('createInitialDialogState', () => {
    it('returns all keys set to false', () => {
      const state = createInitialDialogState();
      for (const key of DIALOG_KEYS) {
        expect(state[key]).toBe(false);
      }
    });

    it('contains all expected dialog keys', () => {
      const state = createInitialDialogState();
      expect(Object.keys(state)).toHaveLength(DIALOG_KEYS.length);
    });

    it('includes settingsOpen', () => {
      const state = createInitialDialogState();
      expect(state.settingsOpen).toBe(false);
    });
  });

  describe('applyDialogUpdate', () => {
    it('sets a dialog to true', () => {
      const state = createInitialDialogState();
      const updated = applyDialogUpdate(state, 'settingsOpen', true);
      expect(updated.settingsOpen).toBe(true);
    });

    it('sets a dialog to false', () => {
      const state = { ...createInitialDialogState(), settingsOpen: true };
      const updated = applyDialogUpdate(state, 'settingsOpen', false);
      expect(updated.settingsOpen).toBe(false);
    });

    it('accepts a function updater', () => {
      const state = { ...createInitialDialogState(), settingsOpen: true };
      const updated = applyDialogUpdate(state, 'settingsOpen', (current) => !current);
      expect(updated.settingsOpen).toBe(false);
    });

    it('does not mutate the original state', () => {
      const state = createInitialDialogState();
      const updated = applyDialogUpdate(state, 'settingsOpen', true);
      expect(state.settingsOpen).toBe(false);
      expect(updated.settingsOpen).toBe(true);
    });

    it('preserves other dialog states', () => {
      const state = { ...createInitialDialogState(), lutEditorOpen: true };
      const updated = applyDialogUpdate(state, 'settingsOpen', true);
      expect(updated.lutEditorOpen).toBe(true);
      expect(updated.settingsOpen).toBe(true);
    });

    it('works with all dialog keys', () => {
      let state = createInitialDialogState();
      for (const key of DIALOG_KEYS) {
        state = applyDialogUpdate(state, key, true);
      }
      for (const key of DIALOG_KEYS) {
        expect(state[key]).toBe(true);
      }
    });
  });

  describe('DIALOG_KEYS', () => {
    it('is a readonly array', () => {
      expect(Array.isArray(DIALOG_KEYS)).toBe(true);
      expect(DIALOG_KEYS.length).toBeGreaterThan(0);
    });

    it('has no duplicate keys', () => {
      const unique = new Set(DIALOG_KEYS);
      expect(unique.size).toBe(DIALOG_KEYS.length);
    });
  });
});

import { describe, expect, it } from 'vitest';
import {
  getCoreKeyboardFocusOrder,
  isShortcutCheatsheetKey,
  resolveSliderKeyboardValue
} from './keyboard-navigation';

describe('keyboard accessibility helpers', () => {
  it('keeps the core focus order covering toolbar, media, timeline, and inspector regions', () => {
    expect(getCoreKeyboardFocusOrder()).toEqual([
      'toolbar-file-menu-button',
      'toolbar-import-menu-button',
      'toolbar-export-button',
      'media-search-input',
      'media-filter-all',
      'media-view-grid',
      'timeline-root',
      'inspector-empty-state'
    ]);
  });

  it('recognizes the shortcut cheatsheet key without hijacking modified shortcuts', () => {
    expect(isShortcutCheatsheetKey({ key: '?', shiftKey: true, ctrlKey: false, metaKey: false, altKey: false })).toBe(true);
    expect(isShortcutCheatsheetKey({ key: '/', shiftKey: true, ctrlKey: false, metaKey: false, altKey: false })).toBe(true);
    expect(isShortcutCheatsheetKey({ key: '?', shiftKey: true, ctrlKey: true, metaKey: false, altKey: false })).toBe(false);
  });

  it('applies fine and shift-modified slider keyboard steps', () => {
    expect(resolveSliderKeyboardValue({ key: 'ArrowRight', value: 0.5, min: 0, max: 1, step: 0.01 })).toBe(0.51);
    expect(resolveSliderKeyboardValue({ key: 'ArrowUp', value: 0.5, min: 0, max: 1, step: 0.01, shiftKey: true })).toBe(0.6);
    expect(resolveSliderKeyboardValue({ key: 'ArrowLeft', value: 0.02, min: 0, max: 1, step: 0.05 })).toBe(0);
    expect(resolveSliderKeyboardValue({ key: 'PageUp', value: 0.5, min: 0, max: 1, step: 0.01 })).toBeUndefined();
  });
});

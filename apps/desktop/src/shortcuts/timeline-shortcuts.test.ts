import { describe, expect, it } from 'vitest';
import {
  detectTimelineShortcutConflicts,
  eventToAccelerator,
  resolveTimelineShortcutAction,
  type TimelineShortcutAction,
  type TimelineShortcutKey
} from './timeline-shortcuts';

describe('timeline shortcut mapping', () => {
  it.each<[string, TimelineShortcutKey, TimelineShortcutAction]>([
    ['Space', { key: ' ', code: 'Space' }, 'toggle-playback'],
    ['J', { key: 'j' }, 'reverse-playback'],
    ['K', { key: 'k' }, 'pause-playback'],
    ['L', { key: 'l' }, 'forward-playback'],
    ['ArrowLeft', { key: 'ArrowLeft' }, 'step-back'],
    ['ArrowRight', { key: 'ArrowRight' }, 'step-forward'],
    ['I', { key: 'i' }, 'set-in-point'],
    ['O', { key: 'o' }, 'set-out-point'],
    ['S', { key: 's' }, 'split-selected'],
    ['Delete', { key: 'Delete' }, 'delete-selected'],
    ['Backspace', { key: 'Backspace' }, 'delete-selected'],
    ['Shift+Delete', { key: 'Delete', shiftKey: true }, 'ripple-delete'],
    ['Ctrl+A', { key: 'a', ctrlKey: true }, 'select-all'],
    ['Escape', { key: 'Escape' }, 'clear-selection'],
    ['N', { key: 'n' }, 'add-annotation'],
    ['B', { key: 'b' }, 'add-bookmark'],
    ['G', { key: 'g' }, 'toggle-grid-snap'],
    ['Ctrl+ArrowLeft', { key: 'ArrowLeft', ctrlKey: true }, 'jump-prev-navigation-point'],
    ['Ctrl+ArrowRight', { key: 'ArrowRight', ctrlKey: true }, 'jump-next-navigation-point'],
    ['Ctrl+Z', { key: 'z', ctrlKey: true }, 'undo'],
    ['Ctrl+Alt+Z', { key: 'z', ctrlKey: true, altKey: true }, 'switch-previous-branch'],
    ['Cmd+Shift+Z', { key: 'z', metaKey: true, shiftKey: true }, 'redo'],
    ['Ctrl+S', { key: 's', ctrlKey: true }, 'save'],
    ['Shift+E', { key: 'E', shiftKey: true }, 'export-current-frame']
  ])('maps %s', (_name, event, action) => {
    expect(resolveTimelineShortcutAction(event)).toBe(action);
  });

  it('ignores editing targets', () => {
    expect(resolveTimelineShortcutAction({ key: 'Delete', isTyping: true })).toBeNull();
  });

  it('ignores unrelated modified keys', () => {
    expect(resolveTimelineShortcutAction({ key: 'o', ctrlKey: true })).toBeNull();
  });

  it('uses custom keybindings instead of defaults', () => {
    const bindings = { 'toggle-playback': ['P'] };
    expect(resolveTimelineShortcutAction({ key: 'p' }, bindings)).toBe('toggle-playback');
    expect(resolveTimelineShortcutAction({ key: ' ', code: 'Space' }, bindings)).toBeNull();
  });

  it('normalizes captured key events into accelerators', () => {
    expect(eventToAccelerator({ key: 'z', ctrlKey: true, shiftKey: true })).toBe('Ctrl+Shift+Z');
    expect(eventToAccelerator({ key: ' ', code: 'Space' })).toBe('Space');
  });

  it('detects conflicting effective bindings', () => {
    const conflicts = detectTimelineShortcutConflicts({ 'toggle-playback': ['K'] });
    expect(conflicts['toggle-playback']).toContain('K');
    expect(conflicts['pause-playback']).toContain('K');
  });
});

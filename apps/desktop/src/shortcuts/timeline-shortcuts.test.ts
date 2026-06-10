import { describe, expect, it } from 'vitest';
import { resolveTimelineShortcutAction, type TimelineShortcutAction, type TimelineShortcutKey } from './timeline-shortcuts';

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
    ['Delete', { key: 'Delete' }, 'delete-selected'],
    ['Backspace', { key: 'Backspace' }, 'delete-selected'],
    ['Ctrl+A', { key: 'a', ctrlKey: true }, 'select-all'],
    ['Escape', { key: 'Escape' }, 'clear-selection'],
    ['Ctrl+Z', { key: 'z', ctrlKey: true }, 'undo'],
    ['Cmd+Shift+Z', { key: 'z', metaKey: true, shiftKey: true }, 'redo'],
    ['Ctrl+S', { key: 's', ctrlKey: true }, 'save']
  ])('maps %s', (_name, event, action) => {
    expect(resolveTimelineShortcutAction(event)).toBe(action);
  });

  it('ignores plain S because split remains a toolbar command', () => {
    expect(resolveTimelineShortcutAction({ key: 's' })).toBeNull();
  });

  it('ignores editing targets', () => {
    expect(resolveTimelineShortcutAction({ key: 'Delete', isTyping: true })).toBeNull();
  });

  it('ignores unrelated modified keys', () => {
    expect(resolveTimelineShortcutAction({ key: 'o', ctrlKey: true })).toBeNull();
  });
});

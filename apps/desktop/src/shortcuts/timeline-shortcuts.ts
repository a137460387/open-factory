export type TimelineShortcutAction =
  | 'toggle-playback'
  | 'reverse-playback'
  | 'pause-playback'
  | 'forward-playback'
  | 'step-back'
  | 'step-forward'
  | 'set-in-point'
  | 'set-out-point'
  | 'delete-selected'
  | 'select-all'
  | 'clear-selection'
  | 'undo'
  | 'redo'
  | 'save';

export interface TimelineShortcutKey {
  key: string;
  code?: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  isTyping?: boolean;
}

export function resolveTimelineShortcutAction(event: TimelineShortcutKey): TimelineShortcutAction | null {
  if (event.isTyping) {
    return null;
  }

  const key = event.key.toLowerCase();
  const mod = Boolean(event.ctrlKey || event.metaKey);

  if (mod && key === 'z') {
    return event.shiftKey ? 'redo' : 'undo';
  }
  if (mod && key === 'y') {
    return 'redo';
  }
  if (mod && key === 's') {
    return 'save';
  }
  if (mod && key === 'a') {
    return 'select-all';
  }
  if (mod) {
    return null;
  }

  if (event.code === 'Space' || event.key === ' ') {
    return 'toggle-playback';
  }

  switch (key) {
    case 'escape':
      return 'clear-selection';
    case 'j':
      return 'reverse-playback';
    case 'k':
      return 'pause-playback';
    case 'l':
      return 'forward-playback';
    case 'arrowleft':
      return 'step-back';
    case 'arrowright':
      return 'step-forward';
    case 'i':
      return 'set-in-point';
    case 'o':
      return 'set-out-point';
    case 'delete':
    case 'backspace':
      return 'delete-selected';
    default:
      return null;
  }
}

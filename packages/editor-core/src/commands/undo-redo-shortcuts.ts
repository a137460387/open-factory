/**
 * Global keyboard shortcut handler for undo/redo.
 *
 * Registers Ctrl+Z / Ctrl+Shift+Z (Cmd on macOS) globally
 * and delegates to the CommandManager.
 */

import type { CommandManager } from './command-manager';

/** Undo/redo shortcut handler options. */
export interface UndoRedoShortcutOptions {
  /** The CommandManager to delegate to. */
  commandManager: CommandManager;
  /** Target element to listen on (default: document). */
  target?: EventTarget;
  /** Whether to prevent default browser behavior (default: true). */
  preventDefault?: boolean;
  /** Callback for undo/redo events (for UI feedback). */
  onAction?: (action: 'undo' | 'redo', description: string) => void;
}

/** Handle for removing the shortcut listeners. */
export interface UndoRedoShortcutHandle {
  /** Remove the keyboard listeners. */
  dispose(): void;
  /** Check if undo is available. */
  canUndo(): boolean;
  /** Check if redo is available. */
  canRedo(): boolean;
}

/**
 * Register global Ctrl+Z / Ctrl+Shift+Z undo/redo shortcuts.
 *
 * @returns A handle to dispose the listeners.
 */
export function registerUndoRedoShortcuts(options: UndoRedoShortcutOptions): UndoRedoShortcutHandle {
  const {
    commandManager,
    target = typeof document !== 'undefined' ? document : null,
    preventDefault = true,
    onAction,
  } = options;

  if (!target) {
    // No target available (e.g., Node.js environment)
    return {
      dispose: () => {},
      canUndo: () => commandManager.canUndo(),
      canRedo: () => commandManager.canRedo(),
    };
  }

  const handler = (event: Event) => {
    const e = event as KeyboardEvent;

    // Check for Ctrl+Z (Windows/Linux) or Cmd+Z (macOS)
    const isMod = e.ctrlKey || e.metaKey;
    if (!isMod || e.key !== 'z' && e.key !== 'Z') return;

    // Ignore if inside an input/textarea/contenteditable
    const target = e.target as HTMLElement;
    if (target) {
      const tagName = target.tagName.toLowerCase();
      if (tagName === 'input' || tagName === 'textarea' || target.isContentEditable) {
        return;
      }
    }

    if (e.shiftKey) {
      // Ctrl+Shift+Z = Redo
      if (commandManager.canRedo()) {
        if (preventDefault) e.preventDefault();
        const meta = commandManager.getHistoryMeta();
        const nextEntry = meta.entries[meta.cursor + 1];
        commandManager.redo();
        onAction?.('redo', nextEntry?.description ?? 'redo');
      }
    } else {
      // Ctrl+Z = Undo
      if (commandManager.canUndo()) {
        if (preventDefault) e.preventDefault();
        const meta = commandManager.getHistoryMeta();
        const currentEntry = meta.entries[meta.cursor];
        commandManager.undo();
        onAction?.('undo', currentEntry?.description ?? 'undo');
      }
    }
  };

  target.addEventListener('keydown', handler as EventListener);

  return {
    dispose: () => {
      target.removeEventListener('keydown', handler as EventListener);
    },
    canUndo: () => commandManager.canUndo(),
    canRedo: () => commandManager.canRedo(),
  };
}

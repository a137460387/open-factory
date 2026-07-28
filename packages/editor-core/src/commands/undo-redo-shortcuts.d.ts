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
export declare function registerUndoRedoShortcuts(options: UndoRedoShortcutOptions): UndoRedoShortcutHandle;
//# sourceMappingURL=undo-redo-shortcuts.d.ts.map
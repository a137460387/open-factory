/**
 * Global keyboard shortcut handler for undo/redo.
 *
 * Registers Ctrl+Z / Ctrl+Shift+Z (Cmd on macOS) globally
 * and delegates to the CommandManager.
 */
/**
 * Register global Ctrl+Z / Ctrl+Shift+Z undo/redo shortcuts.
 *
 * @returns A handle to dispose the listeners.
 */
export function registerUndoRedoShortcuts(options) {
    const { commandManager, target = typeof document !== 'undefined' ? document : null, preventDefault = true, onAction, } = options;
    if (!target) {
        // No target available (e.g., Node.js environment)
        return {
            dispose: () => { },
            canUndo: () => commandManager.canUndo(),
            canRedo: () => commandManager.canRedo(),
        };
    }
    const handler = (event) => {
        const e = event;
        // Check for Ctrl+Z (Windows/Linux) or Cmd+Z (macOS)
        const isMod = e.ctrlKey || e.metaKey;
        if (!isMod || e.key !== 'z' && e.key !== 'Z')
            return;
        // Ignore if inside an input/textarea/contenteditable
        const target = e.target;
        if (target) {
            const tagName = target.tagName.toLowerCase();
            if (tagName === 'input' || tagName === 'textarea' || target.isContentEditable) {
                return;
            }
        }
        if (e.shiftKey) {
            // Ctrl+Shift+Z = Redo
            if (commandManager.canRedo()) {
                if (preventDefault)
                    e.preventDefault();
                const meta = commandManager.getHistoryMeta();
                const nextEntry = meta.entries[meta.cursor + 1];
                commandManager.redo();
                onAction?.('redo', nextEntry?.description ?? 'redo');
            }
        }
        else {
            // Ctrl+Z = Undo
            if (commandManager.canUndo()) {
                if (preventDefault)
                    e.preventDefault();
                const meta = commandManager.getHistoryMeta();
                const currentEntry = meta.entries[meta.cursor];
                commandManager.undo();
                onAction?.('undo', currentEntry?.description ?? 'undo');
            }
        }
    };
    target.addEventListener('keydown', handler);
    return {
        dispose: () => {
            target.removeEventListener('keydown', handler);
        },
        canUndo: () => commandManager.canUndo(),
        canRedo: () => commandManager.canRedo(),
    };
}
//# sourceMappingURL=undo-redo-shortcuts.js.map
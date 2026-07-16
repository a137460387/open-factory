/**
 * Dialog open/close state — selector hooks for editorUIStore.
 *
 * Extracted from editorUIStore (H4). This module does NOT create its own
 * zustand store. Instead it re-exports `useEditorUIStore` and provides
 * domain-specific selector hooks so consumers can import from `dialogStore`
 * without coupling to the full EditorUIState.
 *
 * All state mutations go through the single `useEditorUIStore` store,
 * guaranteeing synchronization with panelStore consumers.
 */

import { useEditorUIStore } from './editorUIStore';
import type { EditorUIState } from './editorUIStore';

// Re-export the combined store for consumers that need the full hook
export { useEditorUIStore as useDialogStore };

// Re-export dialog-state utilities
export type { DialogKey, DialogState } from './dialog-state';
export { DIALOG_KEYS, createInitialDialogState, applyDialogUpdate } from './dialog-state';

/** Selector: full dialog state record */
export const useDialogState = () => useEditorUIStore((s) => s.dialogState);

/**
 * Type-safe selector: reads a single boolean property from EditorUIState.
 * Usage in components:
 *   const isOpen = useEditorUIStore(dialogBooleanSelector('settingsOpen'));
 */
export function dialogBooleanSelector<K extends keyof EditorUIState>(
  key: K,
): (state: EditorUIState) => EditorUIState[K] {
  return (s) => s[key];
}

/**
 * Type-safe selector: reads a single setter from EditorUIState.
 * Usage in components:
 *   const setOpen = useEditorUIStore(dialogSetterSelector('setSettingsOpen'));
 */
export function dialogSetterSelector<K extends keyof EditorUIState>(
  key: K,
): (state: EditorUIState) => EditorUIState[K] {
  return (s) => s[key];
}

// Re-export types for consumers
export type { EditorUIState } from './editorUIStore';

/**
 * Toolbar & menu state — selector hooks for editorUIStore.
 *
 * Extracted from editorUIStore (H4). Thin layer over dialogStore,
 * providing a focused API for toolbar consumers.
 */

// Re-export dialogStore (toolbar state is a subset of dialog state)
export {
  useDialogStore as useToolbarStore,
  useDialogState,
  dialogBooleanSelector,
  dialogSetterSelector,
  DIALOG_KEYS,
} from './dialogStore';
export type { DialogKey, DialogState, EditorUIState } from './dialogStore';

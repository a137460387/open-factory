/**
 * Modal dialog state — selector hooks for editorUIStore.
 *
 * Extracted from editorUIStore (H4). Thin layer over dialogStore,
 * providing a focused API for modal consumers.
 */

// Re-export dialogStore (modal state is a subset of dialog state)
export {
  useDialogStore as useModalStore,
  useDialogState,
  dialogBooleanSelector,
  dialogSetterSelector,
  DIALOG_KEYS,
} from './dialogStore';
export type { DialogKey, DialogState, EditorUIState } from './dialogStore';

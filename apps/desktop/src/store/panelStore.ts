/**
 * Panel & layout state — selector hooks for editorUIStore.
 *
 * Extracted from editorUIStore (H4). This module does NOT create its own
 * zustand store. Instead it re-exports `useEditorUIStore` and provides
 * domain-specific selector hooks so consumers can import from `panelStore`
 * without coupling to the full EditorUIState.
 *
 * All state mutations go through the single `useEditorUIStore` store,
 * guaranteeing synchronization with dialogStore consumers.
 */

import { useEditorUIStore } from './editorUIStore';
import type { EditorLayoutSettings } from '../layout/layoutSettings';

// Re-export the combined store for consumers that need the full hook
export { useEditorUIStore as usePanelStore };

/** Selector: layout settings */
export const useLayoutSettings = () => useEditorUIStore((s) => s.layoutSettings);

/** Selector: review mode flag */
export const useReviewMode = () => useEditorUIStore((s) => s.reviewMode);

/** Selector: viewport dimensions */
export const useViewportSize = () => useEditorUIStore((s) => s.viewportSize);

/** Selector: layout settings setter */
export const useSetLayoutSettings = () => useEditorUIStore((s) => s.setLayoutSettings);

/** Selector: review mode setter */
export const useSetReviewMode = () => useEditorUIStore((s) => s.setReviewMode);

/** Selector: viewport size setter */
export const useSetViewportSize = () => useEditorUIStore((s) => s.setViewportSize);

/** Selector: persist layout patch */
export const usePersistLayoutPatch = () => useEditorUIStore((s) => s.persistLayoutPatch);

/** Selector: persist panel visibility patch */
export const usePersistPanelVisibilityPatch = () => useEditorUIStore((s) => s.persistPanelVisibilityPatch);

// Re-export types for consumers
export type { EditorLayoutSettings } from '../layout/layoutSettings';
export type { EditorUIState } from './editorUIStore';

import { create } from 'zustand';
import {
  DEFAULT_EDITOR_LAYOUT_SETTINGS,
  normalizeStoredLayoutSettings,
  type EditorLayoutSettings,
} from '../layout/layoutSettings';
import { saveLayoutSettings } from '../settings/appSettings';
import { readViewportSize } from '../lib/ui-helpers';

export interface EditorUIState {
  layoutSettings: EditorLayoutSettings;
  reviewMode: boolean;
  viewportSize: { width: number; height: number };

  setLayoutSettings: (updater: EditorLayoutSettings | ((current: EditorLayoutSettings) => EditorLayoutSettings)) => void;
  setReviewMode: (updater: boolean | ((current: boolean) => boolean)) => void;
  setViewportSize: (size: { width: number; height: number }) => void;
  persistLayoutPatch: (patch: Partial<EditorLayoutSettings>) => void;
  persistPanelVisibilityPatch: (patch: Partial<EditorLayoutSettings['panels']>) => void;
}

export const useEditorUIStore = create<EditorUIState>((set, get) => ({
  layoutSettings: DEFAULT_EDITOR_LAYOUT_SETTINGS,
  reviewMode: typeof window === 'undefined' ? false : window.location.hash === '#review',
  viewportSize: readViewportSize(),

  setLayoutSettings(updater) {
    if (typeof updater === 'function') {
      set((state) => ({ layoutSettings: updater(state.layoutSettings) }));
    } else {
      set({ layoutSettings: updater });
    }
  },

  setReviewMode(updater) {
    if (typeof updater === 'function') {
      set((state) => ({ reviewMode: updater(state.reviewMode) }));
    } else {
      set({ reviewMode: updater });
    }
  },

  setViewportSize(size) {
    set({ viewportSize: size });
  },

  persistLayoutPatch(patch) {
    const { layoutSettings } = get();
    const next = normalizeStoredLayoutSettings({ ...layoutSettings, ...patch }) ?? { ...DEFAULT_EDITOR_LAYOUT_SETTINGS };
    set({ layoutSettings: next });
    void saveLayoutSettings(next).catch((error: unknown) => {
      console.warn('Unable to save layout settings', error);
    });
  },

  persistPanelVisibilityPatch(patch) {
    const { layoutSettings, persistLayoutPatch } = get();
    persistLayoutPatch({ panels: { ...layoutSettings.panels, ...patch } });
  },
}));

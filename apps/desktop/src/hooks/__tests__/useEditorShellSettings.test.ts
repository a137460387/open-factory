// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('../../store/dialogStore', () => ({
  useDialogStore: { getState: () => ({ setViewportSize: vi.fn(), setPreviewWindowOpen: vi.fn() }) },
}));

vi.mock('../../store/editorSettingsStore', () => ({
  useEditorSettingsStore: {
    getState: () => ({
      setPreviewPerformance: vi.fn(),
      setPreviewWindowResolutionScale: vi.fn(),
      setViewSettings: vi.fn(),
      setTimelineGridSettings: vi.fn(),
      setTimelineInteractionSettings: vi.fn(),
      setLayoutSettings: vi.fn(),
      setTutorialProgress: vi.fn(),
      setShortcutBindings: vi.fn(),
      setMacros: vi.fn(),
      setBackupSettings: vi.fn(),
      setCollaborationIdentity: vi.fn(),
      setLastBackupAt: vi.fn(),
      setCustomSplitLayouts: vi.fn(),
      setLocalCoeditingSettings: vi.fn(),
    }),
  },
}));

vi.mock('../../store/timelineFeatureStore', () => ({
  useTimelineFeatureStore: {
    getState: () => ({
      setMacroHistory: vi.fn(),
      setRecoveryCandidate: vi.fn(),
    }),
  },
}));

vi.mock('../../settings/appSettings', () => ({
  readBackupSettings: vi.fn(() => Promise.resolve({})),
  readCollaborationIdentitySettings: vi.fn(() => Promise.resolve({})),
  readCustomSplitLayouts: vi.fn(() => Promise.resolve([])),
  readLayoutSettings: vi.fn(() => Promise.resolve({})),
  readLocalCoeditingSettings: vi.fn(() => Promise.resolve({})),
  readPreviewPerformanceSettings: vi.fn(() => Promise.resolve({})),
  readTutorialProgressSettings: vi.fn(() => Promise.resolve({})),
  readTimelineInteractionSettings: vi.fn(() => Promise.resolve({})),
  readTimelineGridSettings: vi.fn(() => Promise.resolve({})),
  readViewSettings: vi.fn(() => Promise.resolve({})),
}));

vi.mock('../../lib/error-handlers', () => ({ logError: vi.fn() }));
vi.mock('../../tutorial/tutorialState', () => ({ normalizeTutorialProgressSettings: vi.fn((p: any) => p) }));
vi.mock('../../shortcuts/keybindings', () => ({ readCustomKeybindings: vi.fn(() => Promise.resolve([])) }));
vi.mock('../../macros/clip-macros', () => ({ readClipMacros: vi.fn(() => Promise.resolve([])), readMacroHistory: vi.fn(() => Promise.resolve([])) }));
vi.mock('../../lib/projectFiles', () => ({ findStartupAutosaveRecovery: vi.fn(() => Promise.resolve(undefined)) }));
vi.mock('../../lib/tauri-bridge', () => ({
  getPreviewWindowState: vi.fn(() =>
    Promise.resolve({ open: false, label: 'preview', alwaysOnTop: false, fullscreen: false, resolutionScale: 1 }),
  ),
}));
vi.mock('../../collaboration/settings', () => ({ applyLocalCoeditingSettings: vi.fn() }));
vi.mock('@open-factory/editor-core/utils', () => ({ logger: { warn: vi.fn() } }));

import { useEditorShellSettings } from '../../hooks/useEditorShellSettings';

describe('useEditorShellSettings', () => {
  it('renders without throwing', () => {
    const { result } = renderHook(() => { useEditorShellSettings(); });
    expect(result.current).toBeUndefined();
  });
});

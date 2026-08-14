// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('../../store/editorStore', () => ({
  useEditorStore: { getState: () => ({ project: { media: [], timeline: { tracks: [] } } }) },
}));

vi.mock('../../store/editorUIStore', () => ({
  useEditorUIStore: {
    getState: () => ({ setViewportSize: vi.fn(), setSettingsOpen: vi.fn(), viewportSize: { width: 1920, height: 1080 } }),
  },
}));

vi.mock('../../store/editorFeatureStore', () => ({
  useEditorFeatureStore: { getState: () => ({ mediaHealthAutoShowEnabled: false }) },
}));

vi.mock('../../store/proxySettingsStore', () => ({
  useProxySettingsStore: { getState: () => ({ settings: {} }) },
}));

vi.mock('../../media/media-job-store', () => ({
  useMediaJobStore: { getState: () => ({}) },
}));

vi.mock('../../media/media-job-runner', () => ({ ensureMediaJobRunner: vi.fn() }));
vi.mock('../../media/proxy-integrity', () => ({ runScheduledProxyIntegrityCheck: vi.fn() }));
vi.mock('../../lib/mediaHealthDashboard', () => ({ scanMediaHealthDashboard: vi.fn() }));
vi.mock('../../lib/ui-helpers', () => ({ readViewportSize: vi.fn(() => ({ width: 1920, height: 1080 })), isEditableKeyboardEventTarget: vi.fn(() => false), getWorkspaceLayoutDisplayName: vi.fn(() => '') }));
vi.mock('../../lib/toast', () => ({ showToast: vi.fn() }));
vi.mock('../../settings/appSettings', () => ({ saveLayoutSettings: vi.fn() }));
vi.mock('../../layout/layoutSettings', () => ({ applyWorkspaceLayout: vi.fn(), getWorkspaceLayoutById: vi.fn(), resolveWorkspaceLayoutShortcut: vi.fn(() => null) }));
vi.mock('../../accessibility/keyboard-navigation', () => ({ isEditableKeyboardTarget: vi.fn(() => false), isShortcutCheatsheetKey: vi.fn(() => false) }));
vi.mock('@open-factory/editor-core/utils', () => ({ logger: { warn: vi.fn() } }));

import { useEditorShellInteractions } from '../../hooks/useEditorShellInteractions';

describe('useEditorShellInteractions', () => {
  it('returns expected interaction functions', () => {
    const { result } = renderHook(() => useEditorShellInteractions());
    expect(typeof result.current.applyWorkspaceLayoutById).toBe('function');
    expect(typeof result.current.toggleProjectDocumentation).toBe('function');
  });
});

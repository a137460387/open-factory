// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('../../store/editorStore', () => ({
  useEditorStore: { getState: () => ({ project: { media: [], timeline: { tracks: [] } } }) },
}));
vi.mock('../../store/timelineFeatureStore', () => ({ useTimelineFeatureStore: { getState: () => ({}) } }));
vi.mock('../../store/editorSettingsStore', () => ({ useEditorSettingsStore: { getState: () => ({}) } }));
vi.mock('../../store/commandManager', () => ({
  commandManager: { execute: vi.fn() },
  projectAccessor: {},
  timelineAccessor: { getTimeline: () => ({ tracks: [] }) },
  addOnExecuteListener: vi.fn(() => vi.fn()),
}));
vi.mock('../../lib/tauri-bridge', () => ({
  saveFileDialog: vi.fn(),
  writeFile: vi.fn(),
  readFile: vi.fn(),
  openFileDialog: vi.fn(),
}));
vi.mock('../../lib/toast', () => ({ showToast: vi.fn() }));
vi.mock('../../macros/clip-macros', () => ({
  appendMacroHistoryEntry: vi.fn(),
  buildMacroCommands: vi.fn(() => []),
  findMacroTargetClip: vi.fn(),
  writeClipMacros: vi.fn(),
}));
vi.mock('@open-factory/editor-core/utils', () => ({ logger: { warn: vi.fn() } }));
vi.mock('@open-factory/editor-core', () => ({
  createOperationRecording: vi.fn(() => ({})),
  serializeOperationRecording: vi.fn(() => ''),
  parseOperationRecording: vi.fn(() => ({})),
  buildOperationReplaySchedule: vi.fn(() => []),
  getOperationProjectAtStep: vi.fn(),
  generateOperationRecordingSlidesHtml: vi.fn(() => ''),
  recordOperationCommand: vi.fn(),
  createId: vi.fn(() => 'id'),
  LoadProjectCommand: vi.fn(),
}));

import { useEditorShellOperationRecording } from '../../hooks/useEditorShellOperationRecording';

describe('useEditorShellOperationRecording', () => {
  it('returns expected recording functions', () => {
    const { result } = renderHook(() => useEditorShellOperationRecording());
    expect(typeof result.current.recordMacroHistory).toBe('function');
    expect(typeof result.current.startMacroRecording).toBe('function');
    expect(typeof result.current.stopMacroRecording).toBe('function');
    expect(typeof result.current.executeMacro).toBe('function');
    expect(typeof result.current.startOperationRecording).toBe('function');
    expect(typeof result.current.stopOperationRecording).toBe('function');
  });
});

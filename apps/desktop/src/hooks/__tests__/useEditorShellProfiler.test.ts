// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('../../store/editorFeatureStore', () => ({ useEditorFeatureStore: (selector: any) => selector({}) }));
vi.mock('@open-factory/editor-core/utils', () => ({ logger: { warn: vi.fn() } }));

import { useEditorShellProfiler } from '../../hooks/useEditorShellProfiler';

describe('useEditorShellProfiler', () => {
  it('returns expected profiler functions', () => {
    const { result } = renderHook(() => useEditorShellProfiler());
    expect(typeof result.current.handleProfilerFrame).toBe('function');
    expect(typeof result.current.startProfilerRecording).toBe('function');
    expect(typeof result.current.stopProfilerRecording).toBe('function');
    expect(typeof result.current.exportProfilerReportJson).toBe('function');
  });
});

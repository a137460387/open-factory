// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// Mock dependencies
vi.mock('../store/editorStore', () => ({
  useEditorStore: (selector: (s: Record<string, unknown>) => unknown) => {
    const state = {
      project: { name: 'test', timelines: [] },
      dirty: true,
      projectPath: '/test/project.ofp',
    };
    return selector(state);
  },
}));

vi.mock('../lib/projectFiles', () => ({
  DEFAULT_AUTOSAVE_INTERVAL_SECONDS: 30,
  writeAutosaveProjectSafely: vi.fn().mockResolvedValue('/autosave/path'),
}));

import { useAutosave, runAutosaveTick } from './useAutosave';
import { writeAutosaveProjectSafely } from '../lib/projectFiles';
import type { Project } from '@open-factory/editor-core';

const mockProject = { name: 'test', timelines: [] } as unknown as Project;

describe('runAutosaveTick', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dirty=true 时执行自动保存', async () => {
    const result = await runAutosaveTick({ project: mockProject, projectPath: '/test.ofp', dirty: true });
    expect(writeAutosaveProjectSafely).toHaveBeenCalledWith(mockProject, '/test.ofp');
    expect(result).toBe('/autosave/path');
  });

  it('dirty=false 时跳过保存', async () => {
    const result = await runAutosaveTick({ project: mockProject, projectPath: '/test.ofp', dirty: false });
    expect(writeAutosaveProjectSafely).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it('无 projectPath 时仍然保存', async () => {
    await runAutosaveTick({ project: mockProject, dirty: true });
    expect(writeAutosaveProjectSafely).toHaveBeenCalledWith(mockProject, undefined);
  });
});

describe('useAutosave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('设置定时器', () => {
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    renderHook(() => useAutosave(10));
    expect(setIntervalSpy).toHaveBeenCalled();
    setIntervalSpy.mockRestore();
  });

  it('使用自定义间隔', () => {
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    renderHook(() => useAutosave(60));
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 60_000);
    setIntervalSpy.mockRestore();
  });

  it('间隔至少 1 秒', () => {
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    renderHook(() => useAutosave(0));
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 1_000);
    setIntervalSpy.mockRestore();
  });
});

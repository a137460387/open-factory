// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// ── Mock 外部依赖 ────────────────────────────────────────────

const mockCommandExecute = vi.fn();

let mockEditorState: Record<string, any>;
let mockProjectState: Record<string, any>;

vi.mock('../../store/editorStore', () => ({
  useEditorStore: {
    getState: () => mockEditorState,
  },
}));

vi.mock('../../store/commandManager', () => ({
  commandManager: {
    execute: (...args: any[]) => mockCommandExecute(...args),
  },
  timelineAccessor: {
    getTimeline: () => mockProjectState?.timeline,
    setTimeline: vi.fn(),
  },
}));

vi.mock('../../lib/toast', () => ({
  showToast: vi.fn(),
}));

vi.mock('../../media/contentAnalysis', () => ({
  analyzeClipContentLocally: vi.fn(),
  exportClipContentAnalysisJson: vi.fn(),
}));

vi.mock('../../lib/content-analysis-helpers', () => ({
  collectContentAnalysisTargets: vi.fn(() => []),
  findContentAnalysisTarget: vi.fn(),
}));

vi.mock('@open-factory/editor-core', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    UpdateClipCommand: vi.fn(),
  };
});

// ── 导入被测 Hook 和辅助 ─────────────────────────────────────

import { useContentAnalysisCallbacks } from '../useEditorShellContentAnalysisCallbacks';
import { analyzeClipContentLocally, exportClipContentAnalysisJson } from '../../media/contentAnalysis';
import { collectContentAnalysisTargets, findContentAnalysisTarget } from '../../lib/content-analysis-helpers';
import { showToast } from '../../lib/toast';

// ── 测试 ─────────────────────────────────────────────────────

describe('useContentAnalysisCallbacks', () => {
  let mockSetContentAnalysisRunningClipId: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSetContentAnalysisRunningClipId = vi.fn();

    mockProjectState = {
      timeline: { tracks: [{ id: 'track-1', clips: [] }] },
      media: [{ id: 'media-1', name: 'video.mp4', type: 'video' }],
    };

    mockEditorState = {
      project: mockProjectState,
      selectedClipIds: [],
    };
  });

  it('导出所有预期的函数', () => {
    const { result } = renderHook(() =>
      useContentAnalysisCallbacks({ setContentAnalysisRunningClipId: mockSetContentAnalysisRunningClipId }),
    );

    expect(result.current.runSingleContentAnalysis).toBeDefined();
    expect(result.current.analyzeContentClip).toBeDefined();
    expect(result.current.analyzePreferredContentTargets).toBeDefined();
    expect(result.current.exportContentAnalysis).toBeDefined();
  });

  // --- runSingleContentAnalysis ---
  it('runSingleContentAnalysis 成功时返回 true 并执行 UpdateClipCommand', async () => {
    const mockAnalysis = { scenes: [], labels: [] } as any;
    vi.mocked(analyzeClipContentLocally).mockResolvedValue(mockAnalysis);

    const { result } = renderHook(() =>
      useContentAnalysisCallbacks({ setContentAnalysisRunningClipId: mockSetContentAnalysisRunningClipId }),
    );

    const target = {
      clip: { id: 'clip-1', start: 0, duration: 5 },
      asset: { id: 'media-1', name: 'video.mp4' },
    };

    const success = await result.current.runSingleContentAnalysis(target as any);

    expect(success).toBe(true);
    expect(mockSetContentAnalysisRunningClipId).toHaveBeenCalledWith('clip-1');
    expect(mockCommandExecute).toHaveBeenCalledTimes(1);
    // finally 块应清除 running clip id
    expect(mockSetContentAnalysisRunningClipId).toHaveBeenCalledWith(undefined);
  });

  it('runSingleContentAnalysis 失败时返回 false 并显示错误提示', async () => {
    const error = new Error('分析失败');
    vi.mocked(analyzeClipContentLocally).mockRejectedValue(error);

    const { result } = renderHook(() =>
      useContentAnalysisCallbacks({ setContentAnalysisRunningClipId: mockSetContentAnalysisRunningClipId }),
    );

    const target = {
      clip: { id: 'clip-1', start: 0, duration: 5 },
      asset: { id: 'media-1', name: 'video.mp4' },
    };

    const success = await result.current.runSingleContentAnalysis(target as any);

    expect(success).toBe(false);
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ kind: 'error' }));
    // finally 块应清除 running clip id
    expect(mockSetContentAnalysisRunningClipId).toHaveBeenCalledWith(undefined);
  });

  it('runSingleContentAnalysis 始终在 finally 中清除 runningClipId', async () => {
    vi.mocked(analyzeClipContentLocally).mockResolvedValue({} as any);

    const { result } = renderHook(() =>
      useContentAnalysisCallbacks({ setContentAnalysisRunningClipId: mockSetContentAnalysisRunningClipId }),
    );

    const target = {
      clip: { id: 'clip-1', start: 0, duration: 5 },
      asset: { id: 'media-1' },
    };

    await result.current.runSingleContentAnalysis(target as any);

    // 最后一次调用应该是清除
    const lastCall =
      mockSetContentAnalysisRunningClipId.mock.calls[mockSetContentAnalysisRunningClipId.mock.calls.length - 1];
    expect(lastCall).toEqual([undefined]);
  });

  // --- analyzeContentClip ---
  it('analyzeContentClip 找不到目标时显示警告', async () => {
    vi.mocked(findContentAnalysisTarget).mockReturnValue(undefined);

    const { result } = renderHook(() =>
      useContentAnalysisCallbacks({ setContentAnalysisRunningClipId: mockSetContentAnalysisRunningClipId }),
    );

    await result.current.analyzeContentClip('nonexistent-clip');

    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ kind: 'warning' }));
    expect(analyzeClipContentLocally).not.toHaveBeenCalled();
  });

  it('analyzeContentClip 找到目标时调用 runSingleContentAnalysis', async () => {
    const target = {
      clip: { id: 'clip-1', start: 0, duration: 5 },
      asset: { id: 'media-1' },
    };
    vi.mocked(findContentAnalysisTarget).mockReturnValue(target as any);
    vi.mocked(analyzeClipContentLocally).mockResolvedValue({} as any);

    const { result } = renderHook(() =>
      useContentAnalysisCallbacks({ setContentAnalysisRunningClipId: mockSetContentAnalysisRunningClipId }),
    );

    await result.current.analyzeContentClip('clip-1');

    expect(analyzeClipContentLocally).toHaveBeenCalled();
    // 成功后应显示成功提示
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }));
  });

  // --- analyzePreferredContentTargets ---
  it('analyzePreferredContentTargets 无可用目标时显示警告', async () => {
    vi.mocked(collectContentAnalysisTargets).mockReturnValue([]);

    const { result } = renderHook(() =>
      useContentAnalysisCallbacks({ setContentAnalysisRunningClipId: mockSetContentAnalysisRunningClipId }),
    );

    await result.current.analyzePreferredContentTargets();

    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ kind: 'warning' }));
  });

  it('analyzePreferredContentTargets 优先分析选中的 clip', async () => {
    const target1 = { clip: { id: 'clip-1' }, asset: { id: 'media-1' } };
    const target2 = { clip: { id: 'clip-2' }, asset: { id: 'media-2' } };
    vi.mocked(collectContentAnalysisTargets).mockReturnValue([target1, target2] as any);
    mockEditorState.selectedClipIds = ['clip-2'];
    vi.mocked(analyzeClipContentLocally).mockResolvedValue({} as any);

    const { result } = renderHook(() =>
      useContentAnalysisCallbacks({ setContentAnalysisRunningClipId: mockSetContentAnalysisRunningClipId }),
    );

    await result.current.analyzePreferredContentTargets();

    // 应该只分析选中的 clip-2
    expect(analyzeClipContentLocally).toHaveBeenCalledTimes(1);
    expect(analyzeClipContentLocally).toHaveBeenCalledWith(target2.clip, target2.asset);
  });

  it('analyzePreferredContentTargets 未选中任何 clip 时分析全部目标', async () => {
    const target1 = { clip: { id: 'clip-1' }, asset: { id: 'media-1' } };
    const target2 = { clip: { id: 'clip-2' }, asset: { id: 'media-2' } };
    vi.mocked(collectContentAnalysisTargets).mockReturnValue([target1, target2] as any);
    mockEditorState.selectedClipIds = [];
    vi.mocked(analyzeClipContentLocally).mockResolvedValue({} as any);

    const { result } = renderHook(() =>
      useContentAnalysisCallbacks({ setContentAnalysisRunningClipId: mockSetContentAnalysisRunningClipId }),
    );

    await result.current.analyzePreferredContentTargets();

    // 应该分析全部2 个目标
    expect(analyzeClipContentLocally).toHaveBeenCalledTimes(2);
  });

  // --- exportContentAnalysis ---
  it('exportContentAnalysis 导出未分析的 clip 时显示警告', async () => {
    vi.mocked(findContentAnalysisTarget).mockReturnValue({
      clip: { id: 'clip-1', contentAnalysis: undefined },
      asset: { id: 'media-1' },
    } as any);

    const { result } = renderHook(() =>
      useContentAnalysisCallbacks({ setContentAnalysisRunningClipId: mockSetContentAnalysisRunningClipId }),
    );

    await result.current.exportContentAnalysis('clip-1');

    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ kind: 'warning' }));
    expect(exportClipContentAnalysisJson).not.toHaveBeenCalled();
  });

  it('exportContentAnalysis 导出已分析的 clip 时调用 exportClipContentAnalysisJson', async () => {
    const mockTarget = {
      clip: { id: 'clip-1', contentAnalysis: { scenes: [] } },
      asset: { id: 'media-1' },
    };
    vi.mocked(findContentAnalysisTarget).mockReturnValue(mockTarget as any);
    vi.mocked(exportClipContentAnalysisJson).mockResolvedValue('/output/analysis.json');

    const { result } = renderHook(() =>
      useContentAnalysisCallbacks({ setContentAnalysisRunningClipId: mockSetContentAnalysisRunningClipId }),
    );

    await result.current.exportContentAnalysis('clip-1');

    expect(exportClipContentAnalysisJson).toHaveBeenCalledWith(mockTarget.clip);
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }));
  });

  it('exportContentAnalysis 找不到目标时显示警告', async () => {
    vi.mocked(findContentAnalysisTarget).mockReturnValue(undefined);

    const { result } = renderHook(() =>
      useContentAnalysisCallbacks({ setContentAnalysisRunningClipId: mockSetContentAnalysisRunningClipId }),
    );

    await result.current.exportContentAnalysis('nonexistent');

    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ kind: 'warning' }));
  });

  it('exportContentAnalysis 导出失败时显示错误', async () => {
    vi.mocked(findContentAnalysisTarget).mockReturnValue({
      clip: { id: 'clip-1', contentAnalysis: { scenes: [] } },
      asset: { id: 'media-1' },
    } as any);
    vi.mocked(exportClipContentAnalysisJson).mockRejectedValue(new Error('导出失败'));

    const { result } = renderHook(() =>
      useContentAnalysisCallbacks({ setContentAnalysisRunningClipId: mockSetContentAnalysisRunningClipId }),
    );

    await result.current.exportContentAnalysis('clip-1');

    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ kind: 'error' }));
  });
});

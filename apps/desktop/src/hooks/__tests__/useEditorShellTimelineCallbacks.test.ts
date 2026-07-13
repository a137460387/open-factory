// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// ── Mock 外部依赖（在 import 之前声明） ──────────────────────

const mockSetSelectedClipId = vi.fn();
const mockSetSelectedClipIds = vi.fn();
const mockSetSelectedKeyframes = vi.fn();
const mockSetPlayheadTime = vi.fn();
const mockSetInPoint = vi.fn();
const mockSetOutPoint = vi.fn();
const mockClearSelectedClipIds = vi.fn();

const mockSetColorAnalysisBusy = vi.fn();
const mockSetColorAnalysisResults = vi.fn();
const mockSetColorAnalysisJumps = vi.fn();
const mockSetColorAnalysisSamples = vi.fn();
const mockSetColorHeatmapPoints = vi.fn();
const mockSetColorAnalysisOpen = vi.fn();
const mockSetColorNodeEditorOpen = vi.fn();

let mockEditorState: Record<string, any>;

vi.mock('../../store/editorStore', () => ({
  useEditorStore: Object.assign(
    (selector: any) => {
      if (typeof selector === 'function') {
        return selector({
          setSelectedClipId: mockSetSelectedClipId,
          setSelectedClipIds: mockSetSelectedClipIds,
          setSelectedKeyframes: mockSetSelectedKeyframes,
        });
      }
      return undefined;
    },
    {
      getState: () => mockEditorState,
    },
  ),
  selectClipById: vi.fn((_project: any, clipId: string | null) => {
    if (!clipId) return undefined;
    const allClips = mockEditorState?.project?.timeline?.tracks?.flatMap((t: any) => t.clips) ?? [];
    return allClips.find((c: any) => c.id === clipId);
  }),
}));

vi.mock('../../store/editorFeatureStore', () => ({
  useEditorFeatureStore: Object.assign(
    (selector: any) => {
      if (typeof selector === 'function') {
        return selector({
          setColorAnalysisBusy: mockSetColorAnalysisBusy,
          setColorAnalysisResults: mockSetColorAnalysisResults,
          setColorAnalysisJumps: mockSetColorAnalysisJumps,
          setColorAnalysisSamples: mockSetColorAnalysisSamples,
          setColorHeatmapPoints: mockSetColorHeatmapPoints,
        });
      }
      return undefined;
    },
    {
      getState: () => ({}),
    },
  ),
}));

vi.mock('../../store/editorUIStore', () => ({
  useEditorUIStore: Object.assign(
    (selector: any) => {
      if (typeof selector === 'function') {
        return selector({
          setColorAnalysisOpen: mockSetColorAnalysisOpen,
          setColorNodeEditorOpen: mockSetColorNodeEditorOpen,
        });
      }
      return undefined;
    },
    {
      getState: () => ({}),
    },
  ),
}));

vi.mock('../../store/proxySettingsStore', () => ({
  useProxySettingsStore: {
    getState: () => ({ settings: {} }),
  },
}));

vi.mock('../../media/media-job-store', () => ({
  useMediaJobStore: {
    getState: () => ({
      enqueueProxyJobsForMedia: vi.fn(),
    }),
  },
}));

vi.mock('../../media/media-job-runner', () => ({
  ensureMediaJobRunner: vi.fn(),
}));

const mockCommandExecute = vi.fn();

vi.mock('../../store/commandManager', () => ({
  commandManager: {
    execute: (...args: any[]) => mockCommandExecute(...args),
    undo: vi.fn(),
  },
  projectAccessor: 'mock-project-accessor',
  timelineAccessor: 'mock-timeline-accessor',
}));

vi.mock('../../lib/tauri-bridge', () => ({
  readColorMatchFrameSample: vi.fn(),
  renderPreviewCache: vi.fn(() => Promise.resolve({ success: true })),
}));

vi.mock('../../lib/toast', () => ({
  showToast: vi.fn(),
}));

vi.mock('../../lib/clipFactory', () => ({
  createAdjustmentLayerClip: vi.fn((_track: any, _timeline: any) => ({
    id: 'adjustment-clip-mock',
    type: 'adjustment',
    name: 'Adjustment Layer',
    start: 0,
    duration: 5,
    trimStart: 0,
    trimEnd: 0,
  })),
  createClipFromAsset: vi.fn((_asset: any, _track: any, _timeline: any, _opts?: any) => ({
    id: 'clip-mock-id',
    type: 'video',
    name: 'Test Clip',
    start: 0,
    duration: 10,
    trimStart: 0,
    trimEnd: 0,
    mediaId: _asset.id,
  })),
  createMotionGraphicClip: vi.fn(() => ({
    id: 'motion-clip-mock',
    type: 'video',
    name: 'Motion Graphic',
    start: 0,
    duration: 5,
  })),
  findPreferredTrack: vi.fn((_timeline: any, _asset: any) => ({
    id: 'track-1',
    type: 'video',
    name: 'V1',
    clips: [],
  })),
}));

vi.mock('../../lib/timeline-clip-helpers', () => ({
  collectClipKeyframeRefs: vi.fn(() => []),
  findTimelineClipForMediaSourceTime: vi.fn(),
  getClipSourceDimensions: vi.fn(() => ({ width: 1920, height: 1080 })),
}));

vi.mock('../../settings/appSettings', () => ({
  saveCustomSplitLayouts: vi.fn((layouts: any[]) => Promise.resolve(layouts)),
}));

vi.mock('@open-factory/editor-core', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    AddClipCommand: vi.fn(),
    AddAdjustmentLayerCommand: vi.fn(),
    AddMotionGraphicCommand: vi.fn(),
    ApplyEffectPresetCommand: vi.fn(),
    ApplySplitLayoutCommand: vi.fn(),
    BatchUpdateClipCommand: vi.fn(),
    CreateMulticamSequenceCommand: vi.fn(),
    DeleteClipsCommand: vi.fn(),
    DeleteGroupCommand: vi.fn(),
    ImportEDLCommand: vi.fn(),
    ImportFCPXMLCommand: vi.fn(),
    PiPLayoutCommand: vi.fn(),
    RippleDeleteCommand: vi.fn(),
    SplitClipCommand: vi.fn(),
    analyzeColorFrameSample: vi.fn(() => ({})),
    buildColorAlignmentUpdates: vi.fn(() => []),
    buildTimelineColorHeatmapData: vi.fn(() => []),
    createId: vi.fn((prefix: string) => `${prefix}-mock-id`),
    createMainSideSplitLayout: vi.fn((_id: any, name: string, ratio: number) => ({
      id: 'split-layout-mock',
      name,
      ratio,
    })),
    createTrack: vi.fn((opts: any) => ({ clips: [], ...opts })),
    detectSceneColorJumps: vi.fn(() => []),
    findCompleteClipGroup: vi.fn(() => null),
    getClipSourceVisibleDuration: vi.fn(() => 10),
    getSplitLayoutDefinition: vi.fn(() => null),
    getTimelineDuration: vi.fn(() => 30),
    instantiateTitleTemplate: vi.fn((_id: any, track: any, _tl: any) => ({
      id: 'title-clip-mock',
      type: 'text',
      name: 'Title',
      start: 0,
      duration: 3,
    })),
    matchFrameFromClip: vi.fn(),
    normalizeClipGroups: vi.fn((_groups: any, _ids: any) => []),
    computeTimelineGaps: vi.fn(() => []),
    navigateGap: vi.fn(() => null),
    getMediaInstanceNavigation: vi.fn(() => ({ currentIndex: 0, total: 1 })),
    navigateToNextInstance: vi.fn(),
    revealInTimeline: vi.fn(() => ({ instances: [] })),
  };
});

// ── 导入被测 Hook ────────────────────────────────────────────

import { useEditorShellTimelineCallbacks } from '../useEditorShellTimelineCallbacks';
import { showToast } from '../../lib/toast';
import { findPreferredTrack } from '../../lib/clipFactory';
import {
  AddClipCommand,
  AddAdjustmentLayerCommand,
  AddMotionGraphicCommand,
  ApplyEffectPresetCommand,
  SplitClipCommand,
  DeleteClipsCommand,
  DeleteGroupCommand,
  RippleDeleteCommand,
} from '@open-factory/editor-core';

// ── 辅助工具 ─────────────────────────────────────────────────

const createMockClip = (overrides: Partial<any> = {}): any => ({
  id: 'clip-1',
  type: 'video',
  name: 'Test Clip',
  start: 0,
  duration: 10,
  trimStart: 0,
  trimEnd: 0,
  mediaId: 'asset-1',
  ...overrides,
});

const createMockTrack = (overrides: Partial<any> = {}): any => ({
  id: 'track-1',
  type: 'video',
  name: 'V1',
  clips: [createMockClip()],
  ...overrides,
});

const createMockMediaAsset = (overrides: Partial<any> = {}): any => ({
  id: 'asset-1',
  name: 'test-video.mp4',
  path: '/mock/media/test-video.mp4',
  type: 'video',
  duration: 10,
  ...overrides,
});

const defaultDeps = {
  colorAnalysisBusy: false,
  colorAnalysisResults: [],
  colorAnalysisSamples: [],
  pipLayoutPosition: 'bottom-right' as const,
  customSplitLayouts: [],
  canApplySplitLayout: false,
  selectedPiPClips: [],
  selectedSplitLayoutClips: [],
  visualTimelineClipRefs: [],
  projectPath: '/mock/path/test.cutproj.json',
  setCustomSplitLayouts: vi.fn(),
};

// ── 测试 ─────────────────────────────────────────────────────

describe('useEditorShellTimelineCallbacks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCommandExecute.mockReset();
    mockEditorState = {
      project: {
        name: 'Test Project',
        media: [createMockMediaAsset()],
        mediaMetadata: {},
        settings: { fps: 30, width: 1920, height: 1080 },
        timeline: {
          tracks: [createMockTrack()],
        },
        sequences: [],
        clipGroups: [],
        protectedRanges: [],
      },
      selectedClipId: 'clip-1',
      selectedClipIds: ['clip-1'],
      playheadTime: 5,
      inPoint: null,
      outPoint: null,
      setPlayheadTime: mockSetPlayheadTime,
      setInPoint: mockSetInPoint,
      setOutPoint: mockSetOutPoint,
      clearSelectedClipIds: mockClearSelectedClipIds,
      setSelectedClipIds: mockSetSelectedClipIds,
      setSelectedKeyframes: mockSetSelectedKeyframes,
    };
  });

  // ── addAssetToTimeline ───────────────────────────────────────

  describe('addAssetToTimeline', () => {
    it('将媒体资产添加到时间线并执行 AddClipCommand', () => {
      const { result } = renderHook(() => useEditorShellTimelineCallbacks(defaultDeps));
      result.current.addAssetToTimeline('asset-1');

      expect(AddClipCommand).toHaveBeenCalled();
      expect(mockCommandExecute).toHaveBeenCalledTimes(1);
      expect(mockSetSelectedClipId).toHaveBeenCalledWith('clip-mock-id');
    });

    it('资产不存在时显示错误 toast', () => {
      const { result } = renderHook(() => useEditorShellTimelineCallbacks(defaultDeps));
      result.current.addAssetToTimeline('nonexistent-asset');

      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'error' }),
      );
      expect(mockCommandExecute).not.toHaveBeenCalled();
    });

    it('无兼容轨道时显示错误 toast', () => {
      vi.mocked(findPreferredTrack).mockReturnValueOnce(undefined);

      const { result } = renderHook(() => useEditorShellTimelineCallbacks(defaultDeps));
      result.current.addAssetToTimeline('asset-1');

      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'error' }),
      );
      expect(mockCommandExecute).not.toHaveBeenCalled();
    });

    it('命令执行失败时显示错误 toast', () => {
      mockCommandExecute.mockImplementation(() => {
        throw new Error('时间线已满');
      });

      const { result } = renderHook(() => useEditorShellTimelineCallbacks(defaultDeps));
      result.current.addAssetToTimeline('asset-1');

      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'error' }),
      );
    });
  });

  // ── splitSelected ────────────────────────────────────────────

  describe('splitSelected', () => {
    it('在 playhead 位置分割选中片段', () => {
      const { result } = renderHook(() => useEditorShellTimelineCallbacks(defaultDeps));
      result.current.splitSelected();

      expect(SplitClipCommand).toHaveBeenCalledWith(
        'mock-timeline-accessor',
        'clip-1',
        5, // playheadTime
      );
      expect(mockCommandExecute).toHaveBeenCalledTimes(1);
    });

    it('无选中片段时不执行分割', () => {
      mockEditorState.selectedClipId = null;

      const { result } = renderHook(() => useEditorShellTimelineCallbacks(defaultDeps));
      result.current.splitSelected();

      expect(mockCommandExecute).not.toHaveBeenCalled();
    });

    it('分割失败时显示警告 toast', () => {
      mockCommandExecute.mockImplementation(() => {
        throw new Error('无法在当前位置分割');
      });

      const { result } = renderHook(() => useEditorShellTimelineCallbacks(defaultDeps));
      result.current.splitSelected();

      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'warning' }),
      );
    });
  });

  // ── deleteSelected ───────────────────────────────────────────

  describe('deleteSelected', () => {
    it('删除选中的片段并清除选择', () => {
      const { result } = renderHook(() => useEditorShellTimelineCallbacks(defaultDeps));
      result.current.deleteSelected();

      expect(DeleteClipsCommand).toHaveBeenCalledWith(
        'mock-timeline-accessor',
        ['clip-1'],
      );
      expect(mockClearSelectedClipIds).toHaveBeenCalled();
    });

    it('无选中片段时不执行删除', () => {
      mockEditorState.selectedClipIds = [];

      const { result } = renderHook(() => useEditorShellTimelineCallbacks(defaultDeps));
      result.current.deleteSelected();

      expect(mockCommandExecute).not.toHaveBeenCalled();
    });
  });

  // ── rippleDeleteSelected ─────────────────────────────────────

  describe('rippleDeleteSelected', () => {
    it('执行 RippleDeleteCommand 并清除选择', () => {
      const { result } = renderHook(() => useEditorShellTimelineCallbacks(defaultDeps));
      result.current.rippleDeleteSelected();

      expect(RippleDeleteCommand).toHaveBeenCalledWith(
        'mock-timeline-accessor',
        ['clip-1'],
        expect.any(Array), // protectedRanges
      );
      expect(mockClearSelectedClipIds).toHaveBeenCalled();
    });

    it('无选中片段时不执行波纹删除', () => {
      mockEditorState.selectedClipIds = [];

      const { result } = renderHook(() => useEditorShellTimelineCallbacks(defaultDeps));
      result.current.rippleDeleteSelected();

      expect(mockCommandExecute).not.toHaveBeenCalled();
    });
  });

  // ── addAdjustmentLayer ───────────────────────────────────────

  describe('addAdjustmentLayer', () => {
    it('创建调整图层轨道和片段并执行 AddAdjustmentLayerCommand', () => {
      const { result } = renderHook(() => useEditorShellTimelineCallbacks(defaultDeps));
      result.current.addAdjustmentLayer();

      expect(AddAdjustmentLayerCommand).toHaveBeenCalled();
      expect(mockCommandExecute).toHaveBeenCalledTimes(1);
      expect(mockSetSelectedClipId).toHaveBeenCalledWith('adjustment-clip-mock');
    });

    it('命令执行失败时显示错误 toast', () => {
      mockCommandExecute.mockImplementation(() => {
        throw new Error('无法创建调整图层');
      });

      const { result } = renderHook(() => useEditorShellTimelineCallbacks(defaultDeps));
      result.current.addAdjustmentLayer();

      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'error' }),
      );
    });
  });

  // ── handleAddSubclipToTimeline ───────────────────────────────

  describe('handleAddSubclipToTimeline', () => {
    it('将子剪辑添加到时间线', () => {
      const subclip = { id: 'sub-1', name: '精彩片段', inPoint: 2, outPoint: 8 };

      const { result } = renderHook(() => useEditorShellTimelineCallbacks(defaultDeps));
      result.current.handleAddSubclipToTimeline('asset-1', subclip as any);

      expect(AddClipCommand).toHaveBeenCalled();
      expect(mockSetSelectedClipId).toHaveBeenCalled();
    });

    it('资产不存在时显示错误 toast', () => {
      const subclip = { id: 'sub-1', name: '精彩片段', inPoint: 2, outPoint: 8 };

      const { result } = renderHook(() => useEditorShellTimelineCallbacks(defaultDeps));
      result.current.handleAddSubclipToTimeline('nonexistent', subclip as any);

      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'error' }),
      );
    });
  });

  // ── importEdlTimeline ────────────────────────────────────────

  describe('importEdlTimeline', () => {
    it('导入 EDL 内容并返回结果', async () => {
      const { ImportEDLCommand } = await import('@open-factory/editor-core');
      vi.mocked(ImportEDLCommand).mockImplementation(function (this: any) {
        this.result = { title: 'Test EDL', matchedCount: 3, missingCount: 1 };
      } as any);

      const { result } = renderHook(() => useEditorShellTimelineCallbacks(defaultDeps));
      const edlResult = result.current.importEdlTimeline('EDL CONTENT', '/mock/test.edl');

      expect(edlResult.title).toBe('Test EDL');
      expect(edlResult.matchedCount).toBe(3);
      expect(edlResult.missingCount).toBe(1);
      expect(mockClearSelectedClipIds).toHaveBeenCalled();
      expect(mockSetPlayheadTime).toHaveBeenCalledWith(0);
    });
  });

  // ── importFcpXmlTimeline ─────────────────────────────────────

  describe('importFcpXmlTimeline', () => {
    it('导入 FCPXML 内容并返回结果', async () => {
      const { ImportFCPXMLCommand } = await import('@open-factory/editor-core');
      vi.mocked(ImportFCPXMLCommand).mockImplementation(function (this: any) {
        this.result = { title: 'Test FCPXML', matchedCount: 5, missingCount: 2 };
      } as any);

      const { result } = renderHook(() => useEditorShellTimelineCallbacks(defaultDeps));
      const fcpxmlResult = result.current.importFcpXmlTimeline('<xmeml>...</xmeml>', '/mock/test.xml');

      expect(fcpxmlResult.title).toBe('Test FCPXML');
      expect(fcpxmlResult.matchedCount).toBe(5);
      expect(fcpxmlResult.missingCount).toBe(2);
      expect(mockClearSelectedClipIds).toHaveBeenCalled();
      expect(mockSetPlayheadTime).toHaveBeenCalledWith(0);
    });
  });

  // ── selectAllTimelineItems ───────────────────────────────────

  describe('selectAllTimelineItems', () => {
    it('选中时间线上的所有片段', () => {
      const { result } = renderHook(() => useEditorShellTimelineCallbacks(defaultDeps));
      result.current.selectAllTimelineItems();

      expect(mockSetSelectedClipIds).toHaveBeenCalledWith(
        expect.arrayContaining(['clip-1']),
      );
    });
  });

  // ── addMotionGraphic ─────────────────────────────────────────

  describe('addMotionGraphic', () => {
    it('创建动态图形轨道和片段并执行 AddMotionGraphicCommand', () => {
      const { result } = renderHook(() => useEditorShellTimelineCallbacks(defaultDeps));
      result.current.addMotionGraphic();

      expect(AddMotionGraphicCommand).toHaveBeenCalled();
      expect(mockCommandExecute).toHaveBeenCalledTimes(1);
      expect(mockSetSelectedClipId).toHaveBeenCalledWith('motion-clip-mock');
    });

    it('命令执行失败时显示错误 toast', () => {
      mockCommandExecute.mockImplementation(() => {
        throw new Error('无法创建动态图形');
      });

      const { result } = renderHook(() => useEditorShellTimelineCallbacks(defaultDeps));
      result.current.addMotionGraphic();

      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'error' }),
      );
    });
  });

  // ── addTitleTemplate ─────────────────────────────────────────

  describe('addTitleTemplate', () => {
    it('在文本轨道上创建标题模板片段', () => {
      mockEditorState.project.timeline.tracks.push({
        id: 'text-track-1',
        type: 'text',
        name: 'T1',
        clips: [],
      });

      const { result } = renderHook(() => useEditorShellTimelineCallbacks(defaultDeps));
      result.current.addTitleTemplate('lower-third' as any);

      expect(AddClipCommand).toHaveBeenCalled();
      expect(mockSetSelectedClipId).toHaveBeenCalledWith('title-clip-mock');
    });

    it('无文本轨道时显示警告 toast', () => {
      // 默认 mock 中没有 text 轨道
      const { result } = renderHook(() => useEditorShellTimelineCallbacks(defaultDeps));
      result.current.addTitleTemplate('lower-third' as any);

      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'warning' }),
      );
      expect(mockCommandExecute).not.toHaveBeenCalled();
    });
  });

  // ── applyEffectPresetToSelectedClip ──────────────────────────

  describe('applyEffectPresetToSelectedClip', () => {
    it('对选中片段应用效果预设', () => {
      const preset = { id: 'preset-1', name: '模糊效果', effects: [] };

      const { result } = renderHook(() => useEditorShellTimelineCallbacks(defaultDeps));
      result.current.applyEffectPresetToSelectedClip(preset as any);

      expect(ApplyEffectPresetCommand).toHaveBeenCalledWith(
        'mock-timeline-accessor',
        'clip-1',
        preset,
      );
      expect(mockCommandExecute).toHaveBeenCalledTimes(1);
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'success' }),
      );
    });

    it('无选中片段时显示警告 toast', () => {
      mockEditorState.selectedClipId = null;

      const preset = { id: 'preset-1', name: '模糊效果', effects: [] };
      const { result } = renderHook(() => useEditorShellTimelineCallbacks(defaultDeps));
      result.current.applyEffectPresetToSelectedClip(preset as any);

      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'warning' }),
      );
      expect(mockCommandExecute).not.toHaveBeenCalled();
    });

    it('命令执行失败时显示错误 toast', () => {
      mockCommandExecute.mockImplementation(() => {
        throw new Error('预设应用失败');
      });

      const preset = { id: 'preset-1', name: '模糊效果', effects: [] };
      const { result } = renderHook(() => useEditorShellTimelineCallbacks(defaultDeps));
      result.current.applyEffectPresetToSelectedClip(preset as any);

      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'error' }),
      );
    });
  });

  // ── deleteSelected（组检测）──────────────────────────────────

  describe('deleteSelected（组检测）', () => {
    it('当选中片段属于完整组时执行 DeleteGroupCommand', async () => {
      const { findCompleteClipGroup } = await import('@open-factory/editor-core');
      vi.mocked(findCompleteClipGroup).mockReturnValueOnce({
        id: 'group-1',
        name: '组 1',
        clipIds: ['clip-1'],
        color: 'blue',
      });

      const { result } = renderHook(() => useEditorShellTimelineCallbacks(defaultDeps));
      result.current.deleteSelected();

      expect(DeleteGroupCommand).toHaveBeenCalledWith(
        'mock-project-accessor',
        'group-1',
      );
      expect(mockClearSelectedClipIds).toHaveBeenCalled();
    });
  });

  // ── navigatePrevGap / navigateNextGap ───────────────────────

  describe('navigatePrevGap / navigateNextGap', () => {
    it('navigatePrevGap 跳转到上一个间隙', async () => {
      const { computeTimelineGaps, navigateGap } = await import('@open-factory/editor-core');
      vi.mocked(navigateGap).mockReturnValueOnce({ trackId: 'track-1', start: 2, end: 4, duration: 2 });

      const { result } = renderHook(() => useEditorShellTimelineCallbacks(defaultDeps));
      result.current.navigatePrevGap();

      expect(computeTimelineGaps).toHaveBeenCalled();
      expect(navigateGap).toHaveBeenCalledWith([], 5, -1);
      expect(mockSetPlayheadTime).toHaveBeenCalledWith(2);
    });

    it('navigateNextGap 跳转到下一个间隙', async () => {
      const { navigateGap } = await import('@open-factory/editor-core');
      vi.mocked(navigateGap).mockReturnValueOnce({ trackId: 'track-1', start: 15, end: 20, duration: 5 });

      const { result } = renderHook(() => useEditorShellTimelineCallbacks(defaultDeps));
      result.current.navigateNextGap();

      expect(navigateGap).toHaveBeenCalledWith([], 5, 1);
      expect(mockSetPlayheadTime).toHaveBeenCalledWith(15);
    });

    it('无间隙时不更新 playhead', async () => {
      const { navigateGap } = await import('@open-factory/editor-core');
      vi.mocked(navigateGap).mockReturnValueOnce(undefined);

      const { result } = renderHook(() => useEditorShellTimelineCallbacks(defaultDeps));
      result.current.navigatePrevGap();

      expect(mockSetPlayheadTime).not.toHaveBeenCalled();
    });
  });
});

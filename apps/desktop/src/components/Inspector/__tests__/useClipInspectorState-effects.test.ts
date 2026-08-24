// @vitest-environment jsdom
// 源文件：apps/desktop/src/components/Inspector/useClipInspectorState.ts
// 覆盖目标：色度键/稳定分析/运动跟踪/音高分析/隐私模糊/色彩匹配/帧插值/AI 效果功能域
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {UpdateClipCommand} from '@open-factory/editor-core';
import { useClipInspectorState } from '../useClipInspectorState';
import {
  makeAsset,
  makeClip,
  makeInspectorProject,
  makeProjectSettings,
  makeTrack,
} from './inspector-fixtures';
import type {Clip, MediaAsset, Project} from '@open-factory/editor-core';

const {
  executeMock,
  showToastMock,
  analyzeClipMock,
  analyzeMotionTrackMock,
  cancelMotionTrackingMock,
  detectPrivacyRegionsMock,
  evaluateExportQualityMock,
  runExportPreviewSamplesMock,
  getAppDataDirMock,
  getFfmpegCapabilitiesMock,
  analyzeClipPitchMock,
  exportPitchCsvMock,
  buildColorMatchCurvesMock,
  buildPreviewPlanMock,
  markLocalAiModelUsedMock,
  openFileDialogMock,
  editorStoreState,
  translationStoreState,
  privacyStoreState,
} = vi.hoisted(() => ({
  executeMock: vi.fn(),
  showToastMock: vi.fn(),
  analyzeClipMock: vi.fn(),
  analyzeMotionTrackMock: vi.fn(),
  cancelMotionTrackingMock: vi.fn(),
  detectPrivacyRegionsMock: vi.fn(),
  evaluateExportQualityMock: vi.fn(),
  runExportPreviewSamplesMock: vi.fn((): Promise<{samples: Array<{id: string; path?: string; [key: string]: unknown}>}> => Promise.resolve({samples: []})),
  getAppDataDirMock: vi.fn(() => Promise.resolve('D:/appdata')),
  getFfmpegCapabilitiesMock: vi.fn(() =>
    Promise.resolve({available: true, hasMinterpolate: true, hasArnndn: true}),
  ),
  analyzeClipPitchMock: vi.fn(),
  exportPitchCsvMock: vi.fn(),
  buildColorMatchCurvesMock: vi.fn(),
  buildPreviewPlanMock: vi.fn((): {samples: Array<{id: string; [key: string]: unknown}>; items: Array<Record<string, unknown>>} => ({samples: [], items: []})),
  markLocalAiModelUsedMock: vi.fn(() => Promise.resolve()),
  openFileDialogMock: vi.fn(),
  editorStoreState: {
    project: undefined as unknown as Project,
    setSelectedClipIds: vi.fn(),
    setSelectedKeyframes: vi.fn(),
    chromaKeyPickClipId: undefined as string | undefined,
    setChromaKeyPickClipId: vi.fn(),
  },
  translationStoreState: {
    provider: 'mock-provider',
    apiKey: 'key-1',
    apiKeyError: undefined as string | undefined,
    targetLanguage: 'en',
    loadApiKey: vi.fn(),
  },
  privacyStoreState: {modelPath: ''},
}));

vi.mock('../../../store/editorStore', () => ({
  useEditorStore: (selector: (state: typeof editorStoreState) => unknown) => selector(editorStoreState),
}));
vi.mock('../../../store/commandManager', () => ({
  commandManager: {execute: executeMock},
  projectAccessor: {name: 'project'},
  timelineAccessor: {name: 'timeline'},
}));
vi.mock('../../../store/translationSettingsStore', () => ({
  useTranslationSettingsStore: (selector: (state: typeof translationStoreState) => unknown) =>
    selector(translationStoreState),
  isTranslationConfigured: vi.fn(() => false),
}));
vi.mock('../../../store/privacyDetectionSettingsStore', () => ({
  usePrivacyDetectionSettingsStore: (selector: (state: typeof privacyStoreState) => unknown) =>
    selector(privacyStoreState),
}));
vi.mock('../../../lib/tauri-bridge', () => ({
  bridgeConfirm: vi.fn(),
  openFileDialog: openFileDialogMock,
  readFile: vi.fn(),
  listenBridge: vi.fn(() => Promise.resolve(() => {})),
  getFfmpegCapabilities: getFfmpegCapabilitiesMock,
  getAppDataDir: getAppDataDirMock,
  convertLocalFileSrc: vi.fn((path: string) => `asset://${path}`),
  runExportPreviewSamples: runExportPreviewSamplesMock,
  analyzeClip: analyzeClipMock,
  analyzeMotionTrack: analyzeMotionTrackMock,
  cancelMotionTracking: cancelMotionTrackingMock,
  detectPrivacyRegions: detectPrivacyRegionsMock,
  evaluateExportQuality: evaluateExportQualityMock,
}));
vi.mock('../../../lib/toast', () => ({showToast: showToastMock}));
vi.mock('../../../lib/subtitleStyleTemplates', () => ({
  loadSubtitleStyleTemplates: vi.fn(() => Promise.resolve([])),
  saveCustomSubtitleStyleTemplate: vi.fn(),
  deleteCustomSubtitleStyleTemplate: vi.fn(),
}));
vi.mock('../../../shared-library/sharedLibrary', () => ({
  addSharedLibraryResource: vi.fn(),
  loadSharedSubtitleStyleTemplates: vi.fn(() => Promise.resolve([])),
  subtitleStyleTemplateToSharedResource: vi.fn(),
}));
vi.mock('../../../lib/subtitleTranslation', () => ({
  acceptTranslationTOS: vi.fn(),
  subtitleClipsToTranslationItems: vi.fn(),
  translateSubtitleItems: vi.fn(),
}));
vi.mock('../../../lib/frameInterpolationComparePreview', () => ({
  buildFrameInterpolationComparePreviewPlan: buildPreviewPlanMock,
  FRAME_INTERPOLATION_COMPARE_TIMEOUT_MS: 60000,
}));
vi.mock('../../../lib/colorMatch', () => ({buildClipColorMatchCurves: buildColorMatchCurvesMock}));
vi.mock('../../../settings/appSettings', () => ({markLocalAiModelUsed: markLocalAiModelUsedMock}));
vi.mock('../../../media/pitchAnalysis', () => ({
  analyzeClipPitch: analyzeClipPitchMock,
  exportClipPitchCsv: exportPitchCsvMock,
}));
vi.mock('../InspectorEditors', () => ({
  buildAudioRestorationPreviewPeaks: vi.fn(() => []),
  mergeSubtitleStyleTemplateViews: vi.fn((a: unknown[]) => a),
  getSubtitleStyleTemplateLabel: vi.fn((t: {name: string}) => t.name),
  resolveSelectedKeyframeEntries: vi.fn(() => []),
  joinLocalPath: vi.fn((base: string, child: string) => `${base}/${child}`),
}));

interface RenderOptions {
  clip?: Clip;
  media?: MediaAsset[];
  chromaKeyPickClipId?: string;
}

const ASSET = makeAsset({id: 'media-1', path: 'D:/media/video.mp4', type: 'video'});

function makeVideoClip(overrides: Record<string, unknown> = {}): Clip {
  return makeClip({id: 'clip-video', trackId: 'track-video-1', mediaId: 'media-1', duration: 5, ...overrides});
}

function renderInspector(options: RenderOptions = {}) {
  const clip = options.clip ?? makeVideoClip();
  const track = makeTrack({id: clip.trackId, clips: [clip]});
  editorStoreState.project = makeInspectorProject({tracks: [track]});
  editorStoreState.chromaKeyPickClipId = options.chromaKeyPickClipId;
  return renderHook(() =>
    useClipInspectorState({
      clip,
      selectedClipLocked: false,
      media: options.media ?? [ASSET],
      playheadTime: 0,
      projectSettings: makeProjectSettings(),
      selectedSubtitleClips: [],
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  [
    executeMock,
    showToastMock,
    analyzeClipMock,
    analyzeMotionTrackMock,
    cancelMotionTrackingMock,
    detectPrivacyRegionsMock,
    evaluateExportQualityMock,
    analyzeClipPitchMock,
    exportPitchCsvMock,
    buildColorMatchCurvesMock,
    openFileDialogMock,
  ].forEach((mock) => mock.mockReset());
  runExportPreviewSamplesMock.mockReturnValue(Promise.resolve({samples: []}));
  buildPreviewPlanMock.mockReturnValue({samples: [], items: []});
  getAppDataDirMock.mockReturnValue(Promise.resolve('D:/appdata'));
  getFfmpegCapabilitiesMock.mockReturnValue(
    Promise.resolve({available: true, hasMinterpolate: true, hasArnndn: true}),
  );
  markLocalAiModelUsedMock.mockReturnValue(Promise.resolve());
  privacyStoreState.modelPath = '';
});

describe('useClipInspectorState 能力检测域', () => {
  it('FFmpeg 能力检测成功后更新支持状态', async () => {
    const {result} = renderInspector();
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.frameInterpolationSupported).toBe(true);
    expect(result.current.audioDenoiseSupported).toBe(true);
  });

  it('FFmpeg 能力检测失败时回退为不支持', async () => {
    getFfmpegCapabilitiesMock.mockReturnValue(Promise.reject(new Error('unavailable')));
    const {result} = renderInspector();
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.frameInterpolationSupported).toBe(false);
    expect(result.current.audioDenoiseSupported).toBe(false);
    expect(result.current.frameInterpolationUnavailable).toBe(true);
  });
});

describe('useClipInspectorState 色度键域', () => {
  it('keyingMode 随 chromaKey.enabled 计算', () => {
    const clip = makeVideoClip({chromaKey: {enabled: true, mode: 'chroma-key', color: [0, 255, 0], colors: [[0, 255, 0]]}});
    const {result} = renderInspector({clip});
    expect(result.current.keyingMode).toBe('chroma-key');
  });

  it('未启用 chromaKey 时 keyingMode 为 none', () => {
    const {result} = renderInspector();
    expect(result.current.keyingMode).toBe('none');
  });

  it('chromaKeyPickActive 匹配当前 clip', () => {
    const {result} = renderInspector({chromaKeyPickClipId: 'clip-video'});
    expect(result.current.chromaKeyPickActive).toBe(true);
  });

  it('commitChromaKeyColors 截断超出上限的颜色数量', () => {
    const clip = makeVideoClip({
      chromaKey: {enabled: true, mode: 'chroma-key', color: [0, 255, 0], colors: [[0, 255, 0]]},
    });
    const {result} = renderInspector({clip});
    act(() => {
      result.current.commitChromaKeyColors(
        Array.from({length: 10}, () => [255, 0, 0]),
      );
    });
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(UpdateClipCommand);
  });

  it('updateChromaKeyColor 替换指定索引的颜色', () => {
    const clip = makeVideoClip({
      chromaKey: {
        enabled: true,
        mode: 'chroma-key',
        color: [0, 255, 0],
        colors: [
          [0, 255, 0],
          [0, 0, 255],
        ],
      },
    });
    const {result} = renderInspector({clip});
    act(() => {
      result.current.updateChromaKeyColor(1, [255, 255, 0]);
    });
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(UpdateClipCommand);
  });

  it('addChromaKeyColor 达到上限时直接返回', () => {
    const clip = makeVideoClip({
      chromaKey: {
        enabled: true,
        mode: 'chroma-key',
        color: [0, 255, 0],
        colors: [
          [0, 255, 0],
          [0, 0, 255],
          [255, 0, 0],
        ],
      },
    });
    const {result} = renderInspector({clip});
    act(() => {
      result.current.addChromaKeyColor();
    });
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('removeChromaKeyColor 仅剩一色时直接返回', () => {
    const clip = makeVideoClip({
      chromaKey: {enabled: true, mode: 'chroma-key', color: [0, 255, 0], colors: [[0, 255, 0]]},
    });
    const {result} = renderInspector({clip});
    act(() => {
      result.current.removeChromaKeyColor(0);
    });
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('toggleChromaKeyPicker 已激活时取消取色', () => {
    const {result} = renderInspector({chromaKeyPickClipId: 'clip-video'});
    act(() => {
      result.current.toggleChromaKeyPicker();
    });
    expect(result.current.setChromaKeyPickClipId).toHaveBeenCalledWith(undefined);
  });

  it('toggleChromaKeyPicker 未激活时选中当前 clip 并开启取色', () => {
    const {result} = renderInspector();
    act(() => {
      result.current.toggleChromaKeyPicker();
    });
    expect(result.current.setSelectedClipIds).toHaveBeenCalledWith(['clip-video']);
    expect(result.current.setChromaKeyPickClipId).toHaveBeenCalledWith('clip-video');
  });
});

describe('useClipInspectorState 稳定分析域', () => {
  it('runStabilizationAnalysis 非 video clip 或无 asset 时直接返回', async () => {
    const clip = makeClip({id: 'clip-audio', trackId: 'track-audio-1', type: 'audio'});
    const {result} = renderInspector({clip, media: []});
    await act(async () => {
      await result.current.runStabilizationAnalysis();
    });
    expect(analyzeClipMock).not.toHaveBeenCalled();
  });

  it('runStabilizationAnalysis 成功后提交 stabilization 补丁', async () => {
    analyzeClipMock.mockResolvedValue({trfPath: 'D:/cache/stab.trf'});
    const {result} = renderInspector();
    await act(async () => {
      await result.current.runStabilizationAnalysis();
    });
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(UpdateClipCommand);
    expect(result.current.analysisProgress).toBe(1);
  });

  it('runStabilizationAnalysis 失败时弹 toast 并清空进度', async () => {
    analyzeClipMock.mockRejectedValue(new Error('analyze failed'));
    const {result} = renderInspector();
    await act(async () => {
      await result.current.runStabilizationAnalysis();
    });
    expect(showToastMock).toHaveBeenCalledWith(
      expect.objectContaining({kind: 'warning', message: 'analyze failed'}),
    );
    expect(result.current.analysisProgress).toBeUndefined();
  });
});

describe('useClipInspectorState 运动跟踪域', () => {
  it('runMotionTrackAnalysis 成功后提交跟踪点', async () => {
    analyzeMotionTrackMock.mockResolvedValue({points: [{t: 0, x: 1, y: 2}]});
    const {result} = renderInspector();
    await act(async () => {
      await result.current.runMotionTrackAnalysis();
    });
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(result.current.motionTrackProgress).toBe(1);
    expect(result.current.motionTrackingBusy).toBe(false);
  });

  it('runMotionTrackAnalysis 无跟踪点时弹 toast', async () => {
    analyzeMotionTrackMock.mockResolvedValue({points: []});
    const {result} = renderInspector();
    await act(async () => {
      await result.current.runMotionTrackAnalysis();
    });
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({kind: 'warning'}));
  });

  it('runMotionTrackAnalysis 失败时弹 toast', async () => {
    analyzeMotionTrackMock.mockRejectedValue(new Error('motion failed'));
    const {result} = renderInspector();
    await act(async () => {
      await result.current.runMotionTrackAnalysis();
    });
    expect(showToastMock).toHaveBeenCalledWith(
      expect.objectContaining({kind: 'warning', message: 'motion failed'}),
    );
    expect(result.current.motionTrackProgress).toBeUndefined();
  });

  it('cancelMotionTrackAnalysis 成功后复位忙碌状态', async () => {
    cancelMotionTrackingMock.mockResolvedValue(undefined);
    const {result} = renderInspector();
    await act(async () => {
      await result.current.cancelMotionTrackAnalysis();
    });
    expect(cancelMotionTrackingMock).toHaveBeenCalledWith('clip-video');
    expect(result.current.motionTrackingBusy).toBe(false);
  });

  it('cancelMotionTrackAnalysis 失败时弹 toast', async () => {
    cancelMotionTrackingMock.mockRejectedValue(new Error('cancel failed'));
    const {result} = renderInspector();
    await act(async () => {
      await result.current.cancelMotionTrackAnalysis();
    });
    expect(showToastMock).toHaveBeenCalledWith(
      expect.objectContaining({kind: 'warning', message: 'cancel failed'}),
    );
  });

  it('bindMotionTrackKeyframes 有跟踪数据时提交位置关键帧', () => {
    const clip = makeVideoClip({
      motionTrack: [{time: 0, dx: 1, dy: 2}],
      keyframes: {},
    });
    const {result} = renderInspector({clip});
    act(() => {
      result.current.bindMotionTrackKeyframes();
    });
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(UpdateClipCommand);
  });
});

describe('useClipInspectorState 音高分析域', () => {
  it('runPitchAnalysis 无 asset 时直接返回', async () => {
    const clip = makeClip({id: 'clip-audio', trackId: 'track-audio-1', type: 'audio'});
    const {result} = renderInspector({clip, media: []});
    await act(async () => {
      await result.current.runPitchAnalysis();
    });
    expect(analyzeClipPitchMock).not.toHaveBeenCalled();
  });

  it('runPitchAnalysis 成功后提交音高数据', async () => {
    analyzeClipPitchMock.mockResolvedValue([{t: 0, hz: 220}]);
    const {result} = renderInspector();
    await act(async () => {
      await result.current.runPitchAnalysis();
    });
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({kind: 'success'}));
    expect(result.current.pitchAnalyzing).toBe(false);
  });

  it('runPitchAnalysis 空数据时弹提示', async () => {
    analyzeClipPitchMock.mockResolvedValue([]);
    const {result} = renderInspector();
    await act(async () => {
      await result.current.runPitchAnalysis();
    });
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({kind: 'warning'}));
  });

  it('runPitchAnalysis 失败时弹 toast', async () => {
    analyzeClipPitchMock.mockRejectedValue(new Error('pitch failed'));
    const {result} = renderInspector();
    await act(async () => {
      await result.current.runPitchAnalysis();
    });
    expect(showToastMock).toHaveBeenCalledWith(
      expect.objectContaining({kind: 'warning', message: 'pitch failed'}),
    );
  });

  it('exportPitchCsv 导出成功时提示', async () => {
    exportPitchCsvMock.mockResolvedValue(true);
    const {result} = renderInspector();
    await act(async () => {
      await result.current.exportPitchCsv();
    });
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({kind: 'success'}));
  });

  it('exportPitchCsv 失败时弹 toast', async () => {
    exportPitchCsvMock.mockRejectedValue(new Error('export failed'));
    const {result} = renderInspector();
    await act(async () => {
      await result.current.exportPitchCsv();
    });
    expect(showToastMock).toHaveBeenCalledWith(
      expect.objectContaining({kind: 'warning', message: 'export failed'}),
    );
  });
});

describe('useClipInspectorState 隐私模糊域', () => {
  it('modelPath 为空时提示模型必填', async () => {
    privacyStoreState.modelPath = '  ';
    const {result} = renderInspector();
    await act(async () => {
      await result.current.runPrivacyBlurDetection();
    });
    expect(showToastMock).toHaveBeenCalledWith(
      expect.objectContaining({kind: 'warning'}),
    );
    expect(detectPrivacyRegionsMock).not.toHaveBeenCalled();
  });

  it('无媒体路径时提示无媒体', async () => {
    privacyStoreState.modelPath = 'D:/models/yunet.onnx';
    const clip = makeClip({id: 'clip-audio', trackId: 'track-audio-1', type: 'audio'});
    const {result} = renderInspector({clip, media: []});
    await act(async () => {
      await result.current.runPrivacyBlurDetection();
    });
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({kind: 'warning'}));
    expect(detectPrivacyRegionsMock).not.toHaveBeenCalled();
  });

  it('检测到区域时提交遮罩并提示成功', async () => {
    privacyStoreState.modelPath = 'D:/models/yunet.onnx';
    detectPrivacyRegionsMock.mockResolvedValue({boxes: [{time: 0, x: 0, y: 0, w: 10, h: 10}]});
    const {result} = renderInspector();
    await act(async () => {
      await result.current.runPrivacyBlurDetection();
    });
    expect(markLocalAiModelUsedMock).toHaveBeenCalled();
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(UpdateClipCommand);
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({kind: 'success'}));
    expect(result.current.privacyBlurBusy).toBe(false);
  });

  it('无检测结果时提示未检测到', async () => {
    privacyStoreState.modelPath = 'D:/models/yunet.onnx';
    detectPrivacyRegionsMock.mockResolvedValue({boxes: []});
    const {result} = renderInspector();
    await act(async () => {
      await result.current.runPrivacyBlurDetection();
    });
    expect(executeMock).not.toHaveBeenCalled();
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({kind: 'info'}));
  });

  it('检测失败时弹 toast', async () => {
    privacyStoreState.modelPath = 'D:/models/yunet.onnx';
    detectPrivacyRegionsMock.mockRejectedValue(new Error('detect failed'));
    const {result} = renderInspector();
    await act(async () => {
      await result.current.runPrivacyBlurDetection();
    });
    expect(showToastMock).toHaveBeenCalledWith(
      expect.objectContaining({kind: 'warning', message: 'detect failed'}),
    );
  });
});

describe('useClipInspectorState 色彩匹配域', () => {
  function renderForColorMatch() {
    const reference = makeClip({id: 'clip-ref', trackId: 'track-video-1', type: 'video', mediaId: 'media-1'});
    const target = makeVideoClip({id: 'clip-video'});
    const track = makeTrack({id: 'track-video-1', clips: [target, reference]});
    editorStoreState.project = makeInspectorProject({tracks: [track]});
    return renderHook(() =>
      useClipInspectorState({
        clip: target,
        selectedClipLocked: false,
        media: [ASSET],
        playheadTime: 0,
        projectSettings: makeProjectSettings(),
        selectedSubtitleClips: [],
      }),
    );
  }

  it('无可用参考剪辑时提示需要参考', async () => {
    const {result} = renderInspector();
    await act(async () => {
      await result.current.applyColorMatch();
    });
    expect(showToastMock).toHaveBeenCalledWith(
      expect.objectContaining({kind: 'warning'}),
    );
    expect(buildColorMatchCurvesMock).not.toHaveBeenCalled();
  });

  it('匹配成功后提交色彩曲线', async () => {
    buildColorMatchCurvesMock.mockResolvedValue({lift: 0});
    const {result} = renderForColorMatch();
    await act(async () => {
      await result.current.applyColorMatch();
    });
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(UpdateClipCommand);
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({kind: 'success'}));
    expect(result.current.colorMatchBusy).toBe(false);
  });

  it('匹配失败时弹 toast', async () => {
    buildColorMatchCurvesMock.mockRejectedValue(new Error('match failed'));
    const {result} = renderForColorMatch();
    await act(async () => {
      await result.current.applyColorMatch();
    });
    expect(showToastMock).toHaveBeenCalledWith(
      expect.objectContaining({kind: 'warning', message: 'match failed'}),
    );
  });
});

describe('useClipInspectorState 帧插值域', () => {
  it('compare 预览：非 video clip 时设置缺媒体错误', async () => {
    const clip = makeClip({id: 'clip-audio', trackId: 'track-audio-1', type: 'audio'});
    const {result} = renderInspector({clip, media: []});
    await act(async () => {
      await result.current.runFrameInterpolationComparePreview();
    });
    expect(result.current.frameInterpolationCompareError).toBeTruthy();
    expect(result.current.frameInterpolationCompareRunning).toBe(false);
  });

  it('compare 预览：成功时生成对比项列表', async () => {
    buildPreviewPlanMock.mockReturnValue({
      samples: [{id: 'frame-interpolation-mci'}],
      items: [
        {
          mode: 'mci',
          label: 'MCI',
          outputPath: 'D:/cache/mci.png',
          estimatedMs: 500,
          slowMotionMode: undefined,
        },
      ],
    });
    runExportPreviewSamplesMock.mockResolvedValue({
      samples: [{id: 'frame-interpolation-mci', path: 'D:/cache/mci.png'}],
    });
    const {result} = renderInspector();
    await act(async () => {
      await result.current.runFrameInterpolationComparePreview();
    });
    expect(result.current.frameInterpolationCompareItems).toHaveLength(1);
    expect(result.current.frameInterpolationCompareItems[0].mode).toBe('mci');
    expect(result.current.frameInterpolationCompareItems[0].src).toContain('asset://');
    expect(result.current.frameInterpolationCompareError).toBeUndefined();
  });

  it('compare 预览：失败时弹 toast 并记录错误', async () => {
    runExportPreviewSamplesMock.mockRejectedValue(new Error('preview failed'));
    const {result} = renderInspector();
    await act(async () => {
      await result.current.runFrameInterpolationComparePreview();
    });
    expect(result.current.frameInterpolationCompareError).toBe('preview failed');
    expect(showToastMock).toHaveBeenCalledWith(
      expect.objectContaining({kind: 'warning', message: 'preview failed'}),
    );
    expect(result.current.frameInterpolationCompareRunning).toBe(false);
  });

  it('质量评估：成功后提交质量报告', async () => {
    buildPreviewPlanMock.mockReturnValue({
      samples: [
        {id: 'frame-interpolation-blend'},
        {id: 'frame-interpolation-mci'},
      ],
      items: [],
    });
    runExportPreviewSamplesMock.mockResolvedValue({
      samples: [
        {id: 'frame-interpolation-blend', path: 'D:/cache/blend.png'},
        {id: 'frame-interpolation-mci', path: 'D:/cache/mci.png'},
      ],
    });
    evaluateExportQualityMock.mockResolvedValue({ssim: 0.93});
    const {result} = renderInspector();
    await act(async () => {
      await result.current.runFrameInterpolationQualityEvaluation();
    });
    expect(evaluateExportQualityMock).toHaveBeenCalled();
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(UpdateClipCommand);
    expect(result.current.frameInterpolationQualityError).toBeUndefined();
    expect(result.current.frameInterpolationQualityRunning).toBe(false);
  });

  it('质量评估：缺 baseline 时设置失败信息', async () => {
    buildPreviewPlanMock.mockReturnValue({samples: [], items: []});
    runExportPreviewSamplesMock.mockResolvedValue({samples: []});
    const {result} = renderInspector();
    await act(async () => {
      await result.current.runFrameInterpolationQualityEvaluation();
    });
    expect(result.current.frameInterpolationQualityError).toBeTruthy();
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({kind: 'warning'}));
  });
});

describe('useClipInspectorState 效果更新域', () => {
  it('updatePanorama 提交全景补丁', () => {
    const {result} = renderInspector();
    act(() => {
      result.current.updatePanorama({fov: 120});
    });
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(UpdateClipCommand);
  });

  it('updateVideoRestoration 提交视频修复补丁', () => {
    const {result} = renderInspector();
    act(() => {
      result.current.updateVideoRestoration({deinterlace: {enabled: true, mode: 1}});
    });
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(UpdateClipCommand);
  });

  it('updateQualityEnhancement 提交画质增强补丁', () => {
    const {result} = renderInspector();
    act(() => {
      result.current.updateQualityEnhancement({superResolution: true});
    });
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(UpdateClipCommand);
  });

  it('updateAudioRestoration 提交音频修复补丁', () => {
    const {result} = renderInspector();
    act(() => {
      result.current.updateAudioRestoration({declip: {enabled: true}});
    });
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(UpdateClipCommand);
  });

  it('chooseLut 选择文件后提交 LUT 路径', async () => {
    openFileDialogMock.mockResolvedValue(['D:/luts/warm.cube']);
    const {result} = renderInspector();
    await act(async () => {
      await result.current.chooseLut();
    });
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(UpdateClipCommand);
  });

  it('chooseLut 取消选择时不提交', async () => {
    openFileDialogMock.mockResolvedValue([]);
    const {result} = renderInspector();
    await act(async () => {
      await result.current.chooseLut();
    });
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('chooseLut 对话框失败时弹 toast', async () => {
    openFileDialogMock.mockRejectedValue(new Error('dialog failed'));
    const {result} = renderInspector();
    await act(async () => {
      await result.current.chooseLut();
    });
    expect(showToastMock).toHaveBeenCalledWith(
      expect.objectContaining({kind: 'warning', message: 'dialog failed'}),
    );
  });
});

describe('useClipInspectorState 计算值域', () => {
  it('慢速视频显示慢动作模式选项', () => {
    const clip = makeVideoClip({speed: 0.5});
    const {result} = renderInspector({clip});
    expect(result.current.showSlowMotionMode).toBe(true);
  });

  it('常速视频不显示慢动作模式选项', () => {
    const {result} = renderInspector();
    expect(result.current.showSlowMotionMode).toBe(false);
  });

  it('逐行扫描源给出反交错建议', () => {
    const interlacedAsset = makeAsset({id: 'media-1', type: 'video', fieldOrder: 'tt'});
    const {result} = renderInspector({media: [interlacedAsset]});
    expect(result.current.deinterlaceSuggestion).not.toBeNull();
  });

  it('音频通道选项跟随资产声道数', () => {
    const monoAsset = makeAsset({id: 'media-1', type: 'audio', audioChannels: 1});
    const clip = makeClip({id: 'clip-audio', trackId: 'track-audio-1', type: 'audio', mediaId: 'media-1'});
    const {result} = renderInspector({clip, media: [monoAsset]});
    expect(result.current.audioChannelRoutingOptions).toContain('mono-left');
  });
});

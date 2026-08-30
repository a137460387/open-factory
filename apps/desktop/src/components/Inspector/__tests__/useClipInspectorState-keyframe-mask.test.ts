// @vitest-environment jsdom
// 源文件：apps/desktop/src/components/Inspector/useClipInspectorState.ts
// 覆盖目标：关键帧/曲线编辑/遮罩/KenBurns/文本动画功能域
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  AddKeyframeCommand,
  AddMaskCommand,
  ApplyTextAnimationCommand,
  BatchKeyframeEditCommand,
  BatchUpdateKeyframeCommand,
  RemoveKeyframeCommand,
  RemoveMaskCommand,
  UpdateClipCommand,
  UpdateKeyframeCommand,
  UpdateMaskCommand,
} from '@open-factory/editor-core';
import type { SelectedKeyframeRef } from '../../../store/editorStore';
import { useClipInspectorState } from '../useClipInspectorState';
import {
  makeAudioClip,
  makeClip,
  makeImageClip,
  makeInspectorProject,
  makeProjectSettings,
  makeTextClip,
  makeTrack,
} from './inspector-fixtures';
import type { Clip, Project, Track } from '@open-factory/editor-core';

const { executeMock, showToastMock, resolveEntriesMock, editorStoreState, translationStoreState, privacyStoreState } =
  vi.hoisted(() => ({
    executeMock: vi.fn(),
    showToastMock: vi.fn(),
    resolveEntriesMock: vi.fn((): Array<{ ref: { clipId: string }; clip: unknown; frame: unknown }> => []),
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
    privacyStoreState: { modelPath: '' },
  }));

vi.mock('../../../store/editorStore', () => ({
  useEditorStore: (selector: (state: typeof editorStoreState) => unknown) => selector(editorStoreState),
}));
vi.mock('../../../store/commandManager', () => ({
  commandManager: { execute: executeMock },
  projectAccessor: { name: 'project' },
  timelineAccessor: { name: 'timeline' },
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
  openFileDialog: vi.fn(),
  readFile: vi.fn(),
  listenBridge: vi.fn(() => Promise.resolve(() => {})),
  getFfmpegCapabilities: vi.fn(() => Promise.resolve({ available: true, hasMinterpolate: true, hasArnndn: true })),
  getAppDataDir: vi.fn(() => Promise.resolve('D:/appdata')),
  convertLocalFileSrc: vi.fn((path: string) => `asset://${path}`),
  runExportPreviewSamples: vi.fn(() => Promise.resolve({ samples: [] })),
  analyzeClip: vi.fn(),
  analyzeMotionTrack: vi.fn(),
  cancelMotionTracking: vi.fn(),
  detectPrivacyRegions: vi.fn(),
  evaluateExportQuality: vi.fn(),
}));
vi.mock('../../../lib/toast', () => ({ showToast: showToastMock }));
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
  buildFrameInterpolationComparePreviewPlan: vi.fn(() => ({ samples: [], items: [] })),
  FRAME_INTERPOLATION_COMPARE_TIMEOUT_MS: 60000,
}));
vi.mock('../../../lib/colorMatch', () => ({ buildClipColorMatchCurves: vi.fn() }));
vi.mock('../../../settings/appSettings', () => ({ markLocalAiModelUsed: vi.fn() }));
vi.mock('../../../media/pitchAnalysis', () => ({
  analyzeClipPitch: vi.fn(),
  exportClipPitchCsv: vi.fn(),
}));
vi.mock('../InspectorEditors', () => ({
  buildAudioRestorationPreviewPeaks: vi.fn(() => []),
  mergeSubtitleStyleTemplateViews: vi.fn((a: unknown[]) => a),
  getSubtitleStyleTemplateLabel: vi.fn((t: { name: string }) => t.name),
  resolveSelectedKeyframeEntries: resolveEntriesMock,
  joinLocalPath: vi.fn((base: string, child: string) => `${base}/${child}`),
}));

const KEYFRAMES = {
  opacity: [
    { id: 'kf-1', time: 1, value: 0, easing: 'linear' as const },
    { id: 'kf-2', time: 3, value: 1, easing: 'linear' as const },
  ],
};

interface RenderOptions {
  clip?: Clip;
  tracks?: Track[];
  playheadTime?: number;
  selectedKeyframe?: SelectedKeyframeRef;
  selectedKeyframes?: SelectedKeyframeRef[];
}

function renderInspector(options: RenderOptions = {}) {
  const clip =
    options.clip ?? makeClip({ id: 'clip-video', trackId: 'track-video-1', keyframes: KEYFRAMES, duration: 5 });
  const fallbackTrack = makeTrack({ id: clip.trackId, clips: [clip] });
  editorStoreState.project = makeInspectorProject({ tracks: options.tracks ?? [fallbackTrack] });
  return renderHook(() =>
    useClipInspectorState({
      clip,
      selectedClipLocked: false,
      selectedKeyframe: options.selectedKeyframe,
      selectedKeyframes: options.selectedKeyframes ?? [],
      media: [],
      playheadTime: options.playheadTime ?? 0,
      projectSettings: makeProjectSettings(),
      selectedSubtitleClips: [],
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  executeMock.mockReset();
  showToastMock.mockReset();
  resolveEntriesMock.mockReset();
  resolveEntriesMock.mockReturnValue([]);
});

describe('useClipInspectorState 关键帧计算值域', () => {
  it('keyframeProperties 只列出有帧的属性', () => {
    const { result } = renderInspector();
    expect(result.current.keyframeProperties).toEqual(['opacity']);
  });

  it('localKeyframeTime 钳制到 clip 范围', () => {
    const { result } = renderInspector({ playheadTime: 99 });
    expect(result.current.localKeyframeTime).toBe(5);
  });

  it('localKeyframeTime 负值钳制为 0', () => {
    const clip = makeClip({ id: 'clip-video', start: 10, duration: 5, keyframes: KEYFRAMES });
    const { result } = renderInspector({ clip, playheadTime: 3 });
    expect(result.current.localKeyframeTime).toBe(0);
  });

  it('selectedKeyframeFrame 命中当前 clip 的帧', () => {
    const { result } = renderInspector({
      selectedKeyframe: { clipId: 'clip-video', property: 'opacity', keyframeId: 'kf-1' },
    });
    expect(result.current.selectedKeyframeFrame?.id).toBe('kf-1');
  });

  it('selectedKeyframeFrame 在 clipId 不匹配时为 undefined', () => {
    const { result } = renderInspector({
      selectedKeyframe: { clipId: 'other-clip', property: 'opacity', keyframeId: 'kf-1' },
    });
    expect(result.current.selectedKeyframeFrame).toBeUndefined();
  });

  it('selectedKeyframeRefs 优先使用批量选中列表', () => {
    const refs: SelectedKeyframeRef[] = [
      { clipId: 'clip-video', property: 'opacity', keyframeId: 'kf-1' },
      { clipId: 'clip-video', property: 'opacity', keyframeId: 'kf-2' },
    ];
    const { result } = renderInspector({
      selectedKeyframe: { clipId: 'clip-video', property: 'opacity', keyframeId: 'kf-1' },
      selectedKeyframes: refs,
    });
    expect(result.current.selectedKeyframeRefs).toEqual(refs);
  });

  it('batchKeyframesSelected 反映多选状态', () => {
    resolveEntriesMock.mockReturnValue([
      { ref: { clipId: 'clip-video' }, clip: {}, frame: {} },
      { ref: { clipId: 'clip-video' }, clip: {}, frame: {} },
    ]);
    const { result } = renderInspector();
    expect(result.current.batchKeyframesSelected).toBe(true);
  });

  it('textAnimationKeyframeCount 汇总动画相关属性帧数', () => {
    const clip = makeTextClip({
      keyframes: { opacity: [{ id: 'kf-1', time: 0, value: 1, easing: 'linear' }] },
    });
    const { result } = renderInspector({ clip });
    expect(result.current.textAnimationKeyframeCount).toBe(1);
  });
});

describe('useClipInspectorState 关键帧命令域', () => {
  it('commit 执行 UpdateClipCommand', () => {
    const { result } = renderInspector();
    act(() => {
      result.current.commit({ volume: 0.5 });
    });
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(UpdateClipCommand);
  });

  it('commit 失败时弹 toast', () => {
    executeMock.mockImplementation(() => {
      throw new Error('clip rejected');
    });
    const { result } = renderInspector();
    act(() => {
      result.current.commit({ volume: 0.5 });
    });
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({ kind: 'warning', message: 'clip rejected' }));
  });

  it('addKeyframe 使用指定值执行 AddKeyframeCommand', () => {
    const { result } = renderInspector({ playheadTime: 2 });
    act(() => {
      result.current.addKeyframe('opacity', 0.7);
    });
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(AddKeyframeCommand);
  });

  it('addKeyframe 失败时弹 toast', () => {
    executeMock.mockImplementation(() => {
      throw new Error('add failed');
    });
    const { result } = renderInspector();
    act(() => {
      result.current.addKeyframe('opacity', 0.7);
    });
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({ kind: 'warning', message: 'add failed' }));
  });

  it('updateSelectedKeyframe 无选中时直接返回', () => {
    const { result } = renderInspector();
    act(() => {
      result.current.updateSelectedKeyframe({ value: 0.5 });
    });
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('updateSelectedKeyframe 执行 UpdateKeyframeCommand', () => {
    const { result } = renderInspector({
      selectedKeyframe: { clipId: 'clip-video', property: 'opacity', keyframeId: 'kf-1' },
    });
    act(() => {
      result.current.updateSelectedKeyframe({ value: 0.5 });
    });
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(UpdateKeyframeCommand);
  });

  it('updateSelectedKeyframe 失败时弹 toast', () => {
    executeMock.mockImplementation(() => {
      throw new Error('keyframe rejected');
    });
    const { result } = renderInspector({
      selectedKeyframe: { clipId: 'clip-video', property: 'opacity', keyframeId: 'kf-1' },
    });
    act(() => {
      result.current.updateSelectedKeyframe({ value: 0.5 });
    });
    expect(showToastMock).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'warning', message: 'keyframe rejected' }),
    );
  });

  it('removeSelectedKeyframe 无选中时直接返回', () => {
    const { result } = renderInspector();
    act(() => {
      result.current.removeSelectedKeyframe();
    });
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('removeSelectedKeyframe 执行 RemoveKeyframeCommand', () => {
    const { result } = renderInspector({
      selectedKeyframe: { clipId: 'clip-video', property: 'opacity', keyframeId: 'kf-1' },
    });
    act(() => {
      result.current.removeSelectedKeyframe();
    });
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(RemoveKeyframeCommand);
  });

  it('runBatchKeyframeEdit 无选中帧时直接返回', () => {
    const { result } = renderInspector();
    act(() => {
      result.current.shiftSelectedKeyframes();
    });
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('shiftSelectedKeyframes 执行 shift 批量命令', () => {
    resolveEntriesMock.mockReturnValue([{ ref: { clipId: 'clip-video' }, clip: {}, frame: {} }]);
    const { result } = renderInspector();
    act(() => {
      result.current.setBatchShiftSeconds(0.5);
    });
    act(() => {
      result.current.shiftSelectedKeyframes();
    });
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(BatchKeyframeEditCommand);
  });

  it('scaleSelectedKeyframes 执行 scale-time 批量命令', () => {
    resolveEntriesMock.mockReturnValue([{ ref: { clipId: 'clip-video' }, clip: {}, frame: {} }]);
    const { result } = renderInspector();
    act(() => {
      result.current.setBatchScaleFactor(2);
    });
    act(() => {
      result.current.scaleSelectedKeyframes();
    });
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(BatchKeyframeEditCommand);
  });

  it('updateSelectedKeyframeEasing 执行 easing 批量命令', () => {
    resolveEntriesMock.mockReturnValue([{ ref: { clipId: 'clip-video' }, clip: {}, frame: {} }]);
    const { result } = renderInspector();
    act(() => {
      result.current.setBatchEasing('ease-in');
    });
    act(() => {
      result.current.updateSelectedKeyframeEasing();
    });
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(BatchKeyframeEditCommand);
  });

  it('distributeSelectedKeyframes 与 alignSelectedKeyframeValues 各执行批量命令', () => {
    resolveEntriesMock.mockReturnValue([{ ref: { clipId: 'clip-video' }, clip: {}, frame: {} }]);
    const { result } = renderInspector();
    act(() => {
      result.current.distributeSelectedKeyframes();
    });
    act(() => {
      result.current.alignSelectedKeyframeValues();
    });
    expect(executeMock).toHaveBeenCalledTimes(2);
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(BatchKeyframeEditCommand);
    expect(executeMock.mock.calls[1][0]).toBeInstanceOf(BatchKeyframeEditCommand);
  });

  it('deleteSelectedKeyframes 删除后清空选中列表', () => {
    resolveEntriesMock.mockReturnValue([{ ref: { clipId: 'clip-video' }, clip: {}, frame: {} }]);
    const { result } = renderInspector();
    act(() => {
      result.current.deleteSelectedKeyframes();
    });
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(result.current.setSelectedKeyframes).toHaveBeenCalledWith([]);
  });

  it('runBatchKeyframeEdit 命令失败时弹 toast', () => {
    resolveEntriesMock.mockReturnValue([{ ref: { clipId: 'clip-video' }, clip: {}, frame: {} }]);
    executeMock.mockImplementation(() => {
      throw new Error('batch failed');
    });
    const { result } = renderInspector();
    act(() => {
      result.current.distributeSelectedKeyframes();
    });
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({ kind: 'warning', message: 'batch failed' }));
  });

  it('updateSelectedKeyframeExpression 解析 time 表达式并提交', () => {
    const { result } = renderInspector({
      selectedKeyframe: { clipId: 'clip-video', property: 'opacity', keyframeId: 'kf-2' },
    });
    act(() => {
      result.current.updateSelectedKeyframeExpression('time', '2.5');
    });
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(UpdateKeyframeCommand);
  });

  it('updateSelectedKeyframeExpression 解析 value 表达式', () => {
    const { result } = renderInspector({
      selectedKeyframe: { clipId: 'clip-video', property: 'opacity', keyframeId: 'kf-2' },
    });
    act(() => {
      result.current.updateSelectedKeyframeExpression('value', 'prev+0.25');
    });
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(UpdateKeyframeCommand);
  });

  it('updateSelectedKeyframeExpression 无选中时直接返回', () => {
    const { result } = renderInspector();
    act(() => {
      result.current.updateSelectedKeyframeExpression('time', '2');
    });
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('updateSelectedKeyframeExpression 非法表达式弹 toast', () => {
    const { result } = renderInspector({
      selectedKeyframe: { clipId: 'clip-video', property: 'opacity', keyframeId: 'kf-1' },
    });
    act(() => {
      result.current.updateSelectedKeyframeExpression('time', 'not-a-number-##');
    });
    expect(executeMock).not.toHaveBeenCalled();
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({ kind: 'warning' }));
  });

  it('updateCurveKeyframes 执行 BatchUpdateKeyframeCommand', () => {
    const { result } = renderInspector();
    act(() => {
      result.current.updateCurveKeyframes('opacity', [
        { id: 'kf-1', time: 0, value: 0, easing: 'linear' },
        { id: 'kf-2', time: 2, value: 1, easing: 'linear' },
      ]);
    });
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(BatchUpdateKeyframeCommand);
  });

  it('updateCurveKeyframes 失败时弹 toast', () => {
    executeMock.mockImplementation(() => {
      throw new Error('curve failed');
    });
    const { result } = renderInspector();
    act(() => {
      result.current.updateCurveKeyframes('opacity', []);
    });
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({ kind: 'warning', message: 'curve failed' }));
  });
});

describe('useClipInspectorState KenBurns 域', () => {
  it('setKenBurns 开启时生成关键帧', () => {
    const clip = makeImageClip();
    const { result } = renderInspector({ clip });
    act(() => {
      result.current.setKenBurns(true);
    });
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(UpdateClipCommand);
  });

  it('setKenBurns 关闭时提交 kenBurns:false', () => {
    const clip = makeImageClip({ kenBurns: true });
    const { result } = renderInspector({ clip });
    act(() => {
      result.current.setKenBurns(false);
    });
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(UpdateClipCommand);
  });

  it('setKenBurns 非 image clip 直接返回', () => {
    const { result } = renderInspector();
    act(() => {
      result.current.setKenBurns(true);
    });
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('updateKenBurnsEndScale 提交缩放关键帧', () => {
    const clip = makeImageClip({
      kenBurns: true,
      keyframes: {
        scaleX: [
          { id: 'kb-1', time: 0, value: 1, easing: 'linear' },
          { id: 'kb-2', time: 5, value: 1.5, easing: 'linear' },
        ],
        scaleY: [
          { id: 'kb-3', time: 0, value: 1, easing: 'linear' },
          { id: 'kb-4', time: 5, value: 1.5, easing: 'linear' },
        ],
      },
    });
    const { result } = renderInspector({ clip });
    act(() => {
      result.current.updateKenBurnsEndScale(2);
    });
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(UpdateClipCommand);
  });

  it('updateKenBurnsEndScale 非 image clip 直接返回', () => {
    const { result } = renderInspector();
    act(() => {
      result.current.updateKenBurnsEndScale(2);
    });
    expect(executeMock).not.toHaveBeenCalled();
  });
});

describe('useClipInspectorState 遮罩域', () => {
  it('addMask 执行 AddMaskCommand', () => {
    const { result } = renderInspector();
    act(() => {
      result.current.addMask();
    });
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(AddMaskCommand);
  });

  it('updateMask 执行 UpdateMaskCommand', () => {
    const { result } = renderInspector();
    act(() => {
      result.current.updateMask('mask-1', { x: 10 });
    });
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(UpdateMaskCommand);
  });

  it('removeMask 执行 RemoveMaskCommand', () => {
    const { result } = renderInspector();
    act(() => {
      result.current.removeMask('mask-1');
    });
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(RemoveMaskCommand);
  });

  it('runEffectCommand 命令失败时弹 toast', () => {
    executeMock.mockImplementation(() => {
      throw new Error('mask rejected');
    });
    const { result } = renderInspector();
    act(() => {
      result.current.addMask();
    });
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({ kind: 'warning', message: 'mask rejected' }));
  });
});

describe('useClipInspectorState 文本动画与排版域', () => {
  it('applyTextAnimation 对 text clip 执行 ApplyTextAnimationCommand', () => {
    const clip = makeTextClip();
    const { result } = renderInspector({ clip });
    act(() => {
      result.current.setTextAnimationPreset('slide-left');
    });
    act(() => {
      result.current.setTextAnimationDuration(1.2);
    });
    act(() => {
      result.current.setTextAnimationDirection('out');
    });
    act(() => {
      result.current.applyTextAnimation();
    });
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(ApplyTextAnimationCommand);
  });

  it('applyTextAnimation 非 text clip 直接返回', () => {
    const { result } = renderInspector();
    act(() => {
      result.current.applyTextAnimation();
    });
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('updateTextPath 对 text clip 提交 pathText', () => {
    const clip = makeTextClip({
      pathText: { enabled: true, path: [], startOffset: 0, letterSpacing: 0, rotateCharacters: false },
    });
    const { result } = renderInspector({ clip });
    act(() => {
      result.current.updateTextPath({ startOffset: 20 });
    });
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(UpdateClipCommand);
  });

  it('updateTextPath 非 text clip 直接返回', () => {
    const { result } = renderInspector();
    act(() => {
      result.current.updateTextPath({ startOffset: 20 });
    });
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('updateTextLayout 提交布局选项', () => {
    const clip = makeTextClip();
    const { result } = renderInspector({ clip });
    act(() => {
      result.current.updateTextLayout({ boxWidth: 320 });
    });
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(UpdateClipCommand);
  });

  it('updateTextArc 提交弧形文本选项', () => {
    const clip = makeTextClip({
      arcText: { enabled: true, radius: 100, startAngle: 90, clockwise: true, rotateCharacters: false },
    });
    const { result } = renderInspector({ clip });
    act(() => {
      result.current.updateTextArc({ startAngle: 120 });
    });
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(UpdateClipCommand);
  });

  it('updateTextOpenTypeFeatures 提交字体特性', () => {
    const clip = makeTextClip();
    const { result } = renderInspector({ clip });
    act(() => {
      result.current.updateTextOpenTypeFeatures({ liga: true });
    });
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(UpdateClipCommand);
  });

  it('text 系列更新在非 text clip 上均直接返回', () => {
    const { result } = renderInspector();
    act(() => {
      result.current.updateTextLayout({ boxWidth: 320 });
    });
    act(() => {
      result.current.updateTextArc({ startAngle: 120 });
    });
    act(() => {
      result.current.updateTextOpenTypeFeatures({ liga: true });
    });
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('audio clip 不提供 textPath/textLayout 计算值', () => {
    const clip = makeAudioClip();
    const { result } = renderInspector({ clip });
    expect(result.current.textPath).toBeUndefined();
    expect(result.current.textLayout).toBeUndefined();
    expect(result.current.textArc).toBeUndefined();
    expect(result.current.textOpenTypeFeatures).toBeUndefined();
  });
});

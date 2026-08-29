// @vitest-environment jsdom
// 覆盖目标：apps/desktop/src/components/Timeline/hooks/timeline/ai-features.ts（视觉 AI 部分）
// 覆盖 handler：openSceneDetection / startSceneDetection / cancelCurrentSceneDetection /
//   applySceneDetectionResult / openCoverFrameGeneration / applyProjectCoverFrame /
//   handleAiReframe / applyAiReframe / handleAiTransitionRecommend / applyAiTransition /
//   handleAnomalyDetect / removeAnomaly
import {describe, expect, it, vi, beforeEach} from 'vitest';

const {
  executeMock,
  showToastMock,
  detectSceneChangesMock,
  cancelSceneDetectionMock,
  extractCoverFramesMock,
  listenBridgeMock,
  listenCoverFrameProgressMock,
} = vi.hoisted(() => ({
  executeMock: vi.fn(),
  showToastMock: vi.fn(),
  detectSceneChangesMock: vi.fn(),
  cancelSceneDetectionMock: vi.fn(),
  extractCoverFramesMock: vi.fn(),
  listenBridgeMock: vi.fn(async (_event: string, _handler: (payload: unknown) => void) => () => {}),
  listenCoverFrameProgressMock: vi.fn(async (_handler: (payload: unknown) => void) => () => {}),
}));

vi.mock('../../../../../store/commandManager', () => ({
  commandManager: {execute: (command: unknown) => executeMock(command)},
  projectAccessor: {getProject: vi.fn(), setProject: vi.fn()},
  timelineAccessor: {getTimeline: vi.fn(), setTimeline: vi.fn()},
  setEditorStoreGetter: vi.fn(),
  addOnExecuteListener: vi.fn(),
}));

vi.mock('../../../../../store/editorStore', () => ({
  useEditorStore: {getState: () => ({project: {timeline: {tracks: []}}})},
}));

vi.mock('../../../../../store/whisperSettingsStore', () => ({
  useWhisperSettingsStore: {getState: () => ({})},
}));

vi.mock('../../../../../lib/toast', () => ({
  showToast: (toast: unknown) => showToastMock(toast),
}));

vi.mock('../../../../../lib/whisper', () => ({
  canGenerateSubtitlesForClip: vi.fn().mockReturnValue(true),
  buildWhisperSubtitleTrackForClip: vi.fn(),
  getWhisperAvailability: vi.fn(async () => ({ready: true})),
}));

vi.mock('../../../../../lib/dialogueDetection', () => ({
  detectClipDialogue: vi.fn(async () => []),
}));

vi.mock('../../../../../lib/ttsVoiceover', () => ({
  generateTtsVoiceover: vi.fn(async () => undefined),
  collectSubtitleClipsForTts: vi.fn(() => []),
}));

vi.mock('../../../../../lib/tauri-bridge', () => ({
  analyzeWaveform: vi.fn(async () => []),
  cancelSceneDetection: (...args: unknown[]) => cancelSceneDetectionMock(...args),
  detectSceneChanges: (...args: unknown[]) => detectSceneChangesMock(...args),
  extractCoverFrames: (...args: unknown[]) => extractCoverFramesMock(...args),
  getAppDataDir: vi.fn(async () => 'D:/AppData'),
  listenBridge: (event: string, handler: (payload: unknown) => void) => listenBridgeMock(event, handler),
  listenCoverFrameProgress: (handler: (payload: unknown) => void) => listenCoverFrameProgressMock(handler),
}));

vi.mock('../../../../../media/background-media-task-queue', () => ({
  runUiFeedbackTask: (task: () => unknown) => task(),
}));

import {createAiFeatureHandlers} from '../ai-features';
import {makeAsset, makeClip, makeParams, makeProject, makeTrack} from './test-fixtures';
import {
  AddTransitionCommand,
  BatchAddMarkersCommand,
  BatchSplitAtSceneCutsCommand,
  RippleDeleteCommand,
  UpdateClipCommand,
  UpdateProjectBookmarksCommand,
  UpdateProjectCoverCommand,
} from '@open-factory/editor-core';

function visualSetup(options: {
  clipOverrides?: Record<string, unknown>;
  sceneDialog?: Record<string, unknown>;
  clips?: ReturnType<typeof makeClip>[];
  assetOverrides?: Record<string, unknown>;
} = {}) {
  const clip = makeClip({id: 'clip-a', type: 'video', duration: 10, ...(options.clipOverrides ?? {})});
  const asset = makeAsset({type: 'video', duration: 10, ...(options.assetOverrides ?? {})});
  const clips = options.clips ?? [clip];
  const project = makeProject({tracks: [makeTrack({id: 'track-1', clips})], media: [asset]});
  const params = makeParams({project});
  if (options.sceneDialog !== undefined) {
    Object.assign(params, {sceneDialog: options.sceneDialog});
  }
  const handlers = createAiFeatureHandlers(params, {
    findClip: (id) => clips.find((item) => item.id === id) ?? clip,
    getClipMediaAsset: () => asset,
  });
  return {params, handlers, clip, asset};
}

function makeSceneDialog(overrides: Record<string, unknown> = {}) {
  return {
    clip: makeClip({id: 'clip-a', type: 'video', duration: 10}),
    asset: makeAsset({type: 'video', duration: 10}),
    status: 'ready',
    threshold: 10,
    progress: 0,
    scenecuts: [1, 3],
    filterShortScenes: false,
    minSceneSeconds: 1,
    splitAtCuts: true,
    addMarkers: false,
    syncChapters: false,
    ...overrides,
  };
}

beforeEach(() => {
  executeMock.mockReset();
  showToastMock.mockReset();
  detectSceneChangesMock.mockReset().mockResolvedValue({sceneTimes: [1, 3], limited: false});
  cancelSceneDetectionMock.mockReset().mockResolvedValue(undefined);
  extractCoverFramesMock.mockReset().mockResolvedValue({frames: [{path: 'D:/covers/f1.png'}]});
  listenBridgeMock.mockClear();
  listenCoverFrameProgressMock.mockClear();
});

describe('createAiFeatureHandlers — 场景检测', () => {
  it('openSceneDetection 非 video clip 时 toast 警告', () => {
    const clip = makeClip({id: 'clip-a', type: 'audio'});
    const params = makeParams({project: makeProject({tracks: [makeTrack({clips: [clip]})]})});
    const handlers = createAiFeatureHandlers(params, {
      findClip: () => clip,
      getClipMediaAsset: () => makeAsset({type: 'audio'}),
    });
    handlers.openSceneDetection('clip-a');
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({kind: 'warning'}));
    expect(params.setters.setSceneDialog).not.toHaveBeenCalled();
  });

  it('openSceneDetection video clip 打开对话框并带默认参数', () => {
    const {params, handlers, clip, asset} = visualSetup();
    handlers.openSceneDetection('clip-a');
    expect(params.setters.setClipMenu).toHaveBeenCalledWith(undefined);
    expect(params.setters.setSelectedClipId).toHaveBeenCalledWith('clip-a');
    expect(params.setters.setSceneDialog).toHaveBeenCalledWith(
      expect.objectContaining({clip, asset, status: 'ready', threshold: 10, splitAtCuts: true}),
    );
  });

  it('startSceneDetection 无对话框时直接返回', async () => {
    const {handlers} = visualSetup();
    await handlers.startSceneDetection();
    expect(detectSceneChangesMock).not.toHaveBeenCalled();
  });

  it('startSceneDetection 运行中时直接返回', async () => {
    const {handlers} = visualSetup({sceneDialog: makeSceneDialog({status: 'running'})});
    await handlers.startSceneDetection();
    expect(detectSceneChangesMock).not.toHaveBeenCalled();
  });

  it('startSceneDetection 成功时执行 UpdateClipCommand 写入相对场景点', async () => {
    const {params, handlers} = visualSetup({sceneDialog: makeSceneDialog()});
    await handlers.startSceneDetection();
    expect(listenBridgeMock).toHaveBeenCalledWith('scene-detect-progress', expect.any(Function));
    expect(detectSceneChangesMock).toHaveBeenCalledWith(
      expect.objectContaining({threshold: 10, frameRate: 30}),
    );
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(UpdateClipCommand);
    // setSceneDialog 先置 running 后置 complete（均为函数式更新）
    expect(params.setters.setSceneDialog).toHaveBeenCalledWith(expect.any(Function));
    expect(showToastMock).not.toHaveBeenCalled();
  });

  it('startSceneDetection 无场景点时 toast 提示', async () => {
    detectSceneChangesMock.mockResolvedValue({sceneTimes: [], limited: false});
    const {handlers} = visualSetup({sceneDialog: makeSceneDialog()});
    await handlers.startSceneDetection();
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({kind: 'info'}));
  });

  it('startSceneDetection 取消时复位为 ready 且不弹错误', async () => {
    detectSceneChangesMock.mockRejectedValue(new Error('Scene detection canceled'));
    const {handlers} = visualSetup({sceneDialog: makeSceneDialog()});
    await handlers.startSceneDetection();
    expect(showToastMock).not.toHaveBeenCalled();
  });

  it('startSceneDetection 失败时 toast 错误并复位', async () => {
    detectSceneChangesMock.mockRejectedValue(new Error('ffmpeg failed'));
    const {handlers} = visualSetup({sceneDialog: makeSceneDialog()});
    await handlers.startSceneDetection();
    expect(showToastMock).toHaveBeenCalledWith(
      expect.objectContaining({kind: 'error', message: 'ffmpeg failed'}),
    );
  });

  it('cancelCurrentSceneDetection 无 taskId 时直接关闭对话框', async () => {
    const {params, handlers} = visualSetup({sceneDialog: makeSceneDialog()});
    await handlers.cancelCurrentSceneDetection();
    expect(cancelSceneDetectionMock).not.toHaveBeenCalled();
    expect(params.setters.setSceneDialog).toHaveBeenCalledWith(undefined);
  });

  it('cancelCurrentSceneDetection 有 taskId 时调用取消并复位状态', async () => {
    const {params, handlers} = visualSetup({
      sceneDialog: makeSceneDialog({taskId: 'scene-task-1', status: 'running'}),
    });
    await handlers.cancelCurrentSceneDetection();
    expect(cancelSceneDetectionMock).toHaveBeenCalledWith('scene-task-1');
    expect(params.setters.setSceneDialog).toHaveBeenCalledWith(expect.any(Function));
  });

  it('cancelCurrentSceneDetection 取消失败时 toast 警告但仍然复位', async () => {
    cancelSceneDetectionMock.mockRejectedValue(new Error('cancel rejected'));
    const {params, handlers} = visualSetup({
      sceneDialog: makeSceneDialog({taskId: 'scene-task-1', status: 'running'}),
    });
    await handlers.cancelCurrentSceneDetection();
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({kind: 'warning'}));
    expect(params.setters.setSceneDialog).toHaveBeenCalledWith(expect.any(Function));
  });

  it('applySceneDetectionResult 无对话框时直接返回', () => {
    const {handlers} = visualSetup();
    handlers.applySceneDetectionResult();
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('applySceneDetectionResult 场景点为空时 toast 提示且不执行命令', () => {
    const {handlers} = visualSetup({sceneDialog: makeSceneDialog({scenecuts: []})});
    handlers.applySceneDetectionResult();
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({kind: 'info'}));
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('applySceneDetectionResult splitAtCuts 时执行 BatchSplitAtSceneCutsCommand', () => {
    const {params, handlers} = visualSetup({sceneDialog: makeSceneDialog()});
    handlers.applySceneDetectionResult();
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(BatchSplitAtSceneCutsCommand);
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({kind: 'success'}));
    expect(params.setters.setSceneDialog).toHaveBeenCalledWith(undefined);
  });

  it('applySceneDetectionResult addMarkers 时执行 BatchAddMarkersCommand', () => {
    const {handlers} = visualSetup({
      sceneDialog: makeSceneDialog({addMarkers: true, splitAtCuts: false}),
    });
    handlers.applySceneDetectionResult();
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(BatchAddMarkersCommand);
  });

  it('applySceneDetectionResult syncChapters 时执行 UpdateProjectBookmarksCommand', () => {
    const {handlers} = visualSetup({
      sceneDialog: makeSceneDialog({syncChapters: true, splitAtCuts: false}),
    });
    handlers.applySceneDetectionResult();
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(UpdateProjectBookmarksCommand);
  });

  it('applySceneDetectionResult 命令抛错时 toast 警告', () => {
    executeMock.mockImplementation(() => {
      throw new Error('split rejected');
    });
    const {handlers} = visualSetup({sceneDialog: makeSceneDialog()});
    handlers.applySceneDetectionResult();
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({kind: 'warning'}));
  });
});

describe('createAiFeatureHandlers — 封面帧', () => {
  it('openCoverFrameGeneration 非 video clip 时 toast 警告', async () => {
    const clip = makeClip({id: 'clip-a', type: 'audio'});
    const params = makeParams({project: makeProject({tracks: [makeTrack({clips: [clip]})]})});
    const handlers = createAiFeatureHandlers(params, {
      findClip: () => clip,
      getClipMediaAsset: () => makeAsset({type: 'audio'}),
    });
    await handlers.openCoverFrameGeneration('clip-a');
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({kind: 'warning'}));
    expect(params.setters.setCoverFrameDialog).not.toHaveBeenCalled();
  });

  it('openCoverFrameGeneration 成功时写入帧与完成进度', async () => {
    const {params, handlers, clip} = visualSetup();
    await handlers.openCoverFrameGeneration('clip-a');
    expect(listenCoverFrameProgressMock).toHaveBeenCalled();
    expect(extractCoverFramesMock).toHaveBeenCalledWith(
      expect.objectContaining({clipId: 'clip-a', mode: 'interval', count: 6}),
    );
    expect(params.setters.setCoverFrameDialog).toHaveBeenLastCalledWith({
      clip,
      frames: [{path: 'D:/covers/f1.png'}],
      progress: 1,
      loading: false,
    });
  });

  it('openCoverFrameGeneration 帧为空时置错误状态', async () => {
    extractCoverFramesMock.mockResolvedValue({frames: []});
    const {params, handlers} = visualSetup();
    await handlers.openCoverFrameGeneration('clip-a');
    expect(params.setters.setCoverFrameDialog).toHaveBeenLastCalledWith(
      expect.objectContaining({frames: [], progress: 1, loading: false}),
    );
  });

  it('openCoverFrameGeneration 抛错时置错误信息', async () => {
    extractCoverFramesMock.mockRejectedValue(new Error('extract failed'));
    const {params, handlers} = visualSetup();
    await handlers.openCoverFrameGeneration('clip-a');
    expect(params.setters.setCoverFrameDialog).toHaveBeenLastCalledWith(
      expect.objectContaining({loading: false, error: 'extract failed'}),
    );
  });

  it('applyProjectCoverFrame 执行 UpdateProjectCoverCommand 并记录选择', () => {
    const {params, handlers} = visualSetup({sceneDialog: makeSceneDialog()});
    handlers.applyProjectCoverFrame({path: 'D:/covers/f1.png'} as never);
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(UpdateProjectCoverCommand);
    expect(params.setters.setCoverFrameDialog).toHaveBeenCalledWith(expect.any(Function));
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({kind: 'success'}));
  });
});

describe('createAiFeatureHandlers — AI 智能重构图', () => {
  it('handleAiReframe 非 video clip 时 toast 警告', () => {
    const clip = makeClip({id: 'clip-a', type: 'audio'});
    const params = makeParams({project: makeProject({tracks: [makeTrack({clips: [clip]})]})});
    const handlers = createAiFeatureHandlers(params, {
      findClip: () => clip,
      getClipMediaAsset: () => makeAsset({type: 'audio'}),
    });
    handlers.handleAiReframe('clip-a');
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({kind: 'warning'}));
    expect(params.setters.setReframeDialog).not.toHaveBeenCalled();
  });

  it('handleAiReframe video clip 打开重构图对话框', () => {
    const {params, handlers} = visualSetup();
    handlers.handleAiReframe('clip-a');
    expect(params.setters.setReframeDialog).toHaveBeenCalledWith({clipId: 'clip-a'});
    expect(params.setters.setClipMenu).toHaveBeenCalledWith(undefined);
  });

  it('applyAiReframe 无资产时直接返回', () => {
    const clip = makeClip({id: 'clip-a', type: 'video'});
    const params = makeParams({project: makeProject({tracks: [makeTrack({clips: [clip]})]})});
    const handlers = createAiFeatureHandlers(params, {
      findClip: () => clip,
      getClipMediaAsset: () => undefined,
    });
    handlers.applyAiReframe('clip-a', '9:16');
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('applyAiReframe 生成关键帧并执行 UpdateClipCommand', () => {
    const {params, handlers} = visualSetup();
    handlers.applyAiReframe('clip-a', '9:16');
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(UpdateClipCommand);
    expect(params.setters.setReframeDialog).toHaveBeenCalledWith(undefined);
  });
});

describe('createAiFeatureHandlers — AI 转场推荐', () => {
  it('handleAiTransitionRecommend 非 video clip 直接返回', () => {
    const clip = makeClip({id: 'clip-a', type: 'audio'});
    const params = makeParams({project: makeProject({tracks: [makeTrack({clips: [clip]})]})});
    const handlers = createAiFeatureHandlers(params, {
      findClip: () => clip,
      getClipMediaAsset: () => makeAsset({type: 'audio'}),
    });
    handlers.handleAiTransitionRecommend('clip-a');
    expect(params.setters.setTransitionDialog).not.toHaveBeenCalled();
  });

  it('handleAiTransitionRecommend 无相邻 video clip 直接返回', () => {
    const {params, handlers} = visualSetup();
    handlers.handleAiTransitionRecommend('clip-a');
    expect(params.setters.setTransitionDialog).not.toHaveBeenCalled();
  });

  it('handleAiTransitionRecommend 有相邻 clip 时打开推荐对话框', () => {
    const clipA = makeClip({id: 'clip-a', type: 'video', start: 0, duration: 5});
    const clipB = makeClip({id: 'clip-b', type: 'video', start: 5, duration: 5});
    const {params, handlers} = visualSetup({clips: [clipA, clipB]});
    handlers.handleAiTransitionRecommend('clip-a');
    expect(params.setters.setTransitionDialog).toHaveBeenCalledWith({
      clipId: 'clip-a',
      adjacentClipId: 'clip-b',
      recommendations: expect.any(Array),
    });
  });

  it('applyAiTransition 相邻 clip 不匹配时直接返回', () => {
    const clipA = makeClip({id: 'clip-a', type: 'video', start: 0, duration: 5});
    const clipB = makeClip({id: 'clip-b', type: 'video', start: 5, duration: 5});
    const {handlers} = visualSetup({clips: [clipA, clipB]});
    handlers.applyAiTransition('clip-a', 'clip-other', {transitionType: 'crossfade', duration: 0.5} as never);
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('applyAiTransition 成功时执行 AddTransitionCommand 并关闭对话框', () => {
    const clipA = makeClip({id: 'clip-a', type: 'video', start: 0, duration: 5});
    const clipB = makeClip({id: 'clip-b', type: 'video', start: 5, duration: 5});
    const {params, handlers} = visualSetup({clips: [clipA, clipB]});
    handlers.applyAiTransition('clip-a', 'clip-b', {transitionType: 'crossfade', duration: 0.5} as never);
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(AddTransitionCommand);
    expect(params.setters.setTransitionDialog).toHaveBeenCalledWith(undefined);
  });
});

describe('createAiFeatureHandlers — 异常检测', () => {
  it('handleAnomalyDetect 非 video clip 直接返回', () => {
    const clip = makeClip({id: 'clip-a', type: 'audio'});
    const params = makeParams({project: makeProject({tracks: [makeTrack({clips: [clip]})]})});
    const handlers = createAiFeatureHandlers(params, {
      findClip: () => clip,
      getClipMediaAsset: () => makeAsset({type: 'audio'}),
    });
    handlers.handleAnomalyDetect('clip-a');
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('handleAnomalyDetect 写入检测结果并 toast 反馈', () => {
    const {handlers} = visualSetup({clipOverrides: {duration: 16}});
    handlers.handleAnomalyDetect('clip-a');
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(UpdateClipCommand);
    expect(showToastMock).toHaveBeenCalledTimes(1);
  });

  it('handleAnomalyDetect 无异常时 toast 成功', () => {
    const {handlers} = visualSetup({clipOverrides: {duration: 2}});
    handlers.handleAnomalyDetect('clip-a');
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(UpdateClipCommand);
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({kind: 'success'}));
  });

  it('removeAnomaly 目标不在列表时直接返回', () => {
    const {handlers} = visualSetup({
      clipOverrides: {anomalies: [{startTime: 2, endTime: 4, type: 'black'}]},
    });
    handlers.removeAnomaly('clip-a', {startTime: 8, endTime: 9, type: 'static'} as never);
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('removeAnomaly 黑场异常触发 RippleDeleteCommand', () => {
    const {handlers} = visualSetup({
      clipOverrides: {anomalies: [{startTime: 2, endTime: 4, type: 'black'}]},
    });
    handlers.removeAnomaly('clip-a', {startTime: 2, endTime: 4, type: 'black'} as never);
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(RippleDeleteCommand);
  });

  it('removeAnomaly 静帧异常写入剩余异常列表', () => {
    const {handlers} = visualSetup({
      clipOverrides: {
        anomalies: [
          {startTime: 2, endTime: 4, type: 'black'},
          {startTime: 8, endTime: 9, type: 'static'},
        ],
      },
    });
    handlers.removeAnomaly('clip-a', {startTime: 8, endTime: 9, type: 'static'} as never);
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(UpdateClipCommand);
  });
});

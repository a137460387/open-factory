// @vitest-environment jsdom
// 源文件：apps/desktop/src/components/Inspector/useClipInspectorState.ts
// 覆盖目标：字幕/CC/说话人库/样式模板/字幕翻译功能域
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  AddSubtitleClipCommand,
  AddTrackCommand,
  UpdateClipCommand,
  UpdateProjectSpeakersCommand,
  UpdateSubtitleStyleCommand,
  UpdateTrackCommand,
} from '@open-factory/editor-core';
import { useClipInspectorState } from '../useClipInspectorState';
import {DEFAULT_SUBTITLE_STYLE} from '@open-factory/editor-core';
import {
  makeAudioClip,
  makeInspectorProject,
  makeProjectSettings,
  makeSubtitleClip,
  makeTrack,
} from './inspector-fixtures';
import type {Project} from '@open-factory/editor-core';

const {
  executeMock,
  showToastMock,
  loadTemplatesMock,
  loadSharedTemplatesMock,
  saveTemplateMock,
  deleteTemplateMock,
  addSharedResourceMock,
  toSharedResourceMock,
  translateItemsMock,
  toTranslationItemsMock,
  acceptTosMock,
  isConfiguredMock,
  bridgeConfirmMock,
  openFileDialogMock,
  readFileMock,
  editorStoreState,
  translationStoreState,
  privacyStoreState,
} = vi.hoisted(() => ({
  executeMock: vi.fn(),
  showToastMock: vi.fn(),
  loadTemplatesMock: vi.fn(() => Promise.resolve([])),
  loadSharedTemplatesMock: vi.fn(() => Promise.resolve([])),
  saveTemplateMock: vi.fn(),
  deleteTemplateMock: vi.fn(),
  addSharedResourceMock: vi.fn(),
  toSharedResourceMock: vi.fn(),
  translateItemsMock: vi.fn(),
  toTranslationItemsMock: vi.fn(),
  acceptTosMock: vi.fn(),
  isConfiguredMock: vi.fn(() => false),
  bridgeConfirmMock: vi.fn(),
  openFileDialogMock: vi.fn(),
  readFileMock: vi.fn(),
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
  isTranslationConfigured: isConfiguredMock,
}));
vi.mock('../../../store/privacyDetectionSettingsStore', () => ({
  usePrivacyDetectionSettingsStore: (selector: (state: typeof privacyStoreState) => unknown) =>
    selector(privacyStoreState),
}));
vi.mock('../../../lib/tauri-bridge', () => ({
  bridgeConfirm: bridgeConfirmMock,
  openFileDialog: openFileDialogMock,
  readFile: readFileMock,
  listenBridge: vi.fn(() => Promise.resolve(() => {})),
  getFfmpegCapabilities: vi.fn(() =>
    Promise.resolve({available: true, hasMinterpolate: true, hasArnndn: true}),
  ),
  getAppDataDir: vi.fn(() => Promise.resolve('D:/appdata')),
  convertLocalFileSrc: vi.fn((path: string) => `asset://${path}`),
  runExportPreviewSamples: vi.fn(() => Promise.resolve({samples: []})),
  analyzeClip: vi.fn(),
  analyzeMotionTrack: vi.fn(),
  cancelMotionTracking: vi.fn(),
  detectPrivacyRegions: vi.fn(),
  evaluateExportQuality: vi.fn(),
}));
vi.mock('../../../lib/toast', () => ({showToast: showToastMock}));
vi.mock('../../../lib/subtitleStyleTemplates', () => ({
  loadSubtitleStyleTemplates: loadTemplatesMock,
  saveCustomSubtitleStyleTemplate: saveTemplateMock,
  deleteCustomSubtitleStyleTemplate: deleteTemplateMock,
}));
vi.mock('../../../shared-library/sharedLibrary', () => ({
  addSharedLibraryResource: addSharedResourceMock,
  loadSharedSubtitleStyleTemplates: loadSharedTemplatesMock,
  subtitleStyleTemplateToSharedResource: toSharedResourceMock,
}));
vi.mock('../../../lib/subtitleTranslation', () => ({
  acceptTranslationTOS: acceptTosMock,
  subtitleClipsToTranslationItems: toTranslationItemsMock,
  translateSubtitleItems: translateItemsMock,
}));
vi.mock('../../../lib/frameInterpolationComparePreview', () => ({
  buildFrameInterpolationComparePreviewPlan: vi.fn(() => ({samples: [], items: []})),
  FRAME_INTERPOLATION_COMPARE_TIMEOUT_MS: 60000,
}));
vi.mock('../../../lib/colorMatch', () => ({buildClipColorMatchCurves: vi.fn()}));
vi.mock('../../../settings/appSettings', () => ({markLocalAiModelUsed: vi.fn()}));
vi.mock('../../../media/pitchAnalysis', () => ({
  analyzeClipPitch: vi.fn(),
  exportClipPitchCsv: vi.fn(),
}));
vi.mock('../InspectorEditors', () => ({
  buildAudioRestorationPreviewPeaks: vi.fn(() => []),
  mergeSubtitleStyleTemplateViews: vi.fn((a: unknown[], b: unknown[]) => [...a, ...b]),
  getSubtitleStyleTemplateLabel: vi.fn((t: {name: string}) => t.name),
  resolveSelectedKeyframeEntries: vi.fn(() => []),
  joinLocalPath: vi.fn((base: string, child: string) => `${base}/${child}`),
}));

/** 统一 renderHook 入口：注入 editorStoreState.project 并渲染 hook */
function renderInspector(clip: Parameters<typeof useClipInspectorState>[0]['clip'], trackOverrides?: Project['timeline']['tracks']) {
  const fallbackTrack = makeTrack({id: clip.trackId, type: 'subtitle', clips: [clip]});
  editorStoreState.project = makeInspectorProject({
    tracks: trackOverrides ?? [fallbackTrack],
    speakers: [],
  });
  return renderHook(() =>
    useClipInspectorState({
      clip,
      selectedClipLocked: false,
      media: [],
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
    saveTemplateMock,
    deleteTemplateMock,
    addSharedResourceMock,
    toSharedResourceMock,
    translateItemsMock,
    toTranslationItemsMock,
    acceptTosMock,
    bridgeConfirmMock,
    openFileDialogMock,
    readFileMock,
  ].forEach((mock) => mock.mockReset());
  loadTemplatesMock.mockReturnValue(Promise.resolve([]));
  loadSharedTemplatesMock.mockReturnValue(Promise.resolve([]));
  isConfiguredMock.mockReturnValue(false);
});

describe('useClipInspectorState 字幕类型与 CC 域', () => {
  it('subtitleType 优先取 clip.subtitleType', () => {
    const clip = makeSubtitleClip({subtitleType: 'cc'});
    const {result} = renderInspector(clip);
    expect(result.current.subtitleType).toBe('cc');
  });

  it('subtitleType 回退到轨道配置', () => {
    const clip = makeSubtitleClip({trackId: 'track-cc'});
    const track = makeTrack({id: 'track-cc', type: 'subtitle', subtitleType: 'cc', clips: [clip]});
    const {result} = renderInspector(clip, [track]);
    expect(result.current.subtitleType).toBe('cc');
  });

  it('subtitleType 默认 subtitle', () => {
    const {result} = renderInspector(makeSubtitleClip());
    expect(result.current.subtitleType).toBe('subtitle');
  });

  it('非 subtitle clip 的 subtitleType 固定 subtitle', () => {
    const clip = makeAudioClip();
    const {result} = renderInspector(clip, [makeTrack({clips: [clip]})]);
    expect(result.current.subtitleType).toBe('subtitle');
  });

  it('soundDescSelectValue：选项内的值原样返回', () => {
    const probe = renderInspector(makeSubtitleClip());
    const option = probe.result.current.soundDescriptionOptions[0];
    probe.unmount();
    const clip = makeSubtitleClip({soundDesc: option});
    const {result} = renderInspector(clip);
    expect(result.current.soundDescSelectValue).toBe(option);
  });

  it('soundDescSelectValue：自定义值返回 custom', () => {
    const clip = makeSubtitleClip({soundDesc: '非预置描述'});
    const {result} = renderInspector(clip);
    expect(result.current.soundDescSelectValue).toBe('custom');
  });

  it('soundDescSelectValue：无值返回空串', () => {
    const {result} = renderInspector(makeSubtitleClip());
    expect(result.current.soundDescSelectValue).toBe('');
  });

  it('commitSubtitleType 切到 cc 时保留 speaker/soundDesc 并更新轨道', () => {
    const clip = makeSubtitleClip({subtitleType: 'subtitle', speaker: 'Alice', soundDesc: '描述'});
    const {result} = renderInspector(clip);
    act(() => {
      result.current.commitSubtitleType('cc');
    });
    expect(executeMock).toHaveBeenCalledTimes(2);
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(UpdateClipCommand);
    expect(executeMock.mock.calls[1][0]).toBeInstanceOf(UpdateTrackCommand);
  });

  it('commitSubtitleType 切回 subtitle 时清空 speaker/soundDesc', () => {
    const clip = makeSubtitleClip({subtitleType: 'cc', speaker: 'Alice', soundDesc: '描述'});
    const {result} = renderInspector(clip);
    act(() => {
      result.current.commitSubtitleType('subtitle');
    });
    expect(executeMock).toHaveBeenCalledTimes(2);
    expect(showToastMock).not.toHaveBeenCalled();
  });

  it('commitSubtitleType 非 subtitle clip 直接返回', () => {
    const clip = makeAudioClip();
    const {result} = renderInspector(clip, [makeTrack({clips: [clip]})]);
    act(() => {
      result.current.commitSubtitleType('cc');
    });
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('commitSubtitleType 命令失败时弹 toast', () => {
    executeMock.mockImplementation(() => {
      throw new Error('rejected');
    });
    const {result} = renderInspector(makeSubtitleClip());
    act(() => {
      result.current.commitSubtitleType('cc');
    });
    expect(showToastMock).toHaveBeenCalledWith(
      expect.objectContaining({kind: 'warning', message: 'rejected'}),
    );
  });

  it('commitCcSpeaker 轨道非 cc 时补发 UpdateTrackCommand', () => {
    const clip = makeSubtitleClip({trackId: 'track-plain'});
    const track = makeTrack({id: 'track-plain', type: 'subtitle', clips: [clip]});
    const {result} = renderInspector(clip, [track]);
    act(() => {
      result.current.commitCcSpeaker('Bob');
    });
    expect(executeMock).toHaveBeenCalledTimes(2);
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(UpdateClipCommand);
    expect(executeMock.mock.calls[1][0]).toBeInstanceOf(UpdateTrackCommand);
  });

  it('commitCcSpeaker 轨道已是 cc 时不重复更新轨道', () => {
    const clip = makeSubtitleClip({trackId: 'track-cc'});
    const track = makeTrack({id: 'track-cc', type: 'subtitle', subtitleType: 'cc', clips: [clip]});
    const {result} = renderInspector(clip, [track]);
    act(() => {
      result.current.commitCcSpeaker('Bob');
    });
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(UpdateClipCommand);
  });

  it('commitCcSoundDesc 提交声音描述并补轨道更新', () => {
    const {result} = renderInspector(makeSubtitleClip());
    act(() => {
      result.current.commitCcSoundDesc('音乐');
    });
    expect(executeMock).toHaveBeenCalledTimes(2);
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(UpdateClipCommand);
    expect(executeMock.mock.calls[1][0]).toBeInstanceOf(UpdateTrackCommand);
  });
});

describe('useClipInspectorState 说话人库域', () => {
  function renderWithSpeakers(clip: Parameters<typeof useClipInspectorState>[0]['clip'], speakers: Project['speakers']) {
    const track = makeTrack({id: clip.trackId, type: 'subtitle', clips: [clip]});
    editorStoreState.project = makeInspectorProject({tracks: [track], speakers});
    return renderHook(() =>
      useClipInspectorState({
        clip,
        selectedClipLocked: false,
        media: [],
        playheadTime: 0,
        projectSettings: makeProjectSettings(),
        selectedSubtitleClips: [],
      }),
    );
  }

  it('activeSpeaker 取自 clip.speaker 并匹配说话人条目', () => {
    const clip = makeSubtitleClip({speaker: 'Alice'});
    const {result} = renderWithSpeakers(clip, [{id: 'speaker-1', name: 'Alice', color: '#ff0000'}]);
    expect(result.current.activeSpeaker).toBe('Alice');
    expect(result.current.activeSpeakerEntry?.id).toBe('speaker-1');
    expect(result.current.projectSpeakers).toHaveLength(1);
  });

  it('updateProjectSpeakers 执行 UpdateProjectSpeakersCommand', () => {
    const {result} = renderWithSpeakers(makeSubtitleClip(), []);
    act(() => {
      result.current.updateProjectSpeakers([{id: 'speaker-1', name: 'Alice'}]);
    });
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(UpdateProjectSpeakersCommand);
  });

  it('updateProjectSpeakers 失败时弹 toast', () => {
    executeMock.mockImplementation(() => {
      throw new Error('speakers rejected');
    });
    const {result} = renderWithSpeakers(makeSubtitleClip(), []);
    act(() => {
      result.current.updateProjectSpeakers([]);
    });
    expect(showToastMock).toHaveBeenCalledWith(
      expect.objectContaining({kind: 'warning', message: 'speakers rejected'}),
    );
  });

  it('addActiveSpeakerToLibrary 无 speaker 时直接返回', () => {
    const {result} = renderWithSpeakers(makeSubtitleClip(), []);
    act(() => {
      result.current.addActiveSpeakerToLibrary();
    });
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('addActiveSpeakerToLibrary 添加当前说话人（去重）', () => {
    const clip = makeSubtitleClip({speaker: 'Alice'});
    const {result} = renderWithSpeakers(clip, [{id: 'speaker-1', name: 'Bob'}]);
    act(() => {
      result.current.addActiveSpeakerToLibrary();
    });
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(UpdateProjectSpeakersCommand);
  });

  it('addActiveSpeakerToLibrary 已存在同名说话人时不重复添加', () => {
    const clip = makeSubtitleClip({speaker: 'Alice'});
    const {result} = renderWithSpeakers(clip, [{id: 'speaker-1', name: 'Alice'}]);
    act(() => {
      result.current.addActiveSpeakerToLibrary();
    });
    expect(executeMock).toHaveBeenCalledTimes(1);
  });

  it('removeActiveSpeakerFromLibrary 移除匹配条目', () => {
    const clip = makeSubtitleClip({speaker: 'Alice'});
    const {result} = renderWithSpeakers(clip, [
      {id: 'speaker-1', name: 'Alice'},
      {id: 'speaker-2', name: 'Bob'},
    ]);
    act(() => {
      result.current.removeActiveSpeakerFromLibrary();
    });
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(UpdateProjectSpeakersCommand);
  });

  it('removeActiveSpeakerFromLibrary 无匹配条目时直接返回', () => {
    const clip = makeSubtitleClip({speaker: 'Unknown'});
    const {result} = renderWithSpeakers(clip, [{id: 'speaker-1', name: 'Bob'}]);
    act(() => {
      result.current.removeActiveSpeakerFromLibrary();
    });
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('updateActiveSpeakerColor 更新对应说话人颜色', () => {
    const clip = makeSubtitleClip({speaker: 'Alice'});
    const {result} = renderWithSpeakers(clip, [{id: 'speaker-1', name: 'Alice'}]);
    act(() => {
      result.current.updateActiveSpeakerColor('#00ff00');
    });
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(UpdateProjectSpeakersCommand);
  });

  it('updateActiveSpeakerColor 无活跃条目时直接返回', () => {
    const clip = makeSubtitleClip({speaker: 'Ghost'});
    const {result} = renderWithSpeakers(clip, [{id: 'speaker-1', name: 'Bob'}]);
    act(() => {
      result.current.updateActiveSpeakerColor('#00ff00');
    });
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('allTimelineSubtitleClips 聚合全时间线字幕并按 start 排序', () => {
    const clipA = makeSubtitleClip({id: 'sub-a', trackId: 'track-sub', start: 5});
    const clipB = makeSubtitleClip({id: 'sub-b', trackId: 'track-sub', start: 1});
    const audioClip = makeAudioClip({id: 'audio-1', trackId: 'track-audio'});
    const subTrack = makeTrack({id: 'track-sub', type: 'subtitle', clips: [clipA, clipB]});
    const audioTrack = makeTrack({id: 'track-audio', type: 'audio', clips: [audioClip]});
    const {result} = renderInspector(clipA, [subTrack, audioTrack]);
    expect(result.current.allTimelineSubtitleClips.map((item) => item.id)).toEqual(['sub-b', 'sub-a']);
  });
});

describe('useClipInspectorState 字幕样式模板域', () => {
  const TEMPLATE = {id: 'tpl-1', kind: 'builtin' as const, name: '模板一', style: DEFAULT_SUBTITLE_STYLE};

  it('applySubtitleStyleTemplate 执行 UpdateSubtitleStyleCommand 并提示成功', () => {
    const {result} = renderInspector(makeSubtitleClip());
    act(() => {
      result.current.applySubtitleStyleTemplate(TEMPLATE);
    });
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(UpdateSubtitleStyleCommand);
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({kind: 'success'}));
  });

  it('applySubtitleStyleTemplate 非 subtitle clip 直接返回', () => {
    const clip = makeAudioClip();
    const {result} = renderInspector(clip, [makeTrack({clips: [clip]})]);
    act(() => {
      result.current.applySubtitleStyleTemplate(TEMPLATE);
    });
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('applySubtitleStyleTemplate 命令失败时弹 toast', () => {
    executeMock.mockImplementation(() => {
      throw new Error('style rejected');
    });
    const {result} = renderInspector(makeSubtitleClip());
    act(() => {
      result.current.applySubtitleStyleTemplate(TEMPLATE);
    });
    expect(showToastMock).toHaveBeenCalledWith(
      expect.objectContaining({kind: 'warning', message: 'style rejected'}),
    );
  });

  it('saveCurrentSubtitleStyleTemplate prompt 取消时直接返回', async () => {
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue(null);
    const {result} = renderInspector(makeSubtitleClip());
    await act(async () => {
      await result.current.saveCurrentSubtitleStyleTemplate();
    });
    expect(saveTemplateMock).not.toHaveBeenCalled();
    promptSpy.mockRestore();
  });

  it('saveCurrentSubtitleStyleTemplate 保存成功并提示', async () => {
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('新模板');
    saveTemplateMock.mockResolvedValue([{id: 'tpl-1', kind: 'builtin', name: '新模板', style: DEFAULT_SUBTITLE_STYLE}]);
    const {result} = renderInspector(makeSubtitleClip());
    await act(async () => {
      await result.current.saveCurrentSubtitleStyleTemplate();
    });
    expect(saveTemplateMock).toHaveBeenCalledWith('新模板', expect.anything());
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({kind: 'success'}));
    promptSpy.mockRestore();
  });

  it('saveCurrentSubtitleStyleTemplate 失败时弹 toast', async () => {
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('新模板');
    saveTemplateMock.mockRejectedValue(new Error('save failed'));
    const {result} = renderInspector(makeSubtitleClip());
    await act(async () => {
      await result.current.saveCurrentSubtitleStyleTemplate();
    });
    expect(showToastMock).toHaveBeenCalledWith(
      expect.objectContaining({kind: 'warning', message: 'save failed'}),
    );
    promptSpy.mockRestore();
  });

  it('deleteSubtitleStyleTemplate 删除并提示', async () => {
    deleteTemplateMock.mockResolvedValue([]);
    const {result} = renderInspector(makeSubtitleClip());
    await act(async () => {
      await result.current.deleteSubtitleStyleTemplate('tpl-1');
    });
    expect(deleteTemplateMock).toHaveBeenCalledWith('tpl-1');
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({kind: 'info'}));
  });

  it('addSubtitleStyleTemplateToSharedLibrary 添加共享资源并派发更新事件', async () => {
    addSharedResourceMock.mockResolvedValue(undefined);
    toSharedResourceMock.mockReturnValue({id: 'shared-1'});
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    const {result} = renderInspector(makeSubtitleClip());
    await act(async () => {
      await result.current.addSubtitleStyleTemplateToSharedLibrary(TEMPLATE);
    });
    expect(addSharedResourceMock).toHaveBeenCalledWith(expect.anything(), 'overwrite');
    expect(dispatchSpy).toHaveBeenCalled();
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({kind: 'success'}));
    dispatchSpy.mockRestore();
  });
});

describe('useClipInspectorState 字幕翻译域', () => {
  function renderForTranslation() {
    const clip = makeSubtitleClip();
    const track = makeTrack({id: clip.trackId, type: 'subtitle', clips: [clip]});
    editorStoreState.project = makeInspectorProject({tracks: [track]});
    return renderHook(() =>
      useClipInspectorState({
        clip,
        selectedClipLocked: false,
        media: [],
        playheadTime: 0,
        projectSettings: makeProjectSettings(),
        selectedSubtitleClips: [],
      }),
    );
  }

  it('未配置翻译时直接返回', async () => {
    isConfiguredMock.mockReturnValue(false);
    const {result} = renderForTranslation();
    await act(async () => {
      await result.current.translateSubtitleTrack();
    });
    expect(translateItemsMock).not.toHaveBeenCalled();
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('成功翻译时创建轨道与字幕剪辑', async () => {
    isConfiguredMock.mockReturnValue(true);
    toTranslationItemsMock.mockReturnValue([{id: 'sub-src', text: '你好'}]);
    translateItemsMock.mockResolvedValue([{id: 'sub-src', translatedText: 'hello'}]);
    const {result} = renderForTranslation();
    await act(async () => {
      await result.current.translateSubtitleTrack();
    });
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(AddTrackCommand);
    expect(executeMock.mock.calls[1][0]).toBeInstanceOf(AddSubtitleClipCommand);
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({kind: 'success'}));
  });

  it('TOS 未接受且用户拒绝时中止翻译', async () => {
    isConfiguredMock.mockReturnValue(true);
    toTranslationItemsMock.mockReturnValue([]);
    translateItemsMock
      .mockRejectedValueOnce(new Error('TRANSLATION_TOS_NOT_ACCEPTED'))
      .mockResolvedValueOnce([]);
    bridgeConfirmMock.mockResolvedValue(false);
    const {result} = renderForTranslation();
    await act(async () => {
      await result.current.translateSubtitleTrack();
    });
    expect(acceptTosMock).not.toHaveBeenCalled();
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('TOS 接受后重试翻译成功', async () => {
    isConfiguredMock.mockReturnValue(true);
    toTranslationItemsMock.mockReturnValue([]);
    translateItemsMock
      .mockRejectedValueOnce(new Error('TRANSLATION_TOS_NOT_ACCEPTED'))
      .mockResolvedValueOnce([]);
    bridgeConfirmMock.mockResolvedValue(true);
    const {result} = renderForTranslation();
    await act(async () => {
      await result.current.translateSubtitleTrack();
    });
    expect(acceptTosMock).toHaveBeenCalled();
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(AddTrackCommand);
  });

  it('翻译失败时弹 toast 并清空进度', async () => {
    isConfiguredMock.mockReturnValue(true);
    toTranslationItemsMock.mockReturnValue([]);
    translateItemsMock.mockRejectedValue(new Error('network error'));
    const {result} = renderForTranslation();
    await act(async () => {
      await result.current.translateSubtitleTrack();
    });
    expect(showToastMock).toHaveBeenCalledWith(
      expect.objectContaining({kind: 'warning', message: 'network error'}),
    );
    expect(result.current.subtitleTranslationProgress).toBeUndefined();
  });
});

describe('useClipInspectorState 数据字幕域', () => {
  it('updateDataSubtitleTemplate 更新模板与文本', () => {
    const clip = makeSubtitleClip({
      dataSubtitle: {sourceType: 'csv', template: '{row.text}', rows: [], filePath: 'D:/a.csv'},
    });
    const {result} = renderInspector(clip);
    act(() => {
      result.current.updateDataSubtitleTemplate('{row.text}-{row.index}');
    });
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(UpdateClipCommand);
  });

  it('updateDataSubtitleTemplate 空 template 回退默认占位', () => {
    const {result} = renderInspector(makeSubtitleClip());
    act(() => {
      result.current.updateDataSubtitleTemplate('  ');
    });
    expect(executeMock).toHaveBeenCalledTimes(1);
  });

  it('clearDataSubtitleSource 清除数据源', () => {
    const {result} = renderInspector(makeSubtitleClip());
    act(() => {
      result.current.clearDataSubtitleSource();
    });
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(UpdateClipCommand);
  });

  it('bindDataSubtitleSource 选择 csv 文件并解析行', async () => {
    openFileDialogMock.mockResolvedValue(['D:/subs.csv']);
    readFileMock.mockResolvedValue('time,text\n0,hello\n2,world');
    const {result} = renderInspector(makeSubtitleClip());
    await act(async () => {
      await result.current.bindDataSubtitleSource();
    });
    expect(readFileMock).toHaveBeenCalledWith('D:/subs.csv');
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({kind: 'success'}));
  });

  it('bindDataSubtitleSource 取消选择时不提交', async () => {
    openFileDialogMock.mockResolvedValue([]);
    const {result} = renderInspector(makeSubtitleClip());
    await act(async () => {
      await result.current.bindDataSubtitleSource();
    });
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('bindDataSubtitleSource 失败时弹 toast', async () => {
    openFileDialogMock.mockRejectedValue(new Error('dialog error'));
    const {result} = renderInspector(makeSubtitleClip());
    await act(async () => {
      await result.current.bindDataSubtitleSource();
    });
    expect(showToastMock).toHaveBeenCalledWith(
      expect.objectContaining({kind: 'warning', message: 'dialog error'}),
    );
  });
});

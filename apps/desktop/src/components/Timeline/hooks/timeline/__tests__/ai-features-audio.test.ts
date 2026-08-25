// @vitest-environment jsdom
// 覆盖目标：apps/desktop/src/components/Timeline/hooks/timeline/ai-features.ts（音频/字幕 AI 部分）
// 覆盖 handler：openSilenceDetection / getDialogueDetectionTarget / runDialogueDetection /
//   generateDialogueSubtitles / applySilenceRemoval / generateSubtitles /
//   findSubtitleAlignmentSource / alignSubtitlesToWaveform / ttsVoiceover
import {describe, expect, it, vi, beforeEach} from 'vitest';

const {
  executeMock,
  showToastMock,
  detectClipDialogueMock,
  analyzeWaveformMock,
  canGenerateSubtitlesForClipMock,
  buildWhisperSubtitleTrackForClipMock,
  getWhisperAvailabilityMock,
  generateTtsVoiceoverMock,
  collectSubtitleClipsForTtsMock,
  editorProjectMock,
} = vi.hoisted(() => ({
  executeMock: vi.fn(),
  showToastMock: vi.fn(),
  detectClipDialogueMock: vi.fn(),
  analyzeWaveformMock: vi.fn(),
  canGenerateSubtitlesForClipMock: vi.fn(),
  buildWhisperSubtitleTrackForClipMock: vi.fn(),
  getWhisperAvailabilityMock: vi.fn(),
  generateTtsVoiceoverMock: vi.fn(),
  collectSubtitleClipsForTtsMock: vi.fn(),
  editorProjectMock: {project: {timeline: {tracks: []}}},
}));

vi.mock('../../../../../store/commandManager', () => ({
  commandManager: {execute: (command: unknown) => executeMock(command)},
  projectAccessor: {getProject: vi.fn(), setProject: vi.fn()},
  timelineAccessor: {getTimeline: vi.fn(), setTimeline: vi.fn()},
  setEditorStoreGetter: vi.fn(),
  addOnExecuteListener: vi.fn(),
}));

vi.mock('../../../../../store/editorStore', () => ({
  useEditorStore: {getState: () => editorProjectMock},
}));

vi.mock('../../../../../store/whisperSettingsStore', () => ({
  useWhisperSettingsStore: {getState: () => ({executablePath: 'w', modelPath: 'm'})},
}));

vi.mock('../../../../../lib/toast', () => ({
  showToast: (toast: unknown) => showToastMock(toast),
}));

vi.mock('../../../../../lib/whisper', () => ({
  canGenerateSubtitlesForClip: (...args: unknown[]) => canGenerateSubtitlesForClipMock(...args),
  buildWhisperSubtitleTrackForClip: (...args: unknown[]) => buildWhisperSubtitleTrackForClipMock(...args),
  getWhisperAvailability: (...args: unknown[]) => getWhisperAvailabilityMock(...args),
}));

vi.mock('../../../../../lib/dialogueDetection', () => ({
  detectClipDialogue: (...args: unknown[]) => detectClipDialogueMock(...args),
}));

vi.mock('../../../../../lib/ttsVoiceover', () => ({
  generateTtsVoiceover: (...args: unknown[]) => generateTtsVoiceoverMock(...args),
  collectSubtitleClipsForTts: (...args: unknown[]) => collectSubtitleClipsForTtsMock(...args),
}));

vi.mock('../../../../../lib/tauri-bridge', () => ({
  analyzeWaveform: (...args: unknown[]) => analyzeWaveformMock(...args),
  cancelSceneDetection: vi.fn(),
  detectSceneChanges: vi.fn(),
  extractCoverFrames: vi.fn(),
  getAppDataDir: vi.fn(async () => 'D:/AppData'),
  listenBridge: vi.fn(async () => () => {}),
  listenCoverFrameProgress: vi.fn(async () => () => {}),
}));

vi.mock('../../../../../media/background-media-task-queue', () => ({
  runUiFeedbackTask: (task: () => unknown) => task(),
}));

import {createAiFeatureHandlers} from '../ai-features';
import {makeAsset, makeClip, makeParams, makeProject, makeTrack} from './test-fixtures';
import {
  AddTrackCommand,
  BatchAlignSubtitleCommand,
  BatchImportSubtitleCommand,
  RemoveSilenceCommand,
} from '@open-factory/editor-core';

beforeEach(() => {
  executeMock.mockReset();
  showToastMock.mockReset();
  detectClipDialogueMock.mockReset().mockResolvedValue([]);
  analyzeWaveformMock.mockReset().mockResolvedValue([]);
  canGenerateSubtitlesForClipMock.mockReset().mockImplementation((_clip: unknown, _asset: unknown, ready: boolean) => Boolean(ready));
  buildWhisperSubtitleTrackForClipMock.mockReset();
  getWhisperAvailabilityMock.mockReset().mockResolvedValue({ready: true});
  generateTtsVoiceoverMock.mockReset().mockResolvedValue(undefined);
  collectSubtitleClipsForTtsMock.mockReset().mockReturnValue([]);
});

describe('createAiFeatureHandlers — 静音检测', () => {
  it('openSilenceDetection 无资产时 toast 警告且不打开对话框', () => {
    const clip = makeClip({id: 'clip-x', type: 'audio'});
    const params = makeParams({project: makeProject({tracks: [makeTrack({clips: [clip]})]})});
    const handlers = createAiFeatureHandlers(params, {
      findClip: () => clip,
      getClipMediaAsset: () => undefined,
    });
    handlers.openSilenceDetection('clip-x');
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({kind: 'warning'}));
    expect(params.setters.setSilenceDialog).not.toHaveBeenCalled();
    expect(params.setters.setClipMenu).toHaveBeenCalledWith(undefined);
  });

  it('openSilenceDetection 无音频的视频 clip 警告', () => {
    const clip = makeClip({id: 'clip-v', type: 'video'});
    const asset = makeAsset({type: 'video', hasAudio: false});
    const params = makeParams({project: makeProject({tracks: [makeTrack({clips: [clip]})]})});
    const handlers = createAiFeatureHandlers(params, {
      findClip: () => clip,
      getClipMediaAsset: () => asset,
    });
    handlers.openSilenceDetection('clip-v');
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({kind: 'warning'}));
  });

  it('openSilenceDetection 有效音频 clip 打开对话框并选中', () => {
    const clip = makeClip({id: 'clip-a', type: 'audio'});
    const asset = makeAsset({type: 'audio'});
    const params = makeParams({project: makeProject({tracks: [makeTrack({clips: [clip]})]})});
    const handlers = createAiFeatureHandlers(params, {
      findClip: () => clip,
      getClipMediaAsset: () => asset,
    });
    handlers.openSilenceDetection('clip-a');
    expect(params.setters.setSilenceDialog).toHaveBeenCalledWith({clip, asset});
    expect(params.setters.setSelectedClipId).toHaveBeenCalledWith('clip-a');
    expect(showToastMock).not.toHaveBeenCalled();
  });
});

describe('createAiFeatureHandlers — 对话检测', () => {
  function dialogueParams(clips: ReturnType<typeof makeClip>[], assetFor: (id: string) => ReturnType<typeof makeAsset> | undefined, selectedClipIds: string[] = []) {
    const params = makeParams({
      project: makeProject({tracks: [makeTrack({clips})]}),
      allClips: clips,
      selectedClipIds,
    });
    const handlers = createAiFeatureHandlers(params, {
      findClip: (id) => clips.find((clip) => clip.id === id) ?? makeClip({id}),
      getClipMediaAsset: (clip) => assetFor(clip.id),
    });
    return {params, handlers};
  }

  it('getDialogueDetectionTarget 优先返回选中的有效 clip', () => {
    const clips = [makeClip({id: 'clip-a', type: 'audio'}), makeClip({id: 'clip-b', type: 'audio'})];
    const {handlers} = dialogueParams(clips, () => makeAsset({type: 'audio'}), ['clip-b']);
    expect(handlers.getDialogueDetectionTarget()?.clip.id).toBe('clip-b');
  });

  it('getDialogueDetectionTarget 选中无效时回退首个有效 clip', () => {
    const clips = [makeClip({id: 'clip-z', type: 'audio'}), makeClip({id: 'clip-a', type: 'audio'})];
    const {handlers} = dialogueParams(clips, (id) => (id === 'clip-a' ? makeAsset({type: 'audio'}) : undefined), ['clip-z']);
    expect(handlers.getDialogueDetectionTarget()?.clip.id).toBe('clip-a');
  });

  it('getDialogueDetectionTarget 无有效目标时返回 undefined', () => {
    const clips = [makeClip({id: 'clip-z', type: 'audio'})];
    const {handlers} = dialogueParams(clips, () => undefined);
    expect(handlers.getDialogueDetectionTarget()).toBeUndefined();
  });

  it('runDialogueDetection 无目标时 toast 警告并清空标记', async () => {
    const clips = [makeClip({id: 'clip-z', type: 'audio'})];
    const {params, handlers} = dialogueParams(clips, () => undefined);
    await handlers.runDialogueDetection('medium');
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({kind: 'warning'}));
    expect(params.setters.setDialogueMarkers).toHaveBeenCalledWith([]);
    expect(params.setters.setDialogueMisses).toHaveBeenCalledWith([]);
  });

  it('runDialogueDetection 成功时把相对时间换算为时间线绝对时间', async () => {
    detectClipDialogueMock.mockResolvedValue([{start: 0.5, end: 1.5, text: 'hi'}]);
    const clip = makeClip({id: 'clip-a', type: 'audio', start: 10});
    const {params, handlers} = dialogueParams([clip], () => makeAsset({type: 'audio'}));
    await handlers.runDialogueDetection('high');
    expect(detectClipDialogueMock).toHaveBeenCalledWith(clip, expect.anything(), 'high');
    expect(params.setters.setSelectedClipId).toHaveBeenCalledWith('clip-a');
    expect(params.setters.setDialogueMarkers).toHaveBeenCalledWith([
      expect.objectContaining({start: 10.5, end: 11.5, duration: 1}),
    ]);
    expect(params.setters.setDialogueMisses).toHaveBeenCalled();
    expect(showToastMock).not.toHaveBeenCalled();
  });

  it('runDialogueDetection 空结果时追加 no-results 警告', async () => {
    detectClipDialogueMock.mockResolvedValue([]);
    const clips = [makeClip({id: 'clip-a', type: 'audio'})];
    const {handlers} = dialogueParams(clips, () => makeAsset({type: 'audio'}));
    await handlers.runDialogueDetection('medium');
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({kind: 'warning'}));
  });

  it('runDialogueDetection 检测失败时 toast 警告', async () => {
    detectClipDialogueMock.mockRejectedValue(new Error('decode failed'));
    const clips = [makeClip({id: 'clip-a', type: 'audio'})];
    const {handlers} = dialogueParams(clips, () => makeAsset({type: 'audio'}));
    await handlers.runDialogueDetection('medium');
    expect(showToastMock).toHaveBeenCalledWith(
      expect.objectContaining({kind: 'warning', message: 'decode failed'}),
    );
  });
});

describe('createAiFeatureHandlers — 对话字幕生成', () => {
  function dialogueSetup(markers: unknown[], withSubtitleTrack = false) {
    const clips = [makeClip({id: 'clip-a', type: 'audio'})];
    const tracks = withSubtitleTrack
      ? [makeTrack({id: 'track-1', clips}), makeTrack({id: 'track-sub', type: 'subtitle', clips: []})]
      : [makeTrack({id: 'track-1', clips})];
    const params = makeParams({project: makeProject({tracks})});
    Object.assign(params, {dialogueMarkers: markers});
    const handlers = createAiFeatureHandlers(params, {
      findClip: (id) => clips.find((clip) => clip.id === id) ?? makeClip({id}),
      getClipMediaAsset: () => makeAsset({type: 'audio'}),
    });
    return {params, handlers};
  }

  it('无对话标记时直接返回', () => {
    const {handlers} = dialogueSetup([]);
    handlers.generateDialogueSubtitles();
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('执行 BatchImportSubtitleCommand 并选中生成的字幕 clip', () => {
    const markers = [{id: 'd1', start: 1, end: 2, duration: 1, text: 'hi'}];
    const {params, handlers} = dialogueSetup(markers);
    handlers.generateDialogueSubtitles();
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(BatchImportSubtitleCommand);
    expect(params.setters.setSelectedClipIds).toHaveBeenCalled();
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({kind: 'success'}));
  });

  it('已存在字幕轨道时同样执行 BatchImportSubtitleCommand（append 模式）', () => {
    const markers = [{id: 'd1', start: 1, end: 2, duration: 1, text: 'hi'}];
    const {handlers} = dialogueSetup(markers, true);
    handlers.generateDialogueSubtitles();
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(BatchImportSubtitleCommand);
  });

  it('命令抛错时 toast 警告', () => {
    executeMock.mockImplementation(() => {
      throw new Error('timeline rejected');
    });
    const markers = [{id: 'd1', start: 1, end: 2, duration: 1, text: 'hi'}];
    const {handlers} = dialogueSetup(markers);
    handlers.generateDialogueSubtitles();
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({kind: 'warning'}));
  });
});

describe('createAiFeatureHandlers — 静音移除', () => {
  it('applySilenceRemoval 执行 RemoveSilenceCommand 并关闭对话框', () => {
    const clips = [makeClip({id: 'clip-a', type: 'audio'})];
    const params = makeParams({project: makeProject({tracks: [makeTrack({clips})]})});
    const handlers = createAiFeatureHandlers(params, {
      findClip: (id) => clips.find((clip) => clip.id === id) ?? makeClip({id}),
      getClipMediaAsset: () => makeAsset({type: 'audio'}),
    });
    handlers.applySilenceRemoval('clip-a', [{start: 1, end: 2, duration: 1}]);
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(RemoveSilenceCommand);
    expect(params.setters.setSilenceDialog).toHaveBeenCalledWith(undefined);
    expect(params.setters.clearSelectedClipIds).toHaveBeenCalled();
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({kind: 'success'}));
  });

  it('applySilenceRemoval 命令抛错时 toast 警告', () => {
    executeMock.mockImplementation(() => {
      throw new Error('remove rejected');
    });
    const clips = [makeClip({id: 'clip-a', type: 'audio'})];
    const params = makeParams({project: makeProject({tracks: [makeTrack({clips})]})});
    const handlers = createAiFeatureHandlers(params, {
      findClip: (id) => clips.find((clip) => clip.id === id) ?? makeClip({id}),
      getClipMediaAsset: () => makeAsset({type: 'audio'}),
    });
    handlers.applySilenceRemoval('clip-a', []);
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({kind: 'warning'}));
  });
});

describe('createAiFeatureHandlers — Whisper 字幕生成', () => {
  function whisperSetup(whisperReady: boolean) {
    const clip = makeClip({id: 'clip-a', type: 'audio'});
    const asset = makeAsset({type: 'audio'});
    const params = makeParams({project: makeProject({tracks: [makeTrack({clips: [clip]})]})});
    Object.assign(params, {whisperAvailability: {ready: whisperReady, error: 'not configured'}});
    const handlers = createAiFeatureHandlers(params, {
      findClip: () => clip,
      getClipMediaAsset: () => asset,
    });
    return {params, handlers};
  }

  it('whisper 未就绪时 toast 警告且不打开对话框', async () => {
    const {params, handlers} = whisperSetup(false);
    await handlers.generateSubtitles('clip-a');
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({kind: 'warning'}));
    expect(params.setters.setWhisperDialog).not.toHaveBeenCalled();
  });

  it('就绪检查失败时 toast 警告', async () => {
    getWhisperAvailabilityMock.mockResolvedValue({ready: false, error: 'no model'});
    const {handlers} = whisperSetup(true);
    await handlers.generateSubtitles('clip-a');
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({kind: 'warning', message: 'no model'}));
  });

  it('成功生成时执行 AddTrackCommand 并选中首个字幕 clip', async () => {
    buildWhisperSubtitleTrackForClipMock.mockResolvedValue({
      id: 'track-sub',
      type: 'subtitle',
      clips: [{id: 'sub-1'}, {id: 'sub-2'}],
    });
    const {params, handlers} = whisperSetup(true);
    await handlers.generateSubtitles('clip-a');
    expect(params.setters.setWhisperDialog).toHaveBeenCalledWith({clip: expect.anything(), progress: 0});
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(AddTrackCommand);
    expect(params.setters.setSelectedClipId).toHaveBeenCalledWith('sub-1');
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({kind: 'success'}));
    expect(params.setters.setWhisperDialog).toHaveBeenLastCalledWith(undefined);
  });

  it('生成结果为空时 toast 警告且不执行命令', async () => {
    buildWhisperSubtitleTrackForClipMock.mockResolvedValue({id: 'track-sub', type: 'subtitle', clips: []});
    const {handlers} = whisperSetup(true);
    await handlers.generateSubtitles('clip-a');
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({kind: 'warning'}));
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('生成抛错时 toast 错误并复位对话框', async () => {
    buildWhisperSubtitleTrackForClipMock.mockRejectedValue(new Error('whisper crashed'));
    const {params, handlers} = whisperSetup(true);
    await handlers.generateSubtitles('clip-a');
    expect(showToastMock).toHaveBeenCalledWith(
      expect.objectContaining({kind: 'error', message: 'whisper crashed'}),
    );
    expect(params.setters.setWhisperDialog).toHaveBeenLastCalledWith(undefined);
  });
});

describe('createAiFeatureHandlers — 字幕对齐', () => {
  function subtitleSetup(options: {withSource?: boolean; subtitleClips?: unknown[]} = {}) {
    const subtitleClip = makeClip({
      id: 'sub-1',
      type: 'subtitle' as never,
      text: 'hello',
      trackId: 'track-sub',
      start: 0,
      duration: 1,
    } as never);
    const sourceClip = makeClip({id: 'clip-a', type: 'audio', start: 0, duration: 10});
    const tracks = [
      makeTrack({id: 'track-sub', type: 'subtitle', clips: (options.subtitleClips as ReturnType<typeof makeClip>[] | undefined) ?? [subtitleClip]}),
    ];
    if (options.withSource !== false) {
      tracks.push(makeTrack({id: 'track-1', clips: [sourceClip]}));
    }
    const project = makeProject({tracks});
    const params = makeParams({project});
    const handlers = createAiFeatureHandlers(params, {
      findClip: (id) => (id === 'sub-1' ? subtitleClip : sourceClip),
      getClipMediaAsset: (clip) => (clip.id === 'clip-a' ? makeAsset({type: 'audio'}) : undefined),
    });
    return {params, handlers, subtitleClip, sourceClip};
  }

  it('findSubtitleAlignmentSource 返回时间重叠的音频源', () => {
    const {handlers, sourceClip} = subtitleSetup();
    const subtitleClips = [
      makeClip({id: 'sub-1', type: 'subtitle' as never, text: 'x', start: 0, duration: 1} as never),
    ];
    const target = handlers.findSubtitleAlignmentSource(subtitleClips as never);
    expect(target?.clip.id).toBe(sourceClip.id);
  });

  it('findSubtitleAlignmentSource 无重叠音频时返回 undefined', () => {
    const {handlers} = subtitleSetup({withSource: false});
    const subtitleClips = [
      makeClip({id: 'sub-1', type: 'subtitle' as never, text: 'x', start: 0, duration: 1} as never),
    ];
    expect(handlers.findSubtitleAlignmentSource(subtitleClips as never)).toBeUndefined();
  });

  it('alignSubtitlesToWaveform 非 subtitle clip 时 toast 警告', async () => {
    const clip = makeClip({id: 'clip-a', type: 'audio'});
    const params = makeParams({project: makeProject({tracks: [makeTrack({clips: [clip]})]})});
    const handlers = createAiFeatureHandlers(params, {
      findClip: () => clip,
      getClipMediaAsset: () => makeAsset({type: 'audio'}),
    });
    await handlers.alignSubtitlesToWaveform('clip-a');
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({kind: 'warning'}));
  });

  it('alignSubtitlesToWaveform 轨道无字幕时 toast 警告', async () => {
    const {handlers} = subtitleSetup({subtitleClips: []});
    await handlers.alignSubtitlesToWaveform('sub-1');
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({kind: 'warning'}));
    expect(analyzeWaveformMock).not.toHaveBeenCalled();
  });

  it('alignSubtitlesToWaveform 无音频源时 toast 警告', async () => {
    const {handlers} = subtitleSetup({withSource: false});
    await handlers.alignSubtitlesToWaveform('sub-1');
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({kind: 'warning'}));
  });

  it('alignSubtitlesToWaveform 成功时执行 BatchAlignSubtitleCommand 并汇报结果', async () => {
    analyzeWaveformMock.mockResolvedValue([0, 1, 0]);
    const {params, handlers} = subtitleSetup();
    await handlers.alignSubtitlesToWaveform('sub-1');
    expect(analyzeWaveformMock).toHaveBeenCalled();
    expect(executeMock.mock.calls[0][0]).toBeInstanceOf(BatchAlignSubtitleCommand);
    expect(params.setters.setSubtitleAlignReport).toHaveBeenCalledWith(
      expect.objectContaining({correctedCount: 0, averageOffsetMs: 0}),
    );
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({kind: 'success'}));
  });

  it('alignSubtitlesToWaveform 失败时 toast 警告', async () => {
    analyzeWaveformMock.mockRejectedValue(new Error('waveform read failed'));
    const {handlers} = subtitleSetup();
    await handlers.alignSubtitlesToWaveform('sub-1');
    expect(showToastMock).toHaveBeenCalledWith(
      expect.objectContaining({kind: 'warning', message: 'waveform read failed'}),
    );
  });
});

describe('createAiFeatureHandlers — TTS 配音', () => {
  it('非 subtitle clip 直接返回', async () => {
    const clip = makeClip({id: 'clip-a', type: 'audio'});
    const params = makeParams({project: makeProject({tracks: [makeTrack({clips: [clip]})]})});
    const handlers = createAiFeatureHandlers(params, {
      findClip: () => clip,
      getClipMediaAsset: () => makeAsset({type: 'audio'}),
    });
    await handlers.ttsVoiceover('clip-a');
    expect(collectSubtitleClipsForTtsMock).not.toHaveBeenCalled();
  });

  it('无输入字幕时不生成配音', async () => {
    const subtitleClip = makeClip({
      id: 'sub-1',
      type: 'subtitle' as never,
      text: 'x',
      trackId: 'track-sub',
    } as never);
    collectSubtitleClipsForTtsMock.mockReturnValue([]);
    const params = makeParams({
      project: makeProject({tracks: [makeTrack({id: 'track-sub', type: 'subtitle', clips: [subtitleClip]})]}),
    });
    const handlers = createAiFeatureHandlers(params, {
      findClip: () => subtitleClip,
      getClipMediaAsset: () => undefined,
    });
    await handlers.ttsVoiceover('sub-1');
    expect(collectSubtitleClipsForTtsMock).toHaveBeenCalled();
    expect(generateTtsVoiceoverMock).not.toHaveBeenCalled();
  });

  it('有输入字幕时调用 generateTtsVoiceover', async () => {
    const subtitleClip = makeClip({
      id: 'sub-1',
      type: 'subtitle' as never,
      text: 'x',
      trackId: 'track-sub',
    } as never);
    const inputClips = [subtitleClip];
    collectSubtitleClipsForTtsMock.mockReturnValue(inputClips);
    const params = makeParams({
      project: makeProject({tracks: [makeTrack({id: 'track-sub', type: 'subtitle', clips: [subtitleClip]})]}),
    });
    const handlers = createAiFeatureHandlers(params, {
      findClip: () => subtitleClip,
      getClipMediaAsset: () => undefined,
    });
    await handlers.ttsVoiceover('sub-1');
    expect(generateTtsVoiceoverMock).toHaveBeenCalledWith(inputClips);
  });
});

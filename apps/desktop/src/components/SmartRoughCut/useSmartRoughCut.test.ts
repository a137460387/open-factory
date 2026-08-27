// @vitest-environment jsdom
// 覆盖目标：apps/desktop/src/components/SmartRoughCut/useSmartRoughCut.ts
// 策略：renderHook + mock store（selector 形态，参照 useTimelineState.test.ts）与
// 检测后端（tauri-bridge/silence/dialogue/whisper/toast）；orchestratorStore 用真实 store。
// 锁定：门控派生、六步运行/应用命令断言、双次 markStepComplete 报告语义、
// effect deps 竞态与 rhythmTrackId 回落链。
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import {
  AddTrackCommand,
  BrollInsertCommand,
  DialogueRoughCutCommand,
  RemoveSilenceCommand,
  RhythmAssembleCommand,
  SplitClipAtTimesCommand,
  type Project,
} from '@open-factory/editor-core';
import { makeAsset, makeClip, makeProject, makeTrack } from '../Timeline/hooks/timeline/__tests__/test-fixtures';
import { useSmartRoughCutOrchestratorStore } from '../../store/smartRoughCutOrchestratorStore';

// ── 可变 mock 状态（工厂闭包延迟求值） ──────────────────────
let editorState: Record<string, unknown>;
let whisperSettingsState: Record<string, unknown>;
let mockTimeline: Project['timeline'];

const mockExecute = vi.fn();
const mockDetectSceneChanges = vi.fn();
const mockDetectClipSilence = vi.fn();
const mockDetectClipDialogue = vi.fn();
const mockGetWhisperAvailability = vi.fn();
const mockCanGenerateSubtitlesForClip = vi.fn();
const mockBuildWhisperSubtitleTrackForClip = vi.fn();
const mockShowToast = vi.fn();

vi.mock('../../store/editorStore', () => ({
  useEditorStore: Object.assign((selector: (state: never) => unknown) => selector(editorState as never), {
    getState: () => editorState,
  }),
}));

vi.mock('../../store/whisperSettingsStore', () => ({
  useWhisperSettingsStore: (selector: (state: never) => unknown) => selector(whisperSettingsState as never),
}));

vi.mock('../../store/commandManager', () => ({
  // 透传执行真实命令：DialogueRoughCutCommand/RhythmAssembleCommand 的 clipCount
  // 只在 execute() 后才有值，报告计数依赖真实执行。
  commandManager: {
    execute: (command: { execute: () => void }) => {
      mockExecute(command);
      command.execute();
    },
  },
  timelineAccessor: {
    getTimeline: () => mockTimeline,
    setTimeline: (timeline: Project['timeline']) => {
      mockTimeline = timeline;
    },
  },
}));

vi.mock('../../lib/tauri-bridge', () => ({
  detectSceneChanges: (request: unknown) => mockDetectSceneChanges(request),
}));

vi.mock('../../lib/silenceDetection', () => ({
  detectClipSilence: (...args: unknown[]) => mockDetectClipSilence(...args),
}));

vi.mock('../../lib/dialogueDetection', () => ({
  detectClipDialogue: (...args: unknown[]) => mockDetectClipDialogue(...args),
}));

vi.mock('../../lib/whisper', () => ({
  getWhisperAvailability: (settings: unknown) => mockGetWhisperAvailability(settings),
  canGenerateSubtitlesForClip: (clip: unknown, asset: unknown, ready: unknown) =>
    mockCanGenerateSubtitlesForClip(clip, asset, ready),
  buildWhisperSubtitleTrackForClip: (...args: unknown[]) => mockBuildWhisperSubtitleTrackForClip(...args),
}));

vi.mock('../../lib/toast', () => ({
  showToast: (toast: unknown) => mockShowToast(toast),
}));

import { useSmartRoughCut } from './useSmartRoughCut';

// ── Fixture ─────────────────────────────────────────────────

function makeEditorState(project: Project, overrides: Record<string, unknown> = {}) {
  return {
    project,
    selectedClipIds: [] as string[],
    setSelectedClipId: vi.fn(),
    setPlayheadTime: vi.fn(),
    ...overrides,
  };
}

function setupHook(overrides: {
  clip?: ReturnType<typeof makeClip>;
  media?: ReturnType<typeof makeAsset>[];
  project?: Project;
  selectedClipIds?: string[];
  setPlayheadTime?: ReturnType<typeof vi.fn>;
} = {}) {
  const clip =
    overrides.clip ??
    makeClip({ id: 'clip-1', type: 'video', trackId: 'track-video', mediaId: 'media-1', duration: 4, trimStart: 1 });
  const media = overrides.media ?? [makeAsset({ id: 'media-1', duration: 10, thumbnail: 'thumb.png' })];
  const project =
    overrides.project ??
    makeProject({ tracks: [makeTrack({ id: 'track-video', clips: [clip] })], media });
  editorState = makeEditorState(project, {
    selectedClipIds: overrides.selectedClipIds ?? [],
    ...(overrides.setPlayheadTime ? { setPlayheadTime: overrides.setPlayheadTime } : {}),
  });
  mockTimeline = project.timeline;
  return renderHook(() => useSmartRoughCut(clip, media));
}

function orchestrator() {
  return useSmartRoughCutOrchestratorStore.getState().stepState;
}

beforeEach(() => {
  vi.clearAllMocks();
  useSmartRoughCutOrchestratorStore.getState().reset();
  whisperSettingsState = { executablePath: 'C:/whisper.exe', modelPath: 'C:/model.bin' };
  mockGetWhisperAvailability.mockImplementation(() => Promise.resolve({ ready: true }));
  // 复刻真实语义：whisperReady 与 clip/asset 同时满足才可生成。
  mockCanGenerateSubtitlesForClip.mockImplementation(
    (clip: unknown, asset: unknown, ready: boolean) => Boolean(ready && clip && asset),
  );
});

// ── 检测参数（默认值零回归 + 注入 run 函数） ─────────────────

describe('useSmartRoughCut detection params', () => {
  it('defaults every detection param to the original hardcoded value', () => {
    const { result } = setupHook();
    // 默认值 = M2 之前的硬编码值，零行为回归
    expect(result.current.sceneThreshold).toBe(0.3);
    expect(result.current.silenceMinDb).toBe(-40);
    expect(result.current.silenceMinDuration).toBe(0.5);
    expect(result.current.silenceMargin).toBe(0.1);
    expect(result.current.dialogueSensitivity).toBe('medium');
  });

  it('passes the configured scene threshold to detectSceneChanges', async () => {
    mockDetectSceneChanges.mockResolvedValue({ sceneTimes: [2] });
    const { result } = setupHook();

    act(() => {
      result.current.setSceneThreshold(0.2);
    });
    await act(async () => {
      await result.current.runSceneDetection();
    });

    expect(mockDetectSceneChanges).toHaveBeenCalledWith(
      expect.objectContaining({ threshold: 0.2 }),
    );
  });

  it('passes the configured silence params to detectClipSilence', async () => {
    mockDetectClipSilence.mockResolvedValue([{ start: 1, end: 2, duration: 1 }]);
    const { result } = setupHook();

    act(() => {
      result.current.setSilenceMinDb(-55);
      result.current.setSilenceMinDuration(0.2);
      result.current.setSilenceMargin(0.25);
    });
    await act(async () => {
      await result.current.runSilenceDetection();
    });

    expect(mockDetectClipSilence).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { thresholdDb: -55, minSilenceDuration: 0.2, marginDuration: 0.25 },
    );
  });

  it('passes the configured dialogue sensitivity to detectClipDialogue', async () => {
    mockDetectClipDialogue.mockResolvedValue([{ start: 0.5, end: 1.5 }]);
    const { result } = setupHook();

    act(() => {
      result.current.setDialogueSensitivity('high');
    });
    await act(async () => {
      await result.current.runDialogueRoughCut();
    });

    expect(mockDetectClipDialogue).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'high');
  });

  it('exposes setPlayheadTime from the editor store', () => {
    const setPlayheadTime = vi.fn();
    const { result } = setupHook({ setPlayheadTime });
    act(() => {
      result.current.setPlayheadTime(1.5);
    });
    expect(setPlayheadTime).toHaveBeenCalledWith(1.5);
  });
});

// ── 门控派生 ────────────────────────────────────────────────

describe('useSmartRoughCut gating', () => {
  it('enables scene detection only for video clips with a resolvable asset', () => {
    const { result } = setupHook();
    expect(result.current.canRunScene).toBe(true);

    const audio = setupHook({ clip: makeClip({ id: 'clip-a', type: 'audio', mediaId: 'media-1' }) });
    expect(audio.result.current.canRunScene).toBe(false);

    const noAsset = setupHook({ media: [] });
    expect(noAsset.result.current.canRunScene).toBe(false);
  });

  it('enables silence and dialogue for audio or video-with-audio clips', () => {
    const withAudio = setupHook();
    expect(withAudio.result.current.canRunSilence).toBe(true);
    expect(withAudio.result.current.canRunDialogue).toBe(true);

    const silentVideo = setupHook({
      media: [makeAsset({ id: 'media-1', hasAudio: false })],
    });
    expect(silentVideo.result.current.canRunSilence).toBe(false);
    expect(silentVideo.result.current.canRunDialogue).toBe(false);

    const audioClip = setupHook({ clip: makeClip({ id: 'clip-a', type: 'audio', mediaId: 'media-1' }) });
    expect(audioClip.result.current.canRunSilence).toBe(true);
    expect(audioClip.result.current.canRunDialogue).toBe(true);
  });

  it('derives canRunWhisper from whisper availability and clip eligibility', async () => {
    const { result } = setupHook();
    await waitFor(() => expect(result.current.whisperAvailability.ready).toBe(true));
    expect(result.current.canRunWhisper).toBe(true);
    expect(mockCanGenerateSubtitlesForClip).toHaveBeenCalledWith(expect.anything(), expect.anything(), true);
  });

  it('keeps canRunWhisper false while availability is not ready', () => {
    mockGetWhisperAvailability.mockImplementation(() => new Promise(() => undefined));
    const { result } = setupHook();
    expect(result.current.canRunWhisper).toBe(false);
  });

  it('derives canRunBroll from main visual clips and available candidates', () => {
    const empty = setupHook({ project: makeProject({ tracks: [makeTrack({ id: 'track-video' })] }) });
    expect(empty.result.current.canRunBroll).toBe(false);

    const withCandidate = setupHook({
      media: [makeAsset({ id: 'media-1' }), makeAsset({ id: 'media-broll' })],
    });
    expect(withCandidate.result.current.canRunBroll).toBe(true);
  });

  it('derives canRunRhythm from selected visual clips and at least two beats', () => {
    const none = setupHook();
    expect(none.result.current.canRunRhythm).toBe(false);

    const withBeats = setupHook({
      clip: makeClip({
        id: 'clip-1',
        type: 'video',
        mediaId: 'media-1',
        beatMarkers: [{ id: 'b1', time: 1 }, { id: 'b2', time: 2 }],
      }),
      selectedClipIds: ['clip-1'],
    });
    expect(withBeats.result.current.canRunRhythm).toBe(true);
  });

  it('reflects anyRunning from the orchestrator step state', async () => {
    const { result } = setupHook();
    expect(result.current.anyRunning).toBe(false);

    act(() => {
      useSmartRoughCutOrchestratorStore.getState().markStepRunning('scene');
    });
    await waitFor(() => expect(result.current.anyRunning).toBe(true));

    act(() => {
      useSmartRoughCutOrchestratorStore.getState().markStepComplete('scene');
    });
    await waitFor(() => expect(result.current.anyRunning).toBe(false));
  });
});

// ── scene 流程 ──────────────────────────────────────────────

describe('useSmartRoughCut scene flow', () => {
  it('stores pending candidates and completes without counting splits yet', async () => {
    mockDetectSceneChanges.mockResolvedValue({ sceneTimes: [2, 3] });
    const { result } = setupHook();

    await act(async () => {
      await result.current.runSceneDetection();
    });

    expect(result.current.pendingScene).toBeDefined();
    expect(result.current.pendingScene?.items).toHaveLength(3);
    expect(result.current.pendingScene?.selection).toEqual({ 'scene-0': true, 'scene-1': true, 'scene-2': true });
    expect(orchestrator().steps.scene.status).toBe('complete');
    // 双次 markStepComplete 语义：检测完成时报告计数仍为 0，apply 时才写入。
    expect(orchestrator().report.sceneSplits).toBe(0);
    expect(mockDetectSceneChanges).toHaveBeenCalledWith({ path: 'D:/media/media-1.mp4', threshold: 0.3, duration: 10 });
  });

  it('applies selected splits through SplitClipAtTimesCommand and reports the count', async () => {
    mockDetectSceneChanges.mockResolvedValue({ sceneTimes: [2, 3] });
    const { result } = setupHook();
    await act(async () => {
      await result.current.runSceneDetection();
    });

    await act(async () => {
      result.current.applySceneSplit();
    });

    expect(mockExecute).toHaveBeenCalledTimes(1);
    const command = mockExecute.mock.calls[0][0];
    expect(command).toBeInstanceOf(SplitClipAtTimesCommand);
    expect(orchestrator().report.sceneSplits).toBe(2);
    expect(result.current.pendingScene).toBeUndefined();
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'success', title: expect.stringContaining('场景') }),
    );
  });

  it('applies only the split times of checked items', async () => {
    mockDetectSceneChanges.mockResolvedValue({ sceneTimes: [2, 3] });
    const { result } = setupHook();
    await act(async () => {
      await result.current.runSceneDetection();
    });

    act(() => {
      result.current.setPendingScene((current) =>
        current ? { ...current, selection: { ...current.selection, 'scene-1': false } } : current,
      );
    });
    await act(async () => {
      result.current.applySceneSplit();
    });

    expect(orchestrator().report.sceneSplits).toBe(1);
  });

  it('marks the step as error when no media is selected', async () => {
    const { result } = renderHook(() => useSmartRoughCut(undefined, []));
    await act(async () => {
      await result.current.runSceneDetection();
    });
    expect(orchestrator().steps.scene.status).toBe('error');
    expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ kind: 'warning' }));
    expect(mockExecute).not.toHaveBeenCalled();
  });
});

// ── silence 流程 ────────────────────────────────────────────

describe('useSmartRoughCut silence flow', () => {
  it('stores pending silent ranges without counting removed seconds yet', async () => {
    mockDetectClipSilence.mockResolvedValue([{ start: 1, end: 2, duration: 1 }]);
    const { result } = setupHook();

    await act(async () => {
      await result.current.runSilenceDetection();
    });

    expect(result.current.pendingSilence?.items).toHaveLength(1);
    expect(result.current.pendingSilence?.items[0]).toMatchObject({ id: 'silence-0' });
    expect(orchestrator().steps.silence.status).toBe('complete');
    expect(orchestrator().report.removedSilenceSeconds).toBe(0);
    expect(mockDetectClipSilence).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { thresholdDb: -40, minSilenceDuration: 0.5, marginDuration: 0.1 },
    );
  });

  it('applies removal through RemoveSilenceCommand and reports removed seconds', async () => {
    mockDetectClipSilence.mockResolvedValue([{ start: 1, end: 2, duration: 1 }]);
    const { result } = setupHook();
    await act(async () => {
      await result.current.runSilenceDetection();
    });

    await act(async () => {
      result.current.applySilenceRemoval();
    });

    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(mockExecute.mock.calls[0][0]).toBeInstanceOf(RemoveSilenceCommand);
    expect(orchestrator().report.removedSilenceSeconds).toBe(1);
    expect(result.current.pendingSilence).toBeUndefined();
  });

  it('skips the command when nothing is selected but still completes the step', async () => {
    mockDetectClipSilence.mockResolvedValue([{ start: 1, end: 2, duration: 1 }]);
    const { result } = setupHook();
    await act(async () => {
      await result.current.runSilenceDetection();
    });

    act(() => {
      result.current.setPendingSilence((current) =>
        current ? { ...current, selection: { 'silence-0': false } } : current,
      );
    });
    await act(async () => {
      result.current.applySilenceRemoval();
    });

    expect(mockExecute).not.toHaveBeenCalled();
    expect(orchestrator().report.removedSilenceSeconds).toBe(0);
    expect(result.current.pendingSilence).toBeUndefined();
  });
});

// ── whisper 流程 ────────────────────────────────────────────

describe('useSmartRoughCut whisper flow', () => {
  it('adds the subtitle track and reports clip count', async () => {
    mockBuildWhisperSubtitleTrackForClip.mockResolvedValue({
      id: 'track-subtitle',
      type: 'subtitle',
      name: '字幕',
      clips: [{ id: 'sub-1' }, { id: 'sub-2' }],
    });
    const { result } = setupHook();

    await act(async () => {
      await result.current.runWhisper();
    });

    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(mockExecute.mock.calls[0][0]).toBeInstanceOf(AddTrackCommand);
    expect(editorState.setSelectedClipId).toHaveBeenCalledWith('sub-1');
    expect(orchestrator().report.subtitleClips).toBe(2);
    expect(orchestrator().steps.whisper.status).toBe('complete');
  });

  it('fails when availability is not ready', async () => {
    mockGetWhisperAvailability.mockResolvedValue({ ready: false, error: 'not configured' });
    const { result } = setupHook();

    await act(async () => {
      await result.current.runWhisper();
    });

    expect(orchestrator().steps.whisper.status).toBe('error');
    expect(orchestrator().steps.whisper.error).toBe('not configured');
    expect(mockExecute).not.toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ kind: 'warning' }));
  });

  it('fails when the generated track has no cues', async () => {
    mockBuildWhisperSubtitleTrackForClip.mockResolvedValue({ clips: [] });
    const { result } = setupHook();

    await act(async () => {
      await result.current.runWhisper();
    });

    expect(orchestrator().steps.whisper.status).toBe('error');
    expect(mockExecute).not.toHaveBeenCalled();
  });
});

// ── dialogue 流程 ───────────────────────────────────────────

describe('useSmartRoughCut dialogue flow', () => {
  it('runs DialogueRoughCutCommand and selects the first generated clip', async () => {
    mockDetectClipDialogue.mockResolvedValue([{ start: 0.5, end: 1.5 }]);
    const { result } = setupHook();

    await act(async () => {
      await result.current.runDialogueRoughCut();
    });

    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(mockExecute.mock.calls[0][0]).toBeInstanceOf(DialogueRoughCutCommand);
    expect(editorState.setSelectedClipId).toHaveBeenCalledWith('clip-1-dialogue-1');
    expect(orchestrator().report.dialogueClips).toBe(1);
    expect(mockDetectClipDialogue).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'medium');
  });
});

// ── broll 流程 ──────────────────────────────────────────────

describe('useSmartRoughCut broll flow', () => {
  it('ensures the target track then inserts broll clips', async () => {
    const { result } = setupHook({
      media: [makeAsset({ id: 'media-1' }), makeAsset({ id: 'media-broll' })],
      selectedClipIds: ['clip-1'],
    });

    await act(async () => {
      await result.current.runBrollInsert();
    });

    expect(mockExecute).toHaveBeenCalledTimes(2);
    expect(mockExecute.mock.calls[0][0]).toBeInstanceOf(AddTrackCommand);
    expect(mockExecute.mock.calls[1][0]).toBeInstanceOf(BrollInsertCommand);
    expect(orchestrator().report.brollClips).toBeGreaterThan(0);
    expect(orchestrator().steps.broll.status).toBe('complete');
  });

  it('fails with brollUnavailable when no candidates exist', async () => {
    const { result } = setupHook({ selectedClipIds: ['clip-1'], media: [] });

    await act(async () => {
      await result.current.runBrollInsert();
    });

    expect(orchestrator().steps.broll.status).toBe('error');
    expect(mockExecute).not.toHaveBeenCalledWith(expect.any(BrollInsertCommand));
  });
});

// ── rhythm 流程 ─────────────────────────────────────────────

describe('useSmartRoughCut rhythm flow', () => {
  it('runs RhythmAssembleCommand against the resolved target track', async () => {
    const { result } = setupHook({
      clip: makeClip({
        id: 'clip-1',
        type: 'video',
        mediaId: 'media-1',
        trackId: 'track-video',
        beatMarkers: [{ id: 'b1', time: 1 }, { id: 'b2', time: 2 }],
      }),
      selectedClipIds: ['clip-1'],
    });

    await act(async () => {
      await result.current.runRhythmAssemble();
    });

    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(mockExecute.mock.calls[0][0]).toBeInstanceOf(RhythmAssembleCommand);
    expect(editorState.setSelectedClipId).toHaveBeenCalledWith('clip-1-rhythm-1');
    expect(orchestrator().report.rhythmClips).toBeGreaterThan(0);
    expect(orchestrator().steps.rhythm.status).toBe('complete');
  });

  it('fails with rhythmUnavailable when fewer than two beats exist', async () => {
    const { result } = setupHook({
      clip: makeClip({ id: 'clip-1', type: 'video', mediaId: 'media-1', beatMarkers: [{ id: 'b1', time: 1 }] }),
      selectedClipIds: ['clip-1'],
    });

    await act(async () => {
      await result.current.runRhythmAssemble();
    });

    expect(orchestrator().steps.rhythm.status).toBe('error');
    expect(mockExecute).not.toHaveBeenCalled();
  });
});

// ── effects ─────────────────────────────────────────────────

describe('useSmartRoughCut effects', () => {
  it('does not update availability after unmount (disposed guard)', async () => {
    const { result, unmount } = setupHook();
    unmount();

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockGetWhisperAvailability).toHaveBeenCalled();
    expect(result.current.whisperAvailability.ready).toBe(false);
  });

  it('falls back rhythmTrackId to the first selected visual clip track, then the first video track', () => {
    const withSelection = setupHook({
      clip: makeClip({ id: 'clip-1', type: 'video', mediaId: 'media-1', trackId: 'track-video' }),
      selectedClipIds: ['clip-1'],
    });
    expect(withSelection.result.current.rhythmTrackId).toBe('track-video');

    const withoutSelection = setupHook();
    expect(withoutSelection.result.current.rhythmTrackId).toBe('track-video');
  });
});

// ── applySemanticSuggestion（M3-3 A1 单条采纳） ──────────────

describe('useSmartRoughCut applySemanticSuggestion', () => {
  /** setupHook 默认 clip：时间线 [0, 4)，trimStart=1，speed=1 → 源域 [1, 5) */
  function makeSemanticSuggestion(timeRange: { start: number; end: number }) {
    return {
      id: 'semantic-0',
      timeRange,
      markerType: 'climax' as const,
      confidence: 0.7,
      label: '高潮片段',
      reason: '重点内容',
      source: 'narrative' as const,
    };
  }

  it('applies a partial suggestion through ApplyRoughCutProposalCommand and trims the clip', () => {
    const { result } = setupHook();

    let outcome: { ok: boolean; error?: string } | undefined;
    act(() => {
      // 建议绝对区间 [1, 3) → 源域 [2, 4)，保留 2s（原 4s）
      outcome = result.current.applySemanticSuggestion(makeSemanticSuggestion({ start: 1, end: 3 }));
    });

    expect(outcome).toEqual({ ok: true });
    expect(mockExecute).toHaveBeenCalledTimes(1);
    const command = mockExecute.mock.calls[0][0];
    expect(command.constructor.name).toBe('ApplyRoughCutProposalCommand');
    const trimmed = mockTimeline.tracks[0].clips[0];
    expect(trimmed.duration).toBeCloseTo(2, 6);
    expect(trimmed.start).toBeCloseTo(0, 6);
  });

  it('returns a failure result without mutating the timeline for a whole-clip suggestion', () => {
    const { result } = setupHook();
    const before = mockTimeline;

    let outcome: { ok: boolean; error?: string } | undefined;
    act(() => {
      // 建议覆盖整个 clip [0, 4) → 命令侧守卫抛错
      outcome = result.current.applySemanticSuggestion(makeSemanticSuggestion({ start: 0, end: 4 }));
    });

    expect(outcome?.ok).toBe(false);
    expect(outcome?.error).toContain('entire clip');
    expect(mockTimeline).toBe(before);
    expect(mockTimeline.tracks[0].clips[0].duration).toBe(4);
  });

  it('returns a failure result when no clip is selected', () => {
    const { result } = renderHook(() => useSmartRoughCut(undefined, []));

    let outcome: { ok: boolean; error?: string } | undefined;
    act(() => {
      outcome = result.current.applySemanticSuggestion(makeSemanticSuggestion({ start: 1, end: 3 }));
    });

    expect(outcome?.ok).toBe(false);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('records a local adoption event on success but not on failure', () => {
    localStorage.removeItem('open-factory:semantic-suggestion-adoptions');
    const success = setupHook();
    act(() => {
      success.result.current.applySemanticSuggestion(makeSemanticSuggestion({ start: 1, end: 3 }));
    });
    expect(JSON.parse(localStorage.getItem('open-factory:semantic-suggestion-adoptions') ?? '[]')).toEqual([
      { source: 'narrative', ts: expect.any(Number) },
    ]);

    // 整 clip 建议失败 → 不追加第二笔
    act(() => {
      success.result.current.applySemanticSuggestion(makeSemanticSuggestion({ start: 0, end: 4 }));
    });
    expect(JSON.parse(localStorage.getItem('open-factory:semantic-suggestion-adoptions') ?? '[]')).toHaveLength(1);
    localStorage.removeItem('open-factory:semantic-suggestion-adoptions');
  });
});

// ── semanticSuggestions 双源派生与 semanticReady 门控（M3 扩展） ──

describe('useSmartRoughCut semanticSuggestions dual source', () => {
  /** contentAnalysis 收紧形态：首 turn（源域 1.6）+ 尾部低能量段（源域 4.3 起） */
  function makeTightenableClip(): ReturnType<typeof makeClip> {
    return makeClip({
      id: 'clip-1',
      type: 'video',
      trackId: 'track-video',
      mediaId: 'media-1',
      duration: 4,
      trimStart: 1,
      contentAnalysis: {
        version: 1,
        analyzedAt: '2026-08-27T00:00:00.000Z',
        sceneTypes: ['dialogue'],
        primarySceneType: 'dialogue',
        segments: [
          { start: 1, end: 1.6, sceneTypes: ['dialogue'], brightness: 0.5, motion: 0.2, loudness: 0.05 },
          { start: 1.6, end: 4.3, sceneTypes: ['dialogue'], brightness: 0.5, motion: 0.2, loudness: 0.6 },
          { start: 4.3, end: 5, sceneTypes: ['dialogue'], brightness: 0.5, motion: 0.2, loudness: 0.04 },
        ],
        emotionCurve: [],
        dialogueTurns: [
          { start: 1.6, end: 4.3, loudness: 0.6 },
        ],
      },
    });
  }

  it('gates semanticReady off when neither transcript nor contentAnalysis is ready', () => {
    const { result } = setupHook();

    expect(result.current.semanticReady).toBe(false);
    expect(result.current.semanticSuggestions).toEqual([]);
  });

  it('enables semanticReady and derives tighten suggestions when only contentAnalysis exists', () => {
    const clip = makeTightenableClip();
    const { result } = setupHook({ clip });

    expect(result.current.semanticReady).toBe(true);
    // 无转写 → 无 narrative；仅收紧类
    expect(result.current.semanticSuggestions.map((item) => item.source)).toEqual(['head-trim', 'tail-trim']);
    // head：源 1.6−0.3=1.3 → abs = 0 + (1.3−1) = 0.3；keep [0.3, 4]
    const head = result.current.semanticSuggestions[0];
    expect(head.id).toBe('semantic-head-trim');
    expect(head.timeRange).toEqual({ start: 0.3, end: 4 });
    // tail：run 起点 4.3 + 0.2 = 4.5 → abs = 0 + (4.5−1) = 3.5；keep [0, 3.5]
    const tail = result.current.semanticSuggestions[1];
    expect(tail.id).toBe('semantic-tail-trim');
    expect(tail.timeRange).toEqual({ start: 0, end: 3.5 });
  });
});

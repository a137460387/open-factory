// @vitest-environment jsdom
// 覆盖目标：apps/desktop/src/components/Timeline/useTimelineHandlers.ts（原 0% → ≥75%）
// 策略：直接调用 facade 工厂 useTimelineHandlers(params)，断言组合后的 handler 集合
// 完整、handlerRefs 注入回调和 openClipMenu facade 行为。
import { describe, expect, it, vi, beforeEach } from 'vitest';

const { executeMock, showToastMock } = vi.hoisted(() => ({
  executeMock: vi.fn(),
  showToastMock: vi.fn(),
}));

vi.mock('../../../store/commandManager', () => ({
  commandManager: { execute: (command: unknown) => executeMock(command) },
  projectAccessor: { getProject: vi.fn(), setProject: vi.fn() },
  timelineAccessor: { getTimeline: vi.fn(), setTimeline: vi.fn() },
  setEditorStoreGetter: vi.fn(),
  addOnExecuteListener: vi.fn(),
}));

vi.mock('../../../lib/toast', () => ({
  showToast: (toast: unknown) => showToastMock(toast),
}));

vi.mock('../../../lib/tauri-bridge', () => ({
  saveFileDialog: vi.fn(),
  writeFile: vi.fn(),
  getAppDataDir: vi.fn(async () => 'D:/AppData'),
  openFileDialog: vi.fn(async () => []),
  listenBridge: vi.fn(async () => () => {}),
  listenCoverFrameProgress: vi.fn(async () => () => {}),
  analyzeWaveform: vi.fn(async () => []),
  detectSceneChanges: vi.fn(async () => ({ sceneTimes: [] })),
  cancelSceneDetection: vi.fn(async () => undefined),
  extractCoverFrames: vi.fn(async () => ({ frames: [] })),
}));

vi.mock('../../../lib/whisper', () => ({
  canGenerateSubtitlesForClip: vi.fn(() => true),
  buildWhisperSubtitleTrackForClip: vi.fn(),
  getWhisperAvailability: vi.fn(async () => ({ ready: true })),
}));

vi.mock('../../../lib/dialogueDetection', () => ({
  detectClipDialogue: vi.fn(async () => []),
}));

vi.mock('../../../lib/ttsVoiceover', () => ({
  generateTtsVoiceover: vi.fn(async () => undefined),
  collectSubtitleClipsForTts: vi.fn(() => []),
}));

vi.mock('../../../media/background-media-task-queue', () => ({
  runUiFeedbackTask: (task: () => unknown) => task(),
}));

import { useTimelineHandlers } from '../useTimelineHandlers';
import { makeClip, makeParams, makeProject, makeTrack } from '../hooks/timeline/__tests__/test-fixtures';

function setup(overrides: Parameters<typeof makeParams>[0] = {}) {
  const clip = makeClip({ id: 'clip-a', type: 'video' });
  const project = overrides.project ?? makeProject({ tracks: [makeTrack({ clips: [clip] })] });
  const params = makeParams({ ...overrides, project, allClips: [clip] });
  const handlers = useTimelineHandlers(params);
  return { params, handlers };
}

beforeEach(() => {
  executeMock.mockReset();
  showToastMock.mockReset();
});

describe('useTimelineHandlers — facade 组合', () => {
  it('聚合全部子 handler 域', () => {
    const { handlers } = setup();
    // track management
    expect(typeof handlers.addTrack).toBe('function');
    expect(typeof handlers.selectTrackHeader).toBe('function');
    // clip operations
    expect(typeof handlers.updateClipColor).toBe('function');
    expect(typeof handlers.addTransition).toBe('function');
    // drag
    expect(typeof handlers.onPointerMove).toBe('function');
    expect(typeof handlers.onDragStart).toBe('function');
    // selection
    expect(typeof handlers.selectClip).toBe('function');
    // nested media
    expect(typeof handlers.packClipMenuSelection).toBe('function');
    // gap
    expect(typeof handlers.closeGap).toBe('function');
    // volume envelope
    expect(typeof handlers.addVolumeEnvelopePoint).toBe('function');
    // ai features
    expect(typeof handlers.openSceneDetection).toBe('function');
    // navigation
    expect(typeof handlers.onWheel).toBe('function');
    expect(typeof handlers.syncScrollViewport).toBe('function');
    // drop
    expect(typeof handlers.onTimelineDrop).toBe('function');
    // keyboard
    expect(typeof handlers.onKeyDown).toBe('function');
    // snap utils
    expect(typeof handlers.minFrameDuration).toBe('function');
  });

  it('handlerRefs 注入四个快捷键回调', () => {
    const handlerRefs = { current: {} as Record<string, () => void> };
    const params = makeParams();
    (params as { handlerRefs?: unknown }).handlerRefs = handlerRefs;
    useTimelineHandlers(params);
    expect(typeof handlerRefs.current.quickAddTimelineNote).toBe('function');
    expect(typeof handlerRefs.current.toggleProtectedRangeAtPlayhead).toBe('function');
    expect(typeof handlerRefs.current.syncScrollViewport).toBe('function');
    expect(typeof handlerRefs.current.openSceneDetection).toBe('function');
  });

  it('findClip 命中时返回 clip，未命中时抛错', () => {
    const { handlers } = setup();
    expect(handlers.findClip('clip-a').id).toBe('clip-a');
    expect(() => handlers.findClip('clip-missing')).toThrow('Clip clip-missing not found');
  });

  it('openClipMenu 关闭其它菜单并写入坐标夹持状态', () => {
    const { params, handlers } = setup();
    handlers.openClipMenu({ clipId: 'clip-a', clipType: 'video', x: 10000, y: 10000 } as never);
    expect(params.setters.setTransitionMenu).toHaveBeenCalledWith(undefined);
    expect(params.setters.setGapMenu).toHaveBeenCalledWith(undefined);
    const menu = (params.setters.setClipMenu as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(menu.clipId).toBe('clip-a');
    expect(menu.x).toBeLessThanOrEqual(window.innerWidth);
    expect(menu.y).toBeLessThanOrEqual(window.innerHeight);
  });

  it('子 handler 经 facade 调用执行命令（updateClipColor 走 UpdateClipCommand）', () => {
    const { handlers } = setup();
    handlers.updateClipColor('clip-a', 'red');
    expect(executeMock).toHaveBeenCalledTimes(1);
  });
});

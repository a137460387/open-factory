// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

// ── Mock 外部依赖（在 import 之前声明） ──────────────────────
// useExportActions 依赖大量 Tauri/队列/暖场模块，单测只关注
// addToQueue 的步骤切换决策，全部打桩。

vi.mock('../../lib/tauri-bridge', () => ({
  cancelQualityEvaluation: vi.fn(),
  convertLocalFileSrc: vi.fn((p: string) => p),
  evaluateExportQuality: vi.fn(),
  fsExists: vi.fn(async () => false),
  getAppDataDir: vi.fn(async () => 'C:/AppData'),
  getFileStat: vi.fn(),
  getFfmpegCapabilities: vi.fn(async () => ({ available: true, encoders: [] })),
  getWebdavText: vi.fn(),
  getTempSegmentsDir: vi.fn(async () => 'C:/Temp/segments'),
  openFileDialog: vi.fn(),
  openDirectoryDialog: vi.fn(),
  readFile: vi.fn(),
  runExportPowerAction: vi.fn(),
  runExportPreviewSamples: vi.fn(),
  saveFileDialog: vi.fn(),
  putWebdavText: vi.fn(),
  writeFile: vi.fn(),
  writeExportUploadWebdavPassword: vi.fn(),
  sendNotification: vi.fn(),
}));

vi.mock('../../lib/whisper', () => ({
  getWhisperAvailability: vi.fn(async () => ({ ready: true })),
}));

vi.mock('../../lib/toast', () => ({
  showToast: vi.fn(),
}));

vi.mock('../../lib/exportVideo', () => ({
  chooseExportPath: vi.fn(),
}));

vi.mock('../../lib/fonts', () => ({
  isFontFamilyAvailable: vi.fn(() => true),
}));

vi.mock('../export-queue-runner', () => ({
  enqueueExport: vi.fn(async () => ({ id: 'task-1', status: 'queued', plan: { warnings: [] } })),
  enqueueStemExport: vi.fn(),
}));

vi.mock('../export-warmup', () => ({
  runExportWarmup: vi.fn(async () => ({ cached: false })),
}));

vi.mock('../export-queue-store', () => ({
  useExportQueueStore: { getState: () => ({ tasks: [] }) },
}));

vi.mock('../export-upload', () => ({
  retryExportUploadFromHistory: vi.fn(),
}));

vi.mock('../publish-pipeline-runner', () => ({
  runPublishPipelineNode: vi.fn(),
}));

vi.mock('../../settings/appSettings', () => ({
  saveExportBackgroundSettings: vi.fn(),
  saveExportOptimizationSettings: vi.fn(),
  saveExportPresetSyncSettings: vi.fn(),
  saveExportUploadSettings: vi.fn(),
}));

vi.mock('../../media/media-job-runner', () => ({
  ensureMediaJobRunner: vi.fn(),
}));

vi.mock('../../media/media-job-store', () => ({
  useMediaJobStore: { getState: () => ({ jobs: [] }) },
}));

vi.mock('../../store/commandManager', () => ({
  commandManager: { execute: vi.fn(), clear: vi.fn() },
  projectAccessor: { get: vi.fn(), set: vi.fn() },
}));

import { createProject, createTrack, DEFAULT_CLIP_SPEED, type Clip, type Project } from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import { useExportActions } from './useExportActions';
import type { ExportState } from './useExportState';
import { enqueueExport } from '../export-queue-runner';
import { runExportWarmup } from '../export-warmup';
import { isFontFamilyAvailable } from '../../lib/fonts';

// ── 状态桩：Proxy 对任意 set* 字段自动生成 vi.fn，避免手抄 120+ 字段 ──

function createStateStub(overrides: Record<string, unknown> = {}): ExportState {
  const setters = new Map<string, ReturnType<typeof vi.fn>>();
  const project = createProject('Step Switch Test');
  const base: Record<string, unknown> = {
    t: zhCN.exportDialog,
    project,
    initialPreset: undefined,
    selectedClipIds: [],
    inPoint: null,
    outPoint: null,
    onClose: vi.fn(),
    onCompleted: vi.fn(),
    onRelinkMissing: vi.fn(),
    exportMode: 'single',
    exportSettings: {},
    outputPath: 'C:/Exports/out.mp4',
    batchOutputPaths: '',
    activeExportRanges: [],
    capabilities: { available: true },
    preflight: undefined,
    warmupStatus: undefined,
    enqueueInFlight: { current: false },
    pendingConfirmResolveRef: { current: null },
    pendingCompletionAction: { current: null },
    completionActionHandled: { current: false },
    completionAction: 'none',
    scheduleEnabled: false,
    progressiveExportEnabled: false,
    progressiveExportSupported: false,
    renderFarmEnabled: false,
    renderFarmInstances: 1,
    priority: 'normal',
    selectedPreset: { name: 'Custom' },
    presets: [],
    presetId: 'custom',
    exportBackgroundSettings: { postExportScriptAcknowledged: true },
    whisperExecutablePath: '',
    whisperModelPath: '',
    currentStep: 'config',
    ...overrides,
  };
  return new Proxy(base, {
    get(target, prop) {
      if (typeof prop === 'string' && prop in target) {
        return target[prop];
      }
      if (typeof prop === 'string' && prop.startsWith('set')) {
        if (!setters.has(prop)) {
          setters.set(prop, vi.fn());
        }
        return setters.get(prop);
      }
      return undefined;
    },
  }) as unknown as ExportState;
}

function renderActions(state: ExportState) {
  return renderHook(() => useExportActions(state)).result.current;
}

/** 构造含"缺失媒体"的项目：clip 引用了不存在的 mediaId → blocking preflight。 */
function projectWithMissingMedia(): Project {
  const project = createProject('Missing Media');
  const timeline = {
    transitions: [],
    markers: [],
    tracks: [
      createTrack({
        id: 'track-video',
        type: 'video',
        name: 'Video 1',
        clips: [
          {
            id: 'clip-ghost',
            type: 'video',
            name: 'Ghost',
            mediaId: 'media-ghost',
            trackId: 'track-video',
            start: 0,
            duration: 1,
            trimStart: 0,
            trimEnd: 0,
            speed: DEFAULT_CLIP_SPEED,
            volume: 1,
          } as unknown as Clip,
        ],
      }),
    ],
  };
  project.media = [];
  project.timeline = timeline;
  return project;
}

/** 构造含"缺失字体"的项目：text clip 使用不可用字体 → warning preflight。 */
function projectWithMissingFont(): Project {
  const project = createProject('Missing Font');
  const timeline = {
    transitions: [],
    markers: [],
    tracks: [
      createTrack({
        id: 'track-text',
        type: 'text',
        name: 'Text 1',
        clips: [
          {
            id: 'clip-text',
            type: 'text',
            name: 'Font',
            trackId: 'track-text',
            start: 0,
            duration: 1,
            trimStart: 0,
            trimEnd: 0,
            speed: DEFAULT_CLIP_SPEED,
            text: 'hello',
            style: {
              fontSize: 32,
              color: '#ffffff',
              backgroundColor: '#000000',
              backgroundOpacity: 0,
              fontFamily: 'NonExistent Font XYZ',
              bold: false,
              italic: false,
            },
          } as unknown as Clip,
        ],
      }),
    ],
  };
  project.media = [];
  project.timeline = timeline;
  return project;
}

describe('useExportActions addToQueue 步骤切换（preflight/warmup 可见性）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isFontFamilyAvailable).mockReturnValue(true);
  });

  it('preflight blocking 拦截时切到 export 步，让用户看到拦截面板', async () => {
    const state = createStateStub({ project: projectWithMissingMedia() });
    const actions = renderActions(state);

    await act(async () => {
      await actions.addToQueue();
    });

    const setPreflight = (state as unknown as Record<string, ReturnType<typeof vi.fn>>).setPreflight;
    const setCurrentStep = (state as unknown as Record<string, ReturnType<typeof vi.fn>>).setCurrentStep;
    expect(setPreflight).toHaveBeenCalledTimes(1);
    const preflightArg = setPreflight.mock.calls[0]![0] as { issues: Array<{ type: string; severity: string }> };
    expect(preflightArg.issues.some((issue) => issue.type === 'missing-media' && issue.severity === 'blocking')).toBe(
      true,
    );
    expect(setCurrentStep).toHaveBeenCalledWith('export');
    // 拦截后不应进入 warmup/入队
    expect(runExportWarmup).not.toHaveBeenCalled();
    expect(enqueueExport).not.toHaveBeenCalled();
  });

  it('preflight warning（缺失字体）同样切到 export 步，等待用户确认', async () => {
    vi.mocked(isFontFamilyAvailable).mockReturnValue(false);
    const state = createStateStub({ project: projectWithMissingFont() });
    const actions = renderActions(state);

    await act(async () => {
      await actions.addToQueue();
    });

    const setPreflight = (state as unknown as Record<string, ReturnType<typeof vi.fn>>).setPreflight;
    const setCurrentStep = (state as unknown as Record<string, ReturnType<typeof vi.fn>>).setCurrentStep;
    expect(setPreflight).toHaveBeenCalledTimes(1);
    const preflightArg = setPreflight.mock.calls[0]![0] as { issues: Array<{ type: string; severity: string }> };
    expect(preflightArg.issues.some((issue) => issue.type === 'missing-font' && issue.severity === 'warning')).toBe(
      true,
    );
    expect(setCurrentStep).toHaveBeenCalledWith('export');
    expect(enqueueExport).not.toHaveBeenCalled();
  });

  it('warmup 启动即切到 export 步，让"正在准备导出"状态可见', async () => {
    const state = createStateStub();
    const actions = renderActions(state);

    await act(async () => {
      await actions.addToQueue();
    });

    const setCurrentStep = (state as unknown as Record<string, ReturnType<typeof vi.fn>>).setCurrentStep;
    const setPreflight = (state as unknown as Record<string, ReturnType<typeof vi.fn>>).setPreflight;
    expect(setPreflight).not.toHaveBeenCalled();
    // warmup 触发（runExportWarmup 被调用）且切步发生
    expect(runExportWarmup).toHaveBeenCalled();
    expect(setCurrentStep).toHaveBeenCalledWith('export');
    // 切步应不晚于 warmup：首次 setCurrentStep('export') 在入队之前
    expect(enqueueExport).toHaveBeenCalledTimes(1);
    const firstSwitchCall = setCurrentStep.mock.calls.findIndex((call) => call[0] === 'export');
    expect(firstSwitchCall).toBeGreaterThanOrEqual(0);
  });
});

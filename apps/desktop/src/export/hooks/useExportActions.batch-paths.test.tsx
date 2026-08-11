// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

// ── Mock 外部依赖（与 useExportActions.step-switch.test.tsx 同构）──────────
// 本文件只关注 addToQueue 对 batchOutputPaths 的多路径拆分入队语义。

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

import { createProject } from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import { useExportActions } from './useExportActions';
import type { ExportState } from './useExportState';
import { enqueueExport } from '../export-queue-runner';

// ── 状态桩：Proxy 对任意 set* 字段自动生成 vi.fn，避免手抄 120+ 字段 ──

function createStateStub(overrides: Record<string, unknown> = {}): ExportState {
  const setters = new Map<string, ReturnType<typeof vi.fn>>();
  const base: Record<string, unknown> = {
    t: zhCN.exportDialog,
    project: createProject('Batch Paths Test'),
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

/** enqueueExport 第 2 个实参是 outputPath（见 enqueueSelectedJobs 循环）。 */
function enqueuedOutputPaths(): unknown[] {
  return vi.mocked(enqueueExport).mock.calls.map((call) => call[1]);
}

describe('useExportActions addToQueue 多路径批量入队（batchOutputPaths 换行拆分）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('batchOutputPaths 每行一个路径，逐行入队为独立任务', async () => {
    const state = createStateStub({
      batchOutputPaths: 'C:/Exports/a.mp4\nC:/Exports/b.mp4\nC:/Exports/c.mp4',
    });
    const actions = renderActions(state);

    await act(async () => {
      await actions.addToQueue();
    });

    expect(enqueueExport).toHaveBeenCalledTimes(3);
    expect(enqueuedOutputPaths()).toEqual(['C:/Exports/a.mp4', 'C:/Exports/b.mp4', 'C:/Exports/c.mp4']);
  });

  it('兼容 CRLF 换行，过滤空行并 trim 首尾空白', async () => {
    const state = createStateStub({
      batchOutputPaths: 'C:/Exports/a.mp4\r\n\r\n   \nC:/Exports/b.mp4  ',
    });
    const actions = renderActions(state);

    await act(async () => {
      await actions.addToQueue();
    });

    expect(enqueueExport).toHaveBeenCalledTimes(2);
    expect(enqueuedOutputPaths()).toEqual(['C:/Exports/a.mp4', 'C:/Exports/b.mp4']);
  });

  it('batchOutputPaths 为空时回退单路径 outputPath（只入队 1 个任务）', async () => {
    const state = createStateStub({
      batchOutputPaths: '',
      outputPath: 'C:/Exports/single.mp4',
    });
    const actions = renderActions(state);

    await act(async () => {
      await actions.addToQueue();
    });

    expect(enqueueExport).toHaveBeenCalledTimes(1);
    expect(enqueuedOutputPaths()).toEqual(['C:/Exports/single.mp4']);
  });

  it('入队后把 outputPath 同步为首个批量路径（对齐拆分前行为）', async () => {
    const state = createStateStub({
      batchOutputPaths: 'C:/Exports/a.mp4\nC:/Exports/b.mp4',
    });
    const actions = renderActions(state);

    await act(async () => {
      await actions.addToQueue();
    });

    const setOutputPath = (state as unknown as Record<string, ReturnType<typeof vi.fn>>).setOutputPath;
    expect(setOutputPath).toHaveBeenCalledWith('C:/Exports/a.mp4');
  });
});

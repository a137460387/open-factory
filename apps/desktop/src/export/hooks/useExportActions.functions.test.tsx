// @vitest-environment jsdom
// 源文件：apps/desktop/src/export/hooks/useExportActions.ts（1380 行，四期-B 前覆盖 31.38%）
// 覆盖目标：≥70%（与 useExportState 合并后 export/hooks ≥75%）。
// 模式：沿用 batch-paths/step-switch 的 Proxy 状态桩 + 全量外部依赖 mock，
// 覆盖合规检查、预设管理、预设包、版本批/序列批/编解码对比/流水线/分轨入队、
// 预览、质量评估、暖场、上传设置等剩余分支。

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

const h = vi.hoisted(() => ({
  queue: { tasks: [] as Array<Record<string, unknown>> },
  jobs: { jobs: [] as Array<Record<string, unknown>> },
}));

vi.mock('../../lib/tauri-bridge', () => ({
  cancelQualityEvaluation: vi.fn(),
  convertLocalFileSrc: vi.fn((p: string) => `asset://${p}`),
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
  enqueueExport: vi.fn(async () => ({
    id: 'task-1',
    status: 'queued',
    plan: { warnings: [], inputs: [{ path: 'C:/src.mp4' }] },
  })),
  enqueueStemExport: vi.fn(async () => [{ id: 'stem-1' }, { id: 'stem-2' }]),
}));

vi.mock('../export-warmup', () => ({
  runExportWarmup: vi.fn(async () => ({ cached: false })),
}));

vi.mock('../export-queue-store', () => ({
  useExportQueueStore: { getState: () => ({ tasks: h.queue.tasks }) },
}));

vi.mock('../export-upload', () => ({
  retryExportUploadFromHistory: vi.fn(),
}));

vi.mock('../publish-pipeline-runner', () => ({
  runPublishPipelineNode: vi.fn(),
}));

vi.mock('../../settings/appSettings', () => ({
  saveExportBackgroundSettings: vi.fn(async (v: unknown) => v),
  saveExportOptimizationSettings: vi.fn(async (v: unknown) => v),
  saveExportPresetSyncSettings: vi.fn(async (v: unknown) => v),
  saveExportUploadSettings: vi.fn(async (v: unknown) => v),
}));

vi.mock('../../media/media-job-runner', () => ({
  ensureMediaJobRunner: vi.fn(),
}));

vi.mock('../../media/media-job-store', () => ({
  useMediaJobStore: { getState: () => ({ jobs: h.jobs.jobs }) },
}));

vi.mock('../../store/commandManager', () => ({
  commandManager: { execute: vi.fn(), clear: vi.fn() },
  projectAccessor: { get: vi.fn(), set: vi.fn() },
}));

// export-background：normalizeScheduledExportStart 保留真实语义（未来时间 → ISO）
vi.mock('../export-background', () => ({
  normalizeScheduledExportStart: (value: string | undefined, now = new Date()) => {
    if (typeof value !== 'string' || !value.trim()) return undefined;
    const ms = Date.parse(value);
    if (!Number.isFinite(ms) || ms <= now.getTime()) return undefined;
    return new Date(ms).toISOString();
  },
  localDatetimeInputValue: vi.fn(() => '2026-01-01T00:00'),
}));

import {
  createProject,
  createTrack,
  DEFAULT_CLIP_SPEED,
  getSyncedProjectSequences,
  serializeVersionedBatchTemplate,
  type Clip,
  type ExportOptimizationSuggestion,
} from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import { useExportActions } from './useExportActions';
import type { ExportState } from './useExportState';
import { enqueueExport, enqueueStemExport } from '../export-queue-runner';
import { runExportWarmup } from '../export-warmup';
import { commandManager } from '../../store/commandManager';
import { runPublishPipelineNode } from '../publish-pipeline-runner';
import { retryExportUploadFromHistory } from '../export-upload';
import {
  saveExportOptimizationSettings,
  saveExportBackgroundSettings,
  saveExportUploadSettings,
} from '../../settings/appSettings';
import {
  openFileDialog,
  openDirectoryDialog,
  readFile,
  saveFileDialog,
  writeFile,
  sendNotification,
  getFileStat,
  runExportPreviewSamples,
  evaluateExportQuality,
  cancelQualityEvaluation,
  getWebdavText,
  putWebdavText,
  writeExportUploadWebdavPassword,
} from '../../lib/tauri-bridge';
import { chooseExportPath } from '../../lib/exportVideo';
import { showToast } from '../../lib/toast';
import {
  BUILTIN_EXPORT_PRESETS,
  serializeExportPresetPackage,
  type ExportPreset,
} from '../export-presets';
import {
  createTwoStepExportPipeline as coreTwoStep,
  createPublishAutomationPipeline as corePublish,
} from '@open-factory/editor-core';

// ── 状态桩：Proxy 对任意 set* 字段自动生成 vi.fn ──────────────────────

function createStateStub(overrides: Record<string, unknown> = {}): ExportState {
  const setters = new Map<string, ReturnType<typeof vi.fn>>();
  const project = createProject('Actions Test');
  const batchSequences = getSyncedProjectSequences(project);
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
    scheduledStartInput: '2099-01-01T00:00',
    progressiveExportEnabled: false,
    progressiveExportSupported: false,
    renderFarmEnabled: false,
    renderFarmInstances: 1,
    priority: 'normal',
    selectedPreset: BUILTIN_EXPORT_PRESETS[0],
    presets: [...BUILTIN_EXPORT_PRESETS],
    presetId: BUILTIN_EXPORT_PRESETS[0].id,
    exportBackgroundSettings: { allowPowerActions: false, postExportScriptAcknowledged: true },
    whisperExecutablePath: '',
    whisperModelPath: '',
    currentStep: 'config',
    selectedSpecId: 'youtube-1080p',
    complianceResults: [],
    customPresetName: '',
    versionedBatchTemplate: 'C:/Exports/{version_name}-{platform}.mp4',
    versionedBatchRows: [
      {
        id: 'row-1',
        enabled: true,
        name: '横版',
        presetId: BUILTIN_EXPORT_PRESETS[0].id,
        platform: 'YouTube',
        language: 'zh',
        rangeMode: 'default',
        rangeStart: 0,
        rangeDuration: 5,
        width: 1920,
        height: 1080,
        watermarkMode: 'inherit',
      },
    ],
    latestVersionedBatchId: undefined,
    versionedBatchFileSizes: {},
    batchSequences,
    selectedSequenceIds: batchSequences.map((s) => s.id),
    sequenceBatchTemplate: 'C:/Exports/{sequence}-{index}.mp4',
    sequenceBatchOutputOverrides: {},
    sequenceBatchPresetMode: 'shared',
    sequenceBatchPresetIds: {},
    codecComparePresetIds: BUILTIN_EXPORT_PRESETS.slice(0, 2).map((p) => p.id),
    codecCompareResults: [],
    stemTracks: [{ trackIndex: 0, trackName: 'Music', selected: true, format: 'default' }],
    stemMode: 'independent',
    stemOutputDir: '',
    pipelineConfig: { id: 'p', name: 'P', nodes: [], edges: [] },
    pipelineStatuses: {},
    publishPipelineLogs: [],
    exportOptimizationSettings: { dismissedSuggestionIds: [] },
    exportUploadSettings: { enabled: false, targetType: 'webdav', webdav: {}, local: {} },
    exportPresetSyncSettings: { enabled: false, syncOnStartup: false, conflictMode: 'merge' },
    exportPresetSyncPassword: '',
    qualityTaskId: undefined,
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

/** 触发 setState 更新器并返回结果（断言函数式更新语义用）。 */
function applyUpdater(call: unknown[], current: unknown = []): unknown {
  const [arg] = call;
  return typeof arg === 'function' ? arg(current) : arg;
}

beforeEach(() => {
  // resetAllMocks 清除各测试内 mockResolvedValue/RejectedValue 的持久化实现
  // （防跨测试泄漏，Inspector 模式惯例），vi.fn(impl) 的工厂实现会被还原。
  vi.resetAllMocks();
  h.queue.tasks = [];
  h.jobs.jobs = [];
});

// ── 合规检查 ─────────────────────────────────────────────────────────

describe('useExportActions 合规检查', () => {
  it('runComplianceCheck 用选中规格产出检查结果数组', () => {
    const state = createStateStub({
      draftSettings: { videoCodec: 'libx264', videoBitrate: '12M', width: 1920, height: 1080, fps: 30 },
    });
    const actions = renderActions(state);

    actions.runComplianceCheck();

    const setComplianceResults = (state as unknown as Record<string, ReturnType<typeof vi.fn>>).setComplianceResults;
    expect(setComplianceResults).toHaveBeenCalledTimes(1);
    const results = setComplianceResults.mock.calls[0][0] as Array<{ level: string; message: string }>;
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => 'level' in r && 'message' in r)).toBe(true);
  });

  it('未知规格 id 时不产出结果', () => {
    const state = createStateStub({ selectedSpecId: 'no-such-spec' });
    const actions = renderActions(state);

    actions.runComplianceCheck();

    const setComplianceResults = (state as unknown as Record<string, ReturnType<typeof vi.fn>>).setComplianceResults;
    expect(setComplianceResults).not.toHaveBeenCalled();
  });

  it('applyComplianceFix 对响度失败结果应用 EBU 一键修复并通知', () => {
    const state = createStateStub({
      complianceResults: [
        { name: '响度', level: 'fail', message: '未达标', autoFix: { type: 'loudness', params: {} } },
      ],
    });
    const actions = renderActions(state);

    actions.applyComplianceFix();

    const setDraftSettings = (state as unknown as Record<string, ReturnType<typeof vi.fn>>).setDraftSettings;
    expect(setDraftSettings).toHaveBeenCalledTimes(1);
    const next = applyUpdater(setDraftSettings.mock.calls[0]) as { loudnessNormalization: string };
    expect(next.loudnessNormalization).toBe('ebu');
    expect(sendNotification).toHaveBeenCalled();
  });

  it('无结果时 applyComplianceFix 直接返回', () => {
    const state = createStateStub({ complianceResults: [] });
    const actions = renderActions(state);

    actions.applyComplianceFix();

    const setDraftSettings = (state as unknown as Record<string, ReturnType<typeof vi.fn>>).setDraftSettings;
    expect(setDraftSettings).not.toHaveBeenCalled();
  });
});

// ── 路径选择 ─────────────────────────────────────────────────────────

describe('useExportActions 路径选择', () => {
  it('choosePath 选中路径后写回 outputPath', async () => {
    vi.mocked(chooseExportPath).mockResolvedValue('C:/Exports/picked.mp4' as never);
    const state = createStateStub();
    const actions = renderActions(state);

    await act(async () => {
      await actions.choosePath();
    });

    const setOutputPath = (state as unknown as Record<string, ReturnType<typeof vi.fn>>).setOutputPath;
    expect(setOutputPath).toHaveBeenCalledWith('C:/Exports/picked.mp4');
  });

  it('choosePath 取消时不写回', async () => {
    vi.mocked(chooseExportPath).mockResolvedValue(null as never);
    const state = createStateStub();
    const actions = renderActions(state);

    await act(async () => {
      await actions.choosePath();
    });

    const setOutputPath = (state as unknown as Record<string, ReturnType<typeof vi.fn>>).setOutputPath;
    expect(setOutputPath).not.toHaveBeenCalled();
  });

  it('chooseWatermarkImage 选择 png 后更新草稿设置', async () => {
    vi.mocked(openFileDialog).mockResolvedValue(['C:/imgs/wm.png'] as never);
    const state = createStateStub();
    const actions = renderActions(state);

    await act(async () => {
      await actions.chooseWatermarkImage();
    });

    const setDraftSettings = (state as unknown as Record<string, ReturnType<typeof vi.fn>>).setDraftSettings;
    expect(setDraftSettings).toHaveBeenCalledTimes(1);
  });

  it('chooseWatermarkImage 对话框抛错时写 error', async () => {
    vi.mocked(openFileDialog).mockRejectedValue(new Error('dialog failed') as never);
    const state = createStateStub();
    const actions = renderActions(state);

    await act(async () => {
      await actions.chooseWatermarkImage();
    });

    const setError = (state as unknown as Record<string, ReturnType<typeof vi.fn>>).setError;
    expect(setError).toHaveBeenCalledWith('dialog failed');
  });

  it('chooseAudioVisualizationBackgroundImage 成功/失败路径', async () => {
    vi.mocked(openFileDialog).mockResolvedValue(['C:/imgs/bg.jpg'] as never);
    const state = createStateStub();
    const actions = renderActions(state);
    await act(async () => {
      await actions.chooseAudioVisualizationBackgroundImage();
    });
    expect(
      (state as unknown as Record<string, ReturnType<typeof vi.fn>>).setDraftSettings,
    ).toHaveBeenCalledTimes(1);

    vi.mocked(openFileDialog).mockRejectedValue(new Error('nope') as never);
    const state2 = createStateStub();
    const actions2 = renderActions(state2);
    await act(async () => {
      await actions2.chooseAudioVisualizationBackgroundImage();
    });
    expect((state2 as unknown as Record<string, ReturnType<typeof vi.fn>>).setError).toHaveBeenCalledWith('nope');
  });
});

// ── 预设管理 ─────────────────────────────────────────────────────────

describe('useExportActions 预设管理', () => {
  it('savePreset 保存自定义预设并选中', async () => {
    const state = createStateStub({ customPresetName: '我的预设' });
    const actions = renderActions(state);

    await act(async () => {
      await actions.savePreset();
    });

    const setPresets = (state as unknown as Record<string, ReturnType<typeof vi.fn>>).setPresets;
    const setPresetId = (state as unknown as Record<string, ReturnType<typeof vi.fn>>).setPresetId;
    expect(setPresets).toHaveBeenCalledTimes(1);
    const nextPresets = setPresets.mock.calls[0][0] as ExportPreset[];
    const created = nextPresets.filter((p) => !p.builtin).at(-1);
    expect(created?.name).toBe('我的预设');
    expect(setPresetId).toHaveBeenCalledWith(created?.id);
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }));
    expect(writeFile).toHaveBeenCalled();
  });

  it('savePreset 写入失败时写 error', async () => {
    vi.mocked(writeFile).mockRejectedValue(new Error('disk full') as never);
    const state = createStateStub({ customPresetName: 'X' });
    const actions = renderActions(state);

    await act(async () => {
      await actions.savePreset();
    });

    expect((state as unknown as Record<string, ReturnType<typeof vi.fn>>).setError).toHaveBeenCalledWith('disk full');
  });

  it('deletePreset 对内置预设直接返回', async () => {
    const state = createStateStub();
    const actions = renderActions(state);

    await act(async () => {
      await actions.deletePreset();
    });

    const setPresets = (state as unknown as Record<string, ReturnType<typeof vi.fn>>).setPresets;
    expect(setPresets).not.toHaveBeenCalled();
  });

  it('deletePreset 删除自定义预设后回退到首个预设', async () => {
    const custom = {
      ...BUILTIN_EXPORT_PRESETS[0],
      id: 'custom-9',
      name: 'Custom 9',
      builtin: false,
    };
    const state = createStateStub({ selectedPreset: custom, presets: [...BUILTIN_EXPORT_PRESETS, custom] });
    const actions = renderActions(state);

    await act(async () => {
      await actions.deletePreset();
    });

    const setPresets = (state as unknown as Record<string, ReturnType<typeof vi.fn>>).setPresets;
    const setPresetId = (state as unknown as Record<string, ReturnType<typeof vi.fn>>).setPresetId;
    expect(setPresets).toHaveBeenCalledTimes(1);
    expect((setPresets.mock.calls[0][0] as ExportPreset[]).some((p) => p.id === 'custom-9')).toBe(false);
    expect(setPresetId).toHaveBeenCalledWith(BUILTIN_EXPORT_PRESETS[0].id);
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ kind: 'info' }));
  });

  it('applyOptimizationSuggestion 应用建议并提示', () => {
    const state = createStateStub();
    const actions = renderActions(state);

    actions.applyOptimizationSuggestion({ id: 'normalize-loudness' } as ExportOptimizationSuggestion);

    const setDraftSettings = (state as unknown as Record<string, ReturnType<typeof vi.fn>>).setDraftSettings;
    expect(setDraftSettings).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ kind: 'info' }));
  });

  it('dismissOptimizationSuggestion 持久化并去重', async () => {
    const state = createStateStub({
      exportOptimizationSettings: { dismissedSuggestionIds: ['old-id'] },
    });
    const actions = renderActions(state);

    await act(async () => {
      await actions.dismissOptimizationSuggestion({ id: 'normalize-loudness' } as ExportOptimizationSuggestion);
    });

    expect(saveExportOptimizationSettings).toHaveBeenCalledWith({
      dismissedSuggestionIds: ['old-id', 'normalize-loudness'],
    });
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ kind: 'info' }));
  });
});

// ── 预设包导入导出 ───────────────────────────────────────────────────

describe('useExportActions 预设包', () => {
  it('exportSelectedPresetPackage 写出序列化包并提示', async () => {
    vi.mocked(saveFileDialog).mockResolvedValue('C:/pkg/custom.ofpreset.json' as never);
    const state = createStateStub();
    const actions = renderActions(state);

    await act(async () => {
      await actions.exportSelectedPresetPackage();
    });

    expect(writeFile).toHaveBeenCalledWith('C:/pkg/custom.ofpreset.json', expect.any(String));
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }));
  });

  it('exportSelectedPresetPackage 取消保存时不写文件', async () => {
    vi.mocked(saveFileDialog).mockResolvedValue(null as never);
    const state = createStateStub();
    const actions = renderActions(state);

    await act(async () => {
      await actions.exportSelectedPresetPackage();
    });

    expect(writeFile).not.toHaveBeenCalled();
  });

  it('importPresetPackageFromFile 导入自定义预设并选中', async () => {
    const packageContent = serializeExportPresetPackage([
      { ...BUILTIN_EXPORT_PRESETS[0], id: 'imported-1', name: 'Imported Preset', builtin: false },
    ]);
    vi.mocked(openFileDialog).mockResolvedValue(['C:/pkg/import.ofpreset.json'] as never);
    vi.mocked(readFile).mockResolvedValue(packageContent as never);
    const state = createStateStub();
    const actions = renderActions(state);

    await act(async () => {
      await actions.importPresetPackageFromFile();
    });

    const setPresets = (state as unknown as Record<string, ReturnType<typeof vi.fn>>).setPresets;
    expect(setPresets).toHaveBeenCalledTimes(1);
    const imported = (setPresets.mock.calls[0][0] as ExportPreset[]).find((p) => p.name === 'Imported Preset');
    expect(imported).toBeDefined();
    expect((state as unknown as Record<string, ReturnType<typeof vi.fn>>).setPresetId).toHaveBeenCalledWith(
      imported?.id,
    );
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }));
  });

  it('importPresetPackageFromFile 内容非法时写 error', async () => {
    vi.mocked(openFileDialog).mockResolvedValue(['C:/pkg/bad.ofpreset.json'] as never);
    vi.mocked(readFile).mockResolvedValue('not-json' as never);
    const state = createStateStub();
    const actions = renderActions(state);

    await act(async () => {
      await actions.importPresetPackageFromFile();
    });

    expect((state as unknown as Record<string, ReturnType<typeof vi.fn>>).setError).toHaveBeenCalled();
  });

  it('importOfficialPresetPackage 无官方包时警告提示', async () => {
    // stub fetch 防止真实网络请求（CI 可达 GitHub 会改变分支走向）
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('offline');
    }));
    try {
      const state = createStateStub();
      const actions = renderActions(state);

      await act(async () => {
        await actions.importOfficialPresetPackage();
      });

      expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ kind: 'warning' }));
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('syncPresetPackageFromCloud 缺 url 时进入 error 状态并提示', async () => {
    const state = createStateStub({
      exportPresetSyncSettings: { enabled: true, syncOnStartup: false, conflictMode: 'merge' },
      exportPresetSyncPassword: '',
    });
    const actions = renderActions(state);

    await act(async () => {
      await actions.syncPresetPackageFromCloud();
    });

    const setPresetSyncState = (state as unknown as Record<string, ReturnType<typeof vi.fn>>).setPresetSyncState;
    expect(setPresetSyncState).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'error', message: expect.any(String) }),
    );
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ kind: 'warning' }));
  });

  it('syncPresetPackageFromCloud WebDAV 上传失败时保存警告并进入 error', async () => {
    // getText 失败会被内部捕获（remoteWasMissing），上传失败才是外层可见错误
    vi.mocked(getWebdavText).mockResolvedValue({ contents: '{"version":1,"presets":[]}' } as never);
    vi.mocked(putWebdavText).mockRejectedValue(new Error('webdav down') as never);
    const state = createStateStub({
      exportPresetSyncSettings: { enabled: true, syncOnStartup: false, conflictMode: 'merge', url: 'http://dav' },
    });
    const actions = renderActions(state);

    await act(async () => {
      await actions.syncPresetPackageFromCloud();
    });

    const setPresetSyncState = (state as unknown as Record<string, ReturnType<typeof vi.fn>>).setPresetSyncState;
    expect(setPresetSyncState).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'error', message: 'webdav down' }),
    );
  });
});

// ── 版本批 ───────────────────────────────────────────────────────────

describe('useExportActions 版本批', () => {
  it('buildVersionedBatchJobs 生成启用行任务并记录批次 id', () => {
    const state = createStateStub();
    const actions = renderActions(state);

    const jobs = actions.buildVersionedBatchJobs();

    expect(jobs).toHaveLength(1);
    expect(jobs[0].outputPath).toContain('C:/Exports/');
    const setLatestVersionedBatchId = (state as unknown as Record<string, ReturnType<typeof vi.fn>>)
      .setLatestVersionedBatchId;
    expect(setLatestVersionedBatchId).toHaveBeenCalledWith(expect.stringMatching(/^version-batch-/));
    expect(
      (state as unknown as Record<string, ReturnType<typeof vi.fn>>).setVersionedBatchFileSizes,
    ).toHaveBeenCalledWith({});
  });

  it('无启用行时 buildVersionedBatchJobs 抛错', () => {
    const state = createStateStub({
      versionedBatchRows: [
        {
          id: 'row-1',
          enabled: false,
          name: '横版',
          presetId: BUILTIN_EXPORT_PRESETS[0].id,
          platform: 'YouTube',
          language: 'zh',
          rangeMode: 'default',
          rangeStart: 0,
          rangeDuration: 5,
          width: 1920,
          height: 1080,
          watermarkMode: 'inherit',
        },
      ],
    });
    const actions = renderActions(state);

    expect(() => actions.buildVersionedBatchJobs()).toThrow();
  });

  it('版本批行编辑：更新/新增/最少保留一行', () => {
    const state = createStateStub();
    const actions = renderActions(state);
    const rows = state.versionedBatchRows as unknown[];

    actions.updateVersionedBatchRow('row-1', { name: '改名' });
    const setVersionedBatchRows = (state as unknown as Record<string, ReturnType<typeof vi.fn>>)
      .setVersionedBatchRows;
    const updated = applyUpdater(setVersionedBatchRows.mock.calls[0], rows) as Array<{ id: string; name: string }>;
    expect(updated[0].name).toBe('改名');

    actions.addVersionedBatchRow();
    const added = applyUpdater(setVersionedBatchRows.mock.calls[1], rows) as unknown[];
    expect(added).toHaveLength(2);

    actions.removeVersionedBatchRow('row-1');
    const removed = applyUpdater(setVersionedBatchRows.mock.calls[2], rows) as unknown[];
    expect(removed).toHaveLength(1);

    actions.removeVersionedBatchRow('row-1');
    const kept = applyUpdater(setVersionedBatchRows.mock.calls[3], [rows[0]]) as unknown[];
    expect(kept).toHaveLength(1);
  });

  it('exportVersionedBatchTemplate 保存模板文件；importVersionedBatchTemplate 读回模板', async () => {
    const templateContent = serializeVersionedBatchTemplate('Batch', 'C:/Exports/{version_name}.mp4', [
      {
        id: 'v1',
        name: 'V1',
        enabled: true,
        presetId: BUILTIN_EXPORT_PRESETS[0].id,
        platform: 'YouTube',
        language: 'zh',
        settings: { width: 1920, height: 1080 },
      },
    ]);
    vi.mocked(saveFileDialog).mockResolvedValue('C:/batch.ofbatch.json' as never);
    vi.mocked(openFileDialog).mockResolvedValue(['C:/batch.ofbatch.json'] as never);
    vi.mocked(readFile).mockResolvedValue(templateContent as never);
    const state = createStateStub();
    const actions = renderActions(state);

    await act(async () => {
      await actions.exportVersionedBatchTemplate();
    });
    expect(writeFile).toHaveBeenCalledWith('C:/batch.ofbatch.json', expect.any(String));
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }));

    await act(async () => {
      await actions.importVersionedBatchTemplate();
    });
    const setVersionedBatchTemplate = (state as unknown as Record<string, ReturnType<typeof vi.fn>>)
      .setVersionedBatchTemplate;
    const setVersionedBatchRows = (state as unknown as Record<string, ReturnType<typeof vi.fn>>)
      .setVersionedBatchRows;
    expect(setVersionedBatchTemplate).toHaveBeenCalledWith('C:/Exports/{version_name}.mp4');
    const rows = setVersionedBatchRows.mock.calls[0][0] as Array<{ id: string; enabled: boolean }>;
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('v1');
  });

  it('versionDefinitionToRow 无范围时按时间线时长回填', () => {
    const state = createStateStub();
    const actions = renderActions(state);

    const row = actions.versionDefinitionToRow({
      id: 'v2',
      name: 'V2',
      enabled: false,
      presetId: 'missing-preset',
      platform: undefined,
      language: undefined,
      range: undefined,
      settings: { watermark: null },
    });

    expect(row.enabled).toBe(false);
    expect(row.presetId).toBe(BUILTIN_EXPORT_PRESETS[0].id);
    expect(row.platform).toBe('Custom');
    expect(row.language).toBe('zh');
    expect(row.rangeMode).toBe('default');
    expect(row.rangeDuration).toBeGreaterThanOrEqual(1);
    expect(row.watermarkMode).toBe('none');
  });
});

// ── 序列批 / 编解码对比 ─────────────────────────────────────────────

describe('useExportActions 序列批与编解码对比', () => {
  it('buildSequenceBatchJobs 按依赖排序生成每序列任务', () => {
    const state = createStateStub();
    const actions = renderActions(state);

    const jobs = actions.buildSequenceBatchJobs();

    expect(jobs.length).toBeGreaterThan(0);
    expect(jobs[0].outputPath).toContain('.mp4');
    expect(jobs[0].project).toBeDefined();
  });

  it('buildSequenceBatchJobs 无选中序列时抛错', () => {
    const state = createStateStub({ selectedSequenceIds: [] });
    const actions = renderActions(state);

    expect(() => actions.buildSequenceBatchJobs()).toThrow();
  });

  it('buildSequenceBatchJobs 输出路径覆盖为空串时抛错', () => {
    const project = createProject('Empty Path');
    const seqs = getSyncedProjectSequences(project);
    const state = createStateStub({
      project,
      batchSequences: seqs,
      selectedSequenceIds: [seqs[0].id],
      sequenceBatchOutputOverrides: { [seqs[0].id]: '   ' },
    });
    const actions = renderActions(state);

    expect(() => actions.buildSequenceBatchJobs()).toThrow();
  });

  it('序列批选择与覆盖更新走函数式 setter', () => {
    const state = createStateStub();
    const actions = renderActions(state);

    actions.toggleSequenceBatchSelection('seq-1', true);
    const setSelectedSequenceIds = (state as unknown as Record<string, ReturnType<typeof vi.fn>>)
      .setSelectedSequenceIds;
    const added = applyUpdater(setSelectedSequenceIds.mock.calls[0]) as string[];
    expect(added).toContain('seq-1');

    actions.updateSequenceBatchOutput('seq-1', 'C:/Exports/override.mp4');
    expect(
      (state as unknown as Record<string, ReturnType<typeof vi.fn>>).setSequenceBatchOutputOverrides,
    ).toHaveBeenCalledTimes(1);

    actions.updateSequenceBatchPreset('seq-1', 'preset-x');
    expect(
      (state as unknown as Record<string, ReturnType<typeof vi.fn>>).setSequenceBatchPresetIds,
    ).toHaveBeenCalledTimes(1);
  });

  it('toggleCodecComparePreset 上限/去重/移除语义', () => {
    const current = ['a', 'b', 'c', 'd'];
    const state = createStateStub({ codecComparePresetIds: current });
    const actions = renderActions(state);
    const setCodecComparePresetIds = (state as unknown as Record<string, ReturnType<typeof vi.fn>>)
      .setCodecComparePresetIds;

    actions.toggleCodecComparePreset('e', true);
    const capped = applyUpdater(setCodecComparePresetIds.mock.calls[0], current) as string[];
    expect(capped).toEqual(['a', 'b', 'c', 'd']);

    actions.toggleCodecComparePreset('a', true);
    const dup = applyUpdater(setCodecComparePresetIds.mock.calls[1], current) as string[];
    expect(dup).toEqual(['a', 'b', 'c', 'd']);

    actions.toggleCodecComparePreset('a', false);
    const removed = applyUpdater(setCodecComparePresetIds.mock.calls[2], current) as string[];
    expect(removed).toEqual(['b', 'c', 'd']);
  });

  it('toggleCodecCompareSort 同键翻转方向、异键重置升序', () => {
    const current = { key: 'presetName', direction: 'asc' };
    const state = createStateStub({ codecCompareSort: current });
    const actions = renderActions(state);
    const setCodecCompareSort = (state as unknown as Record<string, ReturnType<typeof vi.fn>>).setCodecCompareSort;

    actions.toggleCodecCompareSort('presetName');
    const flipped = applyUpdater(setCodecCompareSort.mock.calls[0], current) as { key: string; direction: string };
    expect(flipped.direction).toBe('desc');

    actions.toggleCodecCompareSort('fileSizeBytes');
    const reset = applyUpdater(setCodecCompareSort.mock.calls[1], { ...current, direction: 'desc' }) as {
      key: string;
      direction: string;
    };
    expect(reset).toEqual({ key: 'fileSizeBytes', direction: 'asc' });
  });
});

// ── addToQueue 其它模式 ─────────────────────────────────────────────

describe('useExportActions addToQueue 其它导出模式', () => {
  it('version-batch：预热并入队启用行任务', async () => {
    const state = createStateStub({ exportMode: 'version-batch' });
    const actions = renderActions(state);

    await act(async () => {
      await actions.addToQueue();
    });

    expect(runExportWarmup).toHaveBeenCalledTimes(1);
    expect(enqueueExport).toHaveBeenCalledTimes(1);
  });

  it('sequence-batch：按序列入队', async () => {
    const state = createStateStub({ exportMode: 'sequence-batch' });
    const actions = renderActions(state);

    await act(async () => {
      await actions.addToQueue();
    });

    expect(runExportWarmup).toHaveBeenCalledTimes(1);
    expect(enqueueExport).toHaveBeenCalledTimes(1);
  });

  it('codec-compare：生成对比任务并初始化结果表', async () => {
    const state = createStateStub({ exportMode: 'codec-compare', outputPath: 'C:/Exports/compare.mp4' });
    const actions = renderActions(state);

    await act(async () => {
      await actions.addToQueue();
    });

    expect(enqueueExport).toHaveBeenCalledTimes(2);
    const setCodecCompareResults = (state as unknown as Record<string, ReturnType<typeof vi.fn>>)
      .setCodecCompareResults;
    expect(setCodecCompareResults).toHaveBeenCalledTimes(1);
    const results = setCodecCompareResults.mock.calls[0][0] as unknown[];
    expect(results).toHaveLength(2);
  });

  it('codec-compare：少于 2 个预设时写 error', async () => {
    const state = createStateStub({
      exportMode: 'codec-compare',
      outputPath: 'C:/Exports/compare.mp4',
      codecComparePresetIds: ['only-one'],
    });
    const actions = renderActions(state);

    await act(async () => {
      await actions.addToQueue();
    });

    expect(enqueueExport).not.toHaveBeenCalled();
    expect((state as unknown as Record<string, ReturnType<typeof vi.fn>>).setError).toHaveBeenCalledWith(
      expect.any(String),
    );
  });

  it('stem：选择目录后入轨导出并提示', async () => {
    vi.mocked(openDirectoryDialog).mockResolvedValue('C:/Stems' as never);
    const state = createStateStub({ exportMode: 'stem' });
    const actions = renderActions(state);

    await act(async () => {
      await actions.addToQueue();
    });

    expect(enqueueStemExport).toHaveBeenCalledTimes(1);
    expect((state as unknown as Record<string, ReturnType<typeof vi.fn>>).setStemOutputDir).toHaveBeenCalledWith(
      'C:/Stems',
    );
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ kind: 'info' }));
  });

  it('stem：无选中轨时写 error', async () => {
    const state = createStateStub({
      exportMode: 'stem',
      stemTracks: [{ trackIndex: 0, trackName: 'M', selected: false, format: 'default' }],
    });
    const actions = renderActions(state);

    await act(async () => {
      await actions.addToQueue();
    });

    expect(enqueueStemExport).not.toHaveBeenCalled();
    expect((state as unknown as Record<string, ReturnType<typeof vi.fn>>).setError).toHaveBeenCalled();
  });

  it('pipeline：空节点流水线写 error', async () => {
    const state = createStateStub({
      exportMode: 'pipeline',
      pipelineConfig: { id: 'p', name: 'P', nodes: [], edges: [] },
    });
    const actions = renderActions(state);

    await act(async () => {
      await actions.addToQueue();
    });

    expect((state as unknown as Record<string, ReturnType<typeof vi.fn>>).setError).toHaveBeenCalledWith(
      expect.any(String),
    );
  });
});

// ── 流水线执行 ───────────────────────────────────────────────────────

describe('useExportActions 流水线执行', () => {
  it('runPipeline 跑通 export-mp4 + script-hook 两步流水线', async () => {
    vi.mocked(chooseExportPath).mockResolvedValue('C:/Exports/pipeline.mp4' as never);
    h.queue.tasks = [{ id: 'task-1', status: 'success', outputPath: 'C:/Exports/pipeline.mp4' }];
    const pipeline = coreTwoStep('两步流水线');
    const state = createStateStub({ exportMode: 'pipeline', pipelineConfig: pipeline });
    const actions = renderActions(state);

    await act(async () => {
      await actions.addToQueue();
    });

    const setPipelineStatuses = (state as unknown as Record<string, ReturnType<typeof vi.fn>>).setPipelineStatuses;
    expect(setPipelineStatuses).toHaveBeenCalled();
    const lastStatuses = setPipelineStatuses.mock.calls.at(-1)![0] as Record<string, string>;
    expect(Object.values(lastStatuses).every((s) => s === 'complete')).toBe(true);
    expect(enqueueExport).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ kind: 'info' }));
  });

  it('runPipeline 发布节点失败时标记 failed 并继续', async () => {
    vi.mocked(chooseExportPath).mockResolvedValue('C:/Exports/pub.mp4' as never);
    h.queue.tasks = [{ id: 'task-1', status: 'success', outputPath: 'C:/Exports/pub.mp4' }];
    vi.mocked(runPublishPipelineNode).mockResolvedValue({
      nodeId: 'node-email-notification',
      status: 'failed',
      message: 'smtp error',
    } as never);
    const pipeline = corePublish('发布流水线');
    const state = createStateStub({ exportMode: 'pipeline', pipelineConfig: pipeline });
    const actions = renderActions(state);

    await act(async () => {
      await actions.addToQueue();
    });

    const setPipelineStatuses = (state as unknown as Record<string, ReturnType<typeof vi.fn>>).setPipelineStatuses;
    const lastStatuses = setPipelineStatuses.mock.calls.at(-1)![0] as Record<string, string>;
    expect(lastStatuses['node-email-notification']).toBe('failed');
    const setPublishPipelineLogs = (state as unknown as Record<string, ReturnType<typeof vi.fn>>)
      .setPublishPipelineLogs;
    expect(setPublishPipelineLogs).toHaveBeenCalled();
  });

  it('createPipelineTemplate / createPublishPipelineTemplate 重置状态', () => {
    const state = createStateStub();
    const actions = renderActions(state);

    actions.createPipelineTemplate();
    const setPipelineConfig = (state as unknown as Record<string, ReturnType<typeof vi.fn>>).setPipelineConfig;
    let config = setPipelineConfig.mock.calls[0][0] as { nodes: unknown[] };
    expect(config.nodes).toHaveLength(2);

    actions.createPublishPipelineTemplate();
    config = setPipelineConfig.mock.calls[1][0] as { nodes: unknown[] };
    expect(config.nodes.length).toBeGreaterThan(2);
    expect(
      (state as unknown as Record<string, ReturnType<typeof vi.fn>>).setPublishPipelineLogs,
    ).toHaveBeenCalledWith([]);
  });

  it('runPipelineUtilityNode 对发布节点读取文件统计并调用 runner', async () => {
    vi.mocked(getFileStat).mockResolvedValue({ path: 'C:/Exports/x.mp4', size: 123, mtimeMs: 1 } as never);
    const state = createStateStub();
    const actions = renderActions(state);
    const node = corePublish('P').nodes.find((n) => n.type === 'email-notification')!;

    await act(async () => {
      await actions.runPipelineUtilityNode(node, 'C:/Exports/x.mp4', []);
    });

    expect(getFileStat).toHaveBeenCalledWith('C:/Exports/x.mp4');
    expect(runPublishPipelineNode).toHaveBeenCalledTimes(1);
  });

  it('runPipelineExportNode 无输出路径时要求选择', async () => {
    vi.mocked(chooseExportPath).mockResolvedValue('C:/Exports/node.mp4' as never);
    h.queue.tasks = [{ id: 'task-1', status: 'success' }];
    const state = createStateStub({ outputPath: '' });
    const actions = renderActions(state);

    const path = await act(async () => actions.runPipelineExportNode(''));

    expect(path).toBe('C:/Exports/node.mp4');
    expect((state as unknown as Record<string, ReturnType<typeof vi.fn>>).setOutputPath).toHaveBeenCalledWith(
      'C:/Exports/node.mp4',
    );
  });
});

// ── 预览与质量评估 ───────────────────────────────────────────────────

describe('useExportActions 预览与质量评估', () => {
  it('previewExport 纯音频模式直接返回', async () => {
    const state = createStateStub({ isAudioOnly: true });
    const actions = renderActions(state);

    await act(async () => {
      await actions.previewExport();
    });

    expect(runExportPreviewSamples).not.toHaveBeenCalled();
  });

  it('previewExport ffmpeg 不可用时写预览错误', async () => {
    const state = createStateStub({ capabilities: { available: false } });
    const actions = renderActions(state);

    await act(async () => {
      await actions.previewExport();
    });

    expect((state as unknown as Record<string, ReturnType<typeof vi.fn>>).setPreviewError).toHaveBeenCalledWith(
      expect.any(String),
    );
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ kind: 'error' }));
  });

  it('previewExport 成功生成样例并转换本地资源地址', async () => {
    vi.mocked(runExportPreviewSamples).mockResolvedValue({
      samples: [{ id: 's1', kind: 'opening', time: 0, path: 'C:/AppData/preview/s1.png', durationMs: 800 }],
    } as never);
    const project = createProject('Preview');
    project.media = [
      { id: 'media-a', type: 'video', name: 'A.mp4', path: 'D:/media/A.mp4', duration: 6, width: 1920, height: 1080 },
    ];
    project.timeline = {
      transitions: [],
      markers: [],
      tracks: [
        createTrack({
          id: 'track-v',
          type: 'video',
          name: 'V',
          clips: [
            {
              id: 'clip-v',
              type: 'video',
              name: 'C',
              mediaId: 'media-a',
              trackId: 'track-v',
              start: 0,
              duration: 6,
              trimStart: 0,
              trimEnd: 0,
              speed: DEFAULT_CLIP_SPEED,
              volume: 1,
            } as unknown as Clip,
          ],
        }),
      ],
    };
    const state = createStateStub({ project });
    const actions = renderActions(state);

    await act(async () => {
      await actions.previewExport();
    });

    const setPreviewSamples = (state as unknown as Record<string, ReturnType<typeof vi.fn>>).setPreviewSamples;
    expect(setPreviewSamples).toHaveBeenCalledTimes(1);
    const samples = setPreviewSamples.mock.calls[0][0] as Array<{ src: string }>;
    expect(samples[0].src).toBe('asset://C:/AppData/preview/s1.png');
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }));
  });

  it('evaluateHistoryQuality 缺源文件时写质量错误', async () => {
    const state = createStateStub();
    const actions = renderActions(state);

    await act(async () => {
      await actions.evaluateHistoryQuality({ id: 'h1', sourcePath: undefined, outputPath: 'C:/o.mp4' } as never);
    });

    expect((state as unknown as Record<string, ReturnType<typeof vi.fn>>).setQualityError).toHaveBeenCalledWith(
      expect.any(String),
    );
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ kind: 'warning' }));
  });

  it('evaluateHistoryQuality 成功写入结果；失败写错误', async () => {
    vi.mocked(evaluateExportQuality).mockResolvedValue({ overallScore: 88 } as never);
    const state = createStateStub();
    const actions = renderActions(state);

    await act(async () => {
      await actions.evaluateHistoryQuality({ id: 'h1', sourcePath: 'C:/src.mp4', outputPath: 'C:/o.mp4' } as never);
    });
    expect((state as unknown as Record<string, ReturnType<typeof vi.fn>>).setQualityResult).toHaveBeenCalledTimes(1);

    vi.mocked(evaluateExportQuality).mockRejectedValue(new Error('ffmpeg died') as never);
    await act(async () => {
      await actions.evaluateHistoryQuality({ id: 'h2', sourcePath: 'C:/src.mp4', outputPath: 'C:/o.mp4' } as never);
    });
    expect((state as unknown as Record<string, ReturnType<typeof vi.fn>>).setQualityError).toHaveBeenCalledWith(
      'ffmpeg died',
    );
  });

  it('cancelRunningQualityEvaluation 无任务时跳过，有任务时取消', async () => {
    const state = createStateStub();
    const actions = renderActions(state);

    await act(async () => {
      await actions.cancelRunningQualityEvaluation();
    });
    expect(cancelQualityEvaluation).not.toHaveBeenCalled();

    const state2 = createStateStub({ qualityTaskId: 'quality-h1' });
    const actions2 = renderActions(state2);
    await act(async () => {
      await actions2.cancelRunningQualityEvaluation();
    });
    expect(cancelQualityEvaluation).toHaveBeenCalledWith('quality-h1');
  });
});

// ── 暖场 / 入队细节 ─────────────────────────────────────────────────

describe('useExportActions 暖场与入队细节', () => {
  it('warmupSelectedJobs 单任务模式切步并汇总状态', async () => {
    vi.mocked(runExportWarmup).mockResolvedValue({ cached: true } as never);
    const state = createStateStub();
    const actions = renderActions(state);

    await act(async () => {
      await actions.warmupSelectedJobs([{ outputPath: 'C:/Exports/a.mp4', range: null, settings: {} }]);
    });

    expect(
      (state as unknown as Record<string, ReturnType<typeof vi.fn>>).setCurrentStep,
    ).toHaveBeenCalledWith('export');
    expect((state as unknown as Record<string, ReturnType<typeof vi.fn>>).setWarmupStatus).toHaveBeenCalledWith({
      status: 'cached',
    });
  });

  it('warmupSelectedJobs pipeline/codec-compare/version-batch 模式停留当前步', async () => {
    const state = createStateStub({ exportMode: 'pipeline' });
    const actions = renderActions(state);

    await act(async () => {
      await actions.warmupSelectedJobs([{ outputPath: 'C:/Exports/a.mp4', range: null, settings: {} }]);
    });

    expect((state as unknown as Record<string, ReturnType<typeof vi.fn>>).setCurrentStep).not.toHaveBeenCalled();
  });

  it('enqueueSelectedJobs 计划无效时写 error 并返回空', async () => {
    const state = createStateStub({ scheduleEnabled: true, scheduledStartInput: '2020-01-01T00:00' });
    const actions = renderActions(state);

    const tasks = await act(async () =>
      actions.enqueueSelectedJobs([{ outputPath: 'C:/Exports/a.mp4', range: null, settings: {} }]),
    );

    expect(tasks).toEqual([]);
    expect((state as unknown as Record<string, ReturnType<typeof vi.fn>>).setError).toHaveBeenCalledWith(
      expect.any(String),
    );
  });

  it('enqueueSelectedJobs 渐进导出不支持时提示警告', async () => {
    const state = createStateStub({ progressiveExportEnabled: true, progressiveExportSupported: false });
    const actions = renderActions(state);

    const tasks = await act(async () =>
      actions.enqueueSelectedJobs([{ outputPath: 'C:/Exports/a.mp4', range: null, settings: {} }]),
    );

    expect(tasks).toHaveLength(1);
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ kind: 'warning' }));
  });

  it('enqueueSelectedJobs 后导出脚本未确认时拦截', async () => {
    const state = createStateStub({
      exportSettings: { postExportScript: { command: 'echo done' } },
      exportBackgroundSettings: { allowPowerActions: false, postExportScriptAcknowledged: false },
    });
    const actions = renderActions(state);

    const tasks = await act(async () =>
      actions.enqueueSelectedJobs([{ outputPath: 'C:/Exports/a.mp4', range: null, settings: {} }]),
    );

    expect(tasks).toEqual([]);
    expect((state as unknown as Record<string, ReturnType<typeof vi.fn>>).setError).toHaveBeenCalled();
  });

  it('continueAfterWarnings 警告放行后入队；blocking 拦截不动', async () => {
    const warningState = createStateStub({
      preflight: {
        issues: [{ id: 'i1', severity: 'warning', message: 'w', items: [] }],
        selectedJobs: [{ outputPath: 'C:/Exports/a.mp4', range: null, settings: {} }],
      },
    });
    const warningActions = renderActions(warningState);
    await act(async () => {
      await warningActions.continueAfterWarnings();
    });
    expect(enqueueExport).toHaveBeenCalledTimes(1);

    const blockingState = createStateStub({
      preflight: {
        issues: [{ id: 'i2', severity: 'blocking', message: 'b', items: [] }],
        selectedJobs: [{ outputPath: 'C:/Exports/b.mp4', range: null, settings: {} }],
      },
    });
    const blockingActions = renderActions(blockingState);
    await act(async () => {
      await blockingActions.continueAfterWarnings();
    });
    expect(enqueueExport).toHaveBeenCalledTimes(1);
  });

  it('collectPreflightIssuesForJobs 跨任务去重同一问题', async () => {
    const state = createStateStub();
    const actions = renderActions(state);

    const issues = await act(async () =>
      actions.collectPreflightIssuesForJobs([
        { outputPath: 'C:/Exports/a.mp4', range: null, settings: {} },
        { outputPath: 'C:/Exports/b.mp4', range: null, settings: {} },
      ]),
    );

    const keys = new Set(issues.map((i) => `${i.id}:${i.severity}:${i.items.join('|')}`));
    expect(issues.length).toBe(keys.size);
  });
});

// ── 其它动作 ────────────────────────────────────────────────────────

describe('useExportActions 上传/平台适配/杂项', () => {
  it('relinkFromPreflight 关闭对话框并触发重链接', () => {
    const state = createStateStub({
      preflight: { issues: [], selectedJobs: [] },
    });
    const actions = renderActions(state);

    actions.relinkFromPreflight();

    expect(
      (state as unknown as Record<string, ReturnType<typeof vi.fn>>).setPreflight,
    ).toHaveBeenCalledWith(undefined);
    expect(state.onClose as ReturnType<typeof vi.fn>).toHaveBeenCalled();
    expect(state.onRelinkMissing as ReturnType<typeof vi.fn>).toHaveBeenCalled();
  });

  it('applyPlatformFit / restorePlatformFitClip 走命令管理器', () => {
    const state = createStateStub();
    const actions = renderActions(state);

    actions.applyPlatformFit();
    expect(commandManager.execute).toHaveBeenCalledTimes(1);

    actions.restorePlatformFitClip('clip-1');
    expect(commandManager.execute).toHaveBeenCalledTimes(2);
  });

  it('updateExportUploadSettings 保存成功回写、失败写 error', async () => {
    const state = createStateStub();
    const actions = renderActions(state);
    await act(async () => {
      await actions.updateExportUploadSettings({ enabled: true, targetType: 'local', webdav: {}, local: {} });
    });
    expect(
      (state as unknown as Record<string, ReturnType<typeof vi.fn>>).setExportUploadSettings,
    ).toHaveBeenCalledTimes(2);

    vi.mocked(saveExportUploadSettings).mockRejectedValueOnce(new Error('io') as never);
    const state2 = createStateStub();
    const actions2 = renderActions(state2);
    await act(async () => {
      await actions2.updateExportUploadSettings({ enabled: true, targetType: 'local', webdav: {}, local: {} });
    });
    expect((state2 as unknown as Record<string, ReturnType<typeof vi.fn>>).setError).toHaveBeenCalledWith('io');
  });

  it('updateExportUploadPassword 写入凭据，失败写 error', async () => {
    const state = createStateStub();
    const actions = renderActions(state);
    await act(async () => {
      await actions.updateExportUploadPassword('secret');
    });
    expect(
      (state as unknown as Record<string, ReturnType<typeof vi.fn>>).setExportUploadPassword,
    ).toHaveBeenCalledWith('secret');

    vi.mocked(writeExportUploadWebdavPassword).mockRejectedValueOnce(new Error('keyring') as never);
    const state2 = createStateStub();
    const actions2 = renderActions(state2);
    await act(async () => {
      await actions2.updateExportUploadPassword('secret');
    });
    expect((state2 as unknown as Record<string, ReturnType<typeof vi.fn>>).setError).toHaveBeenCalledWith('keyring');
  });

  it('chooseExportUploadDirectory 选择目录后保存设置', async () => {
    vi.mocked(openDirectoryDialog).mockResolvedValue('D:/uploads' as never);
    const state = createStateStub();
    const actions = renderActions(state);

    await act(async () => {
      await actions.chooseExportUploadDirectory();
    });

    expect(saveExportUploadSettings).toHaveBeenCalledWith(
      expect.objectContaining({ local: expect.objectContaining({ directory: 'D:/uploads' }) }),
    );
  });

  it('retryHistoryUpload 失败时写 error', async () => {
    vi.mocked(retryExportUploadFromHistory).mockRejectedValue(new Error('upload failed') as never);
    const state = createStateStub();
    const actions = renderActions(state);

    await act(async () => {
      await actions.retryHistoryUpload({ id: 'h9' } as never);
    });

    expect((state as unknown as Record<string, ReturnType<typeof vi.fn>>).setError).toHaveBeenCalledWith(
      'upload failed',
    );
  });

  it('setPostExportScriptAcknowledged 保存成功回写、失败写 error', async () => {
    const state = createStateStub();
    const actions = renderActions(state);
    await act(async () => {
      await actions.setPostExportScriptAcknowledged(true);
    });
    expect(saveExportBackgroundSettings).toHaveBeenCalledTimes(1);

    vi.mocked(saveExportBackgroundSettings).mockRejectedValueOnce(new Error('settings io') as never);
    const state2 = createStateStub();
    const actions2 = renderActions(state2);
    await act(async () => {
      await actions2.setPostExportScriptAcknowledged(false);
    });
    expect((state2 as unknown as Record<string, ReturnType<typeof vi.fn>>).setError).toHaveBeenCalledWith(
      'settings io',
    );
  });

  it('ensurePostExportScriptAcknowledged 无脚本直接放行', async () => {
    const state = createStateStub();
    const actions = renderActions(state);
    let resolved: unknown;
    await act(async () => {
      resolved = await actions.ensurePostExportScriptAcknowledged();
    });
    expect(resolved).toBe(true);
  });

  it('ensurePostExportScriptAcknowledged 未确认时拦截并写 error', async () => {
    const state = createStateStub({
      exportSettings: { postExportScript: { command: 'echo' } },
      exportBackgroundSettings: { allowPowerActions: false, postExportScriptAcknowledged: false },
    });
    const actions = renderActions(state);
    let resolved: unknown;
    await act(async () => {
      resolved = await actions.ensurePostExportScriptAcknowledged();
    });
    expect(resolved).toBe(false);
    expect((state as unknown as Record<string, ReturnType<typeof vi.fn>>).setError).toHaveBeenCalled();
  });

  it('ensurePostExportScriptAcknowledged 确认后弹确认框，resolve 解析 true', async () => {
    const state = createStateStub({
      exportSettings: { postExportScript: { command: 'echo' } },
      exportBackgroundSettings: { allowPowerActions: false, postExportScriptAcknowledged: true },
      pendingConfirmResolveRef: { current: null },
    });
    const actions = renderActions(state);
    let confirmed: unknown;
    const pending = act(async () => {
      confirmed = await actions.ensurePostExportScriptAcknowledged();
    });
    expect(
      (state as unknown as Record<string, ReturnType<typeof vi.fn>>).setPostExportScriptPendingConfirm,
    ).toHaveBeenCalledWith(true);
    (state.pendingConfirmResolveRef as { current: ((v: boolean) => void) | null }).current?.(true);
    await pending;
    expect(confirmed).toBe(true);
  });
});

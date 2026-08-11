// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';

// vitest 未开 globals，@testing-library 自动 cleanup 不会注册；
// 不显式清理时前一个用例的容器滞留 body，queryByTestId 会跨用例命中。
afterEach(() => {
  cleanup();
});

// ExportConfig 子树（export-utils / AIExportSuggestionPanel / aiSettingsStore /
// export-presets / appSettings）会 import tauri-bridge；组件测试只验证渲染与
// 受控绑定，统一打桩为 no-op。必须显式枚举全部被引用的导出——Proxy 工厂会因
// 缺少 ownKeys 陷阱被 Vitest 判定"无导出"，且 get 返回 truthy 的 'then' 会把
// 模块伪装成 thenable 导致 await import 永久挂起（首版因此卡死）。
vi.mock('../../lib/tauri-bridge', () => ({
  callAiApi: vi.fn(),
  checkOllamaReachable: vi.fn(),
  fsExists: vi.fn(async () => false),
  getAppDataDir: vi.fn(async () => 'C:/AppData'),
  getWebdavText: vi.fn(),
  listOllamaModels: vi.fn(),
  putWebdavText: vi.fn(),
  readAiApiKey: vi.fn(),
  readFile: vi.fn(),
  runExportPowerAction: vi.fn(),
  testAiConnection: vi.fn(),
  writeAiApiKey: vi.fn(),
  writeFile: vi.fn(),
}));

import { createProject } from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import { BUILTIN_EXPORT_PRESETS } from '../export-presets';
import { ExportConfig } from './ExportConfig';
import type { ExportState } from '../hooks/useExportState';
import type { ExportActions } from '../hooks/useExportActions';

// ── 渲染桩：提供 ExportConfig 渲染所需的全部读取字段；set* 由 Proxy 自动生成 ──

function createConfigStateStub(overrides: Record<string, unknown> = {}): ExportState {
  const setters = new Map<string, ReturnType<typeof vi.fn>>();
  const preset = BUILTIN_EXPORT_PRESETS[0];
  const base: Record<string, unknown> = {
    t: zhCN.exportDialog,
    project: createProject('Batch Paths Binding Test'),
    initialPreset: undefined,
    selectedClipIds: [],
    inPoint: null,
    outPoint: null,
    onClose: vi.fn(),
    onCompleted: vi.fn(),
    onRelinkMissing: vi.fn(),
    complianceOpen: false,
    selectedSpecId: '',
    complianceResults: [],
    outputPath: '',
    capabilities: undefined,
    availableHwEncoders: [],
    error: undefined,
    presets: [preset],
    presetId: preset.id,
    platformFitTarget: '',
    platformFitCustomSeconds: 60,
    draftSettings: { width: 1920, height: 1080, fps: 30, videoBitrate: '', audioBitrate: '' },
    exportRangeMode: 'all',
    exportMode: 'single',
    customPresetName: '',
    batchOutputPaths: 'C:/Exports/a.mp4\nC:/Exports/b.mp4',
    priority: 'normal',
    scheduleEnabled: false,
    scheduledStartInput: '',
    completionAction: 'none',
    exportBackgroundSettings: { postExportScriptAcknowledged: true, allowPowerActions: false },
    exportOptimizationSettings: {},
    exportUploadSettings: { enabled: false, targetType: 'webdav', webdav: {}, local: {} },
    exportUploadPassword: '',
    exportPresetSyncSettings: { enabled: false, syncOnStartup: false, conflictMode: 'merge' },
    exportPresetSyncPassword: '',
    presetSyncState: { status: 'idle', message: '' },
    warmupStatus: undefined,
    disableRecommendations: false,
    recommendations: [],
    selectedPreset: preset,
    exportSettings: { outputMode: 'video', format: 'mp4', subtitleFormat: 'srt', targetAspectRatio: 'source' },
    isAudioVisualization: false,
    isAudioOnly: false,
    timelineVisualControlsDisabled: false,
    subtitleLanguageOptions: [],
    loudnessNormalizationEligible: false,
    estimatedSize: '12 MB',
    exportCostEstimate: {
      timelineDurationSeconds: 10,
      estimatedDurationSeconds: 10,
      estimatedFileSizeMb: 12,
      cpuLoad: 'light',
      estimatedCompletionIso: '2026-08-11T00:00:00.000Z',
      complexityFactor: 1,
    },
    exportOptimizationSuggestions: [],
    exportCostHistoryError: undefined,
    historyCostSamples: [],
    hardwareEncodingEligible: false,
    hardwareEncodingRequested: false,
    progressiveExportEnabled: false,
    progressiveExportSupported: false,
    formatOptions: ['mp4', 'mkv', 'mov', 'webm'],
    spatialDenoiseClipCount: 0,
    activeExportRanges: [],
    rangeModeAvailable: { all: true, 'in-out': false, 'selected-clips': false },
    renderFarmEnabled: false,
    renderFarmInstances: 1,
    suggestedRenderFarmInstances: 1,
    history: [],
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

function createActionsStub(): ExportActions {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (typeof prop !== 'string') {
          return undefined;
        }
        return vi.fn();
      },
    },
  ) as unknown as ExportActions;
}

describe('ExportConfig export-batch-paths 多行 textarea 受控绑定', () => {
  it('single 模式下渲染 textarea，受控于 batchOutputPaths，输入回写 setBatchOutputPaths', () => {
    const state = createConfigStateStub();
    const { getByTestId, getByText } = render(<ExportConfig state={state} actions={createActionsStub()} />);

    // 拆分前文案与 label（t.batchPaths / t.batchPlaceholder）保持原样
    getByText(zhCN.exportDialog.batchPaths);
    const textarea = getByTestId('export-batch-paths') as HTMLTextAreaElement;
    expect(textarea.tagName).toBe('TEXTAREA');
    expect(textarea.placeholder).toBe(zhCN.exportDialog.batchPlaceholder);
    expect(textarea.value).toBe('C:/Exports/a.mp4\nC:/Exports/b.mp4');

    fireEvent.change(textarea, { target: { value: 'C:/Exports/x.mp4\nC:/Exports/y.mp4' } });
    const setBatchOutputPaths = (state as unknown as Record<string, ReturnType<typeof vi.fn>>).setBatchOutputPaths;
    expect(setBatchOutputPaths).toHaveBeenCalledWith('C:/Exports/x.mp4\nC:/Exports/y.mp4');
  });

  it('非 single 模式（如 stem）不渲染多路径 textarea，与拆分前三目链 else 分支一致', () => {
    const state = createConfigStateStub({ exportMode: 'stem' });
    const { queryByTestId } = render(<ExportConfig state={state} actions={createActionsStub()} />);
    expect(queryByTestId('export-batch-paths')).toBeNull();
  });
});

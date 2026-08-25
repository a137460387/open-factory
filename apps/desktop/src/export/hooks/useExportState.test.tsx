// @vitest-environment jsdom
// 源文件：apps/desktop/src/export/hooks/useExportState.ts（760 行，四期-B 前覆盖 0%）
// 覆盖目标：≥75%。模式：renderHook + vi.mock 外部依赖（tauri-bridge/settings/stores），
// 断言初始状态、capabilities/预设加载效果、任务成功通知、范围模式回退与派生计算值。
// 注意：props 必须在 renderHook 外创建（引用稳定），否则 project 每次渲染都是新对象，
// 会触发 batchSequences/stemTracks 派生效果的无限重渲染循环。

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

// ── 可变 store 桩（hoisted 供 vi.mock 工厂引用）──────────────────────────

const h = vi.hoisted(() => ({
  queue: {
    tasks: [] as Array<{ id: string; status: string; outputPath: string }>,
    history: [] as unknown[],
    runnerActive: false,
    resourcePaused: false,
    queuePaused: false,
    maxConcurrent: 2,
    clearFinishedTasks: () => {},
  },
  whisper: { executablePath: '', modelPath: '' },
}));

vi.mock('../../lib/tauri-bridge', () => ({
  evaluateExportQuality: vi.fn(),
  getFileStat: vi.fn(),
  getFfmpegCapabilities: vi.fn(async () => ({ available: true, encoders: [] })),
  listHardwareEncoders: vi.fn(async () => []),
  listenBridge: vi.fn(async () => () => {}),
  readExportPresetSyncWebdavPassword: vi.fn(async () => ''),
  readExportUploadWebdavPassword: vi.fn(async () => ''),
  runExportPowerAction: vi.fn(),
  // 供 export-presets（真实模块经 mocked bridge）使用
  fsExists: vi.fn(async () => false),
  getAppDataDir: vi.fn(async () => 'C:/AppData'),
  getWebdavText: vi.fn(),
  putWebdavText: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock('../../lib/toast', () => ({
  showToast: vi.fn(),
}));

vi.mock('../../settings/appSettings', () => ({
  DEFAULT_EXPORT_UPLOAD_SETTINGS: { enabled: false, targetType: 'webdav', webdav: {}, local: {} },
  DEFAULT_EXPORT_PRESET_SYNC_SETTINGS: { enabled: false, syncOnStartup: false, conflictMode: 'merge' },
  readExportBackgroundSettings: vi.fn(async () => ({
    allowPowerActions: false,
    postExportScriptAcknowledged: false,
    lowPowerMode: false,
  })),
  readDisableExportRecommendations: vi.fn(async () => false),
  readExportOptimizationSettings: vi.fn(async () => ({ dismissedSuggestionIds: [] })),
  readExportPresetSyncSettings: vi.fn(async () => ({ enabled: false, syncOnStartup: false, conflictMode: 'merge' })),
  readExportUploadSettings: vi.fn(async () => ({ enabled: false, targetType: 'webdav', webdav: {}, local: {} })),
}));

vi.mock('../../store/whisperSettingsStore', () => ({
  useWhisperSettingsStore: (selector: (state: typeof h.whisper) => unknown) => selector(h.whisper),
}));

vi.mock('../export-background', () => ({
  localDatetimeInputValue: vi.fn(() => '2026-01-01T00:00'),
}));

vi.mock('../export-history', () => ({
  loadExportHistoryIntoStore: vi.fn(async () => []),
}));

vi.mock('../export-queue-store', () => ({
  useExportQueueStore: (selector: (state: typeof h.queue) => unknown) => selector(h.queue),
}));

import { createProject, createTrack, DEFAULT_CLIP_SPEED, type Clip } from '@open-factory/editor-core';
import { BUILTIN_EXPORT_PRESETS } from '../export-presets';
import { VIDEO_EXPORT_FORMATS } from '../lib/exportSettingsHelpers';
import { getFfmpegCapabilities, listHardwareEncoders } from '../../lib/tauri-bridge';
import { showToast } from '../../lib/toast';
import { useExportState, type ExportDialogProps } from './useExportState';

function baseProps(overrides: Partial<ExportDialogProps> = {}): ExportDialogProps {
  return {
    project: createProject('State Test'),
    onClose: vi.fn(),
    onCompleted: vi.fn(),
    ...overrides,
  };
}

/** 含一条音频轨（clip 带 volume）的项目，用于 stemTracks 派生断言。 */
function projectWithAudioTrack() {
  const project = createProject('Audio Project');
  project.timeline = {
    transitions: [],
    markers: [],
    tracks: [
      createTrack({
        id: 'track-audio',
        type: 'audio',
        name: 'Music',
        clips: [
          {
            id: 'clip-audio',
            type: 'audio',
            name: 'BGM',
            mediaId: 'media-a',
            trackId: 'track-audio',
            start: 0,
            duration: 4,
            trimStart: 0,
            trimEnd: 0,
            speed: DEFAULT_CLIP_SPEED,
            volume: 0.8,
          } as unknown as Clip,
        ],
      }),
    ],
  };
  return project;
}

describe('useExportState 初始状态与派生计算值', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.queue.tasks = [];
    h.queue.history = [];
    vi.mocked(getFfmpegCapabilities).mockResolvedValue({ available: true, encoders: [] } as never);
    vi.mocked(listHardwareEncoders).mockResolvedValue([] as never);
  });

  it('挂载后提供完整默认状态（步骤/模式/预设/范围可用性）', async () => {
    const props = baseProps();
    const { result } = renderHook(() => useExportState(props));

    expect(result.current.currentStep).toBe('config');
    expect(result.current.exportMode).toBe('single');
    expect(result.current.exportRangeMode).toBe('all');
    expect(result.current.presetId).toBe(BUILTIN_EXPORT_PRESETS[0].id);
    expect(result.current.presets.length).toBeGreaterThanOrEqual(BUILTIN_EXPORT_PRESETS.length);
    expect(result.current.draftSettings).toEqual(BUILTIN_EXPORT_PRESETS[0].settings);
    expect(result.current.rangeModeAvailable).toEqual({ all: true, 'in-out': false, 'selected-clips': false });
    expect(result.current.activeExportRanges).toEqual([]);
    expect(result.current.priority).toBe('normal');
    expect(result.current.completionAction).toBe('none');
    expect(result.current.formatOptions).toEqual(VIDEO_EXPORT_FORMATS);
    expect(result.current.isAudioOnly).toBe(false);
    expect(result.current.isAudioVisualization).toBe(false);
    expect(result.current.timelineVisualControlsDisabled).toBe(false);
    expect(result.current.codecComparePresetIds).toEqual(BUILTIN_EXPORT_PRESETS.slice(0, 2).map((p) => p.id));
    expect(result.current.versionedBatchRows).toHaveLength(2);
    // createProject 自带默认序列：sequenceBatchRows 派生 1 行（默认选中、模板展开输出路径）
    expect(result.current.sequenceBatchRows).toHaveLength(1);
    expect(result.current.sequenceBatchRows[0].selected).toBe(true);
    expect(result.current.sequenceBatchRows[0].outputPath).toMatch(/\.mp4$/);
    expect(result.current.selectedSequenceIds).toHaveLength(1);
    // createProject 自带 Audio 1 音频轨：stemTracks 派生默认全选行
    expect(result.current.stemTracks).toEqual([
      { trackIndex: 1, trackName: 'Audio 1', selected: true, format: 'default' },
    ]);
    expect(typeof result.current.estimatedSize).toBe('string');
    expect(result.current.suggestedRenderFarmInstances).toBeGreaterThan(0);
    expect(Array.isArray(result.current.recommendations)).toBe(true);
    expect(result.current.exportCostEstimate.estimatedDurationSeconds).toBeGreaterThanOrEqual(0);
    expect(result.current.historyCostSamples).toEqual([]);
    expect(result.current.exportCostHistoryError).toBeUndefined();
    expect(result.current.versionedBatchReportRows).toEqual([]);
    expect(result.current.sortedCodecCompareResults).toEqual([]);
    expect(result.current.codecCompareRecommendation).toBeUndefined();
    // 等待异步效果（capabilities/预设加载）落定，避免泄漏到后续用例
    await waitFor(() => expect(result.current.capabilities).toBeDefined());
  });

  it('capabilities 效果：探测 ffmpeg 能力并填充硬件编码器列表', async () => {
    vi.mocked(getFfmpegCapabilities).mockResolvedValue({
      available: true,
      encoders: [],
      hardwareEncoders: [{ name: 'h264_nvenc' }],
    } as never);
    const props = baseProps();
    const { result } = renderHook(() => useExportState(props));

    await waitFor(() => expect(result.current.availableHwEncoders).toEqual([{ name: 'h264_nvenc' }]));
    expect(result.current.capabilities).toMatchObject({ available: true });
  });

  it('listHardwareEncoders 返回非空时覆盖能力探测结果', async () => {
    vi.mocked(getFfmpegCapabilities).mockResolvedValue({ available: true, encoders: [] } as never);
    vi.mocked(listHardwareEncoders).mockResolvedValue([{ name: 'hevc_qsv' }] as never);
    const props = baseProps();
    const { result } = renderHook(() => useExportState(props));

    await waitFor(() => expect(result.current.availableHwEncoders).toEqual([{ name: 'hevc_qsv' }]));
  });

  it('ffmpeg 探测失败时写入错误消息', async () => {
    vi.mocked(getFfmpegCapabilities).mockRejectedValue(new Error('ffmpeg missing') as never);
    const props = baseProps();
    const { result } = renderHook(() => useExportState(props));

    await waitFor(() => expect(result.current.error).toBe('ffmpeg missing'));
  });

  it('initialPreset 注入：置于预设列表首位并成为当前选中', async () => {
    const initialPreset = {
      ...BUILTIN_EXPORT_PRESETS[0],
      id: 'custom-1',
      name: 'My Preset',
      settings: { ...BUILTIN_EXPORT_PRESETS[0].settings, videoBitrate: '12M' },
    };
    const props = baseProps({ initialPreset });
    const { result } = renderHook(() => useExportState(props));

    expect(result.current.presets[0].id).toBe('custom-1');
    expect(result.current.presetId).toBe('custom-1');
    expect(result.current.selectedPreset.id).toBe('custom-1');
    await waitFor(() => expect(result.current.draftSettings.videoBitrate).toBe('12M'));
  });

  it('任务成功效果：触发 onCompleted + 成功 toast，并执行通知型完成动作', async () => {
    const onCompleted = vi.fn();
    const props = baseProps({ onCompleted });
    const { result, rerender } = renderHook(() => useExportState(props));
    await waitFor(() => expect(result.current.capabilities).toBeDefined());

    act(() => {
      result.current.pendingCompletionAction.current = 'notification';
      h.queue.tasks = [{ id: 'task-ok', status: 'success', outputPath: 'C:/Exports/done.mp4' }];
      rerender();
    });

    await waitFor(() => expect(onCompleted).toHaveBeenCalledWith('C:/Exports/done.mp4'));
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'success', message: 'C:/Exports/done.mp4' }),
    );
    // notification 完成动作再次 toast（jsdom 无 Notification API，仅走 toast 分支）
    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success', title: expect.any(String) })),
    );
  });

  it('exportRangeMode 指向不可用模式时自动回退 all', async () => {
    const props = baseProps();
    const { result } = renderHook(() => useExportState(props));
    await waitFor(() => expect(result.current.capabilities).toBeDefined());

    act(() => {
      result.current.setExportRangeMode('in-out');
    });

    await waitFor(() => expect(result.current.exportRangeMode).toBe('all'));
  });

  it('含音频轨的项目派生 stemTracks（默认全选、default 格式）', async () => {
    const props = baseProps({ project: projectWithAudioTrack() });
    const { result } = renderHook(() => useExportState(props));

    await waitFor(() =>
      expect(result.current.stemTracks).toEqual([
        { trackIndex: 0, trackName: 'Music', selected: true, format: 'default' },
      ]),
    );
  });

  it('in/out props 提供时暴露 in-out 范围可用性', async () => {
    const props = baseProps({ inPoint: 0, outPoint: 2 });
    const { result } = renderHook(() => useExportState(props));

    expect(result.current.inOutExportRanges.length).toBeGreaterThan(0);
    expect(result.current.rangeModeAvailable['in-out']).toBe(true);
    await waitFor(() => expect(result.current.capabilities).toBeDefined());
  });
});

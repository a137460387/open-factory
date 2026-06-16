import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FfmpegExportPlan, PostExportQualityAssuranceResult } from '@open-factory/editor-core';
import type { TauriMocks } from '../lib/tauri-bridge';
import { ensureExportQueueRunner } from './export-queue-runner';
import { useExportQueueStore } from './export-queue-store';
import { buildSidecarSubtitlePath } from './export-sidecar';

describe('export queue sidecar subtitles', () => {
  afterEach(() => {
    useExportQueueStore.setState({
      tasks: [],
      history: [],
      runnerActive: false,
      resourcePaused: false,
      queuePaused: false,
      maxConcurrent: 2,
      lastCompletedPath: undefined
    });
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('writes sidecar subtitles next to the exported media with the subtitle extension', () => {
    expect(buildSidecarSubtitlePath('C:/Exports/video.mp4', 'subtitles.ass')).toBe('C:/Exports/video.ass');
    expect(buildSidecarSubtitlePath('D:\\Exports\\review.cut.mov', 'subtitles.vtt')).toBe('D:\\Exports\\review.cut.vtt');
  });

  it('keeps subtitle language suffixes when writing multilingual sidecars', () => {
    expect(buildSidecarSubtitlePath('C:/Exports/video.mp4', 'subtitles.zh.srt')).toBe('C:/Exports/video.zh.srt');
    expect(buildSidecarSubtitlePath('D:\\Exports\\review.cut.mov', 'subtitles.en.srt')).toBe('D:\\Exports\\review.cut.en.srt');
  });

  it('falls back to srt when the artifact file has no extension', () => {
    expect(buildSidecarSubtitlePath('C:/Exports/video', 'subtitles')).toBe('C:/Exports/video.srt');
  });

  it('retries a local export once when post-export quality assurance fails with auto retry enabled', async () => {
    const appDataDir = 'C:/Users/E2E/AppData/Roaming/open-factory';
    const settingsPath = `${appDataDir}/settings.json`;
    const files = new Map<string, string>([
      [
        settingsPath,
        JSON.stringify({
          exportQualityAssurance: {
            enabled: true,
            duration: true,
            blackFrameDurationSeconds: 0.5,
            silenceThresholdDb: -50,
            silenceDurationSeconds: 2,
            autoRetry: true
          }
        })
      ]
    ]);
    const runExport = vi.fn(() => ({
      success: true,
      outputPath: 'C:/Exports/retry.mp4',
      durationMs: 1,
      warnings: [],
      report: {}
    }));
    let qualityCalls = 0;
    const runPostExportQualityAssurance = vi.fn((): PostExportQualityAssuranceResult => {
      qualityCalls += 1;
      return {
        status: qualityCalls === 1 ? 'fail' : 'pass',
        completedAt: `quality-${qualityCalls}`,
        retryRecommended: qualityCalls === 1,
        checks: [
          {
            id: 'duration',
            status: qualityCalls === 1 ? 'fail' : 'pass',
            message: qualityCalls === 1 ? '导出时长误差超过 1 帧' : '导出时长在 1 帧误差内'
          }
        ]
      };
    });
    vi.stubGlobal('window', {
      __TAURI_MOCKS__: {
        getAppDataDir: () => appDataDir,
        fsExists: (path) => files.has(path),
        readFile: (path) => {
          const value = files.get(path);
          if (value === undefined) {
            throw new Error(`missing ${path}`);
          }
          return value;
        },
        writeFile: (path, contents) => {
          files.set(path, contents);
        },
        getAvailableMemoryBytes: () => Number.MAX_SAFE_INTEGER,
        listen: () => () => undefined,
        runExport,
        runPostExportQualityAssurance
      } satisfies TauriMocks
    });
    const plan = {
      projectName: 'QA',
      settings: { width: 1920, height: 1080, fps: 30 },
      inputs: [],
      filterComplex: '',
      maps: [],
      outputArgs: [],
      fullArgs: ['-y', 'C:/Exports/retry.mp4'],
      warnings: [],
      textArtifacts: [],
      nestedPlans: [],
      duration: 10
    } as unknown as FfmpegExportPlan;

    const task = useExportQueueStore.getState().addTask({
      name: 'QA',
      projectName: 'QA',
      outputPath: 'C:/Exports/retry.mp4',
      plan,
      priority: 'normal'
    });

    await ensureExportQueueRunner();

    expect(runExport).toHaveBeenCalledTimes(2);
    expect(runPostExportQualityAssurance).toHaveBeenCalledTimes(2);
    expect(useExportQueueStore.getState().tasks.find((item) => item.id === task.id)?.report?.qualityAssurance?.status).toBe('pass');
    expect(useExportQueueStore.getState().history[0]?.report?.qualityAssurance?.status).toBe('pass');
  });

  it('falls back to libx264 after an unsupported codec failure and records recovery history', async () => {
    const appDataDir = 'C:/Users/E2E/AppData/Roaming/open-factory';
    const files = new Map<string, string>();
    const runExport = vi
      .fn()
      .mockRejectedValueOnce(new Error('Unknown encoder h264_nvenc'))
      .mockResolvedValueOnce({
        success: true,
        outputPath: 'C:/Exports/recovered.mp4',
        durationMs: 1,
        warnings: [],
        report: {}
      });
    vi.stubGlobal('window', {
      __TAURI_MOCKS__: {
        getAppDataDir: () => appDataDir,
        readFile: (path) => {
          const value = files.get(path);
          if (value === undefined) {
            throw new Error(`missing ${path}`);
          }
          return value;
        },
        writeFile: (path, contents) => {
          files.set(path, contents);
        },
        getAvailableMemoryBytes: () => Number.MAX_SAFE_INTEGER,
        listen: () => () => undefined,
        runExport
      } satisfies TauriMocks
    });
    const plan = {
      projectName: 'Recovery',
      settings: { width: 1920, height: 1080, fps: 30, videoCodec: 'h264_nvenc', hardwareEncoding: true },
      inputs: [],
      filterComplex: '',
      maps: [],
      outputArgs: ['-c:v', 'h264_nvenc', 'C:/Exports/recovered.mp4'],
      fullArgs: ['-y', '-c:v', 'h264_nvenc', 'C:/Exports/recovered.mp4'],
      warnings: [],
      textArtifacts: [],
      nestedPlans: [],
      duration: 10
    } as unknown as FfmpegExportPlan;

    const task = useExportQueueStore.getState().addTask({
      name: 'Recovery',
      projectName: 'Recovery',
      outputPath: 'C:/Exports/recovered.mp4',
      plan,
      priority: 'normal'
    });

    await ensureExportQueueRunner();

    expect(runExport).toHaveBeenCalledTimes(2);
    expect(runExport.mock.calls[1][0].fullArgs).toEqual(expect.arrayContaining(['-c:v', 'libx264']));
    const finishedTask = useExportQueueStore.getState().tasks.find((item) => item.id === task.id);
    expect(finishedTask?.report?.recovery).toMatchObject({
      healed: true,
      attempts: 1,
      entries: [expect.objectContaining({ errorKind: 'unsupported-codec', action: 'fallback-codec', result: 'success' })]
    });
    expect(useExportQueueStore.getState().history[0]?.report?.recovery?.healed).toBe(true);
  });
});

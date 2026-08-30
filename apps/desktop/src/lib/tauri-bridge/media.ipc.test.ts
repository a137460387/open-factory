// @vitest-environment jsdom
// 源文件：apps/desktop/src/lib/tauri-bridge/media.ts（242 可执行行，五期前覆盖 11.16%）
// 覆盖目标：≥75%。模式：mockIPC 拦截 invoke 断言 command 名与参数（数据驱动覆盖全部导出），
// 辅以 __TAURI_MOCKS__ 路径与浏览器回退分支（probeMedia 默认值 / analyzeMedia 抛错 / smoke config undefined）。

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockIPC, clearMocks } from '@tauri-apps/api/mocks';

import {
  probeMedia,
  analyzeMedia,
  scanMediaIntegrity,
  analyzeAudioSpectrum,
  generateGapFillMedia,
  extractCoverFrames,
  batchExtractCoverFrames,
  analyzeWaveform,
  detectBeats,
  detectSilence,
  generateProxy,
  detectSceneChanges,
  cancelSceneDetection,
  detectGlitches,
  runWhisper,
  runDemucs,
  cancelDemucs,
  processAudioNoiseReduction,
  cancelAudioNoiseReduction,
  detectPrivacyRegions,
  startRecording,
  stopRecording,
  scanDirectory,
  getPreviewSmokeConfig,
  getCancelSmokeConfig,
  detectFfmpeg,
  getFfmpegCapabilities,
  listHardwareEncoders,
  getAvailableMemoryBytes,
  getSystemResourceSnapshot,
} from './media';

type WindowWithTauri = Window & {
  __TAURI_INTERNALS__?: Record<string, unknown>;
  __TAURI_MOCKS__?: Record<string, unknown>;
};

function resetBrowserEnv() {
  delete (window as WindowWithTauri).__TAURI_INTERNALS__;
  delete (window as WindowWithTauri).__TAURI_MOCKS__;
}

beforeEach(() => {
  resetBrowserEnv();
});

afterEach(() => {
  clearMocks();
  resetBrowserEnv();
});

const invokeCases: Array<{ name: string; run: () => Promise<unknown>; cmd: string; args: Record<string, unknown> }> = [
  { name: 'probeMedia', run: () => probeMedia('/a.mp4'), cmd: 'probe_media', args: { path: '/a.mp4' } },
  { name: 'analyzeMedia', run: () => analyzeMedia('/a.mp4'), cmd: 'analyze_media', args: { path: '/a.mp4' } },
  {
    name: 'scanMediaIntegrity',
    run: () => scanMediaIntegrity('/a.mp4'),
    cmd: 'scan_media_integrity',
    args: { path: '/a.mp4' },
  },
  {
    name: 'analyzeAudioSpectrum',
    run: () => analyzeAudioSpectrum('/a.wav'),
    cmd: 'analyze_audio_spectrum',
    args: { path: '/a.wav' },
  },
  {
    name: 'generateGapFillMedia',
    run: () => generateGapFillMedia({ clipId: 'c1' } as never),
    cmd: 'generate_gap_fill_media',
    args: { request: { clipId: 'c1' } },
  },
  {
    name: 'extractCoverFrames',
    run: () => extractCoverFrames({ clipId: 'c1' } as never),
    cmd: 'extract_cover_frames',
    args: { request: { clipId: 'c1' } },
  },
  {
    name: 'batchExtractCoverFrames',
    run: () => batchExtractCoverFrames({ clipIds: [] } as never),
    cmd: 'batch_extract_cover_frames',
    args: { request: { clipIds: [] } },
  },
  {
    name: 'analyzeWaveform',
    run: () => analyzeWaveform('/a.wav', 8),
    cmd: 'analyze_waveform',
    args: { path: '/a.wav', samplesPerSec: 8 },
  },
  {
    name: 'detectBeats',
    run: () => detectBeats('/a.wav', 'high'),
    cmd: 'detect_beats',
    args: { path: '/a.wav', sensitivity: 'high' },
  },
  {
    name: 'detectSilence',
    run: () => detectSilence('/a.wav', -40, 200),
    cmd: 'detect_silence',
    args: { path: '/a.wav', thresholdDb: -40, minGapMs: 200 },
  },
  {
    name: 'generateProxy',
    run: () => generateProxy({ clipId: 'c1' } as never),
    cmd: 'generate_proxy',
    args: { plan: { clipId: 'c1' } },
  },
  {
    name: 'detectSceneChanges',
    run: () => detectSceneChanges({ path: '/a.mp4' } as never),
    cmd: 'detect_scene_changes',
    args: { request: { path: '/a.mp4' } },
  },
  {
    name: 'cancelSceneDetection',
    run: () => cancelSceneDetection('task-1'),
    cmd: 'cancel_scene_detection',
    args: { taskId: 'task-1' },
  },
  {
    name: 'detectGlitches',
    run: () => detectGlitches({ path: '/a.mp4' } as never),
    cmd: 'detect_glitches',
    args: { request: { path: '/a.mp4' } },
  },
  {
    name: 'runWhisper',
    run: () => runWhisper({ clipId: 'c1' } as never),
    cmd: 'run_whisper',
    args: { request: { clipId: 'c1' } },
  },
  {
    name: 'runDemucs',
    run: () => runDemucs({ clipId: 'c1' } as never),
    cmd: 'run_demucs',
    args: { request: { clipId: 'c1' } },
  },
  { name: 'cancelDemucs', run: () => cancelDemucs('clip-1'), cmd: 'cancel_demucs', args: { clipId: 'clip-1' } },
  {
    name: 'processAudioNoiseReduction',
    run: () => processAudioNoiseReduction({ clipId: 'c1' } as never),
    cmd: 'process_audio_noise_reduction',
    args: { request: { clipId: 'c1' } },
  },
  {
    name: 'cancelAudioNoiseReduction',
    run: () => cancelAudioNoiseReduction('clip-1'),
    cmd: 'cancel_audio_noise_reduction',
    args: { clipId: 'clip-1' },
  },
  {
    name: 'detectPrivacyRegions',
    run: () => detectPrivacyRegions({ path: '/a.mp4' } as never),
    cmd: 'detect_privacy_regions',
    args: { request: { path: '/a.mp4' } },
  },
  {
    name: 'startRecording',
    run: () => startRecording({ width: 1280 } as never),
    cmd: 'start_recording',
    args: { request: { width: 1280 } },
  },
  { name: 'stopRecording', run: () => stopRecording('task-1'), cmd: 'stop_recording', args: { taskId: 'task-1' } },
  {
    name: 'scanDirectory(默认深度)',
    run: () => scanDirectory('/media'),
    cmd: 'scan_directory',
    args: { path: '/media', depth: 3 },
  },
  {
    name: 'scanDirectory(显式深度)',
    run: () => scanDirectory('/media', 1),
    cmd: 'scan_directory',
    args: { path: '/media', depth: 1 },
  },
  { name: 'getPreviewSmokeConfig', run: () => getPreviewSmokeConfig(), cmd: 'get_preview_smoke_config', args: {} },
  { name: 'getCancelSmokeConfig', run: () => getCancelSmokeConfig(), cmd: 'get_cancel_smoke_config', args: {} },
  { name: 'detectFfmpeg', run: () => detectFfmpeg(), cmd: 'detect_ffmpeg', args: {} },
  { name: 'getFfmpegCapabilities', run: () => getFfmpegCapabilities(), cmd: 'get_ffmpeg_capabilities', args: {} },
  {
    name: 'listHardwareEncoders（无 mock 分支）',
    run: () => listHardwareEncoders(),
    cmd: 'list_hardware_encoders',
    args: {},
  },
  {
    name: 'getAvailableMemoryBytes',
    run: () => getAvailableMemoryBytes(),
    cmd: 'get_available_memory_bytes',
    args: {},
  },
  {
    name: 'getSystemResourceSnapshot',
    run: () => getSystemResourceSnapshot(),
    cmd: 'get_system_resource_snapshot',
    args: {},
  },
];

describe('media bridge：Tauri invoke 路径（数据驱动）', () => {
  it.each(invokeCases)('$name → $cmd', async ({ run, cmd, args }) => {
    const handler = vi.fn(async () => 'ok');
    mockIPC(handler);
    await run();
    expect(handler).toHaveBeenCalledWith(cmd, args);
  });

  it('返回值原样透传（detectFfmpeg/getFfmpegCapabilities/analyzeWaveform/getAvailableMemoryBytes）', async () => {
    mockIPC(async (cmd: string) => {
      if (cmd === 'detect_ffmpeg') return true;
      if (cmd === 'get_ffmpeg_capabilities') return { available: true, encoders: [] };
      if (cmd === 'analyze_waveform') return [0.1, 0.5, 0.9];
      if (cmd === 'get_available_memory_bytes') return 8 * 1024 * 1024 * 1024;
      return undefined;
    });
    await expect(detectFfmpeg()).resolves.toBe(true);
    await expect(getFfmpegCapabilities()).resolves.toEqual({ available: true, encoders: [] });
    await expect(analyzeWaveform('/a.wav', 4)).resolves.toEqual([0.1, 0.5, 0.9]);
    await expect(getAvailableMemoryBytes()).resolves.toBe(8 * 1024 * 1024 * 1024);
  });

  it('invoke 抛错时错误向上传播（runWhisper）', async () => {
    mockIPC(async () => {
      throw new Error('whisper crashed');
    });
    await expect(runWhisper({ clipId: 'c1' } as never)).rejects.toThrow('whisper crashed');
  });
});

describe('media bridge：__TAURI_MOCKS__ 路径', () => {
  it('mock 存在时短路 invoke 并透传参数', async () => {
    const probeMediaMock = vi.fn(async () => ({ hasAudio: true }));
    const analyzeWaveformMock = vi.fn(async () => [0.5]);
    (window as WindowWithTauri).__TAURI_MOCKS__ = {
      probeMedia: probeMediaMock,
      analyzeWaveform: analyzeWaveformMock,
    };
    await expect(probeMedia('/a.mp4')).resolves.toEqual({ hasAudio: true });
    await expect(analyzeWaveform('/a.wav', 4)).resolves.toEqual([0.5]);
    expect(probeMediaMock).toHaveBeenCalledWith('/a.mp4');
    expect(analyzeWaveformMock).toHaveBeenCalledWith('/a.wav', 4);
  });
});

describe('media bridge：浏览器回退路径', () => {
  it('probeMedia 浏览器下返回 { hasAudio: false } 默认值', async () => {
    await expect(probeMedia('/a.mp4')).resolves.toEqual({ hasAudio: false });
  });

  it('需要后端的命令在浏览器抛错', async () => {
    await expect(analyzeMedia('/a.mp4')).rejects.toThrow('analyzeMedia');
    await expect(scanMediaIntegrity('/a.mp4')).rejects.toThrow('scanMediaIntegrity');
    await expect(analyzeAudioSpectrum('/a.wav')).rejects.toThrow('analyzeAudioSpectrum');
    await expect(generateGapFillMedia({} as never)).rejects.toThrow('generateGapFillMedia');
    await expect(extractCoverFrames({} as never)).rejects.toThrow('extractCoverFrames');
    await expect(batchExtractCoverFrames({} as never)).rejects.toThrow('batchExtractCoverFrames');
  });

  it('smoke config 浏览器下返回 undefined', async () => {
    await expect(getPreviewSmokeConfig()).resolves.toBeUndefined();
    await expect(getCancelSmokeConfig()).resolves.toBeUndefined();
  });
});

import { invoke } from '@tauri-apps/api/core';
import type { BeatSensitivity, FfmpegCapabilities, HardwareEncoderInfo, ProxyPlan } from '@open-factory/editor-core';
import type {
  AudioSpectrumAnalysis,
  CancelSmokeConfig,
  CoverFrameBatchRequest,
  CoverFrameBatchResult,
  CoverFrameExtractionRequest,
  CoverFrameExtractionResult,
  DemucsRequest,
  DemucsResult,
  GapFillMediaRequest,
  GapFillMediaResult,
  MediaAnalysis,
  MediaIntegrityScanResult,
  MediaProbe,
  NativeSilenceRange,
  NoiseReductionRequest,
  NoiseReductionResult,
  PreviewSmokeConfig,
  PrivacyDetectionRequest,
  PrivacyDetectionResult,
  ProxyResult,
  RecordingRequest,
  RecordingStartResult,
  RecordingStopResult,
  SceneDetectRequest,
  SceneDetectionResult,
  SystemResourceSnapshot,
  WhisperRequest,
  WhisperResult,
} from './types';
import { getTauriMocks } from './mock-types';
import { isTauriRuntime } from '../tauri';

export async function probeMedia(path: string): Promise<MediaProbe> {
  const mock = getTauriMocks()?.probeMedia;
  if (mock) {
    return mock(path);
  }
  if (!isTauriRuntime()) {
    return { hasAudio: false };
  }
  return invoke<MediaProbe>('probe_media', { path });
}

export async function analyzeMedia(path: string): Promise<MediaAnalysis> {
  const mock = getTauriMocks()?.analyzeMedia;
  if (mock) {
    return mock(path);
  }
  if (!isTauriRuntime()) {
    throw new Error('analyzeMedia 需要 Tauri 或 __TAURI_MOCKS__ 实现。');
  }
  return invoke<MediaAnalysis>('analyze_media', { path });
}

export async function scanMediaIntegrity(path: string): Promise<MediaIntegrityScanResult> {
  const mock = getTauriMocks()?.scanMediaIntegrity;
  if (mock) {
    return mock(path);
  }
  if (!isTauriRuntime()) {
    throw new Error('scanMediaIntegrity 需要 Tauri 或 __TAURI_MOCKS__ 实现。');
  }
  return invoke<MediaIntegrityScanResult>('scan_media_integrity', { path });
}

export async function analyzeAudioSpectrum(path: string): Promise<AudioSpectrumAnalysis> {
  const mock = getTauriMocks()?.analyzeAudioSpectrum;
  if (mock) {
    return mock(path);
  }
  if (!isTauriRuntime()) {
    throw new Error('analyzeAudioSpectrum 需要 Tauri 或 __TAURI_MOCKS__ 实现。');
  }
  return invoke<AudioSpectrumAnalysis>('analyze_audio_spectrum', { path });
}

export async function generateGapFillMedia(request: GapFillMediaRequest): Promise<GapFillMediaResult> {
  const mock = getTauriMocks()?.generateGapFillMedia;
  if (mock) {
    return mock(request);
  }
  if (!isTauriRuntime()) {
    throw new Error('generateGapFillMedia 需要 Tauri 或 __TAURI_MOCKS__ 实现。');
  }
  return invoke<GapFillMediaResult>('generate_gap_fill_media', { request });
}

export async function extractCoverFrames(request: CoverFrameExtractionRequest): Promise<CoverFrameExtractionResult> {
  const mock = getTauriMocks()?.extractCoverFrames;
  if (mock) {
    return mock(request);
  }
  if (!isTauriRuntime()) {
    throw new Error('extractCoverFrames 需要 Tauri 或 __TAURI_MOCKS__ 实现。');
  }
  return invoke<CoverFrameExtractionResult>('extract_cover_frames', { request });
}

export async function batchExtractCoverFrames(request: CoverFrameBatchRequest): Promise<CoverFrameBatchResult> {
  const mock = getTauriMocks()?.batchExtractCoverFrames;
  if (mock) {
    return mock(request);
  }
  if (!isTauriRuntime()) {
    throw new Error('batchExtractCoverFrames 需要 Tauri 或 __TAURI_MOCKS__ 实现。');
  }
  return invoke<CoverFrameBatchResult>('batch_extract_cover_frames', { request });
}

export async function analyzeWaveform(path: string, samplesPerSec: number): Promise<number[]> {
  const mock = getTauriMocks()?.analyzeWaveform;
  if (mock) {
    return mock(path, samplesPerSec);
  }
  return invoke<number[]>('analyze_waveform', { path, samplesPerSec });
}

export async function detectBeats(path: string, sensitivity: BeatSensitivity): Promise<number[]> {
  const mock = getTauriMocks()?.detectBeats;
  if (mock) {
    return mock(path, sensitivity);
  }
  return invoke<number[]>('detect_beats', { path, sensitivity });
}

export async function detectSilence(
  path: string,
  thresholdDb: number,
  minGapMs: number,
): Promise<NativeSilenceRange[]> {
  const mock = getTauriMocks()?.detectSilence;
  if (mock) {
    return mock(path, thresholdDb, minGapMs);
  }
  return invoke<NativeSilenceRange[]>('detect_silence', { path, thresholdDb, minGapMs });
}

export async function generateProxy(plan: ProxyPlan): Promise<ProxyResult> {
  const mock = getTauriMocks()?.generateProxy;
  if (mock) {
    return mock(plan);
  }
  return invoke<ProxyResult>('generate_proxy', { plan });
}

export async function detectSceneChanges(request: SceneDetectRequest): Promise<SceneDetectionResult> {
  const mock = getTauriMocks()?.detectSceneChanges;
  if (mock) {
    return mock(request);
  }
  return invoke<SceneDetectionResult>('detect_scene_changes', { request });
}

export async function cancelSceneDetection(taskId: string): Promise<void> {
  const mock = getTauriMocks()?.cancelSceneDetection;
  if (mock) {
    return mock(taskId);
  }
  return invoke<void>('cancel_scene_detection', { taskId });
}

export async function runWhisper(request: WhisperRequest): Promise<WhisperResult> {
  const mock = getTauriMocks()?.runWhisper;
  if (mock) {
    return mock(request);
  }
  return invoke<WhisperResult>('run_whisper', { request });
}

export async function runDemucs(request: DemucsRequest): Promise<DemucsResult> {
  const mock = getTauriMocks()?.runDemucs;
  if (mock) {
    return mock(request);
  }
  return invoke<DemucsResult>('run_demucs', { request });
}

export async function cancelDemucs(clipId: string): Promise<void> {
  const mock = getTauriMocks()?.cancelDemucs;
  if (mock) {
    await mock(clipId);
    return;
  }
  await invoke('cancel_demucs', { clipId });
}

export async function processAudioNoiseReduction(request: NoiseReductionRequest): Promise<NoiseReductionResult> {
  const mock = getTauriMocks()?.processAudioNoiseReduction;
  if (mock) {
    return mock(request);
  }
  return invoke<NoiseReductionResult>('process_audio_noise_reduction', { request });
}

export async function cancelAudioNoiseReduction(clipId: string): Promise<void> {
  const mock = getTauriMocks()?.cancelAudioNoiseReduction;
  if (mock) {
    await mock(clipId);
    return;
  }
  await invoke('cancel_audio_noise_reduction', { clipId });
}

export async function detectPrivacyRegions(request: PrivacyDetectionRequest): Promise<PrivacyDetectionResult> {
  const mock = getTauriMocks()?.detectPrivacyRegions;
  if (mock) {
    return mock(request);
  }
  return invoke<PrivacyDetectionResult>('detect_privacy_regions', { request });
}

export async function startRecording(request: RecordingRequest): Promise<RecordingStartResult> {
  const mock = getTauriMocks()?.startRecording;
  if (mock) {
    return mock(request);
  }
  return invoke<RecordingStartResult>('start_recording', { request });
}

export async function stopRecording(taskId: string): Promise<RecordingStopResult> {
  const mock = getTauriMocks()?.stopRecording;
  if (mock) {
    return mock(taskId);
  }
  return invoke<RecordingStopResult>('stop_recording', { taskId });
}

export async function scanDirectory(path: string, depth = 3): Promise<string[]> {
  const mock = getTauriMocks()?.scanDirectory;
  if (mock) {
    return mock(path, depth);
  }
  return invoke<string[]>('scan_directory', { path, depth });
}

export async function getPreviewSmokeConfig(): Promise<PreviewSmokeConfig | undefined> {
  const mock = getTauriMocks()?.getPreviewSmokeConfig;
  if (mock) {
    return mock();
  }
  if (!isTauriRuntime()) {
    return undefined;
  }
  return invoke<PreviewSmokeConfig | undefined>('get_preview_smoke_config');
}

export async function getCancelSmokeConfig(): Promise<CancelSmokeConfig | undefined> {
  const mock = getTauriMocks()?.getCancelSmokeConfig;
  if (mock) {
    return mock();
  }
  if (!isTauriRuntime()) {
    return undefined;
  }
  return invoke<CancelSmokeConfig | undefined>('get_cancel_smoke_config');
}

export async function detectFfmpeg(): Promise<boolean> {
  const mock = getTauriMocks()?.detectFfmpeg;
  if (mock) {
    return mock();
  }
  return invoke<boolean>('detect_ffmpeg');
}

export async function getFfmpegCapabilities(): Promise<FfmpegCapabilities> {
  const mock = getTauriMocks()?.getFfmpegCapabilities;
  if (mock) {
    return mock();
  }
  return invoke<FfmpegCapabilities>('get_ffmpeg_capabilities');
}

export async function listHardwareEncoders(): Promise<HardwareEncoderInfo[]> {
  return invoke<HardwareEncoderInfo[]>('list_hardware_encoders');
}

export async function getAvailableMemoryBytes(): Promise<number> {
  const mock = getTauriMocks()?.getAvailableMemoryBytes;
  if (mock) {
    return mock();
  }
  return invoke<number>('get_available_memory_bytes');
}

export async function getSystemResourceSnapshot(): Promise<SystemResourceSnapshot> {
  const mock = getTauriMocks()?.getSystemResourceSnapshot;
  if (mock) {
    return mock();
  }
  return invoke<SystemResourceSnapshot>('get_system_resource_snapshot');
}

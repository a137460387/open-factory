import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { confirm, message as dialogMessage } from '@tauri-apps/plugin-dialog';
import { open as openShellPath } from '@tauri-apps/plugin-shell';
import type { FfmpegCapabilities, FfmpegExportPlan, ProxyPlan } from '@open-factory/editor-core';
import { isTauriRuntime } from './tauri';

export interface FileDialogFilter {
  name: string;
  extensions: string[];
}

export interface FileStat {
  path: string;
  size: number;
  mtimeMs: number;
}

export interface ExportResult {
  success: boolean;
  outputPath: string;
  durationMs: number;
  warnings: string[];
}

export interface MediaProbe {
  hasAudio: boolean;
  audioChannels?: number;
  audioSampleRate?: number;
  audioCodec?: string;
}

export interface ProxyResult {
  assetId: string;
  proxyPath: string;
  durationMs: number;
}

export interface SceneDetectRequest {
  path: string;
  threshold?: number;
  duration?: number;
}

export interface SceneDetectionResult {
  sceneTimes: number[];
}

export type NativeSilenceRange = [number, number];

export type UnsavedCloseAction = 'save' | 'discard' | 'cancel';

export interface PreviewSmokeConfig {
  enabled: boolean;
  fixtureName?: string;
  mediaPath: string;
  proxyMediaPath?: string;
  reportPath: string;
}

export interface CancelSmokeConfig {
  enabled: boolean;
  mediaPath: string;
  outputPath: string;
  reportPath: string;
}

export type TauriMocks = Partial<{
  confirm(message: string, options?: unknown): Promise<boolean> | boolean;
  chooseUnsavedCloseAction(): Promise<UnsavedCloseAction> | UnsavedCloseAction;
  openFileDialog(options: { multiple: boolean; filters: FileDialogFilter[] }): Promise<string[]> | string[];
  saveFileDialog(options: { defaultPath?: string; filters: FileDialogFilter[] }): Promise<string | undefined> | string | undefined;
  openDirectoryDialog(): Promise<string | undefined> | string | undefined;
  readFile(path: string): Promise<string> | string;
  writeFile(path: string, contents: string): Promise<void> | void;
  removeFile(path: string): Promise<void> | void;
  fsExists(path: string): Promise<boolean> | boolean;
  getAppDataDir(): Promise<string> | string;
  getFileStat(path: string): Promise<FileStat> | FileStat;
  scanDirectory(path: string, depth?: number): Promise<string[]> | string[];
  authorizePaths(paths: string[]): Promise<void> | void;
  detectFfmpeg(): Promise<boolean> | boolean;
  getFfmpegCapabilities(): Promise<FfmpegCapabilities> | FfmpegCapabilities;
  runExport(plan: FfmpegExportPlan): Promise<ExportResult> | ExportResult;
  cancelExport(): Promise<void> | void;
  getCacheDir(): Promise<string> | string;
  readCache(path: string): Promise<string | null> | string | null;
  writeCache(path: string, contents: string): Promise<void> | void;
  removeCacheFile(path: string): Promise<void> | void;
  clearCache(): Promise<void> | void;
  getCacheSize(): Promise<number> | number;
  openPath(path: string): Promise<void> | void;
  forceCloseWindow(): Promise<void> | void;
  probeMediaPath(path: string): Promise<Partial<import('@open-factory/editor-core').MediaAsset>> | Partial<import('@open-factory/editor-core').MediaAsset>;
  probeMedia(path: string): Promise<MediaProbe> | MediaProbe;
  analyzeWaveform(path: string, samplesPerSec: number): Promise<number[]> | number[];
  detectSilence(path: string, thresholdDb: number, minGapMs: number): Promise<NativeSilenceRange[]> | NativeSilenceRange[];
  generateProxy(plan: ProxyPlan): Promise<ProxyResult> | ProxyResult;
  detectSceneChanges(request: SceneDetectRequest): Promise<SceneDetectionResult> | SceneDetectionResult;
  getPreviewSmokeConfig(): Promise<PreviewSmokeConfig | undefined> | PreviewSmokeConfig | undefined;
  getCancelSmokeConfig(): Promise<CancelSmokeConfig | undefined> | CancelSmokeConfig | undefined;
  listen<T>(event: string, handler: (payload: T) => void): Promise<() => void> | (() => void);
}>;

export function getTauriMocks(): TauriMocks | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }
  return window.__TAURI_MOCKS__;
}

export async function bridgeConfirm(message: string, options?: unknown): Promise<boolean> {
  const mock = getTauriMocks()?.confirm;
  if (mock) {
    return mock(message, options);
  }
  if (isTauriRuntime()) {
    return confirm(message, options as Parameters<typeof confirm>[1]);
  }
  return window.confirm(message);
}

export async function chooseUnsavedCloseAction(): Promise<UnsavedCloseAction> {
  const mock = getTauriMocks()?.chooseUnsavedCloseAction;
  if (mock) {
    return mock();
  }
  if (isTauriRuntime()) {
    const result = await dialogMessage('Save changes before closing?', {
      title: 'Unsaved changes',
      kind: 'warning',
      buttons: { yes: 'Save', no: 'Discard', cancel: 'Cancel' }
    });
    if (result === 'Yes' || result === 'Save') {
      return 'save';
    }
    if (result === 'No' || result === 'Discard') {
      return 'discard';
    }
    return 'cancel';
  }
  const result = window.prompt('Save changes before closing? Type save, discard, or cancel.', 'cancel')?.trim().toLowerCase();
  return result === 'save' || result === 'discard' ? result : 'cancel';
}

export async function openFileDialog(multiple: boolean, filters: FileDialogFilter[]): Promise<string[]> {
  const mock = getTauriMocks()?.openFileDialog;
  if (mock) {
    return mock({ multiple, filters });
  }
  if (!isTauriRuntime()) {
    throw new Error('openFileDialog requires Tauri or a __TAURI_MOCKS__ implementation.');
  }
  return invoke<string[]>('open_file_dialog', { multiple, filters });
}

export function convertLocalFileSrc(path: string): string {
  if (isTauriRuntime()) {
    return convertFileSrc(path);
  }
  return path;
}

export async function saveFileDialog(defaultPath: string | undefined, filters: FileDialogFilter[]): Promise<string | undefined> {
  const mock = getTauriMocks()?.saveFileDialog;
  if (mock) {
    return mock({ defaultPath, filters });
  }
  if (!isTauriRuntime()) {
    throw new Error('saveFileDialog requires Tauri or a __TAURI_MOCKS__ implementation.');
  }
  return invoke<string | undefined>('save_file_dialog', { defaultPath, filters });
}

export async function openDirectoryDialog(): Promise<string | undefined> {
  const mock = getTauriMocks()?.openDirectoryDialog;
  if (mock) {
    return mock();
  }
  if (!isTauriRuntime()) {
    throw new Error('openDirectoryDialog requires Tauri or a __TAURI_MOCKS__ implementation.');
  }
  return invoke<string | undefined>('open_directory_dialog');
}

export async function readFile(path: string): Promise<string> {
  const mock = getTauriMocks()?.readFile;
  if (mock) {
    return mock(path);
  }
  return invoke<string>('read_file', { path });
}

export async function writeFile(path: string, contents: string): Promise<void> {
  const mock = getTauriMocks()?.writeFile;
  if (mock) {
    await mock(path, contents);
    return;
  }
  await invoke('write_file', { path, contents });
}

export async function removeFile(path: string): Promise<void> {
  const mock = getTauriMocks()?.removeFile;
  if (mock) {
    await mock(path);
    return;
  }
  await invoke('remove_file', { path });
}

export async function fsExists(path: string): Promise<boolean> {
  const mock = getTauriMocks()?.fsExists;
  if (mock) {
    return mock(path);
  }
  return invoke<boolean>('fs_exists', { path });
}

export async function getAppDataDir(): Promise<string> {
  const mock = getTauriMocks()?.getAppDataDir;
  if (mock) {
    return mock();
  }
  return invoke<string>('get_app_data_dir');
}

export async function getFileStat(path: string): Promise<FileStat> {
  const mock = getTauriMocks()?.getFileStat;
  if (mock) {
    return mock(path);
  }
  return invoke<FileStat>('get_file_stat', { path });
}

export async function authorizePaths(paths: string[]): Promise<void> {
  const mock = getTauriMocks()?.authorizePaths;
  if (mock) {
    await mock(paths);
    return;
  }
  if (isTauriRuntime()) {
    await invoke('authorize_paths', { paths });
  }
}

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

export async function analyzeWaveform(path: string, samplesPerSec: number): Promise<number[]> {
  const mock = getTauriMocks()?.analyzeWaveform;
  if (mock) {
    return mock(path, samplesPerSec);
  }
  return invoke<number[]>('analyze_waveform', { path, samplesPerSec });
}

export async function detectSilence(path: string, thresholdDb: number, minGapMs: number): Promise<NativeSilenceRange[]> {
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

export async function runExport(plan: FfmpegExportPlan): Promise<ExportResult> {
  const mock = getTauriMocks()?.runExport;
  if (mock) {
    return mock(plan);
  }
  return invoke<ExportResult>('run_export', { plan });
}

export async function cancelExport(): Promise<void> {
  const mock = getTauriMocks()?.cancelExport;
  if (mock) {
    await mock();
    return;
  }
  await invoke('cancel_export');
}

export async function getCacheDir(): Promise<string> {
  const mock = getTauriMocks()?.getCacheDir;
  if (mock) {
    return mock();
  }
  return invoke<string>('get_cache_dir');
}

export async function readCache(path: string): Promise<string | null> {
  const mock = getTauriMocks()?.readCache;
  if (mock) {
    return mock(path);
  }
  return invoke<string | null>('read_cache', { path });
}

export async function writeCache(path: string, contents: string): Promise<void> {
  const mock = getTauriMocks()?.writeCache;
  if (mock) {
    await mock(path, contents);
    return;
  }
  await invoke('write_cache', { path, contents });
}

export async function removeCacheFile(path: string): Promise<void> {
  const mock = getTauriMocks()?.removeCacheFile;
  if (mock) {
    await mock(path);
    return;
  }
  await invoke('remove_cache_file', { path });
}

export async function clearCache(): Promise<void> {
  const mock = getTauriMocks()?.clearCache;
  if (mock) {
    await mock();
    return;
  }
  await invoke('clear_cache');
}

export async function getCacheSize(): Promise<number> {
  const mock = getTauriMocks()?.getCacheSize;
  if (mock) {
    return mock();
  }
  return invoke<number>('get_cache_size');
}

export async function openPath(path: string): Promise<void> {
  const mock = getTauriMocks()?.openPath;
  if (mock) {
    await mock(path);
    return;
  }
  if (isTauriRuntime()) {
    await openShellPath(path);
  }
}

export async function forceCloseWindow(): Promise<void> {
  const mock = getTauriMocks()?.forceCloseWindow;
  if (mock) {
    await mock();
    return;
  }
  if (isTauriRuntime()) {
    await invoke('force_close_window');
  } else {
    window.close();
  }
}

export async function listenBridge<T>(event: string, handler: (payload: T) => void): Promise<() => void> {
  const mock = getTauriMocks()?.listen;
  if (mock) {
    return mock(event, handler);
  }
  if (!isTauriRuntime()) {
    return () => undefined;
  }
  return listen<T>(event, (payload) => handler(payload.payload));
}

export async function listenDragDrop(handler: (event: { type: string; paths?: string[] }) => void): Promise<() => void> {
  if (!isTauriRuntime()) {
    return () => undefined;
  }
  return getCurrentWindow().onDragDropEvent((event) => {
    const payload = event.payload as { type: string; paths?: string[] };
    if (payload.type === 'drop' && payload.paths?.length) {
      void authorizePaths(payload.paths)
        .then(() => handler(payload))
        .catch((error) => {
          console.warn('Dropped paths were not authorized', error);
          handler({ type: payload.type, paths: [] });
        });
      return;
    }
    handler(payload);
  });
}

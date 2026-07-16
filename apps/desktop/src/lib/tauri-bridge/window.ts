import { invoke } from '@tauri-apps/api/core';
import { emit, listen } from '@tauri-apps/api/event';
import { getVersion as getTauriAppVersion } from '@tauri-apps/api/app';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { confirm, message as dialogMessage } from '@tauri-apps/plugin-dialog';
import { relaunch as relaunchProcess } from '@tauri-apps/plugin-process';
import { open as openShellPath } from '@tauri-apps/plugin-shell';
import { check as checkTauriUpdate } from '@tauri-apps/plugin-updater';
import type {
  AppUpdateCheckOptions,
  AvailableAppUpdate,
  BatchTranscodeProgressEvent,
  CollaborationHostRequest,
  CollaborationHostState,
  CoverFrameProgressEvent,
  PreviewWindowRequest,
  PreviewWindowResolutionScale,
  PreviewWindowState,
  RenderPreviewCacheProgressEvent,
} from './types';
import { getTauriMocks } from './mock-types';
import { isTauriRuntime } from '../tauri';
import { zhCN } from '../../i18n/strings';
import desktopPackage from '../../../package.json';

async function authorizePaths(paths: string[]): Promise<void> {
  const mock = getTauriMocks()?.authorizePaths;
  if (mock) {
    await mock(paths);
    return;
  }
  if (isTauriRuntime()) {
    await invoke('authorize_paths', { paths });
  }
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

export async function startCollaborationHost(request: CollaborationHostRequest): Promise<CollaborationHostState> {
  const mock = getTauriMocks()?.startCollaborationHost;
  if (mock) {
    return mock(request);
  }
  if (!isTauriRuntime()) {
    return { active: true, port: request.port };
  }
  return invoke<CollaborationHostState>('start_collaboration_host', { request });
}

export async function stopCollaborationHost(): Promise<void> {
  const mock = getTauriMocks()?.stopCollaborationHost;
  if (mock) {
    await mock();
    return;
  }
  if (isTauriRuntime()) {
    await invoke('stop_collaboration_host');
  }
}

export async function broadcastCollaborationMessage(message: string): Promise<void> {
  const mock = getTauriMocks()?.broadcastCollaborationMessage;
  if (mock) {
    await mock(message);
    return;
  }
  if (isTauriRuntime()) {
    await invoke('broadcast_collaboration_message', { message });
  }
}

export async function openPreviewWindow(request: PreviewWindowRequest): Promise<PreviewWindowState> {
  const mock = getTauriMocks()?.openPreviewWindow;
  if (mock) {
    return mock(request);
  }
  if (!isTauriRuntime()) {
    return {
      open: true,
      label: 'preview',
      bounds: request.bounds,
      alwaysOnTop: request.alwaysOnTop,
      fullscreen: false,
      resolutionScale: request.resolutionScale,
    };
  }
  return invoke<PreviewWindowState>('open_preview_window', { request });
}

export async function closePreviewWindow(): Promise<PreviewWindowState> {
  const mock = getTauriMocks()?.closePreviewWindow;
  if (mock) {
    return mock();
  }
  if (!isTauriRuntime()) {
    return { open: false, label: 'preview', alwaysOnTop: false, fullscreen: false, resolutionScale: 1 };
  }
  return invoke<PreviewWindowState>('close_preview_window');
}

export async function getPreviewWindowState(): Promise<PreviewWindowState> {
  const mock = getTauriMocks()?.getPreviewWindowState;
  if (mock) {
    return mock();
  }
  if (!isTauriRuntime()) {
    return { open: false, label: 'preview', alwaysOnTop: false, fullscreen: false, resolutionScale: 1 };
  }
  return invoke<PreviewWindowState>('get_preview_window_state');
}

export async function setPreviewWindowAlwaysOnTop(alwaysOnTop: boolean): Promise<PreviewWindowState> {
  const mock = getTauriMocks()?.setPreviewWindowAlwaysOnTop;
  if (mock) {
    return mock(alwaysOnTop);
  }
  if (!isTauriRuntime()) {
    return { open: true, label: 'preview', alwaysOnTop, fullscreen: false, resolutionScale: 1 };
  }
  return invoke<PreviewWindowState>('set_preview_window_always_on_top', { alwaysOnTop });
}

export async function setPreviewWindowFullscreen(fullscreen: boolean): Promise<PreviewWindowState> {
  const mock = getTauriMocks()?.setPreviewWindowFullscreen;
  if (mock) {
    return mock(fullscreen);
  }
  if (!isTauriRuntime()) {
    return { open: true, label: 'preview', alwaysOnTop: false, fullscreen, resolutionScale: 1 };
  }
  return invoke<PreviewWindowState>('set_preview_window_fullscreen', { fullscreen });
}

export async function setPreviewWindowResolutionScale(
  resolutionScale: PreviewWindowResolutionScale,
): Promise<PreviewWindowState> {
  const mock = getTauriMocks()?.setPreviewWindowResolutionScale;
  if (mock) {
    return mock(resolutionScale);
  }
  if (!isTauriRuntime()) {
    return { open: true, label: 'preview', alwaysOnTop: false, fullscreen: false, resolutionScale };
  }
  return invoke<PreviewWindowState>('set_preview_window_resolution_scale', { resolutionScale });
}

export async function minimizeToTray(): Promise<void> {
  const mock = getTauriMocks()?.minimizeToTray;
  const labels = zhCN.exportDialog.trayMenu;
  if (mock) {
    await mock(labels);
    return;
  }
  if (isTauriRuntime()) {
    await invoke('minimize_to_tray', { labels });
  }
}

export async function showMainWindow(): Promise<void> {
  const mock = getTauriMocks()?.showMainWindow;
  if (mock) {
    await mock();
    return;
  }
  if (isTauriRuntime()) {
    await invoke('show_main_window');
  }
}

export async function updateExportTrayProgress(progress: number, runningCount: number): Promise<void> {
  const mock = getTauriMocks()?.updateExportTrayProgress;
  if (mock) {
    await mock(progress, runningCount);
    return;
  }
  if (isTauriRuntime()) {
    await invoke('update_export_tray_progress', { progress, runningCount });
  }
}

export async function runExportPowerAction(
  action: 'shutdown' | 'hibernate',
  allowPowerActions: boolean,
): Promise<void> {
  const mock = getTauriMocks()?.runExportPowerAction;
  if (mock) {
    await mock(action, allowPowerActions);
    return;
  }
  if (isTauriRuntime()) {
    await invoke('run_export_power_action', { action, allowPowerActions });
  }
}

export async function checkAppUpdate(options?: AppUpdateCheckOptions): Promise<AvailableAppUpdate | null> {
  const mock = getTauriMocks()?.checkAppUpdate;
  if (mock) {
    return mock(options);
  }
  if (!isTauriRuntime()) {
    return null;
  }
  const update = await checkTauriUpdate(options);
  if (!update) {
    return null;
  }
  return {
    currentVersion: update.currentVersion,
    version: update.version,
    date: update.date,
    body: update.body,
    rawJson: update.rawJson,
    downloadAndInstall: (onEvent) => update.downloadAndInstall(onEvent),
    close: () => update.close(),
  };
}

export async function getAppVersion(): Promise<string> {
  const mock = getTauriMocks()?.getAppVersion;
  if (mock) {
    return mock();
  }
  if (!isTauriRuntime()) {
    return desktopPackage.version;
  }
  return getTauriAppVersion().catch(() => desktopPackage.version);
}

export async function relaunchApp(): Promise<void> {
  const mock = getTauriMocks()?.relaunchApp;
  if (mock) {
    await mock();
    return;
  }
  if (isTauriRuntime()) {
    await relaunchProcess();
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

export async function emitBridge<T>(event: string, payload: T): Promise<void> {
  const mock = getTauriMocks()?.emit;
  if (mock) {
    await mock(event, payload);
    return;
  }
  if (isTauriRuntime()) {
    await emit(event, payload);
  }
}

export async function listenCollaborationMessage(handler: (message: string) => void): Promise<() => void> {
  return listenBridge<string>('collaboration-message', handler);
}

export async function listenBatchTranscodeProgress(
  handler: (payload: BatchTranscodeProgressEvent) => void,
): Promise<() => void> {
  return listenBridge<BatchTranscodeProgressEvent>('batch-transcode-progress', handler);
}

export async function listenCoverFrameProgress(
  handler: (payload: CoverFrameProgressEvent) => void,
): Promise<() => void> {
  return listenBridge<CoverFrameProgressEvent>('cover-frame-progress', handler);
}

export async function listenRenderPreviewCacheProgress(
  handler: (payload: RenderPreviewCacheProgressEvent) => void,
): Promise<() => void> {
  return listenBridge<RenderPreviewCacheProgressEvent>('render-preview-cache-progress', handler);
}

export async function listenDragDrop(
  handler: (event: { type: string; paths?: string[] }) => void,
): Promise<() => void> {
  if (!isTauriRuntime()) {
    return () => undefined;
  }
  return getCurrentWindow().onDragDropEvent((event) => {
    const payload = event.payload as { type: string; paths?: string[] };
    if (payload.type === 'drop' && payload.paths?.length) {
      void authorizePaths(payload.paths)
        .then(() => handler(payload))
        .catch((error) => {
          console.warn(zhCN.errors.droppedPathsNotAuthorized, error);
          handler({ type: payload.type, paths: [] });
        });
      return;
    }
    handler(payload);
  });
}

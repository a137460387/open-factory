import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { confirm, message as dialogMessage } from '@tauri-apps/plugin-dialog';
import type { ColorMatchFrameSample } from '@open-factory/editor-core';
import type { FileDialogFilter, FileStat, SpatialAudioAssets, UnsavedCloseAction } from './types';
import { getTauriMocks } from './mock-types';
import { isTauriRuntime } from '../tauri';
import { zhCN } from '../../i18n/strings';

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
    const result = await dialogMessage(zhCN.closeGuard.message, {
      title: zhCN.closeGuard.title,
      kind: 'warning',
      buttons: { yes: zhCN.closeGuard.save, no: zhCN.closeGuard.discard, cancel: zhCN.closeGuard.cancel },
    });
    if (result === 'Yes' || result === 'Save' || result === zhCN.closeGuard.save) {
      return 'save';
    }
    if (result === 'No' || result === 'Discard' || result === zhCN.closeGuard.discard) {
      return 'discard';
    }
    return 'cancel';
  }
  const result = window.prompt(zhCN.closeGuard.browserPrompt, 'cancel')?.trim().toLowerCase();
  return result === 'save' || result === 'discard' ? result : 'cancel';
}

export async function openFileDialog(multiple: boolean, filters: FileDialogFilter[]): Promise<string[]> {
  const mock = getTauriMocks()?.openFileDialog;
  if (mock) {
    return mock({ multiple, filters });
  }
  if (!isTauriRuntime()) {
    throw new Error('openFileDialog 需要 Tauri 或 __TAURI_MOCKS__ 实现。');
  }
  return invoke<string[]>('open_file_dialog', { multiple, filters });
}

export function convertLocalFileSrc(path: string): string {
  if (isTauriRuntime()) {
    return convertFileSrc(path);
  }
  return path;
}

export async function saveFileDialog(
  defaultPath: string | undefined,
  filters: FileDialogFilter[],
): Promise<string | undefined> {
  const mock = getTauriMocks()?.saveFileDialog;
  if (mock) {
    return mock({ defaultPath, filters });
  }
  if (!isTauriRuntime()) {
    throw new Error('saveFileDialog 需要 Tauri 或 __TAURI_MOCKS__ 实现。');
  }
  return invoke<string | undefined>('save_file_dialog', { defaultPath, filters });
}

export async function openDirectoryDialog(): Promise<string | undefined> {
  const mock = getTauriMocks()?.openDirectoryDialog;
  if (mock) {
    return mock();
  }
  if (!isTauriRuntime()) {
    throw new Error('openDirectoryDialog 需要 Tauri 或 __TAURI_MOCKS__ 实现。');
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

export async function readFileHeaderBytes(path: string, byteCount = 16): Promise<Uint8Array> {
  const mock = getTauriMocks()?.readFileHeaderBytes;
  if (mock) {
    return mock(path, byteCount);
  }
  const result = await invoke<number[]>('read_file_header_bytes', { path, byteCount });
  return new Uint8Array(result);
}

export async function writeFile(path: string, contents: string): Promise<void> {
  const mock = getTauriMocks()?.writeFile;
  if (mock) {
    await mock(path, contents);
    return;
  }
  await invoke('write_file', { path, contents });
}

export async function writeBinaryFile(path: string, base64Data: string): Promise<void> {
  const mock = getTauriMocks()?.writeBinaryFile;
  if (mock) {
    await mock(path, base64Data);
    return;
  }
  await invoke('write_binary_file', { path, base64Data });
}

export async function encryptProjectFile(path: string, contents: string, password: string): Promise<void> {
  const mock = getTauriMocks()?.encryptProjectFile;
  if (mock) {
    await mock(path, contents, password);
    return;
  }
  await invoke('encrypt_project_file', { path, contents, password });
}

export async function decryptProjectFile(path: string, password: string): Promise<string> {
  const mock = getTauriMocks()?.decryptProjectFile;
  if (mock) {
    return mock(path, password);
  }
  return invoke<string>('decrypt_project_file', { path, password });
}

export async function isEncryptedProjectFile(path: string): Promise<boolean> {
  const mock = getTauriMocks()?.isEncryptedProjectFile;
  if (mock) {
    return mock(path);
  }
  return invoke<boolean>('is_encrypted_project_file', { path });
}

export async function writeClipReport(path: string, html: string): Promise<void> {
  const mock = getTauriMocks()?.writeClipReport;
  if (mock) {
    await mock(path, html);
    return;
  }
  await invoke('write_clip_report', { path, html });
}

export async function removeFile(path: string): Promise<void> {
  const mock = getTauriMocks()?.removeFile;
  if (mock) {
    await mock(path);
    return;
  }
  await invoke('remove_file', { path });
}

export async function trashFile(path: string): Promise<void> {
  const mock = getTauriMocks()?.trashFile;
  if (mock) {
    await mock(path);
    return;
  }
  await invoke('trash_file', { path });
}

export async function copyFile(sourcePath: string, destinationPath: string): Promise<void> {
  const mock = getTauriMocks()?.copyFile;
  if (mock) {
    await mock(sourcePath, destinationPath);
    return;
  }
  await invoke('copy_file', { sourcePath, destinationPath });
}

export async function moveFile(sourcePath: string, destinationPath: string): Promise<void> {
  const mock = getTauriMocks()?.moveFile;
  if (mock) {
    await mock(sourcePath, destinationPath);
    return;
  }
  await invoke('move_file', { sourcePath, destinationPath });
}

export async function sendNotification(title: string, body: string): Promise<void> {
  const mock = getTauriMocks()?.sendNotification;
  if (mock) {
    await mock(title, body);
    return;
  }
  if (isTauriRuntime()) {
    await invoke('send_notification', { title, body });
    return;
  }
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'granted') {
      new Notification(title, { body });
    } else if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        new Notification(title, { body });
      }
    }
  }
}

export async function fsExists(path: string): Promise<boolean> {
  const mock = getTauriMocks()?.fsExists;
  if (mock) {
    return mock(path);
  }
  return invoke<boolean>('fs_exists', { path });
}

export async function ensureSpatialAudioAssets(): Promise<SpatialAudioAssets> {
  const mock = getTauriMocks()?.ensureSpatialAudioAssets;
  if (mock) {
    return mock();
  }
  return invoke<SpatialAudioAssets>('ensure_spatial_audio_assets');
}

export async function getAppDataDir(): Promise<string> {
  const mock = getTauriMocks()?.getAppDataDir;
  if (mock) {
    return mock();
  }
  return invoke<string>('get_app_data_dir');
}

export async function getTempSegmentsDir(): Promise<string> {
  const mock = getTauriMocks()?.getTempSegmentsDir;
  if (mock) {
    return mock();
  }
  return invoke<string>('get_temp_segments_dir');
}

export async function getFileStat(path: string): Promise<FileStat> {
  const mock = getTauriMocks()?.getFileStat;
  if (mock) {
    return mock(path);
  }
  return invoke<FileStat>('get_file_stat', { path });
}

export async function readColorMatchFrameSample(path: string): Promise<ColorMatchFrameSample | undefined> {
  const mock = getTauriMocks()?.readColorMatchFrameSample;
  return mock ? mock(path) : undefined;
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

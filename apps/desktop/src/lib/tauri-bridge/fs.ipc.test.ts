// @vitest-environment jsdom
// 源文件：apps/desktop/src/lib/tauri-bridge/fs.ts（239 可执行行，五期前覆盖 28.87%）
// 覆盖目标：≥75%。模式：mockIPC 真实拦截 invoke（不 mock isTauriRuntime / @tauri-apps/api/core），
// 三分支覆盖：__TAURI_MOCKS__ mock 路径 / Tauri invoke 路径（断言 command 名与参数）/ 浏览器回退路径。

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockIPC, mockConvertFileSrc, clearMocks } from '@tauri-apps/api/mocks';

import {
  bridgeConfirm,
  chooseUnsavedCloseAction,
  openFileDialog,
  convertLocalFileSrc,
  saveFileDialog,
  openDirectoryDialog,
  readFile,
  readFileHeaderBytes,
  writeFile,
  writeBinaryFile,
  encryptProjectFile,
  decryptProjectFile,
  isEncryptedProjectFile,
  writeClipReport,
  removeFile,
  trashFile,
  copyFile,
  moveFile,
  sendNotification,
  fsExists,
  ensureSpatialAudioAssets,
  getAppDataDir,
  getTempSegmentsDir,
  getFileStat,
  readColorMatchFrameSample,
  authorizePaths,
} from './fs';

type WindowWithTauri = Window & {
  __TAURI_INTERNALS__?: Record<string, unknown>;
  __TAURI_MOCKS__?: Record<string, unknown>;
};

/** 进入纯浏览器环境（无 Tauri internals、无 mocks）。 */
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

describe('fs bridge：__TAURI_MOCKS__ 注入路径', () => {
  it('mock 存在时完全短路 invoke（readFile/writeFile/fsExists）', async () => {
    (window as WindowWithTauri).__TAURI_MOCKS__ = {
      readFile: vi.fn(async () => 'mocked-content'),
      writeFile: vi.fn(async () => undefined),
      fsExists: vi.fn(async () => true),
    };
    expect(await readFile('/a.txt')).toBe('mocked-content');
    await writeFile('/a.txt', 'x');
    expect(await fsExists('/a.txt')).toBe(true);
  });

  it('readColorMatchFrameSample 无 mock 时恒 undefined，有 mock 时委托', async () => {
    expect(await readColorMatchFrameSample('/frame.png')).toBeUndefined();
    const sample = { time: 1, colors: [1, 2, 3], data: new Uint8Array([1, 2, 3]), width: 2, height: 2 };
    (window as WindowWithTauri).__TAURI_MOCKS__ = {
      readColorMatchFrameSample: vi.fn(async () => sample),
    };
    await expect(readColorMatchFrameSample('/frame.png')).resolves.toBe(sample);
  });

  it('bridgeConfirm 委托 mock 并透传 options', async () => {
    const confirm = vi.fn(async () => false);
    (window as WindowWithTauri).__TAURI_MOCKS__ = { confirm };
    await expect(bridgeConfirm('确定？', { kind: 'warning' })).resolves.toBe(false);
    expect(confirm).toHaveBeenCalledWith('确定？', { kind: 'warning' });
  });
});

describe('fs bridge：Tauri invoke 路径（mockIPC 拦截）', () => {
  it('readFile 调 read_file 命令并携带 path', async () => {
    const handler = vi.fn(async (cmd: string) => {
      if (cmd === 'read_file') return 'file-body';
    });
    mockIPC(handler);
    await expect(readFile('/media/a.mp4')).resolves.toBe('file-body');
    expect(handler).toHaveBeenCalledWith('read_file', { path: '/media/a.mp4' });
  });

  it('readFileHeaderBytes 将 number[] 解包为 Uint8Array', async () => {
    mockIPC(async (cmd: string) => (cmd === 'read_file_header_bytes' ? [1, 2, 3, 255] : undefined));
    const bytes = await readFileHeaderBytes('/bin.dat', 4);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(Array.from(bytes)).toEqual([1, 2, 3, 255]);
  });

  it('writeFile / writeBinaryFile / encryptProjectFile 透传参数到对应命令', async () => {
    const handler = vi.fn(async () => undefined);
    mockIPC(handler);
    await writeFile('/a.txt', 'body');
    await writeBinaryFile('/b.bin', 'base64==');
    await encryptProjectFile('/p.ofproj', '{}', 'pw');
    expect(handler).toHaveBeenNthCalledWith(1, 'write_file', { path: '/a.txt', contents: 'body' });
    expect(handler).toHaveBeenNthCalledWith(2, 'write_binary_file', { path: '/b.bin', base64Data: 'base64==' });
    expect(handler).toHaveBeenNthCalledWith(3, 'encrypt_project_file', {
      path: '/p.ofproj',
      contents: '{}',
      password: 'pw',
    });
  });

  it('decryptProjectFile / isEncryptedProjectFile 返回后端结果', async () => {
    mockIPC(async (cmd: string) =>
      cmd === 'decrypt_project_file' ? '{"a":1}' : cmd === 'is_encrypted_project_file' ? true : undefined,
    );
    await expect(decryptProjectFile('/p.ofproj', 'pw')).resolves.toBe('{"a":1}');
    await expect(isEncryptedProjectFile('/p.ofproj')).resolves.toBe(true);
  });

  it('对话框命令：open/save/directory dialog 透传 filters 与 defaultPath', async () => {
    const handler = vi.fn(async (cmd: string) => {
      if (cmd === 'open_file_dialog') return ['/picked/a.mp4'];
      if (cmd === 'save_file_dialog') return '/picked/out.mp4';
      if (cmd === 'open_directory_dialog') return '/picked/dir';
      return undefined;
    });
    mockIPC(handler);
    const filters = [{ name: 'Video', extensions: ['mp4'] }];
    await expect(openFileDialog(false, filters)).resolves.toEqual(['/picked/a.mp4']);
    await expect(saveFileDialog('/default.mp4', filters)).resolves.toBe('/picked/out.mp4');
    await expect(openDirectoryDialog()).resolves.toBe('/picked/dir');
    expect(handler).toHaveBeenCalledWith('open_file_dialog', { multiple: false, filters });
    expect(handler).toHaveBeenCalledWith('save_file_dialog', { defaultPath: '/default.mp4', filters });
  });

  it('文件管理命令：remove/trash/copy/move/clipReport 透传参数', async () => {
    const handler = vi.fn(async () => undefined);
    mockIPC(handler);
    await removeFile('/a');
    await trashFile('/a');
    await copyFile('/a', '/b');
    await moveFile('/a', '/b');
    await writeClipReport('/report.html', '<html/>');
    expect(handler).toHaveBeenNthCalledWith(1, 'remove_file', { path: '/a' });
    expect(handler).toHaveBeenNthCalledWith(2, 'trash_file', { path: '/a' });
    expect(handler).toHaveBeenNthCalledWith(3, 'copy_file', { sourcePath: '/a', destinationPath: '/b' });
    expect(handler).toHaveBeenNthCalledWith(4, 'move_file', { sourcePath: '/a', destinationPath: '/b' });
    expect(handler).toHaveBeenNthCalledWith(5, 'write_clip_report', { path: '/report.html', html: '<html/>' });
  });

  it('目录与元信息命令：appDataDir / tempSegments / fileStat / fsExists / spatialAssets / authorizePaths', async () => {
    const handler = vi.fn(async (cmd: string) => {
      switch (cmd) {
        case 'get_app_data_dir':
          return 'C:/AppData';
        case 'get_temp_segments_dir':
          return 'C:/Temp/segments';
        case 'get_file_stat':
          return { path: '/a.mp4', size: 100, mtimeMs: 42 };
        case 'fs_exists':
          return false;
        case 'ensure_spatial_audio_assets':
          return { irPath: 'C:/irs' };
        case 'authorize_paths':
          return undefined;
        default:
          return undefined;
      }
    });
    mockIPC(handler);
    await expect(getAppDataDir()).resolves.toBe('C:/AppData');
    await expect(getTempSegmentsDir()).resolves.toBe('C:/Temp/segments');
    await expect(getFileStat('/a.mp4')).resolves.toEqual({ path: '/a.mp4', size: 100, mtimeMs: 42 });
    await expect(fsExists('/a.mp4')).resolves.toBe(false);
    await expect(ensureSpatialAudioAssets()).resolves.toEqual({ irPath: 'C:/irs' });
    await expect(authorizePaths(['/a', '/b'])).resolves.toBeUndefined();
    expect(handler).toHaveBeenCalledWith('authorize_paths', { paths: ['/a', '/b'] });
  });

  it('sendNotification 在 Tauri 下走 send_notification 命令', async () => {
    const handler = vi.fn(async () => undefined);
    mockIPC(handler);
    await sendNotification('标题', '正文');
    expect(handler).toHaveBeenCalledWith('send_notification', { title: '标题', body: '正文' });
  });

  it('invoke 抛错时错误向上传播', async () => {
    mockIPC(async () => {
      throw new Error('backend failure');
    });
    await expect(readFile('/a.txt')).rejects.toThrow('backend failure');
  });

  it('convertLocalFileSrc 在 Tauri 下经 convertFileSrc 转换（Windows 协议）', () => {
    mockConvertFileSrc('windows');
    expect(convertLocalFileSrc('C:/media/a.mp4')).toBe(
      `http://asset.localhost/${encodeURIComponent('C:/media/a.mp4')}`,
    );
  });
});

describe('fs bridge：浏览器回退路径（无 Tauri runtime）', () => {
  it('需要后端的对话框命令在浏览器抛错', async () => {
    await expect(openFileDialog(false, [])).rejects.toThrow('openFileDialog');
    await expect(saveFileDialog(undefined, [])).rejects.toThrow('saveFileDialog');
    await expect(openDirectoryDialog()).rejects.toThrow('openDirectoryDialog');
  });

  it('bridgeConfirm 回退 window.confirm', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    await expect(bridgeConfirm('确定？')).resolves.toBe(true);
    expect(confirmSpy).toHaveBeenCalledWith('确定？');
    confirmSpy.mockRestore();
  });

  it('chooseUnsavedCloseAction 浏览器 prompt：save/discard/cancel 三分支', async () => {
    const promptSpy = vi.spyOn(window, 'prompt');
    promptSpy.mockReturnValueOnce('save');
    await expect(chooseUnsavedCloseAction()).resolves.toBe('save');
    promptSpy.mockReturnValueOnce('  DISCARD  ');
    await expect(chooseUnsavedCloseAction()).resolves.toBe('discard');
    promptSpy.mockReturnValueOnce('whatever');
    await expect(chooseUnsavedCloseAction()).resolves.toBe('cancel');
    promptSpy.mockRestore();
  });

  it('convertLocalFileSrc 浏览器下原样返回路径', () => {
    expect(convertLocalFileSrc('/media/a.mp4')).toBe('/media/a.mp4');
  });

  it('sendNotification 浏览器下走 Notification API（已授权分支）', async () => {
    const notificationCtor = vi.fn();
    (window as unknown as { Notification: unknown }).Notification = Object.assign(notificationCtor, {
      permission: 'granted',
      requestPermission: vi.fn(),
    });
    try {
      await sendNotification('标题', '正文');
      expect(notificationCtor).toHaveBeenCalledWith('标题', { body: '正文' });
    } finally {
      delete (window as unknown as { Notification?: unknown }).Notification;
    }
  });

  it('sendNotification 浏览器未授权时请求权限，拒绝则不弹通知', async () => {
    const notificationCtor = vi.fn();
    const requestPermission = vi.fn(async () => 'denied' as NotificationPermission);
    (window as unknown as { Notification: unknown }).Notification = Object.assign(notificationCtor, {
      permission: 'default',
      requestPermission,
    });
    try {
      await sendNotification('标题', '正文');
      expect(requestPermission).toHaveBeenCalled();
      expect(notificationCtor).not.toHaveBeenCalled();
    } finally {
      delete (window as unknown as { Notification?: unknown }).Notification;
    }
  });

  it('authorizePaths 浏览器下为 no-op 不抛错', async () => {
    await expect(authorizePaths(['/a'])).resolves.toBeUndefined();
  });
});

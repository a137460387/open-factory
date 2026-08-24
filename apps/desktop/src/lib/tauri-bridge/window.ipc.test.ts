// @vitest-environment jsdom
// 源文件：apps/desktop/src/lib/tauri-bridge/window.ts（287 可执行行，五期前覆盖 35.19%）
// 覆盖目标：≥75%。模式：mockIPC 拦截 invoke（含 plugin:app|version / plugin:event|listen 等
// 插件命令）断言参数与返回；辅以 __TAURI_MOCKS__ 路径与浏览器回退分支。

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockIPC, mockWindows, clearMocks } from '@tauri-apps/api/mocks';
import { emit } from '@tauri-apps/api/event';
import desktopPackage from '../../../package.json';

import {
  openPath,
  forceCloseWindow,
  startCollaborationHost,
  stopCollaborationHost,
  broadcastCollaborationMessage,
  openPreviewWindow,
  closePreviewWindow,
  getPreviewWindowState,
  setPreviewWindowAlwaysOnTop,
  setPreviewWindowFullscreen,
  setPreviewWindowResolutionScale,
  minimizeToTray,
  showMainWindow,
  updateExportTrayProgress,
  runExportPowerAction,
  checkAppUpdate,
  getAppVersion,
  relaunchApp,
  listenBridge,
  emitBridge,
  listenCollaborationMessage,
  listenBatchTranscodeProgress,
  listenCoverFrameProgress,
  listenRenderPreviewCacheProgress,
  listenDragDrop,
} from './window';

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
  { name: 'startCollaborationHost', run: () => startCollaborationHost({ port: 8080 } as never), cmd: 'start_collaboration_host', args: { request: { port: 8080 } } },
  { name: 'stopCollaborationHost', run: () => stopCollaborationHost(), cmd: 'stop_collaboration_host', args: {} },
  { name: 'broadcastCollaborationMessage', run: () => broadcastCollaborationMessage('hello'), cmd: 'broadcast_collaboration_message', args: { message: 'hello' } },
  { name: 'openPreviewWindow', run: () => openPreviewWindow({ bounds: { width: 960 } } as never), cmd: 'open_preview_window', args: { request: { bounds: { width: 960 } } } },
  { name: 'closePreviewWindow', run: () => closePreviewWindow(), cmd: 'close_preview_window', args: {} },
  { name: 'getPreviewWindowState', run: () => getPreviewWindowState(), cmd: 'get_preview_window_state', args: {} },
  { name: 'setPreviewWindowAlwaysOnTop', run: () => setPreviewWindowAlwaysOnTop(true), cmd: 'set_preview_window_always_on_top', args: { alwaysOnTop: true } },
  { name: 'setPreviewWindowFullscreen', run: () => setPreviewWindowFullscreen(false), cmd: 'set_preview_window_fullscreen', args: { fullscreen: false } },
  { name: 'setPreviewWindowResolutionScale', run: () => setPreviewWindowResolutionScale(0.5), cmd: 'set_preview_window_resolution_scale', args: { resolutionScale: 0.5 } },
  { name: 'minimizeToTray', run: () => minimizeToTray(), cmd: 'minimize_to_tray', args: { labels: expect.any(Object) } },
  { name: 'showMainWindow', run: () => showMainWindow(), cmd: 'show_main_window', args: {} },
  { name: 'updateExportTrayProgress', run: () => updateExportTrayProgress(0.5, 2), cmd: 'update_export_tray_progress', args: { progress: 0.5, runningCount: 2 } },
  { name: 'runExportPowerAction', run: () => runExportPowerAction('shutdown', true), cmd: 'run_export_power_action', args: { action: 'shutdown', allowPowerActions: true } },
];

describe('window bridge：Tauri invoke 路径（数据驱动）', () => {
  it.each(invokeCases)('$name → $cmd', async ({ run, cmd, args }) => {
    const handler = vi.fn(async () => 'ok');
    mockIPC(handler);
    await run();
    const expected = Object.fromEntries(Object.entries(args).map(([k, v]) => [k, v === expect.any(Object) ? expect.any(Object) : v]));
    expect(handler).toHaveBeenCalledWith(cmd, expected);
  });

  it('openPath 走 shell 插件命令', async () => {
    const handler = vi.fn(async () => undefined);
    mockIPC(handler);
    await openPath('C:/Exports');
    expect(handler).toHaveBeenCalledWith('plugin:shell|open', { path: 'C:/Exports', with: undefined });
  });

  it('forceCloseWindow 走 force_close_window 命令（invoke 默认空参数）', async () => {
    const handler = vi.fn(async () => undefined);
    mockIPC(handler);
    await forceCloseWindow();
    expect(handler).toHaveBeenCalledWith('force_close_window', {});
  });

  it('getAppVersion 走 app 插件命令并返回后端版本', async () => {
    mockIPC(async (cmd: string) => (cmd === 'plugin:app|version' ? '9.9.9' : undefined));
    await expect(getAppVersion()).resolves.toBe('9.9.9');
  });

  it('getAppVersion 后端失败时回退 package.json 版本', async () => {
    mockIPC(async () => {
      throw new Error('version unavailable');
    });
    await expect(getAppVersion()).resolves.toBe(desktopPackage.version);
  });

  it('relaunchApp 走 process 插件 restart 命令（invoke 默认空参数）', async () => {
    const handler = vi.fn(async () => undefined);
    mockIPC(handler);
    await relaunchApp();
    expect(handler).toHaveBeenCalledWith('plugin:process|restart', {});
  });

  it('checkAppUpdate 无更新时返回 null', async () => {
    mockIPC(async (cmd: string) => (cmd === 'plugin:updater|check' ? null : undefined));
    await expect(checkAppUpdate()).resolves.toBeNull();
  });

  it('checkAppUpdate 有更新时透传版本字段与操作方法', async () => {
    mockIPC(async (cmd: string) => {
      if (cmd === 'plugin:updater|check') {
        return { version: '1.2.3', date: '', body: 'notes', currentVersion: desktopPackage.version };
      }
      return undefined;
    });
    const update = await checkAppUpdate();
    expect(update).toMatchObject({ version: '1.2.3', body: 'notes' });
    expect(typeof update!.downloadAndInstall).toBe('function');
    expect(typeof update!.close).toBe('function');
  });

  it('emitBridge 走 event 插件命令并携带事件名', async () => {
    const handler = vi.fn(async () => undefined);
    mockIPC(handler);
    await emitBridge('custom-event', { foo: 1 });
    expect(handler).toHaveBeenCalledWith('plugin:event|emit', expect.objectContaining({ event: 'custom-event' }));
  });

  it('listenBridge 注册监听并返回可解除的 unlisten', async () => {
    const handler = vi.fn(async () => 42);
    mockIPC(handler);
    const unlisten = await listenBridge<string>('my-event', vi.fn());
    expect(handler).toHaveBeenCalledWith('plugin:event|listen', expect.objectContaining({ event: 'my-event' }));
    unlisten();
    expect(handler).toHaveBeenCalledWith('plugin:event|unlisten', expect.objectContaining({ event: 'my-event' }));
  });

  it('listenXxx 封装转发对应事件名', async () => {
    const handler = vi.fn(async (_cmd: string, _args?: unknown) => 1);
    mockIPC(handler);
    const noop = vi.fn();
    await listenCollaborationMessage(noop);
    await listenBatchTranscodeProgress(noop);
    await listenCoverFrameProgress(noop);
    await listenRenderPreviewCacheProgress(noop);
    const events = handler.mock.calls.map((call) => (call[1] as { event: string }).event);
    expect(events).toEqual([
      'collaboration-message',
      'batch-transcode-progress',
      'cover-frame-progress',
      'render-preview-cache-progress',
    ]);
  });

  it('invoke 抛错时错误向上传播（stopCollaborationHost）', async () => {
    mockIPC(async () => {
      throw new Error('ipc dead');
    });
    await expect(stopCollaborationHost()).rejects.toThrow('ipc dead');
  });

  it('listenDragDrop：drop 事件授权路径后转发 handler', async () => {
    mockWindows('main');
    const handler = vi.fn(async (cmd: string) => {
      if (cmd === 'plugin:event|listen') return 1;
      if (cmd === 'authorize_paths') return undefined;
      return undefined;
    });
    mockIPC(handler, { shouldMockEvents: true });
    const dropHandler = vi.fn();
    await listenDragDrop(dropHandler);
    // onDragDropEvent 需要 position（PhysicalPosition 反序列化结构）
    await emit('tauri://drag-drop', {
      type: 'drop',
      paths: ['C:/media/a.mp4'],
      position: { Physical: { x: 1, y: 2 } },
    });
    // 授权成功后 handler 收到原始 payload（含包装后的 position）
    await vi.waitFor(() =>
      expect(dropHandler).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'drop', paths: ['C:/media/a.mp4'] }),
      ),
    );
    // 非 drop 事件（over 走 drag-over 事件名）直接转发
    await emit('tauri://drag-over', { type: 'over', position: { Physical: { x: 1, y: 2 } } });
    await vi.waitFor(() => expect(dropHandler).toHaveBeenCalledWith(expect.objectContaining({ type: 'over' })));
  });

  it('listenDragDrop：授权失败时以空路径回调', async () => {
    mockWindows('main');
    const handler = vi.fn(async (cmd: string) => {
      if (cmd === 'plugin:event|listen') return 1;
      if (cmd === 'authorize_paths') throw new Error('denied');
      return undefined;
    });
    mockIPC(handler, { shouldMockEvents: true });
    const dropHandler = vi.fn();
    await listenDragDrop(dropHandler);
    await emit('tauri://drag-drop', {
      type: 'drop',
      paths: ['C:/secret/x.mp4'],
      position: { Physical: { x: 0, y: 0 } },
    });
    await vi.waitFor(() => expect(dropHandler).toHaveBeenCalledWith(expect.objectContaining({ type: 'drop', paths: [] })));
  });
});

describe('window bridge：__TAURI_MOCKS__ 路径', () => {
  it('mock 存在时短路 invoke 并透传参数', async () => {
    const previewState = { open: true, label: 'preview', alwaysOnTop: false, fullscreen: false, resolutionScale: 1 as const };
    const openPreviewWindowMock = vi.fn(async () => previewState);
    const getAppVersionMock = vi.fn(async () => '0.0.0-mock');
    const emitMock = vi.fn(async () => undefined);
    (window as WindowWithTauri).__TAURI_MOCKS__ = {
      openPreviewWindow: openPreviewWindowMock,
      getAppVersion: getAppVersionMock,
      emit: emitMock,
    };
    await expect(openPreviewWindow({} as never)).resolves.toBe(previewState);
    await expect(getAppVersion()).resolves.toBe('0.0.0-mock');
    await emitBridge('e', 1);
    expect(emitMock).toHaveBeenCalledWith('e', 1);
  });

  it('listenBridge mock 返回自定义 unlisten', async () => {
    const unlisten = vi.fn();
    (window as WindowWithTauri).__TAURI_MOCKS__ = { listen: vi.fn(() => unlisten) };
    const result = await listenBridge('e', vi.fn());
    result();
    expect(unlisten).toHaveBeenCalled();
  });
});

describe('window bridge：浏览器回退路径', () => {
  it('preview window 系列返回本地默认状态（open/close/alwaysOnTop/fullscreen/scale）', async () => {
    await expect(openPreviewWindow({ bounds: { width: 960 }, alwaysOnTop: true, resolutionScale: 2 } as never)).resolves.toEqual({
      open: true,
      label: 'preview',
      bounds: { width: 960 },
      alwaysOnTop: true,
      fullscreen: false,
      resolutionScale: 2,
    });
    await expect(closePreviewWindow()).resolves.toMatchObject({ open: false, label: 'preview' });
    await expect(getPreviewWindowState()).resolves.toMatchObject({ open: false });
    await expect(setPreviewWindowAlwaysOnTop(true)).resolves.toMatchObject({ alwaysOnTop: true });
    await expect(setPreviewWindowFullscreen(true)).resolves.toMatchObject({ fullscreen: true });
    await expect(setPreviewWindowResolutionScale(0.5)).resolves.toMatchObject({ resolutionScale: 0.5 });
  });

  it('startCollaborationHost 浏览器返回本地激活状态', async () => {
    await expect(startCollaborationHost({ port: 9000 } as never)).resolves.toEqual({ active: true, port: 9000 });
  });

  it('forceCloseWindow 浏览器调用 window.close', async () => {
    const closeSpy = vi.spyOn(window, 'close').mockImplementation(() => undefined);
    await forceCloseWindow();
    expect(closeSpy).toHaveBeenCalled();
    closeSpy.mockRestore();
  });

  it('no-op 语义：openPath / stopCollaborationHost / broadcast / tray / powerAction / relaunch / emitBridge', async () => {
    await expect(openPath('C:/x')).resolves.toBeUndefined();
    await expect(stopCollaborationHost()).resolves.toBeUndefined();
    await expect(broadcastCollaborationMessage('m')).resolves.toBeUndefined();
    await expect(minimizeToTray()).resolves.toBeUndefined();
    await expect(showMainWindow()).resolves.toBeUndefined();
    await expect(updateExportTrayProgress(0.5, 1)).resolves.toBeUndefined();
    await expect(runExportPowerAction('shutdown', true)).resolves.toBeUndefined();
    await expect(relaunchApp()).resolves.toBeUndefined();
    await expect(emitBridge('e', 1)).resolves.toBeUndefined();
  });

  it('checkAppUpdate 浏览器返回 null；getAppVersion 返回 package.json 版本', async () => {
    await expect(checkAppUpdate()).resolves.toBeNull();
    await expect(getAppVersion()).resolves.toBe(desktopPackage.version);
  });

  it('listenBridge 浏览器返回 no-op unlisten；listenDragDrop 同样', async () => {
    const unlisten = await listenBridge('e', vi.fn());
    expect(() => unlisten()).not.toThrow();
    const dragUnlisten = await listenDragDrop(vi.fn());
    expect(() => dragUnlisten()).not.toThrow();
  });
});

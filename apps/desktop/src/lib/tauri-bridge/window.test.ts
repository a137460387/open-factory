/**
 * Window Bridge Tests
 *
 * Tests the window/app bridge functions that wrap Tauri invoke calls
 * with mock fallback support.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
  emit: vi.fn(),
}));

vi.mock('@tauri-apps/api/app', () => ({
  getVersion: vi.fn(),
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  confirm: vi.fn(),
  message: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-process', () => ({
  relaunch: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-shell', () => ({
  open: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-updater', () => ({
  check: vi.fn(),
}));

vi.mock('../tauri', () => ({
  isTauriRuntime: vi.fn(() => false),
}));

vi.mock('../../i18n/strings', () => ({
  zhCN: {
    exportDialog: {
      trayMenu: {
        showWindow: 'Show',
        pauseQueue: 'Pause',
        cancelAll: 'Cancel',
        exit: 'Exit',
      },
    },
  },
}));

const mockStartCollaborationHost = vi.fn();
const mockStopCollaborationHost = vi.fn();
const mockOpenPreviewWindow = vi.fn();
const mockClosePreviewWindow = vi.fn();
const mockGetPreviewWindowState = vi.fn();
const mockSetPreviewWindowAlwaysOnTop = vi.fn();
const mockSetPreviewWindowFullscreen = vi.fn();
const mockSetPreviewWindowResolutionScale = vi.fn();
const mockGetAppVersion = vi.fn();
const mockCheckAppUpdate = vi.fn();
const mockRelaunchApp = vi.fn();
const mockListen = vi.fn();
const mockEmit = vi.fn();
const mockForceCloseWindow = vi.fn();
const mockOpenPath = vi.fn();
const mockShowMainWindow = vi.fn();
const mockMinimizeToTray = vi.fn();
const mockUpdateExportTrayProgress = vi.fn();
const mockRunExportPowerAction = vi.fn();

vi.mock('./mock-types', () => ({
  getTauriMocks: () => ({
    startCollaborationHost: mockStartCollaborationHost,
    stopCollaborationHost: mockStopCollaborationHost,
    openPreviewWindow: mockOpenPreviewWindow,
    closePreviewWindow: mockClosePreviewWindow,
    getPreviewWindowState: mockGetPreviewWindowState,
    setPreviewWindowAlwaysOnTop: mockSetPreviewWindowAlwaysOnTop,
    setPreviewWindowFullscreen: mockSetPreviewWindowFullscreen,
    setPreviewWindowResolutionScale: mockSetPreviewWindowResolutionScale,
    getAppVersion: mockGetAppVersion,
    checkAppUpdate: mockCheckAppUpdate,
    relaunchApp: mockRelaunchApp,
    listen: mockListen,
    emit: mockEmit,
    forceCloseWindow: mockForceCloseWindow,
    openPath: mockOpenPath,
    showMainWindow: mockShowMainWindow,
    minimizeToTray: mockMinimizeToTray,
    updateExportTrayProgress: mockUpdateExportTrayProgress,
    runExportPowerAction: mockRunExportPowerAction,
  }),
}));

import {
  startCollaborationHost,
  stopCollaborationHost,
  openPreviewWindow,
  closePreviewWindow,
  getPreviewWindowState,
  setPreviewWindowAlwaysOnTop,
  setPreviewWindowFullscreen,
  setPreviewWindowResolutionScale,
  getAppVersion,
  relaunchApp,
  listenBridge,
  emitBridge,
  forceCloseWindow,
  openPath,
  showMainWindow,
} from './window';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('startCollaborationHost', () => {
  it('delegates to mock', async () => {
    const state = { active: true, port: 8080 };
    mockStartCollaborationHost.mockResolvedValueOnce(state);
    const result = await startCollaborationHost({ port: 8080 });
    expect(result).toEqual(state);
    expect(mockStartCollaborationHost).toHaveBeenCalledWith({ port: 8080 });
  });
});

describe('stopCollaborationHost', () => {
  it('delegates to mock', async () => {
    mockStopCollaborationHost.mockResolvedValueOnce(undefined);
    await stopCollaborationHost();
    expect(mockStopCollaborationHost).toHaveBeenCalled();
  });
});

describe('openPreviewWindow', () => {
  it('delegates to mock with request', async () => {
    const request = {
      bounds: { width: 1920, height: 1080 },
      alwaysOnTop: true,
      resolutionScale: 1 as const,
    };
    const state = {
      open: true,
      label: 'preview',
      bounds: request.bounds,
      alwaysOnTop: true,
      fullscreen: false,
      resolutionScale: 1 as const,
    };
    mockOpenPreviewWindow.mockResolvedValueOnce(state);
    const result = await openPreviewWindow(request);
    expect(result).toEqual(state);
  });
});

describe('closePreviewWindow', () => {
  it('returns closed state from mock', async () => {
    const state = { open: false, label: 'preview', alwaysOnTop: false, fullscreen: false, resolutionScale: 1 as const };
    mockClosePreviewWindow.mockResolvedValueOnce(state);
    const result = await closePreviewWindow();
    expect(result.open).toBe(false);
  });
});

describe('getPreviewWindowState', () => {
  it('returns state from mock', async () => {
    const state = { open: true, label: 'preview', alwaysOnTop: false, fullscreen: false, resolutionScale: 0.5 as const };
    mockGetPreviewWindowState.mockResolvedValueOnce(state);
    const result = await getPreviewWindowState();
    expect(result.resolutionScale).toBe(0.5);
  });
});

describe('setPreviewWindowAlwaysOnTop', () => {
  it('delegates to mock with boolean', async () => {
    const state = { open: true, label: 'preview', alwaysOnTop: true, fullscreen: false, resolutionScale: 1 as const };
    mockSetPreviewWindowAlwaysOnTop.mockResolvedValueOnce(state);
    const result = await setPreviewWindowAlwaysOnTop(true);
    expect(result.alwaysOnTop).toBe(true);
    expect(mockSetPreviewWindowAlwaysOnTop).toHaveBeenCalledWith(true);
  });
});

describe('setPreviewWindowFullscreen', () => {
  it('delegates to mock with boolean', async () => {
    const state = { open: true, label: 'preview', alwaysOnTop: false, fullscreen: true, resolutionScale: 1 as const };
    mockSetPreviewWindowFullscreen.mockResolvedValueOnce(state);
    const result = await setPreviewWindowFullscreen(true);
    expect(result.fullscreen).toBe(true);
  });
});

describe('setPreviewWindowResolutionScale', () => {
  it('delegates to mock with scale value', async () => {
    const state = { open: true, label: 'preview', alwaysOnTop: false, fullscreen: false, resolutionScale: 0.25 as const };
    mockSetPreviewWindowResolutionScale.mockResolvedValueOnce(state);
    const result = await setPreviewWindowResolutionScale(0.25);
    expect(result.resolutionScale).toBe(0.25);
  });
});

describe('getAppVersion', () => {
  it('returns version from mock', async () => {
    mockGetAppVersion.mockResolvedValueOnce('4.70.0');
    const result = await getAppVersion();
    expect(result).toBe('4.70.0');
  });
});

describe('relaunchApp', () => {
  it('delegates to mock', async () => {
    mockRelaunchApp.mockResolvedValueOnce(undefined);
    await relaunchApp();
    expect(mockRelaunchApp).toHaveBeenCalled();
  });
});

describe('listenBridge', () => {
  it('delegates to mock listen', async () => {
    const unlisten = vi.fn();
    mockListen.mockResolvedValueOnce(unlisten);
    const handler = vi.fn();
    const result = await listenBridge('test-event', handler);
    expect(result).toBe(unlisten);
    expect(mockListen).toHaveBeenCalledWith('test-event', handler);
  });
});

describe('emitBridge', () => {
  it('delegates to mock emit', async () => {
    mockEmit.mockResolvedValueOnce(undefined);
    await emitBridge('test-event', { data: 'value' });
    expect(mockEmit).toHaveBeenCalledWith('test-event', { data: 'value' });
  });
});

describe('forceCloseWindow', () => {
  it('delegates to mock', async () => {
    mockForceCloseWindow.mockResolvedValueOnce(undefined);
    await forceCloseWindow();
    expect(mockForceCloseWindow).toHaveBeenCalled();
  });
});

describe('openPath', () => {
  it('delegates to mock', async () => {
    mockOpenPath.mockResolvedValueOnce(undefined);
    await openPath('/path/to/open');
    expect(mockOpenPath).toHaveBeenCalledWith('/path/to/open');
  });
});

describe('showMainWindow', () => {
  it('delegates to mock', async () => {
    mockShowMainWindow.mockResolvedValueOnce(undefined);
    await showMainWindow();
    expect(mockShowMainWindow).toHaveBeenCalled();
  });
});

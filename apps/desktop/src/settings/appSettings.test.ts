import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TauriMocks } from '../lib/tauri-bridge';
import {
  readAppSettings,
  readBackupSettings,
  readExportBackgroundSettings,
  readLayoutSettings,
  readThemeSettings,
  saveBackupSettings,
  saveExportBackgroundSettings,
  saveLanguageSetting,
  saveLayoutSettings,
  saveThemeSettings
} from './appSettings';

describe('app settings storage', () => {
  const appDataDir = 'C:/Users/E2E/AppData/Roaming/open-factory';
  const settingsPath = `${appDataDir}/settings.json`;
  const files = new Map<string, string>();
  const browserStorage = new Map<string, string>();

  beforeEach(() => {
    files.clear();
    browserStorage.clear();
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
        }
      } satisfies TauriMocks,
      localStorage: {
        getItem: (key: string) => browserStorage.get(key) ?? null,
        setItem: (key: string, value: string) => browserStorage.set(key, value),
        removeItem: (key: string) => browserStorage.delete(key)
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('persists and reads panel collapse state from settings.json', async () => {
    const saved = await saveLayoutSettings({
      timelineHeightPx: 340,
      leftPanelCollapsed: true,
      rightPanelCollapsed: true
    });

    expect(saved).toEqual({
      timelineHeightPx: 340,
      leftPanelCollapsed: true,
      rightPanelCollapsed: true
    });
    expect(JSON.parse(files.get(settingsPath) ?? '{}')).toEqual({
      layout: {
        timelineHeightPx: 340,
        leftPanelCollapsed: true,
        rightPanelCollapsed: true
      }
    });
    await expect(readLayoutSettings()).resolves.toEqual(saved);
  });

  it('preserves existing settings while updating layout', async () => {
    await saveLanguageSetting('en');
    await saveLayoutSettings({ leftPanelCollapsed: true });

    expect(await readAppSettings()).toEqual({
      language: 'en',
      layout: {
        timelineHeightPx: 260,
        leftPanelCollapsed: true,
        rightPanelCollapsed: false
      }
    });
  });

  it('persists backup settings without storing a WebDAV password', async () => {
    await saveBackupSettings({
      local: { enabled: true, directory: 'C:/Backups' },
      webdav: { enabled: true, url: 'https://dav.example.test/demo.cutproj.json', username: 'editor' },
      lastBackupAt: '2026-06-12T14:05:06.789Z'
    });

    expect(JSON.parse(files.get(settingsPath) ?? '{}')).toEqual({
      backup: {
        local: { enabled: true, directory: 'C:/Backups' },
        webdav: { enabled: true, url: 'https://dav.example.test/demo.cutproj.json', username: 'editor' },
        lastBackupAt: '2026-06-12T14:05:06.789Z'
      }
    });
    expect(files.get(settingsPath)).not.toContain('password');
    await expect(readBackupSettings()).resolves.toMatchObject({
      local: { enabled: true, directory: 'C:/Backups' },
      webdav: { enabled: true, url: 'https://dav.example.test/demo.cutproj.json', username: 'editor' }
    });
  });

  it('preserves language and layout while updating backup settings', async () => {
    await saveLanguageSetting('en');
    await saveLayoutSettings({ rightPanelCollapsed: true });
    await saveBackupSettings({ local: { enabled: true, directory: 'D:/Backups' }, webdav: { enabled: false } });

    expect(await readAppSettings()).toEqual({
      language: 'en',
      layout: {
        timelineHeightPx: 260,
        leftPanelCollapsed: false,
        rightPanelCollapsed: true
      },
      backup: {
        local: { enabled: true, directory: 'D:/Backups' },
        webdav: { enabled: false }
      }
    });
  });

  it('persists theme settings without overwriting existing settings', async () => {
    await saveLanguageSetting('en');
    await saveLayoutSettings({ leftPanelCollapsed: true });

    const theme = await saveThemeSettings({
      activeThemeId: 'light',
      customThemes: []
    });

    expect(theme).toEqual({ activeThemeId: 'light', customThemes: [] });
    expect(JSON.parse(files.get(settingsPath) ?? '{}')).toEqual({
      language: 'en',
      layout: {
        timelineHeightPx: 260,
        leftPanelCollapsed: true,
        rightPanelCollapsed: false
      },
      theme: {
        activeThemeId: 'light',
        customThemes: []
      }
    });
    await expect(readThemeSettings()).resolves.toEqual(theme);
  });

  it('defaults export power actions off and persists explicit opt-in', async () => {
    await expect(readExportBackgroundSettings()).resolves.toEqual({ allowPowerActions: false });

    await saveLanguageSetting('en');
    const exportBackground = await saveExportBackgroundSettings({ allowPowerActions: true });

    expect(exportBackground).toEqual({ allowPowerActions: true });
    expect(await readAppSettings()).toEqual({
      language: 'en',
      exportBackground: { allowPowerActions: true }
    });
  });
});

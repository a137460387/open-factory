import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TauriMocks } from '../lib/tauri-bridge';
import { readAppSettings, readLayoutSettings, saveLanguageSetting, saveLayoutSettings } from './appSettings';

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
});

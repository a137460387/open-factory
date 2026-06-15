import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TauriMocks } from '../lib/tauri-bridge';
import {
  readAppSettings,
  readAutomationRules,
  readBackupSettings,
  readCustomSplitLayouts,
  readExportBackgroundSettings,
  readExportUploadSettings,
  readExportRules,
  readLayoutSettings,
  readPreviewPerformanceSettings,
  readThemeSettings,
  readTimelineGridSettings,
  readViewSettings,
  saveBackupSettings,
  saveAutomationRules,
  saveCustomSplitLayouts,
  saveExportBackgroundSettings,
  saveExportUploadSettings,
  saveExportRules,
  saveLanguageSetting,
  saveLayoutSettings,
  savePreviewPerformanceSettings,
  saveThemeSettings,
  saveTimelineGridSettings,
  saveViewSettings
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
    await expect(readExportBackgroundSettings()).resolves.toEqual({ allowPowerActions: false, postExportScriptAcknowledged: false });

    await saveLanguageSetting('en');
    const exportBackground = await saveExportBackgroundSettings({ allowPowerActions: true, postExportScriptAcknowledged: true });

    expect(exportBackground).toEqual({ allowPowerActions: true, postExportScriptAcknowledged: true });
    expect(await readAppSettings()).toEqual({
      language: 'en',
      exportBackground: { allowPowerActions: true, postExportScriptAcknowledged: true }
    });
  });

  it('persists export upload settings without storing a WebDAV password', async () => {
    await expect(readExportUploadSettings()).resolves.toEqual({
      enabled: false,
      targetType: 'webdav',
      webdav: {},
      local: {}
    });

    await saveLanguageSetting('en');
    const upload = await saveExportUploadSettings({
      enabled: true,
      targetType: 'webdav',
      webdav: { url: 'https://dav.example.test/exports/out.mp4', username: 'editor' },
      local: { directory: 'D:/Uploaded' },
      password: 'should-not-persist'
    } as never);

    expect(upload).toEqual({
      enabled: true,
      targetType: 'webdav',
      webdav: { url: 'https://dav.example.test/exports/out.mp4', username: 'editor' },
      local: { directory: 'D:/Uploaded' }
    });
    expect(files.get(settingsPath)).not.toContain('password');
    expect(await readAppSettings()).toEqual({
      language: 'en',
      exportUpload: upload
    });
  });

  it('persists normalized export condition rules in settings.json', async () => {
    await saveLanguageSetting('en');
    const rules = await saveExportRules([
      {
        id: 'copy-success',
        enabled: true,
        trigger: 'export-success',
        action: 'copy-to-directory',
        targetDirectory: 'C:/Exports/{date}/{project}'
      },
      {
        id: 'invalid',
        enabled: true,
        trigger: 'unknown' as never,
        action: 'copy-to-directory'
      }
    ]);

    expect(rules).toEqual([
      {
        id: 'copy-success',
        enabled: true,
        trigger: 'export-success',
        action: 'copy-to-directory',
        targetDirectory: 'C:/Exports/{date}/{project}'
      }
    ]);
    expect(await readExportRules()).toEqual(rules);
    expect(await readAppSettings()).toEqual({
      language: 'en',
      exportRules: rules
    });
  });

  it('persists normalized custom split-screen layouts in settings.json', async () => {
    const saved = await saveCustomSplitLayouts([
      {
        id: ' review ',
        name: ' Review Grid ',
        cells: [
          { x: 0, y: 0, width: 0.6, height: 1 },
          { x: 0.6, y: 0, width: 0.5, height: 0.5 },
          { x: 0.6, y: 0.5, width: 0.5, height: 0.5 }
        ]
      },
      {
        id: 'review',
        name: 'duplicate',
        cells: [
          { x: 0, y: 0, width: 0.5, height: 1 },
          { x: 0.5, y: 0, width: 0.5, height: 1 }
        ]
      }
    ]);

    expect(saved).toEqual([
      {
        id: 'review',
        name: 'Review Grid',
        cells: [
          { x: 0, y: 0, width: 0.6, height: 1 },
          { x: 0.6, y: 0, width: 0.4, height: 0.5 },
          { x: 0.6, y: 0.5, width: 0.4, height: 0.5 }
        ]
      }
    ]);
    expect(JSON.parse(files.get(settingsPath) ?? '{}')).toEqual({ customSplitLayouts: saved });
    await expect(readCustomSplitLayouts()).resolves.toEqual(saved);
  });

  it('persists safe frame guide visibility in view settings', async () => {
    await expect(readViewSettings()).resolves.toEqual({ safeFrameGuides: false, thumbnailTrackVisible: true });

    await saveLanguageSetting('en');
    const view = await saveViewSettings({ safeFrameGuides: true, thumbnailTrackVisible: false });

    expect(view).toEqual({ safeFrameGuides: true, thumbnailTrackVisible: false });
    expect(await readViewSettings()).toEqual({ safeFrameGuides: true, thumbnailTrackVisible: false });
    expect(await readAppSettings()).toEqual({
      language: 'en',
      view: { safeFrameGuides: true, thumbnailTrackVisible: false }
    });

    await saveViewSettings({ safeFrameGuides: false, thumbnailTrackVisible: true });
    expect(await readViewSettings()).toEqual({ safeFrameGuides: false, thumbnailTrackVisible: true });
    expect(JSON.parse(files.get(settingsPath) ?? '{}')).toEqual({
      language: 'en',
      view: { safeFrameGuides: false, thumbnailTrackVisible: true }
    });
  });

  it('persists preview performance settings in settings.json', async () => {
    await expect(readPreviewPerformanceSettings()).resolves.toEqual({ qualityMode: 'full', skipFrames: 1 });

    await saveLanguageSetting('en');
    const previewPerformance = await savePreviewPerformanceSettings({ qualityMode: 'half', skipFrames: 2 });

    expect(previewPerformance).toEqual({ qualityMode: 'half', skipFrames: 2 });
    expect(await readPreviewPerformanceSettings()).toEqual({ qualityMode: 'half', skipFrames: 2 });
    expect(await readAppSettings()).toEqual({
      language: 'en',
      previewPerformance: { qualityMode: 'half', skipFrames: 2 }
    });

    await savePreviewPerformanceSettings({ qualityMode: 'full', skipFrames: 1 });
    expect(JSON.parse(files.get(settingsPath) ?? '{}')).toEqual({ language: 'en' });
  });

  it('persists timeline grid snap settings in settings.json', async () => {
    await expect(readTimelineGridSettings()).resolves.toEqual({ enabled: false, unit: 'frame' });

    await saveLanguageSetting('en');
    const grid = await saveTimelineGridSettings({ enabled: true, unit: '5-frames' });

    expect(grid).toEqual({ enabled: true, unit: '5-frames' });
    expect(await readTimelineGridSettings()).toEqual(grid);
    expect(await readAppSettings()).toEqual({
      language: 'en',
      timelineGrid: grid
    });

    const normalized = await saveTimelineGridSettings({ unit: 'unknown' as never });
    expect(normalized).toEqual({ enabled: true, unit: 'frame' });
  });

  it('persists normalized declarative automation rules in settings.json', async () => {
    await saveLanguageSetting('en');
    const rules = await saveAutomationRules([
      {
        id: 'long-video-proxy',
        name: 'Long video proxy',
        enabled: true,
        trigger: 'on-import',
        conditions: [{ field: 'duration', op: '>', value: 300 }],
        actions: [
          { type: 'generate-proxy' },
          { type: 'add-tag', value: 'green' }
        ]
      },
      {
        id: 'invalid',
        enabled: true,
        trigger: 'unknown' as never,
        conditions: [],
        actions: [{ type: 'generate-proxy' }]
      }
    ]);

    expect(rules).toEqual([
      {
        id: 'long-video-proxy',
        name: 'Long video proxy',
        enabled: true,
        trigger: 'on-import',
        conditions: [{ field: 'duration', op: '>', value: 300 }],
        actions: [
          { type: 'generate-proxy' },
          { type: 'add-tag', value: 'green' }
        ]
      }
    ]);
    expect(await readAutomationRules()).toEqual(rules);
    expect(await readAppSettings()).toEqual({
      language: 'en',
      automationRules: rules
    });
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_POST_EXPORT_QUALITY_ASSURANCE_SETTINGS } from '@open-factory/editor-core';
import type { TauriMocks } from '../lib/tauri-bridge';
import { DEFAULT_EDITOR_LAYOUT_SETTINGS, type EditorLayoutSettings } from '../layout/layoutSettings';
import {
  readAppSettings,
  readAutomationRules,
  readBackupSettings,
  readCollaborationIdentitySettings,
  readCustomSplitLayouts,
  readExportBackgroundSettings,
  readExportQualityAssuranceSettings,
  readExportPresetSyncSettings,
  readExportUploadSettings,
  readExportRules,
  readLayoutSettings,
  readLocalAiModelsSettings,
  readPreviewPerformanceSettings,
  readPreviewWindowSettings,
  readThemeSettings,
  readTutorialProgressSettings,
  readTimelineInteractionSettings,
  readTimelineGridSettings,
  readViewSettings,
  saveBackupSettings,
  saveAutomationRules,
  saveCollaborationIdentitySettings,
  saveCustomSplitLayouts,
  saveExportBackgroundSettings,
  saveExportQualityAssuranceSettings,
  saveExportPresetSyncSettings,
  saveExportUploadSettings,
  saveExportRules,
  saveLanguageSetting,
  saveLayoutSettings,
  saveLocalAiModelsSettings,
  savePreviewPerformanceSettings,
  savePreviewWindowSettings,
  saveThemeSettings,
  saveTutorialProgressSettings,
  saveTimelineInteractionSettings,
  saveTimelineGridSettings,
  saveViewSettings
} from './appSettings';

describe('app settings storage', () => {
  const appDataDir = 'C:/Users/E2E/AppData/Roaming/open-factory';
  const settingsPath = `${appDataDir}/settings.json`;
  const files = new Map<string, string>();
  const browserStorage = new Map<string, string>();

  function expectedLayout(patch: Partial<EditorLayoutSettings> = {}): EditorLayoutSettings {
    return {
      ...DEFAULT_EDITOR_LAYOUT_SETTINGS,
      ...patch,
      panels: {
        ...DEFAULT_EDITOR_LAYOUT_SETTINGS.panels,
        ...(patch.panels ?? {})
      },
      customWorkspaceLayouts: patch.customWorkspaceLayouts ?? DEFAULT_EDITOR_LAYOUT_SETTINGS.customWorkspaceLayouts
    };
  }

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

    const expected = expectedLayout({
      timelineHeightPx: 340,
      leftPanelCollapsed: true,
      rightPanelCollapsed: true
    });
    expect(saved).toEqual(expected);
    expect(JSON.parse(files.get(settingsPath) ?? '{}')).toEqual({
      layout: expected
    });
    await expect(readLayoutSettings()).resolves.toEqual(saved);
  });

  it('preserves existing settings while updating layout', async () => {
    await saveLanguageSetting('en');
    await saveLayoutSettings({ leftPanelCollapsed: true });

    expect(await readAppSettings()).toEqual({
      language: 'en',
      layout: expectedLayout({ leftPanelCollapsed: true })
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
      layout: expectedLayout({ rightPanelCollapsed: true }),
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
      layout: expectedLayout({ leftPanelCollapsed: true }),
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

  it('persists tutorial progress in settings.json', async () => {
    await expect(readTutorialProgressSettings()).resolves.toEqual({ tutorialStep: 0, tutorialSkipped: false, tutorialCompleted: false });

    await saveLanguageSetting('en');
    const progress = await saveTutorialProgressSettings({ tutorialStep: 3 });

    expect(progress).toEqual({ tutorialStep: 3, tutorialSkipped: false, tutorialCompleted: false });
    expect(await readAppSettings()).toEqual({
      language: 'en',
      tutorialStep: 3,
      tutorialSkipped: false,
      tutorialCompleted: false
    });
    expect(await readTutorialProgressSettings()).toEqual(progress);
  });

  it('persists skipped tutorial state so it no longer auto-opens', async () => {
    const progress = await saveTutorialProgressSettings({ tutorialStep: 1, tutorialSkipped: true });

    expect(progress).toEqual({ tutorialStep: 1, tutorialSkipped: true, tutorialCompleted: false });
    expect(JSON.parse(files.get(settingsPath) ?? '{}')).toEqual({
      tutorialStep: 1,
      tutorialSkipped: true,
      tutorialCompleted: false
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

  it('persists export preset sync settings without storing a WebDAV password', async () => {
    await expect(readExportPresetSyncSettings()).resolves.toEqual({
      enabled: false,
      syncOnStartup: false,
      conflictMode: 'merge'
    });

    await saveLanguageSetting('en');
    const sync = await saveExportPresetSyncSettings({
      enabled: true,
      url: ' https://dav.example.test/presets/export.ofpreset.json ',
      username: ' editor ',
      syncOnStartup: true,
      conflictMode: 'keep-remote',
      lastSyncedAt: '2026-06-15T02:00:00.000Z',
      password: 'should-not-persist'
    } as never);

    expect(sync).toEqual({
      enabled: true,
      url: 'https://dav.example.test/presets/export.ofpreset.json',
      username: 'editor',
      syncOnStartup: true,
      conflictMode: 'keep-remote',
      lastSyncedAt: '2026-06-15T02:00:00.000Z'
    });
    expect(files.get(settingsPath)).not.toContain('password');
    expect(await readAppSettings()).toEqual({
      language: 'en',
      exportPresetSync: sync
    });
  });

  it('keeps post-export quality assurance disabled by default without persisting it', async () => {
    await expect(readExportQualityAssuranceSettings()).resolves.toEqual(DEFAULT_POST_EXPORT_QUALITY_ASSURANCE_SETTINGS);

    await saveLanguageSetting('en');
    const qualityAssurance = await saveExportQualityAssuranceSettings({});

    expect(qualityAssurance).toEqual(DEFAULT_POST_EXPORT_QUALITY_ASSURANCE_SETTINGS);
    expect(JSON.parse(files.get(settingsPath) ?? '{}')).toEqual({ language: 'en' });
  });

  it('persists enabled post-export quality assurance settings in settings.json', async () => {
    await saveLanguageSetting('en');
    const qualityAssurance = await saveExportQualityAssuranceSettings({
      enabled: true,
      duration: true,
      blackFrames: true,
      fileSize: true,
      minFileSizeBytes: 1024,
      maxFileSizeBytes: 4096,
      autoRetry: true
    });

    expect(qualityAssurance).toEqual({
      ...DEFAULT_POST_EXPORT_QUALITY_ASSURANCE_SETTINGS,
      enabled: true,
      duration: true,
      blackFrames: true,
      fileSize: true,
      minFileSizeBytes: 1024,
      maxFileSizeBytes: 4096,
      autoRetry: true
    });
    expect(await readAppSettings()).toEqual({
      language: 'en',
      exportQualityAssurance: qualityAssurance
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
    const defaultMediaLibrary = { mode: 'grid', gridSize: 'medium', sortKey: 'importedAt', sortDirection: 'asc' };
    const defaultTimelineHeatmap = { enabled: false, type: 'edit-density', opacity: 0.45, colorScheme: 'warm' };
    await expect(readViewSettings()).resolves.toEqual({ safeFrameGuides: false, thumbnailTrackVisible: true, timelineMinimapVisible: true, timelineHeatmap: defaultTimelineHeatmap, mediaLibrary: defaultMediaLibrary });

    await saveLanguageSetting('en');
    const view = await saveViewSettings({ safeFrameGuides: true, thumbnailTrackVisible: false, timelineMinimapVisible: false });

    expect(view).toEqual({ safeFrameGuides: true, thumbnailTrackVisible: false, timelineMinimapVisible: false, timelineHeatmap: defaultTimelineHeatmap, mediaLibrary: defaultMediaLibrary });
    expect(await readViewSettings()).toEqual({ safeFrameGuides: true, thumbnailTrackVisible: false, timelineMinimapVisible: false, timelineHeatmap: defaultTimelineHeatmap, mediaLibrary: defaultMediaLibrary });
    expect(await readAppSettings()).toEqual({
      language: 'en',
      view: { safeFrameGuides: true, thumbnailTrackVisible: false, timelineMinimapVisible: false, timelineHeatmap: defaultTimelineHeatmap, mediaLibrary: defaultMediaLibrary }
    });

    await saveViewSettings({ safeFrameGuides: false, thumbnailTrackVisible: true, timelineMinimapVisible: true });
    expect(await readViewSettings()).toEqual({ safeFrameGuides: false, thumbnailTrackVisible: true, timelineMinimapVisible: true, timelineHeatmap: defaultTimelineHeatmap, mediaLibrary: defaultMediaLibrary });
    expect(JSON.parse(files.get(settingsPath) ?? '{}')).toEqual({
      language: 'en',
      view: { safeFrameGuides: false, thumbnailTrackVisible: true, timelineMinimapVisible: true, timelineHeatmap: defaultTimelineHeatmap, mediaLibrary: defaultMediaLibrary }
    });
  });

  it('persists media library view mode and sorting in settings.json', async () => {
    const mediaLibrary = { mode: 'list' as const, gridSize: 'large' as const, sortKey: 'duration' as const, sortDirection: 'asc' as const };
    const defaultTimelineHeatmap = { enabled: false, type: 'edit-density', opacity: 0.45, colorScheme: 'warm' };

    await saveViewSettings({ mediaLibrary });

    expect(await readViewSettings()).toEqual({
      safeFrameGuides: false,
      thumbnailTrackVisible: true,
      timelineMinimapVisible: true,
      timelineHeatmap: defaultTimelineHeatmap,
      mediaLibrary
    });
    expect(JSON.parse(files.get(settingsPath) ?? '{}')).toEqual({
      view: {
        safeFrameGuides: false,
        thumbnailTrackVisible: true,
        timelineMinimapVisible: true,
        timelineHeatmap: defaultTimelineHeatmap,
        mediaLibrary
      }
    });
  });

  it('persists normalized timeline heatmap opacity in view settings', async () => {
    const mediaLibrary = { mode: 'grid', gridSize: 'medium', sortKey: 'importedAt', sortDirection: 'asc' };

    await saveViewSettings({ timelineHeatmap: { enabled: true, type: 'volume', opacity: 1.4, colorScheme: 'cool' } });

    expect(await readViewSettings()).toEqual({
      safeFrameGuides: false,
      thumbnailTrackVisible: true,
      timelineMinimapVisible: true,
      timelineHeatmap: { enabled: true, type: 'volume', opacity: 0.8, colorScheme: 'cool' },
      mediaLibrary
    });
    expect(JSON.parse(files.get(settingsPath) ?? '{}')).toEqual({
      view: {
        safeFrameGuides: false,
        thumbnailTrackVisible: true,
        timelineMinimapVisible: true,
        timelineHeatmap: { enabled: true, type: 'volume', opacity: 0.8, colorScheme: 'cool' },
        mediaLibrary
      }
    });
  });

  it('persists local AI model paths in settings.json', async () => {
    await saveLanguageSetting('en');
    const localModels = await saveLocalAiModelsSettings({
      whisper: { path: ' C:/Models/base.bin ', version: ' whisper.cpp ' },
      demucs: { path: 'C:/Tools/demucs.exe', version: 'demucs' },
      yunet: { path: '', version: '' }
    });

    expect(localModels).toEqual({
      whisper: { path: 'C:/Models/base.bin', version: 'whisper.cpp' },
      demucs: { path: 'C:/Tools/demucs.exe', version: 'demucs' }
    });
    expect(await readLocalAiModelsSettings()).toEqual(localModels);
    expect(await readAppSettings()).toEqual({
      language: 'en',
      localModels
    });
  });

  it('persists preview performance settings in settings.json', async () => {
    await expect(readPreviewPerformanceSettings()).resolves.toEqual({ qualityMode: 'full', skipFrames: 1, adaptiveEnabled: true });

    await saveLanguageSetting('en');
    const previewPerformance = await savePreviewPerformanceSettings({ qualityMode: 'half', skipFrames: 2, adaptiveEnabled: false });

    expect(previewPerformance).toEqual({ qualityMode: 'half', skipFrames: 2, adaptiveEnabled: false });
    expect(await readPreviewPerformanceSettings()).toEqual({ qualityMode: 'half', skipFrames: 2, adaptiveEnabled: false });
    expect(await readAppSettings()).toEqual({
      language: 'en',
      previewPerformance: { qualityMode: 'half', skipFrames: 2, adaptiveEnabled: false }
    });

    await savePreviewPerformanceSettings({ qualityMode: 'full', skipFrames: 1, adaptiveEnabled: true });
    expect(JSON.parse(files.get(settingsPath) ?? '{}')).toEqual({ language: 'en' });
  });

  it('persists reduced motion timeline interaction settings only when enabled', async () => {
    await expect(readTimelineInteractionSettings()).resolves.toEqual({ reduceMotion: false });

    await saveLanguageSetting('en');
    const interaction = await saveTimelineInteractionSettings({ reduceMotion: true });

    expect(interaction).toEqual({ reduceMotion: true });
    expect(await readTimelineInteractionSettings()).toEqual({ reduceMotion: true });
    expect(await readAppSettings()).toEqual({
      language: 'en',
      timelineInteraction: { reduceMotion: true }
    });

    await saveTimelineInteractionSettings({ reduceMotion: false });
    expect(JSON.parse(files.get(settingsPath) ?? '{}')).toEqual({ language: 'en' });
  });

  it('persists normalized collaboration identity settings when changed', async () => {
    await expect(readCollaborationIdentitySettings()).resolves.toEqual({ name: '我', color: '#38bdf8' });

    await saveLanguageSetting('en');
    const identity = await saveCollaborationIdentitySettings({ name: '  Alice  ', color: '#38BDF8' });

    expect(identity).toEqual({ name: 'Alice', color: '#38bdf8' });
    expect(await readCollaborationIdentitySettings()).toEqual(identity);
    expect(await readAppSettings()).toEqual({
      language: 'en',
      collaborationIdentity: identity
    });

    const fallbackColor = await saveCollaborationIdentitySettings({ color: 'not-a-color' });
    expect(fallbackColor).toEqual({ name: 'Alice', color: '#38bdf8' });
    expect(JSON.parse(files.get(settingsPath) ?? '{}')).toEqual({
      language: 'en',
      collaborationIdentity: { name: 'Alice', color: '#38bdf8' }
    });

    await saveCollaborationIdentitySettings({ name: '我' });
    expect(JSON.parse(files.get(settingsPath) ?? '{}')).toEqual({ language: 'en' });
  });

  it('persists normalized detached preview window bounds in settings.json', async () => {
    await expect(readPreviewWindowSettings()).resolves.toEqual({
      bounds: { width: 960, height: 540 },
      alwaysOnTop: false,
      resolutionScale: 1
    });

    await saveLanguageSetting('en');
    const previewWindow = await savePreviewWindowSettings({
      bounds: { x: 52.4, y: -20.2, width: 1920.8, height: 1080.2 },
      alwaysOnTop: true,
      resolutionScale: 0.5
    });

    expect(previewWindow).toEqual({
      bounds: { x: 52, y: -20, width: 1921, height: 1080 },
      alwaysOnTop: true,
      resolutionScale: 0.5
    });
    expect(await readPreviewWindowSettings()).toEqual(previewWindow);
    expect(await readAppSettings()).toEqual({
      language: 'en',
      previewWindow
    });
  });

  it('clamps invalid detached preview window settings to safe defaults', async () => {
    const previewWindow = await savePreviewWindowSettings({
      bounds: { x: Number.NaN, y: 99, width: 12, height: 99 },
      resolutionScale: 0.75
    } as never);

    expect(previewWindow).toEqual({
      bounds: { y: 99, width: 320, height: 240 },
      alwaysOnTop: false,
      resolutionScale: 1
    });
    expect(JSON.parse(files.get(settingsPath) ?? '{}')).toEqual({ previewWindow });
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

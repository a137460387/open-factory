import { test as base, type Page } from '@playwright/test';
import {
  ToolbarPage,
  MediaBinPage,
  TimelinePage,
  InspectorPage,
  ExportDialogPage,
  SettingsDialogPage,
  AIPanelPage,
  ColorGradingPage,
  AudioMixerPage
} from './pages';

/** 自定义 fixtures 类型 */
type PageFixtures = {
  toolbar: ToolbarPage;
  mediaBin: MediaBinPage;
  timeline: TimelinePage;
  inspector: InspectorPage;
  exportDialog: ExportDialogPage;
  settingsDialog: SettingsDialogPage;
  aiPanel: AIPanelPage;
  colorGradingPage: ColorGradingPage;
  audioMixerPage: AudioMixerPage;
};

/**
 * 扩展 Playwright test，自动注入页面对象 fixtures
 *
 * 用法：
 * ```ts
 * import { test, expect } from './fixtures';
 *
 * test('example', async ({ page, toolbar, timeline, exportDialog }) => {
 *   await toolbar.goto();
 *   await toolbar.importMedia();
 *   await timeline.waitForClips();
 * });
 * ```
 */
export const test = base.extend<PageFixtures>({
  toolbar: async ({ page }, use) => {
    await use(new ToolbarPage(page));
  },
  mediaBin: async ({ page }, use) => {
    await use(new MediaBinPage(page));
  },
  timeline: async ({ page }, use) => {
    await use(new TimelinePage(page));
  },
  inspector: async ({ page }, use) => {
    await use(new InspectorPage(page));
  },
  exportDialog: async ({ page }, use) => {
    await use(new ExportDialogPage(page));
  },
  settingsDialog: async ({ page }, use) => {
    await use(new SettingsDialogPage(page));
  },
  aiPanel: async ({ page }, use) => {
    await use(new AIPanelPage(page));
  },
  colorGradingPage: async ({ page }, use) => {
    await use(new ColorGradingPage(page));
  },
  audioMixerPage: async ({ page }, use) => {
    await use(new AudioMixerPage(page));
  }
});

export { expect } from '@playwright/test';

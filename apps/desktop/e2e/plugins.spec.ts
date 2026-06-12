import { expect, test, type Page } from '@playwright/test';
import { addMediaCardToTimeline, openExportDialog, waitForE2eActions } from './e2e-actions';

type HookSummary = { pluginId: string; hookName: string; ok: boolean };

test('lists plugin manifests, isolates permission errors, and toggles export hooks', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.clearE2eFiles!());

  await openPluginSettings(page);
  await expect(page.getByTestId('plugin-list-item')).toHaveCount(3);
  await expect(page.getByText('导出片段计数示例')).toBeVisible();
  await expect(page.getByText('E2E Export Count')).toBeVisible();
  await expect(page.getByText('E2E Missing Permission')).toBeVisible();
  await expect(page.getByTestId('plugin-load-error')).toContainText('broken plugin');

  const e2ePlugin = pluginEntry(page, 'e2e.export-count');
  await expect(e2ePlugin.getByTestId('plugin-permissions')).toContainText('导出 Hook');
  await expect(e2ePlugin.getByTestId('plugin-status')).toHaveAttribute('data-status', 'enabled');
  await closeSettings(page);

  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);

  await runExportAndExpectHooks(page, 'C:/Exports/plugin-hook.mp4', [
    { pluginId: 'open-factory.example.export-count', hookName: 'onExportBefore', ok: true },
    { pluginId: 'e2e.export-count', hookName: 'onExportBefore', ok: true },
    { pluginId: 'e2e.missing-permission', hookName: 'onExportBefore', ok: false }
  ]);
  await closeExportDialog(page);

  await openPluginSettings(page);
  const deniedPlugin = pluginEntry(page, 'e2e.missing-permission');
  await expect(deniedPlugin.getByTestId('plugin-status')).toHaveAttribute('data-status', 'error');
  await expect(deniedPlugin.getByTestId('plugin-entry-error')).toContainText('missing export-hook permission');
  await e2ePlugin.getByTestId('plugin-toggle-button').click();
  await expect(e2ePlugin.getByTestId('plugin-status')).toHaveAttribute('data-status', 'disabled');
  await closeSettings(page);

  await runExportAndExpectHooks(page, 'C:/Exports/plugin-disabled.mp4', [
    { pluginId: 'open-factory.example.export-count', hookName: 'onExportBefore', ok: true },
    { pluginId: 'e2e.missing-permission', hookName: 'onExportBefore', ok: false }
  ]);
  await closeExportDialog(page);

  await openPluginSettings(page);
  await pluginEntry(page, 'e2e.export-count').getByTestId('plugin-toggle-button').click();
  await expect(pluginEntry(page, 'e2e.export-count').getByTestId('plugin-status')).toHaveAttribute('data-status', 'enabled');
  await closeSettings(page);

  await runExportAndExpectHooks(page, 'C:/Exports/plugin-enabled.mp4', [
    { pluginId: 'open-factory.example.export-count', hookName: 'onExportBefore', ok: true },
    { pluginId: 'e2e.export-count', hookName: 'onExportBefore', ok: true },
    { pluginId: 'e2e.missing-permission', hookName: 'onExportBefore', ok: false }
  ]);
});

async function openPluginSettings(page: Page): Promise<void> {
  await page.getByTestId('toolbar-settings-button').click();
  await page.getByTestId('settings-tab-plugins').click();
}

async function closeSettings(page: Page): Promise<void> {
  await page.getByTestId('settings-close-button').click();
}

async function closeExportDialog(page: Page): Promise<void> {
  const dialog = page.getByTestId('export-dialog');
  await dialog.getByRole('button', { name: '关闭导出弹窗' }).click();
}

function pluginEntry(page: Page, pluginId: string) {
  return page.locator(`[data-testid="plugin-list-item"][data-plugin-id="${pluginId}"]`);
}

async function runExportAndExpectHooks(page: Page, outputPath: string, expected: HookSummary[]): Promise<void> {
  await page.evaluate(() => window.__E2E_ACTIONS__!.clearPluginHookLog!());
  await page.evaluate((path) => window.__E2E_ACTIONS__!.setSavePath!(path), outputPath);
  await openExportDialog(page);
  await page.getByTestId('export-enqueue-button').click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const entries = window.__E2E_ACTIONS__!.getPluginHookLog!() as HookSummary[];
        return entries.map((entry) => ({
          pluginId: entry.pluginId,
          hookName: entry.hookName,
          ok: entry.ok
        }));
      })
    )
    .toEqual(expected);
}

import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, openExportDialog, waitForE2eActions } from './e2e-actions';

test('loads example plugins and triggers onExportBefore during export', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);

  await page.getByTestId('toolbar-settings-button').click();
  await page.getByTestId('settings-tab-plugins').click();
  await expect(page.getByTestId('plugin-list-item')).toHaveCount(2);
  await expect(page.getByText('导出片段计数示例')).toBeVisible();
  await expect(page.getByText('E2E Export Count')).toBeVisible();
  await expect(page.getByTestId('plugin-load-error')).toContainText('broken plugin');
  await page.getByTestId('settings-close-button').click();

  await page.evaluate(() => window.__E2E_ACTIONS__!.clearPluginHookLog!());
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setSavePath!('C:/Exports/plugin-hook.mp4'));
  await openExportDialog(page);
  await page.getByTestId('export-enqueue-button').click();

  await expect
    .poll(() =>
      page.evaluate(() => {
        const entries = window.__E2E_ACTIONS__!.getPluginHookLog!() as Array<{ pluginId: string; hookName: string; ok: boolean }>;
        return entries.map((entry) => ({
          pluginId: entry.pluginId,
          hookName: entry.hookName,
          ok: entry.ok
        }));
      })
    )
    .toEqual([
      { pluginId: 'open-factory.example.export-count', hookName: 'onExportBefore', ok: true },
      { pluginId: 'e2e.export-count', hookName: 'onExportBefore', ok: true }
    ]);
});

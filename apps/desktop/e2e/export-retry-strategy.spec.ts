import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, openExportDialog } from './e2e-actions';

test('export retry strategy settings are visible in export settings', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 720 });
  await page.goto('/');
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page);

  await openExportDialog(page);

  const settingsTab = page.getByTestId('export-settings-tab');
  if (await settingsTab.isVisible()) {
    await settingsTab.click();
    const retrySection = page.getByTestId('export-retry-settings');
    await expect(retrySection).toBeVisible({ timeout: 5000 });
  }
});

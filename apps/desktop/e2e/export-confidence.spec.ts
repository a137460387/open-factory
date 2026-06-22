import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, openExportDialog, waitForE2eActions } from './e2e-actions';

test('shows confidence indicator on export cost estimate panel', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);

  await openExportDialog(page);
  await expect(page.getByTestId('export-cost-estimate-panel')).toBeVisible();
  await expect(page.getByTestId('export-cost-confidence')).toBeVisible();
  await expect(page.getByTestId('export-cost-confidence')).toContainText('置信度');
  await expect(page.getByTestId('export-cost-complexity')).toBeVisible();
});

test('updates cost estimate in real time when changing resolution without clicking refresh', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);

  await openExportDialog(page);
  await expect(page.getByTestId('export-cost-estimate-panel')).toBeVisible();
  await page.getByTestId('export-preset-select').selectOption('web-1080p');
  const duration1080 = await page.getByTestId('export-cost-duration').textContent();

  await page.getByTestId('export-preset-select').selectOption('4k');
  await expect.poll(async () => (await page.getByTestId('export-cost-duration').textContent())).not.toBe(duration1080);
  await expect(page.getByTestId('export-cost-confidence')).toBeVisible();
});

import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, openExportDialog, waitForE2eActions } from './e2e-actions';

test('queues two presets in compare export and shows automatic quality results', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.clearE2eFiles!());
  await page.reload();
  await waitForE2eActions(page);

  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);

  await openExportDialog(page);
  await page.getByTestId('export-mode-codec-compare-tab').click();
  await expect(page.getByTestId('export-codec-compare-preset-web-1080p')).toBeChecked();
  await expect(page.getByTestId('export-codec-compare-preset-4k')).toBeChecked();
  await page.getByTestId('export-output-path').fill('C:/Exports/codec-compare.mp4');
  await page.getByTestId('export-enqueue-button').click();

  await expect(page.getByTestId('export-codec-compare-results')).toBeVisible();
  await expect(page.getByTestId('export-codec-compare-result-row')).toHaveCount(2);
  await expect(page.getByTestId('export-codec-compare-ssim').first()).toContainText('0.991', { timeout: 15_000 });
  await expect(page.getByTestId('export-codec-compare-psnr').first()).toContainText('41.3');
  await expect(page.getByTestId('export-codec-compare-recommend-button')).toBeEnabled();

  const calls = await page.evaluate(() => window.__E2E_ACTIONS__!.getExportRunCalls!());
  expect(calls).toHaveLength(2);
});

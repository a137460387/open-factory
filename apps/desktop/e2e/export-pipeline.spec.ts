import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, openExportDialog, waitForE2eActions } from './e2e-actions';

test('creates and executes a two node export pipeline', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setSavePath!('C:/Exports/pipeline-output.mp4'));
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);

  await openExportDialog(page);
  await page.getByTestId('export-mode-pipeline-tab').click();
  await expect(page.getByTestId('export-pipeline-tab')).toBeVisible();
  await page.getByTestId('export-pipeline-create-two-node').click();
  await expect(page.getByTestId('export-pipeline-node')).toHaveCount(2);

  await page.getByTestId('export-enqueue-button').click();
  await expect(page.getByTestId('export-pipeline-node-status').nth(0)).toHaveAttribute('data-status', 'complete', { timeout: 15_000 });
  await expect(page.getByTestId('export-pipeline-node-status').nth(1)).toHaveAttribute('data-status', 'complete', { timeout: 15_000 });
});

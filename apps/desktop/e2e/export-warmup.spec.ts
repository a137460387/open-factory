import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, expectExportTaskStatus, openExportDialog, waitForE2eActions } from './e2e-actions';

test('shows export warmup status before queueing export', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => {
    window.__E2E_ACTIONS__!.clearE2eFiles!();
    window.__E2E_ACTIONS__!.setExportWarmupDelay!(400);
    window.__E2E_ACTIONS__!.setSavePath!('C:/Exports/warmup-export.mp4');
  });
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);

  await openExportDialog(page);
  await page.getByTestId('export-enqueue-button').click();
  await expect(page.getByTestId('export-warmup-status')).toBeVisible();
  await expect(page.getByTestId('export-warmup-status')).toContainText('正在准备导出');
  await expect(page.getByTestId('export-warmup-status')).toHaveAttribute('data-status', 'running');
  await expectExportTaskStatus(page, 0, 'success');
});

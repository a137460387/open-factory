import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, expectExportTaskStatus, openExportDialog, waitForE2eActions } from './e2e-actions';

test('runs configured post-export script and shows stdout in export history', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.clearE2eFiles!());
  await page.evaluate(() => window.__E2E_ACTIONS__!.setSavePath!('C:/Exports/post-script-output.mp4'));
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);

  await openExportDialog(page);
  await page.getByTestId('export-post-script-summary').click();
  await page.getByTestId('export-post-script-command-input').fill('echo {output}');
  await page.getByTestId('export-post-script-ack-toggle').check();
  await page.getByTestId('export-enqueue-button').click();
  await page.getByTestId('export-post-script-confirm-ok').click();

  await expectExportTaskStatus(page, 0, 'success');

  await expect(page.getByTestId('export-history-entry')).toHaveCount(1);
  await expect(page.getByTestId('export-post-script-result')).toBeVisible();
  await expect(page.getByTestId('export-post-script-stdout')).toContainText('C:/Exports/post-script-output.mp4');
  await expect(page.getByTestId('export-post-script-exit-code')).toContainText('0');
});

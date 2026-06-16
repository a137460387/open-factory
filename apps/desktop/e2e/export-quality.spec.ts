import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, expectExportTaskStatus, openExportDialog, waitForE2eActions } from './e2e-actions';

test('shows mocked SSIM PSNR and VMAF quality results from export history', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.clearE2eFiles!());
  await page.evaluate(() => window.__E2E_ACTIONS__!.setSavePath!('C:/Exports/quality-e2e.mp4'));
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);

  await openExportDialog(page);
  await page.getByTestId('export-enqueue-button').click();
  await expectExportTaskStatus(page, 0, 'success');
  await expect(page.getByTestId('export-history-entry')).toHaveCount(1);

  await page.getByTestId('export-quality-button').click();
  await expect(page.getByTestId('quality-result-panel')).toBeVisible();
  await expect(page.getByTestId('quality-result-ssim')).toContainText('0.991');
  await expect(page.getByTestId('quality-result-psnr')).toContainText('41.3 dB');
  await expect(page.getByTestId('quality-result-vmaf')).toContainText('92.400');
});

test('shows automatic post-export quality assurance results in export history', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.clearE2eFiles!());
  await page.evaluate(() => window.__E2E_ACTIONS__!.setSavePath!('C:/Exports/post-export-qa-e2e.mp4'));
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);

  await page.getByTestId('toolbar-settings-button').click();
  await page.getByTestId('settings-export-qa-enabled').click();
  await page.getByTestId('settings-export-qa-duration').click();
  await page.getByTestId('settings-export-qa-black-frames').click();
  await expect(page.getByTestId('settings-export-qa-enabled')).toBeChecked();
  await expect(page.getByTestId('settings-export-qa-duration')).toBeChecked();
  await page.getByTestId('settings-close-button').click();

  await openExportDialog(page);
  await page.getByTestId('export-enqueue-button').click();
  await expectExportTaskStatus(page, 0, 'success');
  await expect(page.getByTestId('post-export-quality-result')).toBeVisible();
  await expect(page.getByTestId('post-export-quality-status')).toContainText('通过');
  await expect(page.getByTestId('post-export-quality-check-duration')).toHaveAttribute('data-status', 'pass');
});

import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, expectExportTaskStatus, openExportDialog, waitForE2eActions } from './e2e-actions';

test('recovers unsupported codec exports with libx264 and records the recovery history', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => {
    window.__E2E_ACTIONS__!.clearE2eFiles!();
    window.__E2E_ACTIONS__!.setSavePath!('C:/Exports/recovered-codec.mp4');
    window.__E2E_ACTIONS__!.setNextExportError!('Unknown encoder h264_nvenc');
  });
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);

  await openExportDialog(page);
  await page.getByTestId('export-preset-select').selectOption('web-1080p');
  await page.getByTestId('export-hardware-encoding-toggle').check();
  await page.getByTestId('export-enqueue-button').click();
  await expectExportTaskStatus(page, 0, 'success');

  const calls = await page.evaluate(() => window.__E2E_ACTIONS__!.getExportRunCalls!() as Array<{ fullArgs: string[] }>);
  expect(calls.length).toBeGreaterThanOrEqual(2);
  expect(calls[0].fullArgs).toEqual(expect.arrayContaining(['-c:v', 'h264_nvenc']));
  expect(calls[1].fullArgs).toEqual(expect.arrayContaining(['-c:v', 'libx264']));
  await expect(page.getByTestId('export-recovery-report')).toHaveAttribute('data-healed', 'true');
  await expect(page.getByTestId('export-recovery-entry')).toHaveAttribute('data-action', 'fallback-codec');
  await expect(page.getByTestId('export-recovery-report')).toContainText('编解码器不支持');
});

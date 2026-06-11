import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, expectExportTaskStatus, openExportDialog, waitForE2eActions } from './e2e-actions';

test('exports a GIF file through the queued export flow', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setSavePath!('C:/Exports/e2e-output.gif'));

  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);
  await openExportDialog(page);
  await page.getByTestId('export-format-select').selectOption('gif');
  await page.getByTestId('export-enqueue-button').click();
  await expectExportTaskStatus(page, 0, 'success');

  const plan = await page.evaluate(() => window.__E2E_ACTIONS__!.getLastExportPlan!() as { passes?: Array<{ fullArgs: string[] }>; fullArgs: string[] });
  expect(plan.passes).toHaveLength(2);
  expect(plan.fullArgs.at(-1)).toBe('C:/Exports/e2e-output.gif');
  await expect.poll(() => page.evaluate(() => window.__E2E_ACTIONS__!.getFileExists!('C:/Exports/e2e-output.gif'))).toBe(true);
});

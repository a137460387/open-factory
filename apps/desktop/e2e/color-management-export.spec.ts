import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, expectExportTaskStatus, openExportDialog, waitForE2eActions } from './e2e-actions';

test('adds colorspace args when exporting with DCI-P3 color management', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);

  await openExportDialog(page);
  await page.getByTestId('export-color-management-summary').click();
  await page.getByTestId('export-output-color-space-select').selectOption('dci-p3');
  await page.getByTestId('export-batch-paths').fill('C:/Exports/dci-p3-output.mp4');
  await page.getByTestId('export-enqueue-button').click();
  await expectExportTaskStatus(page, 0, 'success');

  const plan = await page.evaluate(() => window.__E2E_ACTIONS__!.getLastExportPlan!() as { filterComplex: string; outputArgs: string[] });
  expect(plan.filterComplex).toContain('colorspace=');
  expect(plan.filterComplex).toContain('primaries=smpte432');
  expect(plan.filterComplex).toContain('iccgen=force=1');
  expect(plan.outputArgs).toContain('+faststart+prefer_icc');
});

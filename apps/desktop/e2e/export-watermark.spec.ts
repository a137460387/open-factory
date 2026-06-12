import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, expectExportTaskStatus, openExportDialog, waitForE2eActions } from './e2e-actions';

test('enables text watermark and includes drawtext in the export plan', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);

  await openExportDialog(page);
  await page.getByTestId('export-watermark-summary').click();
  await page.getByTestId('export-watermark-enabled-toggle').check();
  await page.getByTestId('export-watermark-type-select').selectOption('text');
  await page.getByTestId('export-text-watermark-input').fill('DRAFT');
  await page.getByTestId('export-text-watermark-size-input').fill('44');
  await page.getByTestId('export-watermark-position-select').selectOption('bottom-right');
  await page.getByTestId('export-enqueue-button').click();
  await expectExportTaskStatus(page, 0, 'success');

  const plan = await page.evaluate(() => window.__E2E_ACTIONS__!.getLastExportPlan!() as { filterComplex: string });
  expect(plan.filterComplex).toContain("drawtext=text='DRAFT'");
  expect(plan.filterComplex).toContain("x='w-text_w-24':y='h-text_h-24'");
});

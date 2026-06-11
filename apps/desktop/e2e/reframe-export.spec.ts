import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, expectExportTaskStatus, openExportDialog, waitForE2eActions } from './e2e-actions';

test('exports a 9:16 smart reframe plan with exact output dimensions', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setSavePath!('C:/Exports/reframe-vertical.mp4'));
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);

  await openExportDialog(page);
  await page.getByTestId('export-preset-select').selectOption('web-1080p');
  await page.getByTestId('export-target-aspect-select').selectOption('9:16');
  await expect(page.getByTestId('export-width-input')).toHaveValue('1080');
  await expect(page.getByTestId('export-height-input')).toHaveValue('1920');
  await expect(page.getByTestId('export-reframe-preview')).toBeVisible();
  await page.getByTestId('export-reframe-offset-x').fill('0.25');
  await page.getByTestId('export-reframe-offset-y').fill('-0.5');
  await page.getByTestId('export-enqueue-button').click();
  await expectExportTaskStatus(page, 0, 'success');

  const plan = await page.evaluate(() => window.__E2E_ACTIONS__!.getLastExportPlan!() as { filterComplex: string; fullArgs: string[] });
  expect(plan.filterComplex).toContain("crop=w='if(gte(iw/ih\\,0.5625)\\,ih*0.5625\\,iw)'");
  expect(plan.filterComplex).toContain("x='(iw-ow)/2+(iw-ow)/2*0.25'");
  expect(plan.filterComplex).toContain("y='(ih-oh)/2+(ih-oh)/2*-0.5'");
  expect(plan.filterComplex).toContain('scale=1080:1920');
  expect(plan.filterComplex).not.toContain('pad=1080:1920');
  expect(plan.fullArgs.at(-1)).toBe('C:/Exports/reframe-vertical.mp4');
});

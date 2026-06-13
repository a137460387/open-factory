import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, expectExportTaskStatus, openExportDialog, waitForE2eActions } from './e2e-actions';

test('enables timecode burn-in and includes drawtext in the export plan', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);

  await openExportDialog(page);
  await page.getByTestId('export-monitoring-summary').click();
  await page.getByTestId('export-timecode-toggle').check();
  await page.getByTestId('export-timecode-position-select').selectOption('top-left');
  await page.getByTestId('export-timecode-font-size').fill('32');
  await page.getByTestId('export-timecode-frame-number-toggle').check();
  await page.getByTestId('export-enqueue-button').click();
  await expectExportTaskStatus(page, 0, 'success');

  const plan = await page.evaluate(() => window.__E2E_ACTIONS__!.getLastExportPlan!() as { filterComplex: string });
  expect(plan.filterComplex).toContain("drawtext=text='%{pts");
  expect(plan.filterComplex).toContain(":%{n}'");
  expect(plan.filterComplex).toContain('fontsize=32');
});

test('persists safe frame guide visibility from the view menu', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);

  await page.getByTestId('toolbar-view-menu-button').click();
  await page.getByTestId('toolbar-view-safe-frame-guides-menu-item').click();
  await expect(page.getByTestId('preview-safe-frame-guides')).toBeVisible();

  await page.reload();
  await waitForE2eActions(page);
  await expect(page.getByTestId('preview-safe-frame-guides')).toBeVisible();
});

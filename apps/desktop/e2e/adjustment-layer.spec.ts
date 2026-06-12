import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, expectExportTaskStatus, openExportDialog, waitForE2eActions } from './e2e-actions';

test('adds an adjustment layer and includes its filter in the export plan', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);

  await page.getByTestId('new-adjustment-layer-button').click();
  await expect(page.getByTestId('clip-brightness-input')).toBeVisible();
  await page.getByTestId('clip-brightness-input').fill('-0.35');
  await page.getByTestId('clip-brightness-input').press('Enter');

  await openExportDialog(page);
  await page.getByTestId('export-enqueue-button').click();
  await expectExportTaskStatus(page, 0, 'success');

  const plan = await page.evaluate(() => window.__E2E_ACTIONS__!.getLastExportPlan!() as { filterComplex: string });
  expect(plan.filterComplex).toContain('split=2');
  expect(plan.filterComplex).toContain('eq=brightness=-0.35');
  expect(plan.filterComplex).toContain("enable='between(t,0,");
});

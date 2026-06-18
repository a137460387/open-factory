import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, expectExportTaskStatus, openExportDialog, waitForE2eActions } from './e2e-actions';

test('sets spatial audio position and exports a pan filter', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);

  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);
  await page.locator('[data-testid^="timeline-clip-"]').first().click();

  await expect(page.getByTestId('spatial-audio-section')).toBeVisible();
  await page.getByTestId('clip-spatial-x-input').fill('-1');

  await openExportDialog(page);
  await page.getByTestId('export-enqueue-button').click();
  await expectExportTaskStatus(page, 0, 'success');

  const plan = await page.evaluate(() => window.__E2E_ACTIONS__!.getLastExportPlan!() as { filterComplex: string; fullArgs: string[] });
  expect(plan.filterComplex).toContain('pan=stereo');
  expect(plan.fullArgs.join(' ')).toContain('pan=stereo');
});

test('sets binaural azimuth and exports sofalizer args', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);

  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);
  await page.locator('[data-testid^="timeline-clip-"]').first().click();

  await expect(page.getByTestId('spatial-audio-section')).toBeVisible();
  await page.getByTestId('clip-spatial-azimuth-input').fill('90');

  await openExportDialog(page);
  await page.getByTestId('export-enqueue-button').click();
  await expectExportTaskStatus(page, 0, 'success');

  const plan = await page.evaluate(() => window.__E2E_ACTIONS__!.getLastExportPlan!() as { filterComplex: string; fullArgs: string[] });
  expect(plan.filterComplex).toContain('sofalizer=sofa=');
  expect(plan.filterComplex).toContain('azi=90');
  expect(plan.fullArgs.join(' ')).toContain('sofalizer=sofa=');
});

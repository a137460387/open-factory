import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, expectExportTaskStatus, openExportDialog, waitForE2eActions } from './e2e-actions';

test('exports pitch shift filters for audio-enabled clips', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);

  await expect(page.getByTestId('clip-pitch-input')).toBeVisible();
  await page.getByTestId('clip-pitch-input').fill('2');

  await openExportDialog(page);
  await page.getByTestId('export-enqueue-button').click();
  await expectExportTaskStatus(page, 0, 'success');

  const plan = await page.evaluate(() => window.__E2E_ACTIONS__!.getLastExportPlan!() as { filterComplex: string });
  expect(plan.filterComplex).toContain('asetrate=44100*');
});

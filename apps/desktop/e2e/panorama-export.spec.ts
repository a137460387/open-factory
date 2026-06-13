import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, expectExportTaskStatus, openExportDialog, waitForE2eActions } from './e2e-actions';

test('exports an equirectangular 360 clip through v360 args', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);

  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);

  await expect(page.getByTestId('clip-projection-select')).toBeVisible();
  await page.getByTestId('clip-projection-select').selectOption('equirectangular');
  await page.getByTestId('clip-panorama-yaw-input').fill('35');
  await page.getByTestId('clip-panorama-pitch-input').fill('-10');
  await page.evaluate(() => window.__E2E_ACTIONS__!.setSavePath!('C:/Exports/panorama-360.mp4'));

  await openExportDialog(page);
  await page.getByTestId('export-enqueue-button').click();
  await expectExportTaskStatus(page, 0, 'success');

  const plan = await page.evaluate(() => window.__E2E_ACTIONS__!.getLastExportPlan!() as { fullArgs: string[]; filterComplex: string; outputArgs: string[] });
  expect(plan.filterComplex).toContain('v360=e:flat:yaw=35:pitch=-10');
  expect(plan.outputArgs).toEqual(expect.arrayContaining(['-metadata:s:v:0', 'spherical=true']));
  expect(plan.fullArgs.at(-1)).toBe('C:/Exports/panorama-360.mp4');
});

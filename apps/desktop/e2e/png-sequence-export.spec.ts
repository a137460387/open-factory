import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, expectExportTaskStatus, openExportDialog, waitForE2eActions } from './e2e-actions';

test('imports a PNG sequence and exports multiple image2 frames', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => {
    window.__E2E_ACTIONS__!.setOpenFileDialogPaths!(['C:/Media/frame001.png', 'C:/Media/frame002.png', 'C:/Media/frame003.png']);
    window.__E2E_ACTIONS__!.setOpenDirectoryPath!('C:/Exports/png-sequence');
  });

  await page.getByTestId('import-media-button').click();
  await expect(page.locator('[data-testid^="media-card-"]')).toHaveCount(1);
  await addMediaCardToTimeline(page, 0);
  await page.locator('[data-testid^="timeline-clip-"]').first().click();
  await expect(page.getByTestId('image-sequence-framerate')).toBeVisible();

  await openExportDialog(page);
  await page.getByTestId('export-format-select').selectOption('png-sequence');
  await page.getByTestId('export-enqueue-button').click();
  await expectExportTaskStatus(page, 0, 'success');

  const plan = await page.evaluate(() => window.__E2E_ACTIONS__!.getLastExportPlan!() as { fullArgs: string[]; outputArgs: string[] });
  expect(plan.outputArgs).toEqual(['-r', '30', '-f', 'image2', 'C:/Exports/png-sequence/frame%04d.png']);
  expect(plan.fullArgs).toContain('-f');
  await expect.poll(() => page.evaluate(() => window.__E2E_ACTIONS__!.getFileExists!('C:/Exports/png-sequence/frame0001.png'))).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__E2E_ACTIONS__!.getFileExists!('C:/Exports/png-sequence/frame0003.png'))).toBe(true);
});

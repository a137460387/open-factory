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

test('exports a media library video through the dedicated GIF workflow', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.clearE2eFiles!());
  await page.getByTestId('import-media-button').click();

  const videoCard = page.locator('[data-testid^="media-card-"]').first();
  await expect(videoCard).toBeVisible();
  await videoCard.click({ button: 'right' });
  await page.locator('[data-testid^="media-export-gif-"]').first().click();
  await expect(page.getByTestId('gif-export-dialog')).toBeVisible();

  await page.getByTestId('gif-frame-rate-input').fill('18');
  await page.getByTestId('gif-scale-input').fill('320');
  await page.getByTestId('gif-start-time-input').fill('0.5');
  await page.getByTestId('gif-duration-input').fill('2');
  await page.getByTestId('gif-loop-count-input').fill('1');
  await page.getByTestId('gif-dither-select').selectOption('bayer');
  await page.getByTestId('gif-output-path-input').fill('C:/Exports/dedicated-workflow.gif');

  await expect.poll(() => page.evaluate(() => window.__E2E_ACTIONS__!.getLastGifPreviewRequest!())).toMatchObject({
    frameRate: 18,
    startTime: 0.5,
    duration: 2,
    dither: 'bayer'
  });
  await page.getByTestId('gif-export-button').click();
  await expect.poll(() => page.evaluate(() => window.__E2E_ACTIONS__!.getFileExists!('C:/Exports/dedicated-workflow.gif'))).toBe(true);
  await expect(page.getByTestId('gif-export-status')).toContainText('C:/Exports/dedicated-workflow.gif');

  const request = await page.evaluate(() => window.__E2E_ACTIONS__!.getLastGifExportRequest!() as { frameRate: number; scaleWidth: number; loopCount: number; dither: string; outputPath: string });
  expect(request).toMatchObject({
    frameRate: 18,
    scaleWidth: 320,
    loopCount: 1,
    dither: 'bayer',
    outputPath: 'C:/Exports/dedicated-workflow.gif'
  });
});

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

test('adds ACES zscale and colorspace args when project color pipeline is ACES', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);

  await page.getByTestId('toolbar-settings-button').click();
  await page.getByTestId('project-color-pipeline-select').selectOption('aces');
  await expect(page.getByText('此操作将影响所有 clip 的预览色彩')).toBeVisible();
  await page.getByTestId('settings-close-button').click();

  await openExportDialog(page);
  await page.getByTestId('export-batch-paths').fill('C:/Exports/aces-output.mp4');
  await page.getByTestId('export-enqueue-button').click();
  await expectExportTaskStatus(page, 0, 'success');

  const plan = await page.evaluate(() => window.__E2E_ACTIONS__!.getLastExportPlan!() as { filterComplex: string });
  expect(plan.filterComplex).toContain('zscale=');
  expect(plan.filterComplex).toContain('colorspace=');
});

test('adds source zscale conversion for Display P3 media in a Rec.709 working project', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);

  await page.getByTestId('toolbar-settings-button').click();
  await page.getByTestId('project-working-color-space-select').selectOption('rec709');
  await page.getByTestId('settings-close-button').click();

  await page.evaluate(() => window.__E2E_ACTIONS__!.setOpenFileDialogPaths!(['C:/Media/display-p3.mov']));
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);

  const confirmMessage = await page.evaluate(() => window.__E2E_ACTIONS__!.getLastConfirmMessage!());
  expect(confirmMessage).toContain('Rec.709');

  await openExportDialog(page);
  await page.getByTestId('export-batch-paths').fill('C:/Exports/p3-to-rec709.mp4');
  await page.getByTestId('export-enqueue-button').click();
  await expectExportTaskStatus(page, 0, 'success');

  const plan = await page.evaluate(() => window.__E2E_ACTIONS__!.getLastExportPlan!() as { filterComplex: string; outputArgs: string[] });
  expect(plan.filterComplex).toContain('zscale=matrixin=bt709:transferin=iec61966-2-1:primariesin=smpte432:matrix=bt709:transfer=bt709:primaries=bt709:range=tv');
  expect(plan.outputArgs).toEqual(expect.arrayContaining(['-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709']));
});

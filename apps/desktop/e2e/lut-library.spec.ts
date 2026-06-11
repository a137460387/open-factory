import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, expectExportTaskStatus, openExportDialog, waitForE2eActions } from './e2e-actions';

test('applies a LUT from the settings library and exports with lut3d', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.clearE2eFiles!());
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);

  const clipId = await page.evaluate(() => window.__E2E_ACTIONS__!.getTimelineSnapshot!().tracks[0].clips[0].id);
  await page.getByTestId('toolbar-settings-button').click();
  await expect(page.getByTestId('settings-dialog')).toBeVisible();
  await expect(page.getByTestId('lut-library-item')).toHaveCount(1);

  await page.getByTestId('lut-library-preview-button').first().click();
  await expect.poll(() =>
    page.evaluate((id) => {
      const clip = window.__E2E_ACTIONS__!.getTimelineSnapshot!()
        .tracks.flatMap((track) => track.clips)
        .find((item) => item.id === id);
      return clip?.colorCorrection?.lutPath ?? null;
    }, clipId)
  ).toBeNull();

  await page.getByTestId('lut-library-favorite-button').first().click();
  await page.getByTestId('lut-library-apply-button').first().click();
  await expect.poll(() =>
    page.evaluate((id) => {
      const clip = window.__E2E_ACTIONS__!.getTimelineSnapshot!()
        .tracks.flatMap((track) => track.clips)
        .find((item) => item.id === id);
      return clip?.colorCorrection?.lutPath ?? null;
    }, clipId)
  ).toContain('Warm Contrast.cube');

  await page.getByTestId('settings-close-button').click();
  await page.getByTestId('clip-input-color-space-select').selectOption('slog2');
  await openExportDialog(page);
  await page.getByTestId('export-preset-select').selectOption('web-1080p');
  await page.getByTestId('export-enqueue-button').click();
  await expectExportTaskStatus(page, 0, 'success');

  const plan = await page.evaluate(() => window.__E2E_ACTIONS__!.getLastExportPlan!() as { filterComplex: string });
  expect(plan.filterComplex.match(/lut3d=file=/g)).toHaveLength(2);
  expect(plan.filterComplex).toContain('__LOG_LUT_slog2_');
  expect(plan.filterComplex).toContain('Warm Contrast.cube');
});

import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, expectExportTaskStatus, openExportDialog, waitForE2eActions } from './e2e-actions';

test('exports swapped clip audio channel routing into FFmpeg args', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);

  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);
  await expect(page.getByTestId('clip-audio-channel-routing-select')).toBeVisible();
  await page.getByTestId('clip-audio-channel-routing-select').selectOption('swap-stereo');

  await expect
    .poll(() =>
      page.evaluate(() => {
        const clip = window.__E2E_ACTIONS__!.getTimelineSnapshot!().tracks.flatMap((track) => track.clips).find((item) => item.type === 'video');
        return clip?.audioChannelRouting;
      })
    )
    .toBe('swap-stereo');
  await expect(page.locator('[data-testid^="mixer-channel-routing-"]').first()).toHaveAttribute('data-routing-kind', 'routed');
  await expect(page.locator('[data-testid^="mixer-channel-routing-"]').first()).toHaveAttribute('data-routed-clip-count', '1');

  await openExportDialog(page);
  await page.getByTestId('export-enqueue-button').click();
  await expectExportTaskStatus(page, 0, 'success');

  const plan = await page.evaluate(() => window.__E2E_ACTIONS__!.getLastExportPlan!() as { filterComplex: string; fullArgs: string[] });
  expect(plan.fullArgs).toContain('-filter_complex');
  expect(plan.filterComplex).toContain('pan=stereo|c0=c1|c1=c0');
});

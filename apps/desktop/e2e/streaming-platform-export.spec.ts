import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, expectExportTaskStatus, openExportDialog, waitForE2eActions } from './e2e-actions';

test('exports with the TikTok platform preset dimensions and loudness normalization', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);

  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setSavePath!('C:/Exports/tiktok-platform.mp4'));

  await openExportDialog(page);
  await page.getByTestId('export-preset-select').selectOption('tiktok');
  await page.getByTestId('export-enqueue-button').click();

  await expectExportTaskStatus(page, 0, 'success');
  await expect
    .poll(() =>
      page.evaluate(() => {
        const plan = window.__E2E_ACTIONS__!.getLastExportPlan!();
        return {
          args: plan?.fullArgs.join(' ') ?? '',
          filterComplex: plan?.filterComplex ?? '',
          passKinds: plan?.passes?.map((pass) => pass.kind ?? pass.name) ?? []
        };
      })
    )
    .toEqual({
      args: expect.stringContaining('-b:v 6M'),
      filterComplex: expect.stringContaining('scale=1080:1920:force_original_aspect_ratio=decrease'),
      passKinds: ['loudness-analysis', 'render']
    });
  const planText = await page.evaluate(() => window.__E2E_ACTIONS__!.getLastExportPlan!()?.filterComplex ?? '');
  expect(planText).toContain('pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black');
  expect(planText).toContain('loudnorm=I=-14:TP=-1.5:LRA=11');
});

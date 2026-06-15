import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, expectExportTaskStatus, openExportDialog, waitForE2eActions } from './e2e-actions';

test('exports with YouTube loudness normalization and shows measured loudness', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);

  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setSavePath!('C:/Exports/loudness-normalized.mp4'));

  await openExportDialog(page);
  await page.getByTestId('export-master-processing-summary').click();
  await page.getByTestId('export-loudness-normalization-select').selectOption('youtube');
  await page.getByTestId('export-enqueue-button').click();

  await expect
    .poll(() =>
      page.evaluate(() => {
        const plan = window.__E2E_ACTIONS__!.getLastExportPlan!();
        return {
          filterComplex: plan?.filterComplex ?? '',
          passKinds: plan?.passes?.map((pass) => pass.kind ?? pass.name) ?? []
        };
      })
    )
    .toEqual({
      filterComplex: expect.stringContaining('loudnorm=I=-14:TP=-1.5:LRA=11'),
      passKinds: ['loudness-analysis', 'render']
    });
  await expect(page.getByTestId('export-task-loudness-report')).toContainText('实际响度：-14.1 LUFS');
});

test('exports with master limiter enabled in the dedicated master processing section', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);

  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);

  await openExportDialog(page);
  await page.getByTestId('export-master-processing-summary').click();
  await page.getByTestId('export-master-limiter-toggle').check();
  await page.getByTestId('export-enqueue-button').click();
  await expectExportTaskStatus(page, 0, 'success');

  const plan = await page.evaluate(() => window.__E2E_ACTIONS__!.getLastExportPlan!() as { filterComplex: string });
  expect(plan.filterComplex).toContain('alimiter=level_out=-0.1dB');
});

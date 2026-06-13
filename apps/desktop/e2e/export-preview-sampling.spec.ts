import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, openExportDialog, waitForE2eActions } from './e2e-actions';

test('generates three export preview thumbnails from sampled frames', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);

  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);
  await openExportDialog(page);

  await page.getByTestId('export-preview-button').click();
  await expect(page.getByTestId('export-preview-thumbnail')).toHaveCount(3);

  const result = await page.evaluate(
    () =>
      window.__E2E_ACTIONS__!.getLastExportPreviewSamplesResult!() as {
        samples: Array<{ path: string; time: number }>;
      }
  );
  expect(result.samples.map((sample) => sample.time)).toEqual([0, 3, 6]);
  for (const sample of result.samples) {
    const exists = await page.evaluate((path) => window.__E2E_ACTIONS__!.getFileExists!(path), sample.path);
    expect(exists).toBe(true);
  }

  const calls = await page.evaluate(
    () =>
      window.__E2E_ACTIONS__!.getExportPreviewRunCalls!() as Array<{
        fullArgs: string[];
        outputPath: string;
      }>
  );
  expect(calls).toHaveLength(3);
  for (const call of calls) {
    expect(call.fullArgs).toEqual(expect.arrayContaining(['-frames:v', '1', '-f', 'image2', call.outputPath]));
  }
});

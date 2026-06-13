import { expect, test } from '@playwright/test';
import { expectExportTaskStatus, openExportDialog, waitForE2eActions } from './e2e-actions';

test('exports an audio clip as an audio visualization video with the original audio stream', async ({ page }) => {
  const outputPath = 'C:/Exports/e2e-audio-viz.mp4';
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate((path) => window.__E2E_ACTIONS__!.setSavePath!(path), outputPath);
  await page.getByTestId('import-media-button').click();

  const audioCard = page.locator('[data-testid^="media-card-"]').filter({ hasText: 'tiny-audio.wav' }).first();
  await expect(audioCard).toBeVisible();
  await audioCard.locator('[data-testid^="add-to-timeline-"]').click();

  await openExportDialog(page);
  await page.getByTestId('export-output-mode-select').selectOption('audio-visualization');
  await expect(page.getByTestId('export-audio-viz-section')).toBeVisible();
  await page.getByTestId('export-audio-viz-style-select').selectOption('spectrum-bars');
  await page.getByTestId('export-audio-viz-background-select').selectOption('gradient');
  await page.getByTestId('export-audio-viz-background-color-input').fill('#050816');
  await page.getByTestId('export-audio-viz-background-color2-input').fill('#1d4ed8');
  await page.getByTestId('export-enqueue-button').click();
  await expectExportTaskStatus(page, 0, 'success');

  await expect.poll(() => page.evaluate((path) => window.__E2E_ACTIONS__!.getFileExists!(path) as boolean, outputPath)).toBe(true);
  const plan = await page.evaluate(
    () =>
      window.__E2E_ACTIONS__!.getLastExportPlan!() as {
        filterComplex: string;
        fullArgs: string[];
        maps: string[];
      }
  );
  expect(plan.maps).toEqual(['-map', '[vout]', '-map', '[aout]']);
  expect(plan.fullArgs).toEqual(expect.arrayContaining(['-map', '[vout]', '-map', '[aout]', '-c:a', 'aac']));
  expect(plan.filterComplex).toContain('showfreqs=s=');
  expect(plan.filterComplex).toContain('mode=bar:ascale=log');
  expect(plan.filterComplex).toContain('[amixout]asplit=2[aout][audio_visualization_mix]');
});

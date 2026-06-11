import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, expectExportTaskStatus, openExportDialog, waitForE2eActions } from './e2e-actions';

test('exports track pan from the audio mixer into FFmpeg args', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);

  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);
  await expect(page.getByTestId('audio-mixer')).toBeVisible();
  await page.locator('[data-testid^="mixer-pan-"]').first().fill('-1');

  await openExportDialog(page);
  await expect(page.getByTestId('export-dialog')).toBeVisible();
  await page.getByTestId('export-enqueue-button').click();
  await expectExportTaskStatus(page, 0, 'success');

  const plan = await page.evaluate(() => window.__E2E_ACTIONS__!.getLastExportPlan!() as { filterComplex: string; fullArgs: string[] });
  expect(plan.fullArgs).toContain('-filter_complex');
  expect(plan.filterComplex).toContain('stereopan=pan=-1');
});

test('exports track EQ and compressor from the audio mixer into FFmpeg args', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);

  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);
  await expect(page.getByTestId('audio-mixer')).toBeVisible();
  await page.locator('[data-testid^="mixer-expand-"]').first().click();
  await expect(page.locator('[data-testid^="mixer-eq-graph-"]').first()).toBeVisible();
  await page.locator('[data-testid^="mixer-eq-gain-"]').first().fill('6');
  await page.locator('[data-testid^="mixer-compressor-enabled-"]').first().check();
  await page.locator('[data-testid^="mixer-compressor-threshold-"]').first().fill('-24');
  await page.locator('[data-testid^="mixer-compressor-ratio-"]').first().fill('4');

  await openExportDialog(page);
  await expect(page.getByTestId('export-dialog')).toBeVisible();
  await page.getByTestId('export-enqueue-button').click();
  await expectExportTaskStatus(page, 0, 'success');

  const plan = await page.evaluate(() => window.__E2E_ACTIONS__!.getLastExportPlan!() as { filterComplex: string; fullArgs: string[] });
  expect(plan.fullArgs).toContain('-filter_complex');
  expect(plan.filterComplex).toContain('equalizer=f=100:width_type=o:width=0.7:g=6');
  expect(plan.filterComplex).toContain('acompressor=threshold=0.063:ratio=4');
});

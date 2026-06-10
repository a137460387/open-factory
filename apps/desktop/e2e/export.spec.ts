import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('builds a multitrack FFmpeg plan with text artifacts and runs mocked export', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.holdExportGate!());
  await page.getByTestId('import-media-button').click();
  await page.locator('[data-testid^="media-card-"]').nth(0).getByText('Add to timeline').click();
  await page.getByTitle('Add text clip').click();

  await page.getByLabel('Export video').click();
  await expect(page.getByTestId('export-dialog')).toBeVisible();
  await page.getByTestId('export-preset-select').selectOption('web-1080p');
  await page.getByTestId('export-fps-input').fill('60');
  await page.getByTestId('export-batch-paths').fill('C:/Exports/e2e-output.mp4\nC:/Exports/e2e-output-2.mp4');
  await page.getByTestId('export-enqueue-button').click();
  await expect(page.getByTestId('export-task-status').first()).toHaveText('running');
  await expect(page.getByTestId('export-task-status').nth(1)).toHaveText('pending');
  await page.getByTestId('export-task-cancel-button').nth(1).click();
  await expect(page.getByTestId('export-task-status').nth(1)).toHaveText('canceled');
  await page.evaluate(() => window.__E2E_ACTIONS__!.releaseExportGate!());
  await expect(page.getByTestId('export-task-status').first()).toHaveText('success');
  await page.getByTestId('export-task-retry-button').click();
  await expect(page.getByTestId('export-task-status').nth(1)).toHaveText('success');

  const plan = await page.evaluate(() => window.__E2E_ACTIONS__!.getLastExportPlan!() as { fullArgs: string[]; filterComplex: string; textArtifacts: unknown[] });
  expect(plan.fullArgs).toContain('-filter_complex');
  expect(plan.filterComplex).toContain('s=1920x1080:r=60');
  expect(plan.filterComplex).toContain('overlay=');
  expect(plan.filterComplex).toContain('drawtext=textfile=__TEXTFILE_');
  expect(plan.filterComplex).toContain('[0:a:0]');
  expect(plan.filterComplex).toContain('amix=inputs=1');
  expect(plan.textArtifacts).toHaveLength(1);
  expect(plan.fullArgs.at(-1)).toBe('C:/Exports/e2e-output-2.mp4');
});

import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, expectExportTaskStatus, openExportDialog, waitForE2eActions } from './e2e-actions';

test('builds a multitrack FFmpeg plan with text artifacts and runs mocked export', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.holdExportGate!());
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);
  await page.getByTestId('add-text-clip-button').click();

  await openExportDialog(page);
  await expect(page.getByTestId('export-dialog')).toBeVisible();
  await page.getByTestId('export-preset-select').selectOption('web-1080p');
  await page.getByTestId('export-fps-input').fill('60');
  await page.getByTestId('export-batch-paths').fill('C:/Exports/e2e-output.mp4\nC:/Exports/e2e-output-2.mp4');
  await page.getByTestId('export-enqueue-button').click();
  await expectExportTaskStatus(page, 0, 'running');
  await expectExportTaskStatus(page, 1, 'pending');
  await page.getByTestId('export-task-cancel-button').nth(1).click();
  await expectExportTaskStatus(page, 1, 'canceled');
  await page.evaluate(() => window.__E2E_ACTIONS__!.releaseExportGate!());
  await expectExportTaskStatus(page, 0, 'success');
  await page.getByTestId('export-task-retry-button').click();
  await expectExportTaskStatus(page, 1, 'success');

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

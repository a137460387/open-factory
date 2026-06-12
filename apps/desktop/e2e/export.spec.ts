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
  await page.getByTestId('export-max-concurrent-select').selectOption('1');
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

test('runs export queue with two concurrent tasks and starts the third after a slot frees', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.holdExportGate!());
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);

  await openExportDialog(page);
  await page.getByTestId('export-preset-select').selectOption('web-1080p');
  await page.getByTestId('export-max-concurrent-select').selectOption('2');
  await page.getByTestId('export-batch-paths').fill('C:/Exports/queue-a.mp4\nC:/Exports/queue-b.mp4\nC:/Exports/queue-c.mp4');
  await page.getByTestId('export-enqueue-button').click();

  await expectExportTaskStatus(page, 0, 'running');
  await expectExportTaskStatus(page, 1, 'running');
  await expectExportTaskStatus(page, 2, 'pending');

  await page.evaluate(() => window.__E2E_ACTIONS__!.releaseExportGate!());

  await expectExportTaskStatus(page, 0, 'success');
  await expectExportTaskStatus(page, 1, 'running');
  await expectExportTaskStatus(page, 2, 'running');
  await page.evaluate(() => window.__E2E_ACTIONS__!.releaseAllExportGates!());
  await expectExportTaskStatus(page, 1, 'success');
  await expectExportTaskStatus(page, 2, 'success');
});

test('uses detected NVENC hardware encoder when hardware encoding is enabled', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);

  await openExportDialog(page);
  await page.getByTestId('export-preset-select').selectOption('web-1080p');
  await expect(page.getByTestId('export-hardware-encoding-toggle')).toBeEnabled();
  await page.getByTestId('export-hardware-encoding-toggle').check();
  await page.getByTestId('export-enqueue-button').click();
  await expectExportTaskStatus(page, 0, 'success');

  const plan = await page.evaluate(() => window.__E2E_ACTIONS__!.getLastExportPlan!() as { fullArgs: string[] });
  expect(plan.fullArgs).toEqual(expect.arrayContaining(['-c:v', 'h264_nvenc', '-preset', 'p4', '-cq', '23']));
});

test('blocks export when preflight finds missing media and allows export after relink', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setMissingProjectNext!());
  await page.getByTestId('toolbar-open-project-button').click();
  await expect(page.locator('[data-testid^="media-card-"][data-missing="true"]')).toBeVisible();

  await openExportDialog(page);
  await page.getByTestId('export-enqueue-button').click();
  await expect(page.getByTestId('export-preflight-panel')).toBeVisible();
  await expect(page.getByTestId('export-preflight-issue')).toHaveAttribute('data-type', 'missing-media');
  await expect(page.getByTestId('export-preflight-panel')).toContainText('tiny-video.mp4');
  await expect(page.getByTestId('export-task-status')).toHaveCount(0);

  await page.getByTestId('export-preflight-relink-button').click();
  await expect(page.locator('[data-testid^="media-card-"][data-missing="true"]')).toHaveCount(0);

  await openExportDialog(page);
  await page.getByTestId('export-enqueue-button').click();
  await expectExportTaskStatus(page, 0, 'success');
});

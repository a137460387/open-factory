import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, expectExportTaskStatus, openExportDialog, waitForE2eActions } from './e2e-actions';

test('uses project frame rate for timeline timecode and exports at selected target fps', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.clearE2eFiles!());
  await page.reload();
  await waitForE2eActions(page);

  await page.getByTestId('toolbar-settings-button').click();
  await page.getByTestId('project-fps-select').selectOption('24');
  await expect(page.getByTestId('project-timecode-format-select')).toBeDisabled();
  await page.getByTestId('settings-close-button').click();

  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);
  await expect(page.getByTestId('timeline-ruler')).toContainText('00:00:01:00');

  await openExportDialog(page);
  await page.getByTestId('export-fps-select').selectOption('24');
  await page.getByTestId('export-enqueue-button').click();
  await expect(page.getByTestId('export-preflight-panel')).toBeVisible();
  await expect(page.getByTestId('export-preflight-issue')).toHaveAttribute('data-type', 'frame-rate-mismatch');
  await page.getByTestId('export-preflight-continue-button').click();
  await expectExportTaskStatus(page, 0, 'success');

  const plan = await page.evaluate(() => window.__E2E_ACTIONS__!.getLastExportPlan!() as { fullArgs: string[]; filterComplex: string });
  expect(plan.fullArgs).toEqual(expect.arrayContaining(['-r', '24']));
  expect(plan.filterComplex).toContain('fps=24');
});

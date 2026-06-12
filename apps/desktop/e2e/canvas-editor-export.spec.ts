import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, expectExportTaskStatus, openExportDialog, waitForE2eActions } from './e2e-actions';

test('rotates a clip from canvas edit mode and includes rotate in the export plan', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);

  await page.getByTestId('preview-canvas-edit-toggle').click();
  await expect(page.getByTestId('canvas-transform-overlay')).toBeVisible();
  await page.getByTestId('canvas-transform-overlay').click({ position: { x: 480, y: 270 } });
  await expect(page.getByTestId('canvas-transform-bounds')).toBeVisible();

  await page.getByTestId('clip-rotation-input').fill('30');
  await page.getByTestId('clip-rotation-input').press('Enter');
  await expect(page.getByTestId('clip-rotation-input')).toHaveValue('30');

  await openExportDialog(page);
  await page.getByTestId('export-enqueue-button').click();
  await expectExportTaskStatus(page, 0, 'success');

  const plan = await page.evaluate(() => window.__E2E_ACTIONS__!.getLastExportPlan!() as { filterComplex: string });
  expect(plan.filterComplex).toContain('rotate=30*PI/180:c=none');
});

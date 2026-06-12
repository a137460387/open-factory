import { expect, test } from '@playwright/test';
import { expectExportTaskStatus, openExportDialog, waitForE2eActions } from './e2e-actions';

test('applies a fade text animation preset and exports the generated keyframes', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);

  await page.getByTestId('add-text-clip-button').click();
  const textClip = page.locator('[data-clip-type="text"]').first();
  await expect(textClip).toBeVisible();
  const clipId = await textClip.getAttribute('data-clip-id');
  expect(clipId).toBeTruthy();

  await page.getByTestId('clip-text-input').fill('Animated Title');
  await page.getByTestId('clip-text-input').blur();
  await page.getByTestId('text-animation-preset-select').selectOption('fade');
  await page.getByTestId('text-animation-duration-input').fill('0.5');
  await page.getByTestId('text-animation-direction-select').selectOption('in');
  await page.getByTestId('apply-text-animation-button').click();

  await expect(page.getByTestId('text-animation-keyframe-summary')).toContainText('2');
  await expect(page.locator(`[data-testid^="timeline-keyframe-${clipId}-opacity-"]`)).toHaveCount(2);

  await openExportDialog(page);
  await page.getByTestId('export-enqueue-button').click();
  await expectExportTaskStatus(page, 0, 'success');

  const plan = await page.evaluate(() => window.__E2E_ACTIONS__!.getLastExportPlan!() as { filterComplex: string });
  expect(plan.filterComplex).toContain('fade=t=in');
  expect(plan.filterComplex).toContain('alpha=1');
});

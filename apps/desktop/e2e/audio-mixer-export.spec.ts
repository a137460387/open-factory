import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('exports track pan from the audio mixer into FFmpeg args', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);

  await page.getByTestId('import-media-button').click();
  await page.locator('[data-testid^="media-card-"]').nth(0).getByText('Add to timeline').click();
  await expect(page.getByTestId('audio-mixer')).toBeVisible();
  await page.locator('[data-testid^="mixer-pan-"]').first().fill('-1');

  await page.getByLabel('Export video').click();
  await expect(page.getByTestId('export-dialog')).toBeVisible();
  await page.getByTestId('export-enqueue-button').click();
  await expect(page.getByTestId('export-task-status').first()).toHaveText('success');

  const plan = await page.evaluate(() => window.__E2E_ACTIONS__!.getLastExportPlan!() as { filterComplex: string; fullArgs: string[] });
  expect(plan.fullArgs).toContain('-filter_complex');
  expect(plan.filterComplex).toContain('stereopan=pan=-1');
});

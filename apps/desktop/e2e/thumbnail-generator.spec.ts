import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('generates thumbnail candidates and exports a selected PNG', async ({ page }) => {
  const outputPath = 'C:/Exports/ai-thumbnail.png';

  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.clearE2eFiles!());
  await page.reload();
  await waitForE2eActions(page);
  await page.evaluate((path) => window.__E2E_ACTIONS__!.setSavePath!(path), outputPath);

  await page.getByTestId('import-media-button').click();
  await expect(page.locator('[data-testid^="media-card-"]').first()).toBeVisible();

  await page.getByTestId('toolbar-tools-menu-button').click();
  await page.getByTestId('toolbar-tools-thumbnail-generator-menu-item').click();
  await expect(page.getByTestId('thumbnail-generator-dialog')).toBeVisible();

  await page.getByTestId('thumbnail-title-input').fill('Launch');
  await page.getByTestId('thumbnail-analyze-button').click();
  await expect(page.getByTestId('thumbnail-candidate-grid')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId(/^thumbnail-candidate-\d+$/)).toHaveCount(5);

  await page.getByTestId('thumbnail-candidate-1').click();
  await page.getByTestId('thumbnail-export-selected-button').click();

  await expect.poll(() => page.evaluate((path) => window.__E2E_ACTIONS__!.getWrittenFileSize!(path) as number, outputPath)).toBeGreaterThan(0);
  const plan = await page.evaluate(() => window.__E2E_ACTIONS__!.getLastExportPlan!() as { outputArgs: string[]; filterComplex: string });
  expect(plan.outputArgs).toEqual(expect.arrayContaining(['-frames:v', '1', '-f', 'image2', outputPath]));
  expect(plan.filterComplex).toContain('drawtext=textfile=');
});

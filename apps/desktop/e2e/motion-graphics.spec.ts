import { expect, test } from '@playwright/test';
import { expectExportTaskStatus, openExportDialog, waitForE2eActions } from './e2e-actions';

test('adds a countdown motion graphic and exports it as a baked overlay sequence', async ({ page }) => {
  const outputPath = 'C:/Exports/motion-graphic-countdown.mp4';

  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate((path) => window.__E2E_ACTIONS__!.setSavePath!(path), outputPath);

  await page.getByTestId('toolbar-tools-menu-button').click();
  await page.getByTestId('toolbar-tools-motion-graphic-menu-item').click();

  const motionGraphicClip = page.locator('[data-clip-type="motion-graphic"]').first();
  await expect(motionGraphicClip).toBeVisible();
  await motionGraphicClip.click();
  await expect(page.getByTestId('motion-graphic-template-select')).toHaveValue('countdown');
  await page.getByTestId('motion-graphic-param-startSeconds').fill('8');

  await openExportDialog(page);
  await page.getByTestId('export-enqueue-button').click();
  await expectExportTaskStatus(page, 0, 'success');

  const plan = await page.evaluate(
    () =>
      window.__E2E_ACTIONS__!.getLastExportPlan!() as {
        filterComplex: string;
        textArtifacts: Array<{ pathMode?: string }>;
      }
  );
  expect(plan.filterComplex).toContain('overlay=');
  expect(plan.textArtifacts.some((artifact) => artifact.pathMode === 'motion-graphic-sequence')).toBe(true);
  await expect.poll(() => page.evaluate((path) => window.__E2E_ACTIONS__!.getWrittenFileSize!(path), outputPath)).toBeGreaterThan(0);
});

import { expect, test } from '@playwright/test';
import { expectExportTaskStatus, openExportDialog, waitForE2eActions } from './e2e-actions';

test('detects privacy regions and exports pixelized mask filters', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => {
    window.__E2E_ACTIONS__!.clearE2eFiles!();
    window.__E2E_ACTIONS__!.setupPrivacyBlurFixture!();
  });

  await expect(page.getByTestId('privacy-blur-panel')).toBeVisible();
  await page.getByTestId('privacy-blur-effect-select').selectOption('pixelize');
  await page.getByTestId('privacy-blur-detect-button').click();

  await expect.poll(() => page.evaluate(() => window.__E2E_ACTIONS__!.getTimelineSnapshot!().tracks[0].clips[0].masks?.length ?? 0)).toBeGreaterThan(0);

  await openExportDialog(page);
  await page.getByTestId('export-enqueue-button').click();
  await expectExportTaskStatus(page, 0, 'success');

  const plan = await page.evaluate(() => window.__E2E_ACTIONS__!.getLastExportPlan!() as { filterComplex: string });
  expect(plan.filterComplex).toContain('pixelize');
  expect(plan.filterComplex).toContain('overlay=');
});

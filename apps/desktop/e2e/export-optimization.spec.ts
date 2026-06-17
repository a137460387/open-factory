import { expect, test } from '@playwright/test';
import { openExportDialog, waitForE2eActions } from './e2e-actions';

test('shows proxy optimization suggestion for 4K media and applies it', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupExportOptimizationFixture!());

  await openExportDialog(page);

  await expect(page.getByTestId('export-optimization-panel')).toBeVisible();
  await expect(page.getByTestId('export-optimization-suggestion-proxy-for-4k-downscale')).toContainText('4K');
  await page.getByTestId('apply-export-suggestion-proxy-for-4k-downscale').click();

  await expect(page.getByTestId('export-hardware-encoding-toggle')).toBeChecked();
  await expect(page.getByTestId('export-scale-mode-select')).toHaveValue('fit');
});

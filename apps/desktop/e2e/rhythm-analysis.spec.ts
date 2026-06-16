import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('opens rhythm analysis from the tools menu and shows project statistics', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupGapFillFixture!());

  await page.getByTestId('toolbar-tools-menu-button').click();
  await page.getByTestId('toolbar-tools-rhythm-analysis-menu-item').click();

  await expect(page.getByTestId('rhythm-analysis-dialog')).toBeVisible();
  await expect(page.getByTestId('rhythm-analysis-stats')).toBeVisible();
  await expect(page.getByTestId('rhythm-analysis-stat-shot-count')).toContainText('2');
  await expect(page.getByTestId('rhythm-analysis-stat-average-shot')).toBeVisible();
  await expect(page.getByTestId('rhythm-analysis-curve-canvas')).toBeVisible();
});

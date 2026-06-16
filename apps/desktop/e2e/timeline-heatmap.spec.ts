import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('enables timeline heatmap overlay from the view menu', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupGapFillFixture!());

  await page.getByTestId('toolbar-view-menu-button').click();
  await page.getByTestId('toolbar-view-heatmap-menu-item').click();
  await page.getByTestId('toolbar-view-heatmap-type-select').selectOption('volume');
  await page.getByTestId('toolbar-view-heatmap-opacity-input').fill('70');

  await expect(page.getByTestId('timeline-heatmap-canvas')).toBeVisible();
  await expect(page.getByTestId('toolbar-view-heatmap-controls')).toBeVisible();
});

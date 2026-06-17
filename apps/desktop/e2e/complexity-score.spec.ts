import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('opens complexity score panel with radar and total score', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupComplexityScoreFixture!());

  await page.getByTestId('toolbar-tools-menu-button').click();
  await page.getByTestId('toolbar-tools-complexity-score-menu-item').click();

  await expect(page.getByTestId('complexity-score-panel')).toBeVisible();
  await expect(page.getByTestId('complexity-radar-canvas')).toBeVisible();
  await expect(page.getByTestId('complexity-score-total')).not.toHaveText('0.0');
  await expect(page.getByTestId('complexity-dimension-row')).toHaveCount(5);
});

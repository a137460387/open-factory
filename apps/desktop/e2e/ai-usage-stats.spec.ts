import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('AI usage stats shows call counts and recommendations', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupAIUsageStatsFixture!());

  // Open settings dialog and navigate to AI services tab
  await page.getByTestId('toolbar-settings-button').click();
  await page.getByTestId('settings-tab-ai-services').click();

  // Wait for the usage stats panel to be visible
  await expect(page.getByTestId('ai-usage-stats')).toBeVisible();

  // Verify total calls count shows 3 records
  await expect(page.getByTestId('ai-usage-stats')).toContainText('3');

  // Verify charts are rendered
  await expect(page.getByTestId('usage-bar-chart')).toBeVisible();
  await expect(page.getByTestId('usage-pie-chart')).toBeVisible();
  await expect(page.getByTestId('usage-line-chart')).toBeVisible();

  // Verify at least one recommendation appears (3 different features used should trigger rules)
  await expect(page.getByTestId('ai-recommendation-0')).toBeVisible();

  // Verify cost alert threshold input exists
  await expect(page.getByTestId('cost-alert-threshold')).toBeVisible();
});

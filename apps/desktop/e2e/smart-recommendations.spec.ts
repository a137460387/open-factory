import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('shows smart recommendations for a timeline gap', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupSmartRecommendationsFixture!());

  await page.getByTestId('toolbar-tools-menu-button').click();
  await page.getByTestId('toolbar-tools-smart-recommendations-menu-item').click();

  await expect(page.getByTestId('smart-recommendations-dialog')).toBeVisible();
  await expect(page.getByTestId('smart-recommendation-card').first()).toContainText('recommended-fill.mp4');
  await expect(page.getByTestId('smart-recommendation-gap')).toContainText('Video 1');
  await expect(page.getByTestId('smart-recommendation-preview')).toContainText('颜色相似');
});

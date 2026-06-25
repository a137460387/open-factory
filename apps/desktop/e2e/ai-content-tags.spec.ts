import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('analyze media content via AI and search by AI tags', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupAIContentTagsFixture!());

  const assetId = 'media-ai-content-video';
  await page.getByTestId(`media-card-${assetId}`).click({ button: 'right' });
  await expect(page.getByTestId(`media-label-menu-${assetId}`)).toBeVisible();
  await page.getByTestId(`media-ai-analyze-${assetId}`).click();

  await expect(page.getByTestId('ai-content-analysis-dialog')).toBeVisible();
  await page.getByTestId('ai-content-analysis-start').click();
  await expect(page.getByTestId('ai-content-analysis-results')).toBeVisible({ timeout: 10_000 });

  await expect(page.getByTestId('ai-tag-0')).toBeVisible();
  await expect(page.getByTestId('ai-tag-1')).toBeVisible();

  await page.getByTestId('ai-content-analysis-apply').click();
  await expect(page.getByTestId(`ai-tags-${assetId}`)).toBeVisible({ timeout: 5_000 });

  await page.getByTestId('media-search-input').fill('室内');
  await expect(page.getByTestId(`media-card-${assetId}`)).toBeVisible();
});

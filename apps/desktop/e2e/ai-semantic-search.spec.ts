import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('toggle AI semantic search mode and display results', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupAISemanticSearchFixture!());

  // Verify AI search toggle button is visible
  const toggle = page.getByTestId('ai-search-toggle');
  await expect(toggle).toBeVisible();

  // Activate AI semantic search mode
  await toggle.click();
  await expect(page.getByTestId('ai-semantic-search-panel')).toBeVisible();

  // Type a semantic query and submit
  const searchInput = page.getByTestId('ai-search-input');
  await expect(searchInput).toBeVisible();
  await searchInput.fill('阳光明媚的户外场景');
  await page.getByTestId('ai-search-submit').click();

  // Wait for results
  await expect(page.getByTestId('ai-search-loading')).toBeVisible();
  await expect(page.getByTestId('ai-search-results')).toBeVisible({ timeout: 10_000 });

  // Verify 2 result cards are shown with correct media IDs
  await expect(page.getByTestId('ai-search-result-media-ai-search-a')).toBeVisible();
  await expect(page.getByTestId('ai-search-result-media-ai-search-b')).toBeVisible();

  // Verify score badge is shown (contains percentage text)
  const resultA = page.getByTestId('ai-search-result-media-ai-search-a');
  await expect(resultA).toContainText('92%');
  const resultB = page.getByTestId('ai-search-result-media-ai-search-b');
  await expect(resultB).toContainText('75%');

  // Verify tooltip with match reason via title attribute
  await expect(resultA).toHaveAttribute('title', /室外阳光明媚/);
  await expect(resultB).toHaveAttribute('title', /户外元素/);

  // Verify unanalyzed media group is shown
  await expect(page.getByTestId('ai-search-unanalyzed')).toBeVisible();

  // Click a result card to select the media in the media bin
  await resultA.click();

  // Toggle back to keyword search mode
  await toggle.click();
  await expect(page.getByTestId('ai-semantic-search-panel')).not.toBeVisible();

  // Verify keyword search still works
  const keywordInput = page.getByTestId('media-search-input');
  await expect(keywordInput).toBeVisible();
  await keywordInput.fill('outdoor');
  await expect(page.getByTestId('media-card-media-ai-search-a')).toBeVisible();
});

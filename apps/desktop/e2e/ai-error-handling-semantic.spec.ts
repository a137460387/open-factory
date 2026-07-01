import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('AI semantic search: invalid JSON response shows error instead of crash', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupAISemanticSearchFixture!());

  // Override callAiApi to return non-JSON content, simulating an AI service error
  await page.evaluate(() => {
    const mocks = window.__TAURI_MOCKS__;
    if (mocks && typeof mocks === 'object') {
      (mocks as Record<string, unknown>).callAiApi = async () => ({
        content: '这不是有效的JSON响应 --- invalid response',
        inputTokens: 0,
        outputTokens: 0,
        latencyMs: 5,
      });
    }
  });

  // Verify AI search toggle is visible
  const toggle = page.getByTestId('ai-search-toggle');
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(page.getByTestId('ai-semantic-search-panel')).toBeVisible();

  // Type a query and submit
  const searchInput = page.getByTestId('ai-search-input');
  await expect(searchInput).toBeVisible();
  await searchInput.fill('测试查询');
  await page.getByTestId('ai-search-submit').click();

  // Verify error message is shown instead of crash
  const errorDiv = page.getByTestId('ai-search-error');
  await expect(errorDiv).toBeVisible({ timeout: 10_000 });
  await expect(errorDiv).toContainText('AI返回格式无效');

  // Verify no results are shown
  await expect(page.getByTestId('ai-search-results')).not.toBeVisible();

  // Verify page is still responsive — media search input should work
  const keywordInput = page.getByTestId('media-search-input');
  await expect(keywordInput).toBeVisible();
  await keywordInput.fill('outdoor');
  await expect(page.getByTestId('media-card-media-ai-search-a')).toBeVisible();
});

test('AI semantic search: thrown error in callAiApi shows generic error', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupAISemanticSearchFixture!());

  // Override callAiApi to throw an error, simulating a network failure
  await page.evaluate(() => {
    const mocks = window.__TAURI_MOCKS__;
    if (mocks && typeof mocks === 'object') {
      (mocks as Record<string, unknown>).callAiApi = async () => {
        throw new Error('网络连接失败');
      };
    }
  });

  const toggle = page.getByTestId('ai-search-toggle');
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(page.getByTestId('ai-semantic-search-panel')).toBeVisible();

  const searchInput = page.getByTestId('ai-search-input');
  await searchInput.fill('另一个查询');
  await page.getByTestId('ai-search-submit').click();

  // Verify error message from catch block
  const errorDiv = page.getByTestId('ai-search-error');
  await expect(errorDiv).toBeVisible({ timeout: 10_000 });
  await expect(errorDiv).toContainText('网络连接失败');

  // Page should still be responsive
  await expect(page.getByTestId('editor-main-layout')).toBeVisible();
});

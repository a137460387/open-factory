import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('AI local noise reduction: enable, process and verify completion', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupAIDenoiseLocalFixture!());

  // Wait for fixture state to fully propagate to the UI
  await expect(page.getByTestId('ai-local-denoise-toggle')).toBeVisible();
  await page.getByTestId('ai-local-denoise-toggle').click();

  // Allow the toggle state change to propagate and the noise-reduction-progress
  // event listener to register before starting the async processing
  await page.waitForTimeout(200);

  await page.getByTestId('ai-local-denoise-process').click();
  // 15s：processing 瞬时态依赖 mock 的 400ms 间隔渲染出来，慢 runner 上
  // 渲染调度积压需更宽容的等待（run 32625097893 12/12 稳定失败挂点）
  await expect(page.getByTestId('ai-local-denoise-progress')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('ai-local-denoise-complete')).toBeVisible({ timeout: 10_000 });
});

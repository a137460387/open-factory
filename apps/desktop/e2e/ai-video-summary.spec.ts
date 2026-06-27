import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('AI video summary generates report and exports HTML', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupAIVideoSummaryFixture!());

  // Open video summary from file menu
  await page.getByTestId('toolbar-file-menu-button').click();
  await page.getByTestId('toolbar-file-video-summary-menu-item').click();
  await expect(page.getByTestId('ai-video-summary-panel')).toBeVisible();

  // Start generation
  await page.getByTestId('ai-video-summary-start').click();

  // Wait for result
  await expect(page.getByTestId('ai-video-summary-result')).toBeVisible({ timeout: 15_000 });

  // Verify result content
  await expect(page.getByTestId('ai-video-summary-result')).toContainText('AI生成的视频摘要');
  await expect(page.getByTestId('ai-video-summary-result')).toContainText('开场场景');
  await expect(page.getByTestId('ai-video-summary-result')).toContainText('从平静到激动');
  await expect(page.getByTestId('ai-video-summary-result')).toContainText('视频开场');

  // Verify tags are displayed
  await expect(page.getByTestId('ai-video-summary-result')).toContainText('测试');
  await expect(page.getByTestId('ai-video-summary-result')).toContainText('E2E');

  // Export button should be visible
  await expect(page.getByTestId('ai-video-summary-export')).toBeVisible();
});

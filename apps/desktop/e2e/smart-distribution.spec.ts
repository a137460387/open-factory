import { test, expect } from '@playwright/test';
import { waitForE2eActions, waitForAppStore } from './e2e-actions';

test.describe('智能多平台分发系统', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForE2eActions(page);
    await waitForAppStore(page);
  });

  test('应能打开智能分发面板', async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      if (store?.setSmartDistributionOpen) store.setSmartDistributionOpen(true);
    });

    const panel = page.locator('[data-testid="smart-distribution-panel"]');
    await expect(panel).toBeVisible({ timeout: 10000 });
  });

  test('应显示所有平台卡片', async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      if (store?.setSmartDistributionOpen) store.setSmartDistributionOpen(true);
    });

    const panel = page.locator('[data-testid="smart-distribution-panel"]');
    await expect(panel).toBeVisible({ timeout: 10000 });

    const grid = page.locator('[data-testid="platform-grid"]');
    await expect(grid).toBeVisible();

    const cards = page.locator('[data-testid^="platform-card-"]');
    await expect(cards).toHaveCount(10);
  });

  test('应能选择和取消选择平台', async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      if (store?.setSmartDistributionOpen) store.setSmartDistributionOpen(true);
    });

    const panel = page.locator('[data-testid="smart-distribution-panel"]');
    await expect(panel).toBeVisible({ timeout: 10000 });

    const youtubeCard = page.locator('[data-testid="platform-card-youtube-1080p"]');
    await expect(youtubeCard).toBeVisible();

    // 使用 force click 避免被遮挡
    await youtubeCard.click({ force: true });
    await expect(youtubeCard).toHaveClass(/border-blue-500/, { timeout: 5000 });

    await youtubeCard.click({ force: true });
    await expect(youtubeCard).not.toHaveClass(/border-blue-500/, { timeout: 5000 });
  });

  test('智能推荐按钮应选择推荐平台', async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      if (store?.setSmartDistributionOpen) store.setSmartDistributionOpen(true);
    });

    const panel = page.locator('[data-testid="smart-distribution-panel"]');
    await expect(panel).toBeVisible({ timeout: 10000 });

    const recommendBtn = page.locator('[data-testid="select-recommended"]');
    await recommendBtn.click();

    const countText = page.locator('[data-testid="smart-distribution-panel"]').locator('text=/已选 \\d+ 个平台/');
    await expect(countText).toBeVisible();
  });

  test('全选按钮应选择所有平台', async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      if (store?.setSmartDistributionOpen) store.setSmartDistributionOpen(true);
    });

    const panel = page.locator('[data-testid="smart-distribution-panel"]');
    await expect(panel).toBeVisible({ timeout: 10000 });

    await page.locator('[data-testid="select-all"]').click();

    const countText = panel.locator('text=已选 10 个平台');
    await expect(countText).toBeVisible();
  });

  test('清除按钮应清除所有选择', async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      if (store?.setSmartDistributionOpen) store.setSmartDistributionOpen(true);
    });

    const panel = page.locator('[data-testid="smart-distribution-panel"]');
    await expect(panel).toBeVisible({ timeout: 10000 });

    await page.locator('[data-testid="select-all"]').click();
    await page.locator('[data-testid="clear-selection"]').click();

    const countText = panel.locator('text=已选 0 个平台');
    await expect(countText).toBeVisible();
  });

  test('未选择平台时导出按钮应禁用', async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      if (store?.setSmartDistributionOpen) store.setSmartDistributionOpen(true);
    });

    const panel = page.locator('[data-testid="smart-distribution-panel"]');
    await expect(panel).toBeVisible({ timeout: 10000 });

    const exportBtn = page.locator('[data-testid="start-distribution"]');
    await expect(exportBtn).toBeDisabled();
    await expect(exportBtn).toHaveText('请选择目标平台');
  });

  test('选择平台后导出按钮应启用', async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      if (store?.setSmartDistributionOpen) store.setSmartDistributionOpen(true);
    });

    const panel = page.locator('[data-testid="smart-distribution-panel"]');
    await expect(panel).toBeVisible({ timeout: 10000 });

    await page.locator('[data-testid="platform-card-youtube-1080p"]').click({ force: true });

    const exportBtn = page.locator('[data-testid="start-distribution"]');
    await expect(exportBtn).toBeEnabled({ timeout: 5000 });
    await expect(exportBtn).toHaveText('一键分发到 1 个平台');
  });

  test('关闭按钮应关闭面板', async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      if (store?.setSmartDistributionOpen) store.setSmartDistributionOpen(true);
    });

    const panel = page.locator('[data-testid="smart-distribution-panel"]');
    await expect(panel).toBeVisible({ timeout: 10000 });

    await page.locator('[data-testid="distribution-panel-close"]').click({ force: true });

    await expect(panel).not.toBeVisible({ timeout: 5000 });
  });
});

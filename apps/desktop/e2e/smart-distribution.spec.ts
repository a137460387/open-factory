import { test, expect } from '@playwright/test';

test.describe('智能多平台分发系统', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // 等待应用加载
    await page.waitForSelector('[data-testid="editor-shell"]', { timeout: 15000 }).catch(() => {
      // 如果没有 editor-shell，等待页面稳定
      return page.waitForLoadState('networkidle');
    });
  });

  test('应能打开智能分发面板', async ({ page }) => {
    // 通过 UIStore 打开分发面板
    await page.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      if (store?.editorUI) {
        store.editorUI.setSmartDistributionOpen(true);
      }
    });

    // 检查面板是否渲染
    const panel = page.locator('[data-testid="smart-distribution-panel"]');
    await expect(panel).toBeVisible({ timeout: 5000 });
  });

  test('应显示所有平台卡片', async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      if (store?.editorUI) {
        store.editorUI.setSmartDistributionOpen(true);
      }
    });

    const panel = page.locator('[data-testid="smart-distribution-panel"]');
    await expect(panel).toBeVisible({ timeout: 5000 });

    // 检查平台网格存在
    const grid = page.locator('[data-testid="platform-grid"]');
    await expect(grid).toBeVisible();

    // 检查至少有 10 个平台卡片
    const cards = page.locator('[data-testid^="platform-card-"]');
    await expect(cards).toHaveCount(10);
  });

  test('应能选择和取消选择平台', async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      if (store?.editorUI) {
        store.editorUI.setSmartDistributionOpen(true);
      }
    });

    const panel = page.locator('[data-testid="smart-distribution-panel"]');
    await expect(panel).toBeVisible({ timeout: 5000 });

    // 点击 YouTube 卡片
    const youtubeCard = page.locator('[data-testid="platform-card-youtube-1080p"]');
    await youtubeCard.click();

    // 验证已选中（卡片应有选中样式）
    await expect(youtubeCard).toHaveClass(/border-blue-500/);

    // 再次点击取消选中
    await youtubeCard.click();

    // 验证已取消选中
    await expect(youtubeCard).not.toHaveClass(/border-blue-500/);
  });

  test('智能推荐按钮应选择推荐平台', async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      if (store?.editorUI) {
        store.editorUI.setSmartDistributionOpen(true);
      }
    });

    const panel = page.locator('[data-testid="smart-distribution-panel"]');
    await expect(panel).toBeVisible({ timeout: 5000 });

    // 点击智能推荐按钮
    const recommendBtn = page.locator('[data-testid="select-recommended"]');
    await recommendBtn.click();

    // 验证有平台被选中（计数应大于 0）
    const countText = page.locator('[data-testid="smart-distribution-panel"]').locator('text=/已选 \\d+ 个平台/');
    await expect(countText).toBeVisible();
  });

  test('全选按钮应选择所有平台', async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      if (store?.editorUI) {
        store.editorUI.setSmartDistributionOpen(true);
      }
    });

    const panel = page.locator('[data-testid="smart-distribution-panel"]');
    await expect(panel).toBeVisible({ timeout: 5000 });

    // 点击全选
    const selectAllBtn = page.locator('[data-testid="select-all"]');
    await selectAllBtn.click();

    // 验证显示已选 10 个平台
    const countText = panel.locator('text=已选 10 个平台');
    await expect(countText).toBeVisible();
  });

  test('清除按钮应清除所有选择', async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      if (store?.editorUI) {
        store.editorUI.setSmartDistributionOpen(true);
      }
    });

    const panel = page.locator('[data-testid="smart-distribution-panel"]');
    await expect(panel).toBeVisible({ timeout: 5000 });

    // 先全选
    await page.locator('[data-testid="select-all"]').click();

    // 再清除
    await page.locator('[data-testid="clear-selection"]').click();

    // 验证显示已选 0 个平台
    const countText = panel.locator('text=已选 0 个平台');
    await expect(countText).toBeVisible();
  });

  test('未选择平台时导出按钮应禁用', async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      if (store?.editorUI) {
        store.editorUI.setSmartDistributionOpen(true);
      }
    });

    const panel = page.locator('[data-testid="smart-distribution-panel"]');
    await expect(panel).toBeVisible({ timeout: 5000 });

    const exportBtn = page.locator('[data-testid="start-distribution"]');
    await expect(exportBtn).toBeDisabled();
    await expect(exportBtn).toHaveText('请选择目标平台');
  });

  test('选择平台后导出按钮应启用', async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      if (store?.editorUI) {
        store.editorUI.setSmartDistributionOpen(true);
      }
    });

    const panel = page.locator('[data-testid="smart-distribution-panel"]');
    await expect(panel).toBeVisible({ timeout: 5000 });

    // 选择一个平台
    await page.locator('[data-testid="platform-card-youtube-1080p"]').click();

    const exportBtn = page.locator('[data-testid="start-distribution"]');
    await expect(exportBtn).toBeEnabled();
    await expect(exportBtn).toHaveText('一键分发到 1 个平台');
  });

  test('关闭按钮应关闭面板', async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      if (store?.editorUI) {
        store.editorUI.setSmartDistributionOpen(true);
      }
    });

    const panel = page.locator('[data-testid="smart-distribution-panel"]');
    await expect(panel).toBeVisible({ timeout: 5000 });

    // 点击关闭
    await page.locator('[data-testid="distribution-panel-close"]').click();

    // 验证面板消失
    await expect(panel).not.toBeVisible({ timeout: 3000 });
  });
});

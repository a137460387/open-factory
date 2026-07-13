import { test, expect } from './fixtures';

test.describe('媒体管理增强 - SQLite 索引与高级检索', () => {
  test.beforeEach(async ({ toolbar }) => {
    await toolbar.goto();
  });

  test('高级筛选按钮始终可见', async ({ page }) => {
    const toggle = page.locator('[data-testid="advanced-search-toggle"]');
    await expect(toggle).toBeVisible();
    await expect(toggle).toContainText('高级筛选');
  });

  test('高级筛选面板展开后显示内容', async ({ page }) => {
    const toggle = page.locator('[data-testid="advanced-search-toggle"]');
    await expect(toggle).toBeVisible();

    const tagCloud = page.locator('[data-testid="tag-cloud"]');
    await expect(tagCloud).not.toBeVisible();

    await toggle.click();

    const assetTypeFilter = page.locator('[data-testid="asset-type-filter"]');
    await expect(assetTypeFilter).toBeVisible();

    await toggle.click();
    await expect(assetTypeFilter).not.toBeVisible();
  });

  test('文件类型筛选按钮可交互', async ({ page }) => {
    await page.locator('[data-testid="advanced-search-toggle"]').click();

    const videoBtn = page.locator('[data-testid="asset-type-video"]');
    await expect(videoBtn).toBeVisible();
    await videoBtn.click();

    const audioBtn = page.locator('[data-testid="asset-type-audio"]');
    await expect(audioBtn).toBeVisible();
    await audioBtn.click();
  });

  test('分辨率预设筛选按钮可交互', async ({ page }) => {
    await page.locator('[data-testid="advanced-search-toggle"]').click();

    const resolutionFilter = page.locator('[data-testid="resolution-filter"]');
    await expect(resolutionFilter).toBeVisible();

    const preset4k = page.locator('[data-testid="resolution-4K+"]');
    await expect(preset4k).toBeVisible();
    await preset4k.click();
  });

  test('时长范围筛选按钮可交互', async ({ page }) => {
    await page.locator('[data-testid="advanced-search-toggle"]').click();

    const durationFilter = page.locator('[data-testid="duration-filter"]');
    await expect(durationFilter).toBeVisible();

    const shortVideo = page.locator('[data-testid="duration-短视频 (<10s)"]');
    await expect(shortVideo).toBeVisible();
    await shortVideo.click();
  });

  test('无项目时显示提示信息', async ({ page }) => {
    const hint = page.locator('text=打开项目后启用高级检索');
    await expect(hint).toBeVisible();
  });

  test('导入媒体后高级筛选面板可展开', async ({ page, mediaBin }) => {
    // 导入测试素材
    await mediaBin.importMedia();

    // 等待媒体卡片出现（导入完成）
    await page.waitForSelector('[data-testid^="media-card-"]', { timeout: 15000 });

    // 展开高级筛选面板
    const toggle = page.locator('[data-testid="advanced-search-toggle"]');
    await toggle.click();

    // 验证文件类型筛选区域可见
    const assetTypeFilter = page.locator('[data-testid="asset-type-filter"]');
    await expect(assetTypeFilter).toBeVisible();

    // 验证分辨率筛选区域可见
    const resolutionFilter = page.locator('[data-testid="resolution-filter"]');
    await expect(resolutionFilter).toBeVisible();
  });
});
